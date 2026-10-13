import { lessonApplication } from '../models/lesson-application.js?v=1.13.0';
import { usd, fmt } from './format.js';

export function lessonApplicationCopy(id, outcome) {
  const application = lessonApplication(id, outcome), s = outcome.setup;
  const base = {application, expected: application.expected};
  if (id === 'swap-impact') return {...base,
    context: 'Same starting reserves and fee. Change only the trade from ' + s.amount + ' ETH to ' + application.amount + ' ETH.',
    question: 'What happens to price impact?', choices: [['more','It increases.'],['less','It decreases.'],['same','It stays the same.']],
    hint: 'Compare trade size with the same finite reserves. You do not need to calculate the output.',
    feedback: 'Against the same starting reserves, a larger trade moves the price more; a smaller trade moves it less. The fee rate stays unchanged.'};
  if (id === 'pool-share') return {...base,
    context: 'After your deposit, another person adds a matching ' + application.depositEth + ' ETH deposit and its USDC counterpart. No trades or withdrawals occur.',
    question: 'What happens to your percentage ownership?', choices: [['smaller','It becomes smaller.'],['same','It stays the same.'],['larger','It becomes larger.']],
    hint: 'Your LP-token balance stays fixed, while the new deposit enlarges the pool and total LP-token supply.',
    feedback: 'The matching deposit gives the new provider LP tokens. Your percentage of the enlarged pool decreases; your immediate claim on token amounts stays the same in this ideal proportional model.'};
  if (id === 'token-balances') return {...base,
    context: 'Start again with the same basket at ' + usd(s.initialPrice) + '/ETH. Change only the final price to ' + usd(application.futurePrice) + '/ETH.',
    question: 'Compared with the starting basket, how much ETH does the LP hold?',
    choices: [['more','More ETH than at the start.'],['less','Less ETH than at the start.'],['same','The same ETH as at the start.']],
    hint: 'Use the starting price as the reference, rather than the outcome of the previous experiment.',
    feedback: application.expected === 'more' ? 'The final price is below this experiment’s starting price. Traders add ETH and remove USDC, leaving the LP with more ETH than it started with.'
      : 'The final price is above this experiment’s starting price. Traders add USDC and remove ETH, leaving the LP with less ETH than it started with.'};
  if (id === 'loss-vs-profit') return {...base,
    context: 'Same starting basket at ' + usd(s.initialPrice) + '/ETH and zero fees. Change only the final price to ' + usd(application.futurePrice) + '/ETH.',
    question: 'How does LP principal compare with holding the starting tokens?',
    choices: [['trails','The LP trails holding.'],['matches','The LP matches holding.'],['beats','The LP beats holding.']],
    hint: 'In this fee-free endpoint model, an unchanged price leaves both starting baskets unchanged. A changed price creates a gap to holding.',
    feedback: application.expected === 'matches' ? 'At the original price, this fee-free endpoint model has no gap to holding. That does not guarantee that a real market will return to its original price.'
      : 'A falling price can reduce both strategies’ dollar values while the LP still trails holding. Dollar loss and the gap to holding are different comparisons.'};
  if (id === 'fee-break-even') return {...base,
    context: 'Keep both prices and the starting basket. Change only assumed fee income from ' + usd(s.fees) + ' to ' + usd(application.fees) + '.',
    question: 'Does the TOTAL fee target needed to match holding change?',
    choices: [['same','The total target stays the same.'],['higher','The total target becomes higher.'],['lower','The total target becomes lower.']],
    hint: 'Separate the before-fee gap from the additional fees still needed after your assumption.',
    feedback: 'The total target comes from holding minus LP principal before fees. Changing assumed fee income changes total LP value and the remaining additional hurdle, while the total target stays the same.'};
  if (id === 'range-boundaries') return {...base,
    context: 'Same funded range, ' + usd(outcome.result.lowerPrice) + '–' + usd(outcome.result.upperPrice) + '. Change only the final price to the ' + (application.expected === 'eth' ? 'lower' : 'upper') + ' boundary, ' + usd(application.futurePrice) + '.',
    question: 'Which token does the position’s principal hold at this boundary?',
    choices: [['eth','Only ETH.'],['both','ETH and USDC.'],['usdc','Only USDC.']],
    hint: 'A lower ETH price exchanges USDC for ETH. A higher ETH price exchanges ETH for USDC.',
    feedback: application.expected === 'eth' ? 'At the lower boundary, principal is all ETH. This identifies token composition; it does not reconstruct historical earnings.'
      : 'At the upper boundary, principal is all USDC. This identifies token composition; it does not reconstruct historical earnings.'};
  return {...base,
    context: 'Someone changes the benchmark to investing the entire ' + usd(s.investment) + ' starting budget in ETH, instead of holding the original ETH and USDC basket.',
    question: 'Can that new gap be called impermanent loss for this setup?',
    choices: [['different','No. It compares with a different starting strategy.'],['same','Yes. Any holding strategy defines this LP’s impermanent loss.'],['rally','Yes, whenever ETH rises above its starting price.']],
    hint: 'The LP began with ' + fmt(outcome.result.held.eth, 4) + ' ETH and ' + fmt(outcome.result.held.usdc, 2) + ' USDC. Its holding benchmark keeps that basket.',
    feedback: 'An all-ETH investment has a different starting allocation. You can compare strategies, but this LP’s impermanent-loss benchmark holds its exact original ETH and USDC amounts.'};
}
