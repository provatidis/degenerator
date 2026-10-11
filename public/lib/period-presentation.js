import { periodModelPoint } from '../data/position-period.js';
import { calculateFixedPositionPeriod } from '../models/fixed-position-period.js';
import { usdPerETH, positionRange } from '../models/uniswap-v3.js';

export function periodPointView(period,index) {
  if(!Number.isInteger(index)||index<0||index>=period.points.length)throw new Error('Choose a recorded checkpoint.');
  const point=period.points[index],s=point.snapshot;
  const result=calculateFixedPositionPeriod(periodModelPoint(period.points[0]),periodModelPoint(point));
  const price=usdPerETH(BigInt(s.pool.sqrtPriceX96));
  const value=(zero,one)=>Number(zero)/1e6+Number(one)/1e18*price;
  const principalUSD=value(result.principal.amount0,result.principal.amount1);
  const feesUSD=value(result.earned0,result.earned1),holdingUSD=value(result.holding.amount0,result.holding.amount1);
  return {...result,point,price,range:positionRange(s.position.tickLower,s.position.tickUpper),principalUSD,feesUSD,holdingUSD,lpUSD:principalUSD+feesUSD,gapUSD:principalUSD+feesUSD-holdingUSD};
}
