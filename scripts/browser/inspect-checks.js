import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const settle = evaluate => evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
const legacy = await readFile(new URL('./fixtures/workspaces-1.10.1.js', import.meta.url), 'utf8');

export async function checkMobileInspect({ evaluate, call, click, fill, navigate, nextEvent, base }) {
  await call('Emulation.setDeviceMetricsOverride', { width:390, height:844, deviceScaleFactor:1, mobile:true });
  // Replay an actual previous navigation module against the current markup.
  // No-store keeps this fixture out of subsequent fresh-release checks.
  await call('Fetch.enable', { patterns:[{ urlPattern:'*ui/workspaces.js*', resourceType:'Script' }] });
  try {
    const paused = nextEvent('Fetch.requestPaused');
    const loading = navigate(base + '#lp-lab');
    const request = await paused;
    await call('Fetch.fulfillRequest', { requestId:request.requestId, responseCode:200,
      responseHeaders:[{ name:'Content-Type',value:'text/javascript' },{ name:'Cache-Control',value:'no-store' }], body:Buffer.from(legacy).toString('base64') });
    await loading;
    await click('nav-inspect'); await settle(evaluate);
    assert.equal(await evaluate("document.getElementById('workspace-title').textContent"), 'Inspect a pool or position');
    assert.equal(await evaluate("document.getElementById('nav-inspect').getAttribute('aria-current')"), 'page', 'Previous cached navigation must initialize and update the selected label.');
  } finally { await call('Fetch.disable'); }

  async function tap(selector) {
    const point = await evaluate(`(() => {const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()`);
    await call('Input.dispatchTouchEvent', { type:'touchStart',touchPoints:[point] });
    await call('Input.dispatchTouchEvent', { type:'touchEnd',touchPoints:[] });
  }
  async function inspectSelected() {
    await settle(evaluate);
    assert.equal(await evaluate('location.hash'), '#inspect');
    assert.equal(await evaluate("document.getElementById('workspace-title').textContent"), 'Inspect a pool or position');
    assert.equal(await evaluate("document.getElementById('nav-inspect').getAttribute('aria-current')"), 'page');
    assert.equal(await evaluate("document.getElementById('inspect-workspace').hidden"), false);
    assert.equal(await evaluate("document.getElementById('experiment-workspace').hidden"), true);
    assert.ok(await evaluate('scrollY<=1'));
  }
  await call('Emulation.setTouchEmulationEnabled', { enabled:true,maxTouchPoints:1 });
  try {
    for (const [width,height] of [[390,844],[320,740]]) {
      await call('Emulation.setDeviceMetricsOverride', { width,height,deviceScaleFactor:1,mobile:true });
      for (const [fragment,field,value] of [['lp-lab','scenario-future','4500'],['range-lab','cl-future','2400']]) {
        await navigate(base + '#' + fragment);
        if (fragment === 'range-lab') await evaluate("document.getElementById('cl-setup-details').open=true");
        await fill(field,value);
        await evaluate(`document.getElementById('${field}').focus();document.getElementById('${field}').scrollIntoView({block:'center'})`);
        await tap('#nav-inspect'); await inspectSelected();
        await tap('#nav-inspect'); await inspectSelected();
        assert.equal(await evaluate(`document.getElementById('${field}').value`), value);
        // Returning from Learn initializes the page at #inspect with a pending draft.
        const learned=nextEvent('Page.loadEventFired');
        await evaluate("document.querySelector('.product-nav a[href=\"learn.html\"]').click()"); await learned;
        const returned=nextEvent('Page.loadEventFired');
        await tap('.product-nav a[href="./#inspect"]'); await returned;
        await inspectSelected();
        assert.equal(await evaluate(`document.getElementById('${field}').value`),value);
        await tap('#nav-experiment'); await settle(evaluate);
        await tap('#nav-inspect'); await inspectSelected();
        await evaluate("new Promise(resolve=>{addEventListener('hashchange',resolve,{once:true});history.back()})");
        assert.equal(await evaluate('location.hash'),'#experiment');
        assert.equal(await evaluate(`document.getElementById('${field}').value`),value);
      }
    }
  } finally { await call('Emulation.setTouchEmulationEnabled', { enabled:false }); }
  console.log('PASS: previous cached navigation, touch Inspect routing, active inputs, repeated taps, Learn return and browser history at 390px/320px');
}
