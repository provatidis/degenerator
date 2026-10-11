import { MIN_TICK, MAX_TICK } from './tick-math.js';

export const Q128 = 1n << 128n;
const U256 = 1n << 256n;
const MASK128 = Q128 - 1n;
function uint(value, bits) {
  if (typeof value !== 'bigint' || value < 0n || value >= 1n << BigInt(bits)) throw new Error('Unsupported v3 fee integer.');
  return value;
}
export const subtractGrowth = (left, right) => (uint(left, 256) - uint(right, 256) + U256) % U256;

// Raw token1/token0 ticks: lower inclusive, upper exclusive. Growth wraps at uint256.
// The mathematical rules are documented in Uniswap v3 Tick.getFeeGrowthInside.
export function feeGrowthInside(tick, tickLower, tickUpper, growth) {
  if (![tick, tickLower, tickUpper].every(value => Number.isInteger(value) && value >= MIN_TICK && value <= MAX_TICK)
    || tickLower >= tickUpper) throw new Error('Unsupported v3 fee ticks.');
  const inside = token => {
    const global = uint(growth['global' + token], 256);
    const lower = uint(growth['lower' + token], 256), upper = uint(growth['upper' + token], 256);
    const below = tick >= tickLower ? lower : subtractGrowth(global, lower);
    const above = tick < tickUpper ? upper : subtractGrowth(global, upper);
    return subtractGrowth(subtractGrowth(global, below), above);
  };
  return { inside0: inside(0), inside1: inside(1) };
}

export function calculatePositionFees(position, growth) {
  const { inside0, inside1 } = feeGrowthInside(position.tick, position.tickLower, position.tickUpper, growth);
  const liquidity = uint(position.liquidity, 128);
  const delta0 = subtractGrowth(inside0, position.last0), delta1 = subtractGrowth(inside1, position.last1);
  const full0 = liquidity * delta0 / Q128, full1 = liquidity * delta1 / Q128;
  const accrued0 = full0 & MASK128, accrued1 = full1 & MASK128;
  const total0 = uint(position.owed0, 128) + accrued0, total1 = uint(position.owed1, 128) + accrued1;
  // The manager casts fee credits to uint128 and adds owed balances with wrapping.
  // Surface this exceptional loss of capacity instead of presenting it as normal income.
  return {
    inside0, inside1, delta0, delta1, accrued0, accrued1,
    collectable0: total0 & MASK128, collectable1: total1 & MASK128,
    overflow: full0 >= Q128 || full1 >= Q128 || total0 >= Q128 || total1 >= Q128,
  };
}
