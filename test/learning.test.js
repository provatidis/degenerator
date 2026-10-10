import { DEEPER_READING } from '../public/learning/deeper-reading.js';
import { lessonWalkthrough } from '../public/lib/lesson-walkthrough.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { LESSON_IDS, VARIANTS, lessonSetup, runLesson, checkLesson, validateLessonInputs } from '../public/models/lesson-experiments.js';
import { LESSONS } from '../public/learning/liquidity-essentials.js';
import { LEARNING_KEY, emptyProgress, parseProgress, readProgress, saveProgress } from '../public/data/learning-progress.js';
const close = (actual, expected, tolerance = 1e-6) => assert.ok(Math.abs(actual - expected) <= tolerance, actual + ' differs from ' + expected);

test('every lesson and transfer variation produces a finite, answerable exercise', () => {
  assert.deepEqual(LESSONS.map(lesson => lesson.id), LESSON_IDS);
  for (const lesson of LESSONS) for (let variant = 0; variant < VARIANTS; variant++) {
    const inputs = lessonSetup(lesson.id, variant), result = runLesson(lesson.id, inputs, variant);
    assert.ok(Number.isFinite(result.answer));
    assert.ok(lesson.predictions.some(([id]) => id === result.prediction));
    assert.ok(lesson.reasons.some(([id]) => id === result.reason));
    assert.equal(checkLesson(lesson.id, inputs, variant, String(result.answer), result.reason).passed, true);
  }
});
test('swap lesson reproduces the reference 1 ETH quote and larger orders get greater impact', () => {
  const small = runLesson('swap-impact', { amount: 1 });
  const large = runLesson('swap-impact', { amount: 10 });
  close(small.out, 1974.316068, 1e-6);
  assert.ok(large.impact > small.impact);
  assert.ok(large.out / 10 < small.out);
  assert.equal(large.afterEth, 110);
  close(large.afterUsdc + large.out, 200000);
});
test('pool ownership includes the new deposit in both reserves', () => {
  const r = runLesson('pool-share', { depositEth: 5 });
  close(r.share, 4.761904761904762);
  assert.equal(r.usdcDeposit, 10000);
  assert.ok(r.share < 5);
});
test('a rally gives dollar profit while still losing to holding the starting tokens', () => {
  const balance = runLesson('token-balances', { futurePrice: 4000 });
  close(balance.result.held.eth, 1.25);
  close(balance.result.pooled.eth, 0.8838834764831843);
  assert.equal(balance.prediction, 'less');
  const r = runLesson('loss-vs-profit', { futurePrice: 4000 });
  close(r.result.holdValue, 7500);
  close(r.result.lpBeforeFees, 7071.067811865476);
  close(r.answer, 428.932188134524);
  assert.ok(r.result.lpReturn > 0 && r.result.impermanentLoss < 0);
  assert.equal(runLesson('token-balances', { futurePrice: 1000 }).prediction, 'more');
  assert.equal(runLesson('token-balances', { futurePrice: 2000 }).prediction, 'same');
});
test('total break-even target differs from additional fees and assumptions never change principal', () => {
  const r = runLesson('fee-break-even', { futurePrice: 4000, fees: 100 });
  close(r.answer, 428.932188134524);
  assert.equal(r.prediction, 'short');
  const final = runLesson('final-challenge', { futurePrice: 4000, fees: 100 });
  close(final.answer, 328.932188134524);
  const covered = runLesson('final-challenge', { futurePrice: 4000, fees: 600 });
  assert.equal(covered.answer, 0);
  assert.equal(covered.prediction, 'lp');
  assert.deepEqual(covered.result.pooled, r.result.pooled);
});
test('range exercise labels exact boundaries and does not infer earlier fees', () => {
  for (const [price, expected, share] of [[1000,'eth',100],[1800,'eth',100],[2000,'both',null],[2200,'usdc',0],[3000,'usdc',0]]) {
    const r = runLesson('range-boundaries', { futurePrice: price, width: 0.1 });
    assert.equal(r.prediction, expected);
    if (share !== null) close(r.answer, share);
    assert.equal(r.reason, 'path');
  }
  const tight = runLesson('range-boundaries', { futurePrice: 2200, width: 0.05 });
  const wide = runLesson('range-boundaries', { futurePrice: 2200, width: 0.5 });
  assert.equal(tight.prediction, 'usdc');
  assert.equal(wide.prediction, 'both');
});
test('completion requires both a rounded numeric answer and sound reasoning', () => {
  const inputs = lessonSetup('fee-break-even');
  assert.equal(checkLesson('fee-break-even', inputs, 0, '428.93', 'assumption').passed, true);
  for (const answer of ['', ' ', 'no', 'Infinity', '100']) assert.equal(checkLesson('fee-break-even', inputs, 0, answer, 'assumption').passed, false);
  const badReason = checkLesson('fee-break-even', inputs, 0, '428.93', 'guarantee');
  assert.equal(badReason.numeric, true); assert.equal(badReason.reasoning, false);
});
test('exercise validation preserves fixed assumptions and rejects unsupported inputs', () => {
  const r = validateLessonInputs('token-balances', { futurePrice: 4000, investment: 1, fees: 99999, initialPrice: 1 });
  assert.equal(r.investment, 5000); assert.equal(r.initialPrice, 2000); assert.equal(r.fees, 0);
  for (const input of [{amount:-1}, {amount:0}, {amount:1.5}, {amount:51}]) assert.throws(() => runLesson('swap-impact', input));
  assert.throws(() => lessonSetup('unknown'));
  assert.throws(() => lessonSetup('pool-share', 99));
  assert.throws(() => runLesson('range-boundaries', { futurePrice: 2000, width: 0.25 }));
});
test('progress retains valid independent drafts and removes unknown or damaged data', () => {
  const dirty = { version: 1, completed: ['pool-share','pool-share','fake'], lastLesson:'fake', unrelated:'ignore', drafts: {
    'pool-share': { variant:1, inputs:lessonSetup('pool-share',1), prediction:'less', answer:'16.67', reason:'ownership', ran:true, injected:'ignore' },
    'swap-impact': { variant:0, inputs:{amount:-5} },
  }};
  const clean = parseProgress(dirty);
  assert.deepEqual(clean.completed, ['pool-share']);
  assert.equal(clean.lastLesson, 'swap-impact');
  assert.equal(clean.drafts['pool-share'].inputs.reserveEth, 50);
  assert.equal(clean.drafts['swap-impact'], undefined);
  assert.equal(clean.drafts['pool-share'].injected, undefined);
  assert.equal(clean.unrelated, undefined);
  assert.deepEqual(parseProgress({version:999,completed:LESSON_IDS}),emptyProgress());
});
test('progress uses its own key and storage failures leave the exercises usable', () => {
  const map = new Map([['defi-sandbox-v1','personal sandbox']]);
  const storage = { getItem:key=>map.get(key)||null, setItem:(key,value)=>map.set(key,value) };
  const progress = { ...emptyProgress(), completed:['pool-share'], lastLesson:'pool-share' };
  assert.equal(saveProgress(progress,()=>storage),true);
  assert.deepEqual(readProgress(()=>storage).progress.completed,['pool-share']);
  assert.equal(map.get('defi-sandbox-v1'),'personal sandbox');
  assert.ok(map.has(LEARNING_KEY));
  const blocked=()=>{throw new Error('Blocked')};
  assert.equal(readProgress(blocked).available,false);
  assert.equal(saveProgress(progress,blocked),false);
  assert.equal(saveProgress(progress,()=>({setItem(){throw new Error('Full')}})),false);
  assert.deepEqual(readProgress(()=>({getItem:()=>'{broken'})).progress,emptyProgress());
});

test('worked examples distinguish dollar profit, total fee targets and additional hurdles', () => {
  const loss = JSON.stringify(lessonWalkthrough('loss-vs-profit', runLesson('loss-vs-profit', lessonSetup('loss-vs-profit'))));
  assert.ok(loss.includes('+$2,071.07') && loss.includes('$428.93') && loss.includes('−5.72%'));
  const fees = JSON.stringify(lessonWalkthrough('fee-break-even', runLesson('fee-break-even', lessonSetup('fee-break-even'))));
  assert.ok(fees.includes('$428.93') && fees.includes('$328.93'));
  const final = JSON.stringify(lessonWalkthrough('final-challenge', runLesson('final-challenge', lessonSetup('final-challenge'))));
  assert.ok(final.includes('−$328.93'));
});
test('worked examples refresh edited fees and a falling-price variation without mutating inputs', () => {
  const inputs = { ...lessonSetup('final-challenge'), fees:500 }, before = {...inputs};
  const steps = lessonWalkthrough('final-challenge', runLesson('final-challenge',inputs));
  assert.ok(steps[1][1].includes('$500.00'));
  assert.ok(steps[3][1].includes('$0.00 additional'));
  assert.deepEqual(inputs,before);
  const alternate = lessonWalkthrough('final-challenge',runLesson('final-challenge',lessonSetup('final-challenge',1),1));
  assert.ok(alternate[0][1].includes('$2,250.00'));
  assert.ok(alternate[1][1].includes('$2,121.32'));
  assert.ok(alternate[3][1].includes('$78.68 additional'));
});
test('each subject has complete optional reading and supported primary-source links', () => {
  assert.deepEqual(Object.keys(DEEPER_READING),LESSON_IDS);
  for (const id of LESSON_IDS) {
    const entry=DEEPER_READING[id];
    assert.ok(entry.title && entry.paragraphs.length >= 2 && entry.misconception.text && entry.math.formula);
    assert.equal(entry.sources.length,2);
    for(const source of entry.sources){
      const url=new URL(source.url);
      assert.equal(url.protocol,'https:');
      assert.ok(['developers.uniswap.org','docs.uniswap.org','blog.uniswap.org','app.uniswap.org','github.com'].includes(url.hostname));
      assert.ok(source.title && source.detail);
    }
    for(let variant=0;variant<VARIANTS;variant++) {
      const steps=lessonWalkthrough(id,runLesson(id,lessonSetup(id,variant),variant));
      assert.equal(steps.length,4);
      assert.doesNotMatch(JSON.stringify(steps),/NaN|Infinity|undefined/);
    }
  }
  assert.throws(()=>lessonWalkthrough('unknown',{setup:{}}));
});
