import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { createRpcClient } from '../public/data/rpc.js';
import { fetchPositionSnapshot } from '../public/data/uniswap-v3.js';
import { confirmBlock, finalizedBlock } from '../public/data/block.js';
import { abiWords, encodeInt, encodeUint, encodeWord, uintFromWord, decodeAddress } from '../public/data/abi.js';
import { V3 } from '../public/data/config.js';
import { feeGrowthInside, subtractGrowth, Q128 } from '../public/models/v3-fees.js';
import { validatePositionPeriod } from '../public/data/position-period.js';

// Development-only: read a bounded period for one unchanged NFT. No transactions.
const endpoint = process.env.REPLAY_RPC || 'https://eth.drpc.org';
const id = process.argv[2] || '1382030';
const startNumber = BigInt(process.argv[3] || '26168526');
const endNumber = BigInt(process.argv[4] || '26168941');
const checkpointCount = Number(process.argv[6] || 9);
assert.ok(startNumber > 0n && endNumber > startNumber && endNumber - startNumber <= 10000n, 'Choose a period of 1–10,000 blocks.');
assert.ok(Number.isInteger(checkpointCount) && checkpointCount >= 2 && checkpointCount <= 32 && BigInt(checkpointCount - 1) <= endNumber - startNumber, 'Choose 2–32 distinct checkpoints.');
const baseClient=createRpcClient({endpoint});
let queue=Promise.resolve();
const client=(method,params=[])=>{
  const task=queue.then(async()=>{
    await new Promise(resolve=>setTimeout(resolve,800));
    for(let attempt=0;;attempt++){
      try{return await baseClient(method,params);}
      catch(error){if(!error.retryable||attempt>=3)throw error;console.log('Provider busy; retrying read '+(attempt+1)+'…');await new Promise(resolve=>setTimeout(resolve,2000*2**attempt));}
    }
  });
  queue=task;return task;
};
const latest = await finalizedBlock(client);
assert.ok(endNumber <= BigInt(latest.block.number), 'Both endpoints must already be finalized.');
function pinned(number) {
  const rpc = (method, params = []) => client(method, method === 'eth_getBlockByNumber' && params[0] === 'finalized' ? ['0x' + number.toString(16), false] : params);
  Object.defineProperty(rpc, 'provider', { value: endpoint }); return rpc;
}
async function point(number) {
  const snapshot = await fetchPositionSnapshot(id, { rpc: pinned(number) });
  const tag = '0x' + number.toString(16), p = snapshot.position;
  const cumulativeData = await client('eth_call', [{to:snapshot.poolAddress,data:'0xa38807f2'+encodeInt(p.tickLower)+encodeInt(p.tickUpper)},tag]);
  const secondsInside = uintFromWord(abiWords(cumulativeData,3)[2],32).toString();
  const owner = decodeAddress(await client('eth_call',[{to:V3.positionManager,data:'0x6352211e'+encodeUint(id)},tag]));
  const max=(1n<<128n)-1n;
  const collectData='0xfc6f7865'+encodeUint(id)+encodeWord(V3.positionManager)+encodeUint(max)+encodeUint(max);
  const simulatedCollect = abiWords(await client('eth_call',[{to:V3.positionManager,from:owner,data:collectData},tag]),2).map(word=>uintFromWord(word).toString());
  await confirmBlock(client,tag,snapshot.block);
  return {snapshot,secondsInside,simulatedCollect};
}
const start=await point(startNumber), end=await point(endNumber);
assert.deepEqual(start.snapshot.position,end.snapshot.position,'Position accounting changed: segment the history before replaying it.');
assert.ok(BigInt(start.snapshot.position.liquidity)>0n,'The position must exist with positive liquidity throughout the period.');
// IncreaseLiquidity, DecreaseLiquidity and Collect index tokenId first. Reject any
// matching manager event: equal endpoint balances alone do not establish continuity.
const eventQueries=[];
const eventProvider=process.env.REPLAY_LOG_RPC || 'https://rpc.mevblocker.io';
const eventClient=createRpcClient({endpoint:eventProvider,serial:true});
for(const point of [start,end])await confirmBlock(eventClient,'0x'+BigInt(point.snapshot.block.number).toString(16),point.snapshot.block);
for(let from=startNumber+1n;from<=endNumber;from+=500n){
  const to=from+499n>endNumber?endNumber:from+499n;
  const filter={address:V3.positionManager,fromBlock:'0x'+from.toString(16),toBlock:'0x'+to.toString(16),topics:[null,'0x'+encodeUint(id)]};
  const response=await fetch(eventProvider,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'eth_getLogs',params:[filter]}),signal:AbortSignal.timeout(15000)});
  assert.ok(response.ok,'The historical event query failed (HTTP '+response.status+').');const reply=await response.json();
  assert.ok(reply.jsonrpc==='2.0'&&reply.id===1&&!reply.error&&Array.isArray(reply.result),'The provider returned an invalid event response.');
  assert.equal(reply.result.length,0,'The NFT was updated during this period. Segment at its events.');
  eventQueries.push({provider:eventProvider,fromBlock:from.toString(),toBlock:to.toString(),matchingEvents:0});
}
for(const point of [start,end]){await confirmBlock(client,'0x'+BigInt(point.snapshot.block.number).toString(16),point.snapshot.block);await confirmBlock(eventClient,'0x'+BigInt(point.snapshot.block.number).toString(16),point.snapshot.block);}
const inside=s=>feeGrowthInside(s.pool.tick,s.position.tickLower,s.position.tickUpper,{global0:BigInt(s.feeGrowth.global0X128),global1:BigInt(s.feeGrowth.global1X128),lower0:BigInt(s.feeGrowth.lower.outside0X128),lower1:BigInt(s.feeGrowth.lower.outside1X128),upper0:BigInt(s.feeGrowth.upper.outside0X128),upper1:BigInt(s.feeGrowth.upper.outside1X128)});
const a=inside(start.snapshot),b=inside(end.snapshot),L=BigInt(start.snapshot.position.liquidity);
const earned=[L*subtractGrowth(b.inside0,a.inside0)/Q128,L*subtractGrowth(b.inside1,a.inside1)/Q128];
const collectDelta=end.simulatedCollect.map((value,i)=>BigInt(value)-BigInt(start.simulatedCollect[i]));
// Different accounting checkpoints can introduce a single base-unit floor difference.
for(let i=0;i<2;i++)assert.ok(collectDelta[i]>=earned[i]&&collectDelta[i]-earned[i]<=1n,'Period fees do not agree with the independent collect difference.');
const duration=end.snapshot.block.timestamp-start.snapshot.block.timestamp;
const seconds=Number((BigInt(end.secondsInside)-BigInt(start.secondsInside)+(1n<<32n))%(1n<<32n));
assert.ok(duration>0&&duration<2**32&&seconds<=duration,'The range-time counter is inconsistent.');
const checkpoints=[start];
console.log('Captured start/end and verified position continuity. Reading '+checkpointCount+' checkpoints…');
for(let i=1;i<checkpointCount-1;i++){
  const number=startNumber+(endNumber-startNumber)*BigInt(i)/BigInt(checkpointCount-1);
  if(number<=BigInt(checkpoints.at(-1).snapshot.block.number)||number===endNumber)continue;
  const checkpoint=await point(number);
  assert.deepEqual(checkpoint.snapshot.position,start.snapshot.position,'An intermediate position checkpoint differs.');
  const current=inside(checkpoint.snapshot);
  const credits=[L*subtractGrowth(current.inside0,a.inside0)/Q128,L*subtractGrowth(current.inside1,a.inside1)/Q128];
  for(let token=0;token<2;token++){
    const delta=BigInt(checkpoint.simulatedCollect[token])-BigInt(start.simulatedCollect[token]);
    assert.ok(delta>=credits[token]&&delta-credits[token]<=1n,'An intermediate fee check differs.');
  }
  checkpoints.push(checkpoint);
  console.log('Captured checkpoint '+(i+1)+' of '+checkpointCount+' at block '+number+'.');
}
checkpoints.push(end);
const result=validatePositionPeriod({version:1,kind:'fixed-position-period',id:'position-'+id,chainId:1,points:checkpoints,eventQueries,validation:{method:'unchanged-nft-and-collect-difference',earnedRaw:earned.map(String),collectDeltaRaw:collectDelta.map(String),roundingDeltaRaw:collectDelta.map((value,i)=>(value-earned[i]).toString()),durationSeconds:duration,secondsInRange:seconds},capturedAt:new Date().toISOString()});
console.log(JSON.stringify({id,fee:start.snapshot.position.fee,blocks:[startNumber.toString(),endNumber.toString()],checkpoints:checkpoints.length,validation:result.validation},null,2));
if(process.argv[5]){await writeFile(process.argv[5],JSON.stringify(result,null,2)+'\n');console.log('Saved '+process.argv[5]);}
