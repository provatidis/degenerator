import { MODEL, calculateRange } from '../models/cl-range-v1.js';
import { usd, percent } from './format.js';
import { STATE_COPY, rangePriceLabels, assetAmounts } from './range-presentation.js';

export async function rangeCardBlob(input, siteURL) {
  const result = calculateRange(input);
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 900;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Your browser could not create the range card.');
  ctx.fillStyle = '#101714'; ctx.fillRect(0, 0, 1200, 900);
  const text = (content, x, y, size, color = '#edf1e9', weight = 400, maxWidth = 1080) => {
    ctx.fillStyle = color; ctx.font = weight + ' ' + size + 'px system-ui, sans-serif'; ctx.fillText(content, x, y, maxWidth);
  };
  text('Degenerator', 60, 70, 32, '#c5f680', 600);
  text('THE RANGE LAB', 60, 108, 16, '#a2b1a5');
  const state = STATE_COPY[result.state];
  text(state.title + '. ' + state.assets + '.', 60, 180, 44, '#edf1e9', 600);
  const ranges = rangePriceLabels(result.lowerPrice, result.upperPrice);
  text('Your range: ' + ranges.lower + ' – ' + ranges.upper, 60, 224, 22, '#a2b1a5');
  const totals = [
    ['HOLD STARTING MIX', result.holdValue, '#a9c7f5'],
    ['FULL-RANGE 50/50 LP', result.fullRange.lpValue, '#b5a8eb'],
    ['YOUR RANGE LP', result.lpValue, '#c5f680'],
  ];
  totals.forEach(([label, value, color], i) => {
    const x = 60 + i * 368;
    ctx.fillStyle = i === 2 ? '#23321e' : '#1b251d'; ctx.fillRect(x, 265, 344, 135);
    text(label, x + 20, 305, 15, '#a2b1a5', 400, 304);
    text(usd(value), x + 20, 366, 37, color, 500, 304);
  });
  text('Initial investment: $' + result.investment, 60, 450, 23);
  text('ETH: $' + result.initialPrice + ' → $' + result.futurePrice, 60, 490, 23);
  text('Range: $' + result.lowerPrice + ' → $' + result.upperPrice, 60, 530, 23);
  text('Assumed fees: range $' + result.fees + ' / full-range $' + result.fullRangeFees, 60, 570, 23);
  text('Starting range tokens: ' + assetAmounts(result.initial), 60, 610, 23);
  text('Range IL before fees: ' + percent(result.impermanentLoss), 60, 650, 23);
  text('Range fees needed to match holding: ' + usd(result.breakEvenFees), 60, 690, 23);
  text('Holding keeps the range’s starting mix. The full-range LP starts 50/50.', 60, 751, 18, '#a2b1a5');
  text('Continuous model ' + MODEL + ' · USDC = $1 · No tick rounding, gas or compounding', 60, 783, 17, '#a2b1a5');
  text('Hypothetical endpoints and assumed fees · Not a forecast', 60, 815, 17, '#a2b1a5');
  text(siteURL, 60, 866, 17, '#c5f680');
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Your browser could not export the range card.')), 'image/png'));
}
