// Manual live integration check. Unit tests and browser smoke tests stay deterministic.
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fetchPoolSnapshot } from '../public/data/uniswap-v2.js';
import { snapshotJSON, snapshotView } from '../public/data/snapshot.js';

const snapshot = await fetchPoolSnapshot();
if (process.argv[2]) {
  await mkdir(dirname(process.argv[2]), { recursive: true });
  await writeFile(process.argv[2], snapshotJSON(snapshot));
}
const view = snapshotView(snapshot);
console.log(JSON.stringify({ chainId: snapshot.chainId, pool: snapshot.poolAddress, block: snapshot.block.number, blockHash: snapshot.block.hash, ethPrice: view.ethPrice, integerQuoteMatchesRouter: true, quoteUSDC: view.quoteUSDC }, null, 2));
