// Editorial content is separate from exercises and completion rules.
const pricing = { title: 'Uniswap v2: how swaps are priced', url: 'https://developers.uniswap.org/docs/protocols/v2/concepts/pricing', detail: 'Mechanics, trade quotes and why reserve prices need context.' };
const pools = { title: 'Uniswap v2: pools and LP ownership', url: 'https://developers.uniswap.org/docs/protocols/v2/concepts/pools', detail: 'How deposits, liquidity tokens and withdrawals fit together.' };
const returns = { title: 'Uniswap v2: understanding returns', url: 'https://docs.uniswap.org/contracts/v2/concepts/advanced-topics/understanding-returns', detail: 'Arbitrage, token balances and the comparison with holding.' };
const fees = { title: 'Uniswap: swap fees and LP fee accounting', url: 'https://developers.uniswap.org/docs/get-started/concepts/fees', detail: 'Fee accrual, active liquidity and protocol-specific fee treatment.' };
const primer = { title: 'Uniswap v3 math: holdings and uncollected fees', url: 'https://blog.uniswap.org/uniswap-v3-math-primer-2', detail: 'A technical walkthrough of real position balances and fee growth.' };
const whitepaper = { title: 'Uniswap v2 whitepaper', url: 'https://app.uniswap.org/whitepaper.pdf', detail: 'Technical reference for the invariant, fees and liquidity tokens.' };

export const DEEPER_READING = {
  'swap-impact': {
    title: 'A spot price is a starting point.',
    paragraphs: [
      'Before a trade, dividing the USDC reserve by the ETH reserve gives the pool’s spot ratio. A finite trade changes both reserves. As more ETH enters and USDC leaves, each additional unit encounters a different marginal price, so average execution falls below the starting spot price.',
      'The quote applies a 0.3% input fee before calculating output. The full ETH input then enters the pool. Our “price impact” isolates the curve movement before the explicit fee; the average execution price includes the fee. Both are measured against the original reserves.',
    ],
    misconception: { title: 'Price impact and slippage are interchangeable.', text: 'Price impact is the effect of your own order on the quoted price. Slippage describes a change between the quote and actual execution. A slippage limit constrains the execution you accept; it does not remove price impact. This exercise quotes fixed reserves and does not simulate a pending real transaction.' },
    math: { introduction: 'Let x be the ETH reserve, y the USDC reserve, and q your ETH input. The effective input for this quote is q × 0.997.', formula: 'q_effective = q × 0.997\nUSDC_out = y × q_effective / (x + q_effective)\naverage_price = USDC_out / q\nimpact_before_fee = q_effective / (x + q_effective) × 100%', note: 'The swap calculation uses integer token units and rounds output down, as the v2 periphery does. Displayed steps are rounded for reading. This is a single-pool quote with no gas, routing or intervening trades.' },
    sources: [pricing, { title: 'Uniswap v2: exact-input swap formula', url: 'https://github.com/Uniswap/v2-periphery/blob/master/contracts/libraries/UniswapV2Library.sol', detail: 'See getAmountOut for the fee adjustment and integer output calculation.' }],
  },
  'pool-share': {
    title: 'Your deposit changes the denominator.',
    paragraphs: [
      'For a proportional deposit, each reserve grows by the same fraction. That keeps their ratio—and therefore the initial pool price—unchanged. Your ownership is measured against the larger pool after the deposit.',
      'Withdrawing immediately, before trading or other changes, gives back the same proportional assets in this simplified example. Later swaps can change the asset quantities and values you receive. Other deposits and withdrawals can change your percentage ownership as well.',
    ],
    misconception: { title: 'An LP token guarantees the original dollar amount.', text: 'An LP token represents a share of pool reserves. Its redeemable token amounts and dollar value depend on the pool’s state when you withdraw. The ownership calculation alone says nothing about future returns.' },
    math: { introduction: 'Let x be the original ETH reserve, y the original USDC reserve, and d your matching ETH deposit.', formula: 'USDC_deposit = d × y / x\nownership = d / (x + d)\nETH_claim = ownership × enlarged_ETH_reserve\nUSDC_claim = ownership × enlarged_USDC_reserve', note: 'The percentage display multiplies ownership by 100. This lesson uses ideal proportional ownership; deployed minting also has minimum-liquidity and integer-rounding rules. It is not an exact LP-token mint quote.' },
    sources: [pools, whitepaper],
  },
  'token-balances': {
    title: 'Arbitrage links the pool to the market.',
    paragraphs: [
      'If ETH becomes more expensive elsewhere, traders can buy relatively cheap ETH from this pool and sell it elsewhere. That removes ETH and adds USDC until the pool ratio approaches the new market price. A falling ETH price reverses the direction.',
      'In our ideal, fee-free endpoint model, the position’s token product stays constant while its USDC-per-ETH ratio follows the supplied price. Solving those two conditions gives the square-root relationship. Equal dollar weights describe the final allocation; they do not fix the token quantities.',
    ],
    misconception: { title: 'A price move automatically earns the LP interest.', text: 'This lesson has no fee income or compounding. Its change in dollar value comes from market prices and rebalancing. Trading fees require actual trading and a separate accounting model.' },
    math: { introduction: 'Let E0 and U0 be the starting ETH and USDC amounts. Let r be the future ETH price divided by the starting price.', formula: 'r = future_price / starting_price\nETH_final = E0 / √r\nUSDC_final = U0 × √r\nETH_final × USDC_final = E0 × U0', note: 'This assumes ideal arbitrage, a fixed position, USDC = $1 and no earned fees. Real trading paths, execution costs and protocol accounting can change the result.' },
    sources: [returns, whitepaper],
  },
  'loss-vs-profit': {
    title: 'Two benchmarks, two different answers.',
    paragraphs: [
      'Dollar profit asks whether the LP is worth more than the starting budget. Impermanent loss asks whether its principal is worth less than holding the exact starting tokens. A rising market can produce a positive dollar return alongside a shortfall against holding.',
      'Keep the starting basket fixed when measuring this gap. Putting the entire budget into ETH is a different investment strategy, not the holding benchmark for a position initially funded with both ETH and USDC.',
    ],
    misconception: { title: '“Impermanent” means the gap is guaranteed to recover.', text: 'In a static, fee-free model, returning to the original price ratio removes the relative gap. That price return is not assured. Withdrawals, rebalances and costs also change what a later recovery would mean for an actual strategy.' },
    math: { introduction: 'V is the original budget, H the value of holding its starting tokens, and P the LP principal before fees.', formula: 'dollar_profit = P − V\ndollar_return = (P / V − 1) × 100%\nIL = (P / H − 1) × 100%\ngap_to_holding = H − P\n\nFor this full-range 50/50 model only:\nIL = (2 × √r / (1 + r) − 1) × 100%', note: 'The universal 50/50 expression does not describe an arbitrary concentrated range. Range comparisons need the range’s own starting token composition and piecewise holdings.' },
    sources: [returns, primer],
  },
  'fee-break-even': {
    title: 'Required income is not expected income.',
    paragraphs: [
      'The gap to holding sets a fee target. It does not tell you the volume a pool will trade, your share of active liquidity, or how long your position will earn. A pool’s swap fee percentage is a charge per trade, not the annual return on an LP deposit.',
      'Our endpoint lab treats your fee assumption as separate USD cash. Deployed protocols account for fees differently: v2 fees accrue through reserves, while v3 tracks claimable fees separately. Protocol fees can also reduce the portion accruing to LPs. A real earnings estimate needs that accounting and trading data.',
    ],
    misconception: { title: 'Entering the break-even amount proves this pool is attractive.', text: 'It only identifies a hurdle under the stated assumptions. Compare a supported earnings estimate with that hurdle, then account for costs and the possibility that market conditions change.' },
    math: { introduction: 'H is holding value, P is LP principal before fees, and F is the assumed total cash fee income.', formula: 'total_fee_target = max(0, H − P)\nadditional_fees_needed = max(0, H − P − F)\n\nIf you separately model strategy costs:\ntarget = max(0, H − P + LP_costs − hold_costs)', note: 'The current exercise excludes costs. The last equation is a cost thought experiment, not an extra input used by this lesson. The total fee target and additional fees needed answer different questions.' },
    sources: [fees, returns],
  },
  'range-boundaries': {
    title: 'The range controls how your tokens convert.',
    paragraphs: [
      'Inside the interval, rising ETH prices gradually exchange the position’s ETH for USDC. At the upper boundary, that principal is all USDC. Falling prices reverse the process until the lower boundary leaves it all ETH. Beyond either boundary, quantities stay fixed until price returns, although the dollar value of held ETH can still change.',
      'Your starting mix follows the starting price and both boundaries. A range centered by equal percentage offsets does not necessarily start with equal dollar weights. Narrowing it concentrates capital but also brings the boundaries closer; the width alone cannot establish fee income or historical time in range.',
    ],
    misconception: { title: 'Out of range now means no fees were earned earlier.', text: 'The position may have been active earlier. The final price describes today’s principal composition; earlier fees require earlier trading and fee-growth information. Recorded tokens owed are not, on their own, a complete measure of lifetime fee income.' },
    math: { introduction: 'Prices are USDC per ETH in human token units. Let a and b be the lower and upper prices, p the current price, and L the position’s liquidity.', formula: 'c = min(b, max(a, p))\nETH(c) = L × (1 / √c − 1 / √b)\nUSDC(c) = L × (√c − √a)\n\nChoose L so that at the starting price:\nETH × starting_price + USDC = budget', note: 'This continuous model omits tick spacing and token-unit rounding. Real v3 positions use allowed ticks, Q96 prices and integer amounts. Token order and decimals matter when translating raw ticks into the displayed price. The snapshot adapter handles those separately.' },
    sources: [{ title: 'Uniswap: concentrated liquidity and active ranges', url: 'https://developers.uniswap.org/docs/get-started/concepts/liquidity-providers/concentrated-liquidity', detail: 'How active liquidity, range boundaries and ticks work.' }, primer],
  },
  'final-challenge': {
    title: 'Build a verdict that names its assumptions.',
    paragraphs: [
      'Start with the same budget and the same starting token basket for both strategies. Value the final LP tokens at the selected price, add the assumed cash fees, and compare that total with holding. Fees alone cannot establish which strategy finishes ahead.',
      'Separate a hypothetical outcome from measured performance. A real position’s current balances do not reveal its entry cost, deposits, withdrawals, collected income or management costs. Reproducing a scenario proves that the inputs produce the stated result; it does not establish what future prices or fees will be.',
    ],
    misconception: { title: 'The scenario winner is automatically the best future choice.', text: 'The verdict depends on the selected price and fee assumptions. Try a falling price and a different fee amount, then explain which assumptions change your conclusion. A single favorable endpoint is not evidence that the strategy will win across other paths.' },
    math: { introduction: 'H is the final value of holding the original tokens, P the LP principal, and F the assumed cash fee income.', formula: 'LP_total = P + F\nLP_minus_holding = P + F − H\nadditional_fee_hurdle = max(0, H − P − F)\n\nWith separately modeled costs:\nnet_difference = P + F − LP_costs − (H − hold_costs)', note: 'The lesson and result card use zero costs and no compounding. Real evaluation also needs a defined period, cash-flow history, market valuation and protocol-specific fee accounting. A snapshot and an endpoint scenario answer narrower questions.' },
    sources: [returns, primer],
  },
};
