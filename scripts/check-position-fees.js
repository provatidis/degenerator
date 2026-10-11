import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { fetchPositionSnapshot } from '../public/data/uniswap-v3.js';
import { positionSnapshotJSON, positionSnapshotView } from '../public/data/position-snapshot.js';
import { createRpcClient } from '../public/data/rpc.js';
import { RPC_ENDPOINTS, V3 } from '../public/data/config.js';
import { abiWords, decodeAddress, encodeUint, encodeWord, uintFromWord } from '../public/data/abi.js';
import { confirmBlock } from '../public/data/block.js';

// Development-only eth_call simulation. It changes no chain state and submits no transaction.
// Never follow provider metadata from an imported file: this script captures its own live data.
const snapshot = await fetchPositionSnapshot(process.argv[2] || '1382030', { onProgress: message => console.log(message) });
assert.ok(RPC_ENDPOINTS.includes(snapshot.provider));
const rpc = createRpcClient({ endpoint: snapshot.provider, serial: true });
const tag = '0x' + BigInt(snapshot.block.number).toString(16);
const owner = decodeAddress(await rpc('eth_call', [{ to: V3.positionManager, data: '0x6352211e' + encodeUint(snapshot.tokenId) }, tag]));
const max = (1n << 128n) - 1n;
const data = '0xfc6f7865' + encodeUint(snapshot.tokenId) + encodeWord(V3.positionManager) + encodeUint(max) + encodeUint(max);
const result = abiWords(await rpc('eth_call', [{ to: V3.positionManager, from: owner, data }, tag]), 2).map(word => uintFromWord(word));
await confirmBlock(rpc, tag, snapshot.block);
const expected = [BigInt(snapshot.fees.collectable0Raw), BigInt(snapshot.fees.collectable1Raw)];
const view = positionSnapshotView(snapshot);
console.log(JSON.stringify({
  tokenId: snapshot.tokenId, block: snapshot.block, state: view.state, principalUSD: view.principalUSD,
  fees: snapshot.fees, accruedUSD: view.fees.accrued.usd, collectableUSD: view.fees.collectable.usd,
  simulatedCollect: result.map(String), difference: result.map((value, index) => (expected[index] - value).toString()),
  exactMatch: result.every((value, index) => value === expected[index]),
}, null, 2));
assert.ok(result.every((value, index) => value <= expected[index]), 'The simulation exceeds the manager fee estimate; review the accounting.');
// Core accounting can return slightly less due to rounding. Keep differences visible for review.
if (!result.every((value, index) => value === expected[index])) console.warn('Collection differs from the estimate. Review the reported base-unit differences and core rounding.');
if (process.argv[3]) {
  // Automatically record an example only when both estimates match to the base unit.
  assert.deepEqual(result, expected, 'Review the collection differences before recording an example.');
  await writeFile(process.argv[3], positionSnapshotJSON(snapshot));
  console.log('Saved ' + process.argv[3]);
}
