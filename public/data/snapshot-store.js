export const MAX_SNAPSHOT_BYTES = 65536;
export function parseSnapshotFile(text, validate) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > MAX_SNAPSHOT_BYTES) throw new Error('Snapshot files must be at most 64 KB.');
  let input;
  try { input = JSON.parse(text); } catch { throw new Error('The snapshot file is not valid JSON.'); }
  return validate(input);
}
export function readSnapshot(key, parse, getStorage = () => globalThis.localStorage) {
  try {
    const text = getStorage().getItem(key);
    return text === null ? { snapshot: null, status: 'empty' } : { snapshot: parse(text), status: 'restored' };
  } catch { return { snapshot: null, status: 'unavailable' }; }
}
export function writeSnapshot(key, serialized, getStorage = () => globalThis.localStorage) {
  try { getStorage().setItem(key, serialized); return true; } catch { return false; }
}
