import { calculateScenario, validateScenario } from './cp50-v1.js';

export function experimentScenario(input, experiment) {
  const scenario = validateScenario(input);
  if (experiment === 'double') return validateScenario({ ...scenario, futurePrice: scenario.initialPrice * 2, fees: 0 });
  if (experiment === 'half') return validateScenario({ ...scenario, futurePrice: scenario.initialPrice / 2, fees: 0 });
  if (experiment === 'break-even') return { ...scenario, fees: calculateScenario({ ...scenario, fees: 0 }).breakEvenFees };
  throw new Error('Choose a supported experiment.');
}
