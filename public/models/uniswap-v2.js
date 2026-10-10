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

export function formatUnits(raw, decimals) {
  if (typeof raw !== 'bigint' || raw < 0n || !Number.isInteger(decimals) || decimals < 0 || decimals > 36) {
    throw new Error('Invalid token amount or decimals.');
  }
  const padded = raw.toString().padStart(decimals + 1, '0');
  if (!decimals) return padded;
  return padded.slice(0, -decimals) + '.' + padded.slice(-decimals);
}
