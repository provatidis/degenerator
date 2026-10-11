import { RPC_URL, RPC_ENDPOINTS } from './config.js';
import { createRpcClient, RpcError } from './rpc.js';

// Retry the entire read with a new finalized block. Never mix providers in one snapshot.
export async function requestSnapshot(read, { rpc, endpoints = RPC_ENDPOINTS, createClient = createRpcClient, onFallback = () => {} } = {}) {
  if (rpc) return read(rpc, rpc.provider || RPC_URL);
  for (const [index, endpoint] of endpoints.entries()) {
    try { return await read(createClient({ endpoint, serial: endpoint !== RPC_URL }), endpoint); }
    catch (error) {
      if (!(error instanceof RpcError) || !error.retryable || index === endpoints.length - 1) throw error;
      onFallback('The first provider is unavailable. Restarting the snapshot read with the backup provider…');
    }
  }
  throw new Error('No snapshot data providers are configured.');
}
