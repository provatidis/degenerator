import { MODEL as FULL_MODEL } from '../models/cp50-v1.js';
import { MODEL as RANGE_MODEL } from '../models/cl-range-v1.js';
import { scenarioFromHash } from './scenario-links.js';
import { rangeFromHash } from './range-links.js';

export function readSharedScenario(hash) {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  if (!params.has('scenario')) return null;
  const model = params.get('scenario');
  if (model === FULL_MODEL) return { model, scenario: scenarioFromHash(hash) };
  if (model === RANGE_MODEL) return { model, scenario: rangeFromHash(hash) };
  throw new Error('This link uses an unsupported scenario model.');
}

export { FULL_MODEL, RANGE_MODEL };
