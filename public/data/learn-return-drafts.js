import { validateExperimentDraft } from './saved-experiments.js';

export const LEARN_RETURN_KEY = 'degenerator-learn-return-v1';
const MAX_BYTES = 131072;
export function validateLearnReturn(input) {
  if (input?.version !== 1 || !Array.isArray(input.drafts) || input.drafts.length < 1 || input.drafts.length > 2) throw new Error('Unsupported working draft.');
  const drafts = input.drafts.map(validateExperimentDraft);
  if (new Set(drafts.map(draft => draft.model)).size !== drafts.length) throw new Error('Duplicate working model.');
  if (!drafts.some(draft => draft.model === input.activeModel)) throw new Error('Missing active working model.');
  return { version: 1, activeModel: input.activeModel, drafts };
}
export function readLearnReturn(getStorage = () => globalThis.sessionStorage) {
  try {
    const text = getStorage().getItem(LEARN_RETURN_KEY);
    if (!text) return { status: 'empty', draft: null };
    if (text.length > MAX_BYTES) return { status: 'invalid', draft: null };
    return { status: 'ready', draft: validateLearnReturn(JSON.parse(text)) };
  } catch { return { status: 'unavailable', draft: null }; }
}
export function saveLearnReturn(draft, getStorage = () => globalThis.sessionStorage) {
  try {
    const stored = readLearnReturn(getStorage);
    if (!['empty','ready'].includes(stored.status)) return false;
    const text = JSON.stringify(validateLearnReturn(draft));
    if (text.length > MAX_BYTES) return false;
    getStorage().setItem(LEARN_RETURN_KEY, text); return true;
  } catch { return false; }
}
export function clearLearnReturn(getStorage = () => globalThis.sessionStorage) {
  try { getStorage().removeItem(LEARN_RETURN_KEY); return true; } catch { return false; }
}
