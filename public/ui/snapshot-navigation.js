import { bindTablist } from '../lib/tablist.js';

export function initSnapshotNavigation({ activate = () => {} } = {}) {
  const section = document.getElementById('pool-lab');
  let currentSource = 'position';
  const tabs = bindTablist({
    tabs: [
      { key: 'pool', button: document.getElementById('source-pool-tab'), panel: document.getElementById('pool-source') },
      { key: 'position', button: document.getElementById('source-position-tab'), panel: document.getElementById('position-lab') },
    ],
    onSelect: key => {
      activate();
      currentSource = key;
      history.replaceState(null, '', location.pathname + location.search + (key === 'pool' ? '#pool-lab' : '#position-lab'));
    },
  });
  function restoreLocation(initial = false) {
    if (location.hash === '#inspect') {
      activate();
      tabs.select(currentSource);
    } else if (location.hash === '#position-lab' || location.hash === '#pool-lab') {
      activate();
      currentSource = location.hash === '#position-lab' ? 'position' : 'pool';
      tabs.select(currentSource);
      const scroll = () => requestAnimationFrame(() => section.scrollIntoView({ block: 'start', behavior: 'instant' }));
      if (document.readyState === 'loading' || document.readyState === 'interactive') document.addEventListener('DOMContentLoaded', scroll, { once: true });
      else scroll();
    } else if (initial) tabs.select('pool');
  }
  window.addEventListener('hashchange', () => restoreLocation());
  return {
    restoreLocation: () => restoreLocation(true),
    selectSource: (key, { scroll = false } = {}) => {
      activate();
      currentSource = key;
      tabs.select(key);
      if (scroll) {
        const perform = () => requestAnimationFrame(() => section.scrollIntoView({ block: 'start', behavior: 'instant' }));
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', perform, { once: true });
        else perform();
      }
    },
  };
}
