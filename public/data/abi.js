// Strict static ABI decoding for supported view methods. No signing or transactions.
const fail = () => { throw new Error('The contract returned an unsupported ABI response.'); };
export function abiWords(data, count) {
  if (typeof data !== 'string' || !new RegExp('^0x[0-9a-fA-F]{' + count * 64 + '}$').test(data)) fail();
  return Array.from({ length: count }, (_, i) => data.slice(2 + i * 64, 66 + i * 64));
}
export function encodeWord(hex) {
  if (typeof hex !== 'string' || !/^(0x)?[0-9a-fA-F]{1,64}$/.test(hex)) fail();
  return hex.replace(/^0x/, '').padStart(64, '0');
}
export function encodeUint(value) {
  const n = BigInt(value);
  if (n < 0n || n >= 1n << 256n) fail();
  return n.toString(16).padStart(64, '0');
}
export function addressFromWord(word) {
  if (!/^0{24}[0-9a-fA-F]{40}$/.test(word)) fail();
  return '0x' + word.slice(24).toLowerCase();
}
export const decodeAddress = data => addressFromWord(abiWords(data, 1)[0]);
export function uintFromWord(word, bits = 256) {
  const n = BigInt('0x' + word);
  if (n >= 1n << BigInt(bits)) fail();
  return n;
}
export function intFromWord(word, bits) {
  const raw = uintFromWord(word);
  const signed = raw >= 1n << 255n ? raw - (1n << 256n) : raw;
  const half = 1n << BigInt(bits - 1);
  if (signed < -half || signed >= half) fail();
  return Number(signed);
}
