import { calculateScenario } from './cp50-v1.js';
import { calculateRange } from './cl-range-v1.js';
import { amountOut } from './uniswap-v2.js';

export const LESSON_IDS = Object.freeze(['swap-impact', 'pool-share', 'token-balances', 'loss-vs-profit', 'fee-break-even', 'range-boundaries', 'final-challenge']);
export const VARIANTS = 3;
const bases = [
  { investment: 5000, initialPrice: 2000, futurePrice: 4000, fees: 100, reserveEth: 100, depositEth: 5, amount: 10 },
  { investment: 3000, initialPrice: 1500, futurePrice: 750, fees: 50, reserveEth: 50, depositEth: 10, amount: 5 },
  { investment: 6000, initialPrice: 3000, futurePrice: 4500, fees: 250, reserveEth: 200, depositEth: 20, amount: 20 },
];
export function lessonSetup(id, variant = 0) {
  if (!LESSON_IDS.includes(id) || !Number.isInteger(variant) || variant < 0 || variant >= VARIANTS) throw new Error('Choose a supported lesson and variation.');
  const base = bases[variant];
  return {
    ...base, futurePrice: id === 'range-boundaries' ? base.initialPrice * 1.2 : base.futurePrice,
    fees: ['fee-break-even', 'final-challenge'].includes(id) ? base.fees : 0,
    width: 0.1,
  };
}
export function validateLessonInputs(id, input, variant = 0) {
  const base = lessonSetup(id, variant);
  const bounds = {
    amount: [1, base.reserveEth / 2], depositEth: [1, base.reserveEth / 2],
    futurePrice: [base.initialPrice / 2, base.initialPrice * 2], fees: [0, base.investment / 2],
    width: [0.05, 0.5],
  };
  const editable = id === 'swap-impact' ? ['amount'] : id === 'pool-share' ? ['depositEth']
    : ['fee-break-even', 'final-challenge'].includes(id) ? ['futurePrice', 'fees']
    : id === 'range-boundaries' ? ['futurePrice', 'width'] : ['futurePrice'];
  for (const key of editable) {
    const value = input?.[key];
    if (!Number.isFinite(value) || value < bounds[key][0] || value > bounds[key][1]
      || (['amount', 'depositEth'].includes(key) && !Number.isInteger(value))
      || (key === 'width' && ![0.05, 0.1, 0.5].includes(value))) throw new Error('Use the supported experiment inputs.');
    base[key] = value;
  }
  return base;
}
export function runLesson(id, input, variant = 0) {
  const setup = validateLessonInputs(id, input, variant);
  if (id === 'swap-impact') {
    const reserveUsdc = setup.reserveEth * setup.initialPrice;
    const out = Number(amountOut(BigInt(setup.amount) * 10n ** 18n, BigInt(setup.reserveEth) * 10n ** 18n, BigInt(reserveUsdc) * 10n ** 6n)) / 1e6;
    const smallOut = Number(amountOut(10n ** 18n, BigInt(setup.reserveEth) * 10n ** 18n, BigInt(reserveUsdc) * 10n ** 6n)) / 1e6;
    const impact = setup.amount * 0.997 / (setup.reserveEth + setup.amount * 0.997) * 100;
    return { setup, out, smallOut, impact, afterEth: setup.reserveEth + setup.amount, afterUsdc: reserveUsdc - out,
      prediction: 'less', answer: out, tolerance: 1, unit: 'USDC', reason: 'curve' };
  }
  if (id === 'pool-share') {
    const percent = setup.depositEth / (setup.reserveEth + setup.depositEth) * 100;
    return { setup, share: percent, usdcDeposit: setup.depositEth * setup.initialPrice,
      prediction: 'less', answer: percent, tolerance: 0.02, unit: '%', reason: 'ownership' };
  }
  if (id === 'range-boundaries') {
    const result = calculateRange({ ...setup, lowerPrice: setup.initialPrice * (1 - setup.width), upperPrice: setup.initialPrice * (1 + setup.width), fullRangeFees: 0 });
    return { setup, result, prediction: result.pooled.eth === 0 ? 'usdc' : result.pooled.usdc === 0 ? 'eth' : 'both',
      answer: result.finalEthPercent, tolerance: 0.05, unit: '%', reason: 'path' };
  }
  const result = calculateScenario(setup);
  const gap = Math.max(0, result.breakEvenFees - setup.fees);
  const answers = {
    'token-balances': { prediction: result.pooled.eth < result.held.eth ? 'less' : result.pooled.eth > result.held.eth ? 'more' : 'same', answer: result.pooled.eth, tolerance: 0.001, unit: 'ETH', reason: 'rebalance' },
    'loss-vs-profit': { prediction: result.lpReturn >= 0 ? 'gain' : 'loss', answer: result.breakEvenFees, tolerance: 0.02, unit: 'USD', reason: 'benchmark' },
    'fee-break-even': { prediction: result.difference >= -1e-8 ? 'enough' : 'short', answer: result.breakEvenFees, tolerance: 0.02, unit: 'USD', reason: 'assumption' },
    'final-challenge': { prediction: result.difference >= -1e-8 ? 'lp' : 'hold', answer: gap, tolerance: 0.02, unit: 'USD', reason: 'total' },
  };
  return { setup, result, ...answers[id] };
}
export function checkLesson(id, input, variant, answer, reason) {
  const result = runLesson(id, input, variant);
  const numeric = typeof answer === 'string' && answer.trim() !== '' && Number.isFinite(Number(answer))
    && Math.abs(Number(answer) - result.answer) <= result.tolerance + 1e-10;
  return { numeric, reasoning: reason === result.reason, passed: numeric && reason === result.reason };
}
