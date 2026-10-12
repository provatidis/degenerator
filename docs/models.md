# Calculation models

[Project overview](../README.md) · [Product decisions](../DECISIONS.md)

## Concentrated-liquidity range lab

Switch between **Full-range 50/50** and **Concentrated liquidity** without resetting either setup. The lab switch stays available while exploring a calculator. On mobile, budget/range inputs collapse into an editable summary; results and the price explorer remain visible, with sharing controls alongside the results. The new range lab chooses lower/upper ETH prices, computes the required starting token mix for a fixed investment, and compares:

- Holding those exact starting range tokens.
- A separate full-range 50/50 LP position funded with the same budget.
- The concentrated range position.

An asymmetric range, or an out-of-range starting price, can require a mix other than 50/50. Range IL and break-even fees therefore use the range's own initial tokens as the holding benchmark. The full-range comparison displays its separate 50/50 holding benchmark. These are equal-budget strategy comparisons, with each starting composition visible.

Tight (±5%), Moderate (±10%) and Wide (±50%) presets center a range on the starting price. The future price input, keyboard-accessible slider, chart selection, exact boundary checkpoints and comparison rows all update the same scenario. The slider's domain stays stable while dragging. Allocation bars show how the position moves between ETH and USDC; below the range it is all ETH, and above it all USDC. Exact edges receive distinct labels.

Each LP strategy has its own optional total cash fee assumption. Fees remain fixed across displayed prices and never compound or alter token quantities. Being out of range at the final price does not imply the position earned no fees earlier; this endpoint model does not reconstruct a trading path or estimate fee income.

### Model cl-range-v1

Price p is USD per ETH, assuming USDC = $1. For bounds a < b, let c = clamp(p, a, b). For liquidity L:

~~~text
ETH(c)  = L × (1 / sqrt(c) − 1 / sqrt(b))
USDC(c) = L × (sqrt(c) − sqrt(a))
L       = investment / (ETH_per_unit_L(start) × start + USDC_per_unit_L(start))
~~~

The implementation rationalizes square-root differences to retain precision for narrow ranges. Starting prices outside the range are supported and fund the position with a single token. This is a continuous human-unit model: it does not apply tick spacing, Q96 arithmetic, token-unit rounding, gas, incentives or automatic rebalancing. It must not be presented as an exact quote for a deployed Uniswap position.

The model follows the holdings relationships in [Uniswap's math primer](https://blog.uniswap.org/uniswap-v3-math-primer-2) and [v3 whitepaper](https://app.uniswap.org/whitepaper-v3.pdf). A hand-solvable reference uses investment $5,000, starting price $4, and range $1–$9: initial assets are 500 ETH and 3,000 USDC. At $9 the range holds 6,000 USDC, versus $7,500 from holding its initial tokens. Before-fee range IL is −20% and $1,500 of assumed fees closes that gap. The separate full-range LP is worth $7,500; its own 50/50 holding benchmark is $8,125.

Shared links use the versioned cl-range-v1 fragment and all seven inputs (investment, starting/future/lower/upper prices, range fees and full-range fees). They select the correct lab while leaving saved swap balances and the other lab's setup alone. CSV includes both distinct holding benchmarks and exact numeric inputs. A 1200×900 PNG result card includes the range, starting mix, separate fee assumptions and three outcomes. Editing inputs invalidates a previous card.

**Use in range lab** seeds the theoretical setup with the existing v2 snapshot's reserve ratio, a fresh range and zero fee assumptions. It does not import a real v3 position. The v3 snapshot source imports an actual position and its tick-derived range separately. The verified historical replay is a separate, fixed-position analysis of recorded checkpoints; it is not an extension of this hypothetical range model.

## Verified historical replay

The [recorded case](replay.md) follows one existing Uniswap v3 position with unchanged liquidity and tick bounds through nine snapshots spanning 4,992 seconds. At each checkpoint, principal is recalculated from recorded position and pool state; period fees use cumulative inside-range fee growth from the first checkpoint, and time in range uses the cumulative seconds-inside counter. The record checks position continuity and compares each checkpoint's fee growth with independent read-only `collect` simulations.

This is verified accounting for one fixed on-chain position and period. It is distinct from both hypothetical endpoint models in this document and a single-block position snapshot. It does not model arbitrary hypothetical ranges, recover every price between samples, reconstruct mint deposits or calculate lifetime profit.

## Liquidity scenario lab

Enter an initial investment, starting ETH price, future ETH price, and an optional total dollar amount of fee income earned by the position. Results include:

- Final dollar values and returns for holding versus providing liquidity.
- The ETH and USDC owned by each strategy at the future price.
- Impermanent loss before fees, the net difference after assumed fees, and fees needed to match holding.
- A price-range chart and comparison rows with the same investment and assumed fees.

The default example invests $5,000 at $2,000/ETH, then values the position at $4,000/ETH with $100 in assumed fees. Holding ends at $7,500; liquidity holds 0.883883 ETH and 3,535.53 USDC, worth $7,071.07 before fees or $7,171.07 including the assumed cash income. $428.93 in total fees would match holding.

**Copy scenario link** creates a URL fragment containing only the four assumptions and model version (`cp50-v1`). Opening it restores the same scenario without changing the visitor's saved swap balances or activity. Clipboard failures show a selectable link for manual copying. Invalid or unsupported links show a message and use the default scenario. Editing a shared scenario does not change the original URL; copy a new link to share the edited assumptions. Ordinary visits use the default scenario.

**Export CSV** downloads the comparison rows with the inputs, model version, token balances, dollar outcomes, before-fee impermanent loss, and break-even fee income. **Reset scenario** restores the calculator's defaults; **Reset sandbox** separately clears the virtual swap session.

### Model cp50-v1

The calculator models a full-range constant-product position with equal initial dollar allocations and USDC fixed at $1. Ideal, frictionless arbitrage rebalances the pool to the supplied future ETH market price, preserving the position's token product before fees. It describes endpoint balances, not a transaction path or a specific deployed protocol.

For investment V, starting ETH price P0, and ratio r = P1/P0:

```text
initial ETH     = V / (2 × P0)
initial USDC    = V / 2
final LP ETH    = initial ETH / sqrt(r)
final LP USDC   = initial USDC × sqrt(r)
holding value   = V × (1 + r) / 2
LP before fees  = V × sqrt(r)
LP with fees    = LP before fees + assumed fee income
IL before fees  = (LP before fees / holding value − 1) × 100%
break-even fees = holding value − LP before fees
```

Fee income is an explicit assumption added as separate USD cash at the end; it does not compound or change the token amounts. It is held fixed across comparison rows and chart prices. The calculator does not estimate fees from volume, volatility, pool share, or a time horizon. Gas costs, incentives, depegging, and concentrated liquidity are excluded. These are hypothetical outcomes, not forecasts. Reference tests cover unchanged, falling, doubled, and quadrupled prices, asset-product preservation, fee break-even, input bounds, versioned links, and CSV output. The separate pool adapter validates recorded swap arithmetic against its supported protocol; this theoretical endpoint LP model is not a protocol-specific return forecast.

## Model and limitations

The starting pool holds 100 ETH and 200,000 USDC. Your virtual wallet starts with 10 ETH and 20,000 USDC. Exact-input swaps use `output = reserveOut × (input × 0.997) / (reserveIn + input × 0.997)`. The 0.3% input fee stays in the pool, so the reserve product grows with trades. Price impact excludes this fee and compares execution against the fee-adjusted pre-trade spot quote.

Liquidity deposits match the pool ratio; LP tokens represent proportional ownership. Portfolio and pool values use a fixed $2,000 ETH reference price. The pool exchange rate changes with trades. The curve axes rescale with reserves.

The impermanent-loss calculator is a separate hypothetical 50/50 pool, assumes arbitrage after a market-price change, and excludes trading fees. It does not change the active simulation. Slippage tolerance protects the displayed quote, though this single-user simulator has no external trades or transaction delays.

Pool reserves, virtual wallet balances, and the latest 50 activity entries are saved in this browser's `localStorage` after successful transactions. The total action count is retained. Refreshing or reopening the site restores the saved sandbox; Reset sandbox removes it and restores the starting balances. Form inputs and the independent impermanent-loss slider start at their defaults on reload.

Saved data is versioned and validated before use. Invalid or incompatible sessions fall back to the starting sandbox. If browser storage is unavailable or full, the app remains usable and displays a notice that changes may not survive refresh. Storage is specific to this browser and site; it does not sync across devices. Open tabs keep their own in-memory state, and the last successful save wins. Clearing browser data removes the saved session. No credentials or real assets are stored.

Calculations use JavaScript floating-point numbers for learning, not production financial accounting. Pool snapshots read existing contracts through a public provider. There are no real-fund transactions, user accounts, or investment recommendations.

