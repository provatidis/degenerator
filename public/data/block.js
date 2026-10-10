export function blockHeader(block) {
  if (!block || !/^0x[0-9a-fA-F]+$/.test(block.number) || !/^0x[0-9a-fA-F]+$/.test(block.timestamp)
    || !/^0x[0-9a-fA-F]{64}$/.test(block.hash)) throw new Error('The data provider returned an invalid block.');
  const number = BigInt(block.number);
  const timestamp = Number(BigInt(block.timestamp));
  if (number <= 0n || number > BigInt(Number.MAX_SAFE_INTEGER) || !Number.isSafeInteger(timestamp) || timestamp <= 0 || timestamp >= 2 ** 32) throw new Error('The data provider returned an invalid block.');
  return { number: number.toString(), hash: block.hash.toLowerCase(), timestamp };
}
export async function finalizedBlock(rpc) {
  const [chain, block] = await Promise.all([rpc('eth_chainId'), rpc('eth_getBlockByNumber', ['finalized', false])]);
  if (chain !== '0x1') throw new Error('The provider is not on the supported Ethereum chain.');
  return { block: blockHeader(block), tag: block.number };
}
export async function confirmBlock(rpc, tag, captured) {
  const confirmed = blockHeader(await rpc('eth_getBlockByNumber', [tag, false]));
  if (confirmed.number !== captured.number || confirmed.hash !== captured.hash || confirmed.timestamp !== captured.timestamp) throw new Error('The block changed while reading the snapshot. Fetch a new snapshot.');
}
