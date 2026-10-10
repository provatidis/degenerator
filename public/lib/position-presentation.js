import { usd, formatTokenQuantity } from './format.js';
import { rangePriceLabels } from './range-presentation.js';

export const POSITION_STATES = Object.freeze({
  inside: { title: 'In range', note: 'The contract tick is inside this position’s range at the recorded block.' },
  below: { title: 'Below range', note: 'At this recorded price, the active position holds WETH only.' },
  above: { title: 'Above range', note: 'At this recorded price, the active position holds USDC only.' },
  inactive: { title: 'No active liquidity', note: 'The NFT exists, but its active liquidity is zero. Recorded tokens owed are shown under the snapshot details.' },
});
export const positionPrice = value => value < 0.01 || value > 1e9 ? '$' + value.toPrecision(6) : usd(value);
export function positionPriceLabels(lower, upper) {
  return lower < 0.01 || upper > 1e9
    ? { lower: '$' + lower.toPrecision(6), upper: '$' + upper.toPrecision(6) }
    : rangePriceLabels(lower, upper);
}
export const positionTokenAmount = (value, token) => formatTokenQuantity(value, token === 'WETH' ? 6 : 2, token === 'WETH' ? 0 : 2) + ' ' + token;
