import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validatePositionPeriod } from '../public/data/position-period.js';
import { positionFeeAccounting, feeSnapshotFields } from '../public/data/position-snapshot.js';
import { Q128 } from '../public/models/v3-fees.js';
import { periodPointView, periodIntervalView, periodMilestones, periodChartRange } from '../public/lib/period-presentation.js';
import { REPLAY_CASES, replayCaseFromHash } from '../public/data/replay-cases.js';
import { workspaceFromHash } from '../public/lib/workspace-links.js';
const record = JSON.parse(await readFile(new URL('../public/examples/uniswap-v3-position-period.json', import.meta.url)));

test('interval credits and active seconds sum exactly to the recorded period, carrying rounding', () => {
  const period = validatePositionPeriod(record), final = periodPointView(period, period.points.length - 1);
  const sum = { earned0: 0n, earned1: 0n, seconds: 0, outside: 0, duration: 0 };
  for (let index = 0; index < period.points.length; index++) {
    const interval = periodIntervalView(period, index);
    sum.earned0 += interval.earned0; sum.earned1 += interval.earned1;
    sum.seconds += interval.secondsInRange; sum.outside += interval.secondsOutOfRange; sum.duration += interval.durationSeconds;
  }
  assert.equal(sum.earned0, final.earned0); assert.equal(sum.earned1, final.earned1);
  assert.equal(sum.seconds, final.secondsInRange); assert.equal(sum.outside, final.secondsOutOfRange); assert.equal(sum.duration, final.durationSeconds);
  const initial = periodIntervalView(period, 0); assert.equal(initial.earned0, 0n); assert.equal(initial.durationSeconds, 0);
  assert.throws(() => periodIntervalView(period, -1), /checkpoint/);
});
test('an impossible adjacent time interval is rejected even when every cumulative total fits', () => {
  const changed = structuredClone(record);
  changed.points[1].secondsInside = String(BigInt(changed.points[0].secondsInside) + 100n);
  assert.throws(() => validatePositionPeriod(changed), /Range time exceeds/);
});
test('individually consistent snapshots cannot hide decreasing period fee credits', () => {
  const changed = structuredClone(record), point = changed.points[2], snapshot = point.snapshot;
  snapshot.feeGrowth.global0X128 = String(BigInt(snapshot.feeGrowth.global0X128) + Q128);
  snapshot.fees = feeSnapshotFields(positionFeeAccounting(snapshot.position, snapshot.pool, snapshot.feeGrowth));
  point.simulatedCollect[0] = String(BigInt(point.simulatedCollect[0]) + BigInt(snapshot.position.liquidity));
  assert.throws(() => validatePositionPeriod(changed), /fee credits cannot decrease/);
});
test('the baseline exposes only witnessed milestones and a chart that includes its bounds', () => {
  const period = validatePositionPeriod(record);
  assert.deepEqual(periodMilestones(period), [{ index: 0, label: 'Start' }, { index: 8, label: 'End' }]);
  const chart = periodChartRange(period);
  assert.equal(chart.lowerVisible, true); assert.equal(chart.upperVisible, true);
  for (const view of chart.views) assert.ok(view.price > chart.bottom && view.price < chart.top);
});
test('ordered replay cases preserve the old fragment and allow a direct advanced entry', () => {
  assert.equal(REPLAY_CASES[0].hash, '#historical-case');
  for (const item of REPLAY_CASES) { assert.equal(replayCaseFromHash(item.hash), item); assert.equal(workspaceFromHash(item.hash), 'replay'); }
  assert.equal(replayCaseFromHash('#historical-case=unsupported'), null);
  assert.equal(workspaceFromHash('#historical-case=unsupported'), 'replay');
});

const crossingRecord = JSON.parse(await readFile(new URL('../public/examples/uniswap-v3-position-range-return.json', import.meta.url)));
test('the longer recorded case reproduces independent fee checks, outside time and witnessed returns', () => {
  const period = validatePositionPeriod(crossingRecord), final = periodPointView(period, 16);
  assert.equal(period.points.length, 17); assert.equal(final.durationSeconds, 120468);
  assert.equal(final.secondsInRange, 50256); assert.equal(final.secondsOutOfRange, 70212);
  assert.equal(final.earned0, 274940n); assert.equal(final.earned1, 65624095827826n);
  assert.deepEqual(period.validation.roundingDeltaRaw, ['1', '0']);
  assert.deepEqual(final.holding, { amount0: 4982691068n, amount1: 14920139441099507n });
  assert.equal(final.state, 'above'); assert.ok(Math.abs(final.gapUSD - .17457169368572067) < .000001);
  assert.deepEqual(periodMilestones(period), [
    { index: 0, label: 'Start' }, { index: 2, label: 'Outside sample' },
    { index: 8, label: 'Between samples' }, { index: 11, label: 'Return sample' }, { index: 16, label: 'End' },
  ]);
});
test('recorded outside intervals keep fees flat and principal tokens fixed; price samples miss active time', () => {
  const period = validatePositionPeriod(crossingRecord);
  for (const index of [3, 4, 5, 6, 7, 9, 10]) {
    const interval = periodIntervalView(period, index), current = periodPointView(period, index), previous = periodPointView(period, index - 1);
    assert.equal(interval.secondsInRange, 0); assert.equal(interval.earned0, 0n); assert.equal(interval.earned1, 0n);
    assert.deepEqual(current.principal, previous.principal);
  }
  const hidden = periodIntervalView(period, 8);
  assert.equal(periodPointView(period, 7).state, 'above'); assert.equal(periodPointView(period, 8).state, 'above');
  assert.equal(hidden.secondsInRange, 2724); assert.equal(hidden.earned0, 12345n); assert.equal(hidden.earned1, 4614570441023n);
  const returned = periodIntervalView(period, 11); assert.ok(returned.secondsInRange > 0); assert.ok(returned.earned0 > 0n);
});
test('longer-case interval credits sum to the period total and the plot retains the relevant boundary', () => {
  const period = validatePositionPeriod(crossingRecord), final = periodPointView(period, 16);
  const intervals = period.points.map((_, index) => periodIntervalView(period, index));
  assert.equal(intervals.reduce((sum, interval) => sum + interval.earned0, 0n), final.earned0);
  assert.equal(intervals.reduce((sum, interval) => sum + interval.earned1, 0n), final.earned1);
  assert.equal(intervals.reduce((sum, interval) => sum + interval.secondsInRange, 0), final.secondsInRange);
  const chart = periodChartRange(period); assert.equal(chart.lowerVisible, false); assert.equal(chart.upperVisible, true);
  for (const view of chart.views) assert.ok(view.price > chart.bottom && view.price < chart.top);
});
