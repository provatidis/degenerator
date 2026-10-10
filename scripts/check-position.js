import { writeFile } from 'node:fs/promises';
import { fetchPositionSnapshot } from '../public/data/uniswap-v3.js';
import { positionSnapshotJSON, positionSnapshotView } from '../public/data/position-snapshot.js';

const tokenId = process.argv[2] || '37';
const snapshot = await fetchPositionSnapshot(tokenId, { onProgress: message => console.log(message) });
const view = positionSnapshotView(snapshot);
console.log(JSON.stringify({ tokenId: snapshot.tokenId, block: snapshot.block, pool: snapshot.poolAddress, ticks: [snapshot.position.tickLower, snapshot.position.tickUpper], liquidity: snapshot.position.liquidity, principal: snapshot.principal, ethPrice: view.ethPrice, range: [view.lowerPrice, view.upperPrice], principalUSD: view.principalUSD, state: view.state }, null, 2));
if (process.argv[3]) { await writeFile(process.argv[3], positionSnapshotJSON(snapshot)); console.log('Saved ' + process.argv[3]); }
