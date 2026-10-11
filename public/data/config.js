// Initial supported deployment. Add each future protocol as a separate verified adapter.
export const POOL = Object.freeze({
  protocol: 'uniswap-v2',
  chainId: 1,
  chainName: 'Ethereum',
  factory: '0x5c69bee701ef814a2b6a3edd4b1652cb9cc5aa6f',
  router: '0x7a250d5630b4cf539739df2c5dacb4c659f2488d',
  address: '0xb4e16d0168e52d35cacd2c6185b44281ec28c9dc',
  usdc: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  weth: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
});
export const RPC_URL = 'https://ethereum-rpc.publicnode.com';
export const RPC_ENDPOINTS = Object.freeze([RPC_URL, 'https://eth.drpc.org']);

for (const address of [POOL.factory, POOL.router, POOL.address, POOL.usdc, POOL.weth]) {
  if (!/^0x[0-9a-f]{40}$/.test(address)) throw new Error('Invalid supported deployment address.');
}

export const V3 = Object.freeze({
  protocol: 'uniswap-v3', chainId: 1, chainName: 'Ethereum',
  factory: '0x1f98431c8ad98523631ae4a59f267346ea31f984',
  positionManager: '0xc36442b4a4522e871399cd717abdd847ab11fe88',
  usdc: POOL.usdc, weth: POOL.weth,
});
export const V3_FEE_SPACING = Object.freeze({ 100: 1, 500: 10, 3000: 60, 10000: 200 });

// Canonical Ethereum USDC/WETH pools returned by the Uniswap v3 factory.
export const V3_POOLS = Object.freeze({
  100: '0xe0554a476a092703abdb3ef35c80e0d76d32939f',
  500: '0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640',
  3000: '0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8',
  10000: '0x7bea39867e4169dbe237d55c8242a8f2fcdcc387',
});
