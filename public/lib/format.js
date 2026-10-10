export const fmt = (value, digits = 2) => value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
export const usd = (value) => '$' + fmt(value);
export const signedUSD = (value) => (value < -0.005 ? '−' : value > 0.005 ? '+' : '') + usd(Math.abs(value));
export const percent = (value) => (value < -0.005 ? '−' : value > 0.005 ? '+' : '') + fmt(Math.abs(value)) + '%';
export const compactUSD = (value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(value);

export function formatTokenQuantity(value, digits, minimumDigits = 0) {
  const threshold = 10 ** -digits;
  if (value > 0 && value < threshold) return '<' + threshold.toLocaleString('en-US', { maximumFractionDigits: digits });
  return value.toLocaleString('en-US', { minimumFractionDigits: minimumDigits, maximumFractionDigits: digits });
}
