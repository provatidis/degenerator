import { MODEL, calculateScenario } from '../models/cp50-v1.js';
import { usd, percent } from './format.js';
import { drawBrand } from './brand.js';

export async function resultCardBlob(input, siteURL) {
  const result = calculateScenario(input);
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 720;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Your browser could not create the result card.');
  ctx.fillStyle = '#111916'; ctx.fillRect(0, 0, 1200, 720);
  const text = (content, x, y, size, color = '#f4f3ed', weight = 400) => {
    ctx.fillStyle = color; ctx.font = weight + ' ' + size + 'px system-ui, sans-serif';
    ctx.fillText(content, x, y, 1080);
  };
  await drawBrand(ctx, 60, 28);
  text('SEE FOR YOURSELF', 60, 108, 16, '#bcc7bf');
  const gap = Math.abs(result.difference);
  text(gap < 0.005 ? 'Values differ by less than $0.01' : result.difference > 0 ? 'LP value is higher than holding' : 'Holding value is higher than LP', 60, 182, 46, '#f4f3ed', 600);
  ctx.fillStyle = '#26362f'; ctx.fillRect(60, 220, 510, 150); ctx.fillRect(600, 220, 540, 150);
  text('KEEP THE ORIGINAL TOKENS', 84, 259, 16, '#bcc7bf');
  text(usd(result.holdValue), 84, 325, 45);
  text('LIQUIDITY + ASSUMED FEES', 624, 259, 16, '#bcc7bf');
  text(usd(result.lpValue), 624, 325, 45, '#b8cdb9');
  text('Initial investment: ' + usd(result.investment), 60, 416, 23);
  text('ETH: ' + usd(result.initialPrice) + ' → ' + usd(result.futurePrice), 60, 454, 23);
  text('Assumed fee income: ' + usd(result.fees) + ' total cash', 60, 492, 23);
  text('IL before fees: ' + percent(result.impermanentLoss), 60, 530, 23);
  text('Fees needed to match holding: ' + usd(result.breakEvenFees), 60, 568, 23);
  text('Full-range 50/50 ETH/USDC · USDC = $1 · Model ' + MODEL, 60, 625, 18, '#bcc7bf');
  text('Hypothetical outcomes · No gas, incentives or compounding · Not a forecast', 60, 655, 17, '#bcc7bf');
  text(siteURL, 60, 690, 17, '#b8cdb9');
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Your browser could not export the result card.')), 'image/png'));
}
