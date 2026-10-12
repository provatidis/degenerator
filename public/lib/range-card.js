import { MODEL, calculateRange } from '../models/cl-range-v1.js';
import { usd, percent } from './format.js';
import { STATE_COPY, rangePriceLabels, assetAmounts } from './range-presentation.js';
import { drawBrand } from './brand.js';

export async function rangeCardBlob(input, siteURL) {
  const result = calculateRange(input);
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 900;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Your browser could not create the range card.');
  ctx.fillStyle = '#172c24'; ctx.fillRect(0, 0, 1200, 900);
  const text = (content, x, y, size, color = '#f4f3ed', weight = 400, maxWidth = 1080) => {
    ctx.fillStyle = color; ctx.font = weight + ' ' + size + 'px system-ui, sans-serif'; ctx.fillText(content, x, y, maxWidth);
  };
  await drawBrand(ctx, 60, 28);
  text('THE RANGE LAB', 60, 108, 16, '#b0bdb3');
  const state = STATE_COPY[result.state];
  text(state.title + '. ' + state.assets + '.', 60, 180, 44, '#f4f3ed', 600);
  const ranges = rangePriceLabels(result.lowerPrice, result.upperPrice);
  text('Your range: ' + ranges.lower + ' – ' + ranges.upper, 60, 224, 22, '#b0bdb3');
  const totals = [
    ['HOLD STARTING MIX', result.holdValue, '#a9c7f5'],
    ['FULL-RANGE 50/50 LP', result.fullRange.lpValue, '#b5a8eb'],
    ['YOUR RANGE LP', result.lpValue, '#b8cdb9'],
  ];
  totals.forEach(([label, value, color], i) => {
    const x = 60 + i * 368;
    ctx.fillStyle = i === 2 ? '#2a4437' : '#1d342b'; ctx.fillRect(x, 265, 344, 135);
    text(label, x + 20, 305, 15, '#b0bdb3', 400, 304);
    text(usd(value), x + 20, 366, 37, color, 500, 304);
  });
  text('Initial investment: $' + result.investment, 60, 450, 23);
  text('ETH: $' + result.initialPrice + ' → $' + result.futurePrice, 60, 490, 23);
  text('Range: $' + result.lowerPrice + ' → $' + result.upperPrice, 60, 530, 23);
  text('Assumed fees: range $' + result.fees + ' / full-range $' + result.fullRangeFees, 60, 570, 23);
  text('Starting range tokens: ' + assetAmounts(result.initial), 60, 610, 23);
  text('Range IL before fees: ' + percent(result.impermanentLoss), 60, 650, 23);
  text('Range fees needed to match holding: ' + usd(result.breakEvenFees), 60, 690, 23);
  text('Holding keeps the range’s starting mix. The full-range LP starts 50/50.', 60, 751, 18, '#b0bdb3');
  text('Continuous model ' + MODEL + ' · USDC = $1 · No tick rounding, gas or compounding', 60, 783, 17, '#b0bdb3');
  text('Hypothetical endpoints and assumed fees · Not a forecast', 60, 815, 17, '#b0bdb3');
  text(siteURL, 60, 866, 17, '#b8cdb9');
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Your browser could not export the range card.')), 'image/png'));
}
