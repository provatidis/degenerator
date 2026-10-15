import { MODEL as FULL_MODEL, calculateScenario } from '../models/cp50-v1.js';
import { calculateRange } from '../models/cl-range-v1.js';
import { scenarioHash } from './scenario-links.js';
import { rangeHash } from './range-links.js';
import { fmt, usd } from './format.js';

export const experimentModelName = model => model === FULL_MODEL ? 'V2-style full range' : 'V3-style price range';
export function experimentView(entry) {
  const result = entry.model === FULL_MODEL ? calculateScenario(entry.inputs) : calculateRange(entry.inputs);
  return { result, initial: result.held ?? result.initial,
    hash: entry.model === FULL_MODEL ? scenarioHash(entry.inputs) : rangeHash(entry.inputs),
    modelName: experimentModelName(entry.model) };
}
export function defaultExperimentName(draft) {
  const { result } = experimentView(draft);
  if (draft.origin?.kind === 'position') {
    const id = draft.origin.snapshot.tokenId;
    return 'Position #' + (id.length > 24 ? id.slice(0,18) + '…' + id.slice(-6) : id) + ' · range experiment';
  }
  if (draft.model === FULL_MODEL) return 'ETH ' + usd(result.initialPrice) + ' → ' + usd(result.futurePrice) + ' · fees ' + usd(result.fees);
  return 'Range ' + usd(result.lowerPrice) + '–' + usd(result.upperPrice) + ' · ETH → ' + usd(result.futurePrice);
}
export function experimentOriginLabel(origin, model) {
  if (!origin) return '';
  const snapshot = origin.snapshot;
  if (origin.kind === 'position') return 'Starting principal and range from Uniswap v3 position #' + snapshot.tokenId + ' at Ethereum block ' + snapshot.block.number + '. Already collectable tokens stay outside both strategies; future prices use the continuous range model. This saved source has not been refreshed.';
  return 'Starting price from a saved Uniswap v2 WETH/USDC snapshot at Ethereum block ' + snapshot.block.number + '. USDC = $1; this pool ratio seeds ' + (model === FULL_MODEL ? 'a hypothetical full-range position' : 'a hypothetical range position') + '. This saved source has not been refreshed.';
}
export const startingAssets = initial => fmt(initial.eth, 6) + ' ETH + ' + fmt(initial.usdc) + ' USDC';
export function comparisonContext(entries) {
  if (entries.length < 2) return '';
  const views = entries.map(experimentView), first = views[0];
  const close = (a, b) => Math.abs(a - b) <= Math.max(1, Math.abs(a), Math.abs(b)) * 1e-12;
  const sameStart = views.every(view => view.result.investment === first.result.investment
    && view.result.initialPrice === first.result.initialPrice
    && close(view.initial.eth, first.initial.eth) && close(view.initial.usdc, first.initial.usdc));
  const sameFuture = views.every(view => view.result.futurePrice === first.result.futurePrice);
  if (!sameStart) return 'These experiments start with different budgets, prices or token mixes. Each LP outcome is compared with holding its own starting tokens; this is not a ranking of equivalent investments.';
  if (!sameFuture) return 'These experiments start with the same token basket but assume different future prices. Read them as different price scenarios, rather than a ranking at one market price.';
  return 'These experiments share the same starting token basket and future ETH price (' + usd(first.result.futurePrice) + '). Differences in LP outcomes follow from the saved models, ranges and assumed cash fees.';
}
