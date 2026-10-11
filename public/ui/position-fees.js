import { feeTokenAmounts, feeUSD, feeWalkthrough } from '../lib/position-fees.js';

export function initPositionFees() {
  const $ = id => document.getElementById(id);
  function render(view, { canExplore }) {
    const { snapshot, fees } = view;
    $('position-fees').hidden = false;
    $('position-fee-context').textContent = 'Position #' + snapshot.tokenId + ' · Ethereum block ' + snapshot.block.number;
    $('position-fees').open = false;
    $('position-fee-walkthrough').open = false;
    $('position-fee-math').open = false;
    $('position-fee-empty').hidden = Boolean(fees);
    $('position-fee-data').hidden = !fees || fees.overflow;
    $('position-fee-overflow').hidden = !fees?.overflow;
    $('position-fee-details').hidden = !fees;
    $('position-collectable-summary').textContent = !fees ? 'Fee growth was not recorded in this file.'
      : fees.overflow ? 'Contract accounting capacity exceeded.' : feeUSD(fees.collectable.usd) + ' estimated collectable value';
    if (!fees) return;
    const input = snapshot.feeGrowth, a = fees.accounting;
    const fields = {
      'position-growth-global0': input.global0X128, 'position-growth-global1': input.global1X128,
      'position-growth-lower0': input.lower.outside0X128, 'position-growth-lower1': input.lower.outside1X128,
      'position-growth-upper0': input.upper.outside0X128, 'position-growth-upper1': input.upper.outside1X128,
      'position-growth-last0': snapshot.position.feeGrowthInside0LastX128, 'position-growth-last1': snapshot.position.feeGrowthInside1LastX128,
      'position-growth-inside0': a.inside0, 'position-growth-inside1': a.inside1,
      'position-fee-raw0': snapshot.fees.accrued0Raw, 'position-fee-raw1': snapshot.fees.accrued1Raw,
      'position-collectable-raw0': snapshot.fees.collectable0Raw, 'position-collectable-raw1': snapshot.fees.collectable1Raw,
      'position-growth-gross-lower': input.lower.liquidityGross, 'position-growth-gross-upper': input.upper.liquidityGross,
      'position-fee-capacity': fees.overflow ? 'Exceeded; uint128 wrapping reproduced.' : 'Within uint128 capacity.',
    };
    for (const [id, value] of Object.entries(fields)) $(id).textContent = value;
    if (fees.overflow) return;
    $('position-accrued-value').textContent = feeUSD(fees.accrued.usd);
    $('position-accrued-tokens').textContent = feeTokenAmounts(snapshot.fees.accrued0Raw, snapshot.fees.accrued1Raw);
    $('position-recorded-owed-value').textContent = feeUSD(fees.owed.usd);
    $('position-recorded-owed-tokens').textContent = feeTokenAmounts(snapshot.position.tokensOwed0, snapshot.position.tokensOwed1);
    $('position-collectable-value').textContent = feeUSD(fees.collectable.usd);
    $('position-collectable-tokens').textContent = feeTokenAmounts(snapshot.fees.collectable0Raw, snapshot.fees.collectable1Raw);
    $('position-assets-value').textContent = feeUSD(view.assetsUSD);
    const hasOwed = snapshot.position.tokensOwed0 !== '0' || snapshot.position.tokensOwed1 !== '0';
    $('position-owed-note').textContent = hasOwed
      ? 'Recorded owed tokens may include earlier fees and principal removed from liquidity. They are not identified as fee income.'
      : 'Recorded owed balances are zero. The estimated collectable tokens consist of fees since the last accounting update.';
    $('position-fee-steps').replaceChildren(...feeWalkthrough(view, canExplore).map(([title, text]) => {
      const step = document.createElement('li');
      const heading = document.createElement('strong'); heading.textContent = title;
      const copy = document.createElement('p'); copy.textContent = text;
      step.append(heading, '\n', copy); return step;
    }));
    $('position-fee-formula').textContent =
      'Q128 = 2^128\n\n' +
      'For each token:\n' +
      'inside growth = global − below range − above range\n' +
      'growth change = inside growth − last recorded inside growth\n' +
      'new fees = floor(liquidity × growth change / Q128)\n' +
      'estimated collectable = new fee credits + recorded tokens owed\n\n' +
      'This snapshot’s USDC calculation:\n' +
      'floor(' + snapshot.position.liquidity + ' × ' + a.delta0 + ' / 2^128)\n= ' + snapshot.fees.accrued0Raw + ' base units\n\n' +
      'This snapshot’s WETH calculation:\n' +
      'floor(' + snapshot.position.liquidity + ' × ' + a.delta1 + ' / 2^128)\n= ' + snapshot.fees.accrued1Raw + ' base units';
  }
  return {
    render,
    openExample: () => {
      $('position-fees').open = true;
      if (!$('position-fee-data').hidden) $('position-fee-walkthrough').open = true;
      requestAnimationFrame(() => {
        $('position-fees').querySelector('summary').focus({ preventScroll: true });
        $('position-fees').scrollIntoView({ block: 'start', behavior: 'instant' });
      });
    },
  };
}
