// Shared keyboard behavior; callers own URLs and any feature-specific side effects.
export function bindTablist({ tabs, onSelect = () => {}, activeClass = null }) {
  function select(key) {
    if (!tabs.some(tab => tab.key === key)) throw new Error('Choose a supported tab.');
    for (const tab of tabs) {
      const selected = tab.key === key;
      tab.button.setAttribute('aria-selected', String(selected));
      tab.button.tabIndex = selected ? 0 : -1;
      tab.panel.hidden = !selected;
      if (activeClass) tab.button.classList.toggle(activeClass, selected);
    }
  }
  for (const [index, tab] of tabs.entries()) {
    tab.button.addEventListener('click', () => { select(tab.key); onSelect(tab.key); });
    tab.button.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
        : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      select(tabs[next].key);
      onSelect(tabs[next].key);
      tabs[next].button.focus();
    });
  }
  return { select };
}
