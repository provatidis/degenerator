// Keep legacy storage and format identifiers so existing work survives rebranding.
import { MODEL as FULL_MODEL, validateScenario } from '../models/cp50-v1.js';
import { MODEL as RANGE_MODEL, validateRange } from '../models/cl-range-v1.js';
import { validateSnapshot, snapshotView } from './snapshot.js';
import { validatePositionSnapshot, positionScenario } from './position-snapshot.js';

export const EXPERIMENTS_KEY = 'degenerator-experiments-v1';
export const MAX_EXPERIMENTS = 50;
export const MAX_LIBRARY_BYTES = 524288;
export const emptyLibrary = () => ({ version: 1, kind: 'degenerator-experiments', experiments: [] });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export class ExperimentVersionError extends Error {
  constructor() { super('This experiment file uses an unsupported version. Keep it for a compatible app.'); }
}
export function experimentName(value) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 80 || /[\u0000-\u001f\u007f]/.test(value)) throw new Error('Enter a name of 1–80 characters on one line.');
  return value.trim();
}
export function experimentNotes(value) {
  if (typeof value !== 'string' || value.length > 1000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) throw new Error('Notes must be at most 1,000 characters of plain text.');
  return value.trim();
}
export function validateExperimentDraft(input) {
  const model = input?.model;
  if (![FULL_MODEL, RANGE_MODEL].includes(model)) throw new ExperimentVersionError();
  const inputs = model === FULL_MODEL ? validateScenario(input.inputs) : validateRange(input.inputs);
  let origin = null;
  if (input.origin != null) {
    if (input.origin.kind === 'pool') {
      const snapshot = validateSnapshot(input.origin.snapshot);
      if (inputs.initialPrice !== snapshotView(snapshot).ethPrice) throw new Error('The experiment’s starting price does not match its source snapshot.');
      origin = { kind: 'pool', snapshot };
    } else if (input.origin.kind === 'position' && model === RANGE_MODEL) {
      const snapshot = validatePositionSnapshot(input.origin.snapshot);
      const source = positionScenario(snapshot);
      if (['investment','initialPrice','lowerPrice','upperPrice'].some(key => inputs[key] !== source[key])) throw new Error('The experiment’s starting principal or range does not match its source position.');
      origin = { kind: 'position', snapshot };
    } else throw new Error('This experiment has an unsupported source snapshot.');
  }
  return { model, inputs, origin };
}
function date(value) {
  if (typeof value !== 'string' || value.length > 40 || !Number.isFinite(Date.parse(value))) throw new Error('The experiment has an invalid saved date.');
  return new Date(value).toISOString();
}
export function validateExperiment(input) {
  if (!uuid.test(input?.id)) throw new Error('The experiment has an invalid ID.');
  const createdAt = date(input.createdAt), updatedAt = date(input.updatedAt);
  if (createdAt > updatedAt) throw new Error('The experiment’s saved dates are inconsistent.');
  return { id: input.id.toLowerCase(), name: experimentName(input.name), notes: experimentNotes(input.notes),
    ...validateExperimentDraft(input), createdAt, updatedAt };
}
export function validateLibrary(input) {
  if (input?.version !== 1) throw new ExperimentVersionError();
  if (input.kind !== 'degenerator-experiments' || !Array.isArray(input.experiments)) throw new Error('This file is not a Passiko experiment library.');
  if (input.experiments.length > MAX_EXPERIMENTS) throw new Error('Keep at most 50 experiments in one library. Export a backup before making room.');
  const experiments = input.experiments.map(validateExperiment);
  if (new Set(experiments.map(item => item.id)).size !== experiments.length) throw new Error('The experiment file contains repeated IDs.');
  return { ...emptyLibrary(), experiments };
}
export function libraryJSON(input) {
  const text = JSON.stringify(validateLibrary(input), null, 2) + '\n';
  if (new TextEncoder().encode(text).length > MAX_LIBRARY_BYTES) throw new Error('Experiment libraries must be at most 512 KB. Export a backup before making room.');
  return text;
}
export function parseLibrary(text) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > MAX_LIBRARY_BYTES) throw new Error('Experiment libraries must be at most 512 KB.');
  let input;
  try { input = JSON.parse(text); } catch { throw new Error('The experiment file is not valid JSON.'); }
  return validateLibrary(input);
}
export function readLibrary(getStorage = () => globalThis.localStorage) {
  let raw = null;
  try {
    raw = getStorage().getItem(EXPERIMENTS_KEY);
    return { library: raw === null ? emptyLibrary() : parseLibrary(raw), status: raw === null ? 'empty' : 'restored', raw };
  } catch (error) {
    return { library: emptyLibrary(), raw, status: raw === null ? 'unavailable' : error instanceof ExperimentVersionError ? 'incompatible' : 'invalid' };
  }
}
export function writeLibrary(library, getStorage = () => globalThis.localStorage) {
  const text = libraryJSON(library);
  try { getStorage().setItem(EXPERIMENTS_KEY, text); return true; } catch { return false; }
}
export function createExperiment(draft, name, notes, { id = globalThis.crypto.randomUUID(), now = new Date().toISOString() } = {}) {
  return validateExperiment({ ...draft, id, name, notes, createdAt: now, updatedAt: now });
}
export function addExperiment(library, experiment) {
  const clean = validateLibrary(library), entry = validateExperiment(experiment);
  if (clean.experiments.some(item => item.id === entry.id)) throw new Error('An experiment with this ID is already saved.');
  return validateLibrary({ ...clean, experiments: [entry, ...clean.experiments] });
}
export function editExperiment(library, previous, name, notes, now = new Date().toISOString()) {
  const clean = validateLibrary(library), current = clean.experiments.find(item => item.id === previous.id);
  if (!current || JSON.stringify(current) !== JSON.stringify(validateExperiment(previous))) throw new Error('This experiment changed in another tab. Reopen its editor before saving.');
  const edited = validateExperiment({ ...current, name, notes, updatedAt: now > current.updatedAt ? now : current.updatedAt });
  return { ...clean, experiments: clean.experiments.map(item => item.id === edited.id ? edited : item) };
}
export function removeExperiment(library, previous) {
  const clean = validateLibrary(library), current = clean.experiments.find(item => item.id === previous.id);
  if (!current || JSON.stringify(current) !== JSON.stringify(validateExperiment(previous))) throw new Error('This experiment changed in another tab. Review it before removing.');
  return { ...clean, experiments: clean.experiments.filter(item => item.id !== current.id) };
}
export function mergeLibraries(existing, incoming, newId = () => globalThis.crypto.randomUUID()) {
  let library = validateLibrary(existing);
  const imported = validateLibrary(incoming);
  let added = 0, copies = 0;
  for (const entry of [...imported.experiments].reverse()) {
    const found = library.experiments.find(item => item.id === entry.id);
    if (found && JSON.stringify(found) === JSON.stringify(entry)) continue;
    const copy = found ? validateExperiment({ ...entry, id: newId() }) : entry;
    library = addExperiment(library, copy); added++; if (found) copies++;
  }
  libraryJSON(library);
  return { library, added, copies };
}
