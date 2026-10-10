import { MODEL, DEFAULT_RANGE, LIMITS, calculateRange, comparisonRanges, explorerDomain, rangePreset, futurePricePreset, matchHoldingFees } from '../models/cl-range-v1.js';
import { rangeHash } from '../lib/range-links.js';
import { readSharedScenario } from '../lib/link-router.js';
import { rangeCSV } from '../lib/range-csv.js';
import { fmt, usd, percent, signedUSD, compactUSD } from '../lib/format.js';
import { STATE_COPY, rangePriceLabels, assetAmounts } from '../lib/range-presentation.js';
import { rangeCardBlob } from '../lib/range-card.js';
import { downloadBlob } from '../lib/download.js';

export function initRangeLab({ navigation }) {
  const { selectLab } = navigation;
  const $ = (id) => document.getElementById(id);
  const fields = {
    investment: 'cl-investment', initialPrice: 'cl-start', futurePrice: 'cl-future',
    lowerPrice: 'cl-lower', upperPrice: 'cl-upper', fees: 'cl-fees', fullRangeFees: 'cl-full-fees',
  };
  let current = null;
  let domain = null;
  let source = null;
  let cardURL = null;
  let cardGeneration = 0;
  const setupMedia = matchMedia('(max-width: 750px)');
  function syncSetup() {
    if (!setupMedia.matches) $('cl-setup-details').open = true;
    else if (!$('cl-setup-details').contains(document.activeElement)) $('cl-setup-details').open = false;
  }
  setupMedia.addEventListener('change', syncSetup);
  syncSetup();

  function readInputs() {
    return Object.fromEntries(Object.entries(fields).map(([key, id]) => {
      const text = $(id).value.trim();
      return [key, !text && ['fees', 'fullRangeFees'].includes(key) ? 0 : text ? Number(text) : NaN];
    }));
  }
  function fillInputs(input) { for (const [key, id] of Object.entries(fields)) $(id).value = input[key]; }
  function setText(id, text) { if ($(id).textContent !== text) $(id).textContent = text; }
  function updateAllocation(prefix, share) {
    const eth = Math.max(0, Math.min(100, share));
    $('cl-' + prefix + '-allocation-eth').setAttribute('width', eth);
    $('cl-' + prefix + '-allocation').textContent = fmt(eth, 1) + '% ETH · ' + fmt(100 - eth, 1) + '% USDC by asset value';
    $('cl-' + prefix + '-allocation-title').textContent = fmt(eth, 1) + '% ETH and ' + fmt(100 - eth, 1) + '% USDC by asset value, excluding assumed cash fees.';
  }

  function renderPresets(result) {
    for (const button of document.querySelectorAll('[data-range-width]')) {
      try {
        const preset = rangePreset(result, Number(button.dataset.rangeWidth));
        button.disabled = false;
        button.setAttribute('aria-pressed', String(preset.lowerPrice === result.lowerPrice && preset.upperPrice === result.upperPrice));
      } catch { button.disabled = true; button.setAttribute('aria-pressed', 'false'); }
    }
    for (const button of document.querySelectorAll('[data-range-price]')) {
      try {
        const preset = futurePricePreset(result, button.dataset.rangePrice);
        button.disabled = false;
        button.setAttribute('aria-pressed', String(preset.futurePrice === result.futurePrice));
      } catch { button.disabled = true; button.setAttribute('aria-pressed', 'false'); }
    }
  }
  function renderExplorer(result, updateDomain) {
    if (updateDomain || !domain) domain = explorerDomain(result);
    $('cl-explorer').min = domain.low;
    $('cl-explorer').max = domain.high;
    $('cl-explorer').value = result.futurePrice;
    $('cl-explorer').setAttribute('aria-valuetext', usd(result.futurePrice) + ', ' + STATE_COPY[result.state].title);
    $('cl-explorer-value').textContent = usd(result.futurePrice);
    $('cl-explorer-low').textContent = compactUSD(domain.low);
    $('cl-explorer-high').textContent = compactUSD(domain.high);
  }
  function renderChart(result) {
    const { low, high } = domain;
    const prices = [...new Set([
      ...Array.from({ length: 110 }, (_, i) => low + (high - low) * i / 109),
      result.lowerPrice, result.upperPrice, result.initialPrice, result.futurePrice,
    ])].filter((price) => price >= low && price <= high).sort((a, b) => a - b);
    const rows = prices.map((futurePrice) => calculateRange({ ...result, futurePrice }));
    const top = rows.at(-1);
    const yMax = Math.max(top.holdValue, top.fullRange.lpValue, top.lpValue) * 1.12;
    const x = (price) => 70 + (price - low) / (high - low) * 620;
    const y = (value) => 246 - value / yMax * 220;
    const path = (read) => rows.map((row, i) => (i ? 'L' : 'M') + x(row.futurePrice) + ',' + y(read(row))).join(' ');
    $('cl-chart-hold').setAttribute('d', path((row) => row.holdValue));
    $('cl-chart-full').setAttribute('d', path((row) => row.fullRange.lpValue));
    $('cl-chart-range').setAttribute('d', path((row) => row.lpValue));
    const lower = x(result.lowerPrice);
    const upper = x(result.upperPrice);
    $('cl-chart-band').setAttribute('x', lower);
    $('cl-chart-band').setAttribute('width', upper - lower);
    $('cl-chart-lower').setAttribute('d', 'M' + lower + ' 26V246');
    $('cl-chart-upper').setAttribute('d', 'M' + upper + ' 26V246');
    $('cl-chart-marker').setAttribute('d', 'M' + x(result.futurePrice) + ' 26V246');
    for (const [name, value] of [['hold', result.holdValue], ['full', result.fullRange.lpValue], ['range', result.lpValue]]) {
      $('cl-dot-' + name).setAttribute('cx', x(result.futurePrice));
      $('cl-dot-' + name).setAttribute('cy', y(value));
    }
    $('cl-y-high').textContent = compactUSD(yMax);
    $('cl-y-mid').textContent = compactUSD(yMax / 2);
    $('cl-x-low').textContent = compactUSD(low);
    $('cl-x-mid').textContent = compactUSD((low + high) / 2);
    $('cl-x-high').textContent = compactUSD(high);
    $('cl-chart-title').textContent = 'At ' + usd(result.futurePrice) + ', holding the range’s starting tokens is ' + usd(result.holdValue) + ', full-range 50/50 LP is ' + usd(result.fullRange.lpValue) + ', and range LP is ' + usd(result.lpValue) + '.';
    $('cl-chart-note').textContent = 'Shaded band = your chosen range. Assumed cash fees stay fixed: range ' + usd(result.fees) + '; full-range ' + usd(result.fullRangeFees) + '.';
  }
  function renderComparisons(result) {
    $('cl-comparisons').replaceChildren();
    for (const row of comparisonRanges(result)) {
      const tr = document.createElement('tr');
      if (row.futurePrice === result.futurePrice) tr.className = 'selected-scenario';
      const th = document.createElement('th'); th.scope = 'row';
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'scenario-row-button';
      button.textContent = usd(row.futurePrice) + (row.futurePrice === result.futurePrice ? ' · selected' : '');
      button.addEventListener('click', () => setFuturePrice(row.futurePrice));
      th.append(button); tr.append(th);
      for (const [text, style] of [
        [STATE_COPY[row.state].title, 'muted'], [usd(row.holdValue), ''], [usd(row.fullRange.lpValue), ''],
        [usd(row.lpValue), ''], [signedUSD(row.difference), row.difference >= 0 ? 'gain' : 'loss'],
      ]) {
        const td = document.createElement('td'); td.textContent = text; td.className = style; tr.append(td);
      }
      $('cl-comparisons').append(tr);
    }
  }
  function render({ updateDomain = true } = {}) {
    const input = readInputs();
    cardGeneration++;
    if (cardURL) { URL.revokeObjectURL(cardURL); cardURL = null; }
    $('cl-card-preview').hidden = true;
    $('cl-image-status').textContent = '';
    $('cl-share-wrap').hidden = true;
    $('cl-link-status').textContent = '';
    $('cl-link-status').hidden = true;
    for (const [key, id] of Object.entries(fields)) {
      const { min, max } = LIMITS[key];
      const invalid = !Number.isFinite(input[key]) || input[key] < min || input[key] > max
        || (['lowerPrice', 'upperPrice'].includes(key) && input.lowerPrice >= input.upperPrice);
      $(id).setAttribute('aria-invalid', String(invalid));
    }
    try {
      const result = calculateRange(input); current = result;
      $('cl-error').textContent = '';
      $('cl-results').hidden = false; $('cl-invalid').hidden = true;
      $('cl-starting-mix').hidden = false; $('cl-comparison-card').hidden = false;
      for (const id of ['cl-share', 'cl-export', 'cl-image']) $(id).disabled = false;
      $('cl-close-setup').disabled = false;
      const copy = STATE_COPY[result.state];
      setText('cl-state', copy.title);
      $('cl-state').dataset.state = result.state;
      $('cl-state-note').textContent = 'At ' + usd(result.futurePrice) + ', ' + copy.note.charAt(0).toLowerCase() + copy.note.slice(1);
      const prices = rangePriceLabels(result.lowerPrice, result.upperPrice);
      $('cl-range-label').textContent = prices.lower + ' – ' + prices.upper;
      $('cl-setup-overview').textContent = usd(result.investment) + ' · ' + prices.lower + ' – ' + prices.upper;
      $('cl-hold-value').textContent = usd(result.holdValue);
      $('cl-hold-return').textContent = percent(result.holdReturn) + ' vs. investment';
      $('cl-held-note').textContent = assetAmounts(result.initial);
      $('cl-full-value').textContent = usd(result.fullRange.lpValue);
      $('cl-full-return').textContent = percent(result.fullRange.lpReturn) + ' vs. investment';
      $('cl-full-note').textContent = 'Starts 50/50 · ' + usd(result.fullRangeFees) + ' assumed cash fees';
      $('cl-value').textContent = usd(result.lpValue);
      $('cl-return').textContent = percent(result.lpReturn) + ' vs. investment';
      $('cl-fees-note').textContent = 'Includes ' + usd(result.fees) + ' assumed cash fees';
      const magnitude = Math.abs(result.difference);
      $('cl-verdict').textContent = magnitude < 0.005
        ? 'Your range and holding its starting tokens finish at the same value under these assumptions.'
        : 'Your range finishes ' + usd(magnitude) + ' (' + fmt(Math.abs(result.differencePercent)) + '%) ' + (result.difference > 0 ? 'ahead of' : 'behind') + ' holding its starting tokens.';
      $('cl-verdict').className = 'scenario-verdict ' + (result.difference >= 0 ? 'gain' : 'loss');
      $('cl-initial-assets').textContent = assetAmounts(result.initial);
      $('cl-initial-note').textContent = result.initialState === 'inside'
        ? 'This mix is calculated from your range; it may differ from 50/50.'
        : 'Your starting price is at or outside the range, so the position starts in a single token.';
      $('cl-final-assets').textContent = assetAmounts(result.pooled);
      $('cl-asset-state').textContent = copy.assets;
      updateAllocation('initial', result.initialEthPercent);
      updateAllocation('final', result.finalEthPercent);
      $('cl-il').textContent = percent(result.impermanentLoss);
      $('cl-break-even').textContent = usd(result.breakEvenFees);
      $('cl-full-hold').textContent = usd(result.fullRange.holdValue);
      $('cl-match-fees').disabled = result.breakEvenFees > LIMITS.fees.max;
      $('cl-match-fees').textContent = result.breakEvenFees > LIMITS.fees.max ? 'Above the supported fee input limit' : 'Use break-even fees';
      $('cl-origin').textContent = source && result.initialPrice === source.price && (!source.range || ['investment', 'lowerPrice', 'upperPrice'].every(key => result[key] === source.range[key])) ? source.label : '';
      $('cl-origin').hidden = !$('cl-origin').textContent;
      renderPresets(result); renderExplorer(result, updateDomain); renderChart(result); renderComparisons(result);
    } catch (error) {
      current = null;
      $('cl-error').textContent = error.message;
      $('cl-setup-details').open = true;
      $('cl-close-setup').disabled = true;
      $('cl-results').hidden = true; $('cl-invalid').hidden = false;
      $('cl-starting-mix').hidden = true; $('cl-comparison-card').hidden = true; $('cl-origin').hidden = true;
      for (const id of ['cl-share', 'cl-export', 'cl-image']) $(id).disabled = true;
      if (['fees', 'fullRangeFees'].some((key) => $(fields[key]).getAttribute('aria-invalid') === 'true')) $('cl-fee-details').open = true;
    }
  }
  function setFuturePrice(price, updateDomain = true) { $('cl-future').value = price; render({ updateDomain }); }
  for (const id of Object.values(fields)) $(id).addEventListener('input', () => render());
  $('cl-form').addEventListener('submit', (event) => { event.preventDefault(); render(); });
  $('cl-close-setup').addEventListener('click', () => {
    if (!current) return;
    $('cl-setup-details').open = false;
    $('cl-results').focus({ preventScroll: true });
    $('cl-results').scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  });
  $('cl-explorer').addEventListener('input', () => setFuturePrice(Number($('cl-explorer').value), false));
  $('cl-chart').addEventListener('click', (event) => {
    if (!current || !domain) return;
    const rect = $('cl-chart').getBoundingClientRect();
    const coordinate = (event.clientX - rect.left) / rect.width * 720;
    const fraction = Math.max(0, Math.min(1, (coordinate - 70) / 620));
    setFuturePrice(Number((domain.low + fraction * (domain.high - domain.low)).toPrecision(12)), false);
  });
  for (const button of document.querySelectorAll('[data-range-width]')) button.addEventListener('click', () => {
    try { fillInputs(rangePreset(readInputs(), Number(button.dataset.rangeWidth))); render(); }
    catch (error) { $('cl-error').textContent = error.message; }
  });
  for (const button of document.querySelectorAll('[data-range-price]')) button.addEventListener('click', () => {
    try { fillInputs(futurePricePreset(readInputs(), button.dataset.rangePrice)); render(); }
    catch (error) { $('cl-error').textContent = error.message; }
  });
  $('cl-match-fees').addEventListener('click', () => {
    try { fillInputs(matchHoldingFees(readInputs())); render(); $('cl-fee-details').open = true; }
    catch (error) { $('cl-error').textContent = error.message; }
  });
  $('cl-reset').addEventListener('click', () => {
    source = null; fillInputs(DEFAULT_RANGE); render();
    if (new URLSearchParams(location.hash.replace(/^#/, '')).get('scenario') === MODEL) history.replaceState(null, '', location.pathname + location.search + '#range-lab');
  });
  $('cl-share').addEventListener('click', async () => {
    if (!current) return;
    const url = new URL(location.pathname, location.origin); url.hash = rangeHash(current);
    $('cl-share-url').value = url.href; $('cl-share-wrap').hidden = false;
    try {
      await navigator.clipboard.writeText(url.href);
      $('cl-share-status').textContent = 'Link copied. It includes the range, both fee assumptions and the model version.';
    } catch {
      $('cl-share-status').textContent = 'Copy the link below to share this range scenario.';
      $('cl-share-url').focus(); $('cl-share-url').select();
    }
  });
  $('cl-export').addEventListener('click', () => {
    if (current) downloadBlob(new Blob([rangeCSV(current)], { type: 'text/csv;charset=utf-8' }), 'degenerator-range-scenarios-cl-range-v1.csv');
  });
  $('cl-image').addEventListener('click', async () => {
    if (!current) return;
    const generation = cardGeneration;
    $('cl-image-status').textContent = 'Creating your range card…';
    try {
      const blob = await rangeCardBlob(current, new URL(location.pathname, location.origin).href);
      if (generation !== cardGeneration) return;
      if (cardURL) URL.revokeObjectURL(cardURL);
      cardURL = URL.createObjectURL(blob);
      $('cl-card-image').src = cardURL; $('cl-image-download').href = cardURL;
      $('cl-card-preview').hidden = false; $('cl-card-preview').open = true;
      $('cl-image-status').textContent = 'Your card is ready below. Use the scenario link or CSV to reproduce exact inputs.';
    } catch (error) { if (generation === cardGeneration) $('cl-image-status').textContent = error.message; }
  });
  function setRangeStartingPrice(price, label) {
    const investment = current?.investment ?? DEFAULT_RANGE.investment;
    const input = {
      investment, initialPrice: price, futurePrice: Math.min(LIMITS.futurePrice.max, price * 1.05),
      lowerPrice: Math.max(LIMITS.lowerPrice.min, price * 0.9), upperPrice: Math.min(LIMITS.upperPrice.max, price * 1.1),
      fees: 0, fullRangeFees: 0,
    };
    calculateRange(input);
    source = { price, label }; fillInputs(input); render();
    selectLab('range', { scroll: true });
  }
  function loadShared() {
    const model = new URLSearchParams(location.hash.replace(/^#/, '')).get('scenario');
    if (model && model !== MODEL) { render(); return; }
    try {
      const shared = readSharedScenario(location.hash);
      if (shared?.model === MODEL) { source = null; fillInputs(shared.scenario); }
      render();
      if (shared) { $('cl-link-status').textContent = 'Shared range scenario loaded. Your saved swap sandbox is unchanged.'; $('cl-link-status').hidden = false; }
    } catch (error) {
      source = null; fillInputs(DEFAULT_RANGE); render();
      $('cl-link-status').textContent = error.message + ' Showing the default range scenario.';
      $('cl-link-status').hidden = false;
    }
  }
  fillInputs(DEFAULT_RANGE); loadShared();
  window.addEventListener('hashchange', loadShared);

  function setScenario(input, label) {
    const result = calculateRange(input);
    source = { price: result.initialPrice, label, range: { investment: result.investment, lowerPrice: result.lowerPrice, upperPrice: result.upperPrice } };
    fillInputs(result); render();
    selectLab('range', { scroll: true });
  }

  return { setStartingPrice: setRangeStartingPrice, setScenario };
}
