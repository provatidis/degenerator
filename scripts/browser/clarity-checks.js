import assert from 'node:assert/strict';

export async function checkProjectInformation({ evaluate, navigate, base }) {
  for (const page of ['', 'learn.html']) {
    await navigate(base + page);
    const links = await evaluate("Array.from(document.querySelectorAll('.site-footer a')).map(a => ({href:a.getAttribute('href'),target:a.target,rel:a.rel}))");
    assert.deepEqual(links.slice(0, 3).map(link => link.href), ['methods.html', 'https://github.com/provatidis/passiko', 'about.html']);
    assert.ok(links.every(link => link.target === '_blank' && link.rel.includes('noopener')));
    assert.ok(links[3].href.startsWith('https://github.com/provatidis/passiko/issues/new?'));
  }
  for (const [id, protocol] of [['swap-impact','v2'],['pool-share','v2'],['range-boundaries','v3']]) {
    await navigate(base+'learn.html#lesson='+id);
    assert.match(await evaluate("document.getElementById('learn-level').textContent"),new RegExp('Uniswap '+protocol+'-style'));
    const model=await evaluate("document.getElementById('learn-model').textContent");
    assert.match(model,new RegExp('Uniswap '+protocol+'-style'));
    assert.doesNotMatch(model,/cp50-v1|cl-range-v1/);
  }
  for (const page of ['about.html', 'methods.html']) {
    await navigate(base + page);
    assert.equal(await evaluate("document.querySelectorAll('h1').length"), 1);
    assert.equal(await evaluate("document.querySelectorAll('script').length"), 0);
    assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
  }
  assert.match(await evaluate('document.body.textContent'), /Confirming its claimed contract state independently requires reading Ethereum/);
  assert.match(await evaluate('document.body.textContent'), /does not backtest that range against the record/);
  await navigate(base + 'learn.html#lesson=swap-impact');
  await navigate(base);
  assert.match(await evaluate("document.getElementById('lab-full-tab').textContent"),/V2-style/);
  assert.match(await evaluate("document.getElementById('lab-range-tab').textContent"),/V3-style/);
  await navigate(base+'learn.html#lesson=swap-impact');
  const levels = await evaluate("Array.from(document.querySelectorAll('h1,h2,h3')).filter(e=>e.getClientRects().length).map(e=>Number(e.tagName.slice(1)))");
  for (let index = 1; index < levels.length; index++) assert.ok(levels[index] <= levels[index - 1] + 1, 'Visible headings do not skip a level.');
  await navigate(base);
  console.log('PASS: static About/Methods, evidence boundaries, feedback/source access, separate-tab preservation and lesson heading order');
}

export async function checkMobileTools({ evaluate, click, navigate, base, call }) {
  for (const width of [390, 320]) {
    await call('Emulation.setDeviceMetricsOverride', { width, height: 844, deviceScaleFactor: 1, mobile: true });
    await navigate(base + '#experiment');
    assert.equal(await evaluate("document.getElementById('workspace-tools-toggle').getAttribute('aria-expanded')"), 'false');
    assert.equal(await evaluate("document.querySelector('.workspace-links').getClientRects().length"), 0);
    await click('workspace-tools-toggle');
    assert.equal(await evaluate("document.getElementById('workspace-tools-toggle').getAttribute('aria-expanded')"), 'true');
    assert.equal(await evaluate("Array.from(document.querySelectorAll('.workspace-links a')).filter(a=>a.getClientRects().length).length"), 6);
    await evaluate("document.querySelector('.workspace-links a[href=\"#range-lab\"]').click()");
    assert.equal(await evaluate("document.getElementById('workspace-tools-toggle').getAttribute('aria-expanded')"), 'false');
    assert.equal(await evaluate("document.getElementById('lab-range-tab').getAttribute('aria-selected')"), 'true');
    await click('nav-inspect');
    assert.equal(await evaluate("document.getElementById('workspace-tools-label').textContent"), 'Explore inspect tools');
    await click('workspace-tools-toggle');
    assert.equal(await evaluate("Array.from(document.querySelectorAll('.workspace-links a')).filter(a=>a.getClientRects().length).length"), 4);
    assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
    for (const page of ['about.html', 'methods.html']) {
      await navigate(base + page);
      assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
    }
  }
  await navigate(base);
  console.log('PASS: compact mobile tools, changing workspace destinations, lab handoff and static information at 390px/320px');
}
