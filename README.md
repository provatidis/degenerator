# Degenerator

Your DeFi playground. Degenerator is a browser-based lab for reproducible liquidity scenarios and virtual pool experiments. Compare holding with a 50/50 ETH/USDC position, share your assumptions, export results, and explore swaps without connecting a wallet.

## Pool snapshots

The pool lab reads one supported deployment: Ethereum mainnet Uniswap v2 WETH/USDC. **Fetch latest snapshot** contacts [PublicNode](https://ethereum.publicnode.com/) and reads a finalized block. Every contract read uses that block number, and the block hash is checked again before accepting the result.

The adapter verifies the canonical factory's pair, the pair's factory/token order, and USDC/WETH decimals. It preserves integer reserves and compares an exact integer 1 WETH quote against the supported Uniswap v2 router at the same block. This is a recorded quote, not an executable current trade. The 0.3% swap fee is separate from assumed position fee income.

Snapshots retain their schema version, protocol, chain, pool/factory, block number/hash/timestamp, token addresses/order/decimals, raw reserves, fee formula, router quote, capture time, and provider. **Export snapshot** saves JSON; **Open snapshot file** restores it locally. Files are limited to 64 KB and validated before use. File validation checks structure and internal arithmetic; it cannot authenticate supplied chain data. Saved and imported files are labelled as not rechecked. **Load recorded example** opens a bundled snapshot from a completed contract check.

Loading never changes the calculator or swap wallet automatically. **Use in 50/50 lab** explicitly applies the WETH/USDC reserve ratio, assuming USDC = $1, to the theoretical cp50-v1 lab. It retains the investment, sets the future price to 2x and assumed cash fees to zero. The reserve ratio is not an oracle or a general market-price feed. Scenario links continue to share only model assumptions; export the snapshot separately to retain chain provenance.

Only the latest snapshot is saved under the degenerator-pool-snapshot-v1 key, separate from the existing sandbox storage. Unavailable storage and failed providers leave loaded data usable. No RPC credentials or wallet are required. Adding arbitrary pools, chains, or concentrated-liquidity contracts requires another explicitly supported and validated adapter.

For a manual live integration check:

~~~sh
npm run check:pool
~~~

To capture a new bundled example:

~~~sh
node scripts/check-pool.js public/examples/uniswap-v2-mainnet.json
~~~

The integer quote formula follows the [Uniswap v2 periphery library](https://github.com/Uniswap/v2-periphery/blob/master/contracts/libraries/UniswapV2Library.sol), with deployments documented by [Uniswap](https://developers.uniswap.org/docs/protocols/v2/deployments).

## Guided experiments and result cards

The Pump and The Dump keep the current investment/starting price, set ETH to 2x or 0.5x, and clear assumed fees. The Harvest sets assumed fee income to the break-even amount for the current future price; it does not estimate yield.

**Create result card** previews a downloadable 1200x720 PNG with the four assumptions, model version, holding/LP outcomes, before-fee IL, break-even fees, and model limitations. Input changes invalidate the preview so a card cannot silently describe an older scenario.

## Concentrated-liquidity range lab

Switch between **Full-range 50/50** and **Concentrated liquidity** without resetting either setup. The lab switch stays available while exploring a calculator. On mobile, budget/range inputs collapse into an editable summary; results and the price explorer remain visible, with sharing controls alongside the results. The new range lab chooses lower/upper ETH prices, computes the required starting token mix for a fixed investment, and compares:

- Holding those exact starting range tokens.
- A separate full-range 50/50 LP position funded with the same budget.
- The concentrated range position.

An asymmetric range, or an out-of-range starting price, can require a mix other than 50/50. Range IL and break-even fees therefore use the range's own initial tokens as the holding benchmark. The full-range comparison displays its separate 50/50 holding benchmark. These are equal-budget strategy comparisons, with each starting composition visible.

Tight (±5%), Balanced (±10%) and Wide (±50%) presets center a range on the starting price. The future price input, keyboard-accessible slider, chart selection, exact boundary checkpoints and comparison rows all update the same scenario. The slider's domain stays stable while dragging. Allocation bars show how the position moves between ETH and USDC; below the range it is all ETH, and above it all USDC. Exact edges receive distinct labels.

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

**Use in range lab** seeds the theoretical setup with the existing v2 snapshot's reserve ratio, a fresh range and zero fee assumptions. It does not import a real v3 position. Named historical positions, tick-aligned ranges and historical replay are future work.

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

## Online preview with GitHub Pages

The workflow in `.github/workflows/pages.yml` tests the project and publishes only `public/` whenever `main` changes. It also runs tests on pull requests without publishing them. No hosting credentials or backend server are needed.

Enable it once in the repository's **Settings → Pages → Build and deployment → Source → GitHub Actions**. If the first workflow run happened before Pages was enabled, open **Actions → Test and publish Degenerator → Run workflow** and select `main`.

After a successful deployment, the preview is available at https://provatidis.github.io/degenerator/. Subsequent pushes to `main` update the same address. Repository settings and the GitHub plan must permit Pages publishing.

### Existing clones and shared scenarios

The repository was renamed from `GPTCloudTest` to `degenerator`. Update existing clones with:

```sh
git remote set-url origin https://github.com/provatidis/degenerator.git
```

GitHub redirects old repository links, but does not automatically redirect the old Pages site. For a previously shared scenario, replace `/GPTCloudTest/` in the URL with `/degenerator/` and retain the entire `#scenario=...` fragment. Asset and home links are relative, and new scenario links use the current site address.

The browser-storage key remains `defi-sandbox-v1`, preserving saved sandbox sessions on the same `provatidis.github.io` origin. A different origin, including a custom domain, has separate browser storage. Existing local checkout directories can keep their names. If a cloud checkout directory is renamed, update its working-directory and startup configuration to the actual path.

## Run

Requires Node.js 22 or newer. No dependencies or installation step are needed.

```sh
git clone https://github.com/provatidis/degenerator.git
cd degenerator
npm start
```

For an existing clone, pull the latest `main` and run `npm start` from its checkout directory. No installation step is needed.

The HTTP server defaults to loopback port 3000. Set `HOST` and `PORT` to change its binding. It serves only the `public/` directory. To verify it:

```sh
curl --fail http://127.0.0.1:3000/
```

Open http://127.0.0.1:3000/ in your browser. No wallet, API key, network connection, or blockchain node is required to run the app locally.

## Test

```sh
npm test
```

Tests cover swap pricing, reserve conservation, fees, stale-quote rejection, balance validation, liquidity accounting, withdrawals, storage restoration and failures, plus the scenario model, versioned links, and CSV exports.

For an optional browser smoke test, install Chromium or set `CHROMIUM_BIN` to its executable, then run `npm run test:browser`. It starts temporary servers and checks actual page interactions at desktop and mobile sizes, including calculator results, copied links, CSV downloads, shared-link restoration, and persistence. The cloud container uses Chromium with its browser sandbox disabled for this local test; the app itself needs no browser installation to serve its files.

Set `TEST_BASE_URL` to a deployed site or a local server with a project subpath to test that target instead of starting the Node server. The browser smoke test checks that the home link, scripts, styles, and swaps work at that base URL.

## Experiments

- Compare 1 ETH and 5 ETH swaps to see how trade size changes price impact.
- Change future prices and assumed fees in the liquidity scenario lab, then share a scenario link or export its comparison.
- Reverse the swap direction to trade USDC for ETH.
- Deposit matching ETH and USDC to receive LP tokens, then make a swap and withdraw your pool share.
- Move the impermanent-loss slider to compare liquidity provision with holding the initial assets.
- Reset to restore the initial pool and virtual wallet.

## Model and limitations

The starting pool holds 100 ETH and 200,000 USDC. Your virtual wallet starts with 10 ETH and 20,000 USDC. Exact-input swaps use `output = reserveOut × (input × 0.997) / (reserveIn + input × 0.997)`. The 0.3% input fee stays in the pool, so the reserve product grows with trades. Price impact excludes this fee and compares execution against the fee-adjusted pre-trade spot quote.

Liquidity deposits match the pool ratio; LP tokens represent proportional ownership. Portfolio and pool values use a fixed $2,000 ETH reference price. The pool exchange rate changes with trades. The curve axes rescale with reserves.

The impermanent-loss calculator is a separate hypothetical 50/50 pool, assumes arbitrage after a market-price change, and excludes trading fees. It does not change the active simulation. Slippage tolerance protects the displayed quote, though this single-user simulator has no external trades or transaction delays.

Pool reserves, virtual wallet balances, and the latest 50 activity entries are saved in this browser's `localStorage` after successful transactions. The total action count is retained. Refreshing or reopening the site restores the saved sandbox; Reset sandbox removes it and restores the starting balances. Form inputs and the independent impermanent-loss slider start at their defaults on reload.

Saved data is versioned and validated before use. Invalid or incompatible sessions fall back to the starting sandbox. If browser storage is unavailable or full, the app remains usable and displays a notice that changes may not survive refresh. Storage is specific to this browser and site; it does not sync across devices. Open tabs keep their own in-memory state, and the last successful save wins. Clearing browser data removes the saved session. No credentials or real assets are stored.

Calculations use JavaScript floating-point numbers for learning, not production financial accounting. Pool snapshots read existing contracts through a public provider. There are no real-fund transactions, user accounts, or investment recommendations.

## Project structure

- `public/amm.js`: pure pool and wallet calculations.
- `public/app.js`: interactions and presentation.
- `public/storage.js`: versioned, validated browser persistence.
- `public/scenario.js`: documented cp50-v1 model, link encoding, and CSV output.
- `public/scenario-app.js`: scenario controls, chart, comparisons, and sharing.
- `public/index.html`, `public/styles.css`: responsive interface.
- `server.js`: dependency-free static HTTP server.
- `test/`: Node calculation, storage, and scenario suites.

## Architecture and extension policy

The static app remains dependency-free and deployable on GitHub Pages. Calculation models, transport/adapters, versioned persistence, exports and DOM controllers have separate responsibilities:

- public/models/: pure theoretical scenario calculations, guided experiments, and exact protocol arithmetic.
- public/data/: deployment configuration, read-only RPC transport, the Uniswap v2 adapter, snapshot schemas and storage.
- public/lib/: formatting, compatible scenario links, CSV output, download handling and result-card rendering.
- public/scenario-app.js, public/pool-app.js, public/app.js: interface controllers.
- public/scenario.js: compatibility exports for existing integrations and tests.
- public/examples/: recorded chain fixtures that work without an RPC request.

New financial models get their own versioned module and reference/invariant tests. New protocols get a deployment definition, adapter, exact token-unit handling and contract validation. Preserve old model links and storage keys; introduce explicit migrations when schemas change. Unit and desktop/mobile browser tests run before deployment.

The next milestones are read-only Uniswap v3 position snapshots, named saved experiments, and historical price replay. A backend becomes useful for private provider credentials, shared caching, scheduled snapshots or account synchronization. Each can be added behind the data layer without rewriting the calculation models or existing labs.

The cl-range-v1 model, links, CSV, presentation helpers and result cards are separate modules. A shared link router and accessible lab navigation coordinate the two calculators while preserving cp50-v1 links. Reference tests cover asymmetric funding, outside starts, exact boundaries, continuity, virtual-reserve conservation, wide-range limits, separate fees, numerical bounds and reproducible exports.
