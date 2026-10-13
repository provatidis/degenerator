# Historical cases: fixed positions

[In-range baseline](https://provatidis.github.io/passiko/#historical-case) · [Exit and return](https://provatidis.github.io/passiko/#historical-case=range-return) · [Project overview](../README.md)

The recorded cases follow unchanged Ethereum Uniswap v3 WETH/USDC positions in the 0.3% pool. Each retains validated snapshots, cumulative range-time counters and independent read-only collection checks. They are fixed-position replays, not arbitrary-range backtests.

| Case | Position | Block window | Checkpoints | Elapsed time | Time in range |
| --- | --- | --- | --- | --- | --- |
| 01 · Stays in range | #1382030 | 26168526–26168941 | 9 | 4,992 seconds | 4,992 seconds · 100% |
| 02 · Exit and return | #1375047 | 26080000–26090000 | 17 | 120,468 seconds | 50,256 seconds · 41.7% |

## In-range baseline

The first replay shipped in 1.8.0. Its 415-block period on 11 October 2026 lasts **4,992 seconds** (83 minutes and 12 seconds). The position stays active throughout. The final conservative period fees are **112674 USDC base units** and **896672855663157 WETH base units**. Subtracting the simulated collect balances gives one additional base unit of each token because accounting checkpoints floor separately.

The original [record](../public/examples/uniswap-v3-position-period.json) remains unchanged. Its historical state came from dRPC and its independent event queries from PublicNode.

## Exit and return

Release 1.9.0 adds [position #1375047](../public/examples/uniswap-v3-position-range-return.json) from **29 September 2026, 02:01:23 UTC** to **30 September 2026, 11:29:11 UTC**. Its 10,000-block period lasts **120,468 seconds** (33 hours, 27 minutes and 48 seconds), with **50,256 seconds in range** and **70,212 outside**. Liquidity remains 350853357174328, with raw tick bounds 197400–203880, throughout the verified period.

The starting principal is **4982691068 USDC base units** and **14920139441099507 WETH base units**. The final conservative period fees are **274940 USDC base units** and **65624095827826 WETH base units**. Independent collect differences are 274941 and 65624095827826 respectively: a one-base-unit USDC difference and an exact WETH match. Historical state came from dRPC; MEV Blocker supplied complete event queries and independent endpoint block-identity checks.

The first outside sample is block 26081250. Several following intervals add no active seconds and no fee tokens. Between blocks **26084375 and 26085000**, both sampled endpoints are outside, but cumulative counters record **2,724 active seconds** and new fee tokens. The first subsequent in-range sample is block **26086875**. The final checkpoint is outside again.

These facts explain why an endpoint status or sampled price line cannot establish the whole path. **Outside sample** and **Return sample** identify recorded checkpoints, not exact crossing times. **Between samples** opens the interval with activity omitted by the price line. The position's lower USD price bound is far below these prices, so the chart focuses on the observed movement and explicitly identifies that bound as outside the plotted window.

## Learn from these records

The [Fees, time and range exits chapter](https://provatidis.github.io/passiko/learn.html#applied=fees-over-time) uses these unchanged records for three guided prediction-and-explanation exercises. Assessment targets come from the existing period accounting: final baseline fee value, the exit-and-return case’s 2,724 active seconds between blocks 26084375–26085000, and its final LP-minus-holding result before costs. Checkpoint exploration stays independent of the fixed question. Playground handoffs start a separate principal-only hypothetical experiment with zero assumed future fees.

## Calculations and checks

- Principal is recomputed from unchanged NFT liquidity and tick bounds at each recorded Q96 price.
- Holding preserves the first checkpoint's exact principal token amounts. Previously accrued fees and recorded owed balances are excluded from both starting strategies.
- Period fees are `floor(L × (insideGrowthNow − insideGrowthStart) / 2^128)`, with uint256 growth wrapping. Each earned token remains separate and is valued at the selected pool ratio; fees are not assumed USD cash or compounded.
- Interval fee tokens are differences of cumulative period credits. Summing separately floored intervals would lose rounding carries. Their sum exactly preserves the final period credits. Interval dollar values use the selected checkpoint price, not the unknown prices of individual fee-earning swaps.
- Time in range is the uint32 difference of `snapshotCumulativesInside().secondsInside`. Time outside is elapsed time minus that difference. Adjacent increments must fit their elapsed intervals; a plausible total cannot hide an impossible interval. Cumulative fee credits must not decrease.
- Active seconds and fee tokens measure different things. A zero active-second increment alone does not prove zero fees: swaps can enter and leave a range within one block. The observed zero-fee intervals above are established by both counters and fee growth.
- Every checkpoint retains the same position accounting with positive liquidity. Complete, contiguous manager event queries from start + 1 through end return no events indexing this NFT ID. IncreaseLiquidity, DecreaseLiquidity and Collect all index the ID first. This establishes position continuity under the event provider's history.
- Independent read-only `collect` simulations at every checkpoint agree with cumulative period fees within one base unit per token. The state and event providers' endpoint block numbers, hashes and timestamps agree before and after event queries. Every checkpoint's state-provider block is rechecked.

The price line connects recorded samples; it does not recover every intra-block or intra-sample price. Fee and range-time correctness comes from cumulative accounting and verified position continuity, not chart resolution.

The result describes this period's principal and earned fee tokens relative to holding. It excludes gas and incentives, assumes USDC = $1, uses the pool price for valuation and does not reconstruct mint deposits or lifetime PnL. Dollar values are rounded separately; differences use unrounded values. LVR would require its own external-price rebalancing benchmark and is not added as a second deduction from the holding comparison.

## Reproduce the capture

```sh
# Baseline: nine checkpoints by default.
npm run check:replay
node scripts/check-replay.js 1382030 26168526 26168941 public/examples/uniswap-v3-position-period.json

# Longer case: the optional final argument chooses 17 checkpoints.
node scripts/check-replay.js 1375047 26080000 26090000 public/examples/uniswap-v3-position-range-return.json 17
```

The development script makes read-only calls, paces provider requests and retries temporary limits. It supports 2–32 checkpoints over at most 10,000 blocks. It rejects changed positions, incomplete event queries, invalid counters, non-finalized endpoints and fee discrepancies, then validates the complete record before writing it. `REPLAY_RPC` and `REPLAY_LOG_RPC` select public HTTPS providers; current defaults are dRPC for state and MEV Blocker for events. Public archive availability and request limits vary. No wallet, transaction or scheduled collector is involved.

The browser opens the bundled cases without RPC calls. Export includes all checkpoint snapshots, block hashes, raw counters, simulation results and event query coverage. File validation checks arithmetic and evidence consistency; it cannot independently authenticate a provider's chain history. Applying a checkpoint starts a new hypothetical principal-only range experiment with zero assumed future fees, rather than continuing the recorded history.

Source references: [Uniswap range counters](https://github.com/Uniswap/v3-core/blob/main/contracts/interfaces/pool/IUniswapV3PoolDerivedState.sol), [fee-growth rules](https://github.com/Uniswap/v3-core/blob/main/contracts/libraries/Tick.sol), [NFT accounting events](https://github.com/Uniswap/v3-periphery/blob/main/contracts/interfaces/INonfungiblePositionManager.sol).

## Next validation cases

Compare two existing ranges over the same period in the ETH/USDC 0.05% pool, retaining each position's starting basket and verification evidence. Arbitrary hypothetical bounds need historical tick/swap reconstruction and an explicit assumption about the effect of adding liquidity. Hourly pool price and global fee growth alone do not establish their fee allocation.
