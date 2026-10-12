import { validatePositionPeriod } from '../data/position-period.js';
import { REPLAY_CASES, replayCaseFromHash, isReplayHash } from '../data/replay-cases.js';
import { positionScenario } from '../data/position-snapshot.js';
import { periodPointView, periodIntervalView, periodMilestones, periodDuration, periodChartRange } from '../lib/period-presentation.js';
import { usd, signedUSD } from '../lib/format.js';
import { feeUSD, feeTokenAmounts } from '../lib/position-fees.js';
import { formatUnits } from '../models/units.js';
import { downloadBlob } from '../lib/download.js';

export function initPositionPeriod({ rangeLab }) {
  const $ = id => document.getElementById(id);
  const records = new Map(), requests = new Map(), checkpoints = new Map();
  let period = null, selected = REPLAY_CASES[0], index = 0, revision = 0;
  const utc = timestamp => new Date(timestamp * 1000).toISOString().replace('T', ' ').replace('.000Z', ' UTC');
  const tokens = (zero, one) => formatUnits(zero, 6) + ' USDC + ' + formatUnits(one, 18) + ' WETH';
  const stateLabels = { inside: 'In range · both tokens', above: 'Above ETH price range · all USDC', below: 'Below ETH price range · all WETH' };
  const comparison = gap => Math.abs(gap) < .005 ? 'approximately equal to holding' : usd(Math.abs(gap)) + (gap < 0 ? ' behind holding' : ' ahead of holding');

  for (const item of REPLAY_CASES) {
    const option = document.createElement('option'); option.value = item.id; option.textContent = item.title;
    $('period-case').append(option);
  }

  function render() {
    const view = periodPointView(period, index), interval = periodIntervalView(period, index), s = view.point.snapshot;
    $('period-checkpoint').max = String(period.points.length - 1); $('period-checkpoint').value = String(index);
    $('period-checkpoint').setAttribute('aria-valuetext', 'Checkpoint ' + (index + 1) + ' of ' + period.points.length + ', ' + utc(s.block.timestamp) + ', ' + stateLabels[view.state]);
    $('period-current').textContent = 'Checkpoint ' + (index + 1) + ' of ' + period.points.length + ' · ' + utc(s.block.timestamp);
    $('period-checkpoint-state').textContent = stateLabels[view.state];
    $('period-checkpoint-state').dataset.state = view.state;
    $('period-lp').textContent = usd(view.lpUSD); $('period-hold').textContent = usd(view.holdingUSD);
    $('period-fees').textContent = feeUSD(view.feesUSD); $('period-gap').textContent = signedUSD(view.gapUSD);
    $('period-range-time').textContent = view.durationSeconds ? ((view.secondsInRange / view.durationSeconds) * 100).toFixed(1) + '%' : 'Starting checkpoint';
    $('period-time-detail').textContent = view.secondsInRange + ' of ' + view.durationSeconds + ' elapsed seconds';
    $('period-outside-time').textContent = periodDuration(view.secondsOutOfRange);
    $('period-principal').textContent = tokens(view.principal.amount0, view.principal.amount1);
    $('period-fee-tokens').textContent = tokens(view.earned0, view.earned1);
    $('period-hold-tokens').textContent = tokens(view.holding.amount0, view.holding.amount1);
    $('period-price').textContent = usd(view.price);
    $('period-block').textContent = 'Ethereum block ' + s.block.number + ' ↗'; $('period-block').href = 'https://etherscan.io/block/' + s.block.number;
    $('period-hash').textContent = s.block.hash;
    $('period-raw-fees').textContent = view.earned0 + ' USDC base units; ' + view.earned1 + ' WETH base units';
    $('period-counter').textContent = view.point.secondsInside;
    for (const button of $('period-milestones').children) button.setAttribute('aria-pressed', String(Number(button.dataset.index) === index));

    $('period-interval-title').textContent = index ? 'Since the previous checkpoint' : 'Starting checkpoint';
    $('period-interval-metrics').hidden = !index;
    $('period-interval-window').textContent = index ? utc(interval.start.timestamp) + ' → ' + utc(interval.end.timestamp) : 'Both strategies begin with the same principal tokens.';
    $('period-interval-range').textContent = periodDuration(interval.secondsInRange) + ' of ' + periodDuration(interval.durationSeconds);
    $('period-interval-fees').textContent = feeUSD(interval.feesUSD);
    $('period-interval-tokens').textContent = feeTokenAmounts(interval.earned0, interval.earned1);
    $('period-interval-raw').textContent = interval.earned0 + ' USDC base units; ' + interval.earned1 + ' WETH base units';
    $('period-interval-time-raw').textContent = interval.secondsInRange + ' in range; ' + interval.secondsOutOfRange + ' outside; ' + interval.durationSeconds + ' elapsed seconds';
    $('period-interval-explanation').textContent = !index
      ? 'Period fees start at zero. Earlier fees and owed balances are excluded from both strategies.'
      : interval.secondsInRange === 0 && interval.earned0 === 0n && interval.earned1 === 0n
        ? 'The range-time counter adds no active seconds, and recorded fee growth adds no tokens in this interval. Earlier fee tokens are still held; their dollar value can change with ETH’s price.'
        : interval.secondsInRange === 0
          ? 'The counter adds no active seconds, but fee growth adds tokens. Swaps can enter and leave a range within one block without adding elapsed seconds to the counter.'
          : view.state !== 'inside' && interval.startState !== 'inside'
            ? 'Both sampled endpoints are outside, but the counter records ' + periodDuration(interval.secondsInRange) + ' active between them. ' + (interval.earned0 > 0n || interval.earned1 > 0n ? 'New fee tokens were also recorded.' : 'No new fee tokens were recorded.') + ' The position entered and left the range between these samples; the price line does not show those moves.'
          : interval.secondsOutOfRange > 0
            ? 'The counter records ' + periodDuration(interval.secondsOutOfRange) + ' outside the range in this interval. Fee growth records the tokens earned. The sampled prices do not locate every crossing or show when each fee was earned.'
            : 'The counter records the entire interval in range. Fee income depends on swaps and liquidity; active time alone does not determine earnings.';
    $('period-outcome').textContent = !index
      ? 'LP principal and holding are equal at the start.'
      : 'Before period fees, LP principal is ' + comparison(view.principalGapUSD) + '. Recorded fee tokens add ' + feeUSD(view.feesUSD) + ' at this checkpoint’s price. Including them, the LP is ' + comparison(view.gapUSD) + '.';

    const { views, bottom, top, lowerVisible, upperVisible } = periodChartRange(period);
    const boundsNote = !lowerVisible && !upperVisible ? ' Both bounds lie outside the chart’s price window.' : !lowerVisible || !upperVisible ? ' The chart focuses on recorded prices; the ' + (!lowerVisible ? 'lower' : 'upper') + ' bound is outside this view.' : '';
    $('period-chart-range-note').textContent = 'Fixed range: ' + usd(view.range.lowerPrice) + ' – ' + usd(view.range.upperPrice) + '.' + boundsNote;
    const y = price => 30 + (top - price) / (top - bottom) * 180;
    const start = period.points[0].snapshot.block.timestamp, end = period.points.at(-1).snapshot.block.timestamp;
    const x = time => 65 + (time - start) / (end - start) * 490;
    $('period-line').setAttribute('d', views.map((item, i) => (i ? 'L' : 'M') + x(item.point.snapshot.block.timestamp).toFixed(2) + ' ' + y(item.price).toFixed(2)).join(' '));
    for (const [key, price] of [['lower', view.range.lowerPrice], ['upper', view.range.upperPrice]]) {
      const visible = key === 'lower' ? lowerVisible : upperVisible;
      $('period-' + key).setAttribute('visibility', visible ? 'visible' : 'hidden'); $('period-' + key + '-label').setAttribute('visibility', visible ? 'visible' : 'hidden');
      $('period-' + key).setAttribute('d', 'M65 ' + y(price) + ' H555');
      $('period-' + key + '-label').setAttribute('y', y(price) - 8); $('period-' + key + '-label').textContent = usd(price);
    }
    const dots = views.map(item => {
      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot.setAttribute('cx', x(item.point.snapshot.block.timestamp)); dot.setAttribute('cy', y(item.price)); dot.setAttribute('r', '4');
      dot.setAttribute('class', 'period-sample'); dot.dataset.state = item.state; return dot;
    });
    $('period-samples').replaceChildren(...dots);
    $('period-dot').dataset.state = view.state;
    $('period-dot').setAttribute('cx', x(s.block.timestamp)); $('period-dot').setAttribute('cy', y(view.price));
    $('period-chart').setAttribute('aria-label', period.points.length + ' recorded ETH price checkpoints. Selected price ' + usd(view.price) + ', ' + stateLabels[view.state] + '. Lines connect samples and do not reconstruct intra-sample prices.');
    $('period-result').hidden = false;
  }

  function selectCheckpoint(next) {
    if (!period) return;
    index = next; checkpoints.set(selected.id, index); render();
  }
  function buildMilestones() {
    const buttons = periodMilestones(period).map(item => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'button secondary';
      button.textContent = item.label; button.dataset.index = item.index; button.setAttribute('aria-controls', 'period-result');
      button.addEventListener('click', () => selectCheckpoint(item.index)); return button;
    });
    $('period-milestones').replaceChildren(...buttons);
  }
  async function readRecord(item) {
    if (records.has(item.id)) return records.get(item.id);
    if (!requests.has(item.id)) {
      const request = (async () => {
        const response = await fetch(new URL('../examples/' + item.file, import.meta.url));
        if (!response.ok) throw new Error('The recorded case could not be opened.');
        const body = await response.text(); if (body.length > 131072) throw new Error('The recorded case is too large.');
        const record = validatePositionPeriod(JSON.parse(body));
        if (item.id === 'range-return' && !periodMilestones(record).some(point => point.label === 'Return sample')) throw new Error('The recorded case lacks a sampled exit and return.');
        records.set(item.id, record); return record;
      })();
      requests.set(item.id, request);
      request.finally(() => requests.delete(item.id)).catch(() => {});
    }
    return requests.get(item.id);
  }
  async function load(item, invalid = false) {
    const currentRevision = ++revision; selected = item; period = null;
    $('period-case').value = item.id; $('period-case-detail').textContent = item.detail;
    $('historical-case').setAttribute('aria-busy', 'true'); $('period-result').hidden = true;
    $('period-export').disabled = true; $('period-apply').disabled = true; $('period-retry').hidden = true;
    $('period-title').textContent = item.title; $('period-window').textContent = ''; $('period-description').textContent = '';
    $('period-status').textContent = 'Opening the recorded historical case…';
    try {
      const record = await readRecord(item);
      if (currentRevision !== revision) return;
      period = record; index = checkpoints.get(item.id) ?? period.points.length - 1;
      const first = period.points[0].snapshot, last = period.points.at(-1).snapshot;
      $('period-title').textContent = 'Position #' + first.tokenId + ' · ' + periodDuration(last.block.timestamp - first.block.timestamp);
      $('period-description').textContent = 'Recorded Ethereum WETH/USDC · ' + first.position.fee / 10000 + '% pool · unchanged liquidity and bounds.';
      $('period-window').textContent = utc(first.block.timestamp) + ' → ' + utc(last.block.timestamp);
      buildMilestones(); render();
      const dates = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
        .formatRange(new Date(first.block.timestamp * 1000), new Date(last.block.timestamp * 1000));
      $('period-status').textContent = (invalid ? 'That case is unavailable. Showing the baseline. ' : '') + dates + ' · ' + period.points.length + ' checkpoints · independently checked fees';
      $('period-export').disabled = false; $('period-apply').disabled = false;
      // Loading reveals a much taller panel; resolve deep-link scrolling afterward.
      requestAnimationFrame(() => {
        if (currentRevision === revision && isReplayHash(location.hash)) $('historical-case').scrollIntoView({ block: 'start', behavior: 'instant' });
      });
    } catch (error) {
      if (currentRevision !== revision) return;
      $('period-status').textContent = error.message; $('period-retry').hidden = false;
    } finally {
      if (currentRevision === revision) $('historical-case').setAttribute('aria-busy', 'false');
    }
  }
  $('period-case').addEventListener('change', () => {
    const item = REPLAY_CASES.find(item => item.id === $('period-case').value);
    if (location.hash === item.hash) load(item); else location.hash = item.hash;
  });
  $('period-retry').addEventListener('click', () => load(selected));
  $('period-checkpoint').addEventListener('input', () => selectCheckpoint(Number($('period-checkpoint').value)));
  $('period-export').addEventListener('click', () => {
    if (period) downloadBlob(new Blob([JSON.stringify(period, null, 2) + '\n'], { type: 'application/json' }), 'passiko-' + period.id + '-' + period.points[0].snapshot.block.number + '-' + period.points.at(-1).snapshot.block.number + '-historical-case.json');
  });
  $('period-apply').addEventListener('click', () => {
    if (!period) return;
    const snapshot = period.points[index].snapshot;
    rangeLab.setScenario(positionScenario(snapshot), 'Position #' + snapshot.tokenId + ' · Ethereum block ' + snapshot.block.number + '. A new principal-only experiment; already collectable tokens remain outside both strategies.', { kind: 'position', snapshot });
  });
  function restoreLocation() {
    if (isReplayHash(location.hash)) load(replayCaseFromHash(location.hash) || REPLAY_CASES[0], !replayCaseFromHash(location.hash));
  }
  window.addEventListener('hashchange', restoreLocation); restoreLocation();
}
