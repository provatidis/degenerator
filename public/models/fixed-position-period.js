import { feeGrowthInside, calculatePositionFees } from './v3-fees.js';
import { positionAmounts } from './uniswap-v3.js';

// A passive NFT with unchanged liquidity and accounting throughout the interval.
// Fee tokens remain separate; the holding basket is the start principal alone.
export function calculateFixedPositionPeriod(start, end) {
  if (start.liquidity !== end.liquidity || start.tickLower !== end.tickLower || start.tickUpper !== end.tickUpper) throw new Error('Replay requires unchanged liquidity and bounds.');
  for(const point of [start,end]){
    if(!Number.isSafeInteger(point.timestamp)||point.timestamp<=0||point.timestamp>=2**32||typeof point.secondsInside!=='bigint'||point.secondsInside<0n||point.secondsInside>=1n<<32n)throw new Error('Unsupported period counters.');
  }
  const durationSeconds=end.timestamp-start.timestamp;
  if (!Number.isSafeInteger(durationSeconds) || durationSeconds<0 || durationSeconds>=2**32) throw new Error('Unsupported replay duration.');
  const secondsInRange=Number((end.secondsInside-start.secondsInside+(1n<<32n))%(1n<<32n));
  if (secondsInRange>durationSeconds) throw new Error('Range time exceeds the recorded duration.');
  const inside=feeGrowthInside(start.tick,start.tickLower,start.tickUpper,start.growth);
  const fees=calculatePositionFees({tick:end.tick,tickLower:end.tickLower,tickUpper:end.tickUpper,liquidity:end.liquidity,last0:inside.inside0,last1:inside.inside1,owed0:0n,owed1:0n},end.growth);
  if (fees.overflow) throw new Error('Fee accounting exceeds the supported capacity.');
  return {
    principal:positionAmounts(end.liquidity,end.sqrtPriceX96,end.tickLower,end.tickUpper),
    holding:positionAmounts(start.liquidity,start.sqrtPriceX96,start.tickLower,start.tickUpper),
    earned0:fees.accrued0,earned1:fees.accrued1,durationSeconds,secondsInRange,
  };
}
