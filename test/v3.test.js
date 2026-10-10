import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Q96, MIN_TICK, MAX_TICK, MIN_SQRT_RATIO, MAX_SQRT_RATIO, sqrtRatioAtTick, tickAtSqrtRatio } from '../public/models/tick-math.js';
import { amountsForLiquidity, positionAmounts, positionRange, usdPerETH } from '../public/models/uniswap-v3.js';
import { positionId, validatePositionSnapshot, parsePositionSnapshot, positionSnapshotJSON, positionSnapshotView, positionScenario, savePositionSnapshot, readSavedPosition, POSITION_SNAPSHOT_KEY } from '../public/data/position-snapshot.js';
import { calculateRange } from '../public/models/cl-range-v1.js';

const recorded = JSON.parse(await readFile(new URL('../public/examples/uniswap-v3-mainnet-37.json', import.meta.url), 'utf8'));
test('v3 Q96 ratios match canonical endpoint and ±1 tick vectors', () => {
  for (const [tick, expected] of [[0,Q96],[-1,79224201403219477170569942574n],[1,79232123823359799118286999568n],[MIN_TICK,MIN_SQRT_RATIO],[MAX_TICK,MAX_SQRT_RATIO]]) assert.equal(sqrtRatioAtTick(tick),expected);
  for (const tick of [MIN_TICK,-887271,-200000,-60,-1,0,1,60,198113,887271]) {
    const sqrt = sqrtRatioAtTick(tick);
    assert.equal(tickAtSqrtRatio(sqrt),tick);
    if (tick > MIN_TICK) assert.equal(tickAtSqrtRatio(sqrt - 1n),tick - 1);
  }
  assert.throws(() => sqrtRatioAtTick(0.1));
  assert.throws(() => sqrtRatioAtTick(MAX_TICK + 1));
  assert.throws(() => tickAtSqrtRatio(MAX_SQRT_RATIO));
  assert.throws(() => tickAtSqrtRatio(MIN_SQRT_RATIO - 1n));
});
test('integer principal has hand-solvable in-range, boundary and outside amounts with floor rounding', () => {
  const amounts = p => amountsForLiquidity(100n,p,Q96,4n*Q96);
  assert.deepEqual(amounts(2n*Q96),{amount0:25n,amount1:100n});
  assert.deepEqual(amounts(Q96),{amount0:75n,amount1:0n});
  assert.deepEqual(amounts(Q96/2n),amounts(Q96));
  assert.deepEqual(amounts(4n*Q96),{amount0:0n,amount1:300n});
  assert.deepEqual(amounts(5n*Q96),amounts(4n*Q96));
  assert.deepEqual(amountsForLiquidity(1n,3n*Q96/2n,Q96,4n*Q96),{amount0:0n,amount1:0n});
  assert.throws(()=>amountsForLiquidity(1n<<128n,Q96,Q96,4n*Q96));
  assert.throws(()=>amountsForLiquidity(1n,Q96,4n*Q96,Q96));
});
test('USD per ETH inverts raw USDC/WETH ticks and applies both token decimal counts', () => {
  assert.equal(usdPerETH(Q96),1e12);
  const range = positionRange(192180,193380);
  assert.ok(range.lowerPrice < range.upperPrice);
  assert.ok(Math.abs(range.lowerPrice-3999.7532530962358)<1e-8);
  assert.ok(Math.abs(range.upperPrice-4509.682143590085)<1e-8);
});
test('recorded chain data reproduces exact principal and a snapshot-start range experiment', () => {
  assert.deepEqual(positionAmounts(BigInt(recorded.position.liquidity),BigInt(recorded.pool.sqrtPriceX96),192180,193380),{amount0:0n,amount1:9999999999999133n});
  const view = positionSnapshotView(recorded);
  assert.equal(view.state,'below');
  assert.equal(view.usdc,0);
  assert.ok(Math.abs(view.eth-0.009999999999999133)<1e-18);
  const scenario=positionScenario(recorded);
  assert.equal(scenario.initialPrice,scenario.futurePrice);
  assert.equal(scenario.fees,0);
  assert.equal(scenario.fullRangeFees,0);
  const result=calculateRange(scenario);
  assert.ok(Math.abs(result.initial.eth-view.eth)<1e-15);
  assert.equal(result.initial.usdc,0);
  assert.equal(result.impermanentLoss,0);
});
test('v3 files preserve exact fields, reject tampering and remove unrecognized data', () => {
  assert.deepEqual(parsePositionSnapshot(positionSnapshotJSON(recorded)),recorded);
  assert.deepEqual(validatePositionSnapshot({...recorded,displayHTML:'<img src=x>'}),recorded);
  for (const patch of [
    {version:2},{chainId:8453},{kind:'pool'},{poolAddress:'0x'+'00'.repeat(20)},
    {tokens:[...recorded.tokens].reverse()},{tokenId:'1e6'},{provider:'https://example.com'},
    {position:{...recorded.position,fee:'3000'}},{position:{...recorded.position,tickLower:192181}},
    {pool:{...recorded.pool,tick:198100}},{pool:{...recorded.pool,tickSpacing:1}},
    {principal:{...recorded.principal,amount1Raw:'9999999999999134'}},
  ]) assert.throws(()=>validatePositionSnapshot({...recorded,...patch}));
  assert.throws(()=>parsePositionSnapshot('{'),/JSON/);
  assert.throws(()=>parsePositionSnapshot(' '.repeat(65537)),/64 KB/);
});
test('slot0 tick can be one lower only at an exact raw-price boundary', () => {
  const sqrt=sqrtRatioAtTick(193380);
  const principal=positionAmounts(BigInt(recorded.position.liquidity),sqrt,192180,193380);
  const snapshot={...recorded,pool:{...recorded.pool,sqrtPriceX96:sqrt.toString(),tick:193379},principal:{amount0Raw:principal.amount0.toString(),amount1Raw:principal.amount1.toString()}};
  assert.equal(positionSnapshotView(snapshot).state,'inside');
  assert.throws(()=>validatePositionSnapshot({...snapshot,pool:{...snapshot.pool,sqrtPriceX96:(sqrt+1n).toString()}}));
  assert.equal(positionSnapshotView({...snapshot,pool:{...snapshot.pool,tick:193380}}).state,'below');
});
test('closed, dust and unsupported-size positions remain inspectable but cannot seed a lab', () => {
  const closed={...recorded,position:{...recorded.position,liquidity:'0',tokensOwed0:'123'},principal:{amount0Raw:'0',amount1Raw:'0'}};
  assert.equal(positionSnapshotView(closed).state,'inactive');
  assert.equal(validatePositionSnapshot(closed).position.tokensOwed0,'123');
  assert.throws(()=>positionScenario(closed),/no active liquidity/);
  const tiny={...recorded,position:{...recorded.position,liquidity:'1'},principal:{amount0Raw:'0',amount1Raw:'920'}};
  assert.throws(()=>positionScenario(tiny),/supported inputs|no active liquidity/);
});
test('position IDs retain uint256 precision and reject invalid inputs before chain reads', () => {
  const largest=((1n<<256n)-1n).toString();
  assert.equal(positionId(largest),largest);
  assert.equal(positionId(' 37 '),'37');
  for(const id of ['', '0','-1','01','1.5','1e3',(1n<<256n).toString(),37]) assert.throws(()=>positionId(id),/NFT ID/);
});
test('position saving is independent from pool and sandbox state and tolerates blocked storage', () => {
  const entries=new Map([['defi-sandbox-v1','wallet'],['degenerator-pool-snapshot-v1','pool']]);
  const storage={getItem:key=>entries.get(key)??null,setItem:(key,value)=>entries.set(key,value)};
  assert.equal(savePositionSnapshot(recorded,()=>storage),true);
  assert.deepEqual(readSavedPosition(()=>storage).snapshot,recorded);
  assert.equal(entries.get('defi-sandbox-v1'),'wallet');
  assert.equal(entries.get('degenerator-pool-snapshot-v1'),'pool');
  entries.set(POSITION_SNAPSHOT_KEY,'broken');
  assert.equal(readSavedPosition(()=>storage).status,'unavailable');
  assert.equal(savePositionSnapshot(recorded,()=>{throw Error('blocked')}),false);
});
