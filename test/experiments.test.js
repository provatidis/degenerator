import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SCENARIO, calculateScenario } from '../public/models/cp50-v1.js';
import { experimentScenario } from '../public/models/experiments.js';

test('guided price experiments keep investment and starting price while clearing fee assumptions', () => {
  const double = experimentScenario(DEFAULT_SCENARIO, 'double');
  const half = experimentScenario(DEFAULT_SCENARIO, 'half');
  assert.equal(double.investment, 5000);
  assert.equal(double.initialPrice, 2000);
  assert.equal(double.futurePrice, 4000);
  assert.equal(half.futurePrice, 1000);
  assert.equal(double.fees, 0);
  assert.equal(half.fees, 0);
  assert.equal(DEFAULT_SCENARIO.fees, 100);
});

test('the harvest experiment closes the current scenario gap without changing token balances', () => {
  const input = { ...DEFAULT_SCENARIO, futurePrice: 3000 };
  const result = calculateScenario(experimentScenario(input, 'break-even'));
  assert.ok(Math.abs(result.difference) < 1e-8);
  assert.deepEqual(result.pooled, calculateScenario(input).pooled);
  assert.throws(() => experimentScenario(input, 'unknown'), /supported/);
  assert.throws(() => experimentScenario({ ...input, initialPrice: 1e7 }, 'double'), /between/);
});
