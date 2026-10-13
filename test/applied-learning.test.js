import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { APPLIED_IDS, appliedLessonFromHash, appliedQuestion, checkAppliedAnswer } from '../public/lib/applied-lessons.js';
import { APPLIED_LESSONS } from '../public/learning/applied-liquidity.js';
import { validatePositionPeriod } from '../public/data/position-period.js';
import { periodPointView } from '../public/lib/period-presentation.js';
import { createAppliedRecordLoader } from '../public/data/applied-records.js';
import { APPLIED_KEY, emptyAppliedProgress, parseAppliedProgress, readAppliedProgress, saveAppliedProgress } from '../public/data/applied-progress.js';

const raw = await Promise.all(['uniswap-v3-position-period.json', 'uniswap-v3-position-range-return.json'].map(async file => JSON.parse(await readFile(new URL('../public/examples/' + file, import.meta.url), 'utf8'))));
const [baseline, returning] = raw.map(validatePositionPeriod);

test('applied questions use verified period earnings, interval counters and the same holding basket', () => {
  assert.deepEqual(APPLIED_LESSONS.map(item => item.id), APPLIED_IDS);
  const fees = appliedQuestion(baseline, 'fees-over-time');
  assert.equal(fees.index, 8); assert.equal(fees.view.earned0, 112674n); assert.equal(fees.view.earned1, 896672855663157n);
  assert.ok(Math.abs(fees.answer - 2.3572428756221475) < 1e-12);
  assert.equal(checkAppliedAnswer(fees, '2.36', 'growth').passed, true);
  const between = appliedQuestion(returning, 'between-samples');
  assert.equal(between.index, 8); assert.equal(between.view.state, 'above'); assert.equal(between.interval.startState, 'above');
  assert.equal(between.answer, 2724); assert.equal(between.interval.durationSeconds, 7560);
  assert.ok(between.interval.earned0 > 0n && between.interval.earned1 > 0n);
  assert.equal(checkAppliedAnswer(between, '17580', 'counters').numeric, false, 'Cumulative active time is not the interval answer.');
  const final = appliedQuestion(returning, 'period-vs-holding');
  assert.equal(final.index, 16); assert.equal(final.prediction, 'lp');
  assert.equal(final.view.holding.amount0, 4982691068n); assert.equal(final.view.holding.amount1, 14920139441099507n);
  assert.ok(final.view.principalGapUSD < 0 && final.view.gapUSD > 0);
  assert.ok(Math.abs(final.answer - .17457169368572067) < 1e-12);
  assert.equal(checkAppliedAnswer(final, '0.17', 'basket').passed, true);
  assert.equal(checkAppliedAnswer(final, '0.18', 'basket').numeric, false);
  assert.ok(periodPointView(returning, 8).gapUSD < 0, 'Earning fees does not guarantee beating holding at every checkpoint.');
});
test('exploring a different checkpoint cannot alter the fixed question or accept unsupported evidence', () => {
  const before = appliedQuestion(returning, 'period-vs-holding');
  for (let i = 0; i < returning.points.length; i++) periodPointView(returning, i);
  assert.deepEqual(appliedQuestion(returning, 'period-vs-holding'), before);
  assert.throws(() => appliedQuestion(baseline, 'period-vs-holding'), /recorded position/);
  assert.throws(() => appliedQuestion(returning, 'unknown'), /applied exercise/);
  assert.throws(() => appliedQuestion({ ...returning, points: [returning.points[0], returning.points.at(-1)] }, 'between-samples'), /interval is missing/);
});
test('each applied step requires both an answer with correct units and sound reasoning', () => {
  for (const item of APPLIED_LESSONS) {
    const question = appliedQuestion(item.caseId === 'in-range' ? baseline : returning, item.id);
    assert.ok(item.predictions.some(([id]) => id === question.prediction));
    assert.ok(item.reasons.some(([id]) => id === question.reason));
    assert.equal(checkAppliedAnswer(question, String(question.answer), question.reason).passed, true);
    assert.equal(checkAppliedAnswer(question, String(question.answer), 'wrong').passed, false);
    for (const answer of ['', ' ', 'Infinity', 'NaN', 'no']) assert.equal(checkAppliedAnswer(question, answer, question.reason).passed, false);
  }
});
test('applied routes are explicit and cannot hijack essential or malformed lesson links', () => {
  for (const id of APPLIED_IDS) assert.equal(appliedLessonFromHash('#applied=' + id), id);
  for (const hash of ['', '#lesson=range-boundaries', '#applied=unknown', '#applied=fees-over-time&applied=between-samples', '#applied=fees-over-time&lesson=swap-impact']) assert.equal(appliedLessonFromHash(hash), null);
});
test('applied progress has an independent key, bounded drafts and usable storage failures', () => {
  const progress = { version: 1, completed: ['fees-over-time', 'fees-over-time', 'unknown'], drafts: {
    'fees-over-time': { prediction: 'earned', answer: '2.36', reason: 'growth', revealed: true, checkpoint: 8 },
    'between-samples': { checkpoint: 99, prediction: 'x'.repeat(100), answer: null },
    unknown: { revealed: true },
  } };
  const clean = parseAppliedProgress(progress);
  assert.deepEqual(clean.completed, ['fees-over-time']); assert.equal(clean.drafts['fees-over-time'].answer, '2.36');
  assert.equal(clean.drafts['between-samples'].checkpoint, null); assert.equal(clean.drafts['between-samples'].prediction, '');
  assert.equal(clean.drafts.unknown, undefined); assert.deepEqual(parseAppliedProgress({version: 99}), emptyAppliedProgress());
  const map = new Map([['degenerator-learning-liquidity-v1', 'existing lessons'], ['defi-sandbox-v1', 'existing balances']]);
  const storage = { getItem: key => map.get(key) || null, setItem: (key, value) => map.set(key, value) };
  assert.equal(saveAppliedProgress(progress, () => storage), true); assert.deepEqual(readAppliedProgress(() => storage).progress, clean);
  assert.ok(map.has(APPLIED_KEY)); assert.equal(map.get('degenerator-learning-liquidity-v1'), 'existing lessons'); assert.equal(map.get('defi-sandbox-v1'), 'existing balances');
  assert.equal(saveAppliedProgress(progress, () => ({setItem() { throw Error('Full'); }})), false);
  assert.equal(readAppliedProgress(() => { throw Error('Blocked'); }).available, false);
  assert.deepEqual(readAppliedProgress(() => ({getItem: () => '{broken'})).progress, emptyAppliedProgress());
});
test('bundled record loading shares requests, validates evidence and retries a failed response', async () => {
  let count = 0;
  const loader = createAppliedRecordLoader(async url => {
    count++; assert.ok(url.pathname.endsWith('/examples/uniswap-v3-position-period.json'));
    return { ok: true, json: async () => raw[0] };
  });
  const [a, b] = await Promise.all([loader('in-range'), loader('in-range')]);
  assert.equal(count, 1); assert.deepEqual(a, baseline); assert.equal(a, b);
  await assert.rejects(loader('unknown'), /bundled historical/);
  let attempt = 0;
  const retry = createAppliedRecordLoader(async () => ++attempt === 1 ? {ok: false} : {ok: true, json: async () => raw[1]});
  await assert.rejects(retry('range-return'), /Try again/); assert.deepEqual(await retry('range-return'), returning);
  const bad = createAppliedRecordLoader(async () => ({ok: true, json: async () => ({...raw[0], validation: {}})}));
  await assert.rejects(bad('in-range'), /summary differs/);
});
