import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const { version } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const { MANAGEMENT_IDS, MANAGEMENT_VARIANTS, managementCase, checkManagementUnderstanding } = await import('../public/models/range-decisions.js?v=' + version);
import { MANAGEMENT_LESSONS, managementPresentation, managementApplication } from '../public/learning/choosing-ranges.js';
import { managementLessonFromHash } from '../public/lib/management-links.js';
import { MANAGEMENT_KEY, emptyManagementProgress, parseManagementProgress, readManagementProgress, saveManagementProgress } from '../public/data/management-progress.js';
import { POOL_PITFALLS } from '../public/learning/pool-pitfalls.js';
import { LESSONS } from '../public/learning/liquidity-essentials.js';
import { APPLIED_LESSONS } from '../public/learning/applied-liquidity.js';
import { LESSON_IDS } from '../public/models/lesson-experiments.js';
import { APPLIED_IDS } from '../public/lib/applied-lessons.js';
import { rangeFromHash, rangeHash } from '../public/lib/range-links.js';

test('range widths use the same budget and price but each range’s own funding and holding basket',()=>{
  for(let variant=0;variant<3;variant++){
    const result=managementCase('range-width',variant);
    assert.equal(result.narrow.investment,result.wide.investment);assert.equal(result.narrow.initialPrice,2000);
    assert.equal(result.narrow.futurePrice,result.wide.futurePrice);
    assert.ok(result.narrow.liquidity>result.wide.liquidity);
    assert.notDeepEqual(result.narrow.initial,result.wide.initial);
    assert.equal(result.narrow.holdValue,result.narrow.initial.eth*result.price+result.narrow.initial.usdc);
    assert.equal(result.wide.state,'inside');assert.equal(result.prediction,variant===2?'both':'wide');
    assert.equal(result.narrow.state,['above','below','inside'][variant]);
    if(variant===2)assert.match(managementPresentation(result).reasoning,/Both are active/);
    assert.equal(result.application,['unknown','narrow','wide'][variant]);
    if(result.comparison){
      assert.equal(result.comparison.narrow,result.narrow.lpBeforeFees+result.comparison.fees[0]-result.comparison.costs[0]);
      assert.equal(result.comparison.wide,result.wide.lpBeforeFees+result.comparison.fees[1]-result.comparison.costs[1]);
      assert.equal(result.comparison.narrow>result.comparison.wide,variant===1);
    }
    for(const {scenario} of managementPresentation(result).links){
      const restored=rangeFromHash(rangeHash(scenario));assert.equal(restored.futurePrice,result.price);assert.equal(restored.fees,0);assert.equal(restored.fullRangeFees,0);
    }
  }
});
test('fee tiers alone never establish earnings, including supplied totals that reverse the tier ranking',()=>{
  assert.equal(managementCase('fee-tiers',0).fees,null);
  for(let variant=0;variant<3;variant++){
    const result=managementCase('fee-tiers',variant),presentation=managementPresentation(result);
    assert.equal(result.prediction,'unknown');assert.equal(result.application,['no','a','b'][variant]);
    assert.match(presentation.note,/supplied teaching facts/);assert.equal(presentation.links.length,0);
    if(variant===1)assert.ok(result.fees[0]>result.fees[1]&&result.rates[0]<result.rates[1]);
    if(variant===2){assert.ok(result.fees[0]>result.fees[1]);assert.ok(result.totals[0]<result.totals[1]);}
  }
});
test('an unchanged outside position retains its tokens and returns to activity without a new deposit',()=>{
  for(let variant=0;variant<3;variant++){
    const result=managementCase('range-management',variant);
    assert.equal(result.first.liquidity,result.second.liquidity);assert.equal(result.second.liquidity,result.returned.liquidity);
    assert.deepEqual(result.first.pooled,result.second.pooled);
    assert.equal(result.returned.state,'inside');assert.deepEqual(result.returned.pooled,result.returned.initial);
    assert.equal(result.prediction,['falls','same','rises'][variant]);assert.equal(result.application,variant===1?'removed':'automatic');
    if(variant===1){assert.equal(result.second.pooled.eth,0);assert.equal(result.second.lpBeforeFees,result.first.lpBeforeFees);}
    else{assert.equal(result.second.pooled.usdc,0);assert.equal(result.second.lpBeforeFees,result.second.pooled.eth*result.prices[1]);}
  }
});
test('every situation has one supported explanation and transfer answer, independent of its prediction',()=>{
  assert.deepEqual(MANAGEMENT_LESSONS.map(item=>item.id),MANAGEMENT_IDS);
  for(const lesson of MANAGEMENT_LESSONS)for(let variant=0;variant<MANAGEMENT_VARIANTS;variant++){
    const result=managementCase(lesson.id,variant),presentation=managementPresentation(result),transfer=managementApplication(result);
    assert.equal(presentation.predictions.filter(([id])=>id===result.prediction).length,1);
    assert.equal(lesson.reasons.filter(([id])=>id===result.reason).length,1);
    assert.equal(transfer.choices.filter(([id])=>id===result.application).length,1);
    for(const [reason]of lesson.reasons)for(const [application]of transfer.choices){
      assert.equal(checkManagementUnderstanding(lesson.id,variant,reason,application).passed,reason===result.reason&&application===result.application);
      if(reason!==result.reason)assert.ok(lesson.reasonFeedback[reason]);
    }
    assert.equal(checkManagementUnderstanding(lesson.id,variant,'',result.application).passed,false);
    assert.equal(checkManagementUnderstanding(lesson.id,variant,result.reason,'').passed,false);
    assert.equal(checkManagementUnderstanding(lesson.id,variant,'unknown','unknown').passed,false);
    assert.doesNotMatch(JSON.stringify(presentation),/NaN|undefined|Infinity/);
    assert.ok(transfer.context&&transfer.question&&transfer.hint&&transfer.feedback);
    assert.ok(lesson.deeper.length>=2&&lesson.sources.every(source=>new URL(source.url).protocol==='https:'));
  }
  for(const id of ['unknown',null])assert.throws(()=>managementCase(id));
  for(const variant of [-1,3,.5,'0',NaN])assert.throws(()=>managementCase('range-width',variant));
});
test('management routes reject duplicates and mixed chapter fragments without hijacking older lessons',()=>{
  for(const id of MANAGEMENT_IDS)assert.equal(managementLessonFromHash('#manage='+id),id);
  for(const hash of ['','#lesson=range-boundaries','#applied=fees-over-time','#manage=unknown','#manage=range-width&manage=range-width','#manage=fee-tiers&lesson=pool-share','#manage=range-width&applied=fees-over-time','#manage=range-width&extra=x'])assert.equal(managementLessonFromHash(hash),null);
});
test('new progress is bounded and independent of existing work, including blocked or damaged storage',()=>{
  const value={version:1,completed:['range-width','range-width','unknown'],drafts:{'range-width':{variant:2,prediction:'both',reason:'bounds',application:'unknown',revealed:true,choiceSeed:0,answer:999},'fee-tiers':{variant:1,prediction:'x'.repeat(25),reason:null,choiceSeed:-1},'range-management':{variant:99}}};
  const clean=parseManagementProgress(value);assert.deepEqual(clean.completed,['range-width']);
  assert.equal(clean.drafts['range-width'].choiceSeed,0);assert.equal(clean.drafts['range-width'].application,'unknown');assert.equal(clean.drafts['range-width'].answer,undefined);
  assert.equal(clean.drafts['fee-tiers'].prediction,'');assert.equal(clean.drafts['fee-tiers'].choiceSeed,null);assert.equal(clean.drafts['range-management'],undefined);
  assert.deepEqual(parseManagementProgress({version:2}),emptyManagementProgress());
  const map=new Map([['degenerator-learning-liquidity-v1','old essentials'],['passiko-applied-liquidity-v1','old history'],['defi-sandbox-v1','old balances']]);
  const storage={getItem:key=>map.get(key)||null,setItem:(key,value)=>map.set(key,value)};
  assert.equal(saveManagementProgress(value,()=>storage),true);assert.deepEqual(readManagementProgress(()=>storage).progress,clean);
  assert.equal(map.get('defi-sandbox-v1'),'old balances');assert.equal(map.get('degenerator-learning-liquidity-v1'),'old essentials');assert.equal(map.get('passiko-applied-liquidity-v1'),'old history');assert.ok(map.has(MANAGEMENT_KEY));
  assert.equal(readManagementProgress(()=>{throw Error('Blocked');}).available,false);assert.equal(saveManagementProgress(value,()=>({setItem(){throw Error('Full');}})),false);
  assert.deepEqual(readManagementProgress(()=>({getItem:()=>'{bad'})).progress,emptyManagementProgress());
});
test('every existing subject has a plain visible pitfall, and the fee-target question has a clear scope',async()=>{
  assert.deepEqual(Object.keys(POOL_PITFALLS),[...LESSON_IDS,...APPLIED_IDS]);
  for(const entry of Object.values(POOL_PITFALLS)){assert.ok(entry.title&&entry.copy);assert.equal(new URL(entry.url).protocol,'https:');assert.doesNotMatch(entry.copy,/÷|×|√/);}
  assert.match(POOL_PITFALLS['swap-impact'].copy,/slippage limit/);assert.match(POOL_PITFALLS['loss-vs-profit'].copy,/before withdrawal/);
  assert.match(POOL_PITFALLS['range-boundaries'].copy,/value can keep falling/);assert.match(POOL_PITFALLS['between-samples'].copy,/require trades/);
  assert.match(LESSONS.find(item=>item.id==='fee-break-even').reasoning,/break-even fee target/);
  assert.doesNotMatch(LESSONS.find(item=>item.id==='pool-share').prediction,/÷|×|percent|divide/);
  for(const lesson of [...LESSONS,...APPLIED_LESSONS]){
    const counts=lesson.reasons.map(([,copy])=>copy.split(/\s+/).length);
    assert.ok(Math.max(...counts)-Math.min(...counts)<=7,lesson.id+': answer length should not give away the correct choice');
  }
  const html=await readFile(new URL('../public/learn.html',import.meta.url),'utf8');
  assert.match(html,/id="learn-pitfall"/);assert.match(html,/id="applied-pitfall"/);
  assert.doesNotMatch(html.slice(html.indexOf('<article id="learn-management"'),html.indexOf('<article id="learn-applied"')),/type="number"/);
});
