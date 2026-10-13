import { usd } from './format.js';

export function appliedApplication(id, question) {
  if (id === 'fees-over-time') return {
    expected: 'same', context: 'Imagine collecting only the newly earned fee tokens at the question checkpoint. Liquidity, bounds and prices stay unchanged; gas is excluded.',
    question: 'What does that collection itself do to position principal?',
    choices: [['same','Principal stays the same; fee tokens move to the owner.'],['less','Principal shrinks by the value of the collected fees.'],['more','Collected fees automatically increase position liquidity.']],
    hint: 'Collecting fees and removing liquidity are separate operations.',
    feedback: 'Collecting those fee tokens transfers earned assets to the owner. With liquidity unchanged, it does not remove or reinvest the principal.'};
  if (id === 'between-samples') return {
    expected: 'not-proof', context: 'Imagine having just two price samples that are both inside the range, rather than the two outside samples in the recorded question interval.',
    question: 'What do those two observations establish about the interval?',
    choices: [['not-proof','The sampled prices are inside; the intervening path is unknown.'],['whole','The position was active throughout the time between both samples.'],['no-fees','Price stayed stable, so no swap fees accrued between samples.']],
    hint: 'A sampled status describes an instant. Counter differences supply evidence about the time between samples.',
    feedback: 'Two in-range samples cannot establish the entire path. An exit and return could occur between them; elapsed range-time accounting provides separate evidence.'};
  if (id !== 'period-vs-holding') throw new Error('Choose an applied exercise.');
  const costUSD = 1, lpUSD = question.view.lpUSD - costUSD, gapUSD = lpUSD - question.view.holdingUSD;
  return {expected: gapUSD < -.00000001 ? 'hold' : gapUSD > .00000001 ? 'lp' : 'tie', costUSD, lpUSD, gapUSD,
    context: 'Keep the final recorded prices, basket and earned fees. Add a hypothetical ' + usd(costUSD) + ' LP-only cost, with no added holding cost. LP after that cost: ' + usd(lpUSD) + '. Holding: ' + usd(question.view.holdingUSD) + '.',
    question: 'Which has the higher value after this added cost?',
    choices: [['hold','Holding has the higher value.'],['lp','The LP has the higher value.'],['tie','The two values are equal.']],
    hint: 'Read the two values above. Fee income and costs both contribute to the total comparison.',
    feedback: gapUSD < 0 ? 'The LP-only cost exceeds the small before-cost advantage at the final checkpoint. Holding is ahead in this thought experiment; the recorded historical result itself has not changed.'
      : gapUSD > 0 ? 'The LP remains ahead after this hypothetical cost. That is still a comparison over the stated period and assumptions, not a forecast.'
        : 'The hypothetical cost exactly closes the difference. This describes the stated comparison, not a general guarantee.'};
}
export function checkAppliedUnderstanding(question, application, reason, answer) {
  const reasoning = reason === question.reason, applied = answer === application.expected;
  return {reasoning, application: applied, passed: reasoning && applied};
}
