// Keep legacy storage and format identifiers so existing work survives rebranding.
import { LESSON_IDS, VARIANTS, validateLessonInputs } from '../models/lesson-experiments.js?v=1.13.0';
import { validChoiceSeed } from '../lib/learning-choices.js?v=1.13.0';
export const LEARNING_KEY = 'degenerator-learning-liquidity-v1';
export function emptyProgress() { return { version: 1, completed: [], lastLesson: LESSON_IDS[0], drafts: {} }; }
export function parseProgress(value) {
  const clean = emptyProgress();
  if (!value || value.version !== 1) return clean;
  clean.completed = LESSON_IDS.filter(id => Array.isArray(value.completed) && value.completed.includes(id));
  if (LESSON_IDS.includes(value.lastLesson)) clean.lastLesson = value.lastLesson;
  for (const id of LESSON_IDS) {
    const draft = value.drafts?.[id];
    if (!draft || !Number.isInteger(draft.variant) || draft.variant < 0 || draft.variant >= VARIANTS) continue;
    try {
      const inputs = validateLessonInputs(id, draft.inputs, draft.variant);
      clean.drafts[id] = { variant: draft.variant, inputs,
        prediction: typeof draft.prediction === 'string' && draft.prediction.length <= 16 ? draft.prediction : '',
        answer: typeof draft.answer === 'string' && draft.answer.length <= 32 ? draft.answer : '',
        reason: typeof draft.reason === 'string' && draft.reason.length <= 16 ? draft.reason : '',
        application: typeof draft.application === 'string' && draft.application.length <= 24 ? draft.application : '',
        choiceSeed: validChoiceSeed(draft.choiceSeed) ? draft.choiceSeed : null,
        ran: draft.ran === true };
    } catch { /* Ignore an invalid exercise without losing other progress. */ }
  }
  return clean;
}
export function readProgress(getStorage = () => globalThis.localStorage) {
  try {
    const raw = getStorage().getItem(LEARNING_KEY);
    return { progress: raw ? parseProgress(JSON.parse(raw)) : emptyProgress(), available: true };
  } catch { return { progress: emptyProgress(), available: false }; }
}
export function saveProgress(progress, getStorage = () => globalThis.localStorage) {
  try { getStorage().setItem(LEARNING_KEY, JSON.stringify(parseProgress(progress))); return true; }
  catch { return false; }
}
