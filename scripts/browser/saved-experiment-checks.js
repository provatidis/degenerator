import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const key = 'degenerator-experiments-v1';
const waitFor = (evaluate, condition) => evaluate('new Promise((resolve,reject)=>{const end=Date.now()+10000;const check=()=>{if('+condition+')resolve();else if(Date.now()>end)reject(new Error("Experiment check timed out"));else setTimeout(check,20)};check()})');
export async function checkSavedExperiments({ evaluate, click, fill, text, navigate, reload, downloadFile, call, base, profile }) {
  const keys=[key,'defi-sandbox-v1','degenerator-learning-liquidity-v1','degenerator-pool-snapshot-v1','degenerator-v3-position-snapshot-v1'];
  const previous=await evaluate(JSON.stringify(keys)+'.map(key=>localStorage.getItem(key))');
  const library=()=>evaluate('JSON.parse(localStorage.getItem('+JSON.stringify(key)+'))');
  const cards=()=>evaluate("document.querySelectorAll('#experiments-list > li').length");
  const action=(id,label)=>evaluate('Array.from(document.querySelector('+JSON.stringify('[data-experiment-id="'+id+'"]')+').querySelectorAll("button")).find(button=>button.textContent==='+JSON.stringify(label)+').click()');
  const select=id=>evaluate('document.querySelector('+JSON.stringify('[data-compare-id="'+id+'"]')+').click()');
  async function importFile(path) {
    const doc=await call('DOM.getDocument');
    const input=await call('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'#experiments-file'});
    await call('DOM.setFileInputFiles',{nodeId:input.nodeId,files:[path]});
    await waitFor(evaluate,"document.getElementById('experiments-status').textContent.includes('Imported')||document.getElementById('experiments-status').textContent.includes('already')||document.getElementById('experiments-status').dataset.error==='true'");
  }
  async function save(button,name,notes='') {
    await click(button); assert.equal(await evaluate("document.getElementById('experiment-dialog').open"),true);
    await fill('experiment-name',name);await fill('experiment-notes',notes);await click('experiment-save-confirm');
    assert.equal(await evaluate("document.getElementById('experiment-dialog').open"),false);
  }
  await evaluate('localStorage.removeItem('+JSON.stringify(key)+')');
  await navigate(base+'#lp-lab');
  assert.equal(await text('experiments-count'),'0 saved');
  await fill('scenario-investment','');assert.equal(await evaluate("document.getElementById('scenario-save').disabled"),true);
  await fill('scenario-investment','5000');await fill('scenario-fees','0');
  await click('scenario-save');await fill('experiment-name','   ');await click('experiment-save-confirm');
  assert.match(await text('experiment-dialog-error'),/name/);assert.equal((await library()),null);
  await click('experiment-save-cancel');await waitFor(evaluate,"document.activeElement.id==='scenario-save'");assert.equal(await evaluate('document.activeElement.id'),'scenario-save');
  await save('scenario-save','Price doubles · no fees','Baseline\nSame starting tokens.');
  const baseline=(await library()).experiments[0];assert.equal(baseline.inputs.fees,0);
  await fill('scenario-fees','500');await save('scenario-save','Price doubles · assumed fees','An assumption, not a yield forecast.');
  const fees=(await library()).experiments[0];
  await navigate(base+'#saved-experiments');assert.equal(await cards(),2);
  assert.deepEqual((await library()).experiments.map(entry=>entry.inputs.fees),[500,0]);
  await select(baseline.id);await select(fees.id);await click('experiments-compare');
  assert.match(await text('experiments-comparison-context'),/share the same starting token basket/);
  assert.match(await text('experiments-comparison-cards'),/7,571.07[\s\S]*7,500.00/);
  assert.equal(await evaluate("document.querySelectorAll('#experiments-comparison-cards article').length"),2);
  await fill('experiments-search','Baseline');assert.equal(await cards(),1,'Search includes notes.');
  assert.match(await text('experiments-selection'),/2 of 3 selected/);
  await fill('experiments-search','');
  await action(baseline.id,'Edit name / notes');await fill('experiment-name','Δοκιμή <img src=x onerror=alert(1)>');await fill('experiment-notes','Updated reasoning\nStill no fees.');await click('experiment-save-confirm');
  const renamed=(await library()).experiments.find(entry=>entry.id===baseline.id);
  assert.deepEqual(renamed.inputs,baseline.inputs);
  assert.equal(await evaluate("document.querySelectorAll('#experiments-list img').length"),0,'Saved text is never interpreted as HTML.');
  await action(baseline.id,'Open in lab');assert.equal(await text('scenario-lp-value'),'$7,071.07');
  await fill('scenario-future','1000');assert.deepEqual((await library()).experiments.find(entry=>entry.id===baseline.id),renamed,'Working-copy edits do not rewrite a saved experiment.');

  // Retain exact NFT context while future prices and fee assumptions remain editable.
  await click('source-position-tab');await click('position-example-fees');
  await waitFor(evaluate,"document.getElementById('position-lab').getAttribute('aria-busy')==='false'&&document.getElementById('position-status').textContent.includes('Position saved')");
  await click('position-apply');await fill('cl-future','2800');await fill('cl-fees','20');await fill('cl-full-fees','7');
  await save('cl-save','Recorded range · rally','Principal-only future comparison.');
  const position=(await library()).experiments[0];
  assert.equal(position.origin.snapshot.block.number,'26168941');
  assert.equal(position.origin.snapshot.fees.collectable0Raw,'524593');
  assert.equal(position.inputs.fees,20);assert.equal(position.inputs.fullRangeFees,7);
  await fill('cl-lower','2400');await save('cl-save','Edited bounds');
  assert.equal((await library()).experiments[0].origin,null,'Editing imported bounds removes source attribution.');
  await navigate(base+'#saved-experiments');
  await action(position.id,'Open in lab');assert.match(await text('cl-origin'),/26168941/);
  assert.equal(await evaluate("document.getElementById('cl-fees').value"),'20');
  assert.equal(await evaluate("document.getElementById('cl-full-fees').value"),'7');
  await navigate(base+'#saved-experiments');
  await select(fees.id);await select(position.id);await click('experiments-compare');
  assert.match(await text('experiments-comparison-context'),/different budgets, prices or token mixes/);
  await select(baseline.id);
  assert.equal(await evaluate("Array.from(document.querySelectorAll('[data-compare-id]')).filter(input=>!input.checked).every(input=>input.disabled)"),true,'Comparison selection is limited to three.');
  await click('experiments-clear-selection');
  await fill('experiments-model','cl-range-v1');await evaluate("document.getElementById('experiments-model').dispatchEvent(new Event('change'))");assert.equal(await cards(),2);
  await fill('experiments-model','all');await evaluate("document.getElementById('experiments-model').dispatchEvent(new Event('change'))");
  const exported=await downloadFile('experiments-export'), beforeImport=await library();
  assert.deepEqual(JSON.parse(await readFile(exported,'utf8')),beforeImport);
  await importFile(exported);assert.deepEqual(await library(),beforeImport);
  const conflictPath=join(profile,'conflicting-experiment.json');
  await writeFile(conflictPath,JSON.stringify({version:1,kind:'degenerator-experiments',experiments:[{...fees,name:'Imported variation',inputs:{...fees.inputs,fees:600}}]}));
  await importFile(conflictPath);assert.equal((await library()).experiments.length,5);
  assert.equal((await library()).experiments.find(entry=>entry.id===fees.id).inputs.fees,500);
  const badPath=join(profile,'unknown-experiment-version.json');await writeFile(badPath,JSON.stringify({...beforeImport,version:99}));
  const good=await library();await importFile(badPath);assert.deepEqual(await library(),good);assert.match(await text('experiments-status'),/unsupported version/);
  await action(fees.id,'Remove');assert.equal((await library()).experiments.length,4);
  await click('experiments-undo');assert.equal((await library()).experiments.length,5);
  await reload();assert.equal(await cards(),5);
  assert.equal(await evaluate("localStorage.getItem('defi-sandbox-v1')"),previous[1]);
  assert.equal(await evaluate("localStorage.getItem('degenerator-learning-liquidity-v1')"),previous[2]);

  // Quota failures keep changes in memory, explicitly marked, without claiming durable saving.
  const durable=await library();
  await evaluate("(()=>{const original=Storage.prototype.setItem;window.restoreExperimentStorage=()=>Storage.prototype.setItem=original;Storage.prototype.setItem=function(key,value){if(key==='degenerator-experiments-v1')throw new DOMException('Full','QuotaExceededError');return original.call(this,key,value)}})()");
  await click('lab-full-tab');await save('scenario-save','Temporary experiment');
  assert.match(await text('scenario-save-status'),/this tab only/);
  assert.deepEqual(await library(),durable);assert.match(await text('experiments-storage'),/unavailable/);
  await evaluate('window.restoreExperimentStorage()');await reload();assert.equal(await cards(),5);
  await evaluate('localStorage.setItem('+JSON.stringify(key)+',"{")');await reload();
  assert.equal(await evaluate("document.getElementById('experiments-recovery').hidden"),false);
  assert.equal(await evaluate('localStorage.getItem('+JSON.stringify(key)+')'),'{');
  await click('experiments-discard');assert.equal(await evaluate('localStorage.getItem('+JSON.stringify(key)+')'),null);
  assert.equal(await evaluate("localStorage.getItem('defi-sandbox-v1')"),previous[1]);
  assert.equal(await evaluate("localStorage.getItem('degenerator-learning-liquidity-v1')"),previous[2]);
  for(const[index,name]of keys.entries())await evaluate(previous[index]===null?'localStorage.removeItem('+JSON.stringify(name)+')':'localStorage.setItem('+JSON.stringify(name)+','+JSON.stringify(previous[index])+')');
  await navigate(base);
  console.log('PASS: named experiments, notes, immutable working copies, exact source context, comparison fairness, selection cap, safe text, search, export/import conflict preservation, undo, quota and scoped recovery');
}

export async function checkMobileSavedExperiments({ evaluate, click, fill, text, navigate, base, call }) {
  await navigate(base+'#lp-lab');
  await click('scenario-save');assert.equal(await evaluate("document.getElementById('experiment-dialog').open"),true);
  assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
  await fill('experiment-name','Mobile setup');await fill('experiment-notes','A note saved from a small screen.');await click('experiment-save-confirm');
  assert.match(await text('scenario-save-status'),/Saved/);
  await fill('scenario-fees','500');await click('scenario-save');await fill('experiment-name','Mobile fee variation');await click('experiment-save-confirm');
  await navigate(base+'#saved-experiments');
  assert.equal(await evaluate("document.getElementById('saved-experiments').open"),true);
  assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
  await evaluate("document.querySelectorAll('[data-compare-id]').forEach(input=>input.click())");await click('experiments-compare');
  assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
  assert.equal(await evaluate("document.querySelectorAll('#experiments-comparison-cards article').length"),2);
  await evaluate("document.querySelector('#experiments-list button').click()");
  assert.equal(await evaluate("document.getElementById('lab-full-tab').getAttribute('aria-selected')"),'true');
  await click('scenario-save');await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27,nativeVirtualKeyCode:27});await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27,nativeVirtualKeyCode:27});
  await waitFor(evaluate,"!document.getElementById('experiment-dialog').open&&document.activeElement.id==='scenario-save'");
  assert.equal(await evaluate("document.getElementById('experiment-dialog').open"),false);
  assert.equal(await evaluate('document.activeElement.id'),'scenario-save');
  await navigate(base);
  console.log('PASS: mobile named saving, notes, library navigation, working-copy reopening and dialog layout');
}
