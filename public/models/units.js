export function formatUnits(raw, decimals) {
  if (typeof raw !== 'bigint' || raw < 0n || !Number.isInteger(decimals) || decimals < 0 || decimals > 36) {
    throw new Error('Invalid token amount or decimals.');
  }
  const padded = raw.toString().padStart(decimals + 1, '0');
  if (!decimals) return padded;
  return padded.slice(0, -decimals) + '.' + padded.slice(-decimals);
}
