import { RPC_URL } from './config.js';

const READ_METHODS = new Set(['eth_chainId', 'eth_getBlockByNumber', 'eth_call']);
export function createRpcClient({ endpoint = RPC_URL, fetchImpl = globalThis.fetch, timeoutMs = 15000 } = {}) {
  if (new URL(endpoint).protocol !== 'https:') throw new Error('RPC requires HTTPS.');
  let sequence = 0;
  return async (method, params = []) => {
    if (!READ_METHODS.has(method)) throw new Error('Only supported read-only RPC methods are allowed.');
    const id = ++sequence;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
        signal: controller.signal,
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
      });
      if (!response.ok) throw new Error(response.status === 429
        ? 'The public data provider is busy. Try again later or open a saved snapshot.'
        : 'The public data provider could not complete the request.');
      const text = await response.text();
      if (text.length > 1000000) throw new Error('The data provider returned an oversized response.');
      let data;
      try { data = JSON.parse(text); } catch { throw new Error('The data provider returned invalid JSON.'); }
      if (data?.jsonrpc !== '2.0' || data.id !== id || data.error || !Object.hasOwn(data, 'result')) {
        throw new Error('The data provider returned an invalid or failed RPC response.');
      }
      return data.result;
    } catch (error) {
      if (controller.signal.aborted) throw new Error('The public data request timed out. Try again or open a saved snapshot.');
      if (error instanceof TypeError) throw new Error('Could not reach the public data provider. Check your connection or open a saved snapshot.');
      throw error;
    } finally {
      clearTimeout(timer);
    }
  };
}
