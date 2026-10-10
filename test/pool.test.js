import test from 'node:test';
import assert from 'node:assert/strict';
import { amountOut, formatUnits } from '../public/models/uniswap-v2.js';
import { POOL, RPC_URL } from '../public/data/config.js';
import { fetchPoolSnapshot } from '../public/data/uniswap-v2.js';
import { validateSnapshot, parseSnapshot, snapshotJSON, snapshotView, saveSnapshot, readSavedSnapshot, SNAPSHOT_KEY } from '../public/data/snapshot.js';
import { createRpcClient } from '../public/data/rpc.js';

const word = (n) => (typeof n === 'bigint' ? n.toString(16) : n.replace(/^0x/, '')).padStart(64, '0');
const encoded = (...values) => '0x' + values.map(word).join('');
const block = { number: '0x100', hash: '0x' + 'ab'.repeat(32), timestamp: '0x60000000' };
const reserve0 = 200000000000n;
const reserve1 = 100000000000000000000n;
const output = amountOut(10n ** 18n, reserve1, reserve0);

function rpcFixture(overrides = {}, calls = []) {
  return async (method, params = []) => {
    calls.push({ method, params });
    if (method === 'eth_chainId') return overrides.chain ?? '0x1';
    if (method === 'eth_getBlockByNumber') return params[0] === 'finalized' ? block : { ...block, ...overrides.confirmed };
    assert.equal(params[1], block.number, 'Every contract read is pinned to the captured block');
    const { to, data } = params[0];
    if (data.startsWith('0xe6a43905')) {
      assert.equal(to, POOL.factory);
      assert.equal(data, '0xe6a43905' + word(POOL.usdc) + word(POOL.weth));
      return overrides.pair ?? encoded(POOL.address);
    }
    const responses = {
      '0xc45a0155': encoded(POOL.factory), '0x0dfe1681': encoded(POOL.usdc),
      '0xd21220a7': encoded(POOL.weth), '0x0902f1ac': encoded(reserve0, reserve1, 0x60000000n),
      '0x313ce567': encoded(to === POOL.usdc ? 6n : 18n),
    };
    if (data.startsWith('0xd06ca61f')) {
      assert.equal(to, POOL.router);
      assert.equal(data, '0xd06ca61f' + word(10n ** 18n) + word(64n) + word(2n) + word(POOL.weth) + word(POOL.usdc));
      return overrides.router ?? encoded(32n, 2n, 10n ** 18n, output);
    }
    return overrides[data] ?? responses[data];
  };
}

test('integer swap math reproduces the canonical periphery example and preserves floor rounding', () => {
  assert.equal(output, 1974316068n);
  assert.equal(amountOut(1n, 3n, 5n), 1n);
  assert.equal(formatUnits(1234567890123456789n, 18), '1.234567890123456789');
  assert.equal(formatUnits(3n, 6), '0.000003');
  assert.throws(() => amountOut(0n, 1n, 1n), /positive/);
  assert.throws(() => amountOut((1n << 256n) - 1n, 1n, 1n), /exceeds/);
});

test('a snapshot verifies identity, decimals and exact router output at one block', async () => {
  const calls = [];
  const snapshot = await fetchPoolSnapshot({ rpc: rpcFixture({}, calls) });
  assert.equal(snapshot.block.number, '256');
  assert.equal(snapshot.validation.amountOutRaw, '1974316068');
  assert.equal(snapshot.reserves.reserve1, reserve1.toString());
  assert.equal(calls.filter((call) => call.method === 'eth_call').length, 8);
  const view = snapshotView(snapshot);
  assert.equal(view.ethPrice, 2000);
  assert.equal(view.eth, 100);
  assert.equal(view.usdc, 200000);
});

test('wrong networks, unsupported pairs, factories, token order and decimals are rejected', async () => {
  for (const overrides of [
    { chain: '0x2105' }, { pair: encoded(POOL.router) },
    { '0xc45a0155': encoded(POOL.address) }, { '0x0dfe1681': encoded(POOL.weth) },
    { '0x313ce567': encoded(8n) }, { '0x0902f1ac': '0x' },
    { '0x0902f1ac': encoded(0n, reserve1, 0n) },
    { '0x0902f1ac': encoded(1n << 112n, reserve1, 0n) },
  ]) await assert.rejects(fetchPoolSnapshot({ rpc: rpcFixture(overrides) }));
});

test('router mismatches, malformed quotes and a changed block are rejected', async () => {
  await assert.rejects(fetchPoolSnapshot({ rpc: rpcFixture({ router: encoded(32n, 2n, 10n ** 18n, output + 1n) }) }), /does not match/);
  await assert.rejects(fetchPoolSnapshot({ rpc: rpcFixture({ router: encoded(64n, 2n, 10n ** 18n, output) }) }), /unsupported quote/);
  await assert.rejects(fetchPoolSnapshot({ rpc: rpcFixture({ confirmed: { hash: '0x' + 'cd'.repeat(32) } }) }), /block changed/);
});

test('snapshot files round trip exact reserves and sanitize additional input fields', async () => {
  const snapshot = await fetchPoolSnapshot({ rpc: rpcFixture() });
  assert.deepEqual(parseSnapshot(snapshotJSON(snapshot)), snapshot);
  const restored = validateSnapshot({ ...snapshot, displayHTML: '<img src=x>', block: { ...snapshot.block, other: 'ignore' } });
  assert.deepEqual(restored, snapshot);
  for (const patch of [{ version: 9 }, { protocol: 'uniswap-v3' }, { chainId: 8453 }, { tokens: [...snapshot.tokens].reverse() }, { provider: 'https://example.com' }]) {
    assert.throws(() => validateSnapshot({ ...snapshot, ...patch }), /not a supported/);
  }
  assert.throws(() => parseSnapshot('{'), /valid JSON/);
  assert.throws(() => parseSnapshot(' '.repeat(65537)), /64 KB/);
  assert.throws(() => validateSnapshot({ ...snapshot, reserves: { ...snapshot.reserves, reserve0: '2e11' } }));
});

test('snapshot storage is separate from the sandbox and fails without losing loaded data', async () => {
  const snapshot = await fetchPoolSnapshot({ rpc: rpcFixture() });
  const values = new Map([['defi-sandbox-v1', 'existing session']]);
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  assert.equal(saveSnapshot(snapshot, () => storage), true);
  assert.deepEqual(readSavedSnapshot(() => storage).snapshot, snapshot);
  assert.equal(values.get('defi-sandbox-v1'), 'existing session');
  values.set(SNAPSHOT_KEY, 'broken');
  assert.equal(readSavedSnapshot(() => storage).snapshot, null);
  assert.equal(saveSnapshot(snapshot, () => { throw new Error('blocked'); }), false);
  assert.equal(readSavedSnapshot(() => { throw new Error('blocked'); }).status, 'unavailable');
});

test('RPC client sends only read methods and validates response IDs and provider errors', async () => {
  const reply = (body, status = 200) => ({ ok: status === 200, status, text: async () => JSON.stringify(body) });
  let request;
  const rpc = createRpcClient({ fetchImpl: async (endpoint, options) => {
    assert.equal(endpoint, RPC_URL); request = JSON.parse(options.body);
    assert.equal(options.credentials, 'omit');
    return reply({ jsonrpc: '2.0', id: request.id, result: '0x1' });
  } });
  assert.equal(await rpc('eth_chainId'), '0x1');
  assert.equal(request.method, 'eth_chainId');
  await assert.rejects(rpc('eth_sendTransaction'), /read-only/);
  await assert.rejects(createRpcClient({ fetchImpl: async () => reply({ jsonrpc: '2.0', id: 9, result: '0x1' }) })('eth_chainId'), /invalid/);
  await assert.rejects(createRpcClient({ fetchImpl: async () => reply({}, 429) })('eth_chainId'), /busy/);
  await assert.rejects(createRpcClient({ fetchImpl: async () => ({ ok: true, text: async () => 'x' }) })('eth_chainId'), /invalid JSON/);
  await assert.rejects(createRpcClient({ fetchImpl: async () => { throw new TypeError('network'); } })('eth_chainId'), /Could not reach/);
});

test('slow data providers time out cleanly', async () => {
  const rpc = createRpcClient({ timeoutMs: 5, fetchImpl: async (_, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')))) });
  await assert.rejects(rpc('eth_chainId'), /timed out/);
});
