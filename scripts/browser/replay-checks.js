import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const wait = (evaluate, condition) => evaluate('new Promise((resolve,reject)=>{const end=Date.now()+10000;const check=()=>{if(' + condition + ')resolve();else if(Date.now()>end)reject(new Error("Replay check timed out"));else setTimeout(check,20)};check()})');
const ready = (evaluate, id) => wait(evaluate, "document.getElementById('historical-case').getAttribute('aria-busy')==='false' && !document.getElementById('period-result').hidden && document.getElementById('period-title').textContent.includes(" + JSON.stringify(id) + ')');
const choose = (evaluate, id) => evaluate("(()=>{const select=document.getElementById('period-case');select.value=" + JSON.stringify(id) + ";select.dispatchEvent(new Event('change',{bubbles:true}))})()");

export async function checkReplay({ evaluate, click, fill, text, navigate, base, downloadFile, call }) {
  await navigate(base + '#historical-case=range-return'); await ready(evaluate, '1375047');
  const keys = ['defi-sandbox-v1','degenerator-learning-liquidity-v1','degenerator-experiments-v1','degenerator-pool-snapshot-v1','degenerator-v3-position-snapshot-v1'];
  const stored = await evaluate(JSON.stringify(keys) + '.map(key=>localStorage.getItem(key))');
  assert.equal(await text('period-fees'), '$0.45'); assert.equal(await text('period-range-time'), '41.7%');
  assert.equal(await text('period-outside-time'), '19h 30m 12s'); assert.equal(await text('period-gap'), '+$0.17');
  await fill('period-checkpoint', '3'); assert.equal(await text('period-interval-fees'), '$0.00');
  assert.match(await text('period-interval-explanation'), /no active seconds.*no tokens/);
  assert.match(await text('period-checkpoint-state'), /all USDC/);
  await evaluate("document.querySelector('#period-milestones button[data-index=\"8\"]').click()");
  assert.match(await text('period-interval-explanation'), /Both sampled endpoints are outside.*45m 24s/);
  assert.equal(await text('period-interval-fees'), '$0.02');
  await evaluate("document.getElementById('period-checkpoint').focus()");
  await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight' });
  await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight' });
  assert.match(await text('period-current'), /Checkpoint 10 of 17/); assert.equal(await text('period-interval-fees'), '$0.00');
  await evaluate("document.querySelector('#period-milestones button[data-index=\"11\"]').click()");
  assert.match(await text('period-checkpoint-state'), /In range/); assert.ok(await evaluate("Number(document.getElementById('period-checkpoint').value)===11"));
  await fill('period-checkpoint', '0'); assert.equal(await text('period-lp'), await text('period-hold'));
  assert.equal(await text('period-fees'), '$0.00'); assert.equal(await evaluate("document.getElementById('period-interval-metrics').hidden"), true);
  await fill('period-checkpoint', '8');
  const exported = JSON.parse(await readFile(await downloadFile('period-export'), 'utf8'));
  assert.equal(exported.points.length, 17); assert.deepEqual(exported.validation.earnedRaw, ['274940','65624095827826']);
  await click('period-apply'); assert.match(await text('cl-origin'), /1375047.*26085000/);
  assert.equal(await evaluate("document.getElementById('cl-fees').value"), '0');
  await evaluate("document.querySelector('.workspace-links a[href=\"#historical-case\"]').click()"); await ready(evaluate, '1382030');
  assert.equal(await text('period-fees'), '$2.36');
  await choose(evaluate, 'range-return'); await ready(evaluate, '1375047');
  assert.match(await text('period-current'), /Checkpoint 9 of 17/, 'Each case keeps its selected checkpoint in the current document.');
  assert.deepEqual(await evaluate(JSON.stringify(keys) + '.map(key=>localStorage.getItem(key))'), stored);

  // A delayed response for the previous choice must not replace the latest case.
  await navigate(base + '#historical-case'); await ready(evaluate, '1382030');
  await evaluate("(()=>{const original=window.fetch;window.restoreReplayFetch=()=>window.fetch=original;window.fetch=(url,options)=>String(url).endsWith('/uniswap-v3-position-range-return.json')?new Promise(resolve=>{window.releaseReplay=async()=>{const response=await original(url,options);await response.clone().text();resolve(response)}}):original(url,options)})()");
  await choose(evaluate, 'range-return'); await wait(evaluate, "typeof window.releaseReplay==='function'");
  await choose(evaluate, 'in-range'); await ready(evaluate, '1382030');
  await evaluate("window.releaseReplay()"); await evaluate("window.restoreReplayFetch()");
  await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
  assert.equal(await evaluate("document.getElementById('period-case').value"), 'in-range');
  assert.match(await text('period-title'), /1382030/); assert.equal(await text('period-fees'), '$2.36');

  // Failed data loads hide old results, disable handoffs and allow an actual retry.
  await navigate(base);
  await evaluate("(()=>{const original=window.fetch;let failed=false;window.restoreReplayFetch=()=>window.fetch=original;window.fetch=(url,options)=>{if(!failed&&String(url).endsWith('/uniswap-v3-position-range-return.json')){failed=true;return Promise.resolve({ok:false,status:503})}return original(url,options)}})()");
  await evaluate("document.querySelector('.workspace-links a[href=\"#historical-case\"]').click()"); await ready(evaluate, '1382030');
  await choose(evaluate, 'range-return'); await wait(evaluate, "!document.getElementById('period-retry').hidden");
  assert.equal(await evaluate("document.getElementById('period-result').hidden && document.getElementById('period-export').disabled && document.getElementById('period-apply').disabled"), true);
  await click('period-retry'); await ready(evaluate, '1375047'); await evaluate('window.restoreReplayFetch()');
  await navigate(base + '#historical-case=unsupported'); await ready(evaluate, '1382030');
  assert.match(await text('period-status'), /unavailable.*baseline/);
  await navigate(base);
  console.log('PASS: verified crossing case, interval fees, hidden active time, keyboard checkpoints, exact export, principal-only handoff, state isolation, case races and retry');
}

export async function checkMobileReplay({ evaluate, click, fill, text, navigate, base, call }) {
  for (const [width,height] of [[390,844],[320,740]]) {
    await call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: true });
    await navigate(base + '#historical-case=range-return'); await ready(evaluate, '1375047');
    assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'), true);
    const geometry = await evaluate("({header:document.querySelector('.topbar').getBoundingClientRect().bottom,top:document.getElementById('historical-case').getBoundingClientRect().top})");
    assert.ok(geometry.top >= geometry.header + 10);
    await evaluate("document.querySelector('#period-milestones button[data-index=\"8\"]').click()");
    assert.match(await text('period-interval-explanation'), /Both sampled endpoints are outside/);
    await evaluate("document.querySelector('.period-details>summary').click()");
    assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'), true);
    await fill('period-checkpoint', '0'); assert.equal(await text('period-lp'), await text('period-hold'));
    await click('nav-experiment'); await wait(evaluate, "location.hash==='#experiment'&&scrollY<=1");
  }
  console.log('PASS: 390px/320px historical case, milestone controls, exact evidence, anchor clearance and preserved primary navigation');
}
