# Lesson goals and misconceptions

Reviewed 2026-10-13. Passiko teaches liquidity mechanics, interpretation and the limits of evidence. Completion checks explanation and application; predictions are ungraded and no required question asks the learner to calculate or round a result. Numeric practice remains optional in the essentials and historical chapters.

## What the research establishes

Uniswap's primary documentation describes active ranges, token ownership and fee accounting. Published LP research separates holding benchmarks from rebalancing benchmarks. Public user questions illustrate mistaken expectations about [fee tiers](https://www.reddit.com/r/UniSwap/comments/n9oec4/), [fee APR](https://www.reddit.com/r/UniSwap/comments/zbmqz5/) and [stablecoin risk](https://www.reddit.com/r/UniSwap/comments/1cbavf6/). These questions demonstrate that confusion exists; they are not a representative survey or a measurement of how common each error is. Forum answers are not used as technical authority.

The prior course covered mechanisms well but placed several practical cautions only in optional reading. The normal lesson flow now includes short, sourced pitfalls. The practical chapter connects those mechanisms to decisions without claiming to identify the best investment. Automated checks establish internal consistency and working interactions; they do not measure learning outcomes in real users.

## Progression and purpose

| Topic | Misconception to challenge | Understanding check |
| --- | --- | --- |
| Trade size | Every unit receives the starting spot price; a slippage limit removes impact. | Explain changing reserves; apply a changed trade size. |
| Ownership | Withdrawal guarantees the original dollar deposit or original ETH. | Identify a share of both current reserves; apply another matching deposit. |
| Token balances | Rebalancing creates tokens, pays interest or protects a falling asset. | Explain swaps in the selected direction; apply another final price. |
| Loss versus profit | Dollar profit means beating holding; “impermanent” promises recovery. | Identify the same-token benchmark; apply a changed price. |
| Break-even fees | A required fee target or an assumed amount predicts earnings. | Explain what the target establishes; change only the assumed fees. |
| Range boundaries | Outside means liquidation, no earlier fees, or no price exposure. | Identify composition at a boundary; separate the final state from earnings history. |
| Final challenge | Earning any fees makes LP the winner; a correct simulation proves safety. | Interpret total values under assumptions; identify a changed benchmark. |
| Narrow and wide ranges | Tighter capital concentration always means greater profit. | Compare eligibility at shown prices; explain why an earlier fee advantage is incomplete. |
| Fee tiers and APR | The highest charge earns most; a past fee APR fixes future profit. | Identify trades and active share; interpret a short-period APR claim. |
| Exits, returns and costs | Inactive means closed or protected; changing bounds refunds losses. | Interpret outside principal values; apply an inside return without changing liquidity. |
| Period fees | All collectable tokens are new period income; collection is compounding. | Identify new fee tokens; collect them with principal unchanged. |
| Between samples | Endpoints or a plotted line describe every crossing; active time pays fees. | Interpret counters separately from fee accounting; apply two inside samples. |
| Period versus holding | A short, before-cost advantage guarantees longer-term performance. | Name period and basket; read supplied values after a hypothetical LP-only cost. |

Every topic is directly accessible. Three repeatable situations in each practical topic change the observation, while retaining the conceptual scope. An unchanged-price width situation explicitly says both positions are active, rather than implying one has exited.

## Evidence boundaries

The width and outside-value cases are calculated hypothetical endpoints from `cl-range-v1`. They do not reconstruct a trading path, predict fees or model native ticks. Equal budgets across widths use different initial token mixes, so each position has its own holding benchmark. Price inputs and bounds are visible before predicting.

Fee-tier variants provide either no earnings data or fictional fee totals after any protocol share. These figures are not derived from the rate alone. They are labelled teaching facts and never presented as a forecast or independently checked history.

The three historical exercises continue to use the original two independently checked records. Their fixed question checkpoint or interval remains separate from exploration. Any changed setup is labelled a thought experiment.

## Primary references

- [Uniswap: price impact and slippage](https://support.uniswap.org/hc/en-us/articles/8643794102669-Price-Impact-vs-Price-Slippage): distinguishes the trade's own impact from execution changing relative to a quote.
- [Uniswap: pools and LP ownership](https://developers.uniswap.org/docs/protocols/v2/concepts/pools): ownership of changing reserves, rather than a guaranteed dollar payout.
- [Uniswap: understanding returns](https://developers.uniswap.org/docs/protocols/v2/concepts/understanding-returns): the original holding basket and the conditional effect of price reconvergence. Simplified examples are checked against the implemented models, not copied as exact accounting.
- [Uniswap: concentrated liquidity](https://developers.uniswap.org/docs/get-started/concepts/liquidity-providers/concentrated-liquidity): ranges, inactive liquidity and reactivation when price returns.
- [Uniswap: fees](https://developers.uniswap.org/docs/get-started/concepts/fees): active liquidity, per-trade rates, separate v3 fee balances and protocol shares.
- [Uniswap: changing a range](https://support.uniswap.org/hc/en-us/articles/20915975893645-How-to-change-the-price-range-of-a-liquidity-position): removing liquidity and funding another position.
- [Uniswap: range orders](https://developers.uniswap.org/docs/get-started/concepts/liquidity-providers/range-orders): reversals and the limits of stop-loss interpretations.
- [Revert: performance comparisons](https://docs.revert.finance/revert/open-positions): benchmark definitions, omitted gas and exceptional results.
- [Circle: USDC risk disclosures](https://www.circle.com/fr/legal/mica-usdc-whitepaper): secondary-market price dislocation; the $1 setting remains an assumption.
- [Milionis et al., Automated Market Making and Loss-Versus-Rebalancing](https://arxiv.org/abs/2208.06046): holding and rebalancing compare different strategies. Passiko's endpoint holding gap is not an LVR estimate, and the two metrics should not be added as independent penalties.
