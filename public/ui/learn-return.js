import { readLearnReturn, saveLearnReturn, clearLearnReturn } from '../data/learn-return-drafts.js';

// A temporary per-tab handoff, captured only when leaving for Learn.
export function initLearnReturn({ fullRangeLab, rangeLab, navigation }) {
  const labs = { 'cp50-v1': fullRangeLab, 'cl-range-v1': rangeLab };
  const stored = readLearnReturn();
  if (stored.draft && !new URLSearchParams(location.hash.slice(1)).has('scenario')) {
    for (const draft of stored.draft.drafts) labs[draft.model].restoreExperimentDraft(draft);
    navigation.selectLab(stored.draft.activeModel === 'cl-range-v1' ? 'range' : 'full', { updateURL: false, scroll: false, reveal: false });
    clearLearnReturn();
  }
  window.addEventListener('pageshow', event => {
    if (event.persisted && readLearnReturn().status === 'ready') clearLearnReturn();
  });
  document.addEventListener('click', event => {
    const link = event.target.closest('a');
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target === '_blank') return;
    const url = new URL(link.href), learn = new URL('learn.html', location.href);
    if (url.origin !== learn.origin || url.pathname !== learn.pathname) return;
    const drafts = Object.values(labs).map(lab => lab.getExperimentDraft()).filter(Boolean);
    if (drafts.length) {
      const selected = navigation.getSelectedLab() === 'range' ? 'cl-range-v1' : 'cp50-v1';
      const activeModel = drafts.some(draft => draft.model === selected) ? selected : drafts[0].model;
      saveLearnReturn({ version: 1, activeModel, drafts });
    }
  });
}
