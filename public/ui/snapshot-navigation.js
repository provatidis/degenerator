import { bindTablist } from '../lib/tablist.js';

export function initSnapshotNavigation() {
  const section = document.getElementById('pool-lab');
  const tabs = bindTablist({
    tabs: [
      { key: 'pool', button: document.getElementById('source-pool-tab'), panel: document.getElementById('pool-source') },
      { key: 'position', button: document.getElementById('source-position-tab'), panel: document.getElementById('position-lab') },
    ],
    onSelect: key => {
      history.replaceState(null, '', location.pathname + location.search + (key === 'pool' ? '#pool-lab' : '#position-lab'));
    },
  });
  function restoreLocation(initial = false) {
    if (location.hash === '#position-lab' || location.hash === '#pool-lab') {
      tabs.select(location.hash === '#position-lab' ? 'position' : 'pool');
      const scroll = () => requestAnimationFrame(() => section.scrollIntoView({ block: 'start', behavior: 'instant' }));
      if (document.readyState === 'loading' || document.readyState === 'interactive') document.addEventListener('DOMContentLoaded', scroll, { once: true });
      else scroll();
    } else if (initial) tabs.select('pool');
  }
  window.addEventListener('hashchange', () => restoreLocation());
  return { restoreLocation: () => restoreLocation(true) };
}
