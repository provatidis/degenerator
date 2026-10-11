import { EXPERIMENTS_KEY, MAX_LIBRARY_BYTES, emptyLibrary, readLibrary, writeLibrary, libraryJSON, parseLibrary, createExperiment, addExperiment, editExperiment, removeExperiment, mergeLibraries } from '../data/saved-experiments.js';
import { experimentView, defaultExperimentName, comparisonContext, startingAssets } from '../lib/saved-experiments.js';
import { usd, signedUSD, percent } from '../lib/format.js';
import { STATE_COPY } from '../lib/range-presentation.js';
import { downloadBlob } from '../lib/download.js';

export function initSavedExperiments({ fullRangeLab, rangeLab }) {
  const $ = id => document.getElementById(id);
  const labs = { 'cp50-v1': fullRangeLab, 'cl-range-v1': rangeLab };
  let saved = readLibrary(), library = saved.library, temporary = saved.status === 'unavailable';
  let recovery = ['invalid','incompatible'].includes(saved.status), removed = null, editor = null, returnFocus = null;
  const selected = new Set();
  const element = (tag, className, text) => {
    const node = document.createElement(tag); if (className) node.className = className;
    if (text !== undefined) node.textContent = text; return node;
  };
  function status(text, error = false) { $('experiments-status').textContent = text; $('experiments-status').dataset.error = String(error); }
  function button(text, action, className = 'button secondary') {
    const node = element('button', className, text); node.type = 'button'; node.addEventListener('click', action); return node;
  }
  function pair(list, label, value, className = '') {
    const row = element('div', className); row.append(element('dt', '', label), '\n', element('dd', '', value)); list.append(row);
  }
  function sourceLine(entry) {
    if (!entry.origin) return element('p', 'experiment-source', 'Manual assumptions · ' + entry.model);
    const source = entry.origin.snapshot;
    const line = element('p', 'experiment-source', entry.origin.kind === 'position' ? 'Position #' + source.tokenId + ' · ' : 'Pool starting price · ');
    const link = element('a', '', 'Ethereum block ' + source.block.number + ' ↗');
    link.href = 'https://etherscan.io/block/' + source.block.number; link.target = '_blank'; link.rel = 'noopener noreferrer';
    line.append(link, '\n', element('span', '', 'Exact source retained in the experiment file. Not refreshed.')); return line;
  }
  function openLibrary() {
    $('saved-experiments').open = true;
    requestAnimationFrame(() => {
      $('saved-experiments').querySelector('summary').focus({ preventScroll: true });
      $('saved-experiments').scrollIntoView({ block: 'start', behavior: 'instant' });
    });
  }
  function openExperiment(entry) {
    const view = experimentView(entry);
    labs[entry.model].setExperiment(entry);
    history.replaceState(null, '', location.pathname + location.search + view.hash);
  }
  function commit(change) {
    if (recovery) throw new Error('Download or discard the unreadable saved copy before changing this library.');
    // Read the latest saved collection before each edit, so another tab’s additions survive.
    const fresh = temporary ? null : readLibrary();
    if (fresh && ['invalid','incompatible'].includes(fresh.status)) throw new Error('The saved library changed to an unreadable copy. Export this tab’s experiments before reloading.');
    const base = fresh && fresh.status !== 'unavailable' ? fresh.library : library;
    const next = change(base); libraryJSON(next);
    const persisted = writeLibrary(next); library = next; temporary = !persisted;
    render(); return persisted;
  }
  function beginEditor(mode, draft, trigger) {
    if (recovery) { openLibrary(); status('Download or discard the unreadable saved copy before saving experiments.', true); return; }
    editor = { mode, draft }; returnFocus = trigger;
    const view = experimentView(draft);
    $('experiment-dialog-title').textContent = mode === 'edit' ? 'Edit name and notes' : 'Save experiment';
    $('experiment-save-confirm').textContent = mode === 'edit' ? 'Save changes' : 'Save experiment';
    $('experiment-dialog-context').textContent = view.modelName + ' · ' + usd(view.result.investment) + ' · ETH ' + usd(view.result.initialPrice) + ' → ' + usd(view.result.futurePrice)
      + ' · ' + usd(view.result.fees) + ' assumed LP cash fees'
      + (draft.model === 'cl-range-v1' ? ' · Range ' + usd(view.result.lowerPrice) + ' – ' + usd(view.result.upperPrice) + ' · ' + usd(view.result.fullRangeFees) + ' assumed 50/50 reference fees' : '')
      + (mode === 'edit' ? '. The saved assumptions stay the same.' : '. This saves a new copy of the current assumptions.');
    $('experiment-name').value = mode === 'edit' ? draft.name : defaultExperimentName(draft);
    $('experiment-notes').value = mode === 'edit' ? draft.notes : '';
    $('experiment-dialog-error').textContent = '';
    $('experiment-dialog').showModal(); $('experiment-name').focus(); $('experiment-name').select();
  }
  function saveFromLab(model, trigger) {
    const draft = labs[model].getExperimentDraft();
    if (draft) beginEditor('new', draft, trigger);
  }
  $('scenario-save').addEventListener('click', event => saveFromLab('cp50-v1', event.currentTarget));
  $('cl-save').addEventListener('click', event => saveFromLab('cl-range-v1', event.currentTarget));
  $('experiment-save-form').addEventListener('submit', event => {
    event.preventDefault(); if (!editor) return;
    try {
      const { mode, draft } = editor, name = $('experiment-name').value, notes = $('experiment-notes').value;
      const entry = mode === 'new' ? createExperiment(draft, name, notes) : null;
      const persisted = commit(base => mode === 'new' ? addExperiment(base, entry) : editExperiment(base, draft, name, notes));
      const message = (mode === 'new' ? 'Saved “' : 'Updated “') + name.trim() + '”' + (persisted ? ' in this browser.' : ' for this tab only. Export the library to keep it.');
      status(message);
      if (mode === 'new') $(draft.model === 'cp50-v1' ? 'scenario-save-status' : 'cl-save-status').textContent = message;
      $('experiment-dialog').close();
    } catch (error) { $('experiment-dialog-error').textContent = error.message; }
  });
  $('experiment-save-cancel').addEventListener('click', () => $('experiment-dialog').close());
  $('experiment-dialog').addEventListener('close', () => {
    const previous = editor;
    editor = null;
    if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
    else if (previous?.mode === 'edit') $('experiments-list').querySelector('[data-experiment-id="' + previous.draft.id + '"] button')?.focus({ preventScroll: true });
    else $('saved-experiments').querySelector('summary').focus({ preventScroll: true });
  });
  function remove(entry) {
    try {
      const persisted = commit(base => removeExperiment(base, entry)); removed = entry;
      selected.delete(entry.id); render();
      status('Removed “' + entry.name + '”' + (persisted ? '. Undo is available until this tab reloads or another experiment is removed.' : ' for this tab only. The stored copy has not changed.'));
      $('experiments-undo').focus();
    } catch (error) { status(error.message, true); }
  }
  function renderSelection() {
    const count = selected.size;
    $('experiments-selection').textContent = count ? count + ' of 3 selected. Selection is kept while filtering.' : 'Select two or three experiments to compare.';
    $('experiments-compare').disabled = count < 2;
    $('experiments-clear-selection').hidden = count === 0;
    for (const input of $('experiments-list').querySelectorAll('[data-compare-id]')) input.disabled = count === 3 && !selected.has(input.dataset.compareId);
  }
  function renderList() {
    const query = $('experiments-search').value.trim().toLocaleLowerCase(), model = $('experiments-model').value;
    const matches = library.experiments.filter(entry => (model === 'all' || entry.model === model) && (entry.name + '\n' + entry.notes).toLocaleLowerCase().includes(query));
    $('experiments-no-match').hidden = !library.experiments.length || matches.length > 0;
    $('experiments-list').replaceChildren(...matches.map(entry => {
      const { result, modelName } = experimentView(entry);
      const item = element('li', 'experiment-entry'); item.dataset.experimentId = entry.id;
      const header = element('div', 'experiment-entry-header'); header.append(element('p', 'experiment-model', modelName));
      const label = element('label', 'experiment-compare-toggle');
      const checkbox = element('input'); checkbox.type = 'checkbox'; checkbox.dataset.compareId = entry.id; checkbox.checked = selected.has(entry.id);
      checkbox.setAttribute('aria-label', 'Compare ' + entry.name + ' · ' + modelName + ' · LP cash fees ' + usd(result.fees));
      checkbox.addEventListener('change', () => { if (checkbox.checked && selected.size < 3) selected.add(entry.id); else selected.delete(entry.id); $('experiments-comparison').hidden = true; renderSelection(); });
      label.append(checkbox, ' Compare'); header.append(label);
      item.append(header, element('h3', '', entry.name), element('p', 'experiment-assumptions', usd(result.investment) + ' · ETH ' + usd(result.initialPrice) + ' → ' + usd(result.futurePrice)));
      if (entry.model === 'cl-range-v1') item.append(element('p', 'experiment-assumptions', 'Range ' + usd(result.lowerPrice) + ' – ' + usd(result.upperPrice)));
      item.append(element('p', 'experiment-assumptions', 'Assumed LP cash fees: ' + usd(result.fees) + (entry.model === 'cl-range-v1' ? ' · 50/50 reference fees: ' + usd(result.fullRangeFees) : '')));
      const numbers = element('dl', 'experiment-entry-numbers');
      pair(numbers, 'LP + assumed fees', usd(result.lpValue)); pair(numbers, 'LP minus holding', signedUSD(result.difference), result.difference >= 0 ? 'gain' : 'loss'); item.append(numbers, sourceLine(entry));
      if (entry.notes) { const notes = element('details', 'experiment-notes'); notes.append(element('summary', '', 'Notes'), element('p', '', entry.notes)); item.append(notes); }
      item.append(element('p', 'experiment-saved-date', 'Saved ' + new Date(entry.updatedAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })));
      const actions = element('div', 'experiment-entry-actions');
      actions.append(button('Open in lab', () => openExperiment(entry)), button('Edit name / notes', event => beginEditor('edit', entry, event.currentTarget), 'text-button'), button('Remove', () => remove(entry), 'text-button'));
      item.append(actions); return item;
    }));
    renderSelection();
  }
  function renderComparison() {
    const entries = library.experiments.filter(entry => selected.has(entry.id));
    if (entries.length < 2) { $('experiments-comparison').hidden = true; return; }
    $('experiments-comparison-context').textContent = comparisonContext(entries);
    $('experiments-comparison-cards').replaceChildren(...entries.map(entry => {
      const { result, initial, modelName } = experimentView(entry), card = element('article', 'experiment-comparison-card');
      card.append(element('p', 'experiment-model', modelName), element('h4', '', entry.name));
      card.append(element('p', 'experiment-assumptions', usd(result.investment) + ' · ETH ' + usd(result.initialPrice) + ' → ' + usd(result.futurePrice)));
      if (entry.model === 'cl-range-v1') card.append(element('p', 'experiment-assumptions', 'Range ' + usd(result.lowerPrice) + ' – ' + usd(result.upperPrice)));
      card.append(element('p', 'experiment-assumptions', 'Assumed LP cash fees: ' + usd(result.fees)));
      const outcomes = element('dl', 'experiment-comparison-outcomes');
      pair(outcomes, 'LP + assumed cash fees', usd(result.lpValue)); pair(outcomes, 'Hold starting tokens', usd(result.holdValue));
      pair(outcomes, 'LP minus holding', signedUSD(result.difference), result.difference >= 0 ? 'gain' : 'loss'); card.append(outcomes);
      const inputs = element('dl', 'experiment-comparison-inputs');
      pair(inputs, 'Starting investment', usd(result.investment)); pair(inputs, 'Starting ETH price', usd(result.initialPrice)); pair(inputs, 'Future ETH price', usd(result.futurePrice));
      pair(inputs, 'Starting tokens', startingAssets(initial));
      if (entry.model === 'cl-range-v1') pair(inputs, 'Price range', usd(result.lowerPrice) + ' – ' + usd(result.upperPrice));
      pair(inputs, 'Assumed LP cash fees', usd(result.fees)); pair(inputs, 'LP before fees', usd(result.lpBeforeFees));
      pair(inputs, 'IL before fees vs. holding', percent(result.impermanentLoss)); pair(inputs, 'Total fees needed to match holding', usd(result.breakEvenFees));
      if (entry.model === 'cl-range-v1') {
        pair(inputs, 'Endpoint range status', STATE_COPY[result.state].title);
        pair(inputs, 'Separate 50/50 LP reference', usd(result.fullRange.lpValue));
        pair(inputs, 'Assumed 50/50 reference fees', usd(result.fullRangeFees));
      }
      const details = element('details', 'experiment-comparison-details');
      details.append(element('summary', '', 'Assumptions and notes'), inputs, sourceLine(entry));
      if (entry.notes) details.append(element('p', 'experiment-comparison-notes', entry.notes));
      card.append(details);
      card.append(button('Open in lab', () => openExperiment(entry))); return card;
    }));
  }
  function render() {
    const ids = new Set(library.experiments.map(entry => entry.id)); for (const id of selected) if (!ids.has(id)) selected.delete(id);
    $('experiments-count').textContent = recovery ? 'Saved copy needs attention' : library.experiments.length + (temporary ? ' in this tab' : ' saved');
    $('experiments-storage').textContent = temporary ? 'Browser saving is unavailable. Changes are kept for this tab only; export a backup before leaving.' : 'Stored in this browser. Export a backup to keep it elsewhere.';
    $('experiments-recovery').hidden = !recovery;
    $('experiments-recovery-copy').textContent = saved.status === 'incompatible' ? 'The saved library uses an unsupported version. Its original data has been kept; download it before discarding the saved copy.' : 'The saved library is unreadable. Its original data has been kept; download it before discarding the saved copy.';
    $('experiments-export').disabled = !library.experiments.length;
    $('experiments-file').disabled = recovery;
    $('experiments-empty').hidden = recovery || library.experiments.length > 0;
    $('experiments-controls').hidden = !library.experiments.length;
    $('experiments-comparison-controls').hidden = library.experiments.length < 2;
    $('experiments-undo-row').hidden = !removed;
    $('experiments-undo-copy').textContent = removed ? 'Removed “' + removed.name + '”.' : '';
    renderList(); if (!$('experiments-comparison').hidden) renderComparison();
  }
  $('experiments-search').addEventListener('input', renderList); $('experiments-model').addEventListener('change', renderList);
  $('experiments-compare').addEventListener('click', () => {
    renderComparison(); $('experiments-comparison').hidden = false; $('experiments-comparison').focus({ preventScroll: true });
    $('experiments-comparison').scrollIntoView({ block: 'start', behavior: 'instant' });
  });
  $('experiments-close-comparison').addEventListener('click', () => { $('experiments-comparison').hidden = true; $('experiments-compare').focus({ preventScroll: true }); });
  $('experiments-clear-selection').addEventListener('click', () => { selected.clear(); $('experiments-comparison').hidden = true; renderList(); });
  $('experiments-undo').addEventListener('click', () => {
    if (!removed) return;
    try { const name = removed.name, persisted = commit(base => addExperiment(base, removed)); removed = null; render(); status('Restored “' + name + '”' + (persisted ? '.' : ' for this tab only.')); }
    catch (error) { status(error.message, true); }
  });
  $('experiments-export').addEventListener('click', () => downloadBlob(new Blob([libraryJSON(library)], { type: 'application/json' }), 'degenerator-experiments-v1.json'));
  $('experiments-file').addEventListener('change', async () => {
    const file = $('experiments-file').files[0]; $('experiments-file').value = ''; if (!file) return;
    status('Reading experiment file…');
    try {
      if (file.size > MAX_LIBRARY_BYTES) throw new Error('Experiment libraries must be at most 512 KB.');
      const incoming = parseLibrary(await file.text()); let outcome;
      const persisted = commit(base => { outcome = mergeLibraries(base, incoming); return outcome.library; });
      status(outcome.added === 0 ? 'All imported experiments are already in this library.' : 'Imported ' + outcome.added + ' experiment' + (outcome.added === 1 ? '' : 's') + (outcome.copies ? '. Conflicting IDs were kept as separate copies' : '') + (persisted ? '.' : '. Kept for this tab only; export to keep them.'));
    } catch (error) { status(error.message + ' Your current experiments are unchanged.', true); }
  });
  $('experiments-export-recovery').addEventListener('click', () => downloadBlob(new Blob([saved.raw], { type: 'application/json' }), 'degenerator-experiments-recovery.json'));
  $('experiments-discard').addEventListener('click', () => {
    try { globalThis.localStorage.removeItem(EXPERIMENTS_KEY); saved = { library: emptyLibrary(), status: 'empty', raw: null }; library = saved.library; recovery = false; temporary = false; render(); status('Unreadable saved library discarded. Your snapshots, lessons and sandbox are unchanged.'); }
    catch { status('Browser storage is unavailable; the saved copy could not be discarded.', true); }
  });
  window.addEventListener('storage', event => {
    if (event.key !== EXPERIMENTS_KEY && event.key !== null) return;
    if (temporary) { status('The library changed in another tab. Export this tab’s experiments before reloading.', true); return; }
    saved = readLibrary(); library = saved.library; recovery = ['invalid','incompatible'].includes(saved.status); render();
    status('Saved experiments refreshed from another tab.');
  });
  for (const link of document.querySelectorAll('a[href="#saved-experiments"]')) link.addEventListener('click', openLibrary);
  window.addEventListener('hashchange', () => { if (location.hash === '#saved-experiments') openLibrary(); });
  render(); if (location.hash === '#saved-experiments') openLibrary();
}
