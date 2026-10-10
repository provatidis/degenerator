import { fetchPoolSnapshot } from '../data/uniswap-v2.js';
import { parseSnapshot, snapshotJSON, snapshotView, readSavedSnapshot, saveSnapshot, MAX_SNAPSHOT_BYTES } from '../data/snapshot.js';
import { LIMITS } from '../models/cp50-v1.js';
import { LIMITS as RANGE_LIMITS } from '../models/cl-range-v1.js';
import { fmt, usd } from '../lib/format.js';
import { downloadBlob } from '../lib/download.js';

export function initPoolSnapshots({ fullRangeLab, rangeLab }) {
  const { setStartingPrice } = fullRangeLab;
  const { setStartingPrice: setRangeStartingPrice } = rangeLab;
  const $ = (id) => document.getElementById(id);
  let current = null;
  let busy = false;
  function controls() {
    $('pool-fetch').disabled = busy;
    $('pool-example').disabled = busy;
    $('pool-file').disabled = busy;
    $('pool-export').disabled = busy || !current;
    const price = current ? snapshotView(current).ethPrice : 0;
    $('pool-apply').disabled = busy || !current || price < LIMITS.initialPrice.min || price * 2 > LIMITS.futurePrice.max;
    $('pool-apply-range').disabled = busy || !current || price < RANGE_LIMITS.initialPrice.min || price > RANGE_LIMITS.initialPrice.max;
    $('pool-lab').setAttribute('aria-busy', String(busy));
  }
  function display(snapshot, evidence) {
    const view = snapshotView(snapshot);
    current = view.snapshot;
    $('pool-empty').hidden = true;
    $('pool-result').hidden = false;
    $('pool-price').textContent = usd(view.ethPrice);
    $('pool-reserve-eth').textContent = fmt(view.eth, 6) + ' WETH';
    $('pool-reserve-usdc').textContent = fmt(view.usdc) + ' USDC';
    $('pool-quote').textContent = '1 WETH → ' + fmt(view.quoteUSDC, 6) + ' USDC, after the 0.3% swap fee.';
    $('pool-block').textContent = 'Block ' + current.block.number + ' · ' + new Date(current.block.timestamp * 1000).toISOString().replace('T', ' ').replace('.000Z', ' UTC');
    $('pool-block').href = 'https://etherscan.io/block/' + current.block.number;
    $('pool-evidence').textContent = evidence === 'live'
      ? 'Pool identity and integer quote checked against the contracts at this finalized block.'
      : evidence === 'example'
        ? 'Recorded example. The original contract check is saved with this snapshot; it is not current market data.'
        : 'Saved file. Its numbers pass local checks; its chain data has not been rechecked.';
    const values = {
      'pool-address': current.poolAddress, 'pool-hash': current.block.hash,
      'pool-token0': current.tokens[0].address + ' · 6 decimals',
      'pool-token1': current.tokens[1].address + ' · 18 decimals',
      'pool-raw0': current.reserves.reserve0, 'pool-raw1': current.reserves.reserve1,
      'pool-captured': current.capturedAt,
    };
    for (const [id, value] of Object.entries(values)) $(id).textContent = value;
    controls();
  }
  async function loadSnapshot(loader, evidence) {
    if (busy) return;
    busy = true;
    controls();
    $('pool-status').textContent = evidence === 'live' ? 'Reading a finalized Ethereum block and checking the pool…' : 'Opening the snapshot…';
    try {
      const snapshot = await loader();
      display(snapshot, evidence);
      const saved = saveSnapshot(current);
      $('pool-status').textContent = saved ? 'Snapshot saved in this browser. Apply its price when you are ready.' : 'Snapshot loaded. Browser saving is unavailable; export the file to keep it.';
    } catch (error) {
      $('pool-status').textContent = error.message + (current ? ' Your previous snapshot is still available.' : '');
    } finally { busy = false; controls(); }
  }
  $('pool-fetch').addEventListener('click', () => loadSnapshot(() => fetchPoolSnapshot(), 'live'));
  $('pool-example').addEventListener('click', () => loadSnapshot(async () => {
    const response = await fetch(new URL('../examples/uniswap-v2-mainnet.json', import.meta.url));
    if (!response.ok) throw new Error('The recorded example could not be loaded.');
    return parseSnapshot(await response.text());
  }, 'example'));
  $('pool-file').addEventListener('change', () => {
    const file = $('pool-file').files[0];
    $('pool-file').value = '';
    if (!file) return;
    loadSnapshot(async () => {
      if (file.size > MAX_SNAPSHOT_BYTES) throw new Error('Snapshot files must be at most 64 KB.');
      return parseSnapshot(await file.text());
    }, 'file');
  });
  $('pool-export').addEventListener('click', () => {
    if (current) downloadBlob(new Blob([snapshotJSON(current)], { type: 'application/json' }), 'degenerator-ethereum-uniswap-v2-block-' + current.block.number + '.json');
  });
  $('pool-apply').addEventListener('click', () => {
    if (!current) return;
    try {
      setStartingPrice(snapshotView(current).ethPrice, 'Starting price from the saved WETH/USDC pool at Ethereum block ' + current.block.number + '. USDC is assumed to be $1; this is a pool reserve ratio, not an external price feed.');
      $('pool-status').textContent = 'Snapshot price applied. Future ETH price is set to 2× and assumed fee income to $0. Your virtual swap balances are unchanged.';
    } catch (error) { $('pool-status').textContent = error.message; }
  });
  $('pool-apply-range').addEventListener('click', () => {
    if (!current) return;
    try {
      setRangeStartingPrice(snapshotView(current).ethPrice, 'Starting price from the saved Uniswap v2 WETH/USDC snapshot at Ethereum block ' + current.block.number + '. This seeds a hypothetical range position; the reserve ratio assumes USDC = $1.');
      $('pool-status').textContent = 'Snapshot price applied to the range lab with a fresh range and zero assumed fees. Your saved swap sandbox is unchanged.';
    } catch (error) { $('pool-status').textContent = error.message; }
  });
  const restored = readSavedSnapshot();
  if (restored.snapshot) {
    display(restored.snapshot, 'saved');
    $('pool-status').textContent = 'Restored the last saved snapshot. Fetch a new one to refresh the data.';
  } else if (restored.status === 'unavailable') {
    $('pool-status').textContent = 'A saved snapshot could not be restored. Fetch a new snapshot or open a file.';
  }
  controls();
}
