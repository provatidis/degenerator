import { labFeedback } from '../lib/lab-feedback.js';
import { MODEL, DEFAULT_SCENARIO, LIMITS, validateScenario, calculateScenario, comparisonScenarios } from '../models/cp50-v1.js';
import { scenarioHash } from '../lib/scenario-links.js';
import { readSharedScenario, RANGE_MODEL } from '../lib/link-router.js';
import { scenarioCSV } from '../lib/scenario-csv.js';
import { experimentScenario } from '../models/experiments.js';
import { fmt, usd, signedUSD, percent, compactUSD } from '../lib/format.js';
import { downloadBlob } from '../lib/download.js';
import { resultCardBlob } from '../lib/result-card.js?v=1.15.2';
import { validateExperimentDraft } from '../data/saved-experiments.js';
import { experimentOriginLabel } from '../lib/saved-experiments.js?v=1.15.2';

export function initFullRangeLab({ navigation }) {
  const { selectLab } = navigation;
  const $ = (id) => document.getElementById(id);
  const fields = { investment: 'scenario-investment', initialPrice: 'scenario-start', futurePrice: 'scenario-future', fees: 'scenario-fees' };
  const feedback = labFeedback({ prefix: 'scenario', fields, limits: LIMITS, optional: ['fees'] });
  let current = null;
  let startingSource = null;
  let cardURL = null;
  let cardGeneration = 0;

  function readInputs() {
    return Object.fromEntries(Object.entries(fields).map(([key, id]) => [key, key === 'fees' && !$(id).value.trim() ? 0 : $(id).value.trim() ? Number($(id).value) : NaN]));
  }

  function fillInputs(scenario) {
    for (const [key, id] of Object.entries(fields)) $(id).value = scenario[key];
  }

  function renderChart(result) {
    const { ratio, investment, initialPrice, fees } = result;
    const lo = Math.max(LIMITS.futurePrice.min / initialPrice, Math.min(0.25, ratio * 0.8));
    const hi = Math.min(LIMITS.futurePrice.max / initialPrice, Math.max(4, ratio * 1.2));
    const ymax = Math.max(investment * (1 + hi) / 2, investment * Math.sqrt(hi) + fees) * 1.12;
    const x = (r) => 60 + (r - lo) / (hi - lo) * 530;
    const y = (value) => 208 - value / ymax * 180;
    const ratios = Array.from({ length: 100 }, (_, i) => lo + (hi - lo) * i / 99);
    const path = (getValue) => ratios.map((r, i) => `${i ? 'L' : 'M'}${x(r)},${y(getValue(r))}`).join(' ');
    $('scenario-hold-path').setAttribute('d', path((r) => investment * (1 + r) / 2));
    $('scenario-lp-path').setAttribute('d', path((r) => investment * Math.sqrt(r) + fees));
    $('scenario-chart-marker').setAttribute('d', `M${x(ratio)} 26V208`);
    for (const [id, value] of [['scenario-hold-dot', result.holdValue], ['scenario-lp-dot', result.lpValue]]) {
      $(id).setAttribute('cx', x(ratio));
      $(id).setAttribute('cy', y(value));
    }
    for (const [id, value, yy] of [['scenario-y-high', ymax, 32], ['scenario-y-mid', ymax / 2, 122], ['scenario-y-zero', 0, 212]]) {
      $(id).textContent = compactUSD(value);
      $(id).setAttribute('y', yy);
    }
    $('scenario-x-low').textContent = compactUSD(lo * initialPrice);
    $('scenario-x-high').textContent = compactUSD(hi * initialPrice);
    $('scenario-chart-title').textContent = `Holding and liquidity values as ETH price changes. At ${usd(result.futurePrice)}, holding is ${usd(result.holdValue)}, LP plus assumed fees is ${usd(result.lpValue)}.`;
    $('scenario-chart-note').textContent = `${usd(fees)} assumed fee income is held fixed across this chart.`;
  }

  function renderTable(result) {
    $('scenario-comparisons').replaceChildren();
    for (const comparison of comparisonScenarios(result)) {
      const row = document.createElement('tr'); row.setAttribute('role', 'row');
      const selected = comparison.futurePrice === result.futurePrice;
      if (selected) row.className = 'selected-scenario';
      const priceCell = document.createElement('th');
      priceCell.scope = 'row'; priceCell.setAttribute('role', 'rowheader');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'scenario-row-button';
      button.textContent = `${usd(comparison.futurePrice)} · ${percent((comparison.ratio - 1) * 100)}${selected ? ' · selected' : ''}`;
      button.addEventListener('click', () => {
        const focused = document.activeElement === button;
        $('scenario-future').value = comparison.futurePrice; render();
        if (focused) $('scenario-comparisons').querySelector('.selected-scenario button')?.focus({ preventScroll: true });
      });
      priceCell.append(button);
      row.append(priceCell);
      for (const [label, value, className] of [
        ['Holding', usd(comparison.holdValue), ''], ['LP + assumed fees', usd(comparison.lpValue), ''],
        ['LP minus holding', signedUSD(comparison.difference), comparison.difference >= 0 ? 'gain' : 'loss'],
        ['IL before fees', percent(comparison.impermanentLoss), 'muted'],
      ]) {
        const cell = document.createElement('td');
        cell.setAttribute('role', 'cell');
        const name = document.createElement('span'); name.className = 'mobile-cell-label'; name.setAttribute('aria-hidden', 'true'); name.textContent = label;
        const amount = document.createElement('span'); amount.textContent = value;
        cell.append(name, amount);
        cell.className = className;
        row.append(cell);
      }
      $('scenario-comparisons').append(row);
    }
  }

  function render() {
    $('scenario-save-status').textContent = '';
    cardGeneration++;
    if (cardURL) { URL.revokeObjectURL(cardURL); cardURL = null; }
    $('scenario-card-preview').hidden = true;
    $('scenario-image-status').textContent = '';
    $('experiment-status').textContent = '';
    const inputs = readInputs();
    const fieldError = feedback.validate(inputs);
    $('scenario-share-wrap').hidden = true;
    $('scenario-link-status').textContent = '';
    try {
      if (fieldError) throw new Error(fieldError);
      const result = calculateScenario(inputs);
      current = result;
      feedback.result(result);
      $('scenario-origin').textContent = startingSource && result.initialPrice === startingSource.price ? startingSource.label : '';
      $('scenario-origin').hidden = !$('scenario-origin').textContent;
      $('scenario-error').textContent = '';
      $('scenario-results').hidden = false;
      $('scenario-comparison-card').hidden = false;
      $('scenario-invalid').hidden = true;
      $('scenario-share').disabled = false;
      $('scenario-export').disabled = false;
      $('scenario-image').disabled = false;
      $('scenario-save').disabled = false;
      $('scenario-hold-value').textContent = usd(result.holdValue);
      $('scenario-lp-value').textContent = usd(result.lpValue);
      $('scenario-hold-return').textContent = `${percent(result.holdReturn)} vs. initial investment`;
      $('scenario-lp-return').textContent = `${percent(result.lpReturn)} vs. initial investment`;
      const magnitude = Math.abs(result.difference);
      $('scenario-verdict').textContent = magnitude < 0.005
        ? 'Liquidity and holding differ by less than half a cent under these assumptions.'
        : `Liquidity finishes ${usd(magnitude)} (${fmt(Math.abs(result.differencePercent))}%) ${result.difference > 0 ? 'ahead of' : 'behind'} holding under these assumptions.`;
      $('scenario-verdict').className = `scenario-verdict ${result.difference >= 0 ? 'gain' : 'loss'}`;
      $('scenario-il').textContent = percent(result.impermanentLoss);
      $('scenario-break-even').textContent = usd(result.breakEvenFees);
      $('scenario-price-change').textContent = percent((result.ratio - 1) * 100);
      $('scenario-hold-eth').textContent = `${fmt(result.held.eth, 6)} ETH`;
      $('scenario-hold-usdc').textContent = `${fmt(result.held.usdc)} USDC`;
      $('scenario-lp-eth').textContent = `${fmt(result.pooled.eth, 6)} ETH`;
      $('scenario-lp-usdc').textContent = `${fmt(result.pooled.usdc)} USDC`;
      $('scenario-lp-before-fees').textContent = usd(result.lpBeforeFees);
      $('scenario-cash-fees').textContent = `${usd(result.fees)} assumed USD cash`;
      for (const button of document.querySelectorAll('[data-price-multiple]')) {
        const price = result.initialPrice * Number(button.dataset.priceMultiple);
        button.disabled = price < LIMITS.futurePrice.min || price > LIMITS.futurePrice.max;
        button.setAttribute('aria-pressed', String(price === result.futurePrice));
      }
      renderChart(result);
      renderTable(result);
    } catch (error) {
      current = null;
      feedback.invalid(error.message);
      $('scenario-results').hidden = true;
      $('scenario-comparison-card').hidden = true;
      $('scenario-invalid').hidden = false;
      $('scenario-share').disabled = true;
      $('scenario-export').disabled = true;
      $('scenario-image').disabled = true;
      $('scenario-save').disabled = true;
      $('scenario-origin').hidden = true;
    }
  }

  for (const id of Object.values(fields)) $(id).addEventListener('input', render);
  $('scenario-form').addEventListener('submit', (event) => { event.preventDefault(); render(); });
  for (const button of document.querySelectorAll('[data-price-multiple]')) button.addEventListener('click', () => {
    const price = Number($('scenario-start').value) * Number(button.dataset.priceMultiple);
    if (!Number.isFinite(price)) return;
    $('scenario-future').value = price;
    render();
  });
  $('scenario-reset').addEventListener('click', () => {
    startingSource = null;
    fillInputs(DEFAULT_SCENARIO);
    if (location.hash.startsWith('#scenario=')) history.replaceState(null, '', location.pathname + location.search);
    render();
  });
  $('scenario-share').addEventListener('click', async () => {
    if (!current) return;
    const url = new URL(location.pathname, location.origin);
    url.hash = scenarioHash(current);
    $('scenario-share-url').value = url.href;
    $('scenario-share-wrap').hidden = false;
    try {
      await navigator.clipboard.writeText(url.href);
      $('scenario-share-status').textContent = 'Link copied. It includes only scenario inputs and the model version.';
    } catch {
      $('scenario-share-status').textContent = 'Copy the link below to share these inputs.';
      $('scenario-share-url').focus();
      $('scenario-share-url').select();
    }
  });
  $('scenario-export').addEventListener('click', () => {
    if (current) downloadBlob(new Blob([scenarioCSV(current)], { type: 'text/csv;charset=utf-8' }), 'passiko-liquidity-scenarios-cp50-v1.csv');
  });

  $('scenario-image').addEventListener('click', async () => {
    if (!current) return;
    const generation = cardGeneration;
    $('scenario-image-status').textContent = 'Creating your result card…';
    try {
      const blob = await resultCardBlob(current, new URL(location.pathname, location.origin).href);
      if (generation !== cardGeneration) return;
      if (cardURL) URL.revokeObjectURL(cardURL);
      cardURL = URL.createObjectURL(blob);
      $('scenario-card-image').src = cardURL;
      $('scenario-image-download').href = cardURL;
      $('scenario-card-preview').hidden = false;
      $('scenario-card-preview').open = true;
      $('scenario-image-status').textContent = 'Card ready. Download the image below; share the scenario link to reproduce its inputs.';
    } catch (error) { if (generation === cardGeneration) $('scenario-image-status').textContent = error.message; }
  });

  for (const button of document.querySelectorAll('[data-experiment]')) button.addEventListener('click', () => {
    try {
      fillInputs(experimentScenario(readInputs(), button.dataset.experiment));
      render();
      $('experiment-status').textContent = button.dataset.experiment === 'break-even'
        ? 'Fee income now equals the amount needed to match holding. This is a target assumption, not a yield estimate.'
        : 'Price experiment loaded with your current investment and starting price. Assumed fee income is $0.';
    } catch (error) { $('experiment-status').textContent = error.message; }
  });

  function setStartingPrice(price, label, origin = null) {
    const input = readInputs();
    const investment = Number.isFinite(input.investment) && input.investment >= LIMITS.investment.min && input.investment <= LIMITS.investment.max
      ? input.investment : DEFAULT_SCENARIO.investment;
    const scenario = validateScenario({ investment, initialPrice: price, futurePrice: price * 2, fees: 0 });
    startingSource = { price, label, origin };
    fillInputs(scenario);
    render();
    selectLab('full', { scroll: true });
  }

  function loadShared() {
    try {
      const linkedModel = new URLSearchParams(location.hash.replace(/^#/, '')).get('scenario');
      if (linkedModel === RANGE_MODEL) { render(); return; }
      const decoded = readSharedScenario(location.hash);
      const shared = decoded?.model === MODEL ? decoded.scenario : null;
      if (shared) { startingSource = null; fillInputs(shared); }
      render();
      if (shared) $('scenario-link-status').textContent = 'Shared scenario loaded. Your saved swap sandbox is unchanged.';
    } catch (error) {
      startingSource = null;
      fillInputs(DEFAULT_SCENARIO);
      render();
      $('scenario-link-status').textContent = `${error.message} Showing the default scenario.`;
    }
  }
  fillInputs(DEFAULT_SCENARIO);
  loadShared();
  window.addEventListener('hashchange', loadShared);

  function getExperimentDraft() {
    if (!current) return null;
    return validateExperimentDraft({ model: MODEL, inputs: current,
      origin: startingSource && current.initialPrice === startingSource.price ? startingSource.origin : null });
  }
  function restoreExperimentDraft(entry) {
    const draft = validateExperimentDraft(entry);
    if (draft.model !== MODEL) throw new Error('Choose a full-range experiment for this lab.');
    startingSource = draft.origin ? { price: draft.inputs.initialPrice, origin: draft.origin, label: experimentOriginLabel(draft.origin, MODEL) } : null;
    fillInputs(draft.inputs); render();
  }
  function setExperiment(entry) {
    restoreExperimentDraft(entry);
    selectLab('full', { updateURL: false, scroll: true, immediate: true });
    $('scenario-save-status').textContent = 'Opened “' + entry.name + '” as a working copy. Save again to keep a variation.';
  }
  return { setStartingPrice, getExperimentDraft, restoreExperimentDraft, setExperiment, restoreLocation: loadShared };
}
