import { DEEPER_READING } from '../learning/deeper-reading.js';
import { lessonWalkthrough } from '../lib/lesson-walkthrough.js';
import { LESSONS } from '../learning/liquidity-essentials.js';
import { LESSON_IDS, VARIANTS, lessonSetup, runLesson, checkLesson } from '../models/lesson-experiments.js';
import { readProgress, saveProgress } from '../data/learning-progress.js';
import { fmt, usd, signedUSD, percent } from '../lib/format.js';
import { scenarioHash } from '../lib/scenario-links.js';
import { rangeHash } from '../lib/range-links.js';
import { resultCardBlob } from '../lib/result-card.js';

export function initLearning() {
  const $ = id => document.getElementById(id);
  const restored = readProgress();
  const progress = restored.progress;
  let available = restored.available;
  let lesson, draft, outcome = null, cardURL = null, generation = 0;
  const courseDetails = $('learn-course');
  courseDetails.open = !matchMedia('(max-width: 750px)').matches;
  function persist() {
    progress.lastLesson = lesson.id;
    progress.drafts[lesson.id] = draft;
    available = saveProgress(progress);
    $('learn-storage').textContent = available ? 'Progress saved in this browser.' : 'Saving is unavailable. You can keep learning in this tab.';
  }
  function updateProgress() {
    const count = progress.completed.length;
    $('learn-progress-count').textContent = count + ' of 7 checked';
    $('learn-progress').value = count;
    $('learn-progress').setAttribute('aria-label', count + ' of 7 exercises checked');
    $('learn-course-status').textContent = count === 7 ? 'Chapter complete. Try a fresh variation or keep exploring.' : 'Six lessons and a final challenge. Open any topic.';
    for (const link of document.querySelectorAll('[data-lesson-id]')) {
      const id = link.dataset.lessonId;
      link.setAttribute('aria-current', id === lesson.id ? 'step' : 'false');
      link.querySelector('.learn-step-state').textContent = progress.completed.includes(id) ? 'Checked' : id === lesson.id ? 'Now exploring' : 'Open lesson';
      link.classList.toggle('learn-step-done', progress.completed.includes(id));
    }
  }
  function clearCard() {
    generation++;
    if (cardURL) { URL.revokeObjectURL(cardURL); cardURL = null; }
    $('learn-card-preview').hidden = true;
    $('learn-card-status').textContent = '';
  }
  function selection(name) { return document.querySelector('input[name="' + name + '"]:checked')?.value || ''; }
  function choices(container, name, values, selected) {
    const nodes = values.map(([value, label]) => {
      const item = document.createElement('label'); item.className = 'learn-choice';
      const radio = document.createElement('input'); radio.type = 'radio'; radio.name = name; radio.value = value; radio.checked = value === selected;
      const copy = document.createElement('span'); copy.textContent = label; item.append(radio, copy);
      radio.addEventListener('change', () => {
        if (name === 'learn-prediction') {
          draft.prediction = value;
          $('learn-run').disabled = false;
          if (draft.ran) invalidate();
        } else {
          draft.reason = value; $('learn-feedback').hidden = true; $('learn-continue').hidden = true;
          $('learn-share').hidden = true; clearCard();
        }
        persist();
      });
      return item;
    });
    $(container).replaceChildren(...nodes);
  }
  function control(key, label, min, max, step, formatter) {
    const wrap = document.createElement('div'); wrap.className = 'learn-control';
    const line = document.createElement('div'); line.className = 'learn-control-label';
    const name = document.createElement('label'); name.htmlFor = 'learn-input-' + key; name.textContent = label;
    const display = document.createElement('output'); display.htmlFor = name.htmlFor; display.id = 'learn-output-' + key; display.textContent = formatter(draft.inputs[key]);
    const input = document.createElement('input'); input.id = name.htmlFor; input.type = 'range'; input.min = min; input.max = max; input.step = step; input.value = draft.inputs[key];
    input.setAttribute('aria-describedby', display.id);
    input.addEventListener('input', () => {
      draft.inputs[key] = Number(input.value); display.textContent = formatter(draft.inputs[key]);
      input.setAttribute('aria-valuetext', formatter(draft.inputs[key])); invalidate(); persist(); updateSetup();
    });
    input.setAttribute('aria-valuetext', display.textContent);
    line.append(name, display); wrap.append(line, input); return wrap;
  }
  function renderControls() {
    const s = draft.inputs, controls = [];
    if (lesson.id === 'swap-impact') controls.push(control('amount', 'ETH to swap', 1, s.reserveEth / 2, 1, value => fmt(value, 0) + ' ETH'));
    else if (lesson.id === 'pool-share') controls.push(control('depositEth', 'Matching ETH deposit', 1, s.reserveEth / 2, 1, value => fmt(value, 0) + ' ETH'));
    else {
      controls.push(control('futurePrice', 'Future ETH price', s.initialPrice / 2, s.initialPrice * 2, s.initialPrice / 100, usd));
      if (['fee-break-even', 'final-challenge'].includes(lesson.id)) controls.push(control('fees', 'Assumed total cash fees', 0, s.investment / 2, 1, usd));
      if (lesson.id === 'range-boundaries') {
        const field = document.createElement('label'); field.className = 'learn-width'; field.textContent = 'Range around starting price';
        const select = document.createElement('select'); select.id = 'learn-input-width';
        for (const [value, label] of [[0.05, 'Tight · ±5%'], [0.1, 'Balanced · ±10%'], [0.5, 'Wide · ±50%']]) {
          const option = document.createElement('option'); option.value = value; option.textContent = label; option.selected = value === s.width; select.append(option);
        }
        select.addEventListener('change', () => { draft.inputs.width = Number(select.value); invalidate(); persist(); updateSetup(); });
        field.append(select); controls.push(field);
      }
    }
    $('learn-controls').replaceChildren(...controls);
  }
  function updateSetup() {
    const s = draft.inputs;
    $('learn-setup').textContent = lesson.id === 'swap-impact' || lesson.id === 'pool-share'
      ? 'Starting pool: ' + fmt(s.reserveEth, 0) + ' ETH + ' + fmt(s.reserveEth * s.initialPrice, 0) + ' USDC · ' + usd(s.initialPrice) + '/ETH'
      : 'Starting budget: ' + usd(s.investment) + ' · ETH starts at ' + usd(s.initialPrice) + ' · USDC = $1';
    if (lesson.id === 'pool-share') $('learn-setup').textContent += ' · Matching USDC: ' + fmt(s.depositEth * s.initialPrice, 0);
    if (lesson.id === 'range-boundaries') $('learn-setup').textContent += ' · Range: ' + usd(s.initialPrice * (1 - s.width)) + '–' + usd(s.initialPrice * (1 + s.width));
    $('learn-variation-label').textContent = 'Variation ' + (draft.variant + 1) + ' of ' + VARIANTS;
    const model = lesson.id === 'range-boundaries' ? 'cl-range-v1' : ['swap-impact', 'pool-share'].includes(lesson.id) ? 'Virtual Uniswap v2 mechanics' : 'cp50-v1';
    $('learn-model').textContent = model + ' · Illustrative inputs · USDC = $1';
  }
  function invalidate() {
    draft.ran = false; draft.answer = ''; draft.reason = ''; outcome = null;
    $('learn-results').hidden = true; $('learn-assessment').hidden = true; $('learn-feedback').hidden = true; $('learn-share').hidden = true; $('learn-continue').hidden = true;
    $('learn-answer').value = ''; choices('learn-reasons', 'learn-reason', lesson.reasons, '');
    $('learn-input-status').textContent = 'Setup changed. Predict, then run the updated experiment.';
    $('learn-run').textContent = 'Run experiment →'; clearCard();
  }
  function metric(label, value, note = '') {
    const block = document.createElement('div'); block.className = 'learn-metric';
    const title = document.createElement('span'); title.className = 'label'; title.textContent = label;
    const amount = document.createElement('strong'); amount.textContent = value;
    const detail = document.createElement('span'); detail.className = 'learn-metric-note'; detail.textContent = note;
    block.append(title, amount, detail); return block;
  }
  function bar(label, percentValue, detail) {
    const row = document.createElement('div'); row.className = 'learn-bar-row';
    const heading = document.createElement('div'); heading.className = 'learn-bar-label';
    const title = document.createElement('span'); title.textContent = label;
    const amount = document.createElement('span'); amount.textContent = detail;
    heading.append(title, amount);
    const rail = document.createElement('div'); rail.className = 'learn-bar'; rail.setAttribute('aria-hidden', 'true');
    const fill = document.createElement('span'); fill.style.width = Math.max(0, Math.min(100, percentValue)) + '%'; rail.append(fill);
    row.append(heading, rail); return row;
  }
  function renderDeeper() {
    const reading = DEEPER_READING[lesson.id];
    $('learn-deeper-title').textContent = reading.title;
    $('learn-deeper-body').replaceChildren(...reading.paragraphs.map(text => {
      const paragraph = document.createElement('p'); paragraph.textContent = text; return paragraph;
    }));
    $('learn-worked-steps').replaceChildren(...lessonWalkthrough(lesson.id, outcome).map(([title, text]) => {
      const step = document.createElement('li');
      const heading = document.createElement('strong'); heading.textContent = title;
      const paragraph = document.createElement('p'); paragraph.textContent = text;
      step.append(heading, paragraph); return step;
    }));
    $('learn-misconception-title').textContent = reading.misconception.title;
    $('learn-misconception-copy').textContent = reading.misconception.text;
    $('learn-math-intro').textContent = reading.math.introduction;
    $('learn-math-formula').textContent = reading.math.formula;
    $('learn-math-note').textContent = reading.math.note;
    $('learn-sources').replaceChildren(...reading.sources.map(source => {
      const item = document.createElement('li');
      const link = document.createElement('a'); link.href = source.url; link.target = '_blank'; link.rel = 'noopener noreferrer';
      link.textContent = source.title + ' ↗';
      const description = document.createElement('p'); description.textContent = source.detail;
      item.append(link, description); return item;
    }));
  }
  function renderResults() {
    outcome = runLesson(lesson.id, draft.inputs, draft.variant);
    const s = outcome.setup, r = outcome.result, metrics = [], visual = [];
    if (lesson.id === 'swap-impact') {
      metrics.push(metric('USDC received', fmt(outcome.out, 2), 'After the 0.3% swap fee'), metric('Price impact', fmt(outcome.impact, 2) + '%', 'Before the explicit swap fee'), metric('Average execution', usd(outcome.out / s.amount), 'USDC per ETH, including fee'));
      const max = outcome.impact;
      const small = 0.997 / (s.reserveEth + 0.997) * 100;
      visual.push(bar('A 1 ETH swap', small / Math.max(max, small) * 100, fmt(small, 2) + '% impact'), bar('Your ' + s.amount + ' ETH swap', max / Math.max(max, small) * 100, fmt(max, 2) + '% impact'));
    } else if (lesson.id === 'pool-share') {
      metrics.push(metric('Your pool ownership', fmt(outcome.share, 2) + '%', 'Your claim on both reserves'), metric('Your matching deposit', fmt(s.depositEth, 0) + ' ETH', '+ ' + fmt(outcome.usdcDeposit, 0) + ' USDC'), metric('Enlarged ETH reserve', fmt(s.reserveEth + s.depositEth, 0) + ' ETH', 'The deposit is in the denominator'));
      visual.push(bar('Your share of the enlarged pool', outcome.share, fmt(outcome.share, 2) + '%'));
    } else if (lesson.id === 'range-boundaries') {
      metrics.push(metric('Final ETH', fmt(r.pooled.eth, 6) + ' ETH', 'Active principal only'), metric('Final USDC', fmt(r.pooled.usdc, 2), 'USDC = $1'), metric('ETH share of value', fmt(r.finalEthPercent, 2) + '%', r.state.replace('-', ' ')));
      visual.push(bar('ETH portion of principal', r.finalEthPercent, fmt(r.finalEthPercent, 2) + '%'), bar('USDC portion of principal', 100 - r.finalEthPercent, fmt(100 - r.finalEthPercent, 2) + '%'));
    } else if (lesson.id === 'token-balances') {
      metrics.push(metric('Starting ETH', fmt(r.held.eth, 6) + ' ETH', 'Holding keeps this amount'), metric('Final LP ETH', fmt(r.pooled.eth, 6) + ' ETH', 'After ideal arbitrage'), metric('Final LP USDC', fmt(r.pooled.usdc, 2), 'No assumed fee income'));
      const max = Math.max(r.held.eth, r.pooled.eth);
      visual.push(bar('Starting ETH', r.held.eth / max * 100, fmt(r.held.eth, 6)), bar('Final LP ETH', r.pooled.eth / max * 100, fmt(r.pooled.eth, 6)));
    } else {
      metrics.push(metric('Holding starting tokens', usd(r.holdValue), fmt(r.held.eth, 4) + ' ETH + ' + fmt(r.held.usdc, 2) + ' USDC'),
        metric('LP ' + (s.fees ? '+ assumed fees' : 'before fees'), usd(r.lpValue), 'Dollar return: ' + percent(r.lpReturn)),
        metric('LP minus holding', signedUSD(r.difference), 'Before-fee IL: ' + percent(r.impermanentLoss)));
      const max = Math.max(r.holdValue, r.lpValue);
      visual.push(bar('Holding', r.holdValue / max * 100, usd(r.holdValue)), bar('LP before fees', r.lpBeforeFees / max * 100, usd(r.lpBeforeFees)));
      if (s.fees) visual.push(bar('LP + ' + usd(s.fees) + ' assumed fees', r.lpValue / max * 100, usd(r.lpValue)));
    }
    $('learn-metrics').replaceChildren(...metrics); $('learn-visual').replaceChildren(...visual);
    const predicted = lesson.predictions.find(([id]) => id === outcome.prediction)?.[1];
    $('learn-prediction-feedback').textContent = draft.prediction === outcome.prediction ? 'Your prediction matches the result.' : 'A useful surprise: ' + predicted + '. Compare it with your prediction.';
    $('learn-explanation').textContent = lesson.explanation;
    renderDeeper();
    $('learn-results').hidden = false; $('learn-assessment').hidden = false;
    $('learn-run').textContent = 'Run again →';
    $('learn-input-status').textContent = '';
    const home = new URL('./', location.href);
    if (lesson.id === 'range-boundaries') home.hash = rangeHash(r);
    else if (r) home.hash = scenarioHash(s);
    else home.hash = 'swap-sandbox';
    $('learn-explore').href = home.href;
    $('learn-explore').textContent = r ? 'Explore this setup in Playground ↗' : 'Open the swap sandbox ↗';
    $('learn-explore-note').textContent = r ? 'Opens a separate playground tab. Your current playground tab and virtual wallet are unchanged.' : 'Opens your independent swap sandbox in a new tab; its existing virtual balances are preserved.';
    if (r && lesson.id === 'final-challenge') $('learn-share-url').value = home.href;
    $('learn-answer').value = draft.answer;
    $('learn-answer').setAttribute('aria-invalid', 'false');
  }
  function loadLesson() {
    clearCard();
    const params = new URLSearchParams(location.hash.slice(1));
    const requested = params.get('lesson');
    const valid = LESSON_IDS.includes(requested) && params.getAll('lesson').length === 1 && [...params.keys()].every(key => key === 'lesson');
    const id = valid ? requested : progress.lastLesson;
    $('learn-route-note').hidden = !location.hash || valid;
    lesson = LESSONS.find(item => item.id === id);
    const index = LESSON_IDS.indexOf(id);
    draft = progress.drafts[id] || { variant: 0, inputs: lessonSetup(id), prediction: '', answer: '', reason: '', ran: false };
    if (!lesson.predictions.some(([value]) => value === draft.prediction)) draft.prediction = '';
    if (!lesson.reasons.some(([value]) => value === draft.reason)) draft.reason = '';
    if (!draft.prediction) draft.ran = false;
    $('learn-lesson-title').textContent = lesson.title; document.title = lesson.short + ' · Degenerator Learn';
    $('learn-lesson-number').textContent = index === 6 ? 'FINAL CHALLENGE' : 'LESSON ' + (index + 1) + ' OF 6';
    $('learn-concept').textContent = lesson.concept; $('learn-skill').textContent = lesson.skill;
    $('learn-intro').textContent = lesson.intro; $('learn-prediction-question').textContent = lesson.prediction;
    $('learn-question').textContent = lesson.question; $('learn-reason-question').textContent = lesson.reasoning;
    $('learn-hint-text').textContent = lesson.hint; $('learn-hint').open = false;
    $('learn-deeper').open = false; $('learn-math').open = false;
    $('learn-takeaway').textContent = lesson.takeaway;
    $('learn-results').hidden = true; $('learn-assessment').hidden = true; $('learn-feedback').hidden = true; $('learn-share').hidden = true; $('learn-continue').hidden = true;
    $('learn-input-status').textContent = ''; $('learn-run').disabled = !draft.prediction; $('learn-run').textContent = 'Run experiment →';
    choices('learn-predictions', 'learn-prediction', lesson.predictions, draft.prediction);
    choices('learn-reasons', 'learn-reason', lesson.reasons, draft.reason);
    renderControls(); updateSetup(); updateProgress();
    if (draft.ran) { renderResults(); if (checkLesson(id, draft.inputs, draft.variant, draft.answer, draft.reason).passed) showCheck(false); }
    persist();
  }
  function showCheck(save = true) {
    const check = checkLesson(lesson.id, draft.inputs, draft.variant, draft.answer, draft.reason);
    $('learn-feedback').hidden = false; $('learn-feedback').className = 'learn-feedback ' + (check.passed ? 'learn-pass' : 'learn-retry');
    $('learn-feedback-title').textContent = check.passed ? 'Checked. You can explain this.' : 'Keep exploring.';
    $('learn-feedback-copy').textContent = check.passed ? lesson.takeaway
      : !check.numeric && !check.reasoning ? 'Check the calculation and the reasoning. The hint explains what to compare.'
      : !check.numeric ? 'Your reasoning is sound. Revisit the number and its units; use the requested rounding.'
      : 'Your number matches. Revisit the explanation behind it; the hint can help.';
    $('learn-answer').setAttribute('aria-invalid', String(!check.numeric));
    $('learn-continue').hidden = !check.passed;
    $('learn-share').hidden = !(check.passed && lesson.id === 'final-challenge');
    if (check.passed) {
      if (!progress.completed.includes(lesson.id)) progress.completed.push(lesson.id);
      const index = LESSON_IDS.indexOf(lesson.id);
      $('learn-next').href = index < 6 ? '#lesson=' + LESSON_IDS[index + 1] : '#lesson=' + LESSON_IDS[0];
      $('learn-next').textContent = index < 6 ? 'Next: ' + LESSONS[index + 1].short + ' →' : 'Revisit the chapter →';
    }
    updateProgress(); if (save) persist();
  }
  $('learn-run').addEventListener('click', () => {
    draft.prediction = selection('learn-prediction'); if (!draft.prediction) return;
    draft.ran = true; renderResults(); persist();
    $('learn-results-title').focus({ preventScroll: true });
    $('learn-results').scrollIntoView({ block: 'start', behavior: 'instant' });
  });
  $('learn-answer').addEventListener('input', () => {
    draft.answer = $('learn-answer').value; $('learn-answer').setAttribute('aria-invalid', 'false');
    $('learn-feedback').hidden = true; $('learn-continue').hidden = true; $('learn-share').hidden = true; clearCard(); persist();
  });
  $('learn-assessment-form').addEventListener('submit', event => { event.preventDefault(); if (!draft.ran) return; draft.answer = $('learn-answer').value; draft.reason = selection('learn-reason'); showCheck(); });
  function changeVariation() {
    const variant = (draft.variant + 1) % VARIANTS;
    draft = { variant, inputs: lessonSetup(lesson.id, variant), prediction: '', answer: '', reason: '', ran: false };
    progress.drafts[lesson.id] = draft; loadLesson();
    $('learn-lesson-title').focus({ preventScroll: true }); $('learn-lesson-title').scrollIntoView({ block: 'start', behavior: 'instant' });
  }
  $('learn-variation').addEventListener('click', changeVariation);
  $('learn-fresh').addEventListener('click', changeVariation);
  $('learn-copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText($('learn-share-url').value); $('learn-card-status').textContent = 'Scenario link copied.'; }
    catch { $('learn-card-status').textContent = 'Select and copy the scenario link below.'; $('learn-share-url').focus(); $('learn-share-url').select(); }
  });
  $('learn-create-card').addEventListener('click', async () => {
    if (lesson.id !== 'final-challenge' || !outcome || !checkLesson(lesson.id, draft.inputs, draft.variant, draft.answer, draft.reason).passed) return;
    const token = generation; $('learn-card-status').textContent = 'Creating your result card…';
    try {
      const blob = await resultCardBlob(outcome.setup, new URL('./', location.href).href);
      if (generation !== token) return;
      if (cardURL) URL.revokeObjectURL(cardURL);
      cardURL = URL.createObjectURL(blob); $('learn-card-image').src = cardURL; $('learn-card-download').href = cardURL;
      $('learn-card-preview').hidden = false; $('learn-card-status').textContent = 'Card ready. The scenario link reproduces its assumptions.';
    } catch (error) { if (generation === token) $('learn-card-status').textContent = error.message; }
  });
  const overview = $('learn-lesson-list');
  LESSONS.forEach((item, i) => {
    const li = document.createElement('li'); const link = document.createElement('a'); link.href = '#lesson=' + item.id; link.dataset.lessonId = item.id;
    const number = document.createElement('span'); number.className = 'learn-step-number'; number.textContent = i === 6 ? '★' : String(i + 1).padStart(2, '0');
    const copy = document.createElement('span'); copy.className = 'learn-step-copy';
    const title = document.createElement('strong'); title.textContent = item.short;
    const state = document.createElement('span'); state.className = 'learn-step-state';
    copy.append(title, state); link.append(number, copy); li.append(link); overview.append(li);
    link.addEventListener('click', () => { if (matchMedia('(max-width: 750px)').matches) courseDetails.open = false; });
  });
  $('learn-topics').addEventListener('click', () => { courseDetails.open = true; const summary = courseDetails.querySelector('summary'); summary.focus({ preventScroll: true }); courseDetails.scrollIntoView({ block: 'start', behavior: 'instant' }); });
  $('learn-resume').addEventListener('click', () => { $('learn-lesson-title').focus({ preventScroll: true }); $('learn-lesson-title').scrollIntoView({ block: 'start', behavior: 'instant' }); });
  window.addEventListener('hashchange', () => { loadLesson(); $('learn-lesson-title').focus({ preventScroll: true }); $('learn-lesson-title').scrollIntoView({ block: 'start', behavior: 'instant' }); });
  window.addEventListener('pagehide', () => { if (cardURL) URL.revokeObjectURL(cardURL); });
  loadLesson();
}
