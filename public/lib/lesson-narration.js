import { fmt, usd, signedUSD } from './format.js';

export function tokenBalanceNarration(outcome) {
  const { setup: s, result: r } = outcome;
  const direction = s.futurePrice > s.initialPrice ? 'up' : s.futurePrice < s.initialPrice ? 'down' : 'same';
  const exchange = direction === 'up'
    ? 'Traders put USDC into the pool and take ETH out. The LP holds less ETH and more USDC.'
    : direction === 'down'
      ? 'Traders put ETH into the pool and take USDC out. The LP holds more ETH and less USDC.'
      : 'The price is unchanged. In this fee-free endpoint model, both token quantities stay the same.';
  const correctReason = direction === 'up' ? 'Arbitrage traders exchange USDC for ETH, leaving the LP with less ETH and more USDC.'
    : direction === 'down' ? 'Arbitrage traders exchange ETH for USDC, leaving the LP with more ETH and less USDC.'
      : 'There is no price change to rebalance against in this fee-free endpoint model.';
  return { direction, exchange, correctReason,
    reasoning: direction === 'same' ? 'Why do the token quantities stay the same in this setup?' : 'What explains the change in token quantities?',
    explanation: 'ETH moves from ' + usd(s.initialPrice) + ' to ' + usd(s.futurePrice) + '. ' + exchange + ' The LP starts with ' + fmt(r.held.eth, 6) + ' ETH and ' + fmt(r.held.usdc, 2) + ' USDC, and ends with ' + fmt(r.pooled.eth, 6) + ' ETH and ' + fmt(r.pooled.usdc, 2) + ' USDC. Tokens move through swaps; neither ETH nor USDC is created by the pool.' };
}

export function lessonReasonFeedback(id, outcome, reason) {
  if (id === 'token-balances') {
    const copy = tokenBalanceNarration(outcome);
    if (reason === 'mint') return 'The pool does not create ETH or USDC. ' + copy.exchange;
    if (reason === 'interest') return 'This model includes no interest, earned fees or compounding. ' + copy.exchange;
  }
  if (id === 'range-boundaries' && reason === 'zero') return outcome.prediction === 'both'
    ? 'This endpoint is inside the range, but that does not establish earlier earnings. Past fees require historical fee accounting, separate from the final token mix.'
    : 'This endpoint is at or outside a range boundary. That does not prove it was inactive earlier. Past fees require historical fee accounting, separate from the final token mix.';
  const feedback = {
    'swap-impact': {
      fixed: 'A finite swap changes the reserves, so it cannot receive the starting spot price for every ETH. The 0.3% input fee also reduces the quoted output.',
      forecast: 'This is a quote against the specified reserves, not a market forecast. Your own trade changes the pool ratio.',
    },
    'pool-share': {
      dollars: 'LP ownership is a fraction of the changing reserves. It does not guarantee your original dollar deposit or a yield.',
      eth: 'A proportional deposit buys a share of both reserves. Your claim is not limited to the ETH you deposited.',
    },
    'loss-vs-profit': {
      entry: 'Comparing with the original budget measures dollar profit or loss. Impermanent loss compares LP principal with holding the exact starting tokens.',
      'all-eth': 'An all-ETH investment has a different starting basket. The holding benchmark keeps both original ETH and USDC amounts.',
    },
    'fee-break-even': {
      guarantee: 'The required fee amount is a target. These price inputs do not establish the trading or liquidity history needed to earn it.',
      compound: 'These assumed fees are separate USD cash added at the end. They are not reinvested into the principal.',
    },
    'range-boundaries': {
      fixed: 'Range width alone does not determine fee income. Earnings also depend on trades, competing active liquidity and the path through the range.',
    },
    'final-challenge': {
      fees: 'Fee income may still be smaller than the principal shortfall against holding. Compare the total values using the same starting tokens.',
      forecast: 'This outcome follows your price and fee assumptions. Reproducing the calculation does not prove those assumptions will occur.',
    },
  };
  return feedback[id]?.[reason] || 'Choose an explanation for this setup. The result and hint explain the comparison.';
}

export function benchmarkNarration(id, outcome) {
  const { setup: s, result: r } = outcome;
  if (id === 'loss-vs-profit') return 'At ' + usd(s.futurePrice) + '/ETH, LP principal is ' + usd(r.lpBeforeFees) + ', a ' + signedUSD(r.lpBeforeFees - s.investment) + ' change from the starting budget. Holding the same starting tokens is worth ' + usd(r.holdValue) + '. The LP’s before-fee shortfall against holding is ' + usd(r.breakEvenFees) + '. Dollar profit and this relative shortfall use different benchmarks.';
  if (id === 'fee-break-even') return 'The total fee target is ' + usd(r.breakEvenFees) + '. Your current assumption is ' + usd(s.fees) + ', leaving ' + usd(Math.max(0, r.breakEvenFees - s.fees)) + ' additional fees needed. The total target and remaining hurdle are different quantities. These endpoint inputs do not estimate how much the position will earn.';
  if (id === 'final-challenge') return 'LP principal ' + usd(r.lpBeforeFees) + ' plus ' + usd(s.fees) + ' assumed fees gives ' + usd(r.lpValue) + ', compared with ' + usd(r.holdValue) + ' from holding the same starting tokens. LP minus holding is ' + signedUSD(r.difference) + '. This is conditional on the supplied prices and cash-fee assumption; gas, incentives and the trading path are excluded.';
  return null;
}
