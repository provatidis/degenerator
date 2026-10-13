import { calculateRange } from './cl-range-v1.js';

export const MANAGEMENT_IDS = Object.freeze(['range-width', 'fee-tiers', 'range-management']);
export const MANAGEMENT_VARIANTS = 3;
export function managementCase(id, variant = 0) {
  if (!MANAGEMENT_IDS.includes(id) || !Number.isInteger(variant) || variant < 0 || variant >= MANAGEMENT_VARIANTS) throw new Error('Choose a supported range lesson and variation.');
  const initialPrice = 2000;
  const investment = 5000;
  const position = (width, price) => calculateRange({
    investment, initialPrice, futurePrice: price,
    lowerPrice: initialPrice * (1 - width),
    upperPrice: initialPrice * (1 + width),
    fees: 0, fullRangeFees: 0,
  });
  if (id === 'range-width') {
    const price = [2300,1700,2000][variant], narrow = position(.05,price), wide = position(.25,price);
    const active = narrow.state === 'inside' && wide.state === 'inside' ? 'both' : wide.state === 'inside' ? 'wide' : 'none';
    // Separate, supplied fee/cost assumptions for the follow-up, not earned-fee estimates.
    const fees = variant === 1 ? [400, 15] : [5, 20];
    const costs = variant === 1 ? [10, 2] : [20, 5];
    const comparison = variant === 0 ? null : {
      narrow: narrow.lpBeforeFees + fees[0] - costs[0],
      wide: wide.lpBeforeFees + fees[1] - costs[1],
      fees, costs,
    };
    const application = !comparison ? 'unknown' : comparison.narrow > comparison.wide ? 'narrow' : 'wide';
    return {id, variant, price, narrow, wide, comparison, prediction:active, reason:'bounds', application};
  }
  if (id === 'fee-tiers') {
    // Supplied teaching facts, not an earnings estimate or observations from a real pool.
    const rates = variant === 2 ? [.3,.05] : [.05,.3];
    const fees = [null, [12, 4], [12, 4]][variant];
    const principal = variant === 2 ? [5010, 5040] : null;
    const costs = variant === 2 ? [5, 5] : null;
    const totals = principal?.map((value, index) => value + fees[index] - costs[index]);
    const application = variant === 0 ? 'no' : variant === 1
      ? (fees[0] > fees[1] ? 'a' : 'b') : (totals[0] > totals[1] ? 'a' : 'b');
    return {id, variant, rates, fees, principal, costs, totals, prediction:'unknown', reason:'trades', application};
  }
  const prices = [[1600,1400],[2400,2800],[1400,1600]][variant];
  const first=position(.1,prices[0]), second=position(.1,prices[1]), returned=position(.1,initialPrice);
  const difference=second.lpBeforeFees-first.lpBeforeFees;
  return {
    id, variant, prices, first, second, returned,
    prediction: Math.abs(difference) < 1e-8 ? 'same' : difference < 0 ? 'falls' : 'rises',
    reason: 'asset', application: variant === 1 ? 'removed' : 'automatic',
  };
}
export function checkManagementUnderstanding(id, variant, reason, answer) {
  const result=managementCase(id,variant);
  const reasoning=reason===result.reason, application=answer===result.application;
  return {reasoning,application,passed:reasoning&&application};
}
