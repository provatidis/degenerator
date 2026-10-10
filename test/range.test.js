import test from 'node:test';
import assert from 'node:assert/strict';
import { MODEL, DEFAULT_RANGE, LIMITS, validateRange, concentratedAmounts, calculateRange, rangePreset, futurePricePreset, matchHoldingFees, comparisonRanges, explorerDomain } from '../public/models/cl-range-v1.js';
import { rangeHash, rangeFromHash } from '../public/lib/range-links.js';
import { rangeCSV } from '../public/lib/range-csv.js';
import { readSharedScenario } from '../public/lib/link-router.js';
import { rangePriceLabels, assetAmounts } from '../public/lib/range-presentation.js';
import { scenarioHash } from '../public/lib/scenario-links.js';
import { DEFAULT_SCENARIO } from '../public/models/cp50-v1.js';

const close = (actual, expected, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)), actual + ' != ' + expected);
const reference = { investment: 5000, initialPrice: 4, futurePrice: 9, lowerPrice: 1, upperPrice: 9, fees: 0, fullRangeFees: 0 };

test('piecewise holdings match a hand-solvable position with square-root bounds 1 and 3', () => {
  const initial = concentratedAmounts(10, 4, 1, 9);
  close(initial.eth, 5 / 3); close(initial.usdc, 10);
  const inside = concentratedAmounts(10, 2.25, 1, 9);
  close(inside.eth, 10 / 3); close(inside.usdc, 5);
  const below = concentratedAmounts(10, 0.25, 1, 9);
  close(below.eth, 20 / 3); assert.equal(below.usdc, 0);
  const above = concentratedAmounts(10, 16, 1, 9);
  assert.equal(above.eth, 0); close(above.usdc, 20);
});

test('a $5,000 range is funded 40/60 and compared with its own initial tokens', () => {
  const result = calculateRange(reference);
  close(result.liquidity, 3000);
  close(result.initial.eth, 500); close(result.initial.usdc, 3000);
  close(result.initialEthPercent, 40);
  close(result.holdValue, 7500); close(result.lpBeforeFees, 6000);
  close(result.impermanentLoss, -20); close(result.breakEvenFees, 1500);
  close(result.fullRange.holdValue, 8125); close(result.fullRange.lpValue, 7500);
  assert.notEqual(result.holdValue, result.fullRange.holdValue, 'Different starting mixes have different holding benchmarks');
});

test('unchanged prices return the original assets and investment', () => {
  const result = calculateRange({ ...reference, futurePrice: 4 });
  close(result.holdValue, 5000); close(result.lpBeforeFees, 5000);
  assert.deepEqual(result.initial, result.pooled);
  close(result.impermanentLoss, 0);
  assert.equal(result.breakEvenFees, 0);
});

test('holdings are continuous at each edge and become exactly one token there', () => {
  for (const edge of [1, 9]) {
    const at = concentratedAmounts(10, edge, 1, 9);
    for (const price of [edge - 1e-8, edge + 1e-8]) {
      const nearby = concentratedAmounts(10, price, 1, 9);
      close(nearby.eth, at.eth, 1e-7); close(nearby.usdc, at.usdc, 1e-7);
    }
  }
  assert.equal(calculateRange({ ...reference, futurePrice: 1 }).state, 'lower-edge');
  assert.equal(calculateRange(reference).state, 'upper-edge');
  assert.equal(concentratedAmounts(10, 1, 1, 9).usdc, 0);
  assert.equal(concentratedAmounts(10, 9, 1, 9).eth, 0);
});

test('outside the range, token quantities stop rebalancing while their dollar value still follows the held asset', () => {
  const low = calculateRange({ ...reference, futurePrice: 0.25 });
  const lower = calculateRange({ ...reference, futurePrice: 0.5 });
  assert.deepEqual(low.pooled, lower.pooled);
  close(lower.lpBeforeFees, low.lpBeforeFees * 2);
  const high = calculateRange({ ...reference, futurePrice: 16 });
  const higher = calculateRange({ ...reference, futurePrice: 32 });
  assert.deepEqual(high.pooled, higher.pooled);
  close(high.lpBeforeFees, higher.lpBeforeFees);
});

test('a position can start below or above its range, funded entirely by one asset', () => {
  const below = calculateRange({ ...reference, initialPrice: 0.25, futurePrice: 0.5 });
  assert.equal(below.initial.usdc, 0); close(below.initial.eth, 20000);
  close(below.holdValue, below.lpBeforeFees); close(below.impermanentLoss, 0);
  const above = calculateRange({ ...reference, initialPrice: 16, futurePrice: 32 });
  assert.equal(above.initial.eth, 0); close(above.initial.usdc, 5000);
  close(above.holdValue, above.lpBeforeFees); close(above.impermanentLoss, 0);
  const returnsInside = calculateRange({ ...reference, initialPrice: 16, futurePrice: 4 });
  assert.ok(returnsInside.pooled.eth > 0 && returnsInside.pooled.usdc > 0);
  assert.ok(returnsInside.lpBeforeFees < returnsInside.holdValue);
});

test('virtual-reserve product is conserved within the range', () => {
  for (const price of [1, 1.5, 2, 4, 6.25, 8.9, 9]) {
    const assets = concentratedAmounts(10, price, 1, 9);
    close((assets.eth + 10 / 3) * (assets.usdc + 10), 100);
  }
});

test('very wide continuous ranges approach a full-range position', () => {
  const unit = concentratedAmounts(1, 4, 1e-30, 1e30);
  const liquidity = 5000 / (unit.eth * 4 + unit.usdc);
  const start = concentratedAmounts(liquidity, 4, 1e-30, 1e30);
  const future = concentratedAmounts(liquidity, 9, 1e-30, 1e30);
  close(start.eth, 625); close(start.usdc, 2500);
  close(future.eth * 9 + future.usdc, 7500);
});

test('before-fee range value never exceeds holding its initial assets across asymmetric and outside-start cases', () => {
  for (const [lowerPrice, upperPrice] of [[1, 9], [3.9, 4.1], [1, 2], [8, 10], [0.01, 1e7]]) {
    for (const initialPrice of [0.5, 2, 4, 9, 16]) {
      for (const futurePrice of [0.1, 1, 2, 4, 9, 16, 32]) {
        const result = calculateRange({ ...reference, lowerPrice, upperPrice, initialPrice, futurePrice });
        assert.ok(result.lpBeforeFees <= result.holdValue + Math.max(1, result.holdValue) * 1e-10);
        assert.ok(result.pooled.eth >= 0 && result.pooled.usdc >= 0);
        assert.ok(result.impermanentLoss <= 0);
      }
    }
  }
});

test('separate cash fee assumptions do not alter balances or before-fee IL', () => {
  const without = calculateRange(reference);
  const withFees = calculateRange({ ...reference, fees: 100, fullRangeFees: 300 });
  assert.deepEqual(withFees.initial, without.initial);
  assert.deepEqual(withFees.pooled, without.pooled);
  close(withFees.lpValue, without.lpValue + 100);
  close(withFees.fullRange.lpValue, without.fullRange.lpValue + 300);
  close(withFees.impermanentLoss, without.impermanentLoss);
  assert.equal(withFees.state, 'upper-edge');
});

test('break-even fees close the actual range holding gap and preserve the full-range fee input', () => {
  const input = { ...reference, fullRangeFees: 17 };
  const matched = matchHoldingFees(input);
  close(matched.fees, 1500); assert.equal(matched.fullRangeFees, 17);
  close(calculateRange(matched).difference, 0);
});

test('outputs scale with the budget and never mutate the input', () => {
  const original = { ...DEFAULT_RANGE };
  const input = { ...original };
  const first = calculateRange(input);
  const second = calculateRange({ ...input, investment: input.investment * 2 });
  close(second.holdValue, first.holdValue * 2); close(second.lpValue, first.lpValue * 2);
  close(second.pooled.eth, first.pooled.eth * 2); close(second.pooled.usdc, first.pooled.usdc * 2);
  assert.deepEqual(input, original);
});

test('invalid fields and unordered ranges are rejected with actionable messages', () => {
  for (const [key, limits] of Object.entries(LIMITS)) {
    for (const value of [NaN, Infinity, '2000', undefined, limits.min - 1, limits.max + 1]) assert.throws(() => validateRange({ ...DEFAULT_RANGE, [key]: value }));
  }
  assert.throws(() => validateRange({ ...DEFAULT_RANGE, lowerPrice: 2200 }), /upper price/);
  assert.throws(() => validateRange({ ...DEFAULT_RANGE, lowerPrice: 3000 }), /upper price/);
  assert.throws(() => concentratedAmounts(0, 4, 1, 9), /positive/);
  assert.throws(() => concentratedAmounts(10, 4, 9, 1), /ordered/);
});

test('narrow and extreme allowed scenarios stay finite, with targets exceeding fee limits rejected explicitly', () => {
  for (const input of [
    { ...DEFAULT_RANGE, lowerPrice: 1999.999999999, upperPrice: 2000.000000001 },
    { ...DEFAULT_RANGE, investment: 1e9, initialPrice: 0.01, futurePrice: 1e7, lowerPrice: 0.01, upperPrice: 1e7 },
    { ...DEFAULT_RANGE, investment: 1e9, initialPrice: 1e7, futurePrice: 0.01, lowerPrice: 0.01, upperPrice: 1e7 },
  ]) {
    const result = calculateRange(input);
    for (const key of ['liquidity', 'holdValue', 'lpValue', 'impermanentLoss', 'breakEvenFees']) assert.ok(Number.isFinite(result[key]), key);
    close(result.initial.eth * result.initialPrice + result.initial.usdc, result.investment);
  }
  const excessive = { ...DEFAULT_RANGE, investment: 1e9, initialPrice: 0.01, futurePrice: 1e7, lowerPrice: 0.01, upperPrice: 1 };
  assert.ok(calculateRange(excessive).breakEvenFees > LIMITS.fees.max);
  assert.throws(() => matchHoldingFees(excessive), /fee income/);
});

test('range presets keep the current future price and both fee assumptions', () => {
  const input = { ...DEFAULT_RANGE, fees: 50, fullRangeFees: 75 };
  const tight = rangePreset(input, 0.05);
  assert.equal(tight.lowerPrice, 1900); assert.equal(tight.upperPrice, 2100);
  assert.equal(tight.futurePrice, 2100); assert.equal(tight.fees, 50); assert.equal(tight.fullRangeFees, 75);
  assert.equal(futurePricePreset(input, 'upper').futurePrice, 2200);
  assert.equal(futurePricePreset(input, 'above').futurePrice, 2640);
  assert.throws(() => rangePreset(input, 0.2), /supported/);
  assert.throws(() => futurePricePreset(input, 'unknown'), /supported/);
});

test('comparisons retain the funding mix and fee assumptions while including both exact edges', () => {
  const rows = comparisonRanges(DEFAULT_RANGE);
  assert.deepEqual(rows.map((row) => row.futurePrice), [1440, 1800, 2000, 2100, 2200, 2640]);
  assert.ok(rows.every((row) => row.fees === 0 && row.fullRangeFees === 0));
  assert.ok(rows.every((row) => row.initial.eth === rows[0].initial.eth && row.initial.usdc === rows[0].initial.usdc));
  const domain = explorerDomain(DEFAULT_RANGE);
  assert.ok(domain.low < DEFAULT_RANGE.lowerPrice && domain.high > DEFAULT_RANGE.upperPrice);
});

test('range links preserve all seven inputs and route to the correct model without wallet data', () => {
  const input = { ...DEFAULT_RANGE, fees: 17.5, fullRangeFees: 23.4, lowerPrice: 1799.1234 };
  const hash = rangeHash({ ...input, wallet: 'private', block: 'not included' });
  assert.deepEqual(rangeFromHash(hash), input);
  assert.deepEqual(readSharedScenario(hash), { model: MODEL, scenario: input });
  assert.deepEqual(readSharedScenario(scenarioHash(DEFAULT_SCENARIO)), { model: 'cp50-v1', scenario: DEFAULT_SCENARIO });
  assert.equal(readSharedScenario('#range-lab'), null);
  assert.ok(!hash.includes('wallet') && !hash.includes('block'));
});

test('unsupported, duplicate, missing and malformed range link values are rejected', () => {
  const valid = rangeHash(DEFAULT_RANGE);
  for (const hash of [
    valid.replace(MODEL, 'cl-range-v99'), valid + '&lower=1', valid + '&scenario=' + MODEL,
    valid + '&wallet=1', valid.replace('investment=5000', 'investment='), valid.replace('&fullfees=0', ''),
    valid.replace('lower=1800', 'lower=9999'), valid.replace('upper=2200', 'upper=NaN'),
  ]) assert.throws(() => readSharedScenario(hash));
});

test('CSV distinguishes the actual range holding benchmark from the full-range 50/50 benchmark', () => {
  const [headers, ...rows] = rangeCSV(reference).trim().split('\r\n').map((row) => row.split(','));
  const selected = rows.find((row) => row[headers.indexOf('future_eth_price_usd')] === '9');
  const data = Object.fromEntries(headers.map((key, i) => [key, selected[i]]));
  assert.equal(data.model, MODEL); assert.equal(data.range_state, 'upper-edge');
  close(Number(data.hold_range_initial_tokens_usd), 7500);
  close(Number(data.full_range_own_50_50_hold_usd), 8125);
  close(Number(data.range_lp_before_fees_usd), 6000);
  close(Number(data.range_break_even_fees_usd), 1500);
});

test('very narrow bounds retain distinct displayed prices', () => {
  const labels = rangePriceLabels(1999.9999, 2000.0001);
  assert.notEqual(labels.lower, labels.upper);
  assert.ok(labels.lower.includes('9999') && labels.upper.includes('0001'));
});

test('small positive token amounts remain distinguishable from zero in the interface', () => {
  const tiny = assetAmounts({ eth: 1e-7, usdc: 0.001 });
  assert.ok(tiny.includes('<0.000001 ETH') && tiny.includes('<0.01 USDC'));
  assert.equal(assetAmounts({ eth: 0, usdc: 0 }), '0 ETH · 0.00 USDC');
});
