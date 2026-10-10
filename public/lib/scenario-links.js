import { MODEL, validateScenario } from '../models/cp50-v1.js';

export function scenarioHash(input) {
  const scenario = validateScenario(input);
  const params = new URLSearchParams({
    scenario: MODEL, investment: String(scenario.investment), start: String(scenario.initialPrice),
    future: String(scenario.futurePrice), fees: String(scenario.fees),
  });
  return `#${params}`;
}

export function scenarioFromHash(hash) {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  if (!params.has('scenario')) return null;
  if (params.get('scenario') !== MODEL) throw new Error('This link uses an unsupported scenario model.');
  const keys = { investment: 'investment', initialPrice: 'start', futurePrice: 'future', fees: 'fees' };
  const allowed = new Set(['scenario', ...Object.values(keys)]);
  if ([...params.keys()].some((key) => !allowed.has(key)) || params.getAll('scenario').length !== 1) {
    throw new Error('This scenario link contains unexpected or repeated inputs.');
  }
  const input = {};
  for (const [key, param] of Object.entries(keys)) {
    if (params.getAll(param).length !== 1 || !params.get(param).trim()) throw new Error('This scenario link is missing a required input.');
    input[key] = Number(params.get(param));
  }
  return validateScenario(input);
}

