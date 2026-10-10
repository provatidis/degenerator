import { Q96, sqrtRatioAtTick, tickAtSqrtRatio } from './tick-math.js';

export function positionAmounts(liquidity, sqrtPriceX96, tickLower, tickUpper) {
  if (typeof liquidity !== 'bigint' || liquidity < 0n || liquidity >= 1n << 128n) throw new Error('Unsupported v3 liquidity.');
  tickAtSqrtRatio(sqrtPriceX96);
  const lower = sqrtRatioAtTick(tickLower), upper = sqrtRatioAtTick(tickUpper);
  if (lower >= upper) throw new Error('The position ticks must be ordered.');
  return amountsForLiquidity(liquidity, sqrtPriceX96, lower, upper);
}
export function amountsForLiquidity(liquidity, sqrtPriceX96, lower, upper) {
  if (![liquidity, sqrtPriceX96, lower, upper].every(value => typeof value === 'bigint')
    || liquidity < 0n || liquidity >= 1n << 128n || lower <= 0n || lower >= upper || upper >= 1n << 160n || sqrtPriceX96 <= 0n || sqrtPriceX96 >= 1n << 160n) throw new Error('Unsupported v3 liquidity or price bounds.');
  const current = sqrtPriceX96 < lower ? lower : sqrtPriceX96 > upper ? upper : sqrtPriceX96;
  return {
    amount0: liquidity * Q96 * (upper - current) / (current * upper),
    amount1: liquidity * (current - lower) / Q96,
  };
}
// Supported order: token0=USDC (6 decimals), token1=WETH (18).
// Raw tick prices are token1/token0, so USD/WETH reverses the order.
export function usdPerETH(sqrtPriceX96) {
  if (typeof sqrtPriceX96 !== 'bigint' || sqrtPriceX96 <= 0n) throw new Error('Unsupported square-root price.');
  return Number(Q96 * Q96 * 10n ** 12n) / Number(sqrtPriceX96 * sqrtPriceX96);
}
export function positionRange(tickLower, tickUpper) {
  if (tickLower >= tickUpper) throw new Error('The position ticks must be ordered.');
  return { lowerPrice: usdPerETH(sqrtRatioAtTick(tickUpper)), upperPrice: usdPerETH(sqrtRatioAtTick(tickLower)) };
}
