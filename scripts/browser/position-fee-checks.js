import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const recorded = JSON.parse(await readFile(new URL('../../public/examples/uniswap-v3-mainnet-fees.json', import.meta.url), 'utf8'));

export async function checkPositionFees({ evaluate, click, text, navigate, base, downloadFile, profile, loadFile, waitStatus }) {
  const inputs = () => evaluate("['cl-investment','cl-start','cl-future','cl-lower','cl-upper','cl-fees','cl-full-fees'].map(id=>document.getElementById(id).value)");
  const before = await inputs(), wallet = await text('portfolio');
  const learning = await evaluate("localStorage.getItem('degenerator-learning-liquidity-v1')");
  await click('position-example-fees'); await waitStatus('Position saved');
  assert.equal(await text('position-principal'), '$47,788.39');
  assert.equal(await text('position-accrued-value'), '$5.67');
  assert.equal(await text('position-recorded-owed-value'), '$0.00');
  assert.equal(await text('position-collectable-value'), '$5.67');
  assert.equal(await text('position-assets-value'), '$47,794.06');
  assert.equal(await text('position-collectable-tokens'), '0.00205497 WETH + 0.524593 USDC');
  assert.equal(await evaluate("document.getElementById('position-fees').open && document.getElementById('position-fee-walkthrough').open"), true);
  assert.equal(await evaluate("document.getElementById('position-fee-steps').children.length"), 4);
  assert.match(await text('position-fee-steps'), /not a profit calculation/);
  assert.deepEqual(await inputs(), before, 'Opening fee data must not modify a range experiment.');
  assert.equal(await text('portfolio'), wallet);
  assert.equal(await evaluate("localStorage.getItem('degenerator-learning-liquidity-v1')"), learning);
  assert.equal(await evaluate("Array.from(document.querySelectorAll('#position-fee-steps li')).every(el=>!el.textContent.includes(el.querySelector('strong').textContent+el.querySelector('p').textContent))"), true);
  assert.equal(await text('position-fee-raw0'), '524593');
  assert.equal(await text('position-fee-raw1'), '2054973037123392');
  await evaluate("document.querySelector('#position-fee-math > summary').click()");
  assert.match(await text('position-fee-formula'), /floor\(159442089989790672 × [0-9]+ \/ 2\^128\)/);
  assert.equal(await evaluate("Array.from(document.querySelectorAll('.position-fee-sources a')).every(a=>a.target==='_blank'&&a.rel.includes('noopener')&&a.href.startsWith('https:'))"), true);
  const exportedPath = await downloadFile('position-export');
  assert.deepEqual(JSON.parse(await readFile(exportedPath,'utf8')), recorded);
  await navigate(base+'#position-lab');
  assert.match(await text('position-status'), /Restored/);
  assert.equal(await text('position-accrued-value'), '$5.67');
  assert.equal(await evaluate("document.getElementById('position-fees').open"), false, 'Restoring a save does not force advanced detail open.');
  await loadFile(exportedPath); await waitStatus('Position saved');
  await click('position-apply');
  assert.equal(await text('cl-value'), '$47,788.39', 'The range experiment starts with principal, not principal plus old fees.');
  assert.equal(await evaluate("document.getElementById('cl-fees').value"), '0');
  assert.equal(await evaluate("document.getElementById('cl-full-fees').value"), '0');
  assert.equal(await evaluate("document.getElementById('cl-start').value===document.getElementById('cl-future').value"), true);
  assert.match(await text('cl-origin'), /already collectable tokens outside both strategies/);

  // An owed balance can contain removed principal; it must not be labelled newly earned fees.
  const owedPath = join(profile,'position-with-recorded-owed.json');
  const owed = {...recorded,position:{...recorded.position,tokensOwed0:'10000000'},fees:{...recorded.fees,collectable0Raw:'10524593'}};
  await writeFile(owedPath, JSON.stringify(owed));
  await loadFile(owedPath); await waitStatus('Position saved');
  await evaluate("document.querySelector('#position-fees > summary').click()");
  assert.equal(await text('position-accrued-value'), '$5.67');
  assert.equal(await text('position-recorded-owed-value'), '$10.00');
  assert.equal(await text('position-collectable-value'), '$15.67');
  assert.match(await text('position-owed-note'), /principal removed from liquidity/);
  await click('position-apply');
  assert.equal(await text('cl-value'), '$47,788.39');
  assert.equal(await evaluate("document.getElementById('cl-fees').value"), '0');

  // uint128 capacity is reported explicitly, rather than displaying wrapped amounts as income.
  const capacityPath = join(profile,'position-capacity.json');
  const capacity = {...recorded,position:{...recorded.position,tokensOwed0:((1n<<128n)-1n).toString()},fees:{...recorded.fees,collectable0Raw:'524592',overflow:true}};
  await writeFile(capacityPath,JSON.stringify(capacity));
  await loadFile(capacityPath); await waitStatus('Position saved');
  assert.equal(await evaluate("document.getElementById('position-fee-data').hidden"), true);
  assert.equal(await evaluate("document.getElementById('position-fee-overflow').hidden"), false);
  assert.match(await text('position-fee-capacity'), /Exceeded/);
  assert.equal(await text('position-collectable-raw0'), '524592');

  // Closed positions can still have owed tokens after their boundary ticks have been cleared.
  const closedPath = join(profile,'closed-position-with-owed.json');
  const cleared = {liquidityGross:'0',outside0X128:'0',outside1X128:'0',initialized:false};
  const closed = {...recorded,position:{...recorded.position,liquidity:'0',tokensOwed0:'10000000'},principal:{amount0Raw:'0',amount1Raw:'0'},feeGrowth:{...recorded.feeGrowth,lower:cleared,upper:cleared},fees:{accrued0Raw:'0',accrued1Raw:'0',collectable0Raw:'10000000',collectable1Raw:'0',overflow:false}};
  await writeFile(closedPath,JSON.stringify(closed));
  await loadFile(closedPath); await waitStatus('Position saved');
  assert.equal(await text('position-state'), 'No liquidity');
  assert.equal(await evaluate("document.getElementById('position-apply').disabled"), true);
  assert.equal(await text('position-accrued-value'), '$0.00');
  assert.equal(await text('position-assets-value'), '$10.00');
  assert.match(await text('position-fee-steps'), /cannot seed a supported range experiment/);
  const badPath = join(profile,'altered-fee-estimate.json');
  await writeFile(badPath,JSON.stringify({...recorded,fees:{...recorded.fees,accrued0Raw:'1'}}));
  await loadFile(badPath); await waitStatus('fee estimate does not match');
  assert.equal(await text('position-state'), 'No liquidity', 'Rejected imports preserve the previous valid snapshot.');
  await click('position-example'); await waitStatus('Position saved');
  assert.equal(await evaluate("document.getElementById('position-fee-empty').hidden"), false);
  assert.equal(await evaluate("document.getElementById('position-fee-data').hidden"), true);
  assert.equal(await evaluate("document.getElementById('position-fee-details').hidden"), true);
  assert.match(await text('position-collectable-summary'), /not recorded/);
  console.log('PASS: fee estimates, exact v2 export/import and restore, unknown legacy fees, owed-principal separation, closed positions, capacity handling, rejected imports and principal-only comparisons');
}

export async function checkMobilePositionFees({ evaluate, click, text }) {
  // Applying principal now moves to the Experiment workspace; return through Inspect.
  await click('nav-inspect');
  await click('position-setup-summary');
  await click('position-example-fees');
  await evaluate("new Promise((resolve,reject)=>{const until=Date.now()+10000;const check=()=>{if(document.getElementById('position-lab').getAttribute('aria-busy')==='false'&&document.getElementById('position-fees').open&&document.activeElement.tagName==='SUMMARY')resolve();else if(Date.now()>until)reject(new Error('Mobile fee example did not open'));else setTimeout(check,20)};check()})");
  assert.equal(await text('position-collectable-value'), '$5.67');
  assert.equal(await evaluate("document.getElementById('position-fees').contains(document.activeElement)"), true);
  assert.equal(await evaluate("document.getElementById('position-setup').open"), false);
  assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'), true);
  assert.equal(await evaluate("(()=>{const cards=Array.from(document.querySelectorAll('.position-fee-balances>div')).map(el=>el.getBoundingClientRect());return cards.every((rect,index)=>index===0||rect.top>=cards[index-1].bottom);})()"), true);
  await evaluate("document.querySelector('#position-fee-math > summary').click()");
  assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'), true);
  assert.equal(await text('position-fee-raw1'), '2054973037123392');
  console.log('PASS: mobile fee example, focus, stacked readable balances and exact calculation without overflow');
}
