import { MODEL, calculateScenario } from '../models/cp50-v1.js';
import { usd, percent } from './format.js';

export async function resultCardBlob(input, siteURL) {
  const result = calculateScenario(input);
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 720;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Your browser could not create the result card.');
  ctx.fillStyle = '#101714'; ctx.fillRect(0, 0, 1200, 720);
  const text = (content, x, y, size, color = '#edf1e9', weight = 400) => {
    ctx.fillStyle = color; ctx.font = weight + ' ' + size + 'px system-ui, sans-serif';
    ctx.fillText(content, x, y, 1080);
  };
  text('Degenerator', 60, 70, 32, '#c1df9b', 600);
  text('YOUR DEFI PLAYGROUND', 60, 108, 16, '#a2b1a5');
  const gap = Math.abs(result.difference);
  text(gap < 0.005 ? 'A draw, under these assumptions.' : result.difference > 0 ? 'Liquidity wins this round.' : 'HODL wins this round.', 60, 182, 46, '#edf1e9', 600);
  ctx.fillStyle = '#1b251d'; ctx.fillRect(60, 220, 510, 150); ctx.fillRect(600, 220, 540, 150);
  text('KEEP THE ORIGINAL TOKENS', 84, 259, 16, '#a2b1a5');
  text(usd(result.holdValue), 84, 325, 45);
  text('LIQUIDITY + ASSUMED FEES', 624, 259, 16, '#a2b1a5');
  text(usd(result.lpValue), 624, 325, 45, '#c1df9b');
  text('Initial investment: ' + usd(result.investment), 60, 416, 23);
  text('ETH: ' + usd(result.initialPrice) + ' → ' + usd(result.futurePrice), 60, 454, 23);
  text('Assumed fee income: ' + usd(result.fees) + ' total cash', 60, 492, 23);
  text('IL before fees: ' + percent(result.impermanentLoss), 60, 530, 23);
  text('Fees needed to match holding: ' + usd(result.breakEvenFees), 60, 568, 23);
  text('Full-range 50/50 ETH/USDC · USDC = $1 · Model ' + MODEL, 60, 625, 18, '#a2b1a5');
  text('Hypothetical outcomes · No gas, incentives or compounding · Not a forecast', 60, 655, 17, '#a2b1a5');
  text(siteURL, 60, 690, 17, '#c1df9b');
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Your browser could not export the result card.')), 'image/png'));
}
