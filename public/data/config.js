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

for (const address of [POOL.factory, POOL.router, POOL.address, POOL.usdc, POOL.weth]) {
  if (!/^0x[0-9a-f]{40}$/.test(address)) throw new Error('Invalid supported deployment address.');
}
