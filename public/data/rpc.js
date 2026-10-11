import { RPC_URL } from './config.js';
import { validateProvider } from './provenance.js';

const READ_METHODS = new Set(['eth_chainId', 'eth_getBlockByNumber', 'eth_call']);
export class RpcError extends Error {
  constructor(message, { category = 'response', retryable = false, code = null, revertReason = null } = {}) {
    super(message);
    this.name = 'RpcError';
    Object.assign(this, { category, retryable, code, revertReason });
  }
}
function revertReason(error) {
  const encoded = typeof error.data === 'string' ? error.data : error.data?.data;
  if (typeof encoded === 'string' && /^0x08c379a0[0-9a-fA-F]+$/.test(encoded) && encoded.length <= 4096) {
    const payload = encoded.slice(10);
    if (payload.length >= 128 && BigInt('0x' + payload.slice(0, 64)) === 32n) {
      const size = BigInt('0x' + payload.slice(64, 128));
      if (size <= 256n && payload.length >= 128 + Number(size) * 2) {
        const bytes = payload.slice(128, 128 + Number(size) * 2).match(/../g) || [];
        return new TextDecoder().decode(Uint8Array.from(bytes, byte => parseInt(byte, 16)));
      }
    }
  }
  return typeof error.message === 'string' && /^execution reverted: Invalid token ID[.]?$/i.test(error.message.trim()) ? 'Invalid token ID' : null;
}
export function createRpcClient({ endpoint = RPC_URL, fetchImpl = globalThis.fetch, timeoutMs = 15000, serial = false } = {}) {
  validateProvider(endpoint);
  let sequence = 0;
  const send = async (method, params = []) => {
    if (!READ_METHODS.has(method)) throw new Error('Only supported read-only RPC methods are allowed.');
    const id = ++sequence;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
        signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer',
      });
      if (!response.ok) throw new RpcError(response.status === 429
        ? 'The public data provider is busy (rate limit). Try again later or open a saved snapshot.'
        : 'The public data provider could not complete the request (HTTP ' + response.status + ').', {
        category: response.status === 429 ? 'rate-limit' : 'http',
        retryable: response.status === 429 || response.status === 408 || response.status >= 500,
      });
      const text = await response.text();
      if (text.length > 1000000) throw new RpcError('The data provider returned an oversized response.');
      let data;
      try { data = JSON.parse(text); } catch { throw new RpcError('The data provider returned invalid JSON.'); }
      if (data?.jsonrpc !== '2.0' || data.id !== id) throw new RpcError('The data provider returned an invalid RPC response.');
      if (data.error) {
        const reason = revertReason(data.error);
        const reverted = reason !== null || data.error.code === 3 || /execution reverted/i.test(data.error.message || '');
        const limited = !reverted && (data.error.code === -32005 || /rate.?limit|too many requests|quota|request limit|temporarily unavailable/i.test(data.error.message || ''));
        throw new RpcError(limited
          ? 'The public data provider is busy (RPC rate limit). Try again later or open a saved snapshot.'
          : 'The data provider could not complete this contract or RPC read.', {
          category: reverted ? 'revert' : limited ? 'rate-limit' : 'rpc',
          retryable: limited, code: data.error.code, revertReason: reason,
        });
      }
      if (!Object.hasOwn(data, 'result')) throw new RpcError('The data provider returned an invalid RPC response.');
      return data.result;
    } catch (error) {
      if (controller.signal.aborted) throw new RpcError('The public data request timed out. Try again or open a saved snapshot.', { category: 'timeout', retryable: true });
      if (error instanceof TypeError) throw new RpcError('Could not reach the public data provider. Check your connection or open a saved snapshot.', { category: 'network', retryable: true });
      throw error;
    } finally { clearTimeout(timer); }
  };
  // A serial capture stops its queued reads on failure; a fallback uses a fresh client.
  let queue = Promise.resolve();
  const rpc = serial ? (method, params = []) => { queue = queue.then(() => send(method, params)); return queue; } : send;
  Object.defineProperty(rpc, 'provider', { value: endpoint });
  return rpc;
}
