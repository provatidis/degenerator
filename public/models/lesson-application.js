import { runLesson } from './lesson-experiments.js?v=1.15.0';

// Change one assumption. Expected answers come from the same calculations as the lesson.
export function lessonApplication(id, outcome) {
  const s = outcome.setup;
  if (id === 'swap-impact') {
    const amount = s.amount < s.reserveEth / 2 ? Math.min(s.reserveEth / 2, s.amount * 2) : Math.max(1, Math.floor(s.amount / 2));
    const next = runLesson(id, {amount}, outcome.variant);
    return {kind: 'trade-size', amount, next, expected: next.impact > outcome.impact ? 'more' : 'less'};
  }
  if (id === 'pool-share') return {kind: 'another-deposit', depositEth: s.depositEth, expected: 'smaller',
    afterShare: s.depositEth / (s.reserveEth + 2 * s.depositEth) * 100};
  if (id === 'token-balances') {
    const futurePrice = s.initialPrice * (s.futurePrice > s.initialPrice ? .5 : 2);
    const next = runLesson(id, {futurePrice}, outcome.variant);
    return {kind: 'opposite-price', futurePrice, next, expected: next.prediction};
  }
  if (id === 'loss-vs-profit') {
    const futurePrice = s.futurePrice === s.initialPrice ? s.initialPrice / 2 : s.initialPrice;
    const next = runLesson(id, {futurePrice}, outcome.variant);
    return {kind: 'holding-gap', futurePrice, next, expected: next.result.breakEvenFees > 1e-8 ? 'trails' : 'matches'};
  }
  if (id === 'fee-break-even') {
    const fees = s.fees === 0 ? Math.min(100, s.investment / 2) : 0;
    const next = runLesson(id, {futurePrice: s.futurePrice, fees}, outcome.variant);
    return {kind: 'fee-assumption', fees, next, expected: 'same'};
  }
  if (id === 'range-boundaries') {
    const futurePrice = s.initialPrice * (outcome.prediction === 'usdc' ? 1 - s.width : 1 + s.width);
    const next = runLesson(id, {futurePrice, width: s.width}, outcome.variant);
    return {kind: 'other-boundary', futurePrice, next, expected: next.prediction};
  }
  if (id === 'final-challenge') return {kind: 'other-benchmark', expected: 'different'};
  throw new Error('Choose a supported application exercise.');
}
export function checkLessonUnderstanding(id, input, variant, reason, answer) {
  const outcome = {...runLesson(id, input, variant), variant};
  const application = lessonApplication(id, outcome);
  const reasoning = reason === outcome.reason, applied = answer === application.expected;
  return {reasoning, application: applied, passed: reasoning && applied};
}
