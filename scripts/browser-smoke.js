import { checkPositions, checkMobilePositions } from './browser/position-checks.js';
// Optional real-browser smoke test, using Chromium's DevTools protocol and Node built-ins.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';

const project = fileURLToPath(new URL('../', import.meta.url));
const profile = await mkdtemp(join(tmpdir(), 'degenerator-browser-'));
const children = [];
let socket;
let sequence = 0;
const pending = new Map();
const errors = [];

function start(command, args, options, pattern) {
  const child = spawn(command, args, options);
  children.push(child);
  return new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(new Error(`Startup timed out: ${command}\n${output}`)), 15000);
    const read = (chunk) => {
      output += chunk;
      const match = output.match(pattern);
      if (match) { clearTimeout(timer); resolve(match[1]); }
    };
    child.stdout.on('data', read);
    child.stderr.on('data', read);
    child.once('error', (error) => { clearTimeout(timer); reject(error); });
    child.once('exit', (code) => { clearTimeout(timer); reject(new Error(`${command} exited ${code}\n${output}`)); });
  });
}

function call(method, params = {}) {
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`DevTools timed out: ${method}`)); }, 15000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || 'Browser evaluation failed');
  return result.result.value;
}

const text = (id) => evaluate(`document.getElementById(${JSON.stringify(id)}).textContent`);
const click = (id) => evaluate(`document.getElementById(${JSON.stringify(id)}).click()`);
const fill = (id, value) => evaluate(`(() => { const el = document.getElementById(${JSON.stringify(id)}); el.value = ${JSON.stringify(value)}; el.dispatchEvent(new Event('input', { bubbles: true })); })()`);

async function reload() {
  const loaded = new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.removeEventListener('message', listener); reject(new Error('Reload timed out')); }, 15000);
    const listener = ({ data }) => {
      if (JSON.parse(data).method !== 'Page.loadEventFired') return;
      clearTimeout(timer);
      socket.removeEventListener('message', listener);
      resolve();
    };
    socket.addEventListener('message', listener);
  });
  await call('Page.reload');
  await loaded;
}

function nextEvent(method) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.removeEventListener('message', listener); reject(new Error(`Event timed out: ${method}`)); }, 15000);
    const listener = ({ data }) => {
      const message = JSON.parse(data);
      if (message.method !== method) return;
      clearTimeout(timer);
      socket.removeEventListener('message', listener);
      resolve(message.params);
    };
    socket.addEventListener('message', listener);
  });
}

async function navigate(url) {
  // Reopen the link as a new document; changing just a fragment is not a page load.
  for (const destination of ['about:blank', url]) {
    const loaded = nextEvent('Page.loadEventFired');
    await call('Page.navigate', { url: destination });
    await loaded;
  }
}

try {
  let base = process.env.TEST_BASE_URL;
  if (!base) {
    const port = await start(process.execPath, ['server.js'], { cwd: project, env: { ...process.env, PORT: '0', HOST: '127.0.0.1' }, stdio: ['ignore', 'pipe', 'pipe'] }, /listening on port (\d+)/);
    base = `http://127.0.0.1:${port}/`;
    const missing = await fetch(base + 'missing');
    assert.equal(missing.status, 404);
    assert.ok((await missing.text()).includes('This page is out of range.'));
    assert.equal((await fetch(base + 'degenerator/favicon.svg')).status, 200);
    assert.equal((await fetch(base + 'degenerator/styles/errors.css')).status, 200);
    const missingHead = await fetch(base + 'missing', { method: 'HEAD' });
    assert.equal(missingHead.status, 404);
    assert.equal(await missingHead.text(), '');
    assert.equal((await fetch(base, { method: 'POST' })).status, 405);
    assert.equal((await fetch(base + '%2e%2e%2fpackage.json')).status, 403);
    console.log('PASS: missing resources, methods, and directory isolation');
  }
  if (!base.endsWith('/')) base += '/';
  for (const path of ['', 'main.js', 'amm.js', 'storage.js', 'scenario.js', 'ui/sandbox.js', 'ui/full-range.js', 'ui/pools.js', 'ui/range.js', 'ui/lab-navigation.js', 'styles/foundation.css', 'styles/full-range.css', 'styles/pools.css', 'styles/range.css', 'styles/components.css', 'styles/positions.css', 'ui/positions.js', 'ui/snapshot-navigation.js', 'data/uniswap-v3.js', 'data/position-snapshot.js', 'models/tick-math.js', 'examples/uniswap-v3-mainnet-37.json', 'models/cl-range-v1.js', 'lib/range-links.js', 'lib/range-card.js', 'models/cp50-v1.js', 'data/uniswap-v2.js', 'data/snapshot.js', 'lib/result-card.js', 'examples/uniswap-v2-mainnet.json', 'styles.css', 'favicon.svg', 'favicon.ico', 'site.webmanifest', 'assets/apple-touch-icon.png', 'assets/icon-192.png', 'assets/icon-512.png', 'assets/social-preview.png', '404.html', 'styles/errors.css']) assert.equal((await fetch(base + path)).status, 200);
  for (const [path, type] of [['favicon.svg','image/svg+xml'], ['favicon.ico','image/x-icon'], ['assets/social-preview.png','image/png'], ['site.webmanifest','application/manifest+json']]) assert.ok((await fetch(base + path)).headers.get('content-type').startsWith(type));
  console.log('PASS: HTTP assets, identity images, manifest types and branded 404');

  const devtools = await start(process.env.CHROMIUM_BIN || 'chromium', ['--headless', '--no-sandbox', '--disable-dev-shm-usage', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: ['ignore', 'pipe', 'pipe'] }, /DevTools listening on (ws:\/\/[^\s]+)/);
  const endpoint = new URL(devtools);
  const pageResponse = await fetch(`http://${endpoint.host}/json/new?about:blank`, { method: 'PUT' });
  assert.equal(pageResponse.status, 200, 'Chromium created a test page');
  const page = await pageResponse.json();
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await once(socket, 'open');
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
    const task = pending.get(message.id);
    if (task) {
      clearTimeout(task.timer);
      pending.delete(message.id);
      if (message.error) task.reject(new Error(message.error.message));
      else task.resolve(message.result);
    }
  });
  await call('Runtime.enable');
  await call('Page.enable');
  await call('Page.bringToFront');
  await call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });
  const initialLoad = nextEvent('Page.loadEventFired');
  await call('Page.navigate', { url: base });
  await initialLoad;
  await evaluate(`new Promise((resolve, reject) => { const deadline = Date.now() + 10000; const check = () => { if (document.getElementById('swap-output')?.textContent === '1,974.32') resolve(true); else if (Date.now() > deadline) reject(new Error('App did not initialize')); else setTimeout(check, 50); }; check(); })`);
  const initialHash = await evaluate('location.hash');
  await evaluate("document.querySelector('.skip-link').focus()");
  assert.equal(await evaluate("document.querySelector('.skip-link').getBoundingClientRect().top >= 0"), true);
  await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter' });
  await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter' });
  assert.equal(await evaluate('document.activeElement.id'), 'main-content');
  assert.equal(await evaluate('location.hash'), initialHash, 'Skipping preserves shared scenario fragments.');
  assert.equal(await text('portfolio'), '$40,000.00');
  assert.equal(await evaluate("document.querySelector('.brand').href"), base, 'Home link stays inside the project path');
  assert.equal(await text('scenario-hold-value'), '$7,500.00');
  assert.equal(await text('scenario-lp-value'), '$7,171.07');
  assert.equal(await text('scenario-break-even'), '$428.93');
  assert.equal(await text('scenario-lp-eth'), '0.883883 ETH');
  await evaluate("document.querySelector('[data-price-multiple=\"1\"]').click()");
  assert.equal(await text('scenario-lp-value'), '$5,100.00');
  assert.equal(await text('scenario-hold-value'), '$5,000.00');
  await fill('scenario-fees', '');
  assert.equal(await text('scenario-lp-value'), '$5,000.00');
  await fill('scenario-investment', '-1');
  assert.equal(await evaluate("document.getElementById('scenario-share').disabled"), true);
  assert.equal(await evaluate("document.getElementById('scenario-results').hidden"), true);
  assert.equal(await evaluate("document.getElementById('scenario-comparison-card').hidden"), true);
  await click('scenario-reset');
  await evaluate("document.querySelector('#scenario-comparisons tr:first-child button').click()");
  assert.equal(await text('scenario-hold-value'), '$3,750.00');
  assert.equal(await text('scenario-lp-value'), '$3,635.53');
  await click('scenario-reset');
  const chart = await evaluate("document.getElementById('scenario-lp-path').getAttribute('d')");
  await fill('scenario-future', '3000');
  assert.equal(await text('scenario-hold-value'), '$6,250.00');
  assert.equal(await evaluate("document.querySelectorAll('#scenario-comparisons tr').length"), 4);
  await fill('scenario-fees', '250');
  assert.notEqual(await evaluate("document.getElementById('scenario-lp-path').getAttribute('d')"), chart);
  await evaluate("Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (value) => { window.copiedScenarioLink = value; } } });");
  await click('scenario-share');
  const sharedURL = await evaluate("document.getElementById('scenario-share-url').value");
  assert.equal(await evaluate('window.copiedScenarioLink'), sharedURL);
  assert.ok(sharedURL.includes('scenario=cp50-v1'));
  assert.ok(!sharedURL.includes('wallet'));
  assert.match(await text('scenario-share-status'), /copied/);

  await call('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: profile, eventsEnabled: true });
  const exported = nextEvent('Browser.downloadWillBegin');
  const completed = new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.removeEventListener('message', listener); reject(new Error('CSV download timed out')); }, 15000);
    const listener = ({ data }) => {
      const message = JSON.parse(data);
      if (message.method !== 'Browser.downloadProgress' || message.params.state !== 'completed') return;
      clearTimeout(timer);
      socket.removeEventListener('message', listener);
      resolve();
    };
    socket.addEventListener('message', listener);
  });
  await click('scenario-export');
  const download = await exported;
  await completed;
  assert.equal(download.suggestedFilename, 'degenerator-liquidity-scenarios-cp50-v1.csv');
  const csv = await readFile(join(profile, download.suggestedFilename), 'utf8');
  assert.ok(csv.startsWith('model,investment_usd,'));
  assert.ok(csv.includes('cp50-v1,5000,2000,3000,250,'));
  console.log('PASS: scenario reference values, presets, comparisons, validation, chart updates, share copy, and CSV download');
  await evaluate("document.querySelector('[data-experiment=double]').click()");
  assert.equal(await evaluate("document.getElementById('scenario-fees').value"), '0');
  assert.equal(await text('scenario-lp-value'), '$7,071.07');
  await evaluate("document.querySelector('[data-experiment=half]').click()");
  assert.equal(await text('scenario-hold-value'), '$3,750.00');
  await evaluate("document.querySelector('[data-experiment=break-even]').click()");
  assert.match(await text('scenario-verdict'), /same value/);
  await click('pool-example');
  await evaluate("new Promise((resolve, reject) => { const deadline = Date.now() + 10000; const check = () => { if (!document.getElementById('pool-result').hidden) resolve(); else if (Date.now() > deadline) reject(new Error('Snapshot did not load')); else setTimeout(check, 50); }; check(); })");
  assert.match(await text('pool-evidence'), /Recorded example/);
  const snapshotPrice = await text('pool-price');
  await click('pool-apply');
  assert.match(await text('scenario-origin'), /Ethereum block/);
  assert.equal(await evaluate("document.getElementById('scenario-fees').value"), '0');

  async function downloadFile(id) {
    const begun = nextEvent('Browser.downloadWillBegin');
    const finished = new Promise((resolve, reject) => {
      const timer = setTimeout(() => { socket.removeEventListener('message', listener); reject(new Error('Download timed out: ' + id)); }, 15000);
      const listener = ({ data }) => {
        const message = JSON.parse(data);
        if (message.method !== 'Browser.downloadProgress' || message.params.state !== 'completed') return;
        clearTimeout(timer); socket.removeEventListener('message', listener); resolve();
      };
      socket.addEventListener('message', listener);
    });
    await click(id);
    const info = await begun;
    await finished;
    return join(profile, info.suggestedFilename);
  }
  const snapshotPath = await downloadFile('pool-export');
  const exportedSnapshot = JSON.parse(await readFile(snapshotPath, 'utf8'));
  assert.equal(exportedSnapshot.chainId, 1);
  assert.ok(exportedSnapshot.block.hash.startsWith('0x'));
  await click('scenario-image');
  await evaluate("new Promise((resolve, reject) => { const deadline = Date.now() + 10000; const check = () => { if (!document.getElementById('scenario-card-preview').hidden) resolve(); else if (Date.now() > deadline) reject(new Error('Card did not render')); else setTimeout(check, 50); }; check(); })");
  const card = await readFile(await downloadFile('scenario-image-download'));
  assert.equal(card.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(card.readUInt32BE(16), 1200);
  assert.equal(card.readUInt32BE(20), 720);
  await fill('scenario-fees', '5');
  assert.equal(await evaluate("document.getElementById('scenario-card-preview').hidden"), true);
  await reload();
  assert.equal(await text('pool-price'), snapshotPrice);
  assert.match(await text('pool-evidence'), /not been rechecked/);
  const doc = await call('DOM.getDocument');
  const fileInput = await call('DOM.querySelector', { nodeId: doc.root.nodeId, selector: '#pool-file' });
  const badFile = join(profile, 'bad-snapshot.json');
  await writeFile(badFile, JSON.stringify({ ...exportedSnapshot, version: 99 }));
  await call('DOM.setFileInputFiles', { nodeId: fileInput.nodeId, files: [badFile] });
  await evaluate("new Promise((resolve, reject) => { const deadline = Date.now() + 10000; const check = () => { if (document.getElementById('pool-status').textContent.includes('not a supported')) resolve(); else if (Date.now() > deadline) reject(new Error('Invalid file was not rejected')); else setTimeout(check, 50); }; check(); })");
  assert.equal(await text('pool-price'), snapshotPrice);
  await call('DOM.setFileInputFiles', { nodeId: fileInput.nodeId, files: [snapshotPath] });
  await evaluate("new Promise((resolve, reject) => { const deadline = Date.now() + 10000; const check = () => { if (document.getElementById('pool-status').textContent.includes('Snapshot saved')) resolve(); else if (Date.now() > deadline) reject(new Error('Saved file did not restore')); else setTimeout(check, 50); }; check(); })");
  assert.equal(await text('pool-price'), snapshotPrice);
  await click('scenario-reset');
  await fill('scenario-future', '3000');
  await fill('scenario-fees', '250');
  console.log('PASS: guided experiments, recorded snapshot, explicit price application, JSON export/import, reload, invalid files and PNG download');

  await click('swap-button');
  assert.equal(await text('eth-reserve'), '101.0000');
  assert.equal(await text('activity-count'), '1 action');
  assert.ok((await text('activity')).includes('Swap complete'));
  await navigate(sharedURL);
  const restoredHash = await evaluate('location.hash');
  await evaluate("document.querySelector('.skip-link').focus()");
  await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter' });
  await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter' });
  assert.equal(await evaluate('location.hash'), restoredHash, 'A shared link survives skip navigation.');
  assert.equal(await evaluate("document.getElementById('scenario-future').value"), '3000', await evaluate("location.hash + ' ' + document.getElementById('scenario-link-status').textContent"));
  assert.equal(await evaluate("document.getElementById('scenario-fees').value"), '250');
  assert.equal(await text('scenario-hold-value'), '$6,250.00');
  assert.equal(await text('eth-reserve'), '101.0000');
  assert.equal(await text('activity-count'), '1 action');
  await evaluate("new Promise((resolve) => { addEventListener('hashchange', () => resolve(), { once: true }); location.hash = '#scenario=cp50-v1&investment=5000&start=2000&future=2000&fees=0'; })");
  assert.equal(await text('scenario-hold-value'), '$5,000.00');
  assert.equal(await text('scenario-lp-value'), '$5,000.00');
  await evaluate("Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('Clipboard denied'); } } });");
  await click('scenario-share');
  assert.equal(await evaluate("document.getElementById('scenario-share-wrap').hidden"), false);
  assert.match(await text('scenario-share-status'), /Copy the link/);
  await navigate(base + '#scenario=cp50-v99&investment=5000&start=2000&future=4000&fees=100');
  assert.match(await text('scenario-link-status'), /unsupported/);
  assert.equal(await text('scenario-hold-value'), '$7,500.00');
  assert.equal(await text('eth-reserve'), '101.0000');
  await navigate(base);
  console.log('PASS: shared links restore assumptions without overwriting saved balances; clipboard fallback and invalid links');

  await fill('scenario-future', '3000');
  await fill('scenario-fees', '250');
  await click('lab-range-tab');
  assert.equal(await evaluate("document.getElementById('range-lab').hidden"), false);
  assert.equal(await evaluate("document.getElementById('lp-lab').hidden"), true);
  assert.notEqual(await text('cl-value'), '—', 'The range lab initializes even after opening a full-range link');
  await evaluate("document.getElementById('lab-range-tab').focus()");
  await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowLeft', code: 'ArrowLeft', windowsVirtualKeyCode: 37 });
  await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowLeft', code: 'ArrowLeft', windowsVirtualKeyCode: 37 });
  assert.equal(await evaluate("document.getElementById('lab-full-tab').getAttribute('aria-selected')"), 'true');
  assert.equal(await evaluate("document.activeElement.id"), 'lab-full-tab');
  await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
  await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
  assert.equal(await evaluate("document.getElementById('lab-range-tab').getAttribute('aria-selected')"), 'true');

  for (const [id, value] of [['cl-investment', '5000'], ['cl-start', '4'], ['cl-lower', '1'], ['cl-upper', '9'], ['cl-future', '9'], ['cl-fees', '0'], ['cl-full-fees', '0']]) await fill(id, value);
  assert.equal(await text('cl-hold-value'), '$7,500.00');
  assert.equal(await text('cl-value'), '$6,000.00');
  assert.equal(await text('cl-full-value'), '$7,500.00');
  assert.equal(await text('cl-full-hold'), '$8,125.00');
  assert.equal(await text('cl-state'), 'At the upper edge');
  assert.equal(await text('cl-il'), '−20.00%');
  await evaluate("document.querySelector('[data-range-price=lower]').click()");
  assert.equal(await text('cl-state'), 'At the lower edge');
  assert.equal(await text('cl-asset-state'), 'All ETH');
  assert.equal(await text('cl-value'), '$2,000.00');
  await evaluate("document.querySelector('[data-range-price=below]').click()");
  assert.equal(await text('cl-state'), 'Below range');
  await evaluate("document.querySelector('[data-range-price=above]').click()");
  assert.equal(await text('cl-state'), 'Above range');
  assert.equal(await text('cl-asset-state'), 'All USDC');
  await fill('cl-future', '9');
  await click('cl-match-fees');
  assert.match(await text('cl-verdict'), /same value/);
  assert.ok(Math.abs(await evaluate("Number(document.getElementById('cl-fees').value)") - 1500) < 1e-8);
  await fill('cl-fees', '100');
  await fill('cl-full-fees', '300');
  assert.equal(await text('cl-value'), '$6,100.00');
  assert.equal(await text('cl-full-value'), '$7,800.00');
  assert.equal(await text('cl-il'), '−20.00%');
  await fill('cl-upper', '0');
  assert.equal(await evaluate("document.getElementById('cl-share').disabled"), true);
  assert.equal(await evaluate("document.getElementById('cl-invalid').hidden"), false);
  await fill('cl-upper', '9');
  await fill('cl-lower', '9');
  assert.match(await text('cl-error'), /upper price/);
  await fill('cl-lower', '1');
  const sliderDomain = await evaluate("({ min: document.getElementById('cl-explorer').min, max: document.getElementById('cl-explorer').max })");
  await fill('cl-explorer', '6.25');
  assert.equal(await evaluate("document.getElementById('cl-future').value"), '6.25');
  assert.deepEqual(await evaluate("({ min: document.getElementById('cl-explorer').min, max: document.getElementById('cl-explorer').max })"), sliderDomain);
  assert.equal(await text('cl-state'), 'In range');
  assert.equal(await text('cl-value'), '$5,850.00');
  await click('lab-full-tab');
  assert.equal(await evaluate("document.getElementById('scenario-future').value"), '3000');
  assert.equal(await evaluate("document.getElementById('scenario-fees').value"), '250');
  await click('lab-range-tab');
  assert.equal(await evaluate("document.getElementById('cl-future').value"), '6.25');
  await evaluate("Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (value) => { window.copiedRangeLink = value; } } });");
  await click('cl-share');
  const rangeSharedURL = await evaluate("document.getElementById('cl-share-url').value");
  assert.equal(await evaluate("window.copiedRangeLink"), rangeSharedURL);
  assert.ok(rangeSharedURL.includes('scenario=cl-range-v1') && rangeSharedURL.includes('lower=1') && rangeSharedURL.includes('upper=9') && rangeSharedURL.includes('fullfees=300'));
  const rangeCSVPath = await downloadFile('cl-export');
  const [rangeHeaders, ...rangeRows] = (await readFile(rangeCSVPath, 'utf8')).trim().split('\r\n').map((row) => row.split(','));
  const exportedRow = rangeRows.find((row) => row[rangeHeaders.indexOf('future_eth_price_usd')] === '6.25');
  const rangeData = Object.fromEntries(rangeHeaders.map((key, i) => [key, exportedRow[i]]));
  assert.equal(rangeData.model, 'cl-range-v1');
  assert.ok(Math.abs(Number(rangeData.hold_range_initial_tokens_usd) - 6125) < 1e-8);
  assert.ok(Math.abs(Number(rangeData.range_lp_with_fees_usd) - 5850) < 1e-8);
  assert.ok(Math.abs(Number(rangeData.full_range_own_50_50_hold_usd) - 6406.25) < 1e-8);
  await click('cl-image');
  await evaluate("new Promise((resolve, reject) => { const deadline = Date.now() + 10000; const check = () => { if (!document.getElementById('cl-card-preview').hidden) resolve(); else if (Date.now() > deadline) reject(new Error('Range card did not render')); else setTimeout(check, 50); }; check(); })");
  const rangePNG = await readFile(await downloadFile('cl-image-download'));
  assert.equal(rangePNG.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(rangePNG.readUInt32BE(16), 1200);
  assert.equal(rangePNG.readUInt32BE(20), 900);
  await fill('cl-future', '6');
  assert.equal(await evaluate("document.getElementById('cl-card-preview').hidden"), true);
  await click('pool-apply-range');
  assert.equal(await evaluate("document.getElementById('lab-range-tab').getAttribute('aria-selected')"), 'true');
  assert.match(await text('cl-origin'), /Uniswap v2/);
  assert.equal(await evaluate("document.getElementById('cl-fees').value"), '0');
  assert.equal(await evaluate("document.getElementById('cl-full-fees').value"), '0');
  await navigate(rangeSharedURL);
  assert.equal(await evaluate("document.getElementById('range-lab').hidden"), false);
  assert.equal(await evaluate("document.getElementById('cl-future').value"), '6.25');
  assert.equal(await text('cl-value'), '$5,850.00');
  assert.equal(await text('cl-full-value'), '$6,550.00');
  assert.ok(!(await text('scenario-link-status')).includes('unsupported'));
  assert.equal(await text('eth-reserve'), '101.0000');
  assert.equal(await text('activity-count'), '1 action');
  await evaluate("Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('denied'); } } });");
  await click('cl-share');
  assert.match(await text('cl-share-status'), /Copy the link/);
  await navigate(base + '#scenario=cl-range-v1&investment=5000&start=2000&future=2100&lower=1800&upper=2200&fees=0');
  assert.match(await text('cl-link-status'), /missing/);
  assert.equal(await evaluate("document.getElementById('cl-future').value"), '2100');
  await navigate(base);
  console.log('PASS: range reference math, exact edges, slider stability, independent fees, validation, keyboard tabs, preserved setups, CSV/PNG downloads, snapshot seeding and shared range restoration');
  await checkPositions({ base, call, evaluate, click, fill, text, reload, navigate, downloadFile, profile });

  const swappedPortfolio = await text('portfolio');
  await reload();
  assert.equal(await text('eth-reserve'), '101.0000');
  assert.equal(await text('portfolio'), swappedPortfolio);
  assert.equal(await text('activity-count'), '1 action');
  assert.ok((await text('activity')).includes('Swap complete'));
  await click('reverse');
  assert.equal(await text('output-token'), 'ETH');
  await click('swap-button');
  assert.equal(await text('activity-count'), '2 actions');
  await fill('swap-amount', '999999');
  assert.equal(await evaluate("document.getElementById('swap-button').disabled"), true);
  assert.match(await text('swap-error'), /funds/);
  await fill('swap-amount', '-1');
  assert.match(await text('swap-error'), /positive/);
  console.log('PASS: swap, reversed swap, activity log, and input validation');

  await click('reset');
  await click('lp-tab');
  assert.equal(await evaluate("document.getElementById('lp-panel').hidden"), false);
  await click('deposit-button');
  assert.equal(await text('share'), '0.99%');
  assert.equal(await text('eth-reserve'), '101.0000');
  const lpBalance = await text('lp-balance');
  await reload();
  assert.equal(await text('share'), '0.99%');
  assert.equal(await text('lp-balance'), lpBalance);
  await click('lp-tab');
  await click('withdraw');
  assert.equal(await text('share'), '0.00%');
  assert.equal(await text('portfolio'), '$40,000.00');
  assert.equal(await text('eth-reserve'), '100.0000');
  assert.equal(await evaluate("document.getElementById('withdraw').disabled"), true);
  await reload();
  assert.equal(await text('share'), '0.00%');
  assert.equal(await text('portfolio'), '$40,000.00');
  assert.equal(await text('activity-count'), '2 actions');
  console.log('PASS: liquidity deposit and withdrawal through the interface');

  await fill('price-ratio', '1');
  assert.equal(await text('loss'), '0.00%');
  await fill('price-ratio', '4');
  assert.equal(await text('loss'), '−20.00%');
  await click('reset');
  assert.equal(await text('loss'), '−5.72%');
  assert.equal(await text('activity-count'), '0 actions');
  assert.equal(await text('portfolio'), '$40,000.00');
  assert.equal(await evaluate("localStorage.getItem('defi-sandbox-v1')"), null);
  await reload();
  assert.equal(await text('activity-count'), '0 actions');
  assert.equal(await text('portfolio'), '$40,000.00');
  console.log('PASS: balances, LP ownership, and activity survive reload; reset stays cleared');

  await evaluate("localStorage.setItem('defi-sandbox-v1', '{broken')");
  await reload();
  assert.equal(await text('portfolio'), '$40,000.00');
  assert.match(await text('storage-status'), /invalid/);
  assert.equal(await evaluate("localStorage.getItem('defi-sandbox-v1')"), null);
  const blockedStorageScript = await call('Page.addScriptToEvaluateOnNewDocument', { source: "Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Storage blocked', 'SecurityError'); } });" });
  await reload();
  assert.match(await text('storage-status'), /unavailable/);
  await click('swap-button');
  assert.equal(await text('eth-reserve'), '101.0000');
  assert.equal(await text('activity-count'), '1 action');
  await click('reset');
  assert.equal(await text('portfolio'), '$40,000.00');
  await call('Page.removeScriptToEvaluateOnNewDocument', { identifier: blockedStorageScript.identifier });
  await reload();
  const quotaScript = await call('Page.addScriptToEvaluateOnNewDocument', { source: "Storage.prototype.setItem = function () { throw new DOMException('Storage full', 'QuotaExceededError'); };" });
  await reload();
  await click('swap-button');
  assert.equal(await text('eth-reserve'), '101.0000');
  assert.match(await text('storage-status'), /unavailable/);
  await call('Page.removeScriptToEvaluateOnNewDocument', { identifier: quotaScript.identifier });
  await reload();
  assert.equal(await text('portfolio'), '$40,000.00');
  console.log('PASS: damaged data, blocked storage, and full storage do not break the app');
  assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true);
  await fill('scenario-future', '1000');
  assert.equal(await text('scenario-hold-value'), '$3,750.00');
  assert.equal(await text('scenario-lp-value'), '$3,635.53');
  await click('scenario-reset');
  console.log('PASS: impermanent-loss scenarios, reset, and desktop layout');

  if (process.env.SCREENSHOT_PATH) {
    const screenshot = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    await writeFile(process.env.SCREENSHOT_PATH, Buffer.from(screenshot.data, 'base64'));
  }
  await call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true);
  await fill('scenario-future', '1000');
  assert.equal(await text('scenario-hold-value'), '$3,750.00');
  await click('scenario-share');
  assert.ok((await evaluate("document.getElementById('scenario-share-url').value")).includes('future=1000'));
  assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true);
  await click('scenario-reset');
  await click('swap-button');
  assert.equal(await text('activity-count'), '1 action');
  await click('lab-range-tab');
  assert.equal(await evaluate("document.getElementById('cl-setup-details').open"), false);
  assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true);
  await click('cl-setup-summary');
  assert.equal(await evaluate("document.getElementById('cl-setup-details').open"), true);
  await evaluate("Array.from(document.querySelectorAll('[data-range-width]')).find(button => button.dataset.rangeWidth === '0.05').click()");
  assert.equal(await evaluate("document.getElementById('cl-lower').value"), '1900');
  await click('cl-close-setup');
  assert.equal(await evaluate("document.getElementById('cl-setup-details').open"), false);
  await evaluate("document.querySelector('[data-range-price=above]').click()");
  assert.equal(await text('cl-state'), 'Above range');
  assert.equal(await text('cl-asset-state'), 'All USDC');
  await click('cl-share');
  assert.ok((await evaluate("document.getElementById('cl-share-url').value")).includes('lower=1900'));
  assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true);
  await click('cl-reset');
  await click('lab-full-tab');
  console.log('PASS: mobile range setup disclosure, price checkpoints, sharing and lab switching');
  await checkMobilePositions({ evaluate, click, fill, text });
  assert.deepEqual(errors, [], 'No uncaught browser errors');
  console.log('PASS: mobile layout and interaction; no uncaught browser errors');
} finally {
  socket?.close();
  for (const task of pending.values()) clearTimeout(task.timer);
  for (const child of children.reverse()) {
    if (child.exitCode === null) {
      const stopped = once(child, 'exit');
      child.kill('SIGTERM');
      const force = setTimeout(() => child.kill('SIGKILL'), 3000);
      await stopped;
      clearTimeout(force);
    }
  }
  await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}
