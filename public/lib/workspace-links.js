// Stable fragments remain the public entry points for every existing tool.
export function workspaceFromHash(hash) {
  if (['#inspect', '#pool-lab', '#position-lab'].includes(hash) || hash.startsWith('#example=')) return 'inspect';
  if (hash === '#historical-case') return 'replay';
  if (hash === '#swap-sandbox') return 'mechanics';
  return 'experiment';
}
