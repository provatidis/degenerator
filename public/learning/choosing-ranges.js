import { fmt, usd } from '../lib/format.js';

export const MANAGEMENT_CHAPTER = 'Choosing and managing a range';
const ranges={title:'Uniswap: active liquidity and ranges',url:'https://developers.uniswap.org/docs/get-started/concepts/liquidity-providers/concentrated-liquidity'};
const fees={title:'Uniswap: swap fees and fee tiers',url:'https://developers.uniswap.org/docs/get-started/concepts/fees'};
const change={title:'Uniswap: changing a position’s range',url:'https://support.uniswap.org/hc/en-us/articles/20915975893645-How-to-change-the-price-range-of-a-liquidity-position'};
export const MANAGEMENT_LESSONS = Object.freeze([
  {id:'range-width',short:'Narrow and wide ranges',title:'Does a tighter range always win?',adds:'Start by changing only the range width.',
    intro:'Two hypothetical positions have the same starting budget and price. One uses a narrow range, the other a wider range. Each uses the token mix needed for its own bounds. Compare where they remain active; no earned fees are predicted.',
    reasoning:'Why can a wider range remain active after a narrower range stops?',
    reasons:[['bounds','The wider boundaries include more possible prices.'],['budget','The wider position uses more capital to stay active.'],['protection','The wider position follows a different pool price.']],
    hint:'Look at the shown price and each pair of bounds. Active means eligible to earn from swaps.',
    takeaway:'A tighter range concentrates capital and brings the boundaries closer. It does not guarantee better profit.',
    explanation:'The same price move can leave a narrow position inactive while a wider one still supplies liquidity. A narrow position may earn more while active, but actual fees depend on trades and competing liquidity. Being active is eligibility to earn, not a payment for waiting.',
    pitfall:'A narrow range is not automatically the better investment. You also need earned fees, token values and management costs.',
    reasonFeedback:{budget:'Both positions start with the same dollar budget. Their price bounds differ; the starting budget does not.',protection:'Both positions use the same pool price. Wider bounds include more of its possible prices.'},
    deeper:['Each range starts with its own required token mix. Equal budgets do not make their holding benchmarks identical. Compare each position with its own starting tokens.', 'These are calculated endpoint examples, not a price history or backtest. The model omits ticks and earned fees. Range width alone cannot tell us how much either position would earn.'],sources:[ranges,fees]},
  {id:'fee-tiers',short:'Fee tiers and APR',title:'A higher fee rate is not a higher return',adds:'Add fee rates, trade activity and a past APR figure.',
    intro:'Two hypothetical WETH/USDC pools use different swap fee tiers. A tier is the charge on each trade, not the interest rate on your deposit. In v3, different fee tiers belong to separate pools.',
    reasoning:'What determines the position’s swap fee income?',
    reasons:[['trades','Trade activity, fee rate and its share of active liquidity.'],['rate','The swap fee tier and the position’s starting deposit.'],['clock','The swap fee tier and the time the position stays active.']],
    hint:'A larger fee per trade is only useful when trades use your active liquidity.',
    takeaway:'Read the fee rate, trade activity and your active share separately. Fee income is only part of profit.',
    explanation:'A larger charge per swap does not establish larger earnings. The pools can receive different trade activity and have different competing liquidity. Any supplied fee totals here are made-up teaching facts after any protocol share; they are not earnings estimates or verified records.',
    pitfall:'Fee APR expresses fee income as a yearly rate. Check its observation period and what it excludes; it is not a promise of future profit.',
    reasonFeedback:{rate:'The rate and deposit matter, but trades must use the position’s active liquidity. Competing liquidity also affects its share.',clock:'Time alone creates no swap fees. Trades must use the position’s active liquidity.'},
    deeper:['Swap fees, protocol fees, network costs and external rewards are different items. An LP’s fee income is the part actually earned by that position, after any protocol share.', 'In native Uniswap v3, earned fee tokens stay separate from principal until collected or reinvested. An automatic manager may add its own behavior and costs. A high historical fee rate does not establish that those actions are worthwhile.'],sources:[fees,{title:'Revert: performance comparisons and omitted gas',url:'https://docs.revert.finance/revert/open-positions'}]},
  {id:'range-management',short:'Exits, returns and costs',title:'What happens after a range exit?',adds:'Add continued price exposure, a return and management costs.',
    intro:'Keep one hypothetical position’s liquidity and bounds unchanged. After ETH leaves its range, compare a further price move. The position still owns one token; going out of range does not liquidate a plain Uniswap position.',
    reasoning:'Why does the principal value behave this way outside the range?',
    reasons:[['asset','It still owns one token, whose dollar price matters.'],['locked','It keeps the dollar value reached at the range boundary.'],['liquidated','It sells its tokens and waits outside the pool.']],
    hint:'Below this ETH-price range the position holds ETH; above it, USDC. The example assumes USDC stays at $1.',
    takeaway:'Inactive is not closed. Price exposure remains, and managing a range can add costs.',
    explanation:'Outside its range, the position stops earning new swap fees. Its token quantities stay fixed until price returns. Holding ETH still exposes it to ETH price moves; holding USDC keeps its value fixed only under this example’s $1 assumption. Earlier fee tokens are not erased by the exit.',
    pitfall:'Changing a real v3 range requires removing liquidity and creating a position with new bounds. It can add network costs and require swaps for a new token mix. It does not refund earlier losses.',
    reasonFeedback:{locked:'Fixed token quantities do not guarantee a fixed dollar value. If the position holds ETH, its value follows ETH’s price.',liquidated:'Going out of range does not close or liquidate a plain Uniswap position. It keeps its tokens and can become active again.'},
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

// Follow-ups retain the topic but change the supplied facts. Totals are displayed;
// learners interpret the result rather than calculate fees or round an answer.
export function managementApplication(result) {
  if (result.id === 'range-width') {
    const choices = [
      ['narrow', 'The narrower position has the higher final value.'],
      ['wide', 'The wider position has the higher final value.'],
      ['unknown', 'There is not enough information to compare final values.'],
    ];
    const comparison = result.comparison;
    return {
      context: comparison
        ? 'Keep the shown prices and starting budgets. Supply hypothetical fees and LP-only costs. Narrow: fees ' + usd(comparison.fees[0]) + ', costs ' + usd(comparison.costs[0]) + ', final value ' + usd(comparison.narrow) + '. Wider: fees ' + usd(comparison.fees[1]) + ', costs ' + usd(comparison.costs[1]) + ', final value ' + usd(comparison.wide) + '. These are assumptions, not estimated earnings.'
        : 'The narrow position earned more fees during an earlier active spell. Total fees, final token values and costs for the whole period are not supplied.',
      question: 'What can you conclude about their final values over the whole period?',
      choices,
      hint: comparison ? 'Read the two final values; both already include the supplied fees and costs.' : 'An earlier fee advantage describes only part of the whole period.',
      feedback: comparison
        ? 'The ' + (result.application === 'narrow' ? 'narrower' : 'wider') + ' position finishes ahead with these supplied assumptions. Another set of fees or costs could change that result.'
        : 'The missing whole-period values prevent a comparison. Range width and an earlier fee advantage are not enough.',
    };
  }
  if (result.id === 'fee-tiers') {
    if (result.variant === 0) return {
      context: 'A dashboard shows a high fee APR based on yesterday’s fees. It excludes changes in token value and management costs.',
      question: 'What does that fee APR describe?',
      choices: [
        ['no', 'A yearly rate based on the observed fee income.'],
        ['a', 'A yearly rate based on the position’s total return.'],
        ['b', 'A yearly rate paid on the position’s deposited tokens.'],
      ],
      hint: 'Read what the card includes and the period it observed.',
      feedback: 'Fee APR annualizes the observed fee income. It omits other parts of profit and does not establish what the next year will earn.',
    };
    const withCosts = result.variant === 2;
    return {
      context: withCosts
        ? 'Use these supplied hypothetical totals. The positions have equal starting budgets and can use different ranges. A: principal ' + usd(result.principal[0]) + ', fees ' + usd(result.fees[0]) + ', costs ' + usd(result.costs[0]) + ', final value ' + usd(result.totals[0]) + '. B: principal ' + usd(result.principal[1]) + ', fees ' + usd(result.fees[1]) + ', costs ' + usd(result.costs[1]) + ', final value ' + usd(result.totals[1]) + '. The final values already include fees and costs.'
        : 'Use the supplied example day: position A earned ' + usd(result.fees[0]) + ' in swap fees; B earned ' + usd(result.fees[1]) + '. These are fictional teaching facts after any protocol share.',
      question: withCosts ? 'Which position finishes with the higher value in this example?' : 'Which position earned more swap fees on this supplied day?',
      choices: [
        ['a', 'Position A has the higher ' + (withCosts ? 'final value.' : 'fee income.')],
        ['b', 'Position B has the higher ' + (withCosts ? 'final value.' : 'fee income.')],
        ['no', 'The supplied information does not establish either result.'],
      ],
      hint: withCosts ? 'Read the final values, rather than comparing the fee amounts by themselves.' : 'Read the supplied fee income, rather than choosing by the swap fee tier.',
      feedback: withCosts
        ? 'B finishes ahead even though A earned more fees. Principal value and costs also contribute to the result.'
        : 'A earned more in this supplied example, despite its lower swap fee tier. The fee tier is a charge per trade, not the position’s earnings.',
    };
  }
  return {
    context: result.variant === 1
      ? 'Before price returns, you remove all liquidity and withdraw its tokens. ETH then returns to $2,000, inside the old $1,800–$2,200 bounds.'
      : result.variant === 2
        ? 'You collect only earned fee tokens, leaving liquidity and bounds unchanged. ETH then returns to $2,000, inside the original $1,800–$2,200 range. Gas is excluded.'
        : 'Change only the price: ETH returns to $2,000, inside the original $1,800–$2,200 range. Liquidity and bounds are unchanged.',
    question: 'What happens when price returns inside those bounds?',
    choices: [
      ['automatic', 'The existing liquidity becomes active inside its original bounds.'],
      ['removed', 'A new deposit is needed to supply liquidity again.'],
      ['fees', 'The position earns the swap fees missed while it was outside.'],
    ],
    hint: 'Check whether the owner removed liquidity or only collected fees. Those actions are different.',
    feedback: result.variant === 1
      ? 'All liquidity was removed. The old bounds cannot supply liquidity by themselves; a new deposit is needed.'
      : 'The liquidity remains, so it becomes active again inside its bounds. Collecting only fee tokens does not remove principal. Activity does not recover fees missed outside the range.',
  };
}
