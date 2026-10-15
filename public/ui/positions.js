import { clearSnapshot } from '../data/snapshot-store.js';
import { fetchPositionSnapshot } from '../data/uniswap-v3.js';
import { positionId, parsePositionSnapshot, positionSnapshotJSON, positionSnapshotView, positionScenario, readSavedPosition, savePositionSnapshot, POSITION_SNAPSHOT_KEY, MAX_SNAPSHOT_BYTES } from '../data/position-snapshot.js';
import { formatUnits } from '../models/units.js';
import { POSITION_STATES, positionPrice, positionPriceLabels, positionTokenAmount } from '../lib/position-presentation.js';
import { usd, fmt } from '../lib/format.js';
import { downloadBlob } from '../lib/download.js';

export function initPositionSnapshots({ rangeLab, positionFees }) {
  const $ = id => document.getElementById(id);
  let current = null, view = null, scenario = null, busy = false, pendingLoad = Promise.resolve();
  const setupMedia = matchMedia('(max-width: 750px)');
  function syncSetup() {
    if (!setupMedia.matches || !current) $('position-setup').open = true;
    else if (!$('position-setup').contains(document.activeElement)) $('position-setup').open = false;
  }
  setupMedia.addEventListener('change', syncSetup);
  syncSetup();
  function controls() {
    let valid = true;
    try { positionId($('position-id').value); } catch { valid = false; }
    $('position-id').setAttribute('aria-invalid', String(!valid));
    $('position-fetch').disabled = busy || !valid;
    for (const id of ['position-id', 'position-example', 'position-example-inside', 'position-example-fees', 'position-file', 'position-clear-saved']) $(id).disabled = busy;
    $('position-export').disabled = busy || !current;
    $('position-apply').disabled = busy || !scenario;
    $('position-lab').setAttribute('aria-busy', String(busy));
  }
  function display(snapshot, evidence) {
    view = positionSnapshotView(snapshot);
    current = view.snapshot;
    $('position-empty').hidden = true;
    $('position-result').hidden = false;
    $('position-id').value = current.tokenId;
    $('position-heading-id').textContent = 'Position #' + current.tokenId;
    $('position-setup-overview').textContent = 'Position #' + current.tokenId;
    $('position-fee').textContent = fmt(current.position.fee / 10000, current.position.fee === 100 ? 2 : 1) + '% pool fee';
    $('position-block').textContent = 'Block ' + current.block.number + ' · ' + new Date(current.block.timestamp * 1000).toISOString().replace('T', ' ').replace('.000Z', ' UTC');
    $('position-block').href = 'https://etherscan.io/block/' + current.block.number;
    $('position-principal').textContent = view.principalUSD > 0 && view.principalUSD < 0.01 ? '<$0.01' : usd(view.principalUSD);
    $('position-eth').textContent = positionTokenAmount(view.eth, 'WETH');
    $('position-usdc').textContent = positionTokenAmount(view.usdc, 'USDC');
    const copy = POSITION_STATES[view.state];
    $('position-state').textContent = copy.title;
    $('position-state').dataset.state = view.state;
    $('position-state-note').textContent = copy.note;
    const prices = positionPriceLabels(view.lowerPrice, view.upperPrice);
    $('position-lower').textContent = prices.lower;
    $('position-upper').textContent = prices.upper;
    $('position-price').textContent = positionPrice(view.ethPrice);
    const share = view.principalUSD > 0 ? view.eth * view.ethPrice / view.principalUSD * 100 : 0;
    $('position-allocation-eth').setAttribute('width', share + '%');
    $('position-allocation-bar').hidden = view.principalUSD === 0;
    $('position-allocation-title').textContent = view.state === 'inactive' ? 'No position principal.' : fmt(share, 1) + '% WETH and ' + fmt(100 - share, 1) + '% USDC by value, excluding fees and recorded tokens owed.';
    $('position-eth-share').textContent = fmt(share, 1) + '% WETH';
    $('position-usdc-share').textContent = fmt(100 - share, 1) + '% USDC';
    $('position-allocation-weth').hidden = $('position-allocation-usdc').hidden = view.state === 'inactive';
    $('position-allocation-basis').textContent = view.state === 'inactive' ? 'No position principal' : 'By asset value';
    $('position-evidence').textContent = evidence === 'live'
      ? 'Position manager, pool identity, decimals, fee growth and block checked against the contracts.'
      : evidence === 'example' ? 'Recorded example. Captured from the contracts at this block; it is not current market data.'
      : 'Saved file. Its numbers pass local checks; its chain data has not been rechecked.';
    try {
      scenario = positionScenario(current);
      $('position-apply-note').textContent = 'Start a principal-only experiment at this snapshot’s price and range, with zero assumed future fees. Already collectable tokens remain separate from both strategies. This does not reconstruct the original deposit or past returns.';
    } catch (error) { scenario = null; $('position-apply-note').textContent = error.message; }
    const exact = {
      'position-manager': current.positionManager, 'position-pool': current.poolAddress,
      'position-hash': current.block.hash, 'position-ticks': current.position.tickLower + ' → ' + current.position.tickUpper,
      'position-current-tick': current.pool.tick, 'position-spacing': current.pool.tickSpacing,
      'position-liquidity': current.position.liquidity, 'position-sqrt': current.pool.sqrtPriceX96,
      'position-raw0': current.principal.amount0Raw, 'position-raw1': current.principal.amount1Raw,
      'position-owed0': formatUnits(BigInt(current.position.tokensOwed0), 6) + ' USDC',
      'position-owed1': formatUnits(BigInt(current.position.tokensOwed1), 18) + ' WETH',
      'position-captured': current.capturedAt, 'position-provider': current.provider,
    };
    for (const [id, value] of Object.entries(exact)) $(id).textContent = value;
    positionFees.render(view, { canExplore: Boolean(scenario) });
    $('position-details').hidden = false;
    if (setupMedia.matches) $('position-setup').open = false;
    controls();
  }
  function load(loader, evidence) {
    if (busy) return pendingLoad;
    pendingLoad = performLoad(loader, evidence);
    return pendingLoad;
  }
  async function performLoad(loader, evidence) {
    busy = true; controls();
    $('position-status').dataset.error = 'false';
    $('position-status').textContent = evidence === 'live' ? 'Reading your position…' : 'Opening the position snapshot…';
    try {
      display(await loader(), evidence);
      if (setupMedia.matches) $('position-result').focus({ preventScroll: true });
      const saved = savePositionSnapshot(current);
      if (saved) $('position-clear-saved').hidden = true;
      $('position-status').textContent = saved
        ? 'Position saved in this browser. Explore it in the range lab when you’re ready.'
        : 'Position loaded. Browser saving is unavailable; export the file to keep it.';
      return true;
    } catch (error) {
      $('position-status').dataset.error = 'true';
      $('position-status').textContent = error.message + (current ? ' Your previous position is still available.' : ' Check the NFT ID or try the recorded example.');
      return false;
    } finally { busy = false; controls(); }
  }
  function clearExampleLink() {
    if (location.hash.startsWith('#example=')) history.replaceState(null, '', location.pathname + location.search + '#position-lab');
  }
  $('position-form').addEventListener('submit', event => {
    event.preventDefault(); clearExampleLink();
    load(() => fetchPositionSnapshot($('position-id').value, { onProgress: message => { $('position-status').textContent = message; } }), 'live');
  });
  $('position-id').addEventListener('input', controls);
  const recordedFiles = { inside: 'uniswap-v3-mainnet-in-range.json', outside: 'uniswap-v3-mainnet-37.json', fees: 'uniswap-v3-mainnet-fees.json' };
  async function loadRecordedExample(kind) {
    if (!Object.hasOwn(recordedFiles, kind)) throw new Error('Choose a supported recorded example.');
    if (busy) await pendingLoad;
    const loaded = await load(async () => {
      const response = await fetch(new URL('../examples/' + recordedFiles[kind], import.meta.url));
      if (!response.ok) throw new Error('The recorded position could not be loaded.');
      return parsePositionSnapshot(await response.text());
    }, 'example');
    if (loaded && kind === 'fees' && view?.fees) positionFees.openExample();
  }
  $('position-example').addEventListener('click', () => { clearExampleLink(); loadRecordedExample('outside'); });
  $('position-example-fees').addEventListener('click', () => { clearExampleLink(); loadRecordedExample('fees'); });
  $('position-example-inside').addEventListener('click', () => { clearExampleLink(); loadRecordedExample('inside'); });
  $('position-file').addEventListener('change', () => {
    const file = $('position-file').files[0]; $('position-file').value = '';
    if (file) { clearExampleLink(); load(async () => {
      if (file.size > MAX_SNAPSHOT_BYTES) throw new Error('Snapshot files must be at most 64 KB.');
      return parsePositionSnapshot(await file.text());
    }, 'file'); }
  });
  $('position-export').addEventListener('click', () => {
    if (current) downloadBlob(new Blob([positionSnapshotJSON(current)], { type: 'application/json' }), 'passiko-uniswap-v3-position-' + current.tokenId + '-block-' + current.block.number + '.json');
  });
  $('position-apply').addEventListener('click', () => {
    if (!scenario) return;
    rangeLab.setScenario(scenario, 'Experiment starts from Uniswap v3 position #' + current.tokenId + ' at Ethereum block ' + current.block.number + '. It compares the recorded principal and range, leaves already collectable tokens outside both strategies, assumes USDC = $1 and uses the continuous lab model for future prices. Past deposits and fee history are not reconstructed.', { kind: 'position', snapshot: current });
    $('position-status').textContent = 'Position applied to the range lab. Move the future price to explore its next outcome.';
  });
  const saved = readSavedPosition();
  if (saved.snapshot) { display(saved.snapshot, 'saved'); $('position-status').textContent = 'Restored the last saved position. Fetch again to refresh its chain data.'; }
  else if (saved.status === 'unavailable') $('position-status').textContent = 'Browser storage is unavailable. You can load and export a position in this tab.';
  else if (saved.status === 'invalid' || saved.status === 'incompatible') {
    $('position-status').textContent = saved.status === 'incompatible'
      ? 'The saved position uses an unsupported snapshot version. It has been kept in storage; open a compatible file or explicitly discard it.'
      : 'The saved position is unreadable. It has been kept in storage; open another snapshot or discard this saved copy.';
    $('position-clear-saved').hidden = false;
  }
  $('position-clear-saved').addEventListener('click', () => {
    if (clearSnapshot(POSITION_SNAPSHOT_KEY)) {
      $('position-clear-saved').hidden = true;
      $('position-status').textContent = 'Unreadable saved position discarded. Your other snapshots, lessons and virtual balances are unchanged.';
    } else $('position-status').textContent = 'Browser storage is unavailable; the saved position could not be discarded.';
  });
  controls();
  return { loadRecordedExample };
}
