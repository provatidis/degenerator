import { formatUnits } from '../models/units.js';
import { usd } from './format.js';

export const feeUSD = value => value > 0 && value < 0.01 ? '<$0.01' : usd(value);
function feeQuantity(raw, decimals, digits) {
  const value = Number(formatUnits(BigInt(raw), decimals));
  const threshold = 10 ** -digits;
  if (BigInt(raw) > 0n && value < threshold) return '<' + threshold.toLocaleString('en-US', { maximumFractionDigits: digits });
  return value.toLocaleString('en-US', { maximumFractionDigits: digits });
}
export const feeTokenAmounts = (raw0, raw1) => feeQuantity(raw1, 18, 8) + ' WETH + ' + feeQuantity(raw0, 6, 6) + ' USDC';

export function feeWalkthrough(view, canExplore) {
  const { snapshot, fees } = view;
  if (!fees || fees.overflow) return [];
  const hasOwed = snapshot.position.tokensOwed0 !== '0' || snapshot.position.tokensOwed1 !== '0';
  return [
    ['Separate the principal', feeUSD(view.principalUSD) + ' backs the position’s liquidity: ' + feeTokenAmounts(snapshot.principal.amount0Raw, snapshot.principal.amount1Raw) + '. Collecting owed tokens does not remove this active liquidity.'],
    ['Separate fees from recorded owed balances', feeUSD(fees.accrued.usd) + ' of fees accrued since the position’s last accounting update. ' + (hasOwed
      ? 'Another ' + feeUSD(fees.owed.usd) + ' is already recorded as owed. Its balance can include earlier fees and principal removed from liquidity; this snapshot cannot separate their origin.'
      : 'The recorded owed balances are zero, so the estimated collectable tokens come entirely from fees since that update.')],
    ['Add assets at the snapshot’s price', feeUSD(view.principalUSD) + ' principal + ' + feeUSD(fees.collectable.usd) + ' estimated collectable tokens = ' + feeUSD(view.assetsUSD) + ' in recorded assets. This balance is not a profit calculation; entry costs, deposits, withdrawals and earlier collections are not reconstructed.'],
    ['Start a fair holding comparison', canExplore
      ? 'Applying this snapshot starts the range lab with the principal’s token mix, an unchanged future price and zero assumed future fees. Holding starts with those same principal tokens. Already collectable tokens stay outside both sides of that comparison; they are not fee income earned after its starting point.'
      : 'This position cannot seed a supported range experiment. Its principal and owed balances remain inspectable. A holding comparison needs an explicit starting basket and time; the collectable balance alone does not establish a return.'],
  ];
}
