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
  const state = s.pool.tick < s.position.tickLower ? 'above' : s.pool.tick >= s.position.tickUpper ? 'below' : 'inside';
  return {...result,point,price,state,range:positionRange(s.position.tickLower,s.position.tickUpper),principalUSD,feesUSD,holdingUSD,lpUSD:principalUSD+feesUSD,gapUSD:principalUSD+feesUSD-holdingUSD,principalGapUSD:principalUSD-holdingUSD,secondsOutOfRange:result.durationSeconds-result.secondsInRange};
}

// Differences of cumulative credits carry integer rounding across checkpoints.
// Summing separately floored interval credits would understate the period total.
export function periodIntervalView(period, index) {
  const current = periodPointView(period, index);
  const previous = periodPointView(period, Math.max(0, index - 1));
  const durationSeconds = current.durationSeconds - previous.durationSeconds;
  const secondsInRange = current.secondsInRange - previous.secondsInRange;
  const earned0 = current.earned0 - previous.earned0, earned1 = current.earned1 - previous.earned1;
  return { start: previous.point.snapshot.block, end: current.point.snapshot.block, startState: previous.state, durationSeconds, secondsInRange,
    secondsOutOfRange: durationSeconds - secondsInRange, earned0, earned1,
    feesUSD: Number(earned0) / 1e6 + Number(earned1) / 1e18 * current.price };
}

export function periodMilestones(period) {
  const states = period.points.map((_, index) => periodPointView(period, index).state);
  const milestones = [{ index: 0, label: 'Start' }];
  const outside = states.findIndex((state, index) => index > 0 && state !== 'inside' && states[index - 1] === 'inside');
  if (outside >= 0) {
    milestones.push({ index: outside, label: 'Outside sample' });
    const hiddenActivity = states.findIndex((state, index) => index > outside && state !== 'inside' && states[index - 1] !== 'inside' && periodIntervalView(period, index).secondsInRange > 0);
    if (hiddenActivity >= 0) milestones.push({ index: hiddenActivity, label: 'Between samples' });
    const returned = states.findIndex((state, index) => index > outside && state === 'inside');
    if (returned >= 0) milestones.push({ index: returned, label: 'Return sample' });
  }
  const end = period.points.length - 1;
  if (!milestones.some(item => item.index === end)) milestones.push({ index: end, label: 'End' });
  return milestones.sort((a, b) => a.index - b.index);
}

export function periodChartRange(period) {
  const views = period.points.map((_, index) => periodPointView(period, index));
  const min = Math.min(...views.map(view => view.price)), max = Math.max(...views.map(view => view.price));
  const midpoint = (min + max) / 2, distance = Math.max(max - min, midpoint * .02);
  const { lowerPrice, upperPrice } = views[0].range;
  const bounds = [lowerPrice, upperPrice].filter(price => price >= min - distance && price <= max + distance);
  const low = Math.min(min, ...bounds), high = Math.max(max, ...bounds);
  const padding = Math.max((high - low) * .18, midpoint * .002);
  return { views, bottom: low - padding, top: high + padding,
    lowerVisible: bounds.includes(lowerPrice), upperVisible: bounds.includes(upperPrice) };
}

export function periodDuration(seconds) {
  const hours = Math.floor(seconds / 3600), minutes = Math.floor(seconds % 3600 / 60), remainder = seconds % 60;
  return [hours && hours + 'h', minutes && minutes + 'm', (remainder || !seconds) && remainder + 's'].filter(Boolean).join(' ');
}
