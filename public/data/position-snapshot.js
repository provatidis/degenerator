// Keep legacy storage and format identifiers so existing work survives rebranding.
import { validateProvider } from './provenance.js';
import { V3, V3_FEE_SPACING, V3_POOLS } from './config.js';
import { parseSnapshotFile, readSnapshot, writeSnapshot, MAX_SNAPSHOT_BYTES } from './snapshot-store.js';
import { positionAmounts, positionRange, usdPerETH } from '../models/uniswap-v3.js';
import { MIN_TICK, MAX_TICK, sqrtRatioAtTick, tickAtSqrtRatio } from '../models/tick-math.js';
import { formatUnits } from '../models/units.js';
import { validateRange } from '../models/cl-range-v1.js';
import { calculatePositionFees } from '../models/v3-fees.js';

export { MAX_SNAPSHOT_BYTES };
export const POSITION_SNAPSHOT_KEY = 'degenerator-v3-position-snapshot-v1';
export const POSITION_SNAPSHOT_VERSION = 2;
const fail = () => { throw new Error('This file is not a supported Ethereum Uniswap v3 WETH/USDC position snapshot.'); };
const address = (value, expected) => typeof value === 'string' && value.toLowerCase() === expected;
function uint(value, bits, positive = false) {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]{0,77})$/.test(value)) fail();
  const n = BigInt(value);
  if (n >= 1n << BigInt(bits) || (positive && n === 0n)) fail();
  return value;
}
export function positionId(value) {
  if (typeof value !== 'string' || !/^[1-9][0-9]{0,77}$/.test(value.trim()) || BigInt(value.trim()) >= 1n << 256n) throw new Error('Enter a positive whole-number Uniswap v3 NFT ID.');
  return value.trim();
}
const tick = value => {
  if (!Number.isInteger(value) || value < MIN_TICK || value > MAX_TICK) fail();
  return value;
};

function validateFeeGrowth(input, liquidity) {
  if (!input) fail();
  const boundary = value => {
    if (!value || typeof value.initialized !== 'boolean') fail();
    const liquidityGross = uint(value.liquidityGross, 128);
    const outside0X128 = uint(value.outside0X128, 256), outside1X128 = uint(value.outside1X128, 256);
    if (value.initialized !== (BigInt(liquidityGross) > 0n) || BigInt(liquidityGross) < BigInt(liquidity)
      || (!value.initialized && (outside0X128 !== '0' || outside1X128 !== '0'))) fail();
    return { liquidityGross, outside0X128, outside1X128, initialized: value.initialized };
  };
  return {
    global0X128: uint(input.global0X128, 256), global1X128: uint(input.global1X128, 256),
    lower: boundary(input.lower), upper: boundary(input.upper),
  };
}
export function positionFeeAccounting(position, pool, growth) {
  return calculatePositionFees({
    tick: pool.tick, tickLower: position.tickLower, tickUpper: position.tickUpper,
    liquidity: BigInt(position.liquidity), last0: BigInt(position.feeGrowthInside0LastX128), last1: BigInt(position.feeGrowthInside1LastX128),
    owed0: BigInt(position.tokensOwed0), owed1: BigInt(position.tokensOwed1),
  }, {
    global0: BigInt(growth.global0X128), global1: BigInt(growth.global1X128),
    lower0: BigInt(growth.lower.outside0X128), lower1: BigInt(growth.lower.outside1X128),
    upper0: BigInt(growth.upper.outside0X128), upper1: BigInt(growth.upper.outside1X128),
  });
}
export function feeSnapshotFields(accounting) {
  return {
    accrued0Raw: accounting.accrued0.toString(), accrued1Raw: accounting.accrued1.toString(),
    collectable0Raw: accounting.collectable0.toString(), collectable1Raw: accounting.collectable1.toString(), overflow: accounting.overflow,
  };
}

// Supplied files are structurally checked; their chain origin is not authenticated.
export function validatePositionSnapshot(input) {
  if (!input || ![1, POSITION_SNAPSHOT_VERSION].includes(input.version) || input.kind !== 'uniswap-v3-position' || input.protocol !== V3.protocol || input.chainId !== 1
    || !address(input.positionManager, V3.positionManager) || !address(input.factoryAddress, V3.factory)) fail();
  const tokenId = positionId(input.tokenId);
  if (typeof input.poolAddress !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(input.poolAddress) || /^0x0{40}$/i.test(input.poolAddress)) fail();
  const block = input.block;
  if (!block || !/^0x[0-9a-fA-F]{64}$/.test(block.hash) || !Number.isSafeInteger(block.timestamp) || block.timestamp <= 0 || block.timestamp >= 2 ** 32) fail();
  const number = uint(block.number, 53, true);
  if (!Array.isArray(input.tokens) || input.tokens.length !== 2) fail();
  const tokens = [{ address: V3.usdc, symbol: 'USDC', decimals: 6 }, { address: V3.weth, symbol: 'WETH', decimals: 18 }];
  tokens.forEach((expected, index) => {
    const token = input.tokens[index];
    if (!token || !address(token.address, expected.address) || token.symbol !== expected.symbol || token.decimals !== expected.decimals) fail();
  });
  const position = input.position;
  if (!position || !Number.isInteger(position.fee) || !Object.hasOwn(V3_FEE_SPACING, position.fee)) fail();
  if (!address(input.poolAddress, V3_POOLS[position.fee])) throw new Error('The pool address does not match the supported WETH/USDC pair and fee tier.');
  const tickLower = tick(position.tickLower), tickUpper = tick(position.tickUpper);
  const spacing = V3_FEE_SPACING[position.fee];
  if (tickLower >= tickUpper || tickLower % spacing || tickUpper % spacing) fail();
  const liquidity = uint(position.liquidity, 128);
  const normalizedPosition = {
    fee: position.fee, tickLower, tickUpper, liquidity,
    feeGrowthInside0LastX128: uint(position.feeGrowthInside0LastX128, 256),
    feeGrowthInside1LastX128: uint(position.feeGrowthInside1LastX128, 256),
    tokensOwed0: uint(position.tokensOwed0, 128), tokensOwed1: uint(position.tokensOwed1, 128),
  };
  const pool = input.pool;
  if (!pool || pool.tickSpacing !== spacing) fail();
  const currentTick = tick(pool.tick);
  const sqrtPriceX96 = uint(pool.sqrtPriceX96, 160, true);
  const sqrt = BigInt(sqrtPriceX96);
  const ratioTick = tickAtSqrtRatio(sqrt);
  // A zero-for-one swap ending exactly at a boundary may leave slot0.tick one lower.
  if (currentTick !== ratioTick && !(currentTick === ratioTick - 1 && sqrtRatioAtTick(ratioTick) === sqrt)) fail();
  const amounts = positionAmounts(BigInt(liquidity), sqrt, tickLower, tickUpper);
  const amount0Raw = uint(input.principal?.amount0Raw, 256);
  const amount1Raw = uint(input.principal?.amount1Raw, 256);
  if (amounts.amount0.toString() !== amount0Raw || amounts.amount1.toString() !== amount1Raw) throw new Error('The recorded principal does not match the position liquidity, ticks and pool price.');
  if (typeof input.capturedAt !== 'string' || input.capturedAt.length > 40 || !Number.isFinite(Date.parse(input.capturedAt))) fail();
  const normalizedPool = { sqrtPriceX96, tick: currentTick, tickSpacing: spacing };
  let feeFields = {};
  if (input.version === POSITION_SNAPSHOT_VERSION) {
    const feeGrowth = validateFeeGrowth(input.feeGrowth, liquidity);
    const fees = feeSnapshotFields(positionFeeAccounting(normalizedPosition, normalizedPool, feeGrowth));
    if (!input.fees || Object.entries(fees).some(([key, value]) => input.fees[key] !== value)) throw new Error('The recorded fee estimate does not match the position and fee growth.');
    feeFields = { feeGrowth, fees };
  }
  return {
    version: input.version, kind: 'uniswap-v3-position', protocol: V3.protocol, chainId: 1, tokenId,
    positionManager: V3.positionManager, factoryAddress: V3.factory, poolAddress: input.poolAddress.toLowerCase(),
    block: { number, hash: block.hash.toLowerCase(), timestamp: block.timestamp }, tokens,
    position: normalizedPosition, pool: normalizedPool,
    principal: { amount0Raw, amount1Raw },
    ...feeFields,
    capturedAt: new Date(input.capturedAt).toISOString(), provider: validateProvider(input.provider),
  };
}
export const parsePositionSnapshot = text => parseSnapshotFile(text, validatePositionSnapshot, [1, POSITION_SNAPSHOT_VERSION]);
export const positionSnapshotJSON = input => JSON.stringify(validatePositionSnapshot(input), null, 2) + '\n';
export const readSavedPosition = getStorage => readSnapshot(POSITION_SNAPSHOT_KEY, parsePositionSnapshot, getStorage);
export const savePositionSnapshot = (snapshot, getStorage) => writeSnapshot(POSITION_SNAPSHOT_KEY, positionSnapshotJSON(snapshot), getStorage);

export function positionSnapshotView(input) {
  const snapshot = validatePositionSnapshot(input);
  const eth = Number(formatUnits(BigInt(snapshot.principal.amount1Raw), 18));
  const usdc = Number(formatUnits(BigInt(snapshot.principal.amount0Raw), 6));
  const ethPrice = usdPerETH(BigInt(snapshot.pool.sqrtPriceX96));
  const range = positionRange(snapshot.position.tickLower, snapshot.position.tickUpper);
  const state = snapshot.position.liquidity === '0' ? 'inactive' : snapshot.pool.tick < snapshot.position.tickLower ? 'above' : snapshot.pool.tick >= snapshot.position.tickUpper ? 'below' : 'inside';
  let fees = null;
  if (snapshot.version === POSITION_SNAPSHOT_VERSION) {
    const balances = (raw0, raw1) => {
      const usdc = Number(formatUnits(BigInt(raw0), 6)), eth = Number(formatUnits(BigInt(raw1), 18));
      return { usdc, eth, usd: snapshot.fees.overflow ? null : usdc + eth * ethPrice };
    };
    fees = {
      ...snapshot.fees, accounting: positionFeeAccounting(snapshot.position, snapshot.pool, snapshot.feeGrowth),
      accrued: balances(snapshot.fees.accrued0Raw, snapshot.fees.accrued1Raw),
      owed: balances(snapshot.position.tokensOwed0, snapshot.position.tokensOwed1),
      collectable: balances(snapshot.fees.collectable0Raw, snapshot.fees.collectable1Raw),
    };
  }
  const principalUSD = eth * ethPrice + usdc;
  return { snapshot, eth, usdc, ethPrice, ...range, principalUSD, state, fees,
    assetsUSD: fees && !fees.overflow ? principalUSD + fees.collectable.usd : null };
}
export function positionScenario(input) {
  const view = positionSnapshotView(input);
  if (view.state === 'inactive') throw new Error('This NFT has no liquidity to explore. Its snapshot remains available.');
  if (view.principalUSD <= 0) throw new Error('The position principal rounds to zero token base units. Its snapshot remains available.');
  try {
    return validateRange({
      investment: view.principalUSD, initialPrice: view.ethPrice, futurePrice: view.ethPrice,
      lowerPrice: view.lowerPrice, upperPrice: view.upperPrice, fees: 0, fullRangeFees: 0,
    });
  } catch {
    throw new Error('This position’s prices or value exceed the range lab’s supported inputs. Its snapshot remains available.');
  }
}
