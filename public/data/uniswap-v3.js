import { V3, V3_FEE_SPACING, RPC_URL } from './config.js';
import { createRpcClient } from './rpc.js';
import { finalizedBlock, confirmBlock } from './block.js';
import { abiWords, encodeWord, encodeUint, decodeAddress, addressFromWord, uintFromWord, intFromWord } from './abi.js';
import { positionId, validatePositionSnapshot } from './position-snapshot.js';
import { positionAmounts } from '../models/uniswap-v3.js';

// Selectors from the deployed v3 manager, factory, pool and ERC20 view interfaces.
const selectors = Object.freeze({
  positions: '0x99fbab88', getPool: '0x1698ee82', factory: '0xc45a0155',
  token0: '0x0dfe1681', token1: '0xd21220a7', fee: '0xddca3f43',
  tickSpacing: '0xd0c93a7c', slot0: '0x3850c7bd', decimals: '0x313ce567',
});
export async function fetchPositionSnapshot(id, { rpc = createRpcClient(), onProgress = () => {} } = {}) {
  const tokenId = positionId(id);
  onProgress('Reading a finalized Ethereum block…');
  const { block, tag } = await finalizedBlock(rpc);
  const atBlock = (to, data) => rpc('eth_call', [{ to, data }, tag]);
  onProgress('Reading position #' + tokenId + '…');
  const [positionData, managerFactory] = await Promise.all([
    atBlock(V3.positionManager, selectors.positions + encodeUint(tokenId)),
    atBlock(V3.positionManager, selectors.factory),
  ]);
  if (decodeAddress(managerFactory) !== V3.factory) throw new Error('The position manager is not connected to the supported Uniswap v3 factory.');
  const values = abiWords(positionData, 12);
  uintFromWord(values[0], 96); addressFromWord(values[1]);
  if (addressFromWord(values[2]) !== V3.usdc || addressFromWord(values[3]) !== V3.weth) throw new Error('This release supports Ethereum Uniswap v3 WETH/USDC positions. Choose a WETH/USDC NFT ID.');
  const fee = Number(uintFromWord(values[4], 24));
  if (!Object.hasOwn(V3_FEE_SPACING, fee)) throw new Error('This position uses an unsupported fee tier.');
  const position = {
    fee, tickLower: intFromWord(values[5], 24), tickUpper: intFromWord(values[6], 24),
    liquidity: uintFromWord(values[7], 128).toString(),
    feeGrowthInside0LastX128: uintFromWord(values[8]).toString(), feeGrowthInside1LastX128: uintFromWord(values[9]).toString(),
    tokensOwed0: uintFromWord(values[10], 128).toString(), tokensOwed1: uintFromWord(values[11], 128).toString(),
  };
  onProgress('Checking the pool and its recorded price…');
  const poolAddress = decodeAddress(await atBlock(V3.factory, selectors.getPool + encodeWord(V3.usdc) + encodeWord(V3.weth) + encodeUint(fee)));
  if (/^0x0{40}$/.test(poolAddress)) throw new Error('The factory did not return a pool for this position.');
  const [factory, token0, token1, poolFee, tickSpacing, slot0, decimals0, decimals1] = await Promise.all([
    atBlock(poolAddress, selectors.factory), atBlock(poolAddress, selectors.token0), atBlock(poolAddress, selectors.token1),
    atBlock(poolAddress, selectors.fee), atBlock(poolAddress, selectors.tickSpacing), atBlock(poolAddress, selectors.slot0),
    atBlock(V3.usdc, selectors.decimals), atBlock(V3.weth, selectors.decimals),
  ]);
  if (decodeAddress(factory) !== V3.factory || decodeAddress(token0) !== V3.usdc || decodeAddress(token1) !== V3.weth
    || Number(uintFromWord(abiWords(poolFee, 1)[0], 24)) !== fee
    || intFromWord(abiWords(tickSpacing, 1)[0], 24) !== V3_FEE_SPACING[fee]) throw new Error('The pool identity, fee tier or tick spacing is inconsistent.');
  if (uintFromWord(abiWords(decimals0, 1)[0], 8) !== 6n || uintFromWord(abiWords(decimals1, 1)[0], 8) !== 18n) throw new Error('The token decimals differ from the supported deployment.');
  const price = abiWords(slot0, 7);
  const sqrtPriceX96 = uintFromWord(price[0], 160);
  const currentTick = intFromWord(price[1], 24);
  for (const word of price.slice(2, 5)) uintFromWord(word, 16);
  uintFromWord(price[5], 8); uintFromWord(price[6], 1);
  const amounts = positionAmounts(BigInt(position.liquidity), sqrtPriceX96, position.tickLower, position.tickUpper);
  onProgress('Confirming the block and exact token amounts…');
  await confirmBlock(rpc, tag, block);
  return validatePositionSnapshot({
    version: 1, kind: 'uniswap-v3-position', protocol: V3.protocol, chainId: 1, tokenId,
    positionManager: V3.positionManager, factoryAddress: V3.factory, poolAddress, block,
    tokens: [{ address: V3.usdc, symbol: 'USDC', decimals: 6 }, { address: V3.weth, symbol: 'WETH', decimals: 18 }],
    position, pool: { sqrtPriceX96: sqrtPriceX96.toString(), tick: currentTick, tickSpacing: V3_FEE_SPACING[fee] },
    principal: { amount0Raw: amounts.amount0.toString(), amount1Raw: amounts.amount1.toString() },
    capturedAt: new Date().toISOString(), provider: RPC_URL,
  });
}
