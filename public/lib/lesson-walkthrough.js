import { fmt, usd, signedUSD, percent } from './format.js';

// Narrate the already-calculated outcome; never alter exercise inputs or assessment state.
export function lessonWalkthrough(id, outcome) {
  const s = outcome.setup, r = outcome.result;
  if (id === 'swap-impact') return [
    ['Start with the reserves', fmt(s.reserveEth, 0) + ' ETH and ' + fmt(s.reserveEth * s.initialPrice, 0) + ' USDC imply a spot price of ' + usd(s.initialPrice) + ' per ETH.'],
    ['Apply the input fee', fmt(s.amount, 0) + ' ETH × 0.997 = ' + fmt(s.amount * 0.997, 3) + ' effective ETH for the output calculation. The full input is retained in the pool.'],
    ['Quote the trade', 'The reserve formula returns ' + fmt(outcome.out, 2) + ' USDC, rounded down in integer token units before display.'],
    ['Compare execution with spot', fmt(outcome.out, 2) + ' ÷ ' + s.amount + ' = ' + usd(outcome.out / s.amount) + ' per ETH, including the fee. Curve impact before that fee is ' + fmt(outcome.impact, 2) + '%.'],
  ];
  if (id === 'pool-share') return [
    ['Match the pool ratio', fmt(s.depositEth, 0) + ' ETH × ' + usd(s.initialPrice) + ' per ETH requires ' + fmt(outcome.usdcDeposit, 0) + ' USDC.'],
    ['Include the deposit', 'The ETH reserve grows from ' + fmt(s.reserveEth, 0) + ' to ' + fmt(s.reserveEth + s.depositEth, 0) + ' ETH; the USDC reserve grows proportionally.'],
    ['Calculate ownership', s.depositEth + ' ÷ ' + (s.reserveEth + s.depositEth) + ' × 100 = ' + fmt(outcome.share, 2) + '% of the enlarged pool.'],
    ['Check an immediate withdrawal', 'Before other changes, that fraction returns your ' + fmt(s.depositEth, 0) + ' ETH and ' + fmt(outcome.usdcDeposit, 0) + ' USDC. Later reserve changes affect what that share redeems.'],
  ];
  if (id === 'range-boundaries') {
    const state = r.pooled.eth === 0 ? 'At or above the upper boundary, the principal is all USDC.'
      : r.pooled.usdc === 0 ? 'At or below the lower boundary, the principal is all ETH.'
      : 'Within the range, the principal contains both assets.';
    return [
      ['Fund the selected range', usd(s.investment) + ' at ' + usd(s.initialPrice) + '/ETH funds ' + fmt(r.initial.eth, 6) + ' ETH + ' + fmt(r.initial.usdc, 2) + ' USDC. ETH starts at ' + fmt(r.initialEthPercent, 2) + '% of the budget.'],
      ['Locate the future price', usd(s.futurePrice) + ' is compared with the range ' + usd(r.lowerPrice) + '–' + usd(r.upperPrice) + '. ' + state],
      ['Read the final quantities', fmt(r.pooled.eth, 6) + ' ETH + ' + fmt(r.pooled.usdc, 2) + ' USDC, worth ' + usd(r.lpBeforeFees) + ' before fees.'],
      ['Calculate the ETH value share', '(' + fmt(r.pooled.eth, 6) + ' × ' + usd(s.futurePrice) + ') ÷ ' + usd(r.lpBeforeFees) + ' × 100 = ' + fmt(r.finalEthPercent, 2) + '%. Displayed numbers are rounded; the calculation uses the unrounded amounts.'],
    ];
  }
  if (id === 'token-balances') return [
    ['Keep the starting basket visible', usd(s.investment) + ' starts as ' + fmt(r.held.eth, 6) + ' ETH + ' + fmt(r.held.usdc, 2) + ' USDC.'],
    ['Find the price factor', usd(s.futurePrice) + ' ÷ ' + usd(s.initialPrice) + ' = ' + fmt(r.ratio, 3) + '. Its square root is ' + fmt(Math.sqrt(r.ratio), 6) + '.'],
    ['Rebalance the quantities', 'Divide starting ETH by that square root to obtain ' + fmt(r.pooled.eth, 6) + ' ETH. Multiply starting USDC by it to obtain ' + fmt(r.pooled.usdc, 2) + ' USDC.'],
    ['Value the resulting basket', 'At the future price, each side contributes ' + usd(r.lpBeforeFees / 2) + ', for ' + usd(r.lpBeforeFees) + ' in total. Holding keeps the original token quantities.'],
  ];
  if (id === 'loss-vs-profit') return [
    ['Value the original tokens', fmt(r.held.eth, 6) + ' ETH × ' + usd(s.futurePrice) + ' + ' + fmt(r.held.usdc, 2) + ' USDC = ' + usd(r.holdValue) + ' from holding.'],
    ['Measure dollar profit', usd(r.lpBeforeFees) + ' LP principal − ' + usd(s.investment) + ' initial budget = ' + signedUSD(r.lpBeforeFees - s.investment) + ', a ' + percent(r.lpReturn) + ' dollar return.'],
    ['Change the benchmark', 'Holding ' + usd(r.holdValue) + ' − LP principal ' + usd(r.lpBeforeFees) + ' = ' + usd(r.breakEvenFees) + ' behind holding.'],
    ['Express the relative gap', 'LP principal ÷ holding − 1 = ' + percent(r.impermanentLoss) + '. This compares with the original token basket, not with the starting budget.'],
  ];
  if (id === 'fee-break-even') return [
    ['Measure the before-fee hurdle', usd(r.holdValue) + ' holding − ' + usd(r.lpBeforeFees) + ' LP principal = ' + usd(r.breakEvenFees) + ' total fee income needed.'],
    ['Apply the current assumption', usd(r.lpBeforeFees) + ' + ' + usd(s.fees) + ' assumed cash fees = ' + usd(r.lpValue) + ' total LP value.'],
    ['Distinguish total from additional', 'The remaining hurdle is max(0, ' + usd(r.breakEvenFees) + ' − ' + usd(s.fees) + ') = ' + usd(Math.max(0, r.breakEvenFees - s.fees)) + '. The question in this lesson asks for the TOTAL target.'],
    ['Name the missing evidence', 'Nothing in these endpoint inputs measures the volume, active-liquidity share or time path needed to support an earnings estimate.'],
  ];
  if (id === 'final-challenge') return [
    ['Use the same starting tokens', usd(s.investment) + ' buys ' + fmt(r.held.eth, 6) + ' ETH + ' + fmt(r.held.usdc, 2) + ' USDC. Holding those amounts at the selected price is worth ' + usd(r.holdValue) + '.'],
    ['Account for principal and assumed income', usd(r.lpBeforeFees) + ' LP principal + ' + usd(s.fees) + ' assumed fees = ' + usd(r.lpValue) + '.'],
    ['State the verdict', 'LP total − holding = ' + signedUSD(r.difference) + '. ' + (Math.abs(r.difference) < 0.005 ? 'They match at the displayed precision.' : r.difference > 0 ? 'The LP finishes ahead under these assumptions.' : 'Holding finishes ahead under these assumptions.')],
    ['Calculate the additional hurdle', 'max(0, ' + usd(r.holdValue) + ' − ' + usd(r.lpValue) + ') = ' + usd(Math.max(0, -r.difference)) + ' additional assumed fees. This is a target before costs, not a forecast.'],
  ];
  throw new Error('Choose a supported lesson walkthrough.');
}
