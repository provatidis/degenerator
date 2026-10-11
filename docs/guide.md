# Using Degenerator

[Project overview](../README.md) · [Product decisions](../DECISIONS.md)

## Example progression

Playground's **Choose an example** library follows eight ordered cases: unchanged price, a price increase, a fee target, an in-range model, its price boundary, a recorded in-range NFT, an out-of-range NFT, and a fee-accounting snapshot. Each case states what it adds. The four stages are **Foundations → Comparisons → Ranges → Applied cases**, shared with Learn's lesson groups. Every stage and lesson is directly accessible; variations practice the same concept rather than representing difficulty levels. Advanced users can open [the recorded in-range case](https://provatidis.github.io/degenerator/#example=in-range-position) without completing earlier lessons.

Opening a model example carries versioned assumptions through the existing scenario link. Opening a recorded case selects the position snapshot source and saves that snapshot; calculator inputs change only when the user applies it. Examples do not change virtual balances or lesson completion.

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

