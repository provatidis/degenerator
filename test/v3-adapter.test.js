import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchPositionSnapshot } from '../public/data/uniswap-v3.js';
import { V3 } from '../public/data/config.js';
import { abiWords, intFromWord, uintFromWord, decodeAddress } from '../public/data/abi.js';


const fixtureBlock = { number: '0x100', hash: '0x' + 'ab'.repeat(32), timestamp: '0x60000000' };
const fixturePool = '0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8';
function word(value) {
  let n = typeof value === 'string' && value.startsWith('0x') ? BigInt(value) : BigInt(value);
  if (n < 0n) n += 1n << 256n;
  return n.toString(16).padStart(64, '0');
}
const encoded = (...values) => '0x' + values.map(word).join('');
const fixtureSqrt = 1587245243673007558976961726392011n;
function v3RpcFixture(overrides = {}, calls = []) {
  return async (method, params = []) => {
    calls.push({ method, params });
    if (method === 'eth_chainId') return overrides.chain ?? '0x1';
    if (method === 'eth_getBlockByNumber') return params[0] === 'finalized' ? fixtureBlock : { ...fixtureBlock, ...overrides.confirmed };
    assert.equal(method, 'eth_call');
    assert.equal(params[1], fixtureBlock.number, 'All reads must share the captured block.');
    const { to, data } = params[0];
    if (data.startsWith('0x99fbab88')) {
      assert.equal(to, V3.positionManager);
      assert.equal(data, '0x99fbab88' + word(overrides.id ?? 37n));
      return overrides.position ?? encoded(0n, 0n, V3.usdc, V3.weth, 3000n, 192180n, 193380n, 10860507277202n, 0n, 0n, 0n, 0n);
    }
    if (data.startsWith('0x1698ee82')) {
      assert.equal(to, V3.factory);
      assert.equal(data, '0x1698ee82' + word(V3.usdc) + word(V3.weth) + word(3000n));
      return overrides.pool ?? encoded(fixturePool);
    }
    if (data.startsWith('0xf30dba93')) {
      assert.equal(to, fixturePool);
      const position = abiWords(overrides.position ?? encoded(0n, 0n, V3.usdc, V3.weth, 3000n, 192180n, 193380n, 10860507277202n, 0n, 0n, 0n, 0n), 12);
      assert.ok([position[5],position[6]].some(tick => data === '0xf30dba93' + tick));
      return overrides.tickData ?? encoded(10860507277202n,0n,0n,0n,0n,0n,0n,1n);
    }
    const responses = {
      '0xf3058399': encoded(0n), '0x46141319': encoded(0n),
      '0xc45a0155': encoded(V3.factory), '0x0dfe1681': encoded(V3.usdc), '0xd21220a7': encoded(V3.weth),
      '0xddca3f43': encoded(3000n), '0xd0c93a7c': encoded(60n),
      '0x3850c7bd': encoded(fixtureSqrt, 198113n, 0n, 1n, 1n, 0n, 1n),
      '0x313ce567': encoded(to === V3.usdc ? 6n : 18n),
    };
    assert.ok(Object.hasOwn(responses, data), 'Only supported view selectors may be called.');
    return overrides[data] ?? responses[data];
  };
}

test('v3 adapter verifies canonical manager, pool, token order, fee tier, spacing and exact principal at one block',async()=>{
  const calls=[];const progress=[];
  const snapshot=await fetchPositionSnapshot('37',{rpc:v3RpcFixture({},calls),onProgress:message=>progress.push(message)});
  assert.equal(snapshot.principal.amount1Raw,'9999999999999133');
  assert.equal(snapshot.principal.amount0Raw,'0');
  assert.equal(snapshot.block.number,'256');
  assert.equal(calls.filter(call=>call.method==='eth_call').length,15);
  assert.equal(progress.length,4);
  assert.equal(snapshot.version,2);
  assert.equal(snapshot.fees.collectable0Raw,'0');
  assert.equal(snapshot.fees.collectable1Raw,'0');
});
test('wrong chain, unknown pools, inconsistent identities and decimals are rejected',async()=>{
  for(const overrides of [
    {chain:'0x2105'},{pool:encoded(0n)},{'0xc45a0155':encoded(V3.positionManager)},
    {'0x0dfe1681':encoded(V3.weth)},{'0xd21220a7':encoded(V3.usdc)},
    {'0xddca3f43':encoded(500n)},{'0xd0c93a7c':encoded(10n)},{'0x313ce567':encoded(8n)},
    {'0x3850c7bd':'0x'},{'0x3850c7bd':encoded(1n,0n,0n,1n,1n,0n,1n)},
  ]) await assert.rejects(fetchPositionSnapshot('37',{rpc:v3RpcFixture(overrides)}));
});
test('unsupported tokens and corrupt integer encodings fail before use',async()=>{
  for(const position of [
    encoded(0n,0n,V3.weth,V3.usdc,3000n,192180n,193380n,1n,0n,0n,0n,0n),
    encoded(0n,0n,V3.usdc,V3.weth,2500n,192180n,193380n,1n,0n,0n,0n,0n),
    encoded(0n,0n,V3.usdc,V3.weth,3000n,192180n,193380n,1n<<128n,0n,0n,0n,0n),
  ]) await assert.rejects(fetchPositionSnapshot('37',{rpc:v3RpcFixture({position})}));
  const badSign='0'.repeat(58)+'ffffff';
  assert.throws(()=>intFromWord(badSign,24));
  assert.equal(intFromWord(abiWords(encoded(-60n),1)[0],24),-60);
  assert.throws(()=>uintFromWord(abiWords(encoded(256n),1)[0],8));
  assert.throws(()=>decodeAddress(encoded(1n<<160n)));
});
test('changed blocks and invalid IDs cannot become saved snapshots',async()=>{
  await assert.rejects(fetchPositionSnapshot('37',{rpc:v3RpcFixture({confirmed:{hash:'0x'+'cd'.repeat(32)}})}),/block changed/);
  const calls=[];
  await assert.rejects(fetchPositionSnapshot('0',{rpc:v3RpcFixture({},calls)}),/NFT ID/);
  assert.equal(calls.length,0);
});
test('very large NFT IDs are encoded without Number precision loss',async()=>{
  const id=((1n<<256n)-1n).toString();
  const snapshot=await fetchPositionSnapshot(id,{rpc:v3RpcFixture({id})});
  assert.equal(snapshot.tokenId,id);
});

import { RpcError } from '../public/data/rpc.js';

test('missing or burned NFT reverts identify the ID and block without mislabelling other RPC failures', async () => {
  for (const [reason, expected] of [['Invalid token ID', /Position #37 does not exist.*block 256.*burned/], [null, /contract unavailable/]]) {
    const source = v3RpcFixture();
    const rpc = async (method, params = []) => {
      if (method === 'eth_call' && params[0].data.startsWith('0x99fbab88')) throw new RpcError('contract unavailable', { category: 'revert', revertReason: reason });
      return source(method, params);
    };
    await assert.rejects(fetchPositionSnapshot('37', { rpc }), expected);
  }
});

test('invalid fee-growth responses and unsupported boundary liquidity cannot be saved',async()=>{
  for(const overrides of [
    {'0xf3058399':'0x'}, {'0x46141319':'0x'},
    {tickData:encoded(1n,0n,0n,0n,0n,0n,0n,1n)},
    {tickData:encoded(10860507277202n,0n,0n,0n,0n,0n,0n,0n)},
    {tickData:encoded(10860507277202n,1n<<127n,0n,0n,0n,0n,0n,1n)},
  ]) await assert.rejects(fetchPositionSnapshot('37',{rpc:v3RpcFixture(overrides)}));
});
