import { MODEL, validateRange } from '../models/cl-range-v1.js';

const keys = { investment: 'investment', initialPrice: 'start', futurePrice: 'future', lowerPrice: 'lower', upperPrice: 'upper', fees: 'fees', fullRangeFees: 'fullfees' };
export function rangeHash(input) {
  const scenario = validateRange(input);
  const params = new URLSearchParams({ scenario: MODEL });
  for (const [key, param] of Object.entries(keys)) params.set(param, String(scenario[key]));
  return '#' + params;
}
export function rangeFromHash(hash) {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  if (!params.has('scenario')) return null;
  if (params.get('scenario') !== MODEL) throw new Error('This link uses an unsupported range model.');
  const allowed = new Set(['scenario', ...Object.values(keys)]);
  if ([...params.keys()].some((key) => !allowed.has(key)) || params.getAll('scenario').length !== 1) {
    throw new Error('This range link contains unexpected or repeated inputs.');
  }
  const input = {};
  for (const [key, param] of Object.entries(keys)) {
    if (params.getAll(param).length !== 1 || !params.get(param).trim()) throw new Error('This range link is missing a required input.');
    input[key] = Number(params.get(param));
  }
  return validateRange(input);
}
