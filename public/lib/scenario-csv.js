import { MODEL, comparisonScenarios } from '../models/cp50-v1.js';

export function scenarioCSV(input) {
  const headers = ['model', 'investment_usd', 'initial_eth_price_usd', 'future_eth_price_usd', 'assumed_position_fees_usd', 'held_eth', 'held_usdc', 'lp_eth', 'lp_usdc', 'hold_value_usd', 'lp_before_fees_usd', 'lp_with_fees_usd', 'lp_minus_hold_usd', 'lp_minus_hold_percent', 'impermanent_loss_percent', 'break_even_fees_usd'];
  const rows = comparisonScenarios(input).map((r) => [MODEL, r.investment, r.initialPrice, r.futurePrice, r.fees, r.held.eth, r.held.usdc, r.pooled.eth, r.pooled.usdc, r.holdValue, r.lpBeforeFees, r.lpValue, r.difference, r.differencePercent, r.impermanentLoss, r.breakEvenFees]);
  return [headers, ...rows].map((row) => row.join(',')).join('\r\n') + '\r\n';
}
