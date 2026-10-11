export const MAX_SNAPSHOT_BYTES = 65536;
export class SnapshotVersionError extends Error {
  constructor() { super('This snapshot version is not supported by this app. Keep the file and open it with a compatible version.'); this.name = 'SnapshotVersionError'; }
}
export function parseSnapshotFile(text, validate) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > MAX_SNAPSHOT_BYTES) throw new Error('Snapshot files must be at most 64 KB.');
  let input;
  try { input = JSON.parse(text); } catch { throw new Error('The snapshot file is not valid JSON.'); }
  if (Number.isInteger(input?.version) && input.version > 0 && input.version !== 1) throw new SnapshotVersionError();
  return validate(input);
}
export function readSnapshot(key, parse, getStorage = () => globalThis.localStorage) {
  let text;
  try { text = getStorage().getItem(key); }
  catch { return { snapshot: null, status: 'unavailable' }; }
  if (text === null) return { snapshot: null, status: 'empty' };
  try { return { snapshot: parse(text), status: 'restored' }; }
  catch (error) { return { snapshot: null, status: error instanceof SnapshotVersionError ? 'incompatible' : 'invalid' }; }
}
export function writeSnapshot(key, serialized, getStorage = () => globalThis.localStorage) {
  try { getStorage().setItem(key, serialized); return true; } catch { return false; }
}
export function clearSnapshot(key, getStorage = () => globalThis.localStorage) {
  try { getStorage().removeItem(key); return true; } catch { return false; }
}
