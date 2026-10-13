import assert from 'node:assert/strict';

export async function checkAppliedLearning({ evaluate, click, fill, text, navigate, reload, base, call, nextEvent }) {
  const existingKeys = ['degenerator-learning-liquidity-v1', 'defi-sandbox-v1', 'degenerator-pool-snapshot-v1', 'degenerator-v3-position-snapshot-v1'];
  const before = await evaluate('JSON.stringify(' + JSON.stringify(existingKeys) + '.map(key=>localStorage.getItem(key)))');
  const choose = (name, value) => evaluate(`document.querySelector('input[name="${name}"][value="${value}"]').click()`);
  const ready = () => evaluate("new Promise((resolve,reject)=>{const end=Date.now()+5000;const check=()=>{if(document.getElementById('learn-applied').getAttribute('aria-busy')==='false')resolve();else if(Date.now()>end)reject(new Error('Applied record did not load'));else setTimeout(check,25)};check()})");
  const cases = [['fees-over-time', 'earned', '2.36', 'growth', 'in-range', 'same'], ['between-samples', 'possible', '2724', 'counters', 'range-return', 'not-proof'], ['period-vs-holding', 'lp', '0.17', 'basket', 'range-return', 'hold']];
  for (const [id, prediction, answer, reason, record, application] of cases) {
    await navigate(base + 'learn.html#applied=' + id); await ready();
    assert.equal(await evaluate("document.getElementById('learn-essential').hidden"), true);
    assert.equal(await evaluate("document.getElementById('learn-applied').hidden"), false);
    assert.equal(await evaluate("document.querySelector('[data-applied-id=" + id + "]').getAttribute('aria-current')"), 'step');
    assert.equal(await evaluate("document.querySelectorAll('[data-lesson-id][aria-current=step]').length"), 0);
    assert.equal(await evaluate("document.getElementById('learn-route-note').hidden"), true);
    assert.equal(await evaluate("document.getElementById('applied-reveal').disabled"), true);
    await choose('applied-prediction', prediction); await click('applied-reveal');
    assert.equal(await evaluate("document.getElementById('applied-observe').hidden"), false);
    assert.equal(await evaluate("document.getElementById('applied-assessment').hidden"), false);
    assert.equal(await evaluate("document.getElementById('applied-observe-title').getBoundingClientRect().top >= document.querySelector('.topbar').getBoundingClientRect().bottom"), true);
    if (id === 'fees-over-time') assert.match(await text('applied-metrics'), /2.36/);
    if (id === 'between-samples') {
      assert.match(await text('applied-metrics'), /2,724 seconds/);
      assert.match(await text('applied-interval-summary'), /26084375 → 26085000/);
      assert.match(await text('applied-observation'), /Both endpoints are outside/);
    }
    if (id === 'period-vs-holding') assert.match(await text('applied-metrics'), /\+\$0.17/);
    const question = await text('applied-application-context');
    const target = await evaluate("document.getElementById('applied-checkpoint').value");
    await fill('applied-checkpoint', '0');
    assert.equal(await text('applied-application-context'), question, 'Checkpoint exploration keeps the assessment fixed.');
    assert.equal(await evaluate("document.getElementById('applied-return-question').hidden"), false);
    assert.equal(await evaluate("document.querySelectorAll('#applied-assessment-form input[type=number]').length"),0);
    await choose('applied-reason', reason); await choose('applied-application', application);
    await click('applied-check'); assert.equal(await text('applied-feedback-title'), 'Both answers are correct.');
    await click('applied-return-question');
    assert.equal(await evaluate("document.getElementById('applied-checkpoint').value"), target);
    assert.equal(await evaluate("document.querySelector('input[name=applied-application]:checked').value"), application);
    const transferred = await evaluate("document.getElementById('applied-explore').href");
    const params = new URLSearchParams(new URL(transferred).hash.slice(1));
    assert.equal(params.get('scenario'), 'cl-range-v1'); assert.equal(params.get('fees'), '0'); assert.equal(params.get('fullfees'), '0');
    assert.equal(params.get('future'), params.get('start'));
    assert.equal(await evaluate("document.getElementById('applied-explore').target"), '_blank');
    assert.equal(await evaluate("document.getElementById('applied-inspect').href"), base + (record === 'in-range' ? '#historical-case' : '#historical-case=range-return'));
    await evaluate("document.querySelector('#applied-deeper summary').click()");
    assert.match(await text('applied-evidence'), /Block hash|block/);
    assert.equal(await evaluate("Array.from(document.querySelectorAll('#applied-deeper a')).every(a=>a.target==='_blank'&&a.rel.includes('noopener')&&a.href.startsWith('https:'))"), true);
    await evaluate("document.querySelector('#applied-calculation summary').click()");
    await fill('applied-answer', '99999'); await click('applied-calculation-check');
    assert.match(await text('applied-calculation-feedback'), /does not affect completion/);
    assert.equal(await evaluate("document.getElementById('applied-continue').hidden"), false);
    await fill('applied-answer', answer); await click('applied-calculation-check');
    assert.match(await text('applied-calculation-feedback'), /Calculation matches/);
    // Explanation and transfer are independently required, regardless of optional math.
    await choose('applied-reason', id === 'fees-over-time' ? 'owed' : id === 'between-samples' ? 'line' : 'forecast'); await click('applied-check');
    assert.match(await text('applied-feedback-copy'), /application matches/);
    await choose('applied-reason', reason);
    await choose('applied-application',id === 'fees-over-time' ? 'less' : id === 'between-samples' ? 'whole' : 'lp'); await click('applied-check');
    assert.equal(await text('applied-feedback-title'),'Review your answers.');
    assert.equal(await evaluate("document.getElementById('applied-continue').hidden"),true);
    await choose('applied-application',application); await click('applied-check');
    const order = await evaluate("Array.from(document.querySelectorAll('input[name=applied-reason],input[name=applied-application]')).map(input=>input.value).join(',')");
    await reload(); await ready();
    assert.equal(await evaluate("Array.from(document.querySelectorAll('input[name=applied-reason],input[name=applied-application]')).map(input=>input.value).join(',')"),order);
    assert.equal(await evaluate("document.getElementById('applied-answer').value"), answer);
    assert.equal(await text('applied-feedback-title'), 'Both answers are correct.');
    await evaluate("document.querySelector('[data-applied-id=" + id + "]').click()");
    assert.equal(await evaluate("document.getElementById('applied-title').getBoundingClientRect().top >= document.querySelector('.topbar').getBoundingClientRect().bottom"), true);
    assert.equal(await evaluate("document.getElementById('applied-answer').value"), answer);
    if (id === 'fees-over-time') {
      await navigate(transferred);
      assert.equal(await evaluate("document.getElementById('cl-investment').value"), params.get('investment'));
      assert.equal(await evaluate("document.getElementById('cl-fees').value"), '0');
    }
  }
  assert.equal(await text('applied-progress-count'), '3 of 3 checked');
  assert.equal(await evaluate("document.getElementById('applied-reflection').hidden"), false);
  assert.equal(await evaluate('JSON.stringify(' + JSON.stringify(existingKeys) + '.map(key=>localStorage.getItem(key)))'), before, 'Applied work preserves all existing lesson and snapshot storage.');
  await navigate(base + 'learn.html#applied=between-samples'); await ready();
  await click('applied-restart'); await ready();
  assert.equal(await evaluate("document.getElementById('applied-observe').hidden"), true);
  assert.equal(await evaluate("document.getElementById('applied-reveal').disabled"), true);
  const saved = await evaluate("localStorage.getItem('passiko-applied-liquidity-v1')");
  await evaluate("Storage.prototype.setItem=function(){throw new DOMException('Full','QuotaExceededError')}");
  await choose('applied-prediction', 'possible'); await click('applied-reveal');
  assert.match(await text('learn-storage'), /Saving is unavailable/);
  assert.equal(await evaluate("document.getElementById('applied-observe').hidden"), false);
  assert.equal(await evaluate("localStorage.getItem('passiko-applied-liquidity-v1')"), saved);
  await navigate(base + 'learn.html#applied=invalid');
  assert.equal(await evaluate("document.getElementById('learn-applied').hidden"), true);
  assert.equal(await evaluate("document.getElementById('learn-essential').hidden"), false);
  assert.equal(await evaluate("document.getElementById('learn-route-note').hidden"), false);
  // Record-loading races and retry are exercised against actual page requests.
  try {
    await call('Fetch.enable', {patterns:[{urlPattern:'*/examples/uniswap-v3-position-*.json',requestStage:'Request'}]});
    const failed = nextEvent('Fetch.requestPaused'), opening = navigate(base + 'learn.html#applied=fees-over-time');
    const request = await failed;
    await call('Fetch.failRequest', {requestId:request.requestId,errorReason:'Failed'}); await opening; await ready();
    assert.equal(await text('applied-reveal'), 'Retry loading the record →');
    await call('Fetch.disable');
    await click('applied-reveal'); await ready(); assert.match(await text('applied-source'), /#1382030/);
    await call('Fetch.enable', {patterns:[{urlPattern:'*/examples/uniswap-v3-position-*.json',requestStage:'Request'}]});
    const held = nextEvent('Fetch.requestPaused'), loading = navigate(base + 'learn.html#applied=fees-over-time');
    const pending = await held; await loading;
    const newer = nextEvent('Fetch.requestPaused');
    await evaluate("document.querySelector('[data-applied-id=between-samples]').click()");
    const next = await newer; await call('Fetch.continueRequest', {requestId:next.requestId}); await ready();
    assert.match(await text('applied-source'), /#1375047/);
    await call('Fetch.continueRequest', {requestId:pending.requestId});
    await evaluate("new Promise(resolve=>setTimeout(resolve,100))");
    assert.equal(await evaluate('location.hash'), '#applied=between-samples'); assert.match(await text('applied-source'), /#1375047/);
  } finally { await call('Fetch.disable'); }
  await navigate(base);
  console.log('PASS: applied historical lessons, fixed assessments, checkpoint exploration, exact record outcomes, zero-fee Playground handoffs, independent progress, record retry and selection races');
}

export async function checkMobileAppliedLearning({ evaluate, click, fill, text, navigate, base, call }) {
  for (const width of [390, 320]) {
    await call('Emulation.setDeviceMetricsOverride', {width,height:844,deviceScaleFactor:1,mobile:true});
    await navigate(base + 'learn.html#applied=between-samples');
    await evaluate("new Promise(resolve=>{const tick=()=>document.getElementById('learn-applied').getAttribute('aria-busy')==='false'?resolve():setTimeout(tick,25);tick()})");
    assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
    await evaluate("document.querySelector('input[name=applied-prediction][value=possible]').click()"); await click('applied-reveal');
    await evaluate("document.querySelector('#applied-deeper summary').click()");
    assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
    await evaluate("document.querySelector('input[name=applied-application][value=not-proof]').click()"); await evaluate("document.querySelector('input[name=applied-reason][value=counters]').click()"); await click('applied-check');
    assert.equal(await text('applied-feedback-title'), 'Both answers are correct.');
    await click('applied-topics'); await evaluate("document.querySelector('[data-applied-id=period-vs-holding]').click()");
    assert.equal(await evaluate("document.getElementById('learn-course').open"), false);
    assert.equal(await text('applied-title'), 'Explain the period’s result');
    assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
    await evaluate("document.querySelector('.learn-entry-links a[href=\"#lesson=swap-impact\"]').click()");
    assert.equal(await evaluate("document.getElementById('learn-applied').hidden"), true);
    assert.equal(await text('learn-lesson-title'), 'Trade size and execution price');
  }
  await call('Emulation.setDeviceMetricsOverride', {width:390,height:844,deviceScaleFactor:1,mobile:true});
  await navigate(base);
  console.log('PASS: applied chapter navigation, assessment, disclosures and overflow at 390px/320px');
}
