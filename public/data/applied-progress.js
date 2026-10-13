import { APPLIED_IDS } from '../lib/applied-lessons.js';

export const APPLIED_KEY = 'passiko-applied-liquidity-v1';
export const emptyAppliedProgress = () => ({ version: 1, completed: [], drafts: {} });
export function parseAppliedProgress(value) {
  const clean = emptyAppliedProgress();
  if (value?.version !== 1) return clean;
  clean.completed = APPLIED_IDS.filter(id => Array.isArray(value.completed) && value.completed.includes(id));
  for (const id of APPLIED_IDS) {
    const draft = value.drafts?.[id];
    if (!draft || typeof draft !== 'object') continue;
    const short = (key, max) => typeof draft[key] === 'string' && draft[key].length <= max ? draft[key] : '';
    clean.drafts[id] = { prediction: short('prediction', 16), answer: short('answer', 32), reason: short('reason', 16),
      revealed: draft.revealed === true, checkpoint: Number.isInteger(draft.checkpoint) && draft.checkpoint >= 0 && draft.checkpoint < 32 ? draft.checkpoint : null };
  }
  return clean;
}
export function readAppliedProgress(getStorage = () => globalThis.localStorage) {
  try { const raw = getStorage().getItem(APPLIED_KEY); return { progress: raw ? parseAppliedProgress(JSON.parse(raw)) : emptyAppliedProgress(), available: true }; }
  catch { return { progress: emptyAppliedProgress(), available: false }; }
}
export function saveAppliedProgress(progress, getStorage = () => globalThis.localStorage) {
  try { getStorage().setItem(APPLIED_KEY, JSON.stringify(parseAppliedProgress(progress))); return true; }
  catch { return false; }
}
