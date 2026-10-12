import assert from 'node:assert/strict';

const settle = evaluate => evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');

export async function checkExperimentFlow({ evaluate, click, fill, text, navigate, base, call }) {
  await navigate(base + '#experiment');
  await click('nav-inspect');
  assert.deepEqual(await evaluate("[...document.querySelectorAll('.workspace-links a')].filter(a=>!a.hidden).map(a=>a.textContent)"), ['Pool snapshot', 'V3 position', 'Historical cases', 'Back to experiments']);
  await click('nav-experiment');
  await click('example-start'); await settle(evaluate);
  assert.equal(await text('scenario-lp-value'), '$5,000.00');
  assert.equal(await text('scenario-hold-value'), '$5,000.00');
  assert.equal(await evaluate('document.activeElement.id'), 'scenario-controls');
  await fill('scenario-future', '4500');
  await click('example-start'); await settle(evaluate);
  assert.equal(await evaluate("document.getElementById('scenario-future').value"), '2000', 'Reopening the simple example must restore its assumptions even with the same fragment.');
  assert.equal(await evaluate("document.querySelector('.quick-changes').open"), false);
  assert.equal(await evaluate("document.querySelector('.scenario-share-card').compareDocumentPosition(document.getElementById('scenario-results')) & Node.DOCUMENT_POSITION_PRECEDING"), NodePositionPreceding);

  for (const [width, height] of [[390, 844], [320, 740]]) {
    await call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: true });
    for (const [fragment, prefix, field, value] of [['lp-lab', 'scenario', 'scenario-future', '4500'], ['range-lab', 'cl', 'cl-future', '2400']]) {
      await navigate(base + '#' + fragment);
      if (prefix === 'cl') await evaluate("document.getElementById('cl-setup-details').open=true");
      await evaluate(`document.getElementById('${field}').focus();document.getElementById('${field}').scrollIntoView({block:'center'})`);
      await fill(field, value); await settle(evaluate);
      const bounds = await evaluate(`(() => {
        const feedback=document.getElementById('${prefix}-quick-result').getBoundingClientRect();
        const input=document.getElementById('${field}').getBoundingClientRect();
        return {feedbackTop:feedback.top,feedbackBottom:feedback.bottom,inputTop:input.top,inputBottom:input.bottom,height:innerHeight,tabsBottom:document.querySelector('.lab-switch').getBoundingClientRect().bottom};
      })()`);
      assert.ok(bounds.feedbackTop >= bounds.tabsBottom + 10 && bounds.feedbackBottom <= bounds.height, 'The compact comparison stays visible below the lab tabs.');
      assert.ok(bounds.inputTop >= bounds.feedbackBottom + 5 && bounds.inputBottom <= bounds.height, 'The summary must not cover the focused price field.');
      assert.ok((await text(prefix + '-quick-values')).includes(await text(prefix === 'cl' ? 'cl-value' : 'scenario-lp-value')), 'Compact and full outcomes agree after an edit.');
      await fill(prefix + '-investment', '');
      assert.match(await text(prefix + '-investment-error'), /Enter the investment/);
      assert.equal(await text(prefix + '-quick-gap'), 'Check the inputs');
      assert.equal(await evaluate(`document.getElementById('${prefix}-results').hidden`), true);
      assert.equal(await evaluate(`document.getElementById('${prefix}-show-results').disabled`), true);
      await fill(prefix + '-investment', '5000');
      assert.equal(await evaluate(`document.getElementById('${prefix}-investment-error').hidden`), true);
      await click(prefix + '-show-results'); await settle(evaluate);
      assert.equal(await evaluate('document.activeElement.id'), prefix + '-results');
      const resultsTop = await evaluate(`document.getElementById('${prefix}-results').getBoundingClientRect().top`);
      const tabsBottom = await evaluate("document.querySelector('.lab-switch').getBoundingClientRect().bottom");
      assert.ok(resultsTop >= tabsBottom + 10, 'The full-result handoff clears sticky navigation.');
      if (prefix === 'cl') await evaluate("document.getElementById('cl-comparison-card').open=true");
      const body = prefix === 'cl' ? 'cl-comparisons' : 'scenario-comparisons';
      assert.ok(await evaluate(`[...document.querySelectorAll('#${body} tr')].every(row=>row.scrollWidth<=row.clientWidth && [...row.querySelectorAll('td')].every(cell=>getComputedStyle(cell).display!=='none'))`), 'Every comparison value is visible without sideways scrolling.');
      await evaluate(`document.querySelector('#${body} button').focus()`);
      await call('Input.dispatchKeyEvent', { type:'keyDown', key:'Enter', code:'Enter', windowsVirtualKeyCode:13, text:'\r' });
      await call('Input.dispatchKeyEvent', { type:'keyUp', key:'Enter', code:'Enter', windowsVirtualKeyCode:13 });
      assert.ok(await evaluate(`document.activeElement.matches('#${body} .selected-scenario button')`));
      assert.equal(await evaluate('document.documentElement.scrollWidth > innerWidth'), false);
    }
    await navigate(base + '#experiment'); await click('example-start'); await settle(evaluate);
    assert.ok(await evaluate("document.getElementById('scenario-investment').getBoundingClientRect().bottom<=innerHeight"), 'The beginner route reveals the first input in one step.');
  }
  await navigate(base + '#historical-case');
  assert.equal(await evaluate("document.getElementById('nav-inspect').getAttribute('aria-current')"), 'page');
  assert.equal(await text('workspace-eyebrow'), 'VERIFIED HISTORICAL CASE');
  const progress = await evaluate("localStorage.getItem('degenerator-learning-liquidity-v1')");
  await evaluate("localStorage.removeItem('degenerator-learning-liquidity-v1')");
  await navigate(base + 'learn.html#lesson=swap-impact');
  assert.equal(await text('learn-resume'), 'Start lesson 1 ↓');
  await evaluate("document.querySelector('input[name=learn-prediction][value=less]').click()");
  await click('learn-run');
  assert.ok(await evaluate("document.getElementById('learn-takeaway').getBoundingClientRect().height>0 && document.getElementById('learn-takeaway').getBoundingClientRect().top<document.getElementById('learn-explanation').getBoundingClientRect().top"));
  await navigate(base + 'learn.html#lesson=swap-impact');
  assert.match(await text('learn-resume'), /^Continue:/);
  await evaluate(progress === null ? "localStorage.removeItem('degenerator-learning-liquidity-v1')" : 'localStorage.setItem("degenerator-learning-liquidity-v1",' + JSON.stringify(progress) + ')');
  console.log('PASS: contextual tools, beginner entry, mobile live feedback, inline errors, result handoff and comparison cards');
}

// DOM position bit flags are read in the browser; keep the expected value explicit here.
const NodePositionPreceding = 2;
