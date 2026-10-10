import { calculateScenario as calculateFullRange } from './cp50-v1.js';

// Continuous human-unit ETH/USDC model; price is USDC per ETH, with USDC = $1.
// This does not apply protocol tick spacing, token-unit rounding, or estimate earned fees.
export const MODEL = 'cl-range-v1';
export const DEFAULT_RANGE = Object.freeze({
  investment: 5000, initialPrice: 2000, futurePrice: 2100,
  lowerPrice: 1800, upperPrice: 2200, fees: 0, fullRangeFees: 0,
});
export const LIMITS = Object.freeze({
  investment: { min: 1, max: 1e9, label: 'Investment' },
  initialPrice: { min: 0.01, max: 1e7, label: 'Starting ETH price' },
  futurePrice: { min: 0.01, max: 1e7, label: 'Future ETH price' },
  lowerPrice: { min: 0.01, max: 1e7, label: 'Lower range price' },
  upperPrice: { min: 0.01, max: 1e7, label: 'Upper range price' },
  fees: { min: 0, max: 1e9, label: 'Assumed range fee income' },
  fullRangeFees: { min: 0, max: 1e9, label: 'Assumed full-range fee income' },
});

export function validateRange(input) {
  const scenario = {};
  for (const [key, { min, max, label }] of Object.entries(LIMITS)) {
    const value = input?.[key];
    if (!Number.isFinite(value) || value < min || value > max) {
      throw new Error(label + ' must be between $' + min.toLocaleString('en-US') + ' and $' + max.toLocaleString('en-US') + '.');
    }
    scenario[key] = value;
  }
  if (scenario.lowerPrice >= scenario.upperPrice) throw new Error('Your upper price must be higher than your lower price.');
  return scenario;
}

export function rangeState(price, lowerPrice, upperPrice) {
  if (price < lowerPrice) return 'below';
  if (price === lowerPrice) return 'lower-edge';
  if (price > upperPrice) return 'above';
  if (price === upperPrice) return 'upper-edge';
  return 'inside';
}

// Rationalized square-root differences avoid cancellation for very narrow ranges.
export function concentratedAmounts(liquidity, price, lowerPrice, upperPrice) {
  if (![liquidity, price, lowerPrice, upperPrice].every((value) => Number.isFinite(value) && value > 0)
    || lowerPrice >= upperPrice) throw new Error('Liquidity and ordered range prices must be positive finite numbers.');
  const clamped = Math.max(lowerPrice, Math.min(upperPrice, price));
  const sqrtPrice = Math.sqrt(clamped);
  const sqrtUpper = Math.sqrt(upperPrice);
  const sqrtLower = Math.sqrt(lowerPrice);
  return {
    eth: liquidity * ((upperPrice - clamped) / (sqrtUpper + sqrtPrice)) / (sqrtPrice * sqrtUpper),
    usdc: liquidity * ((clamped - lowerPrice) / (sqrtPrice + sqrtLower)),
  };
}

export function calculateRange(input) {
  const scenario = validateRange(input);
  const { investment, initialPrice, futurePrice, lowerPrice, upperPrice, fees, fullRangeFees } = scenario;
  const perUnit = concentratedAmounts(1, initialPrice, lowerPrice, upperPrice);
  const unitCost = perUnit.eth * initialPrice + perUnit.usdc;
  const liquidity = investment / unitCost;
  const initial = concentratedAmounts(liquidity, initialPrice, lowerPrice, upperPrice);
  const pooled = concentratedAmounts(liquidity, futurePrice, lowerPrice, upperPrice);
  const holdValue = initial.eth * futurePrice + initial.usdc;
  const lpBeforeFees = pooled.eth * futurePrice + pooled.usdc;
  const lpValue = lpBeforeFees + fees;
  const fullRange = calculateFullRange({ investment, initialPrice, futurePrice, fees: fullRangeFees });
  return {
    ...scenario, liquidity, initial, pooled, holdValue, lpBeforeFees, lpValue, fullRange,
    initialState: rangeState(initialPrice, lowerPrice, upperPrice),
    state: rangeState(futurePrice, lowerPrice, upperPrice),
    initialEthPercent: initial.eth * initialPrice / investment * 100,
    finalEthPercent: pooled.eth * futurePrice / lpBeforeFees * 100,
    difference: lpValue - holdValue,
    differencePercent: (lpValue - holdValue) / holdValue * 100,
    impermanentLoss: Math.min(0, (lpBeforeFees / holdValue - 1) * 100),
    breakEvenFees: Math.max(0, holdValue - lpBeforeFees),
    holdReturn: (holdValue / investment - 1) * 100,
    lpReturn: (lpValue / investment - 1) * 100,
  };
}

export function rangePreset(input, width) {
  const scenario = validateRange(input);
  if (![0.05, 0.1, 0.5].includes(width)) throw new Error('Choose a supported range width.');
  return validateRange({ ...scenario, lowerPrice: scenario.initialPrice * (1 - width), upperPrice: scenario.initialPrice * (1 + width) });
}

export function futurePricePreset(input, preset) {
  const scenario = validateRange(input);
  const prices = {
    below: scenario.lowerPrice * 0.8, lower: scenario.lowerPrice,
    start: scenario.initialPrice, upper: scenario.upperPrice, above: scenario.upperPrice * 1.2,
  };
  if (!Object.hasOwn(prices, preset)) throw new Error('Choose a supported future-price preset.');
  return validateRange({ ...scenario, futurePrice: prices[preset] });
}

export function matchHoldingFees(input) {
  const result = calculateRange(input);
  return validateRange({ ...result, fees: result.breakEvenFees });
}

export function comparisonRanges(input) {
  const scenario = validateRange(input);
  const prices = [scenario.lowerPrice * 0.8, scenario.lowerPrice, scenario.initialPrice, scenario.futurePrice, scenario.upperPrice, scenario.upperPrice * 1.2]
    .filter((price) => price >= LIMITS.futurePrice.min && price <= LIMITS.futurePrice.max);
  return [...new Set(prices)].sort((a, b) => a - b).map((futurePrice) => calculateRange({ ...scenario, futurePrice }));
}

export function explorerDomain(input) {
  const scenario = validateRange(input);
  return {
    low: Math.max(LIMITS.futurePrice.min, Math.min(scenario.initialPrice * 0.5, scenario.lowerPrice * 0.75, scenario.futurePrice)),
    high: Math.min(LIMITS.futurePrice.max, Math.max(scenario.initialPrice * 1.5, scenario.upperPrice * 1.25, scenario.futurePrice)),
  };
}
