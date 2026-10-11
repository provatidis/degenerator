import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { RpcError, createRpcClient } from '../public/data/rpc.js';
import { requestSnapshot } from '../public/data/snapshot-request.js';
import { clearSnapshot, readSnapshot, SnapshotVersionError } from '../public/data/snapshot-store.js';
import { parseSnapshot, snapshotJSON, validateSnapshot, SNAPSHOT_KEY } from '../public/data/snapshot.js';
import { parsePositionSnapshot, positionSnapshotJSON, validatePositionSnapshot, positionSnapshotView, POSITION_SNAPSHOT_KEY } from '../public/data/position-snapshot.js';
import { PLAYGROUND_EXAMPLES, EXAMPLE_STAGES, stageForLesson } from '../public/learning/example-path.js';
import { LESSON_IDS } from '../public/models/lesson-experiments.js';
import { scenarioFromHash } from '../public/lib/scenario-links.js';
import { rangeFromHash } from '../public/lib/range-links.js';
import { calculateScenario } from '../public/models/cp50-v1.js';
import { calculateRange } from '../public/models/cl-range-v1.js';

const pool = JSON.parse(await readFile(new URL('../public/examples/uniswap-v2-mainnet.json', import.meta.url)));
const outside = JSON.parse(await readFile(new URL('../public/examples/uniswap-v3-mainnet-37.json', import.meta.url)));
const inside = JSON.parse(await readFile(new URL('../public/examples/uniswap-v3-mainnet-in-range.json', import.meta.url)));
const reply = (request, extra, status = 200) => ({ ok: status === 200, status, text: async () => JSON.stringify({ jsonrpc: '2.0', id: JSON.parse(request.body).id, ...extra }) });

test('both snapshot types round trip provider metadata independently of the current endpoint', () => {
  const provider = 'https://previous-provider.example/ethereum';
  assert.equal(parseSnapshot(snapshotJSON({ ...pool, provider })).provider, provider);
  assert.equal(parsePositionSnapshot(positionSnapshotJSON({ ...outside, provider })).provider, provider);
  for (const provider of ['http://example.com', 'javascript:alert(1)', 'https://user:secret@example.com', '', 'https://example.com/' + 'a'.repeat(2048)]) {
    assert.throws(() => validateSnapshot({ ...pool, provider }), /provider metadata/);
    assert.throws(() => validatePositionSnapshot({ ...outside, provider }), /provider metadata/);
  }
});

test('position imports bind the pool address to its canonical token pair and fee tier', () => {
  for (const poolAddress of ['0x' + '11'.repeat(20), '0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640']) {
    assert.throws(() => validatePositionSnapshot({ ...outside, poolAddress }), /pool address/);
  }
  const lowFee = { ...outside, poolAddress: '0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640', position: { ...outside.position, fee: 500 }, pool: { ...outside.pool, tickSpacing: 10 } };
  assert.equal(validatePositionSnapshot(lowFee).position.fee, 500);
});

test('the in-range fixture preserves exact principal and exposes both tokens', () => {
  assert.deepEqual(parsePositionSnapshot(positionSnapshotJSON(inside)), inside);
  const view = positionSnapshotView(inside);
  assert.equal(view.state, 'inside');
  assert.equal(inside.principal.amount0Raw, '22046660876');
  assert.equal(inside.principal.amount1Raw, '10283485726696667741');
  assert.ok(view.eth > 0 && view.usdc > 0);
});

test('damaged, incompatible and blocked storage have distinct states and are preserved until explicitly cleared', () => {
  const entries = new Map([[SNAPSHOT_KEY, '{'], [POSITION_SNAPSHOT_KEY, JSON.stringify({ ...outside, version: 99 })], ['learning', 'keep'], ['wallet', 'keep']]);
  const storage = { getItem: key => entries.get(key) ?? null, removeItem: key => entries.delete(key) };
  assert.equal(readSnapshot(SNAPSHOT_KEY, parseSnapshot, () => storage).status, 'invalid');
  assert.equal(readSnapshot(POSITION_SNAPSHOT_KEY, parsePositionSnapshot, () => storage).status, 'incompatible');
  assert.equal(entries.size, 4);
  assert.throws(() => parseSnapshot(JSON.stringify({ ...pool, version: 2 })), SnapshotVersionError);
  assert.equal(clearSnapshot(SNAPSHOT_KEY, () => storage), true);
  assert.equal(entries.has(POSITION_SNAPSHOT_KEY), true);
  assert.equal(entries.get('learning'), 'keep');
  assert.equal(entries.get('wallet'), 'keep');
  assert.equal(readSnapshot(SNAPSHOT_KEY, parseSnapshot, () => storage).status, 'empty');
  assert.equal(readSnapshot(SNAPSHOT_KEY, parseSnapshot, () => { throw Error('blocked'); }).status, 'unavailable');
  assert.equal(clearSnapshot(SNAPSHOT_KEY, () => { throw Error('blocked'); }), false);
});

test('only transient transport or provider capacity failures trigger a bounded fallback', async () => {
  for (const error of [
    new RpcError('limited', { category: 'rate-limit', retryable: true }),
    new RpcError('offline', { category: 'network', retryable: true }),
    new RpcError('slow', { category: 'timeout', retryable: true }),
  ]) {
    const attempts = [], progress = [];
    const value = await requestSnapshot(async (_, provider) => { attempts.push(provider); if (attempts.length === 1) throw error; return provider; }, {
      endpoints: ['https://one.example', 'https://two.example'], createClient: () => () => {}, onFallback: message => progress.push(message),
    });
    assert.equal(value, 'https://two.example');
    assert.equal(progress.length, 1);
    assert.equal(attempts.length, 2);
  }
  for (const error of [new Error('wrong chain'), new Error('identity mismatch'), new RpcError('revert', { category: 'revert' }), new RpcError('invalid JSON')]) {
    let attempts = 0;
    await assert.rejects(requestSnapshot(async () => { attempts++; throw error; }, { endpoints: ['https://one.example', 'https://two.example'], createClient: () => () => {} }), error);
    assert.equal(attempts, 1);
  }
  let attempts = 0;
  await assert.rejects(requestSnapshot(async () => { attempts++; throw new RpcError('limited', { retryable: true }); }, { endpoints: ['https://one.example', 'https://two.example'], createClient: () => () => {} }), /limited/);
  assert.equal(attempts, 2);
});

test('HTTP and JSON-RPC limits retain typed retry information while malformed responses do not', async () => {
  for (const status of [429, 503, 408]) {
    const rpc = createRpcClient({ fetchImpl: async (_, request) => reply(request, {}, status) });
    await assert.rejects(rpc('eth_chainId'), error => error instanceof RpcError && error.retryable);
  }
  const limited = createRpcClient({ fetchImpl: async (_, request) => reply(request, { error: { code: -32005, message: 'limit exceeded' } }) });
  await assert.rejects(limited('eth_chainId'), error => error.code === -32005 && error.category === 'rate-limit' && error.retryable);
  const bad = createRpcClient({ fetchImpl: async () => ({ ok: true, text: async () => '{' }) });
  await assert.rejects(bad('eth_chainId'), error => error instanceof RpcError && !error.retryable);
});

test('contract Error(string) is decoded without confusing generic reverts with missing NFTs', async () => {
  const word = value => BigInt(value).toString(16).padStart(64, '0');
  const reason = 'Invalid token ID', encoded = '0x08c379a0' + word(32) + word(reason.length) + Buffer.from(reason).toString('hex').padEnd(64, '0');
  for (const data of [encoded, { data: encoded }]) {
    const rpc = createRpcClient({ fetchImpl: async (_, request) => reply(request, { error: { code: 3, message: 'execution reverted', data } }) });
    await assert.rejects(rpc('eth_call'), error => error.revertReason === reason && !error.retryable);
  }
  for (const data of ['0x08c379a0' + word(4096) + word(16), '0x08c379a0' + word(32) + word(999999)]) {
    const rpc = createRpcClient({ fetchImpl: async (_, request) => reply(request, { error: { code: 3, message: 'execution reverted', data } }) });
    await assert.rejects(rpc('eth_call'), error => error.revertReason === null && !error.retryable);
  }
});

test('backup serial reads avoid bursts and stop queued work after a failure', async () => {
  let active = 0, peak = 0, calls = 0;
  const rpc = createRpcClient({ serial: true, fetchImpl: async (_, request) => {
    active++; peak = Math.max(peak, active); calls++;
    await new Promise(resolve => setTimeout(resolve, 2)); active--;
    return reply(request, { result: '0x1' });
  } });
  await Promise.all([rpc('eth_chainId'), rpc('eth_chainId'), rpc('eth_chainId')]);
  assert.equal(peak, 1); assert.equal(calls, 3);
  calls = 0;
  const failed = createRpcClient({ serial: true, fetchImpl: async (_, request) => { calls++; return reply(request, {}, 429); } });
  const result = await Promise.allSettled([failed('eth_chainId'), failed('eth_chainId'), failed('eth_chainId')]);
  assert.ok(result.every(item => item.status === 'rejected'));
  assert.equal(calls, 1);
});

test('example concepts rise in order, reproduce model inputs, and share the lesson stages without gates', () => {
  assert.deepEqual(EXAMPLE_STAGES.flatMap(stage => stage.lessons), LESSON_IDS);
  assert.deepEqual(PLAYGROUND_EXAMPLES.map(example => example.level), [1, 2, 2, 3, 3, 4, 4, 4]);
  for (const id of LESSON_IDS) assert.ok(stageForLesson(id));
  const a = scenarioFromHash(PLAYGROUND_EXAMPLES[0].href), b = scenarioFromHash(PLAYGROUND_EXAMPLES[1].href), c = scenarioFromHash(PLAYGROUND_EXAMPLES[2].href);
  assert.deepEqual({ ...b, futurePrice: a.futurePrice }, a);
  assert.deepEqual({ ...c, fees: b.fees }, b);
  assert.equal(calculateScenario(a).impermanentLoss, 0);
  assert.ok(Math.abs(calculateScenario(c).lpValue - calculateScenario(c).holdValue) < 1e-8);
  const r = rangeFromHash(PLAYGROUND_EXAMPLES[3].href), edge = rangeFromHash(PLAYGROUND_EXAMPLES[4].href);
  assert.deepEqual({ ...edge, futurePrice: r.futurePrice }, r);
  assert.equal(calculateRange(r).state, 'inside');
  assert.equal(calculateRange(edge).pooled.eth, 0);
});

test('a contract revert mentioning a quota is not retried as a provider rate limit', async () => {
  const rpc = createRpcClient({ fetchImpl: async (_, request) => reply(request, { error: { code: 3, message: 'execution reverted: quota exceeded' } }) });
  await assert.rejects(rpc('eth_call'), error => error.category === 'revert' && !error.retryable);
});
