// Exact Uniswap v2 periphery arithmetic. All amounts are integer token base units.
const MAX_UINT256 = (1n << 256n) - 1n;
export function amountOut(amountIn, reserveIn, reserveOut) {
  if (![amountIn, reserveIn, reserveOut].every((value) => typeof value === 'bigint' && value > 0n && value <= MAX_UINT256)) {
    throw new Error('Swap amounts and reserves must be positive uint256 integers.');
  }
  const withFee = amountIn * 997n;
  const numerator = withFee * reserveOut;
  const denominator = reserveIn * 1000n + withFee;
  if ([withFee, numerator, denominator].some((value) => value > MAX_UINT256)) throw new Error('Swap arithmetic exceeds uint256.');
  return numerator / denominator;
}

export { formatUnits } from './units.js';
