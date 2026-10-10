export const STATE_COPY = Object.freeze({
  below: { title: 'Below range', assets: 'All ETH', note: 'Your position is all ETH. It stops trading while the price stays below your range.' },
  'lower-edge': { title: 'At the lower edge', assets: 'All ETH', note: 'Your position is all ETH at this boundary. A move upward into the range starts exchanging ETH for USDC.' },
  inside: { title: 'In range', assets: 'ETH + USDC', note: 'Your position holds both tokens. Trading inside the range can earn fees; this lab does not estimate them.' },
  'upper-edge': { title: 'At the upper edge', assets: 'All USDC', note: 'Your position is all USDC at this boundary. A move back inside the range starts exchanging USDC for ETH.' },
  above: { title: 'Above range', assets: 'All USDC', note: 'Your position is all USDC. It stops trading while the price stays above your range.' },
});
export function rangePriceLabels(lower, upper) {
  let digits = 2;
  while (digits < 12 && lower.toFixed(digits) === upper.toFixed(digits)) digits++;
  return { lower: usdWithPrecision(lower, digits), upper: usdWithPrecision(upper, digits) };
}
function usdWithPrecision(value, digits) {
  return '$' + value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: digits });
}
function tokenQuantity(value, digits, minimumDigits = 0) {
  const threshold = 10 ** -digits;
  if (value > 0 && value < threshold) return '<' + threshold.toLocaleString('en-US', { maximumFractionDigits: digits });
  return value.toLocaleString('en-US', { minimumFractionDigits: minimumDigits, maximumFractionDigits: digits });
}
export const assetAmounts = (assets) => tokenQuantity(assets.eth, 6) + ' ETH · ' + tokenQuantity(assets.usdc, 2, 2) + ' USDC';
