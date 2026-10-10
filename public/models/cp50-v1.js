// Model cp50-v1: full-range 50/50 constant-product ETH/USDC, ideal arbitrage.
export const MODEL = 'cp50-v1';
export const DEFAULT_SCENARIO = Object.freeze({ investment: 5000, initialPrice: 2000, futurePrice: 4000, fees: 100 });
export const LIMITS = Object.freeze({
  investment: { min: 1, max: 1e9, label: 'Investment' },
  initialPrice: { min: 0.01, max: 1e7, label: 'Starting ETH price' },
  futurePrice: { min: 0.01, max: 1e7, label: 'Future ETH price' },
  fees: { min: 0, max: 1e9, label: 'Assumed fee income' },
});

export function validateScenario(input) {
  const scenario = {};
  for (const [key, { min, max, label }] of Object.entries(LIMITS)) {
    const value = input?.[key];
    if (!Number.isFinite(value) || value < min || value > max) {
      throw new Error(`${label} must be between $${min.toLocaleString('en-US')} and $${max.toLocaleString('en-US')}.`);
    }
    scenario[key] = value;
  }
  return scenario;
}

export function calculateScenario(input) {
  const scenario = validateScenario(input);
  const { investment, initialPrice, futurePrice, fees } = scenario;
  const ratio = futurePrice / initialPrice;
  const root = Math.sqrt(ratio);
  const held = { eth: investment / (2 * initialPrice), usdc: investment / 2 };
  const pooled = { eth: held.eth / root, usdc: held.usdc * root };
  const holdValue = held.eth * futurePrice + held.usdc;
  const lpBeforeFees = pooled.eth * futurePrice + pooled.usdc;
  const lpValue = lpBeforeFees + fees;
  const difference = lpValue - holdValue;
  return {
    ...scenario, ratio, held, pooled, holdValue, lpBeforeFees, lpValue, difference,
    differencePercent: difference / holdValue * 100,
    impermanentLoss: Math.min(0, (lpBeforeFees / holdValue - 1) * 100),
    breakEvenFees: Math.max(0, holdValue - lpBeforeFees),
    holdReturn: (holdValue / investment - 1) * 100,
    lpReturn: (lpValue / investment - 1) * 100,
  };
}

export function comparisonScenarios(input) {
  const scenario = validateScenario(input);
  const prices = [scenario.initialPrice * 0.5, scenario.initialPrice, scenario.initialPrice * 2, scenario.futurePrice]
    .filter((price) => price >= LIMITS.futurePrice.min && price <= LIMITS.futurePrice.max);
  return [...new Set(prices)].sort((a, b) => a - b)
    .map((futurePrice) => calculateScenario({ ...scenario, futurePrice }));
}

