

export function initLabNavigation() {
  const labs = {
    full: { tab: document.getElementById('lab-full-tab'), panel: document.getElementById('lp-lab'), model: 'cp50-v1' },
    range: { tab: document.getElementById('lab-range-tab'), panel: document.getElementById('range-lab'), model: 'cl-range-v1' },
  };

  // Pool restoration and other deferred controllers can change the height above a lab.
  // Resolve the initial deep-link scroll after all page controllers have initialized.
  let pageReady = document.readyState === 'complete';
  let pendingScroll = null;
  document.addEventListener('DOMContentLoaded', () => {
    pageReady = true;
    if (pendingScroll) { requestAnimationFrame(pendingScroll); pendingScroll = null; }
  }, { once: true });

  function selectLab(mode, { updateURL = true, scroll = false, immediate = false } = {}) {
    if (!Object.hasOwn(labs, mode)) throw new Error('Choose a supported liquidity lab.');
    for (const [key, lab] of Object.entries(labs)) {
      lab.panel.hidden = key !== mode;
      lab.tab.setAttribute('aria-selected', String(key === mode));
      lab.tab.tabIndex = key === mode ? 0 : -1;
    }
    if (updateURL) {
      const model = new URLSearchParams(location.hash.replace(/^#/, '')).get('scenario');
      if (model !== labs[mode].model) history.replaceState(null, '', location.pathname + location.search + '#' + labs[mode].panel.id);
    }
    if (scroll) {
      const performScroll = () => labs[mode].panel.scrollIntoView({
        block: 'start', behavior: immediate || matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
      });
      if (pageReady) requestAnimationFrame(performScroll);
      else pendingScroll = performScroll;
    }
  }

  for (const [mode, lab] of Object.entries(labs)) {
    lab.tab.addEventListener('click', () => selectLab(mode, { scroll: true, immediate: true }));
    lab.tab.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 'full' : event.key === 'End' ? 'range' : mode === 'full' ? 'range' : 'full';
      selectLab(next, { scroll: true, immediate: true });
      labs[next].tab.focus();
    });
  }
  function fromLocation(initial = false) {
    const params = new URLSearchParams(location.hash.replace(/^#/, ''));
    if (params.has('scenario')) {
      selectLab(params.get('scenario') === labs.range.model ? 'range' : 'full', { updateURL: false, scroll: true, immediate: true });
    } else if (location.hash === '#range-lab' || location.hash === '#lp-lab') {
      selectLab(location.hash === '#range-lab' ? 'range' : 'full', { updateURL: false, scroll: true, immediate: true });
    } else if (initial) selectLab('full', { updateURL: false });
  }
  window.addEventListener('hashchange', () => fromLocation());

  return { selectLab, restoreLocation: () => fromLocation(true) };
}
