import { isReplayHash } from '../data/replay-cases.js';

// Stable fragments remain the public entry points for every existing tool.
export function workspaceFromHash(hash) {
  if (['#inspect', '#pool-lab', '#position-lab'].includes(hash) || hash.startsWith('#example=')) return 'inspect';
  if (isReplayHash(hash)) return 'replay';
  if (hash === '#swap-sandbox') return 'mechanics';
  return 'experiment';
}
