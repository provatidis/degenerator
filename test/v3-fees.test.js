import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Q128, subtractGrowth, feeGrowthInside, calculatePositionFees } from '../public/models/v3-fees.js';
import { encodeInt, intBigIntFromWord, abiWords } from '../public/data/abi.js';
import { positionSnapshotView, positionSnapshotJSON, parsePositionSnapshot, validatePositionSnapshot, positionScenario, positionFeeAccounting, feeSnapshotFields } from '../public/data/position-snapshot.js';
import { feeTokenAmounts, feeUSD } from '../public/lib/position-fees.js';
import { sqrtRatioAtTick } from '../public/models/tick-math.js';
import { positionAmounts } from '../public/models/uniswap-v3.js';

const U256 = 1n << 256n;
const growth = { global0: 100n * Q128, global1: 200n * Q128, lower0: 20n * Q128, lower1: 20n * Q128, upper0: 30n * Q128, upper1: 50n * Q128 };
const position = { tick: 15, tickLower: 10, tickUpper: 20, liquidity: 5n, last0: 40n * Q128, last1: 128n * Q128, owed0: 7n, owed1: 3n };
const current = JSON.parse(await readFile(new URL('../public/examples/uniswap-v3-mainnet-fees.json', import.meta.url)));
const legacy = JSON.parse(await readFile(new URL('../public/examples/uniswap-v3-mainnet-in-range.json', import.meta.url)));

test('Q128 fee growth reproduces a hand-solvable position without changing its owed balances', () => {
  const before = { ...position };
  const result = calculatePositionFees(position, growth);
  assert.equal(result.inside0, 50n * Q128); assert.equal(result.inside1, 130n * Q128);
  assert.equal(result.accrued0, 50n); assert.equal(result.accrued1, 10n);
  assert.equal(result.collectable0, 57n); assert.equal(result.collectable1, 13n);
  assert.equal(result.overflow, false);
  assert.deepEqual(position, before);
});
test('growth uses contract ticks below, inside and above the range, including both exact edges', () => {
  assert.equal(feeGrowthInside(9,10,20,growth).inside0, U256 - 10n * Q128);
  assert.equal(feeGrowthInside(10,10,20,growth).inside0, 50n * Q128);
  assert.equal(feeGrowthInside(19,10,20,growth).inside0, 50n * Q128);
  assert.equal(feeGrowthInside(20,10,20,growth).inside0, 10n * Q128);
  assert.equal(feeGrowthInside(21,10,20,growth).inside0, 10n * Q128);
});
test('flipping outside growth at a crossing preserves accumulated inside growth', () => {
  const before = feeGrowthInside(19,10,20,growth);
  const crossed = { ...growth, upper0:growth.global0-growth.upper0, upper1:growth.global1-growth.upper1 };
  assert.deepEqual(feeGrowthInside(20,10,20,crossed), before);
  const lowerCrossed = { ...growth, lower0:growth.global0-growth.lower0, lower1:growth.global1-growth.lower1 };
  assert.deepEqual(feeGrowthInside(9,10,20,lowerCrossed), feeGrowthInside(10,10,20,growth));
});
test('uint256 growth differences wrap, and token credits floor only after multiplying liquidity', () => {
  assert.equal(subtractGrowth(3n,U256-2n),5n);
  const g = { global0:5n,global1:0n,lower0:U256-3n,lower1:0n,upper0:4n,upper1:0n };
  assert.equal(feeGrowthInside(15,10,20,g).inside0,4n);
  const half = { global0:Q128/2n+1n,global1:0n,lower0:0n,lower1:0n,upper0:0n,upper1:0n };
  const result = calculatePositionFees({...position,liquidity:3n,last0:0n,last1:0n,owed0:0n,owed1:0n},half);
  assert.equal(result.accrued0,1n);
  const wrapped = calculatePositionFees({...position,liquidity:2n,last0:U256-Q128,last1:0n,owed0:0n,owed1:0n},{...half,global0:2n*Q128});
  assert.equal(wrapped.accrued0,6n);
});
test('uint128 manager casts and additions are reproduced and capacity overflow is explicit', () => {
  const result=calculatePositionFees({...position,liquidity:Q128-1n,last0:0n,last1:0n,owed0:3n,owed1:0n},{...growth,global0:2n*Q128,lower0:0n,upper0:0n});
  assert.equal(result.accrued0,Q128-2n);
  assert.equal(result.collectable0,1n);
  assert.equal(result.overflow,true);
});
test('zero liquidity accrues no new fees and keeps recorded owed tokens separate', () => {
  const result=calculatePositionFees({...position,liquidity:0n},growth);
  assert.equal(result.accrued0,0n); assert.equal(result.accrued1,0n);
  assert.equal(result.collectable0,7n); assert.equal(result.collectable1,3n);
});
test('fee integers, tick order and signed ABI encodings are bounded without Number precision loss', () => {
  for(const patch of [{liquidity:-1n},{liquidity:Q128},{last0:U256},{owed0:Q128},{tickLower:20},{tick:0.5}]) assert.throws(()=>calculatePositionFees({...position,...patch},growth));
  assert.throws(()=>feeGrowthInside(15,10,20,{...growth,global0:-1n}));
  assert.equal(intBigIntFromWord(encodeInt(-60),24),-60n);
  assert.equal(encodeInt(-60),'f'.repeat(62)+'c4');
  assert.equal(intBigIntFromWord(encodeInt(-(1n<<100n),128),128),-(1n<<100n));
  assert.throws(()=>encodeInt(1n<<23n)); assert.throws(()=>encodeInt(-(1n<<23n)-1n));
  assert.throws(()=>intBigIntFromWord(abiWords('0x'+encodeInt(128,256),1)[0],8));
});
test('the live recorded fee example matches both independently simulated collect amounts to the base unit', () => {
  assert.equal(current.version,2);
  assert.equal(current.block.number,'26168941');
  assert.equal(current.fees.collectable0Raw,'524593');
  assert.equal(current.fees.collectable1Raw,'2054973037123392');
  assert.equal(current.fees.accrued0Raw,current.fees.collectable0Raw);
  assert.equal(current.fees.accrued1Raw,current.fees.collectable1Raw);
  assert.deepEqual(parsePositionSnapshot(positionSnapshotJSON(current)),current);
  const view=positionSnapshotView(current);
  assert.ok(Math.abs(view.fees.accrued.usd-5.66864134521122)<1e-10);
  assert.ok(Math.abs(view.assetsUSD-view.principalUSD-view.fees.collectable.usd)<1e-10);
});
test('legacy snapshots remain exportable and fee data is unknown rather than zero', () => {
  assert.deepEqual(parsePositionSnapshot(positionSnapshotJSON(legacy)),legacy);
  assert.equal(positionSnapshotView(legacy).fees,null);
  assert.equal(positionSnapshotView(legacy).assetsUSD,null);
  assert.deepEqual(validatePositionSnapshot({...legacy,feeGrowth:current.feeGrowth,fees:current.fees}),legacy);
});
test('fee imports reject altered estimates, growth, liquidity support and invalid initialization', () => {
  for(const patch of [
    {fees:{...current.fees,collectable0Raw:'1'}},
    {fees:{...current.fees,overflow:true}},
    {feeGrowth:{...current.feeGrowth,global0X128:'0'}},
    {feeGrowth:{...current.feeGrowth,lower:{...current.feeGrowth.lower,liquidityGross:'0'}}},
    {feeGrowth:{...current.feeGrowth,upper:{...current.feeGrowth.upper,initialized:false}}},
    {feeGrowth:{...current.feeGrowth,global1X128:U256.toString()}},
  ]) assert.throws(()=>validatePositionSnapshot({...current,...patch}));
  assert.throws(()=>parsePositionSnapshot(JSON.stringify({...current,version:99})),/version is not supported/);
});
test('stored owed balances can raise collectable assets without being misclassified as newly accrued fees', () => {
  const changed={...current,position:{...current.position,tokensOwed0:'10000000'}};
  changed.fees=feeSnapshotFields(positionFeeAccounting(changed.position,changed.pool,changed.feeGrowth));
  const view=positionSnapshotView(changed);
  assert.equal(view.fees.accrued.usdc,0.524593);
  assert.equal(view.fees.owed.usdc,10);
  assert.equal(view.fees.collectable.usdc,10.524593);
  const before=positionScenario(current),after=positionScenario(changed);
  assert.deepEqual(after,before);
  assert.equal(after.fees,0); assert.equal(after.fullRangeFees,0);
});
test('nonzero balances smaller than display precision are not presented as zero', () => {
  assert.equal(feeTokenAmounts('1','1'), '<0.00000001 WETH + 0.000001 USDC');
  assert.equal(feeTokenAmounts('0','0'), '0 WETH + 0 USDC');
  assert.equal(feeUSD(0.000001), '<$0.01');
  assert.equal(feeUSD(0), '$0.00');
});
test('a closed v2 position accepts cleared ticks and preserves owed principal without generating fees', () => {
  const cleared={liquidityGross:'0',outside0X128:'0',outside1X128:'0',initialized:false};
  const closed={...current,position:{...current.position,liquidity:'0',tokensOwed0:'10000000'},principal:{amount0Raw:'0',amount1Raw:'0'},feeGrowth:{...current.feeGrowth,lower:cleared,upper:cleared},fees:{accrued0Raw:'0',accrued1Raw:'0',collectable0Raw:'10000000',collectable1Raw:'0',overflow:false}};
  const view=positionSnapshotView(closed);
  assert.equal(view.principalUSD,0); assert.equal(view.fees.accrued.usd,0);
  assert.equal(view.fees.owed.usd,10); assert.equal(view.assetsUSD,10);
  assert.throws(()=>positionScenario(closed),/no liquidity/);
});
test('fee accounting follows slot0.tick when price is exactly at a boundary but the tick is one lower', () => {
  const sqrt=sqrtRatioAtTick(current.position.tickUpper), liquidity=BigInt(current.position.liquidity);
  const amounts=positionAmounts(liquidity,sqrt,current.position.tickLower,current.position.tickUpper);
  const boundary={...current,position:{...current.position,feeGrowthInside0LastX128:'0',feeGrowthInside1LastX128:'0'},pool:{...current.pool,sqrtPriceX96:sqrt.toString(),tick:current.position.tickUpper-1},principal:{amount0Raw:amounts.amount0.toString(),amount1Raw:amounts.amount1.toString()},feeGrowth:{global0X128:(3n*Q128).toString(),global1X128:'0',lower:{...current.feeGrowth.lower,outside0X128:'0',outside1X128:'0'},upper:{...current.feeGrowth.upper,outside0X128:Q128.toString(),outside1X128:'0'}},fees:{accrued0Raw:(2n*liquidity).toString(),accrued1Raw:'0',collectable0Raw:(2n*liquidity).toString(),collectable1Raw:'0',overflow:false}};
  assert.equal(positionSnapshotView(boundary).fees.accounting.inside0,2n*Q128);
  assert.throws(()=>validatePositionSnapshot({...boundary,pool:{...boundary.pool,tick:current.position.tickUpper}}),/fee estimate does not match/);
});
