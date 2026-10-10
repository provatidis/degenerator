import { POOL, RPC_URL } from './config.js';
import { createRpcClient } from './rpc.js';
import { validateSnapshot } from './snapshot.js';

// ABI selectors from the supported Uniswap v2 interfaces. No transaction methods.
const selectors = { getPair: '0xe6a43905', factory: '0xc45a0155', token0: '0x0dfe1681', token1: '0xd21220a7', reserves: '0x0902f1ac', decimals: '0x313ce567', amountsOut: '0xd06ca61f' };
const word = (value) => value.replace(/^0x/, '').padStart(64, '0');
function words(data, count) {
  if (typeof data !== 'string' || !new RegExp('^0x[0-9a-fA-F]{' + count * 64 + '}$').test(data)) throw new Error('The contract returned an unsupported ABI response.');
  return Array.from({ length: count }, (_, i) => data.slice(2 + i * 64, 2 + (i + 1) * 64));
}
function decodeAddress(data) {
  const [value] = words(data, 1);
  if (!/^0{24}/.test(value)) throw new Error('The contract returned an invalid address.');
  return '0x' + value.slice(24).toLowerCase();
}
function header(block) {
  if (!block || typeof block.number !== 'string' || !/^0x[0-9a-fA-F]+$/.test(block.number)
    || typeof block.timestamp !== 'string' || !/^0x[0-9a-fA-F]+$/.test(block.timestamp)
    || typeof block.hash !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(block.hash)) throw new Error('The data provider returned an invalid block.');
  return { number: BigInt(block.number).toString(), hash: block.hash.toLowerCase(), timestamp: Number(BigInt(block.timestamp)) };
}

export async function fetchPoolSnapshot({ rpc = createRpcClient() } = {}) {
  const [chain, block] = await Promise.all([rpc('eth_chainId'), rpc('eth_getBlockByNumber', ['finalized', false])]);
  if (chain !== '0x1') throw new Error('The provider is not on the supported Ethereum chain.');
  const capturedBlock = header(block);
  const atBlock = (to, data) => rpc('eth_call', [{ to, data }, block.number]);
  const pair = decodeAddress(await atBlock(POOL.factory, selectors.getPair + word(POOL.usdc) + word(POOL.weth)));
  if (pair !== POOL.address) throw new Error('The factory did not return the supported pool.');
  const [factoryData, token0Data, token1Data, decimals0, decimals1, reserveData, routerData] = await Promise.all([
    atBlock(pair, selectors.factory), atBlock(pair, selectors.token0), atBlock(pair, selectors.token1),
    atBlock(POOL.usdc, selectors.decimals), atBlock(POOL.weth, selectors.decimals),
    atBlock(pair, selectors.reserves),
    atBlock(POOL.router, selectors.amountsOut + word((10n ** 18n).toString(16)) + word('40') + word('2') + word(POOL.weth) + word(POOL.usdc)),
  ]);
  if (decodeAddress(factoryData) !== POOL.factory || decodeAddress(token0Data) !== POOL.usdc || decodeAddress(token1Data) !== POOL.weth) {
    throw new Error('The pool identity or token order is unsupported.');
  }
  if (BigInt('0x' + words(decimals0, 1)[0]) !== 6n || BigInt('0x' + words(decimals1, 1)[0]) !== 18n) throw new Error('The token decimals differ from the supported deployment.');
  const reserves = words(reserveData, 3).map((value) => BigInt('0x' + value));
  const amounts = words(routerData, 4).map((value) => BigInt('0x' + value));
  if (amounts[0] !== 32n || amounts[1] !== 2n || amounts[2] !== 10n ** 18n) throw new Error('The router returned an unsupported quote.');
  const confirmed = header(await rpc('eth_getBlockByNumber', [block.number, false]));
  if (confirmed.hash !== capturedBlock.hash || confirmed.number !== capturedBlock.number || confirmed.timestamp !== capturedBlock.timestamp) {
    throw new Error('The block changed while reading the pool. Fetch a new snapshot.');
  }
  return validateSnapshot({
    version: 1, protocol: POOL.protocol, chainId: POOL.chainId, poolAddress: pair, factoryAddress: POOL.factory,
    block: capturedBlock,
    tokens: [{ address: POOL.usdc, symbol: 'USDC', decimals: 6 }, { address: POOL.weth, symbol: 'WETH', decimals: 18 }],
    reserves: { reserve0: reserves[0].toString(), reserve1: reserves[1].toString(), timestamp: Number(reserves[2]) },
    swapFee: { numerator: 997, denominator: 1000 },
    validation: { routerAddress: POOL.router, inputToken: POOL.weth, outputToken: POOL.usdc, amountInRaw: amounts[2].toString(), amountOutRaw: amounts[3].toString() },
    capturedAt: new Date().toISOString(), provider: RPC_URL,
  });
}
