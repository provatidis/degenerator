import { EXAMPLE_STAGES, PLAYGROUND_EXAMPLES } from '../learning/example-path.js';

export function initExamples({ positionSnapshots, snapshotNavigation, restoreScenario }) {
  const library = document.getElementById('example-library');
  const start = document.getElementById('example-start');
  let starting = false;
  function startAtInputs() {
    starting = false;
    requestAnimationFrame(() => {
      const inputs = document.getElementById('scenario-controls');
      inputs.focus({ preventScroll: true });
      inputs.scrollIntoView({ block: 'start', behavior: 'instant' });
    });
  }
  start.href = PLAYGROUND_EXAMPLES[0].href;
  start.addEventListener('click', event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (location.hash === PLAYGROUND_EXAMPLES[0].href) { event.preventDefault(); restoreScenario(); startAtInputs(); }
    else starting = true;
  });
  const buttons = document.getElementById('example-levels');
  const cards = document.getElementById('example-cards');
  const note = document.getElementById('example-level-note');
  function selectLevel(level) {
    const stage = EXAMPLE_STAGES.find(item => item.level === level);
    for (const button of buttons.children) button.setAttribute('aria-pressed', String(Number(button.dataset.exampleLevel) === level));
    note.textContent = 'Stage ' + level + ' · ' + stage.title + '. ' + stage.detail;
    const nodes = PLAYGROUND_EXAMPLES.flatMap((example, index) => {
      if (example.level !== level) return [];
      const li = document.createElement('li');
      const link = document.createElement('a'); link.className = 'example-card'; link.href = example.href; link.dataset.exampleId = example.id;
      const step = document.createElement('span'); step.className = 'eyebrow'; step.textContent = 'EXAMPLE ' + String(index + 1).padStart(2, '0') + ' · ' + example.focus;
      const title = document.createElement('strong'); title.textContent = example.title;
      const detail = document.createElement('span'); detail.className = 'example-description'; detail.textContent = example.detail;
      const action = document.createElement('span'); action.className = 'example-action'; action.textContent = example.recorded ? 'Open recorded snapshot →' : 'Open this setup →';
      link.append(step, title, detail, action);
      // Reopening an unchanged URL must restore its setup after local input edits.
      link.addEventListener('click', event => {
        if (location.hash === example.href) {
          event.preventDefault();
          if (example.recorded) requestRecorded(example.recorded);
          else if (example.href.startsWith('#scenario=')) restoreScenario();
        }
      });
      li.append(link); return [li];
    });
    cards.replaceChildren(...nodes);
  }
  for (const stage of EXAMPLE_STAGES) {
    const button = document.createElement('button'); button.type = 'button'; button.dataset.exampleLevel = stage.level;
    button.textContent = stage.level + ' · ' + stage.title;
    button.setAttribute('aria-controls', 'example-cards'); button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => selectLevel(stage.level)); buttons.append(button);
  }
  // Serialize rapid recorded-example selections; the latest requested case is opened last.
  let pending = null, opening = false;
  async function requestRecorded(kind) {
    pending = kind;
    if (opening) return;
    opening = true;
    try {
      while (pending) {
        const next = pending; pending = null;
        snapshotNavigation.selectSource('position', { scroll: true });
        await positionSnapshots.loadRecordedExample(next);
      }
    } finally { opening = false; }
  }
  function restoreLocation() {
    const example = PLAYGROUND_EXAMPLES.find(item => item.href === location.hash);
    if (!example) return;
    selectLevel(example.level);
    library.open = true;
    if (example.recorded) requestRecorded(example.recorded);
    if (starting) startAtInputs();
  }
  selectLevel(1);
  window.addEventListener('hashchange', restoreLocation);
  restoreLocation();
}
