import assert from 'node:assert/strict';

export async function checkManagementLearning({evaluate,click,text,navigate,reload,base}) {
  const keys=['degenerator-learning-liquidity-v1','passiko-applied-liquidity-v1','defi-sandbox-v1','degenerator-pool-snapshot-v1','degenerator-v3-position-snapshot-v1','degenerator-experiments-v1'];
  const before=await evaluate('JSON.stringify('+JSON.stringify(keys)+'.map(key=>localStorage.getItem(key)))');
  const choose=(name,value)=>evaluate(`document.querySelector('input[name="${name}"][value="${value}"]').click()`);
  const cases=[['range-width','none','bounds','unknown'],['fee-tiers','b','trades','no'],['range-management','same','asset','automatic']];
  for(const [id,prediction,reason,application]of cases) {
    await navigate(base+'learn.html#manage='+id);
    assert.equal(await evaluate("document.getElementById('learn-essential').hidden&&document.getElementById('learn-applied').hidden&&!document.getElementById('learn-management').hidden"),true);
    assert.equal(await evaluate("document.querySelectorAll('[data-lesson-id][aria-current=step],[data-applied-id][aria-current=step]').length"),0);
    assert.equal(await evaluate("document.querySelector('[data-management-id="+id+"]').getAttribute('aria-current')"),'step');
    assert.equal(await evaluate("document.getElementById('manage-reveal').disabled"),true);
    assert.equal(await evaluate("document.querySelectorAll('#learn-management input[type=number]').length"),0);
    await choose('manage-prediction',prediction);await click('manage-reveal');
    assert.equal(await evaluate("document.getElementById('manage-observe').hidden"),false);
    assert.match(await text('manage-prediction-feedback'),/differs from your prediction/);
    assert.equal(await evaluate("document.getElementById('manage-observe-title').getBoundingClientRect().top>=document.querySelector('.topbar').getBoundingClientRect().bottom"),true);
    if(id==='range-width')assert.match(await text('manage-metrics'),/Narrow range Inactive.*Wider range Active/s);
    if(id==='fee-tiers')assert.match(await text('manage-metrics'),/Unknown/);
    if(id==='range-management')assert.match(await text('manage-pitfall'),/does not refund earlier losses/);
    await choose('manage-reason',id==='range-width'?'budget':id==='fee-tiers'?'clock':'liquidated');await choose('manage-application',application);await click('manage-check');
    assert.equal(await text('manage-feedback-title'),'Review your answers.');
    assert.equal(await evaluate("document.getElementById('manage-continue').hidden"),true);
    await choose('manage-reason',reason);await choose('manage-application',id==='range-width'?'narrow':id==='fee-tiers'?'yes':'refund');await click('manage-check');
    assert.equal(await text('manage-feedback-title'),'Review your answers.');
    await choose('manage-application',application);await click('manage-check');
    assert.equal(await text('manage-feedback-title'),'Both answers are correct.');
    const saved=await evaluate("localStorage.getItem('passiko-range-learning-v1')");
    const order=await evaluate("Array.from(document.querySelectorAll('input[name=manage-reason],input[name=manage-application]')).map(input=>input.value).join(',')");
    await evaluate("document.querySelector('#manage-deeper summary').click()");
    assert.equal(await evaluate("localStorage.getItem('passiko-range-learning-v1')"),saved,'Reading cannot change answers or completion.');
    assert.equal(await evaluate("Array.from(document.querySelectorAll('#manage-sources a')).every(a=>a.href.startsWith('https:')&&a.target==='_blank'&&a.rel.includes('noopener'))"),true);
    for(const href of await evaluate("Array.from(document.querySelectorAll('#manage-handoffs a')).map(a=>a.href)")) {
      const params=new URLSearchParams(new URL(href).hash.slice(1));assert.equal(params.get('scenario'),'cl-range-v1');assert.equal(params.get('fees'),'0');assert.equal(params.get('fullfees'),'0');assert.equal(params.get('start'),'2000');
    }
    await reload();assert.equal(await text('manage-feedback-title'),'Both answers are correct.');
    assert.equal(await evaluate("Array.from(document.querySelectorAll('input[name=manage-reason],input[name=manage-application]')).map(input=>input.value).join(',')"),order);
    await evaluate("document.querySelector('[data-management-id="+id+"]').click()");
    assert.equal(await evaluate("document.getElementById('manage-title').getBoundingClientRect().top>=document.querySelector('.topbar').getBoundingClientRect().bottom"),true);
    for(let variant=1;variant<3;variant++) {
      await click('manage-variation');assert.equal(await text('manage-variation-label'),'Situation '+(variant+1)+' of 3');
      assert.equal(await evaluate("document.getElementById('manage-reveal').disabled"),true);assert.equal(await evaluate("document.getElementById('manage-observe').hidden"),true);
      await choose('manage-prediction',id==='range-width'?(variant===2?'both':'wide'):id==='fee-tiers'?'unknown':variant===1?'same':'rises');await click('manage-reveal');
      await choose('manage-reason',reason);await choose('manage-application',application);await click('manage-check');assert.equal(await text('manage-feedback-title'),'Both answers are correct.');
      if(id==='range-width'&&variant===2)assert.match(await text('manage-metrics'),/Narrow range Active.*Wider range Active/s);
      if(id==='fee-tiers')assert.match(await text('manage-metrics'),variant===1?/Position A fees \$12.00.*Position B fees \$4.00/s:/Position A fees \$4.00.*Position B fees \$12.00/s);
      if(id==='range-management'&&variant===1)assert.match(await text('manage-metrics'),/USDC/);
    }
  }
  assert.equal(await text('manage-progress-count'),'3 of 3 checked');assert.equal(await evaluate("document.getElementById('manage-next').hash"),'#applied=fees-over-time');
  assert.equal(await evaluate('JSON.stringify('+JSON.stringify(keys)+'.map(key=>localStorage.getItem(key)))'),before,'Range lessons preserve all older progress and saved work.');
  const saved=await evaluate("localStorage.getItem('passiko-range-learning-v1')");
  await evaluate("Storage.prototype.setItem=function(){throw new DOMException('Full','QuotaExceededError')}");await click('manage-variation');
  await choose('manage-prediction','falls');await click('manage-reveal');assert.match(await text('learn-storage'),/Saving is unavailable/);
  assert.equal(await evaluate("localStorage.getItem('passiko-range-learning-v1')"),saved);
  await navigate(base+'learn.html#manage=fee-tiers&applied=fees-over-time');
  assert.equal(await evaluate("document.getElementById('learn-management').hidden&&document.getElementById('learn-applied').hidden&&!document.getElementById('learn-essential').hidden"),true);
  assert.equal(await evaluate("document.getElementById('learn-route-note').hidden"),false);
  await navigate(base);
  console.log('PASS: practical range chapter, three situations per topic, conceptual-only completion, incorrect prediction, corrective feedback, versioned routes, source links, model handoffs, stable restoration and independent/full storage');
}
export async function checkMobileManagementLearning({evaluate,click,text,navigate,base,call}) {
  for(const width of [390,320]) {
    await call('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:true});
    await navigate(base+'learn.html#manage=range-width');
    assert.equal(await evaluate("document.getElementById('learn-course').open"),false);
    await evaluate("document.querySelector('input[name=manage-prediction][value=wide]').click()");await click('manage-reveal');
    await evaluate("document.querySelector('input[name=manage-reason][value=bounds]').click();document.querySelector('input[name=manage-application][value=unknown]').click()");await click('manage-check');
    assert.equal(await text('manage-feedback-title'),'Both answers are correct.');assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
    await click('manage-topics');await evaluate("document.querySelector('[data-management-id=fee-tiers]').click()");
    assert.equal(await evaluate("document.getElementById('learn-course').open"),false);assert.equal(await text('manage-title'),'A higher fee rate is not a higher return');
    assert.equal(await evaluate("document.getElementById('manage-title').getBoundingClientRect().top>=document.querySelector('.topbar').getBoundingClientRect().bottom"),true);
    await click('learn-resume');assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
    await click('manage-topics');
    await evaluate("document.querySelector('[data-applied-id=fees-over-time]').click()");
    assert.equal(await evaluate("document.getElementById('learn-management').hidden&&!document.getElementById('learn-applied').hidden"),true);
    await evaluate("document.querySelector('.learn-entry-links a[href=\"#lesson=swap-impact\"]').click()");
    assert.equal(await evaluate("document.getElementById('learn-management').hidden&&!document.getElementById('learn-essential').hidden"),true);
  }
  await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await navigate(base);
  console.log('PASS: practical range entry, assessment, chapter switching, resume, sticky headings and no overflow at 390px/320px');
}
