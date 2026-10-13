export function newChoiceSeed() {
  if (globalThis.crypto?.getRandomValues) return globalThis.crypto.getRandomValues(new Uint32Array(1))[0];
  return Math.floor(Math.random() * 2 ** 32);
}
export const validChoiceSeed = value => Number.isInteger(value) && value >= 0 && value < 2 ** 32;

// Keep a draft's order stable across checks and reloads, with a different order per group.
export function orderedLearningChoices(values, seed, group) {
  let state = seed >>> 0;
  for (const char of group) state = Math.imul(state ^ char.charCodeAt(0), 16777619) >>> 0;
  const result = values.map(item => [...item]);
  for (let i = result.length - 1; i > 0; i--) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const j = Math.floor(state / 2 ** 32 * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
