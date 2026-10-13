import { workspaceFromHash } from '../lib/workspace-links.js';

export function initWorkspaces() {
  const panels = Object.fromEntries(['experiment', 'inspect', 'mechanics', 'replay'].map(key => [key, document.getElementById(key + '-workspace')]));
  const title = document.getElementById('workspace-title');
  const entry = document.getElementById('experiment-entry') || document.querySelector('.intro-actions, .intro-range-link');
  const toolMenu = document.getElementById('workspace-tools');
  const toolToggle = document.getElementById('workspace-tools-toggle');
  function closeTools() {
    if (!matchMedia('(max-width: 750px)').matches) return;
    if (toolMenu.contains(document.activeElement)) toolToggle.focus({ preventScroll: true });
    toolToggle.setAttribute('aria-expanded', 'false');
  }
  toolToggle.addEventListener('click', () => {
    const expanded = toolToggle.getAttribute('aria-expanded') === 'true';
    toolToggle.setAttribute('aria-expanded', String(!expanded));
  });
  const copy = {
    experiment: ['HYPOTHETICAL MODELS', 'Compare liquidity scenarios', 'Change a price, range or fee assumption. Compare the outcome with holding.'],
    inspect: ['RECORDED SNAPSHOTS', 'Inspect a pool or position', 'Read principal and fee accounting at one recorded Ethereum block.'],
    replay: ['VERIFIED HISTORICAL CASE', 'Replay a fixed-range position', 'Follow principal, earned fees and holding through a recorded period.'],
    mechanics: ['VIRTUAL POOL', 'Explore pool mechanics', 'Swap, deposit and withdraw virtual tokens. Follow the changing reserves.'],
  };
  function select(key) {
    if (!Object.hasOwn(panels, key)) throw new Error('Choose a supported workspace.');
    const focusWasHidden = (key === 'mechanics' && toolMenu.contains(document.activeElement))
      || Object.entries(panels).some(([name, panel]) => name !== key && panel.contains(document.activeElement));
    for (const [name, panel] of Object.entries(panels)) panel.hidden = name !== key;
    document.getElementById('workspace-eyebrow').textContent = copy[key][0];
    title.textContent = copy[key][1];
    document.getElementById('workspace-subtitle').textContent = copy[key][2];
    if (entry) entry.hidden = key !== 'experiment';
    for (const name of ['experiment', 'inspect']) {
      const link = document.getElementById('nav-' + name);
      if (key === name || (name === 'experiment' && key === 'mechanics') || (name === 'inspect' && key === 'replay')) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
    const tools = document.querySelector('.workspace-links');
    toolMenu.hidden = key === 'mechanics';
    tools.hidden = key === 'mechanics';
    document.getElementById('workspace-tools-label').textContent = key === 'inspect'
      ? 'Explore inspect tools' : key === 'replay' ? 'Explore recorded history tools' : 'Explore experiment tools';
    tools.setAttribute('aria-label', key === 'inspect' ? 'Inspect tools' : key === 'replay' ? 'Recorded history tools' : key === 'mechanics' ? 'Pool mechanics tools' : 'Experiment tools');
    for (const link of tools.querySelectorAll('[data-workspaces]')) {
      link.hidden = !link.dataset.workspaces.split(' ').includes(key);
    }
    if (focusWasHidden) title.focus({ preventScroll: true });
  }
  function restoreLocation() {
    const key = workspaceFromHash(location.hash);
    closeTools();
    select(key);
    if (['#experiment', '#inspect'].includes(location.hash)) {
      const scroll = () => requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scroll, { once: true });
      else scroll();
    } else if (key === 'mechanics' || key === 'replay') {
      const scroll = () => requestAnimationFrame(() => document.getElementById(key === 'mechanics' ? 'swap-sandbox' : 'historical-case').scrollIntoView({ block: 'start', behavior: 'instant' }));
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
      if (toolMenu.contains(link)) closeTools();
      if (['#experiment', '#inspect'].includes(url.hash)) {
        // Commit primary routes before changing layout or moving focus. Touch
        // navigation must not depend on the browser's later anchor default action.
        event.preventDefault();
        if (url.hash !== location.hash) location.hash = url.hash;
        restoreLocation();
      } else select(workspaceFromHash(url.hash));
    }
  });
  restoreLocation();
  return { select, restoreLocation };
}
