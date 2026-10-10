import { POOL, RPC_URL } from './config.js';
import { amountOut, formatUnits } from '../models/uniswap-v2.js';

export const SNAPSHOT_VERSION = 1;
export const SNAPSHOT_KEY = 'degenerator-pool-snapshot-v1';
export const MAX_SNAPSHOT_BYTES = 65536;
const fail = () => { throw new Error('This file is not a supported Ethereum Uniswap v2 WETH/USDC snapshot.'); };
const address = (value, expected) => typeof value === 'string' && value.toLowerCase() === expected;
const uint = (value, bits, positive = true) => {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]{0,77})$/.test(value)) fail();
  const n = BigInt(value);
  if (n >= (1n << BigInt(bits)) || (positive && n === 0n)) fail();
  return value;
};

// Structural and arithmetic validation is not authentication of a user-supplied file.
export function validateSnapshot(input) {
  if (!input || input.version !== SNAPSHOT_VERSION || input.protocol !== POOL.protocol || input.chainId !== POOL.chainId
    || !address(input.poolAddress, POOL.address) || !address(input.factoryAddress, POOL.factory)) fail();
  const block = input.block;
  if (!block || typeof block.hash !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(block.hash)
    || !Number.isSafeInteger(block.timestamp) || block.timestamp <= 0 || block.timestamp >= 2 ** 32) fail();
  const number = uint(block.number, 53);
  if (!Array.isArray(input.tokens) || input.tokens.length !== 2) fail();
  const tokens = input.tokens.map((token, i) => {
    const expected = i === 0 ? { address: POOL.usdc, symbol: 'USDC', decimals: 6 } : { address: POOL.weth, symbol: 'WETH', decimals: 18 };
    if (!token || !address(token.address, expected.address) || token.symbol !== expected.symbol || token.decimals !== expected.decimals) fail();
    return expected;
  });
  const reserve0 = uint(input.reserves?.reserve0, 112);
  const reserve1 = uint(input.reserves?.reserve1, 112);
  const reserveTimestamp = input.reserves?.timestamp;
  if (!Number.isSafeInteger(reserveTimestamp) || reserveTimestamp < 0 || reserveTimestamp >= 2 ** 32) fail();
  if (input.swapFee?.numerator !== 997 || input.swapFee?.denominator !== 1000) fail();
  const quote = input.validation;
  if (!quote || !address(quote.routerAddress, POOL.router) || !address(quote.inputToken, POOL.weth)
    || !address(quote.outputToken, POOL.usdc) || quote.amountInRaw !== '1000000000000000000') fail();
  const amountOutRaw = uint(quote.amountOutRaw, 256, false);
  if (amountOut(10n ** 18n, BigInt(reserve1), BigInt(reserve0)).toString() !== amountOutRaw) {
    throw new Error('The recorded router quote does not match the reserves and fee formula.');
  }
  if (typeof input.capturedAt !== 'string' || input.capturedAt.length > 40 || !Number.isFinite(Date.parse(input.capturedAt))
    || input.provider !== RPC_URL) fail();
  return {
    version: SNAPSHOT_VERSION, protocol: POOL.protocol, chainId: POOL.chainId,
    poolAddress: POOL.address, factoryAddress: POOL.factory,
    block: { number, hash: block.hash.toLowerCase(), timestamp: block.timestamp }, tokens,
    reserves: { reserve0, reserve1, timestamp: reserveTimestamp },
    swapFee: { numerator: 997, denominator: 1000 },
    validation: { routerAddress: POOL.router, inputToken: POOL.weth, outputToken: POOL.usdc, amountInRaw: quote.amountInRaw, amountOutRaw },
    capturedAt: new Date(input.capturedAt).toISOString(), provider: RPC_URL,
  };
}

export function parseSnapshot(text) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > MAX_SNAPSHOT_BYTES) throw new Error('Snapshot files must be at most 64 KB.');
  let input;
  try { input = JSON.parse(text); } catch { throw new Error('The snapshot file is not valid JSON.'); }
  return validateSnapshot(input);
}
export function snapshotJSON(input) { return JSON.stringify(validateSnapshot(input), null, 2) + '\n'; }

export function snapshotView(input) {
  const snapshot = validateSnapshot(input);
  const usdc = Number(formatUnits(BigInt(snapshot.reserves.reserve0), 6));
  const eth = Number(formatUnits(BigInt(snapshot.reserves.reserve1), 18));
  return { snapshot, usdc, eth, ethPrice: usdc / eth, quoteUSDC: Number(formatUnits(BigInt(snapshot.validation.amountOutRaw), 6)) };
}

export function readSavedSnapshot(getStorage = () => globalThis.localStorage) {
  try {
    const text = getStorage().getItem(SNAPSHOT_KEY);
    return text === null ? { snapshot: null, status: 'empty' } : { snapshot: parseSnapshot(text), status: 'restored' };
  } catch { return { snapshot: null, status: 'unavailable' }; }
}
export function saveSnapshot(snapshot, getStorage = () => globalThis.localStorage) {
  const text = snapshotJSON(snapshot);
  try { getStorage().setItem(SNAPSHOT_KEY, text); return true; } catch { return false; }
}
