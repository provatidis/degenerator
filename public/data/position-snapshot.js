import { V3, V3_FEE_SPACING, RPC_URL } from './config.js';
import { parseSnapshotFile, readSnapshot, writeSnapshot, MAX_SNAPSHOT_BYTES } from './snapshot-store.js';
import { positionAmounts, positionRange, usdPerETH } from '../models/uniswap-v3.js';
import { MIN_TICK, MAX_TICK, sqrtRatioAtTick, tickAtSqrtRatio } from '../models/tick-math.js';
import { formatUnits } from '../models/units.js';
import { validateRange } from '../models/cl-range-v1.js';

export { MAX_SNAPSHOT_BYTES };
export const POSITION_SNAPSHOT_KEY = 'degenerator-v3-position-snapshot-v1';
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

// Supplied files are structurally checked; their chain origin is not authenticated.
export function validatePositionSnapshot(input) {
  if (!input || input.version !== 1 || input.kind !== 'uniswap-v3-position' || input.protocol !== V3.protocol || input.chainId !== 1
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
  const tickLower = tick(position.tickLower), tickUpper = tick(position.tickUpper);
  const spacing = V3_FEE_SPACING[position.fee];
  if (tickLower >= tickUpper || tickLower % spacing || tickUpper % spacing) fail();
  const liquidity = uint(position.liquidity, 128);
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
  if (typeof input.capturedAt !== 'string' || input.capturedAt.length > 40 || !Number.isFinite(Date.parse(input.capturedAt)) || input.provider !== RPC_URL) fail();
  return {
    version: 1, kind: 'uniswap-v3-position', protocol: V3.protocol, chainId: 1, tokenId,
    positionManager: V3.positionManager, factoryAddress: V3.factory, poolAddress: input.poolAddress.toLowerCase(),
    block: { number, hash: block.hash.toLowerCase(), timestamp: block.timestamp }, tokens,
    position: {
      fee: position.fee, tickLower, tickUpper, liquidity,
      feeGrowthInside0LastX128: uint(position.feeGrowthInside0LastX128, 256),
      feeGrowthInside1LastX128: uint(position.feeGrowthInside1LastX128, 256),
      tokensOwed0: uint(position.tokensOwed0, 128), tokensOwed1: uint(position.tokensOwed1, 128),
    },
    pool: { sqrtPriceX96, tick: currentTick, tickSpacing: spacing },
    principal: { amount0Raw, amount1Raw },
    capturedAt: new Date(input.capturedAt).toISOString(), provider: RPC_URL,
  };
}
export const parsePositionSnapshot = text => parseSnapshotFile(text, validatePositionSnapshot);
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
  return { snapshot, eth, usdc, ethPrice, ...range, principalUSD: eth * ethPrice + usdc, state };
}
export function positionScenario(input) {
  const view = positionSnapshotView(input);
  if (view.state === 'inactive') throw new Error('This NFT has no active liquidity to explore. Its snapshot remains available.');
  if (view.principalUSD <= 0) throw new Error('The active principal rounds to zero token base units. Its snapshot remains available.');
  try {
    return validateRange({
      investment: view.principalUSD, initialPrice: view.ethPrice, futurePrice: view.ethPrice,
      lowerPrice: view.lowerPrice, upperPrice: view.upperPrice, fees: 0, fullRangeFees: 0,
    });
  } catch {
    throw new Error('This position’s prices or value exceed the range lab’s supported inputs. Its snapshot remains available.');
  }
}
