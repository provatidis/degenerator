import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const legacy = await readFile(new URL('./fixtures/lesson-experiments-1.12.0.js', import.meta.url), 'utf8');
const { version } = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8'));

export async function checkLessonConsistency({ evaluate, click, fill, text, navigate, base, call, nextEvent }) {
  const choose = (name, value) => evaluate(`document.querySelector('input[name="${name}"][value="${value}"]').click()`);
  // Retain the previous unversioned model for progress validation, while the UI must
  // use the current versioned grading model and current teaching text.
  await call('Fetch.enable', {patterns:[{urlPattern:'*/models/lesson-experiments.js',resourceType:'Script'}]});
  try {
    const paused = nextEvent('Fetch.requestPaused'), opening = navigate(base + 'learn.html#lesson=token-balances');
    const request = await paused;
    await call('Fetch.fulfillRequest', {requestId:request.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'text/javascript'},{name:'Cache-Control',value:'no-store'}],body:Buffer.from(legacy).toString('base64')});
    await opening;
    await choose('learn-prediction','less'); await click('learn-run');
    await fill('learn-answer','.883'); await choose('learn-reason','rebalance'); await click('learn-check');
    assert.equal(await text('learn-feedback-title'),'Review your answers.','Previous broad tolerances cannot grade the new UI.');
    const entries = await evaluate("performance.getEntriesByType('resource').map(entry=>entry.name)");
    for (const path of ['models/lesson-experiments.js','models/learning-answer.js','learning/liquidity-essentials.js','lib/lesson-narration.js']) {
      assert.ok(entries.some(url=>url.endsWith('/' + path + '?v=' + version)), path + ' must load its current release.');
    }
  } finally { await call('Fetch.disable'); }
  for (const [price, prediction, answer, direction] of [['4000','less','.884','less ETH and more USDC'],['1000','more','1.768','more ETH and less USDC'],['2000','same','1.25','both token quantities stay the same']]) {
    await navigate(base + 'learn.html#lesson=token-balances');
    await fill('learn-input-futurePrice',price); await choose('learn-prediction',prediction); await click('learn-run');
    assert.ok((await text('learn-explanation')).includes(direction));
    await fill('learn-answer',answer); await choose('learn-reason','mint'); await click('learn-check');
    assert.equal(await text('learn-feedback-title'),'Review your answers.');
    assert.match(await text('learn-feedback-copy'),/does not create ETH or USDC/);
    assert.ok((await text('learn-feedback-copy')).includes(direction));
    assert.equal(await evaluate("document.getElementById('learn-continue').hidden"),true);
    if (price === '2000') {
      assert.match(await text('learn-reason-question'),/stay the same/);
      assert.match(await text('learn-reasons'),/no price change/);
    }
    await choose('learn-reason','rebalance'); await click('learn-check');
    assert.equal(await text('learn-feedback-title'),'Both answers are correct.');
  }
  await navigate(base + 'learn.html#lesson=fee-break-even');
  await fill('learn-input-futurePrice','4000'); await fill('learn-input-fees','100'); await choose('learn-prediction','short'); await click('learn-run');
  assert.match(await text('learn-explanation'),/total fee target is \$428.93[\s\S]*\$328.93 additional/);
  await fill('learn-answer','428.94'); await choose('learn-reason','assumption'); await click('learn-check');
  assert.equal(await text('learn-feedback-title'),'Review your answers.');
  await fill('learn-answer','428.93'); await click('learn-check'); assert.equal(await text('learn-feedback-title'),'Both answers are correct.');
  await navigate(base + 'learn.html#lesson=range-boundaries');
  await choose('learn-prediction','usdc'); await click('learn-run'); await fill('learn-answer','.04'); await choose('learn-reason','path'); await click('learn-check');
  assert.equal(await text('learn-feedback-title'),'Review your answers.');
  await fill('learn-answer','0'); await click('learn-check'); assert.equal(await text('learn-feedback-title'),'Both answers are correct.');
  await navigate(base + 'learn.html#applied=period-vs-holding');
  await evaluate("new Promise(resolve=>{const check=()=>document.getElementById('learn-applied').getAttribute('aria-busy')==='false'?resolve():setTimeout(check,25);check()})");
  await choose('applied-prediction','lp'); await click('applied-reveal'); await fill('applied-checkpoint','8');
  assert.match(await text('applied-metrics'),/−\$0.01/);
  assert.match(await text('applied-explanation'),/At the final question checkpoint[\s\S]*Other checkpoints can have a different result/);
  assert.match(await text('applied-prediction-feedback'),/marked question checkpoint or interval/);
  await fill('applied-answer','0.17'); await choose('applied-reason','income'); await click('applied-check');
  assert.match(await text('applied-feedback-copy'),/Fees can be smaller/);
  assert.equal(await text('applied-feedback-title'),'Review your answers.');
  await navigate(base);
  console.log('PASS: lesson direction, unchanged-price reasoning, misconception feedback, rounding, historical question scope and previous cached model compatibility');
}

export async function checkMobileLessonConsistency({ evaluate, click, fill, text, navigate, base, call }) {
  for (const width of [390,320]) {
    await call('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:true});
    await navigate(base + 'learn.html#lesson=token-balances');
    await fill('learn-input-futurePrice','4000');
    await evaluate("document.querySelector('input[name=learn-prediction][value=less]').click()"); await click('learn-run');
    await fill('learn-answer','.884'); await evaluate("document.querySelector('input[name=learn-reason][value=mint]').click()"); await click('learn-check');
    assert.match(await text('learn-feedback-copy'),/less ETH and more USDC/);
    assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
  }
  await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await navigate(base);
  console.log('PASS: mobile lesson explanations and corrective feedback at 390px/320px');
}
