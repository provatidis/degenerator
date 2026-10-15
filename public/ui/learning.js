import { stageForLesson } from '../learning/example-path.js';
import { DEEPER_READING } from '../learning/deeper-reading.js?v=1.15.1';
import { lessonWalkthrough } from '../lib/lesson-walkthrough.js?v=1.15.1';
import { LESSONS } from '../learning/liquidity-essentials.js?v=1.15.1';
import { LESSON_IDS, VARIANTS, lessonSetup, runLesson, checkLesson } from '../models/lesson-experiments.js?v=1.15.1';
import { checkLessonUnderstanding } from '../models/lesson-application.js?v=1.15.1';
import { lessonApplicationCopy } from '../lib/lesson-application-copy.js?v=1.15.1';
import { newChoiceSeed, validChoiceSeed } from '../lib/learning-choices.js?v=1.15.1';
import { learningChoices, learningMetric, learningPitfall } from '../lib/learning-elements.js?v=1.15.1';
import { POOL_PITFALLS } from '../learning/pool-pitfalls.js?v=1.15.1';
import { managementLessonFromHash } from '../lib/management-links.js?v=1.15.1';
import { readProgress, saveProgress } from '../data/learning-progress.js?v=1.15.1';
import { fmt, usd, signedUSD, percent } from '../lib/format.js';
import { scenarioHash } from '../lib/scenario-links.js';
import { rangeHash } from '../lib/range-links.js';
import { resultCardBlob } from '../lib/result-card.js?v=1.15.1';
import { appliedLessonFromHash } from '../lib/applied-lessons.js';
import { tokenBalanceNarration, benchmarkNarration, lessonReasonFeedback } from '../lib/lesson-narration.js?v=1.15.1';

export function initLearning() {
  const $ = id => document.getElementById(id);
  const restored = readProgress();
  const progress = restored.progress;
  let available = restored.available;
  let lesson, draft, outcome = null, applicationCopy = null, cardURL = null, generation = 0;
  const courseDetails = $('learn-course');
  courseDetails.open = !matchMedia('(max-width: 750px)').matches;
  function persist() {
    const started = draft.prediction || draft.ran || draft.answer || draft.variant > 0 || progress.completed.includes(lesson.id);
    const index = LESSON_IDS.indexOf(lesson.id);
    $('learn-resume').textContent = started ? 'Continue: ' + lesson.short + ' ↓' : index === 6 ? 'Open the final challenge ↓' : 'Start lesson ' + (index + 1) + ' ↓';
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
    $('learn-course-status').textContent = count === 7 ? 'All essentials exercises checked. Continue with range choices or revisit an experiment.' : 'Six lessons and a final challenge. Open any topic.';
    for (const link of document.querySelectorAll('[data-lesson-id]')) {
      const id = link.dataset.lessonId;
      const active = !managementLessonFromHash(location.hash) && !appliedLessonFromHash(location.hash) && id === lesson?.id;
      link.setAttribute('aria-current', active ? 'step' : 'false');
      link.querySelector('.learn-step-state').textContent = progress.completed.includes(id) ? 'Checked' : active ? 'Now exploring' : 'Open lesson';
      link.classList.toggle('learn-step-done', progress.completed.includes(id));
    }
    if (lesson && !managementLessonFromHash(location.hash) && !appliedLessonFromHash(location.hash) && !matchMedia('(max-width: 750px)').matches) {
      const sidebar = document.querySelector('.learn-sidebar');
      const selected = document.querySelector('[data-lesson-id="' + lesson.id + '"]');
      const bounds = selected.getBoundingClientRect(), visible = sidebar.getBoundingClientRect();
      if (bounds.bottom > visible.bottom) sidebar.scrollTop += bounds.bottom - visible.bottom + 24;
      else if (bounds.top < visible.top) sidebar.scrollTop += bounds.top - visible.top - 24;
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
    learningChoices($(container),{name,values,selected,seed:draft.choiceSeed,group:lesson.id+name,shuffle:name!=='learn-prediction',onChange:value=>{
      if(name==='learn-prediction') {draft.prediction=value;$('learn-run').disabled=false;if(draft.ran)invalidate();}
      else {draft[name==='learn-application'?'application':'reason']=value;$('learn-feedback').hidden=true;$('learn-continue').hidden=true;$('learn-share').hidden=true;clearCard();}
      persist();
    }});
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
    line.append(name, ' ', display); wrap.append(line, input); return wrap;
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
        for (const [value, label] of [[0.05, 'Tight · ±5%'], [0.1, 'Moderate · ±10%'], [0.5, 'Wide · ±50%']]) {
          const option = document.createElement('option'); option.value = value; option.textContent = label; option.selected = value === s.width; select.append(option);
        }
        select.addEventListener('change', () => { draft.inputs.width = Number(select.value); invalidate(); persist(); updateSetup(); });
        field.append(' ', select); controls.push(field);
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
    const model = lesson.protocol + (lesson.id === 'range-boundaries' ? ' · Price range' : ['swap-impact', 'pool-share'].includes(lesson.id) ? ' · Virtual pool' : ' · Full-range 50/50');
    $('learn-model').textContent = model + ' · Illustrative inputs · USDC = $1';
  }
  function invalidate() {
    draft.ran = false; draft.answer = ''; draft.reason = ''; draft.application = ''; outcome = null; applicationCopy = null;
    $('learn-calculation-feedback').textContent = ''; $('learn-answer').setAttribute('aria-invalid', 'false');
    $('learn-results').hidden = true; $('learn-assessment').hidden = true; $('learn-feedback').hidden = true; $('learn-share').hidden = true; $('learn-continue').hidden = true;
    $('learn-answer').value = ''; choices('learn-reasons', 'learn-reason', lesson.reasons, '');
    $('learn-input-status').textContent = 'Setup changed. Predict, then run the updated experiment.';
    $('learn-run').textContent = 'Run experiment →'; clearCard();
  }
  const metric=learningMetric;
  function bar(label, percentValue, detail) {
    const row = document.createElement('div'); row.className = 'learn-bar-row';
    const heading = document.createElement('div'); heading.className = 'learn-bar-label';
    const title = document.createElement('span'); title.textContent = label;
    const amount = document.createElement('span'); amount.textContent = detail;
    heading.append(title, ' ', amount);
    const rail = document.createElement('div'); rail.className = 'learn-bar'; rail.setAttribute('aria-hidden', 'true');
    const fill = document.createElement('span'); fill.style.width = Math.max(0, Math.min(100, percentValue)) + '%'; rail.append(fill);
    row.append(heading, rail); return row;
  }
  function renderDeeper() {
    const reading = DEEPER_READING[lesson.id];
    $('learn-fee-case').hidden = !['fee-break-even', 'range-boundaries', 'final-challenge'].includes(lesson.id);
    $('learn-deeper-title').textContent = reading.title;
    $('learn-deeper-body').replaceChildren(...reading.paragraphs.map(text => {
      const paragraph = document.createElement('p'); paragraph.textContent = text; return paragraph;
    }));
    $('learn-worked-steps').replaceChildren(...lessonWalkthrough(lesson.id, outcome).map(([title, text]) => {
      const step = document.createElement('li');
      const heading = document.createElement('strong'); heading.textContent = title;
      const paragraph = document.createElement('p'); paragraph.textContent = text;
      step.append(heading, '\n', paragraph); return step;
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
      item.append(link, '\n', description); return item;
    }));
  }
  function renderResults() {
    outcome = runLesson(lesson.id, draft.inputs, draft.variant);
    applicationCopy = lessonApplicationCopy(lesson.id, outcome);
    const s = outcome.setup, r = outcome.result, metrics = [], visual = [];
    if (lesson.id === 'swap-impact') {
      metrics.push(metric('USDC received', fmt(outcome.out, 2), 'After the 0.3% swap fee'), metric('Price impact', fmt(outcome.impact, 2) + '%', 'Excludes the fee itself'), metric('Average execution', usd(outcome.out / s.amount), 'USDC per ETH, including fee'));
      const max = outcome.impact;
      const small = 0.997 / (s.reserveEth + 0.997) * 100;
      visual.push(bar('A 1 ETH swap', small / Math.max(max, small) * 100, fmt(small, 2) + '% impact'), bar('Your ' + s.amount + ' ETH swap', max / Math.max(max, small) * 100, fmt(max, 2) + '% impact'));
    } else if (lesson.id === 'pool-share') {
      metrics.push(metric('Your pool ownership', fmt(outcome.share, 2) + '%', 'Your claim on both reserves'), metric('Your matching deposit', fmt(s.depositEth, 0) + ' ETH', '+ ' + fmt(outcome.usdcDeposit, 0) + ' USDC'), metric('Enlarged ETH reserve', fmt(s.reserveEth + s.depositEth, 0) + ' ETH', 'Includes your deposit'));
      visual.push(bar('Your share of the enlarged pool', outcome.share, fmt(outcome.share, 2) + '%'));
    } else if (lesson.id === 'range-boundaries') {
      metrics.push(metric('Final ETH', fmt(r.pooled.eth, 6) + ' ETH', 'Position principal, excluding fees'), metric('Final USDC', fmt(r.pooled.usdc, 2), 'USDC = $1'), metric('ETH share of value', fmt(r.finalEthPercent, 2) + '%', r.state.replace('-', ' ')));
      visual.push(bar('ETH portion of principal', r.finalEthPercent, fmt(r.finalEthPercent, 2) + '%'), bar('USDC portion of principal', 100 - r.finalEthPercent, fmt(100 - r.finalEthPercent, 2) + '%'));
    } else if (lesson.id === 'token-balances') {
      metrics.push(metric('Starting ETH', fmt(r.held.eth, 6) + ' ETH', 'Holding keeps this amount'), metric('Final LP ETH', fmt(r.pooled.eth, 6) + ' ETH', 'After ideal arbitrage'), metric('Final LP USDC', fmt(r.pooled.usdc, 2), 'Starting USDC: ' + fmt(r.held.usdc, 2)));
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
    $('learn-prediction-feedback').textContent = draft.prediction === outcome.prediction ? 'Your prediction matches the result.' : 'The result differs from your prediction: ' + predicted + '. Compare it with your prediction.';
    const tokenCopy = lesson.id === 'token-balances' ? tokenBalanceNarration(outcome) : null;
    $('learn-explanation').textContent = tokenCopy?.explanation || benchmarkNarration(lesson.id, outcome) || lesson.explanation;
    $('learn-reason-question').textContent = tokenCopy?.reasoning || lesson.reasoning;
    const reasons = lesson.reasons.map(([id, copy]) => [id, tokenCopy && id === 'rebalance' ? tokenCopy.correctReason : copy]);
    choices('learn-reasons', 'learn-reason', reasons, draft.reason);
    $('learn-application-context').textContent = applicationCopy.context;
    $('learn-application-question').textContent = applicationCopy.question;
    if (!applicationCopy.choices.some(([id]) => id === draft.application)) draft.application = '';
    choices('learn-applications', 'learn-application', applicationCopy.choices, draft.application);
    $('learn-hint-text').textContent = lesson.takeaway + ' ' + applicationCopy.hint;
    learningPitfall($('learn-pitfall'),POOL_PITFALLS[lesson.id]);
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
    const applied = appliedLessonFromHash(location.hash) || managementLessonFromHash(location.hash);
    $('learn-essential').hidden = Boolean(applied);
    if (applied) { $('learn-route-note').hidden = true; updateProgress(); return false; }
    $('learn-page-title').textContent = 'Liquidity essentials';
    $('learn-page-subtitle').textContent = 'Explore Uniswap v2-style full-range pools and Uniswap v3-style price ranges with interactive examples.';
    const params = new URLSearchParams(location.hash.slice(1));
    const requested = params.get('lesson');
    const valid = LESSON_IDS.includes(requested) && params.getAll('lesson').length === 1 && [...params.keys()].every(key => key === 'lesson');
    const id = valid ? requested : progress.lastLesson;
    $('learn-route-note').hidden = !location.hash || valid;
    lesson = LESSONS.find(item => item.id === id);
    const index = LESSON_IDS.indexOf(id);
    draft = progress.drafts[id] || { variant: 0, inputs: lessonSetup(id), prediction: '', answer: '', reason: '', application: '', choiceSeed: newChoiceSeed(), ran: false };
    if (!validChoiceSeed(draft.choiceSeed)) draft.choiceSeed = newChoiceSeed();
    draft.application ||= '';
    if (!lesson.predictions.some(([value]) => value === draft.prediction)) draft.prediction = '';
    if (!lesson.reasons.some(([value]) => value === draft.reason)) draft.reason = '';
    if (!draft.prediction) draft.ran = false;
    $('learn-level').textContent = lesson.protocol + ' · Stage ' + stageForLesson(lesson.id).level + ' · ' + stageForLesson(lesson.id).title;
    $('learn-lesson-title').textContent = lesson.title; document.title = lesson.short + ' · Passiko Learn';
    $('learn-lesson-number').textContent = index === 6 ? 'FINAL CHALLENGE' : 'LESSON ' + (index + 1) + ' OF 6';
    $('learn-concept').textContent = lesson.concept; $('learn-skill').textContent = lesson.skill;
    $('learn-intro').textContent = lesson.intro; $('learn-prediction-question').textContent = lesson.prediction;
    $('learn-question').textContent = lesson.question; $('learn-reason-question').textContent = lesson.reasoning;
    $('learn-calculation-hint').textContent = lesson.hint; $('learn-hint').open = false;
    $('learn-deeper').open = false; $('learn-math').open = false; $('learn-calculation').open = false;
    $('learn-calculation-feedback').textContent = '';
    $('learn-takeaway').textContent = lesson.takeaway;
    $('learn-results').hidden = true; $('learn-assessment').hidden = true; $('learn-feedback').hidden = true; $('learn-share').hidden = true; $('learn-continue').hidden = true;
    $('learn-input-status').textContent = ''; $('learn-run').disabled = !draft.prediction; $('learn-run').textContent = 'Run experiment →';
    choices('learn-predictions', 'learn-prediction', lesson.predictions, draft.prediction);
    choices('learn-reasons', 'learn-reason', lesson.reasons, draft.reason);
    renderControls(); updateSetup(); updateProgress();
    if (draft.ran) { renderResults(); if (checkLessonUnderstanding(id, draft.inputs, draft.variant, draft.reason, draft.application).passed) showCheck(false); }
    persist();
    return true;
  }
  function showCheck(save = true) {
    const check = checkLessonUnderstanding(lesson.id, draft.inputs, draft.variant, draft.reason, draft.application);
    $('learn-feedback').hidden = false; $('learn-feedback').className = 'learn-feedback ' + (check.passed ? 'learn-pass' : 'learn-retry');
    $('learn-feedback-title').textContent = check.passed ? 'Both answers are correct.' : 'Review your answers.';
    const reasoningFeedback = lessonReasonFeedback(lesson.id, outcome, draft.reason);
    const applicationFeedback = draft.application ? applicationCopy.feedback : 'Choose an answer for the changed setup. ' + applicationCopy.hint;
    $('learn-feedback-copy').textContent = check.passed ? lesson.takeaway
      : !check.reasoning && !check.application ? reasoningFeedback + ' ' + applicationFeedback
      : !check.reasoning ? 'Your application matches the changed setup. ' + reasoningFeedback
      : 'Your explanation fits the original setup. ' + applicationFeedback;
    $('learn-continue').hidden = !check.passed;
    $('learn-share').hidden = !(check.passed && lesson.id === 'final-challenge');
    if (check.passed) {
      if (!progress.completed.includes(lesson.id)) progress.completed.push(lesson.id);
      const index = LESSON_IDS.indexOf(lesson.id);
      $('learn-next').href = index < 6 ? '#lesson=' + LESSON_IDS[index + 1] : '#manage=range-width';
      $('learn-next').textContent = index < 6 ? 'Next: ' + LESSONS[index + 1].short + ' →' : 'Next: Choosing and managing a range →';
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
    $('learn-calculation-feedback').textContent = ''; persist();
  });
  $('learn-calculation-check').addEventListener('click', () => {
    if (!outcome) return;
    const numeric = checkLesson(lesson.id, draft.inputs, draft.variant, draft.answer, outcome.reason).numeric;
    $('learn-answer').setAttribute('aria-invalid', String(!numeric));
    $('learn-calculation-feedback').textContent = numeric ? 'Calculation matches. Lesson completion is unchanged.' : 'Revisit the displayed number, units and requested rounding. This optional practice does not affect completion.';
  });
  $('learn-assessment-form').addEventListener('submit', event => { event.preventDefault(); if (!draft.ran) return; draft.reason = selection('learn-reason'); draft.application = selection('learn-application'); showCheck(); });
  function changeVariation() {
    const variant = (draft.variant + 1) % VARIANTS;
    draft = { variant, inputs: lessonSetup(lesson.id, variant), prediction: '', answer: '', reason: '', application: '', choiceSeed: newChoiceSeed(), ran: false };
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
    if (lesson.id !== 'final-challenge' || !outcome || !checkLessonUnderstanding(lesson.id, draft.inputs, draft.variant, draft.reason, draft.application).passed) return;
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
  let lastLevel = 0, groupList;
  LESSONS.forEach((item, i) => {
    const stage = stageForLesson(item.id);
    if (stage.level !== lastLevel) {
      const group = document.createElement('li'); group.className = 'learn-path-group';
      const heading = document.createElement('h2'); heading.textContent = stage.level + ' · ' + stage.title;
      groupList = document.createElement('ol'); group.append(heading, groupList);
      overview.append(group); lastLevel = stage.level;
    }
    const li = document.createElement('li'); const link = document.createElement('a'); link.href = '#lesson=' + item.id; link.dataset.lessonId = item.id;
    const number = document.createElement('span'); number.className = 'learn-step-number'; number.textContent = i === 6 ? '★' : String(i + 1).padStart(2, '0');
    const copy = document.createElement('span'); copy.className = 'learn-step-copy';
    const title = document.createElement('strong'); title.textContent = item.short;
    const state = document.createElement('span'); state.className = 'learn-step-state';
    copy.append(title, ' ', state); link.append(number, ' ', copy); li.append(link); groupList.append(li);
    link.addEventListener('click', () => { if (matchMedia('(max-width: 750px)').matches) courseDetails.open = false; });
  });
  $('learn-topics').addEventListener('click', () => { courseDetails.open = true; const summary = courseDetails.querySelector('summary'); summary.focus({ preventScroll: true }); courseDetails.scrollIntoView({ block: 'start', behavior: 'instant' }); });
  $('learn-resume').addEventListener('click', () => { if (appliedLessonFromHash(location.hash) || managementLessonFromHash(location.hash)) return; $('learn-lesson-title').focus({ preventScroll: true }); $('learn-lesson-title').scrollIntoView({ block: 'start', behavior: 'instant' }); });
  window.addEventListener('hashchange', () => { if (!loadLesson()) return; $('learn-lesson-title').focus({ preventScroll: true }); $('learn-lesson-title').scrollIntoView({ block: 'start', behavior: 'instant' }); });
  window.addEventListener('pagehide', () => { if (cardURL) URL.revokeObjectURL(cardURL); });
  loadLesson();
}
