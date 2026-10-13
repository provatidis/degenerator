import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { LESSON_IDS, VARIANTS, lessonSetup, runLesson } from '../public/models/lesson-experiments.js';
import { lessonApplication, checkLessonUnderstanding } from '../public/models/lesson-application.js';
import { lessonApplicationCopy } from '../public/lib/lesson-application-copy.js';
import { appliedApplication, checkAppliedUnderstanding } from '../public/lib/applied-applications.js';
import { appliedQuestion } from '../public/lib/applied-lessons.js';
import { validatePositionPeriod } from '../public/data/position-period.js';
import { LESSONS } from '../public/learning/liquidity-essentials.js';
import { APPLIED_LESSONS } from '../public/learning/applied-liquidity.js';
import { parseProgress } from '../public/data/learning-progress.js';
import { parseAppliedProgress } from '../public/data/applied-progress.js';
import { newChoiceSeed, validChoiceSeed, orderedLearningChoices } from '../public/lib/learning-choices.js';

const [baseline, returning] = await Promise.all(['uniswap-v3-position-period.json','uniswap-v3-position-range-return.json'].map(async file => validatePositionPeriod(JSON.parse(await readFile(new URL('../public/examples/' + file, import.meta.url),'utf8')))));

test('every exercise requires explanation and transfer, independently of numeric practice or predictions', () => {
  for (const id of LESSON_IDS) for (let variant = 0; variant < VARIANTS; variant++) {
    const input = lessonSetup(id,variant), before = {...input}, result = runLesson(id,input,variant);
    const copy = lessonApplicationCopy(id,result), item = LESSONS.find(lesson=>lesson.id===id);
    assert.equal(copy.choices.filter(([value])=>value===copy.expected).length,1);
    assert.equal(checkLessonUnderstanding(id,input,variant,result.reason,copy.expected).passed,true);
    assert.equal(checkLessonUnderstanding(id,input,variant,'',copy.expected).passed,false);
    assert.equal(checkLessonUnderstanding(id,input,variant,result.reason,'').passed,false);
    for (const [reason] of item.reasons) for (const [answer] of copy.choices) {
      assert.equal(checkLessonUnderstanding(id,input,variant,reason,answer).passed,reason===result.reason && answer===copy.expected);
    }
    assert.equal(checkLessonUnderstanding(id,input,variant,'unknown','unknown').passed,false);
    assert.deepEqual(input,before);
    assert.ok(copy.context && copy.question && copy.hint && copy.feedback);
    assert.doesNotMatch(JSON.stringify(copy),/NaN|undefined|Infinity/);
  }
});
test('transfer changes the actual selected setup, including extremes and falling-price variations', () => {
  for (let variant=0;variant<VARIANTS;variant++) {
    const start = lessonSetup('swap-impact',variant);
    for (const amount of [1,start.reserveEth/2]) {
      const result=runLesson('swap-impact',{amount},variant), app=lessonApplication('swap-impact',result);
      assert.notEqual(app.amount,amount); assert.equal(app.next.setup.reserveEth,start.reserveEth);
      assert.equal(app.expected,app.amount>amount?'more':'less');
    }
    const share=runLesson('pool-share',lessonSetup('pool-share',variant),variant), app=lessonApplication('pool-share',share);
    assert.ok(app.afterShare<share.share);
    assert.ok(Math.abs(app.afterShare/100*(share.setup.reserveEth+2*share.setup.depositEth)-share.setup.depositEth)<1e-12);
    for (const multiplier of [.5,1,1.5,2]) {
      const futurePrice=start.initialPrice*multiplier;
      const balances=lessonApplication('token-balances',runLesson('token-balances',{futurePrice},variant));
      assert.equal(balances.expected,multiplier>1?'more':'less');
      assert.equal(balances.next.setup.initialPrice,start.initialPrice);
      const loss=lessonApplication('loss-vs-profit',runLesson('loss-vs-profit',{futurePrice},variant));
      assert.equal(loss.expected,multiplier===1?'trails':'matches');
      for (const fees of [0,100,start.investment/2]) {
        const original=runLesson('fee-break-even',{futurePrice,fees},variant), changed=lessonApplication('fee-break-even',original);
        assert.notEqual(changed.fees,fees); assert.equal(changed.next.result.breakEvenFees,original.result.breakEvenFees);
        assert.equal(changed.expected,'same');
      }
      for (const width of [.05,.1,.5]) {
        const original=runLesson('range-boundaries',{futurePrice,width},variant), changed=lessonApplication('range-boundaries',original);
        assert.equal(changed.expected,original.prediction==='usdc'?'eth':'usdc');
        assert.equal(changed.next.result.pooled[changed.expected==='eth'?'usdc':'eth'],0);
      }
    }
  }
  assert.throws(()=>lessonApplication('unknown',{setup:{}}));
});
test('applied transfer exercises distinguish thought experiments from unchanged verified evidence', () => {
  const before = [JSON.stringify(baseline),JSON.stringify(returning)];
  for (const item of APPLIED_LESSONS) {
    const question=appliedQuestion(item.caseId==='in-range'?baseline:returning,item.id), app=appliedApplication(item.id,question);
    assert.equal(app.expected,item.id==='fees-over-time'?'same':item.id==='between-samples'?'not-proof':'hold');
    for (const [reason] of item.reasons) for (const [answer] of app.choices) {
      assert.equal(checkAppliedUnderstanding(question,app,reason,answer).passed,reason===question.reason && answer===app.expected);
    }
    assert.equal(checkAppliedUnderstanding(question,app,question.reason,'').passed,false);
    if (item.id==='period-vs-holding') {
      assert.ok(question.view.gapUSD>0); assert.ok(app.gapUSD<0);
      assert.equal(app.lpUSD,question.view.lpUSD-1);
      assert.match(app.context,/hypothetical \$1.00 LP-only cost/);
      assert.match(app.feedback,/historical result itself has not changed/);
    }
  }
  assert.deepEqual([JSON.stringify(baseline),JSON.stringify(returning)],before);
  assert.throws(()=>appliedApplication('unknown',{}));
});
test('choice ordering is reproducible within a draft, varies across seeds and never mutates definitions', () => {
  const choices=[['correct','Correct'],['other','Other'],['third','Third']], before=structuredClone(choices), positions=new Set();
  for (let seed=0;seed<100;seed++) {
    const ordered=orderedLearningChoices(choices,seed,'lesson-reason');
    assert.deepEqual(ordered,orderedLearningChoices(choices,seed,'lesson-reason'));
    assert.deepEqual(ordered.map(([id])=>id).sort(),['correct','other','third']);
    positions.add(ordered.findIndex(([id])=>id==='correct'));
  }
  assert.deepEqual(choices,before); assert.equal(positions.size,3); assert.equal(validChoiceSeed(newChoiceSeed()),true);
  for (const invalid of [null,undefined,-1,2**32,.5,'1',NaN,Infinity]) assert.equal(validChoiceSeed(invalid),false);
});
test('additive draft fields preserve legacy completion and calculations without inventing new answers', () => {
  const old={version:1,completed:['token-balances'],lastLesson:'token-balances',drafts:{'token-balances':{variant:1,inputs:lessonSetup('token-balances',1),prediction:'more',reason:'rebalance',answer:'1.414',ran:true}}};
  const migrated=parseProgress(old), draft=migrated.drafts['token-balances'];
  assert.deepEqual(migrated.completed,old.completed); assert.equal(draft.answer,'1.414'); assert.equal(draft.ran,true);
  assert.equal(draft.application,''); assert.equal(draft.choiceSeed,null);
  draft.application='less'; draft.choiceSeed=4294967295;
  assert.deepEqual(parseProgress(migrated),migrated);
  draft.application='x'.repeat(25); draft.choiceSeed=-1;
  const stripped=parseProgress(migrated).drafts['token-balances']; assert.equal(stripped.application,''); assert.equal(stripped.choiceSeed,null);
  const applied=parseAppliedProgress({version:1,completed:['fees-over-time'],drafts:{'fees-over-time':{prediction:'earned',answer:'2.36',reason:'growth',revealed:true,checkpoint:8}}});
  assert.deepEqual(applied.completed,['fees-over-time']); assert.equal(applied.drafts['fees-over-time'].application,'');
  applied.drafts['fees-over-time'].application='same'; applied.drafts['fees-over-time'].choiceSeed=0;
  assert.deepEqual(parseAppliedProgress(applied),applied);
});
