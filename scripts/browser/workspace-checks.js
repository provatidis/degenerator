import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

export async function checkWorkspaces({evaluate,click,fill,text,navigate,base,downloadFile}) {
  const visible = id => evaluate(`document.getElementById(${JSON.stringify(id)}).getClientRects().length > 0`);
  await navigate(base+'#lp-lab');
  const stored=await evaluate("['defi-sandbox-v1','degenerator-learning-liquidity-v1','degenerator-experiments-v1'].map(key=>localStorage.getItem(key))");
  await fill('scenario-future','3100'); await fill('scenario-fees','75');
  assert.equal(await visible('experiment-workspace'),true);assert.equal(await visible('inspect-workspace'),false);assert.equal(await visible('mechanics-workspace'),false);
  await click('nav-inspect');assert.equal(await visible('inspect-workspace'),true);assert.equal(await visible('experiment-workspace'),false);
  assert.equal(await evaluate("document.getElementById('source-position-tab').getAttribute('aria-selected')"),'true');
  assert.equal(await evaluate("document.getElementById('nav-inspect').getAttribute('aria-current')"),'page');
  await click('nav-experiment');assert.equal(await visible('experiment-workspace'),true);
  assert.equal(await evaluate("document.getElementById('scenario-future').value"),'3100');assert.equal(await evaluate("document.getElementById('scenario-fees').value"),'75');
  await evaluate("document.querySelector('.workspace-links a[href=\"#swap-sandbox\"]').click()");
  assert.equal(await visible('mechanics-workspace'),true);assert.equal(await visible('experiment-workspace'),false);
  await evaluate("document.querySelector('.workspace-back').click()");assert.equal(await visible('experiment-workspace'),true);
  assert.equal(await evaluate("document.getElementById('scenario-future').value"),'3100');
  assert.deepEqual(await evaluate("['defi-sandbox-v1','degenerator-learning-liquidity-v1','degenerator-experiments-v1'].map(key=>localStorage.getItem(key))"),stored);
  await navigate(base+'#example=position-fees');
  await evaluate("new Promise((resolve,reject)=>{const until=Date.now()+10000;const check=()=>{if(document.getElementById('position-fee-walkthrough').open&&document.getElementById('position-lab').getAttribute('aria-busy')==='false')resolve();else if(Date.now()>until)reject(new Error('Recorded handoff timed out'));else setTimeout(check,20)};check()})");
  assert.equal(await visible('inspect-workspace'),true);await click('position-apply');
  assert.equal(await visible('experiment-workspace'),true);assert.equal(await visible('range-lab'),true);
  assert.match(await text('cl-origin'),/1382030/);
  assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
  await navigate(base+'#historical-case');
  await evaluate("new Promise((resolve,reject)=>{const until=Date.now()+10000;const check=()=>{if(!document.getElementById('period-result').hidden)resolve();else if(Date.now()>until)reject(new Error(document.getElementById('period-status').textContent));else setTimeout(check,20)};check()})");
  assert.equal(await visible('replay-workspace'),true);assert.equal(await text('period-range-time'),'100.0%');assert.equal(await text('period-fees'),'$2.36');
  await fill('period-checkpoint','0');assert.equal(await text('period-fees'),'$0.00');assert.equal(await text('period-lp'),await text('period-hold'));
  await fill('period-checkpoint','8');
  const exported=JSON.parse(await readFile(await downloadFile('period-export'),'utf8'));
  assert.equal(exported.points.length,9);assert.deepEqual(exported.validation.earnedRaw,['112674','896672855663157']);
  await click('period-apply');assert.equal(await visible('range-lab'),true);assert.match(await text('cl-origin'),/26168941/);
  assert.equal(await evaluate("document.getElementById('cl-fees').value"),'0');
  await navigate(base);
  console.log('PASS: focused workspaces, unchanged drafts/storage, direct links and recorded position handoff');
}
