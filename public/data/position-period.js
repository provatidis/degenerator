import { validatePositionSnapshot } from './position-snapshot.js';
import { validateProvider } from './provenance.js';
import { calculateFixedPositionPeriod } from '../models/fixed-position-period.js';

export function periodModelPoint(point) {
  const s=point.snapshot,p=s.position,g=s.feeGrowth;
  return {
    liquidity:BigInt(p.liquidity),tickLower:p.tickLower,tickUpper:p.tickUpper,tick:s.pool.tick,
    sqrtPriceX96:BigInt(s.pool.sqrtPriceX96),timestamp:s.block.timestamp,secondsInside:BigInt(point.secondsInside),
    growth:{global0:BigInt(g.global0X128),global1:BigInt(g.global1X128),lower0:BigInt(g.lower.outside0X128),lower1:BigInt(g.lower.outside1X128),upper0:BigInt(g.upper.outside0X128),upper1:BigInt(g.upper.outside1X128)},
  };
}
function raw(value,bits) {
  if(typeof value!=='string'||!/^(0|[1-9]\d*)$/.test(value)||value.length>78||BigInt(value)>=1n<<BigInt(bits))throw new Error('Invalid period integer.');
  return value;
}
export function validatePositionPeriod(input) {
  if(input?.version!==1||input.kind!=='fixed-position-period'||input.chainId!==1)throw new Error('Unsupported historical case.');
  if(!Array.isArray(input.points)||input.points.length<2||input.points.length>32)throw new Error('Unsupported checkpoint count.');
  const points=input.points.map(point=>{
    const snapshot=validatePositionSnapshot(point.snapshot);
    if(snapshot.version!==2||BigInt(snapshot.position.liquidity)===0n)throw new Error('Historical checkpoints require positive liquidity and fee accounting.');
    if(!Array.isArray(point.simulatedCollect)||point.simulatedCollect.length!==2)throw new Error('Missing independent fee check.');
    return {snapshot,secondsInside:raw(point.secondsInside,32),simulatedCollect:point.simulatedCollect.map(value=>raw(value,128))};
  });
  const first=points[0],last=points.at(-1),start=periodModelPoint(first);
  if(input.id!=='position-'+first.snapshot.tokenId)throw new Error('Historical position ID differs.');
  const initialPosition=JSON.stringify(first.snapshot.position);
  let previous=null, previousResult=null;
  for(const point of points){
    if(point.snapshot.tokenId!==first.snapshot.tokenId||point.snapshot.poolAddress!==first.snapshot.poolAddress||JSON.stringify(point.snapshot.position)!==initialPosition)throw new Error('Position accounting changed during the historical case.');
    if(previous&&(BigInt(point.snapshot.block.number)<=BigInt(previous.snapshot.block.number)||point.snapshot.block.timestamp<=previous.snapshot.block.timestamp))throw new Error('Historical checkpoints must be ordered.');
    const result=calculateFixedPositionPeriod(start,periodModelPoint(point));
    if (previous) {
      // A plausible total can still conceal an impossible adjacent interval.
      if (result.earned0 < previousResult.earned0 || result.earned1 < previousResult.earned1) throw new Error('Historical period fee credits cannot decrease.');
      calculateFixedPositionPeriod(periodModelPoint(previous), periodModelPoint(point));
    }
    for(const [i,earned] of [result.earned0,result.earned1].entries()){
      const delta=BigInt(point.simulatedCollect[i])-BigInt(first.simulatedCollect[i]);
      if(delta<earned||delta-earned>1n)throw new Error('Historical fees disagree with the independent check.');
    }
    previous=point; previousResult=result;
  }
  const startBlock=BigInt(first.snapshot.block.number),endBlock=BigInt(last.snapshot.block.number);
  if(endBlock-startBlock>10000n)throw new Error('Historical case exceeds the supported block span.');
  if(!Array.isArray(input.eventQueries)||input.eventQueries.length<1||input.eventQueries.length>20)throw new Error('Missing continuity evidence.');
  let next=startBlock+1n;
  const eventQueries=input.eventQueries.map(query=>{
    const from=BigInt(raw(query.fromBlock,64)),to=BigInt(raw(query.toBlock,64));
    if(from!==next||to<from||to>endBlock||to-from>=500n||query.matchingEvents!==0)throw new Error('The continuity evidence has a gap or update.');
    next=to+1n;
    return {provider:validateProvider(query.provider),fromBlock:from.toString(),toBlock:to.toString(),matchingEvents:0};
  });
  if(next!==endBlock+1n)throw new Error('The continuity evidence does not cover the period.');
  const result=calculateFixedPositionPeriod(start,periodModelPoint(last));
  const earnedRaw=[result.earned0,result.earned1].map(String);
  const collectDeltaRaw=last.simulatedCollect.map((value,i)=>(BigInt(value)-BigInt(first.simulatedCollect[i])).toString());
  const validation={method:'unchanged-nft-and-collect-difference',earnedRaw,collectDeltaRaw,roundingDeltaRaw:collectDeltaRaw.map((value,i)=>(BigInt(value)-BigInt(earnedRaw[i])).toString()),durationSeconds:result.durationSeconds,secondsInRange:result.secondsInRange};
  if(JSON.stringify(input.validation)!==JSON.stringify(validation))throw new Error('The historical validation summary differs.');
  if(typeof input.capturedAt!=='string'||!Number.isFinite(Date.parse(input.capturedAt)))throw new Error('Invalid historical capture time.');
  return {version:1,kind:input.kind,id:input.id,chainId:1,points,eventQueries,validation,capturedAt:input.capturedAt};
}
