import { APPLIED_CHAPTER, APPLIED_LESSONS } from '../learning/applied-liquidity.js?v=1.15.0';
import { appliedLessonFromHash, appliedQuestion, checkAppliedAnswer, appliedReasonFeedback } from '../lib/applied-lessons.js?v=1.15.0';
import { appliedApplication, checkAppliedUnderstanding } from '../lib/applied-applications.js?v=1.15.0';
import { newChoiceSeed, validChoiceSeed } from '../lib/learning-choices.js?v=1.15.0';
import { learningChoices, learningMetric, learningPitfall } from '../lib/learning-elements.js?v=1.15.0';
import { POOL_PITFALLS } from '../learning/pool-pitfalls.js?v=1.15.0';
import { readAppliedProgress, saveAppliedProgress } from '../data/applied-progress.js?v=1.15.0';
import { createAppliedRecordLoader } from '../data/applied-records.js';
import { REPLAY_CASES } from '../data/replay-cases.js';
import { periodPointView, periodIntervalView, periodMilestones, periodChartRange, periodDuration } from '../lib/period-presentation.js';
import { positionScenario } from '../data/position-snapshot.js';
import { rangeHash } from '../lib/range-links.js';
import { fmt, usd, signedUSD } from '../lib/format.js';
import { formatUnits } from '../models/units.js';
import { feeUSD } from '../lib/position-fees.js';

export function initAppliedLearning() {
  const $ = id => document.getElementById(id);
  const { progress } = readAppliedProgress(), loadRecord = createAppliedRecordLoader();
  let lesson, draft, period = null, question = null, application = null, revision = 0;
  const utc = timestamp => new Date(timestamp * 1000).toISOString().replace('T', ' ').replace('.000Z', ' UTC');
  const states = { inside: 'In range · both tokens', above: 'Above range · all USDC', below: 'Below range · all WETH' };
  const tokens = (zero, one) => formatUnits(zero, 6) + ' USDC + ' + formatUnits(one, 18) + ' WETH';
  const fresh = () => ({ prediction: '', answer: '', reason: '', application: '', choiceSeed: newChoiceSeed(), revealed: false, checkpoint: null });
  function focusTitle(id) { $(id).focus({ preventScroll: true }); $(id).scrollIntoView({ block: 'start', behavior: 'instant' }); }
  function updateNavigation() {
    $('applied-progress-count').textContent = progress.completed.length + ' of 3 checked';
    for (const link of document.querySelectorAll('[data-applied-id]')) {
      const active = link.dataset.appliedId === appliedLessonFromHash(location.hash);
      const complete = progress.completed.includes(link.dataset.appliedId);
      link.setAttribute('aria-current', active ? 'step' : 'false');
      link.classList.toggle('learn-step-done', complete);
      link.querySelector('.learn-step-state').textContent = complete ? 'Checked' : active ? 'Now exploring' : 'Open exercise';
    }
  }
  function persist() {
    progress.drafts[lesson.id] = draft;
    const available = saveAppliedProgress(progress);
    $('learn-storage').textContent = available ? 'Progress saved in this browser.' : 'Saving is unavailable. You can keep learning in this tab.';
    $('learn-resume').textContent = (draft.prediction || draft.revealed ? 'Continue: ' : 'Start: ') + lesson.short + ' ↓';
    updateNavigation();
  }
  function clearFeedback() {
    $('applied-feedback').hidden = true; $('applied-continue').hidden = true; $('applied-reflection').hidden = true;
  }
  function choices(id, name, values, selected, onChange) {
    learningChoices($(id),{name,values,selected,seed:draft.choiceSeed,group:lesson.id+name,onChange,shuffle:name!=='applied-prediction'});
  }
  const metric=learningMetric;
  function evidence(entries) {
    $('applied-evidence').replaceChildren(...entries.flatMap(([name, value]) => {
      const dt = document.createElement('dt'), dd = document.createElement('dd');
      dt.textContent = name; dd.textContent = value; return [dt, dd];
    }));
  }
  function drawChart(index) {
    const chart = $('applied-chart'), domain = periodChartRange(period);
    const ns = 'http://www.w3.org/2000/svg';
    const node = (tag, attributes, copy) => {
      const element = document.createElementNS(ns, tag);
      for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, String(value));
      if (copy) element.textContent = copy; return element;
    };
    const start = domain.views[0], end = domain.views.at(-1);
    const x = view => 42 + view.durationSeconds / end.durationSeconds * 536;
    const y = price => 168 - (price - domain.bottom) / (domain.top - domain.bottom) * 126;
    const nodes = [node('title', { id: 'applied-chart-title' }, 'Recorded ETH pool prices. The line does not reconstruct the price path between samples.')];
    for (const [visible, price, name] of [[domain.lowerVisible, start.range.lowerPrice, 'Lower bound'], [domain.upperVisible, start.range.upperPrice, 'Upper bound']]) {
      if (visible) nodes.push(node('path', { d: 'M42 ' + y(price) + 'H578', class: 'period-bound' }), node('text', { x: 42, y: y(price) - 8, class: 'chart-label' }, name));
    }
    nodes.push(node('path', { d: domain.views.map((view, i) => (i ? 'L' : 'M') + x(view) + ' ' + y(view.price)).join(' '), class: 'applied-price-line' }));
    domain.views.forEach((view, i) => nodes.push(node('circle', { cx: x(view), cy: y(view.price), r: i === index ? 6 : 3.5, class: 'period-sample', 'data-state': view.state, 'data-selected': i === index })));
    nodes.push(node('text', { x: 42, y: 201, class: 'chart-label' }, 'Start'), node('text', { x: 578, y: 201, 'text-anchor': 'end', class: 'chart-label' }, periodDuration(end.durationSeconds)));
    chart.replaceChildren(...nodes);
    $('applied-chart-caption').textContent = 'Dots are recorded prices; the line does not reconstruct moves between samples. Sage: in-range sample; amber: outside sample. Range: ' + usd(start.range.lowerPrice) + '–' + usd(start.range.upperPrice) + ' per ETH.' + (!domain.lowerVisible ? ' The lower bound is outside the plotted price window.' : '') + (!domain.upperVisible ? ' The upper bound is outside the plotted price window.' : '');
  }
  function renderCheckpoint() {
    const index = draft.checkpoint, view = periodPointView(period, index), interval = periodIntervalView(period, index);
    const snapshot = view.point.snapshot;
    const questionBlock = question.view.point.snapshot.block.number;
    $('applied-checkpoint').max = String(period.points.length - 1); $('applied-checkpoint').value = String(index);
    $('applied-checkpoint').setAttribute('aria-valuetext', 'Checkpoint ' + (index + 1) + ' of ' + period.points.length + ', ' + states[view.state] + ', block ' + snapshot.block.number);
    $('applied-current').textContent = 'Checkpoint ' + (index + 1) + ' of ' + period.points.length + ' · Block ' + snapshot.block.number + ' · ETH ' + usd(view.price) + (index === question.index ? ' · Question checkpoint' : '');
    $('applied-state').textContent = states[view.state]; $('applied-state').dataset.state = view.state;
    $('applied-return-question').hidden = index === question.index;
    $('applied-question-window').textContent = lesson.id === 'between-samples'
      ? 'Question interval: blocks ' + question.interval.start.number + ' → ' + questionBlock + '. Both sampled endpoints are outside.'
      : 'Question checkpoint: final block ' + questionBlock + '. Compare with the first checkpoint.';
    for (const button of $('applied-milestones').children) button.setAttribute('aria-pressed', String(Number(button.dataset.index) === index));
    const metrics = lesson.id === 'fees-over-time'
      ? [metric('Principal value', usd(view.principalUSD), 'Excludes fees'), metric('Period fees', feeUSD(view.feesUSD), 'New tokens, valued at this checkpoint'), metric('Time in range', periodDuration(view.secondsInRange), 'Of ' + periodDuration(view.durationSeconds) + ' elapsed')]
      : lesson.id === 'between-samples'
        ? [metric('Interval in-range time', fmt(interval.secondsInRange, 0) + ' seconds', 'Of ' + fmt(interval.durationSeconds, 0) + ' since the previous checkpoint'), metric('New interval fees', feeUSD(interval.feesUSD), tokens(interval.earned0, interval.earned1)), metric('Cumulative period fees', feeUSD(view.feesUSD), 'From the first checkpoint to this one')]
        : [metric('Holding starting tokens', usd(view.holdingUSD), 'The original principal basket'), metric('LP + period fees', usd(view.lpUSD), 'Principal ' + usd(view.principalUSD) + ' + fees ' + usd(view.feesUSD)), metric('LP minus holding', signedUSD(view.gapUSD), 'Calculated before rounding individual totals')];
    $('applied-metrics').replaceChildren(...metrics);
    $('applied-interval').hidden = lesson.id !== 'between-samples';
    $('applied-interval-summary').textContent = !index ? 'The period starts here: no interval has elapsed.'
      : 'Blocks ' + interval.start.number + ' → ' + interval.end.number + ': ' + fmt(interval.secondsInRange, 0) + ' seconds in range and ' + fmt(interval.secondsOutOfRange, 0) + ' outside. New fees: ' + tokens(interval.earned0, interval.earned1) + '.';
    $('applied-observation').textContent = lesson.id === 'between-samples'
      ? !index ? 'Move forward to compare interval counters with the sampled status.'
        : view.state !== 'inside' && interval.startState !== 'inside' && interval.secondsInRange > 0
          ? 'Both endpoints are outside, yet activity is recorded between them. The sampled price line cannot show every exit and return.'
          : interval.secondsInRange === 0 && interval.earned0 === 0n && interval.earned1 === 0n
            ? 'This interval adds neither active seconds nor fee tokens. Previously earned tokens remain held; their dollar value can still change.'
            : 'Compare the interval counter and fee tokens separately. Neither a sampled status nor elapsed active time alone establishes fee income.'
      : lesson.id === 'fees-over-time'
        ? 'Period fees begin at zero. New fee tokens accrue separately as you move through the record; their dollar value also depends on the selected price.'
        : 'At this checkpoint: principal minus holding ' + signedUSD(view.principalGapUSD) + ', plus period fees ' + usd(view.feesUSD) + ', gives ' + signedUSD(view.gapUSD) + ' before costs.';
    $('applied-accounting').textContent = 'This checkpoint’s principal: ' + tokens(view.principal.amount0, view.principal.amount1) + '. Holding: ' + tokens(view.holding.amount0, view.holding.amount1) + '. Period fees: ' + tokens(view.earned0, view.earned1) + '.';
    evidence([['Position', '#' + snapshot.tokenId + ' · Ethereum WETH/USDC · Uniswap v3 0.3%'], ['Selected checkpoint', utc(snapshot.block.timestamp) + ' · block ' + snapshot.block.number], ['Block hash', snapshot.block.hash], ['Period fee base units', view.earned0 + ' USDC; ' + view.earned1 + ' WETH'], ['Cumulative time', view.secondsInRange + ' seconds in range / ' + view.durationSeconds + ' elapsed'], ['Independent fee check', 'Read-only collect difference; at most one base unit of rounding per token']]);
    const home = new URL('./', location.href);
    try { home.hash = rangeHash(positionScenario(snapshot)); $('applied-explore').href = home.href; $('applied-explore').hidden = false; }
    catch { $('applied-explore').hidden = true; }
    const record = REPLAY_CASES.find(item => item.id === lesson.caseId);
    $('applied-inspect').href = new URL('./' + record.hash, location.href).href;
    drawChart(index);
  }
  function reveal() {
    if (!period || !draft.prediction) return;
    draft.revealed = true;
    const correct = draft.prediction === question.prediction;
    $('applied-prediction-feedback').textContent = correct ? 'Your prediction matches the recorded result at the marked question checkpoint or interval.'
      : 'At the marked question checkpoint or interval: ' + lesson.predictions.find(([id]) => id === question.prediction)[1] + '. Compare that with your prediction.';
    $('applied-observe').hidden = false; $('applied-assessment').hidden = false;
    $('applied-reveal').textContent = 'Revisit the recorded result ↓';
    renderCheckpoint(); persist();
  }
  function check(save = true) {
    const result = checkAppliedUnderstanding(question, application, draft.reason, draft.application);
    $('applied-feedback').hidden = false; $('applied-feedback').className = 'learn-feedback ' + (result.passed ? 'learn-pass' : 'learn-retry');
    $('applied-feedback-title').textContent = result.passed ? 'Both answers are correct.' : 'Review your answers.';
    const reasoningFeedback = appliedReasonFeedback(lesson.id, draft.reason);
    const applicationFeedback = draft.application ? application.feedback : 'Choose an answer for the thought experiment. ' + application.hint;
    $('applied-feedback-copy').textContent = result.passed ? lesson.takeaway
      : !result.reasoning && !result.application ? reasoningFeedback + ' ' + applicationFeedback
      : !result.reasoning ? 'Your application matches the thought experiment. ' + reasoningFeedback
      : 'Your explanation fits the record. ' + applicationFeedback;
    $('applied-continue').hidden = !result.passed;
    const next = APPLIED_LESSONS[APPLIED_LESSONS.indexOf(lesson) + 1];
    $('applied-next').href = next ? '#applied=' + next.id : './#historical-case=range-return';
    $('applied-next').textContent = next ? 'Next: ' + next.short + ' →' : 'Explore the full recorded case →';
    $('applied-reflection').hidden = !(result.passed && !next);
    if (result.passed && !progress.completed.includes(lesson.id)) progress.completed.push(lesson.id);
    if (save) persist(); else updateNavigation();
  }
  async function activate(focus = false) {
    const token = ++revision, id = appliedLessonFromHash(location.hash);
    $('learn-applied').hidden = !id; updateNavigation();
    if (!id) return;
    lesson = APPLIED_LESSONS.find(item => item.id === id); period = null; question = null; application = null;
    if (!matchMedia('(max-width: 750px)').matches) {
      const sidebar = document.querySelector('.learn-sidebar'), selected = document.querySelector('[data-applied-id="' + id + '"]');
      const bounds = selected.getBoundingClientRect(), visible = sidebar.getBoundingClientRect();
      if (bounds.bottom > visible.bottom) sidebar.scrollTop += bounds.bottom - visible.bottom + 24;
      else if (bounds.top < visible.top) sidebar.scrollTop += bounds.top - visible.top - 24;
    }
    draft = progress.drafts[id] || fresh();
    if (!validChoiceSeed(draft.choiceSeed)) draft.choiceSeed = newChoiceSeed();
    draft.application ||= '';
    if (!lesson.predictions.some(([value]) => value === draft.prediction)) { draft.prediction = ''; draft.revealed = false; }
    if (!lesson.reasons.some(([value]) => value === draft.reason)) draft.reason = '';
    $('learn-page-title').textContent = APPLIED_CHAPTER;
    $('learn-page-subtitle').textContent = 'Apply liquidity mechanics to two verified historical cases. Predict, observe, explain and apply.';
    document.title = lesson.short + ' · Passiko Learn';
    $('applied-number').textContent = 'APPLIED ' + (APPLIED_LESSONS.indexOf(lesson) + 1) + ' OF 3';
    $('applied-title').textContent = lesson.title; $('applied-adds').textContent = lesson.adds; $('applied-intro').textContent = lesson.intro;
    $('applied-question').textContent = lesson.question; $('applied-reason-question').textContent = lesson.reasoning;
    $('applied-prediction-question').textContent = lesson.prediction; $('applied-calculation-hint').textContent = lesson.hint;
    learningPitfall($('applied-pitfall'),POOL_PITFALLS[lesson.id]);
    $('applied-takeaway').textContent = lesson.takeaway; $('applied-explanation').textContent = lesson.explanation;
    $('applied-hint').open = false; $('applied-deeper').open = false; $('applied-calculation').open = false;
    $('applied-calculation-feedback').textContent = ''; $('applied-answer').setAttribute('aria-invalid', 'false'); document.querySelector('.applied-primer').open = false;
    $('applied-observe').hidden = true; $('applied-assessment').hidden = true; clearFeedback();
    $('applied-answer').value = draft.answer;
    choices('applied-predictions', 'applied-prediction', lesson.predictions, draft.prediction, value => {
      draft.prediction = value; draft.revealed = false; draft.answer = ''; draft.reason = ''; draft.application = '';
      $('applied-calculation-feedback').textContent = ''; $('applied-answer').setAttribute('aria-invalid', 'false');
      $('applied-answer').value = ''; $('applied-observe').hidden = true; $('applied-assessment').hidden = true; clearFeedback();
      document.querySelectorAll('input[name="applied-reason"],input[name="applied-application"]').forEach(input => { input.checked = false; });
      $('applied-reveal').disabled = !period; $('applied-reveal').textContent = 'Reveal the recorded result →'; persist();
    });
    choices('applied-reasons', 'applied-reason', lesson.reasons, draft.reason, value => { draft.reason = value; clearFeedback(); persist(); });
    $('applied-reveal').disabled = true; $('applied-reveal').textContent = 'Loading the recorded case…';
    $('applied-source').textContent = 'Opening this exercise’s bundled historical case.';
    $('applied-load-status').textContent = 'Loading the bundled record. No live chain request.';
    $('learn-applied').setAttribute('aria-busy', 'true'); persist();
    if (focus) focusTitle('applied-title');
    try {
      const record = await loadRecord(lesson.caseId);
      if (token !== revision) return;
      period = record; question = appliedQuestion(period, id); application = appliedApplication(id, question);
      $('applied-application-context').textContent = application.context;
      $('applied-application-question').textContent = application.question;
      $('applied-hint-text').textContent = lesson.takeaway + ' ' + application.hint;
      if (!application.choices.some(([value]) => value === draft.application)) draft.application = '';
      choices('applied-applications', 'applied-application', application.choices, draft.application, value => { draft.application = value; clearFeedback(); persist(); });
      if (draft.checkpoint === null || draft.checkpoint >= period.points.length) draft.checkpoint = question.index;
      const first = period.points[0].snapshot, last = period.points.at(-1).snapshot;
      $('applied-source').textContent = 'Position #' + first.tokenId + ' · Ethereum WETH/USDC 0.3% · ' + period.points.length + ' checkpoints over ' + periodDuration(period.validation.durationSeconds) + ' · blocks ' + first.block.number + '–' + last.block.number + '.';
      $('applied-milestones').replaceChildren(...periodMilestones(period).map(item => {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'button secondary'; button.dataset.index = item.index;
        button.textContent = item.label + (item.index === question.index ? ' · Question' : '');
        button.addEventListener('click', () => { draft.checkpoint = item.index; renderCheckpoint(); persist(); }); return button;
      }));
      $('applied-reveal').textContent = 'Reveal the recorded result →'; $('applied-reveal').disabled = !draft.prediction;
      $('applied-load-status').textContent = 'Record validated. Choose a prediction, then open the result.';
      if (draft.revealed) { reveal(); if (checkAppliedUnderstanding(question, application, draft.reason, draft.application).passed) check(false); }
      persist();
    } catch (error) {
      if (token !== revision) return;
      $('applied-load-status').textContent = error.message;
      $('applied-source').textContent = 'The bundled record is unavailable. Your saved answers are retained.';
      $('applied-reveal').textContent = 'Retry loading the record →'; $('applied-reveal').disabled = false;
    } finally { if (token === revision) $('learn-applied').setAttribute('aria-busy', 'false'); }
  }
  APPLIED_LESSONS.forEach((item, i) => {
    const li = document.createElement('li'), link = document.createElement('a'); link.href = '#applied=' + item.id; link.dataset.appliedId = item.id;
    const number = document.createElement('span'); number.className = 'learn-step-number'; number.textContent = String(i + 1).padStart(2, '0');
    const copy = document.createElement('span'); copy.className = 'learn-step-copy';
    const title = document.createElement('strong'); title.textContent = item.short;
    const state = document.createElement('span'); state.className = 'learn-step-state'; copy.append(title, ' ', state); link.append(number, ' ', copy); li.append(link); $('applied-lesson-list').append(li);
    link.addEventListener('click', () => { if (matchMedia('(max-width: 750px)').matches) $('learn-course').open = false; });
  });
  $('applied-reveal').addEventListener('click', () => { if (!period) { activate(true); return; } reveal(); focusTitle('applied-observe-title'); });
  $('applied-checkpoint').addEventListener('input', () => { if (!period) return; draft.checkpoint = Number($('applied-checkpoint').value); renderCheckpoint(); persist(); });
  $('applied-return-question').addEventListener('click', () => { draft.checkpoint = question.index; renderCheckpoint(); persist(); });
  $('applied-answer').addEventListener('input', () => { draft.answer = $('applied-answer').value; $('applied-calculation-feedback').textContent = ''; $('applied-answer').setAttribute('aria-invalid', 'false'); persist(); });
  $('applied-calculation-check').addEventListener('click', () => {
    if (!question) return;
    const numeric = checkAppliedAnswer(question, draft.answer, question.reason).numeric;
    $('applied-answer').setAttribute('aria-invalid', String(!numeric));
    $('applied-calculation-feedback').textContent = numeric ? 'Calculation matches. Lesson completion is unchanged.' : 'Revisit the marked question checkpoint, units and requested rounding. This optional practice does not affect completion.';
  });
  $('applied-assessment-form').addEventListener('submit', event => { event.preventDefault(); if (!draft?.revealed || !question) return; check(); });
  $('applied-restart').addEventListener('click', () => { progress.drafts[lesson.id] = fresh(); activate(true); });
  $('applied-topics').addEventListener('click', () => { $('learn-course').open = true; const summary = $('learn-course').querySelector('summary'); summary.focus({ preventScroll: true }); $('learn-course').scrollIntoView({ block: 'start', behavior: 'instant' }); });
  $('learn-resume').addEventListener('click', () => { if (appliedLessonFromHash(location.hash)) focusTitle('applied-title'); });
  document.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest('a[href^="#applied="]');
    if (link && link.hash === location.hash && appliedLessonFromHash(link.hash)) { event.preventDefault(); focusTitle('applied-title'); }
  });
  window.addEventListener('hashchange', () => activate(true));
  activate();
}
