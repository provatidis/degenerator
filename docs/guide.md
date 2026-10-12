# Using Degenerator

[Project overview](../README.md) · [Product decisions](../DECISIONS.md)

## Finding a tool and returning to your setup

The top navigation stays visible while scrolling. **Experiment** opens the calculator workspace introduction; **Inspect** opens the pool/position workspace introduction. The tool links below the introduction open a specific lab, saved experiments, the historical cases or the separate Pool mechanics workspace. **Learn** opens the learning document. Existing tool and shared-scenario links still open their targets directly.

Switching workspaces or calculator tabs preserves their current inputs. Clicking a same-tab Learn link temporarily retains valid calculator inputs, the selected lab and any matching source snapshot. Returning restores those working drafts; an explicit shared scenario takes precedence. This handoff uses per-tab session storage and is consumed after restoration. If storage is blocked, navigation still works but the handoff cannot be saved. Invalid/incomplete inputs are not captured. Use **Save experiment** and export the library for a durable, portable copy.

## Example progression

Playground's **Choose an example** library follows ten ordered cases. Each states what it adds. The four stages are **Foundations → Comparisons → Ranges → Applied cases**, shared with Learn's lesson groups.

| Example | Stage | Case | What it adds |
| --- | --- | --- | --- |
| 01 | Foundations | Price unchanged | A hypothetical baseline with no fees |
| 02 | Comparisons | ETH price doubles | A future-price change |
| 03 | Comparisons | Fees match holding | Assumed cash fees at the break-even target |
| 04 | Ranges | Inside a price range | Price bounds and the starting token mix |
| 05 | Ranges | At the upper price boundary | A position holding only USDC at that endpoint |
| 06 | Applied cases | A recorded in-range position | Exact NFT amounts and ticks at one block |
| 07 | Applied cases | A recorded out-of-range position | A single-token NFT snapshot |
| 08 | Applied cases | Principal, fees and tokens owed | Snapshot fee accounting and collectable balances |
| 09 | Applied cases | Fees through a recorded period | Period fees, cumulative time in range and a holding comparison |
| 10 | Applied cases | Leaving a range and returning | Outside intervals, fee pauses and activity between sampled prices |

Every stage and lesson is directly accessible; variations practice the same concept rather than representing difficulty levels. Advanced users can open [the recorded in-range snapshot](https://provatidis.github.io/degenerator/#example=in-range-position), [fee-accounting snapshot](https://provatidis.github.io/degenerator/#example=position-fees), [in-range replay](https://provatidis.github.io/degenerator/#historical-case) or [exit-and-return replay](https://provatidis.github.io/degenerator/#historical-case=range-return) without completing earlier lessons. The example definitions live in [public/learning/example-path.js](../public/learning/example-path.js).

Examples 01–05 carry hypothetical, versioned assumptions through scenario links. Examples 06–08 select Inspect's position source and save the chosen recorded snapshot; calculator inputs change only when the user applies it. Examples 09–10 open the recorded-period workspace. It does not replace the latest position snapshot or automatically change calculator inputs. Examples do not change virtual balances or lesson completion.

## Historical cases: fees through a recorded period

Open **Historical cases** from Experiment. The **Recorded cases** selector starts with **01 · Stays in range** (example 09), then **02 · Exit and return** (example 10). Each remains directly accessible. The baseline follows Ethereum Uniswap v3 WETH/USDC position #1382030 in the 0.3% pool from block 26168526 to 26168941 on 11 October 2026. Nine checkpoints cover **4,992 seconds** (83 minutes and 12 seconds), with unchanged position liquidity and bounds.

The longer case follows position #1375047 in the same 0.3% pool from block 26080000 to 26090000 on 29–30 September 2026. Its 17 checkpoints span **120,468 seconds** (33 hours, 27 minutes and 48 seconds): 50,256 seconds in range and 70,212 outside, with unchanged liquidity and bounds.

Move the checkpoint slider to compare **Principal + period fees** with **Hold starting principal tokens**. Both strategies begin with the first checkpoint's exact principal tokens; previously accrued fees and recorded owed balances are excluded. Period fees are calculated from recorded fee growth and kept in their earned tokens, rather than entered as assumed cash. Time in range comes from cumulative contract counters, not the sampled price line. Independent read-only collection simulations and complete position-update event queries check the recorded accounting and continuity.

Use **Start**, **Outside sample**, **Between samples**, **Return sample** and **End** to jump through the longer case. These identify recorded checkpoints, not exact crossing times. **Since the previous checkpoint** separates interval fees and active time from the cumulative totals. At the Between samples checkpoint, both endpoints are outside, yet counters show 45 minutes and 24 seconds of activity and new fee tokens between them. The chart focuses on recorded prices and identifies any fixed bound outside its view.

Expand **Tokens and verification** for the full UTC window, token balances, the selected block/hash and exact fee/time integers. **How to read this replay** explains sampling, fee tokens versus dollar valuation and the holding benchmark. **Export recorded case** downloads the checkpoint snapshots, counters and verification evidence as JSON. **Explore this checkpoint in Playground** starts a new hypothetical range experiment from the selected checkpoint's principal, price and bounds, with zero assumed future fees. Already collectable tokens stay outside both strategies in that new comparison.

These are verified fixed-position replays. They have no editable historical bounds or date window and do not provide arbitrary-range backtesting or lifetime PnL. Valuations use the selected pool ratio and USDC = $1; gas and incentives are excluded. See [the replay method and limitations](replay.md) for the fee checks, rounding tolerance and capture procedure.

## Saved experiments

Choose **Save experiment** in either liquidity lab to keep its current model, exact numeric assumptions, name and optional notes. The [Saved experiments library](https://provatidis.github.io/degenerator/#saved-experiments) can search names/notes, filter by model, edit names and notes, and reopen any setup. Reopening loads a working copy; input edits leave the original record intact, and saving again creates a variation. Removal has an Undo action until another record is removed or the tab reloads.

Select two or three records to compare. Outcomes are recalculated from the saved model inputs, rather than storing potentially stale derived results. The comparison shows each LP value, holding value and difference, with expandable assumptions and notes. Its context distinguishes identical starting baskets and future prices, different future-price scenarios, and different budgets/prices/token mixes. A concentrated range and a 50/50 position can have different starting tokens even with equal budgets; each uses its own holding benchmark. Fee inputs remain assumed USD cash, with USDC = $1 and the existing model exclusions.

When a setup still matches its imported pool price or NFT principal/range, saving retains the full validated source snapshot, including its block and exact integers. Changing a pool starting price, or an NFT's starting price, investment or bounds, clears that attribution. Future-price and fee-assumption changes preserve it. Reopening does not fetch the chain, contact imported provider URLs or replace the latest pool/position snapshot. Recorded collectable tokens remain outside both strategies' future principal comparison.

The library uses its own degenerator-experiments-v1 storage key and version-1 JSON schema, independent of lesson progress, snapshots and the virtual sandbox. Export includes names, notes, assumptions and retained source snapshots; ordinary scenario links still contain only model inputs. Imports merge atomically, skip identical records, and keep conflicting IDs as new copies rather than overwriting either version. Limits are 50 records, 80-character names, 1,000-character notes and a 512 KB file. Unsupported models/versions, invalid sources and malformed files are rejected without altering the current collection.

Storage failures keep changes for the current tab and explicitly request an export. Unreadable or newer saved copies are retained, downloadable and discarded only through their own recovery action. Each edit reads the latest stored collection to preserve another tab's additions; stale name/notes edits and removals are rejected. Data/schema/storage code lives in public/data/saved-experiments.js, calculation/presentation helpers in public/lib/saved-experiments.js, and the injected library controller in public/ui/saved-experiments.js.

## Learn: Liquidity essentials

Open [Learn](https://provatidis.github.io/degenerator/learn.html) for six independent lessons and a final challenge. Every topic is available directly, including shareable lesson fragments such as learn.html#lesson=range-boundaries. Exercises ask for a prediction, show the calculated outcome, and require both a numeric answer and sound reasoning. Hints and three repeatable variations support practice; completion records understanding checks, not simulated profit.

The lessons cover swap impact, proportional pool ownership, changing token balances, impermanent loss versus dollar profit, fee break-even, and concentrated range boundaries. The final challenge compares the same starting tokens, differentiates additional fees from the total break-even target, and can export a PNG result card and a reproducible playground link.

Every subject, including the final challenge, has optional Go deeper reading after its experiment explanation. Topic-specific mechanics, a worked example using the selected inputs, common misconceptions, a separately expandable math panel and two primary-source links provide a deeper path. Opening reading never affects completion; switching lessons closes both disclosures, and rerunning an edited setup refreshes its example. Editorial content lives in public/learning/deeper-reading.js and worked-example narration in public/lib/lesson-walkthrough.js.

Lesson inputs and answers are stored under degenerator-learning-liquidity-v1, independently of sandbox balances, snapshot imports and playground controllers. Reopening restores the last lesson and validated exercise draft. Damaged drafts are ignored; unavailable or full storage leaves learning usable in the current tab. Playground links open a separate tab. Price/range lessons carry their exact model assumptions; swap/ownership lessons open the existing swap sandbox without replacing its saved pool or wallet.

Content lives in public/learning/, pure experiment/assessment logic in public/models/lesson-experiments.js, progress persistence in public/data/learning-progress.js, and the controller in public/ui/learning.js. The learning document has its own composition root, public/learn-main.js, and shares the existing calculator models and styles. No backend, account, network request or new runtime dependency is required.

## Guided experiments and result cards

The Pump and The Dump keep the current investment/starting price, set ETH to 2x or 0.5x, and clear assumed fees. The Harvest sets assumed fee income to the break-even amount for the current future price; it does not estimate yield.

**Create result card** previews a downloadable 1200x720 PNG with the four assumptions, model version, holding/LP outcomes, before-fee IL, break-even fees, and model limitations. Input changes invalidate the preview so a card cannot silently describe an older scenario.

## Experiments

- Compare 1 ETH and 5 ETH swaps to see how trade size changes price impact.
- Change future prices and assumed fees in the liquidity scenario lab, then share a scenario link or export its comparison.
- Reverse the swap direction to trade USDC for ETH.
- Deposit matching ETH and USDC to receive LP tokens, then make a swap and withdraw your pool share.
- Move the impermanent-loss slider to compare liquidity provision with holding the initial assets.
- Reset to restore the initial pool and virtual wallet.
