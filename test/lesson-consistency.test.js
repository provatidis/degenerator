import test from 'node:test';
import assert from 'node:assert/strict';
import { LESSONS } from '../public/learning/liquidity-essentials.js';
import { lessonSetup, runLesson, checkLesson } from '../public/models/lesson-experiments.js';
import { tokenBalanceNarration, benchmarkNarration, lessonReasonFeedback } from '../public/lib/lesson-narration.js';
import { lessonWalkthrough } from '../public/lib/lesson-walkthrough.js';
import { learningAnswerMatches } from '../public/models/learning-answer.js';
import { readFile } from 'node:fs/promises';
import { validatePositionPeriod } from '../public/data/position-period.js';
import { appliedQuestion, checkAppliedAnswer, appliedReasonFeedback } from '../public/lib/applied-lessons.js';
import { APPLIED_LESSONS } from '../public/learning/applied-liquidity.js';

test('rising, falling and unchanged prices agree with the explanation and never accept token creation', () => {
  for (let variant = 0; variant < 3; variant++) for (const factor of [.5, 1, 2]) {
    const setup = lessonSetup('token-balances', variant), input = {futurePrice: setup.initialPrice * factor};
    const result = runLesson('token-balances', input, variant), copy = tokenBalanceNarration(result);
    assert.equal(result.prediction, factor < 1 ? 'more' : factor > 1 ? 'less' : 'same');
    assert.equal(copy.direction, factor < 1 ? 'down' : factor > 1 ? 'up' : 'same');
    if (factor > 1) {
      assert.ok(result.result.pooled.eth < result.result.held.eth && result.result.pooled.usdc > result.result.held.usdc);
      assert.match(copy.correctReason, /exchange USDC for ETH.*less ETH and more USDC/);
    } else if (factor < 1) {
      assert.ok(result.result.pooled.eth > result.result.held.eth && result.result.pooled.usdc < result.result.held.usdc);
      assert.match(copy.correctReason, /exchange ETH for USDC.*more ETH and less USDC/);
    } else {
      assert.deepEqual(result.result.pooled, result.result.held);
      assert.match(copy.reasoning, /stay the same/); assert.match(copy.correctReason, /no price change/);
      assert.match(lessonWalkthrough('token-balances', result)[2][0], /unchanged/);
    }
    assert.match(copy.explanation, /neither ETH nor USDC is created/);
    assert.equal(checkLesson('token-balances', input, variant, String(result.answer), 'mint').passed, false);
    assert.equal(checkLesson('token-balances', input, variant, String(result.answer), 'interest').passed, false);
    assert.match(lessonReasonFeedback('token-balances', result, 'mint'), /does not create ETH or USDC/);
  }
});
test('all foundation distractors are rejected and explain the misconception in every variation', () => {
  for (const lesson of LESSONS) for (let variant = 0; variant < 3; variant++) {
    const inputs = lessonSetup(lesson.id, variant), result = runLesson(lesson.id, inputs, variant);
    const answer = String(result.wholeAnswer ? Math.round(result.answer) : result.answer);
    for (const [reason] of lesson.reasons) {
      assert.equal(checkLesson(lesson.id, inputs, variant, answer, reason).passed, reason === result.reason);
      if (reason !== result.reason) assert.doesNotMatch(lessonReasonFeedback(lesson.id, result, reason), /^Choose an explanation/);
    }
  }
});
test('assessment precision rejects adjacent wrong numbers while accepting the requested rounding', () => {
  for (const [id, answer, wrong, reason] of [
    ['swap-impact', '18132', '18133', 'curve'], ['pool-share', '4.76', '4.75', 'ownership'],
    ['token-balances', '.884', '.883', 'rebalance'], ['loss-vs-profit', '428.93', '428.94', 'benchmark'],
    ['fee-break-even', '428.93', '428.94', 'assumption'], ['range-boundaries', '0', '.04', 'path'],
    ['final-challenge', '328.93', '328.94', 'total'],
  ]) {
    const inputs = lessonSetup(id);
    assert.equal(checkLesson(id, inputs, 0, answer, reason).passed, true, id);
    assert.equal(checkLesson(id, inputs, 0, wrong, reason).numeric, false, id);
  }
  assert.equal(learningAnswerMatches('18132.2', 18132.217, 0, true), false);
  assert.equal(learningAnswerMatches('1.01', 1.005, 2), true, 'Use the same decimal rounding as the displayed result.');
  assert.equal(learningAnswerMatches('-1.01', -1.005, 2), true);
  assert.equal(learningAnswerMatches('0', -0.00000001, 2), true);
});
test('benchmark explanations follow actual profit, total targets and additional fees including no price change', () => {
  for (let variant = 0; variant < 3; variant++) for (const factor of [.5, 1, 2]) {
    const base = lessonSetup('loss-vs-profit', variant), price = base.initialPrice * factor;
    const loss = runLesson('loss-vs-profit', {futurePrice: price}, variant);
    assert.equal(loss.prediction, factor < 1 ? 'loss' : 'gain');
    assert.ok(benchmarkNarration('loss-vs-profit', loss).includes('before-fee shortfall'));
    if (factor === 1) assert.equal(loss.answer, 0);
    const fees = runLesson('fee-break-even', {futurePrice: price, fees: 0}, variant);
    const covered = runLesson('final-challenge', {futurePrice: price, fees: Math.min(base.investment / 2, fees.answer + 1)}, variant);
    assert.equal(covered.prediction, 'lp'); assert.equal(covered.answer, 0);
    assert.match(benchmarkNarration('fee-break-even', fees), /total target/);
    assert.match(benchmarkNarration('final-challenge', covered), /conditional on/);
  }
});
test('range boundary questions and predictions agree across all widths and variations', () => {
  for (let variant = 0; variant < 3; variant++) for (const width of [.05, .1, .5]) {
    const {initialPrice} = lessonSetup('range-boundaries', variant);
    for (const [factor, prediction, share] of [[.5,'eth',100],[1-width,'eth',100],[1,'both',null],[1+width,'usdc',0],[2,'usdc',0]]) {
      const result = runLesson('range-boundaries', {futurePrice: initialPrice * factor, width}, variant);
      assert.equal(result.prediction, prediction);
      if (share !== null) assert.equal(result.answer, share);
      assert.equal(checkLesson('range-boundaries', result.setup, variant, String(result.answer), 'zero').passed, false);
    }
  }
});
test('historical questions keep their period scope and reject every unsupported conclusion', async () => {
  const records = await Promise.all(['uniswap-v3-position-period.json','uniswap-v3-position-range-return.json'].map(async file => validatePositionPeriod(JSON.parse(await readFile(new URL('../public/examples/' + file, import.meta.url), 'utf8')))));
  for (const lesson of APPLIED_LESSONS) {
    const question = appliedQuestion(records[lesson.caseId === 'in-range' ? 0 : 1], lesson.id);
    for (const [reason] of lesson.reasons) {
      assert.equal(checkAppliedAnswer(question, String(question.answer), reason).passed, reason === question.reason);
      if (reason !== question.reason) assert.doesNotMatch(appliedReasonFeedback(lesson.id, reason), /^Choose a conclusion/);
    }
  }
  assert.match(APPLIED_LESSONS.at(-1).explanation, /At the final question checkpoint/);
  const interval = appliedQuestion(records[1], 'between-samples');
  assert.equal(checkAppliedAnswer(interval, '2724.4', 'counters').numeric, false);
  assert.equal(checkAppliedAnswer(interval, '2724', 'counters').numeric, true);
});
