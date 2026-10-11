import { calculateScenario } from '../models/cp50-v1.js';
import { scenarioHash } from '../lib/scenario-links.js';
import { rangeHash } from '../lib/range-links.js';

export const EXAMPLE_STAGES = Object.freeze([
  { level: 1, title: 'Foundations', detail: 'Start with one mechanism at a time.', lessons: ['swap-impact', 'pool-share'] },
  { level: 2, title: 'Comparisons', detail: 'Add price changes, a holding benchmark and fees.', lessons: ['token-balances', 'loss-vs-profit', 'fee-break-even'] },
  { level: 3, title: 'Ranges', detail: 'Add price bounds and follow the token mix.', lessons: ['range-boundaries'] },
  { level: 4, title: 'Applied cases', detail: 'Combine assumptions or inspect recorded chain data.', lessons: ['final-challenge'] },
]);
export const stageForLesson = id => EXAMPLE_STAGES.find(stage => stage.lessons.includes(id));

const baseline = { investment: 5000, initialPrice: 2000, futurePrice: 2000, fees: 0 };
const doubled = { ...baseline, futurePrice: 4000 };
const range = { ...baseline, lowerPrice: 1800, upperPrice: 2200, futurePrice: 2100, fullRangeFees: 0 };
export const PLAYGROUND_EXAMPLES = Object.freeze([
  { id: 'unchanged', level: 1, title: 'Price unchanged', detail: 'Start with $5,000 at $2,000 per ETH. With no price change or fees, compare the same starting tokens.', focus: 'Baseline', href: scenarioHash(baseline) },
  { id: 'price-doubles', level: 2, title: 'ETH price doubles', detail: 'Keep the starting budget and zero fees. Change only the future price and follow the rebalancing.', focus: 'Adds a price change', href: scenarioHash(doubled) },
  { id: 'fee-target', level: 2, title: 'Fees match holding', detail: 'Keep the same price move. Add the total cash fees needed to close the gap with holding.', focus: 'Adds assumed fees', href: scenarioHash({ ...doubled, fees: calculateScenario(doubled).breakEvenFees }) },
  { id: 'range-inside', level: 3, title: 'Inside a price range', detail: 'Use the same starting budget and price, with a $1,800–$2,200 range. Move ETH to $2,100 and compare token mixes.', focus: 'Adds price bounds', href: rangeHash(range) },
  { id: 'range-boundary', level: 3, title: 'At the upper price boundary', detail: 'Keep the range and move ETH to $2,200. See why the position becomes entirely USDC at this boundary.', focus: 'Adds a boundary case', href: rangeHash({ ...range, futurePrice: 2200 }) },
  { id: 'in-range-position', level: 4, title: 'A recorded in-range position', detail: 'Inspect position #1382030: both tokens, a narrow range and exact amounts at Ethereum block 26168526. Then apply it to a new experiment.', focus: 'Adds ticks and recorded data', href: '#example=in-range-position', recorded: 'inside' },
  { id: 'out-of-range-position', level: 4, title: 'A recorded out-of-range position', detail: 'Inspect position #37 below its ETH-price range at block 26162627. It holds only WETH; compare its contract state with the boundary example.', focus: 'Adds an out-of-range case', href: '#example=out-of-range-position', recorded: 'outside' },
  { id: 'position-fees', level: 4, title: 'Principal, fees and tokens owed', detail: 'Use a later snapshot of position #1382030 at block 26168941. Reproduce its fee calculation, separate collectable tokens from principal, and start a new holding comparison.', focus: 'Adds fee accounting', href: '#example=position-fees', recorded: 'fees' },
  { id: 'historical-case', level: 4, title: 'Fees through a recorded period', detail: 'Keep the same position and follow nine checkpoints over 83 minutes. Compare calculated period fees, time in range and holding the starting principal tokens.', focus: 'Adds a time period', href: '#historical-case' },
]);
