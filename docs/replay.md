# Historical case: a fixed position

[Open the recorded case](https://provatidis.github.io/degenerator/#historical-case) · [Project overview](../README.md)

The first replay follows Ethereum Uniswap v3 WETH/USDC position #1382030 in the 0.3% pool from block **26168526** to **26168941** on 11 October 2026. Its 415-block period lasts **4,992 seconds** (83 minutes and 12 seconds). Nine checkpoints preserve full validated position snapshots, cumulative range-time counters and read-only collection simulation results.

This deliberately uses the already audited position before extending the method to the proposed 0.05% pool, longer windows or editable ranges. It is a recorded fixed-position case, not an arbitrary-range backtester.

## Calculations and checks

- Principal is recomputed from the NFT’s unchanged liquidity and tick bounds at each recorded Q96 price.
- Holding preserves the exact principal token amounts at the first checkpoint. Previously accrued fees and recorded owed balances are excluded from both starting strategies.
- Period fees are `floor(L × (insideGrowthNow − insideGrowthStart) / 2^128)`, with uint256 growth wrapping. Each earned token stays separate and is valued at the selected pool ratio; fees are not assumed USD cash or compounded.
- Time in range is the uint32 difference of `snapshotCumulativesInside().secondsInside`. This includes activity between checkpoint reads. It is not inferred from the sampled price line.
- Every checkpoint retains the same position accounting, with positive liquidity. Complete, contiguous manager event queries from start + 1 through end return no events indexing this NFT ID. IncreaseLiquidity, DecreaseLiquidity and Collect all index the ID first. This rules out liquidity or accounting updates during the recorded period under the provider’s event history.
- Independent read-only `collect` simulations at every checkpoint agree with cumulative period fees within one base unit per token. The final conservative fees are **112674 USDC base units** and **896672855663157 WETH base units**. Subtracting the simulated collect balances gives one additional base unit of each token because checkpoint accounting floors separately.
- Historical state is read through dRPC. PublicNode supplies the independent event query; both providers’ endpoint block numbers, hashes and timestamps must agree before and after querying events. Every checkpoint’s state-provider block is rechecked.

The range stayed active for all 4,992 recorded seconds. Its displayed price path connects only nine samples; it does not recover every intra-block or intra-sample price. Fee and range-time correctness comes from cumulative accounting and verified position continuity, not chart resolution.

The result describes this period’s principal and earned fee tokens relative to holding. It excludes gas and incentives, assumes USDC = $1, uses the pool price for valuation, and does not reconstruct mint deposits or lifetime PnL. LVR would require its own external-price rebalancing benchmark; it is not added as a second deduction from the holding comparison.

## Reproduce the capture

```sh
npm run check:replay
node scripts/check-replay.js 1382030 26168526 26168941 public/examples/uniswap-v3-position-period.json
```

The development script makes read-only calls, paces provider requests and retries temporary limits. It rejects changed positions, incomplete event queries, invalid counters, non-finalized endpoints and fee discrepancies before writing the requested file. `REPLAY_RPC` and `REPLAY_LOG_RPC` can select public HTTPS providers for development. No wallet, transaction or scheduled collector is involved.

The exported record includes all checkpoint snapshots, block hashes, raw counters, simulation results and event query coverage. File validation verifies internal arithmetic and evidence consistency; it cannot independently authenticate a provider’s chain history.

Source references: [Uniswap range counters](https://github.com/Uniswap/v3-core/blob/main/contracts/interfaces/pool/IUniswapV3PoolDerivedState.sol), [fee-growth rules](https://github.com/Uniswap/v3-core/blob/main/contracts/libraries/Tick.sol), [NFT accounting events](https://github.com/Uniswap/v3-periphery/blob/main/contracts/interfaces/INonfungiblePositionManager.sol).

## Next validation cases

Extend to a longer period with exits and re-entry, then compare two existing ranges in the ETH/USDC 0.05% pool. Arbitrary hypothetical bounds need historical tick/swap reconstruction and an explicit assumption about the effect of adding liquidity. Hourly pool price and global fee growth alone do not establish their fee allocation.
