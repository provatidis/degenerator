// Compatibility entry point: existing imports and cp50-v1 shared links remain valid.
export { MODEL, DEFAULT_SCENARIO, LIMITS, validateScenario, calculateScenario, comparisonScenarios } from './models/cp50-v1.js';
export { scenarioHash, scenarioFromHash } from './lib/scenario-links.js';
export { scenarioCSV } from './lib/scenario-csv.js';
