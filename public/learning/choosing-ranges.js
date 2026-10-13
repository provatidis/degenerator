import { fmt, usd } from '../lib/format.js';

export const MANAGEMENT_CHAPTER = 'Choosing and managing a range';
const ranges={title:'Uniswap: active liquidity and ranges',url:'https://developers.uniswap.org/docs/get-started/concepts/liquidity-providers/concentrated-liquidity'};
const fees={title:'Uniswap: swap fees and fee tiers',url:'https://developers.uniswap.org/docs/get-started/concepts/fees'};
const change={title:'Uniswap: changing a position’s range',url:'https://support.uniswap.org/hc/en-us/articles/20915975893645-How-to-change-the-price-range-of-a-liquidity-position'};
export const MANAGEMENT_LESSONS = Object.freeze([
  {id:'range-width',short:'Narrow and wide ranges',title:'Does a tighter range always win?',adds:'Start by changing only the range width.',
    intro:'Two hypothetical positions have the same starting budget and price. One uses a narrow range, the other a wider range. Each uses the token mix needed for its own bounds. Compare where they remain active; no earned fees are predicted.',
    reasoning:'Why can a wider range remain active after a narrower range stops?',
    reasons:[['bounds','The wider boundaries include more possible prices.'],['budget','The wider range starts with a larger dollar budget.'],['protection','The wider range prevents the pool price from moving.']],
    hint:'Look at the shown price and each pair of bounds. Active means eligible to earn from swaps.',
    takeaway:'A tighter range concentrates capital and brings the boundaries closer. It does not guarantee better profit.',
    explanation:'The same price move can leave a narrow position inactive while a wider one still supplies liquidity. A narrow position may earn more while active, but actual fees depend on trades and competing liquidity. Being active is eligibility to earn, not a payment for waiting.',
    pitfall:'A narrow range is not automatically the better investment. You also need earned fees, token values and management costs.',
    applicationContext:'Now suppose the narrow position earned more fees during an earlier active spell. You do not have either position’s total fee income, final token value or costs.',
    applicationQuestion:'Is that earlier fee advantage enough to establish better profit over the whole period?',
    applications:[['unknown','No. The full period’s values and costs still matter.'],['narrow','Yes. More fees during one spell guarantee more profit.'],['wide','Yes. A wider range always has a lower final value.']],
    applicationHint:'Compare the whole result, including token values and costs, rather than one source of income.',
    reasonFeedback:{budget:'Both positions start with the same dollar budget. The difference is their price bounds.',protection:'A wider range does not hold the market price still. It includes more prices at which the position can stay active.'},
    applicationFeedback:'An earlier fee advantage is only part of the comparison. The final tokens, total fees and costs are still needed to compare the full period.',
    deeper:['Each range starts with its own required token mix. Equal budgets do not make their holding benchmarks identical. Compare each position with its own starting tokens.', 'These are calculated endpoint examples, not a price history or backtest. The model omits ticks and earned fees. Range width alone cannot tell us how much either position would earn.'],sources:[ranges,fees]},
  {id:'fee-tiers',short:'Fee tiers and APR',title:'A higher fee rate is not a higher return',adds:'Add fee rates, trade activity and a past APR figure.',
    intro:'Two hypothetical WETH/USDC pools use different swap fee tiers. A tier is the charge on each trade, not the interest rate on your deposit. In v3, different fee tiers belong to separate pools.',
    reasoning:'What determines the position’s swap fee income?',
    reasons:[['trades','Trade activity, fee rate and its share of active liquidity.'],['rate','The fee percentage alone, regardless of trade activity.'],['clock','Elapsed time alone, regardless of whether swaps occur.']],
    hint:'A larger fee per trade is only useful when trades use your active liquidity.',
    takeaway:'Read the fee rate, trade activity and your active share separately. Fee income is only part of profit.',
    explanation:'A larger charge per swap does not establish larger earnings. The pools can receive different trade activity and have different competing liquidity. Any supplied fee totals here are made-up teaching facts after any protocol share; they are not earnings estimates or verified records.',
    pitfall:'Fee APR expresses fee income as a yearly rate. Check its observation period and what it excludes; it is not a promise of future profit.',
    applicationContext:'A dashboard shows a high fee APR based on yesterday’s fees. It does not include changing token values or management costs.',
    applicationQuestion:'Does that card establish what your total return will be over the next year?',
    applications:[['no','No. Future activity, token values and costs can differ.'],['yes','Yes. The yearly rate fixes the next year’s total return.'],['tier','Yes. A high swap fee guarantees the displayed return.']],
    applicationHint:'A yearly rate can describe a short past observation. It does not make that activity repeat.',
    reasonFeedback:{rate:'The rate is charged per swap. Different trade activity and active liquidity can outweigh the rate difference.',clock:'Time alone creates no swap fees. Trades must use the position’s active liquidity.'},
    applicationFeedback:'A past fee APR does not include every source of profit or loss, and future trading can differ. Read its period, fee treatment and omitted costs.',
    deeper:['Swap fees, protocol fees, network costs and external rewards are different items. An LP’s fee income is the part actually earned by that position, after any protocol share.', 'In native Uniswap v3, earned fee tokens stay separate from principal until collected or reinvested. An automatic manager may add its own behavior and costs. A high historical fee rate does not establish that those actions are worthwhile.'],sources:[fees,{title:'Revert: performance comparisons and omitted gas',url:'https://docs.revert.finance/revert/open-positions'}]},
  {id:'range-management',short:'Exits, returns and costs',title:'What happens after a range exit?',adds:'Add continued price exposure, a return and management costs.',
    intro:'Keep one hypothetical position’s liquidity and bounds unchanged. After ETH leaves its range, compare a further price move. The position still owns one token; going out of range does not liquidate a plain Uniswap position.',
    reasoning:'Why does the principal value behave this way outside the range?',
    reasons:[['asset','It still owns one token, whose dollar price matters.'],['locked','The range boundary fixes the position’s dollar value.'],['liquidated','The range exit sells the position and closes it.']],
    hint:'Below this ETH-price range the position holds ETH; above it, USDC. The example assumes USDC stays at $1.',
    takeaway:'Inactive is not closed. Price exposure remains, and managing a range can add costs.',
    explanation:'Outside its range, the position stops earning new swap fees. Its token quantities stay fixed until price returns. Holding ETH still exposes it to ETH price moves; holding USDC keeps its value fixed only under this example’s $1 assumption. Earlier fee tokens are not erased by the exit.',
    pitfall:'Changing a real v3 range requires removing liquidity and creating a position with new bounds. It can add network costs and require swaps for a new token mix. It does not refund earlier losses.',
    applicationContext:'Change only the price: ETH returns to $2,000, strictly inside the original $1,800–$2,200 range. You have not removed liquidity or changed the bounds.',
    applicationQuestion:'What happens to this unchanged position when the pool price returns inside?',
    applications:[['automatic','It becomes active again without a new deposit.'],['deposit','It stays inactive until the owner deposits again.'],['refund','It automatically refunds all earlier losses and costs.']],
    applicationHint:'The existing liquidity and bounds are still present. A return can make them active again.',
    reasonFeedback:{locked:'Fixed token quantities do not guarantee a fixed dollar value. If the position holds ETH, its value follows ETH’s price.',liquidated:'Going out of range does not close or liquidate a plain Uniswap position. It keeps its tokens and can become active again.'},
    applicationFeedback:'The existing position becomes active again when price returns strictly inside its bounds. That does not guarantee fees without swaps or refund earlier costs.',
    deeper:['Returning price can reactivate an unchanged position automatically. Moving the bounds is a different action: the owner removes liquidity and funds a new position, possibly swapping tokens and paying network costs.', 'A range is not a stop-loss. Below an ETH-price range the position holds ETH and can keep losing dollar value as ETH falls. A range order can also reverse its token conversion if price recrosses before liquidity is removed.'],sources:[change,ranges,{title:'Uniswap: range orders and stop-loss limitations',url:'https://developers.uniswap.org/docs/get-started/concepts/liquidity-providers/range-orders'}]},
]);
export function managementPresentation(result) {
  const {id,variant}=result;
  if(id==='range-width')return {
    setup:'Narrow range: $1,900–$2,100. Wider range: $1,500–$2,500. Both budgets: $5,000.00. ETH starts at $2,000.00, then moves to '+usd(result.price)+'. USDC = $1.',
    reasoning:variant===2?'Both are active here. What still differs between these positions?':null,
    prediction:'At that price, which position will be inside its range?', predictions:[['wide','Only the wider position'],['both','Both positions'],['none','Neither position']],
    metrics:[['Narrow range',result.narrow.state==='inside'?'Active':'Inactive','$1,900–$2,100'],['Wider range',result.wide.state==='inside'?'Active':'Inactive','$1,500–$2,500'],['Earned fees','Unknown','No fee income is estimated']],
    links:[{label:'Explore the narrow setup in Playground ↗',scenario:result.narrow},{label:'Explore the wider setup in Playground ↗',scenario:result.wide}],
    note:'Calculated hypothetical endpoints, with zero assumed fees. The links keep each range’s original funding and shown final price.'};
  if(id==='fee-tiers')return {
    setup:'Pool A: '+fmt(result.rates[0],2)+'% per swap. Pool B: '+fmt(result.rates[1],2)+'% per swap. Same pair, equal position budgets and the same example day.',
    prediction:'From these fee tiers alone, which position will earn more swap fees?',
    predictions:[['unknown','The fee tiers alone cannot tell us'],['a','Position A'],['b','Position B']],
    metrics:[['Position A fees',result.fees?usd(result.fees[0]):'Unknown',fmt(result.rates[0],2)+'% swap fee tier'],['Position B fees',result.fees?usd(result.fees[1]):'Unknown',fmt(result.rates[1],2)+'% swap fee tier'],['Whole-period profit','Unknown','Token values and costs are not supplied']],links:[],
    note:'Fee totals in variations are supplied teaching facts. They are not calculated from the fee rate, imported data or a forecast.'};
  const held=result.first.pooled.eth===0?'USDC':'ETH';
  return {setup:'$5,000.00 funded at $2,000.00/ETH. Keep the $1,800–$2,200 range; compare ETH at '+usd(result.prices[0])+' and then '+usd(result.prices[1])+'. USDC = $1.',
    prediction:'After the further price move, what happens to the position’s principal value?',predictions:[['falls','It falls'],['same','It stays the same'],['rises','It rises']],
    metrics:[['After the range exit',usd(result.first.lpBeforeFees),'ETH price '+usd(result.prices[0])],['After the further move',usd(result.second.lpBeforeFees),'ETH price '+usd(result.prices[1])],['Token held',held,'Same token quantity at both outside points']],
    links:[{label:'Explore this setup in Playground ↗',scenario:result.second}],note:'Hypothetical principal before fees, with unchanged liquidity and USDC = $1. No range changes or earned fees are simulated.'};
}
