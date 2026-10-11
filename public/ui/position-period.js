import { validatePositionPeriod } from '../data/position-period.js';
import { positionScenario } from '../data/position-snapshot.js';
import { periodPointView } from '../lib/period-presentation.js';
import { usd, signedUSD } from '../lib/format.js';
import { downloadBlob } from '../lib/download.js';

export function initPositionPeriod({rangeLab}) {
  const $=id=>document.getElementById(id);
  let period=null,loading=null,index=0;
  const utc=timestamp=>new Date(timestamp*1000).toISOString().replace('T',' ').replace('.000Z',' UTC');
  const tokens=(zero,one)=>(Number(zero)/1e6).toFixed(6)+' USDC + '+(Number(one)/1e18).toFixed(9)+' WETH';
  function render(){
    const view=periodPointView(period,index),s=view.point.snapshot;
    $('period-checkpoint').max=String(period.points.length-1);$('period-checkpoint').value=String(index);
    $('period-checkpoint').setAttribute('aria-valuetext','Checkpoint '+(index+1)+' of '+period.points.length+', '+utc(s.block.timestamp));
    $('period-current').textContent='Checkpoint '+(index+1)+' of '+period.points.length+' · '+utc(s.block.timestamp);
    $('period-lp').textContent=usd(view.lpUSD);$('period-hold').textContent=usd(view.holdingUSD);
    $('period-fees').textContent=usd(view.feesUSD);$('period-gap').textContent=signedUSD(view.gapUSD);
    $('period-range-time').textContent=view.durationSeconds?((view.secondsInRange/view.durationSeconds)*100).toFixed(1)+'%':'Starting checkpoint';
    $('period-time-detail').textContent=view.secondsInRange+' of '+view.durationSeconds+' elapsed seconds';
    $('period-principal').textContent=tokens(view.principal.amount0,view.principal.amount1);
    $('period-fee-tokens').textContent=tokens(view.earned0,view.earned1);
    $('period-hold-tokens').textContent=tokens(view.holding.amount0,view.holding.amount1);
    $('period-price').textContent=usd(view.price);$('period-block').textContent='Ethereum block '+s.block.number+' ↗';$('period-block').href='https://etherscan.io/block/'+s.block.number;
    $('period-hash').textContent=s.block.hash;
    $('period-raw-fees').textContent=view.earned0+' USDC base units; '+view.earned1+' WETH base units';
    $('period-counter').textContent=view.point.secondsInside;
    const views=period.points.map((_,i)=>periodPointView(period,i));
    const min=Math.min(view.range.lowerPrice,...views.map(item=>item.price)),max=Math.max(view.range.upperPrice,...views.map(item=>item.price));
    const bottom=min-(max-min)*.18,top=max+(max-min)*.18;
    const y=price=>30+(top-price)/(top-bottom)*180;
    const start=period.points[0].snapshot.block.timestamp,end=period.points.at(-1).snapshot.block.timestamp;
    const x=time=>65+(time-start)/(end-start)*490;
    $('period-line').setAttribute('d',views.map((item,i)=>(i?'L':'M')+x(item.point.snapshot.block.timestamp).toFixed(2)+' '+y(item.price).toFixed(2)).join(' '));
    for(const [key,price] of [['lower',view.range.lowerPrice],['upper',view.range.upperPrice]]){$('period-'+key).setAttribute('d','M65 '+y(price)+' H555');$('period-'+key+'-label').setAttribute('y',y(price)-8);$('period-'+key+'-label').textContent=usd(price);}
    $('period-dot').setAttribute('cx',x(s.block.timestamp));$('period-dot').setAttribute('cy',y(view.price));
    $('period-chart').setAttribute('aria-label','Nine recorded ETH price checkpoints in the fixed range. Selected price '+usd(view.price)+'. Lines connect samples and do not reconstruct intra-sample prices.');
    $('period-result').hidden=false;
  }
  async function load(){
    if(period){render();return;}if(loading)return loading;
    $('period-status').textContent='Opening the recorded historical case…';
    loading=(async()=>{try{
      const response=await fetch(new URL('../examples/uniswap-v3-position-period.json',import.meta.url));
      if(!response.ok)throw new Error('The recorded case could not be opened.');
      const body=await response.text();if(body.length>131072)throw new Error('The recorded case is too large.');
      period=validatePositionPeriod(JSON.parse(body));index=period.points.length-1;render();
      $('period-window').textContent=utc(period.points[0].snapshot.block.timestamp)+' → '+utc(period.points.at(-1).snapshot.block.timestamp);
      $('period-status').textContent='Recorded case · '+period.points.length+' checkpoints · fixed liquidity · independently checked fee accounting';
      $('period-export').disabled=false;$('period-apply').disabled=false;
    }catch(error){$('period-status').textContent=error.message;}
    finally{loading=null;}})();return loading;
  }
  $('period-checkpoint').addEventListener('input',()=>{if(period){index=Number($('period-checkpoint').value);render();}});
  $('period-export').addEventListener('click',()=>{if(period)downloadBlob(new Blob([JSON.stringify(period,null,2)+'\n'],{type:'application/json'}),'degenerator-'+period.id+'-historical-case.json');});
  $('period-apply').addEventListener('click',()=>{
    if(!period)return;const snapshot=period.points[index].snapshot,scenario=positionScenario(snapshot);
    rangeLab.setScenario(scenario,'Position #'+snapshot.tokenId+' · Ethereum block '+snapshot.block.number+'. A new principal-only experiment; already collectable tokens remain outside both strategies.',{kind:'position',snapshot});
  });
  function restoreLocation(){if(location.hash==='#historical-case')load();}
  window.addEventListener('hashchange',restoreLocation);restoreLocation();
}
