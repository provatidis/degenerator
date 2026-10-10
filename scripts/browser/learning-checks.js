import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import assert from 'node:assert/strict';

export async function checkLearning({ evaluate, click, fill, text, navigate, reload, base, downloadFile }) {
  const sandbox = await evaluate("localStorage.getItem('defi-sandbox-v1')");
  const pool = await evaluate("localStorage.getItem('degenerator-pool-snapshot-v1')");
  const position = await evaluate("localStorage.getItem('degenerator-v3-position-snapshot-v1')");
  await navigate(base + 'learn.html#lesson=range-boundaries');
  assert.equal(await text('learn-lesson-title'), 'At the edge of your range.');
  assert.equal(await text('learn-progress-count'), '0 of 7 checked');
  assert.equal(await evaluate("document.querySelector('.product-nav a[aria-current=page]').textContent"), 'Learn');
  assert.equal(await evaluate("document.querySelectorAll('[data-lesson-id]').length"), 7);
  assert.equal(await evaluate("document.getElementById('learn-run').disabled"), true);
  await click('learn-resume');
  assert.equal(await evaluate('location.hash'), '#lesson=range-boundaries');
  assert.equal(await evaluate("document.getElementById('learn-route-note').hidden"), true);
  const choose = (name, value) => evaluate("document.querySelector('input[name=\"" + name + "\"][value=\"" + value + "\"]').click()");
  const cases = [
    ['swap-impact','less','18132','curve'],
    ['pool-share','less','4.76','ownership'],
    ['token-balances','less','0.884','rebalance'],
    ['loss-vs-profit','gain','428.93','benchmark'],
    ['fee-break-even','short','428.93','assumption'],
    ['range-boundaries','usdc','0','path'],
    ['final-challenge','hold','328.93','total'],
  ];
  for (const [id, prediction, answer, reason] of cases) {
    await navigate(base + 'learn.html#lesson=' + id);
    await choose('learn-prediction', prediction);
    await click('learn-run');
    assert.equal(await evaluate("document.getElementById('learn-results').hidden"), false);
    assert.equal(await evaluate("document.getElementById('learn-deeper').open"),false);
    assert.equal(await evaluate("document.getElementById('learn-math').open"),false);
    const beforeReading = await evaluate("localStorage.getItem('degenerator-learning-liquidity-v1')");
    await evaluate("document.querySelector('#learn-deeper > summary').click()");
    assert.equal(await evaluate("document.querySelectorAll('#learn-worked-steps li').length"),4);
    assert.equal(await evaluate("document.querySelectorAll('#learn-sources a').length"),2);
    assert.equal(await evaluate("Array.from(document.querySelectorAll('#learn-sources a')).every(a=>a.href.startsWith('https:')&&a.target==='_blank'&&a.rel.includes('noopener'))"),true);
    await evaluate("document.querySelector('#learn-math > summary').click()");
    assert.equal(await evaluate("document.getElementById('learn-math').open"),true);
    assert.equal(await evaluate("localStorage.getItem('degenerator-learning-liquidity-v1')"),beforeReading,'Reading cannot mark exercises complete or change their answers.');
    if(id==='fee-break-even') assert.match(await text('learn-worked-steps'),/428.93[\s\S]*328.93/);
    if(id==='range-boundaries') assert.match(await text('learn-worked-steps'),/5,116.06/);
    await fill('learn-answer', answer);
    await choose('learn-reason', reason);
    if (id === 'swap-impact') {
      await fill('learn-answer', '20000');
      await click('learn-check');
      assert.match(await text('learn-feedback-copy'), /Revisit the number/);
      assert.equal(await text('learn-progress-count'), '0 of 7 checked');
      await fill('learn-answer', answer);
      await choose('learn-reason', 'fixed'); await click('learn-check');
      assert.match(await text('learn-feedback-copy'), /Revisit the explanation/);
      assert.equal(await text('learn-progress-count'), '0 of 7 checked');
      await choose('learn-reason', reason);
    }
    await click('learn-check');
    assert.equal(await text('learn-feedback-title'), 'Checked. You can explain this.');
    assert.equal(await evaluate("document.getElementById('learn-continue').hidden"), false);
    await reload();
    assert.equal(await evaluate("document.getElementById('learn-answer').value"), answer);
    assert.equal(await evaluate("document.getElementById('learn-feedback').hidden"), false);
    if (id === 'range-boundaries') {
      const linked = await evaluate("document.getElementById('learn-explore').href");
      assert.ok(linked.startsWith(base));
      assert.ok(linked.includes('scenario=cl-range-v1'));
      assert.ok(linked.includes('future=2400'));
      assert.equal(await evaluate("document.getElementById('learn-explore').target"), '_blank');
    }
  }
  assert.equal(await text('learn-progress-count'), '7 of 7 checked');
  assert.match(await text('learn-course-status'), /Chapter complete/);
  assert.equal(await evaluate("document.getElementById('learn-share').hidden"), false);
  await evaluate("Object.defineProperty(navigator, 'clipboard', { configurable:true, value:{writeText:async value=>{window.learningCopied=value}} });");
  await click('learn-copy');
  const link = await evaluate("document.getElementById('learn-share-url').value");
  assert.equal(await evaluate('window.learningCopied'), link);
  assert.ok(link.includes('scenario=cp50-v1') && link.includes('fees=100'));
  await click('learn-create-card');
  await evaluate("new Promise((resolve,reject)=>{const until=Date.now()+5000;const check=()=>{if(!document.getElementById('learn-card-preview').hidden&&document.getElementById('learn-card-image').naturalWidth===1200)resolve();else if(Date.now()>until)reject(new Error('Learning card did not render'));else setTimeout(check,25)};check()})");
  const cardPath = await downloadFile('learn-card-download');
  assert.equal(basename(cardPath), 'degenerator-learning-challenge-cp50-v1.png');
  const card = await readFile(cardPath);
  assert.equal(card.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  assert.equal(card.readUInt32BE(16),1200);
  assert.equal(card.readUInt32BE(20),720);
  await fill('learn-input-fees', '500');
  assert.equal(await evaluate("document.getElementById('learn-results').hidden"), true);
  assert.equal(await evaluate("document.getElementById('learn-card-preview').hidden"), true);
  assert.equal(await evaluate("document.getElementById('learn-share').hidden"), true);
  assert.equal(await evaluate("document.getElementById('learn-answer').value"), '');
  await click('learn-run');
  assert.match(await text('learn-worked-steps'),/500.00/);
  assert.match(await text('learn-worked-steps'),/0.00 additional/);

  await click('learn-variation');
  assert.equal(await text('learn-variation-label'), 'Variation 2 of 3');
  assert.equal(await evaluate("document.getElementById('learn-run').disabled"), true);
  assert.equal(await text('learn-progress-count'), '7 of 7 checked');
  await reload();
  assert.equal(await text('learn-variation-label'), 'Variation 2 of 3');
  await navigate(base + 'learn.html#lesson=not-a-lesson');
  assert.equal(await evaluate("document.getElementById('learn-route-note').hidden"), false);
  assert.equal(await text('learn-lesson-title'), 'Put your judgment to work.');
  const savedLearn = await evaluate("localStorage.getItem('degenerator-learning-liquidity-v1')");
  await evaluate("Storage.prototype.setItem=function(){throw new DOMException('Full','QuotaExceededError')}");
  await click('learn-variation');
  assert.match(await text('learn-storage'), /Saving is unavailable/);
  await choose('learn-prediction','lp'); await click('learn-run');
  assert.equal(await evaluate("document.getElementById('learn-results').hidden"), false);
  assert.equal(await evaluate("localStorage.getItem('degenerator-learning-liquidity-v1')"), savedLearn);
  assert.equal(await evaluate("localStorage.getItem('defi-sandbox-v1')"), sandbox);
  assert.equal(await evaluate("localStorage.getItem('degenerator-pool-snapshot-v1')"), pool);
  assert.equal(await evaluate("localStorage.getItem('degenerator-v3-position-snapshot-v1')"), position);
  await navigate(link);
  assert.equal(await text('scenario-hold-value'), '$7,500.00');
  assert.equal(await text('scenario-lp-value'), '$7,171.07');
  assert.equal(await evaluate("localStorage.getItem('defi-sandbox-v1')"), sandbox);
  await navigate(base);
  console.log('PASS: optional deeper reading, current-input walkthroughs, math disclosures, source links, all learning assessments, feedback, progress restoration, deep links, state isolation, card/download, stale-result invalidation and full storage');
}

export async function checkMobileLearning({ evaluate, click, fill, text, navigate, base }) {
  await navigate(base + 'learn.html#lesson=range-boundaries');
  assert.equal(await evaluate("document.getElementById('learn-course').open"), false);
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
  await evaluate("document.querySelector('#learn-course summary').click()");
  await evaluate("document.querySelector('[data-lesson-id=pool-share]').click()");
  assert.equal(await text('learn-lesson-title'), 'Own a share, not a promise.');
  assert.equal(await evaluate("document.getElementById('learn-course').open"), false);
  await navigate(base + 'learn.html#lesson=range-boundaries');
  await evaluate("document.querySelector('input[name=learn-prediction][value=usdc]').click()");
  await click('learn-run');
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
  await evaluate("document.querySelector('#learn-deeper > summary').click()");
  await evaluate("document.querySelector('#learn-math > summary').click()");
  assert.equal(await evaluate("document.getElementById('learn-deeper').open && document.getElementById('learn-math').open"),true);
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'),true);
  await fill('learn-answer','0');
  await evaluate("document.querySelector('input[name=learn-reason][value=path]').click()");
  await click('learn-check');
  assert.equal(await text('learn-feedback-title'),'Checked. You can explain this.');
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'),true);
  await navigate(base);
  assert.equal(await evaluate("getComputedStyle(document.querySelector('.product-nav')).display"), 'flex');
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'),true);
  console.log('PASS: mobile lesson navigation, exercise, feedback, mode navigation and layout');
}
