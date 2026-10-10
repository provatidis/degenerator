import { fetchPositionSnapshot } from '../data/uniswap-v3.js';
import { positionId, parsePositionSnapshot, positionSnapshotJSON, positionSnapshotView, positionScenario, readSavedPosition, savePositionSnapshot, MAX_SNAPSHOT_BYTES } from '../data/position-snapshot.js';
import { formatUnits } from '../models/units.js';
import { POSITION_STATES, positionPrice, positionPriceLabels, positionTokenAmount } from '../lib/position-presentation.js';
import { usd, fmt } from '../lib/format.js';
import { downloadBlob } from '../lib/download.js';

export function initPositionSnapshots({ rangeLab }) {
  const $ = id => document.getElementById(id);
  let current = null, view = null, scenario = null, busy = false;
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
    for (const id of ['position-id', 'position-example', 'position-file']) $(id).disabled = busy;
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
    $('position-allocation-eth').setAttribute('width', share);
    $('position-allocation-bar').hidden = view.principalUSD === 0;
    $('position-allocation-title').textContent = view.state === 'inactive' ? 'No active principal.' : fmt(share, 1) + '% WETH and ' + fmt(100 - share, 1) + '% USDC by value, excluding fees and recorded tokens owed.';
    $('position-allocation-note').textContent = view.state === 'inactive' ? 'No active principal' : fmt(share, 1) + '% WETH · ' + fmt(100 - share, 1) + '% USDC by value';
    $('position-evidence').textContent = evidence === 'live'
      ? 'Position manager, pool identity, decimals and block checked against the contracts.'
      : evidence === 'example' ? 'Recorded example. Captured from the contracts at this block; it is not current market data.'
      : 'Saved file. Its numbers pass local checks; its chain data has not been rechecked.';
    try {
      scenario = positionScenario(current);
      $('position-apply-note').textContent = 'Start a new experiment at this snapshot’s price, principal value and range, with zero assumed fees. This does not reconstruct the original deposit or past returns.';
    } catch (error) { scenario = null; $('position-apply-note').textContent = error.message; }
    const exact = {
      'position-manager': current.positionManager, 'position-pool': current.poolAddress,
      'position-hash': current.block.hash, 'position-ticks': current.position.tickLower + ' → ' + current.position.tickUpper,
      'position-current-tick': current.pool.tick, 'position-spacing': current.pool.tickSpacing,
      'position-liquidity': current.position.liquidity, 'position-sqrt': current.pool.sqrtPriceX96,
      'position-raw0': current.principal.amount0Raw, 'position-raw1': current.principal.amount1Raw,
      'position-owed0': formatUnits(BigInt(current.position.tokensOwed0), 6) + ' USDC',
      'position-owed1': formatUnits(BigInt(current.position.tokensOwed1), 18) + ' WETH',
      'position-captured': current.capturedAt,
    };
    for (const [id, value] of Object.entries(exact)) $(id).textContent = value;
    $('position-details').hidden = false;
    if (setupMedia.matches) $('position-setup').open = false;
    controls();
  }
  async function load(loader, evidence) {
    if (busy) return;
    busy = true; controls();
    $('position-status').dataset.error = 'false';
    $('position-status').textContent = evidence === 'live' ? 'Reading your position…' : 'Opening the position snapshot…';
    try {
      display(await loader(), evidence);
      if (setupMedia.matches) $('position-result').focus({ preventScroll: true });
      $('position-status').textContent = savePositionSnapshot(current)
        ? 'Position saved in this browser. Explore it in the range lab when you’re ready.'
        : 'Position loaded. Browser saving is unavailable; export the file to keep it.';
    } catch (error) {
      $('position-status').dataset.error = 'true';
      $('position-status').textContent = error.message + (current ? ' Your previous position is still available.' : ' Check the NFT ID or try the recorded example.');
    } finally { busy = false; controls(); }
  }
  $('position-form').addEventListener('submit', event => {
    event.preventDefault();
    load(() => fetchPositionSnapshot($('position-id').value, { onProgress: message => { $('position-status').textContent = message; } }), 'live');
  });
  $('position-id').addEventListener('input', controls);
  $('position-example').addEventListener('click', () => load(async () => {
    const response = await fetch(new URL('../examples/uniswap-v3-mainnet-37.json', import.meta.url));
    if (!response.ok) throw new Error('The recorded position could not be loaded.');
    return parsePositionSnapshot(await response.text());
  }, 'example'));
  $('position-file').addEventListener('change', () => {
    const file = $('position-file').files[0]; $('position-file').value = '';
    if (file) load(async () => {
      if (file.size > MAX_SNAPSHOT_BYTES) throw new Error('Snapshot files must be at most 64 KB.');
      return parsePositionSnapshot(await file.text());
    }, 'file');
  });
  $('position-export').addEventListener('click', () => {
    if (current) downloadBlob(new Blob([positionSnapshotJSON(current)], { type: 'application/json' }), 'degenerator-uniswap-v3-position-' + current.tokenId + '-block-' + current.block.number + '.json');
  });
  $('position-apply').addEventListener('click', () => {
    if (!scenario) return;
    rangeLab.setScenario(scenario, 'Experiment starts from Uniswap v3 position #' + current.tokenId + ' at Ethereum block ' + current.block.number + '. It uses the recorded principal and range, assumes USDC = $1 and uses the continuous lab model for future prices. Past deposits and fee history are not reconstructed.');
    $('position-status').textContent = 'Position applied to the range lab. Move the future price to explore its next outcome.';
  });
  const saved = readSavedPosition();
  if (saved.snapshot) { display(saved.snapshot, 'saved'); $('position-status').textContent = 'Restored the last saved position. Fetch again to refresh its chain data.'; }
  else if (saved.status === 'unavailable') $('position-status').textContent = 'A saved position could not be restored. Fetch a position or open a file.';
  controls();
}
