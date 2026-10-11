import { workspaceFromHash } from '../lib/workspace-links.js';

export function initWorkspaces() {
  const panels = Object.fromEntries(['experiment', 'inspect', 'mechanics', 'replay'].map(key => [key, document.getElementById(key + '-workspace')]));
  const title = document.getElementById('workspace-title');
  const copy = {
    experiment: ['DEFI PLAYGROUND', 'Compare liquidity scenarios', 'Change a price, range or fee assumption. Compare the outcome with holding.'],
    inspect: ['RECORDED CHAIN DATA', 'Inspect a pool or position', 'Read principal and fee accounting at one recorded Ethereum block.'],
    replay: ['RECORDED HISTORY', 'Replay a fixed-range position', 'Follow principal, earned fees and holding through a recorded period.'],
    mechanics: ['VIRTUAL POOL', 'Explore pool mechanics', 'Swap, deposit and withdraw virtual tokens. Follow the changing reserves.'],
  };
  function select(key) {
    if (!Object.hasOwn(panels, key)) throw new Error('Choose a supported workspace.');
    const focusWasHidden = Object.entries(panels).some(([name, panel]) => name !== key && panel.contains(document.activeElement));
    for (const [name, panel] of Object.entries(panels)) panel.hidden = name !== key;
    document.getElementById('workspace-eyebrow').textContent = copy[key][0];
    title.textContent = copy[key][1];
    document.getElementById('workspace-subtitle').textContent = copy[key][2];
    document.querySelector('.intro-range-link').hidden = key !== 'experiment';
    for (const name of ['experiment', 'inspect']) {
      const link = document.getElementById('nav-' + name);
      if (key === name || (name === 'experiment' && ['mechanics','replay'].includes(key))) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
    if (focusWasHidden) title.focus({ preventScroll: true });
  }
  function restoreLocation() {
    const key = workspaceFromHash(location.hash);
    select(key);
    if (['#experiment', '#inspect'].includes(location.hash)) {
      const scroll = () => requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scroll, { once: true });
      else scroll();
    } else if (key === 'mechanics') {
      const scroll = () => requestAnimationFrame(() => document.getElementById('swap-sandbox').scrollIntoView({ block: 'start', behavior: 'instant' }));
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scroll, { once: true });
      else scroll();
    }
  }
  window.addEventListener('hashchange', restoreLocation);
  // Clicking an unchanged fragment should still reveal its workspace after a handoff.
  document.addEventListener('click', event => {
    const link = event.target.closest('a');
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target === '_blank') return;
    const url = new URL(link.href);
    if (url.origin === location.origin && url.pathname === location.pathname && url.hash) {
      select(workspaceFromHash(url.hash));
      if (url.hash === location.hash && ['#experiment', '#inspect'].includes(url.hash)) restoreLocation();
    }
  });
  restoreLocation();
  return { select, restoreLocation };
}
