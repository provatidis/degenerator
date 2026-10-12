# Chain reads and snapshots

[Project overview](../README.md) · [Product decisions](../DECISIONS.md)

## Pool snapshots

The pool lab reads one supported deployment: Ethereum mainnet Uniswap v2 WETH/USDC. **Fetch latest snapshot** contacts [PublicNode](https://ethereum.publicnode.com/), with [dRPC](https://drpc.org/docs/ethereum-api) as a backup, and reads a finalized block. Every contract read uses that block number, and the block hash is checked again before accepting the result.

The adapter verifies the canonical factory's pair, the pair's factory/token order, and USDC/WETH decimals. It preserves integer reserves and compares an exact integer 1 WETH quote against the supported Uniswap v2 router at the same block. This is a recorded quote, not an executable current trade. The 0.3% swap fee is separate from assumed position fee income.

Snapshots retain their schema version, protocol, chain, pool/factory, block number/hash/timestamp, token addresses/order/decimals, raw reserves, fee formula, router quote, capture time, and provider. **Export snapshot** saves JSON; **Open snapshot file** restores it locally. Files are limited to 64 KB and validated before use. Provider metadata is preserved independently of the current endpoint. It must be a bounded HTTPS URL without credentials and is never contacted when opening a file. File validation checks structure and internal arithmetic; it cannot authenticate supplied chain data. Saved and imported files are labelled as not rechecked. **Load recorded example** opens a bundled snapshot from a completed contract check.

Loading never changes the calculator or swap wallet automatically. **Use in 50/50 lab** explicitly applies the WETH/USDC reserve ratio, assuming USDC = $1, to the theoretical cp50-v1 lab. It retains the investment, sets the future price to 2x and assumed cash fees to zero. The reserve ratio is not an oracle or a general market-price feed. Scenario links continue to share only model assumptions; export the snapshot separately to retain chain provenance.

Only the latest snapshot is saved under the degenerator-pool-snapshot-v1 key, separate from the existing sandbox storage. Unavailable storage and failed providers leave loaded data usable. Unreadable and unsupported-version saves have distinct recovery messages and remain in storage until explicitly discarded or replaced. Recovery removes only the relevant snapshot key. No RPC credentials or wallet are required. The separate v3 position adapter supports only the deployment documented below. Arbitrary assets and chains require their own explicit deployment definitions and validation.

For a manual live integration check:

~~~sh
npm run check:pool
~~~

To capture a new bundled example:

~~~sh
node scripts/check-pool.js public/examples/uniswap-v2-mainnet.json
~~~

The integer quote formula follows the [Uniswap v2 periphery library](https://github.com/Uniswap/v2-periphery/blob/master/contracts/libraries/UniswapV2Library.sol), with deployments documented by [Uniswap](https://developers.uniswap.org/docs/protocols/v2/deployments).

## Uniswap v3 position snapshots

The snapshot source switch opens either the existing Uniswap v2 pool or a Uniswap v3 position. Enter a position NFT ID for an **Ethereum mainnet WETH/USDC** position in the canonical NonfungiblePositionManager. Supported fee tiers are 0.01%, 0.05%, 0.3% and 1%; other token pairs and chains receive an explicit unsupported message.

The adapter reads a finalized block, verifies the position manager’s factory, asks that factory for the position’s pool, and checks the pool’s factory, token order, fee tier, tick spacing and token decimals. Every contract read uses the captured block number; its number, hash and timestamp are checked again before acceptance. NFT IDs remain decimal strings, including IDs larger than JavaScript’s exact integer range.

Principal is calculated in exact integer token units from position liquidity, canonical Q96 tick ratios and the recorded sqrtPriceX96, rounding down as the v3 liquidity-amount formula does. Tick ratios use the MIT-licensed Uniswap v3 SDK arithmetic, with its notice under public/licenses/. The inverse ratio lookup uses integer binary search. Contract range status uses lower tick inclusive and upper tick exclusive, preserving the valid one-tick difference at an exact zero-for-one boundary.

USDC is token 0 and WETH token 1. Raw ticks therefore quote WETH per USDC; the displayed USD/WETH bounds reverse the raw tick order and account for 6/18 token decimals. Dollar values use the pool ratio and USDC = $1, rather than an external price feed. Active principal excludes recorded tokens owed and fees. Recorded tokens owed may include withdrawn principal and omit fee growth since the last accounting update; they are **not presented as total uncollected fees**.

Position JSON retains schema version/kind, manager/factory/pool, NFT ID, fee tier, ticks, liquidity, stored fee-growth/owed fields, sqrtPriceX96, exact principal, token metadata, block and capture provenance. Opening files validates structure, integer bounds, the canonical pool for the token pair and fee tier, tick/price consistency, principal arithmetic and (in version 2) fee growth and credit arithmetic; it does not authenticate their chain origin. Unknown fields are removed. The latest position uses a separate degenerator-v3-position-snapshot-v1 storage key and does not overwrite pool snapshots or virtual balances.

**Explore this position’s range** explicitly starts a new cl-range-v1 experiment from the snapshot’s position principal value, price and bounds, with zero assumed future fees and an unchanged future price. Already collectable tokens remain separate from both the LP and holding sides of this principal-only comparison. It does not reconstruct the mint deposit or historical return. The captured principal is exact; subsequent lab projections use the existing continuous model. The source label clears when its budget, starting price or range changes. Closed, dust and out-of-limit positions remain inspectable/exportable even when they cannot seed the lab. On mobile a loaded position collapses its refresh/import controls, keeping outcomes within reach.

**In-range example** opens public position #1382030 at block 26168526, with 22046660876 USDC base units and 10283485726696667741 WETH base units, worth about $47,793.97 under the recorded pool ratio and USDC = $1. **Out-of-range example** retains public position #37 from a completed contract check at block 26162627. Its recorded position principal is 0 USDC and 9999999999999133 WETH base units (0.009999999999999133 WETH). This fixture is a repeatable historical snapshot, not current market data.

### V3 fee accounting

New position captures use snapshot version 2 and read both global fee-growth counters and both boundary tick records at the same finalized block as principal. The pure public/models/v3-fees.js model derives inside-range growth using the contract tick, takes the uint256 growth difference from the NFT's last accounting update, and computes floor(liquidity × growth difference / 2^128) in token base units. It reproduces the manager's uint128 credit casts and owed-balance additions, with an explicit capacity-overflow flag. No floating-point arithmetic enters the fee-credit calculation.

**Newly accrued fees**, **recorded tokens owed**, and **estimated collectable tokens** are separate quantities. Recorded owed balances can contain fees and principal removed by decreaseLiquidity, so their composition is not inferred. Estimated collectable tokens are the manager's new fee credits plus recorded owed balances; actual collection can be slightly lower because of core rounding. Dollar values use the recorded pool ratio and USDC = $1. Principal plus the collectable estimate describes current recorded assets, not historical profit or fees since mint.

The fee disclosure is collapsed during ordinary imports. [Applied example 08](https://provatidis.github.io/degenerator/#example=position-fees) opens it directly, with a four-step walkthrough connecting the balance breakdown to a new principal-only holding comparison. Applying a position keeps already collectable tokens outside both strategies and starts with zero assumed future cash fees. Learn links to this example from its fee, range and final-challenge deeper reading. Existing lesson IDs, completion, model schemas and virtual balances remain independent.

Version 1 position files continue to import, save and export unchanged. Their missing fee-growth data is shown as unavailable, never zero. Version 2 requires bounded global/outside growth, correctly initialized boundaries with enough gross liquidity for the NFT, and matching derived raw estimates. The existing storage key is retained to restore both versions; unsupported future versions still require explicit recovery.

The bundled fee snapshot records position #1382030 at Ethereum block **26168941**, hash **0x7b8bdadecbb0b29aa91fd8be0cb2a1e87fef5a4a2c8ec7a3f7162b5668b08183**. Its estimated collectable amounts are **524593 USDC base units** and **2054973037123392 WETH base units**, worth about $5.67 at that snapshot. Both matched an independent read-only manager collection simulation exactly, with no transaction or wallet connection.

To verify a new live capture and optionally record it:

~~~sh
npm run check:fees -- 1382030
node scripts/check-position-fees.js 1382030 public/examples/uniswap-v3-mainnet-fees.json
~~~

The development-only verifier uses eth_call with the NFT owner's public address, checks the block again and reports any discrepancy. It only writes an example when both token estimates match the simulation exactly. The browser adapter uses only view selectors; it never simulates collection or submits a transaction. Public source references: [Uniswap fee-growth primer](https://blog.uniswap.org/uniswap-v3-math-primer-2), [Tick growth rules](https://github.com/Uniswap/v3-core/blob/main/contracts/libraries/Tick.sol), and [position manager accounting](https://github.com/Uniswap/v3-periphery/blob/main/contracts/NonfungiblePositionManager.sol).

For a live read-only integration check:

~~~sh
npm run check:position -- 37
~~~

To record a new example, pass a destination:

~~~sh
node scripts/check-position.js 37 public/examples/uniswap-v3-mainnet-37.json
~~~

Sources: [Ethereum v3 deployments](https://developers.uniswap.org/docs/protocols/v3/deployments/v3-ethereum-deployments), [position manager interface](https://github.com/Uniswap/v3-periphery/blob/main/contracts/interfaces/INonfungiblePositionManager.sol), [holdings math](https://blog.uniswap.org/uniswap-v3-math-primer-2), [tick arithmetic](https://github.com/Uniswap/v3-sdk/blob/main/src/utils/tickMath.ts), and [liquidity amounts](https://github.com/Uniswap/v3-periphery/blob/main/contracts/libraries/LiquidityAmounts.sol).

### Snapshot balances and period earnings

Example 08's collectable balances belong to one recorded block. They are distinct from the fees earned during example 09's bounded historical period. The [shipped historical case](replay.md) uses nine version-2 position snapshots over 4,992 seconds, verifies unchanged position accounting with complete event queries, and independently checks fee-growth differences against read-only collection simulations. It excludes previously accrued fees and recorded owed balances from both starting strategies; the final period earnings are not the final snapshot's total collectable balance.

The browser opens that bundled case and exports its validated evidence without RPC calls. It offers neither historical-file import nor a user-selected replay window. Applying one checkpoint starts a new principal-only hypothetical range experiment. Arithmetic/file validation and stored simulation results do not authenticate a supplied file's chain origin; independent chain verification is performed by the development capture script described in [replay.md](replay.md#reproduce-the-capture).

## Provider failures and production policy

Captures attempt each configured public endpoint at most once. Only typed network, timeout, HTTP capacity/server errors or recognized JSON-RPC rate limits trigger fallback. The entire capture restarts on the next provider, with a new finalized block and a final block-identity check; reads from different providers are never combined. Backup requests are sequential to avoid bursts, and a failed serial capture stops its queued reads. The exported provider is the successful source. Public endpoints can both be unavailable; recorded examples and saved files remain usable.

A manager revert with the specific Invalid token ID reason identifies a nonexistent or burned NFT at the captured block. Other reverts and identity/schema failures keep their own error path. Imported provider metadata remains descriptive, not proof of chain origin.

The HTML entry points carry a restrictive Content Security Policy for GitHub Pages, including the two configured RPC origins. The local server also sends it as a header, with frame-ancestors protection (which cannot be enforced by a meta policy). Script/style assets remain local.
