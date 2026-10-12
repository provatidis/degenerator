import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const pool = JSON.parse(await readFile(new URL('../../public/examples/uniswap-v2-mainnet.json', import.meta.url), 'utf8'));
const outside = JSON.parse(await readFile(new URL('../../public/examples/uniswap-v3-mainnet-37.json', import.meta.url), 'utf8'));

export async function checkExamples({ evaluate, click, fill, text, navigate, base }) {
  const wait = condition => evaluate('new Promise((resolve,reject)=>{const deadline=Date.now()+10000;const check=()=>{if(' + condition + ')resolve();else if(Date.now()>deadline)reject(new Error("Example check timed out"));else setTimeout(check,20)};check()})');
  const keys = ['defi-sandbox-v1','degenerator-learning-liquidity-v1','degenerator-pool-snapshot-v1','degenerator-v3-position-snapshot-v1'];
  const saved = await evaluate(JSON.stringify(keys) + '.map(key=>localStorage.getItem(key))');
  await navigate(base);
  assert.equal(await evaluate("document.getElementById('example-library').open"), false);
  await evaluate("document.querySelector('#example-library > summary').click()");
  assert.deepEqual(await evaluate("Array.from(document.querySelectorAll('[data-example-level]')).map(el=>el.textContent)"), ['1 · Foundations','2 · Comparisons','3 · Ranges','4 · Applied cases']);
  await evaluate("document.querySelector('[data-example-id=unchanged]').click()");
  await wait("document.getElementById('scenario-future').value==='2000' && document.getElementById('scenario-fees').value==='0'");
  assert.equal(await text('scenario-hold-value'), '$5,000.00');
  assert.equal(await text('scenario-lp-value'), '$5,000.00');
  await fill('scenario-future', '1000');
  await evaluate("document.querySelector('[data-example-id=unchanged]').click()");
  assert.equal(await evaluate("document.getElementById('scenario-future').value"), '2000');
  await evaluate("document.querySelector('[data-example-level=\"2\"]').click()");
  assert.equal(await evaluate("document.querySelectorAll('#example-cards a').length"), 2);
  await evaluate("document.querySelector('[data-example-id=fee-target]').click()");
  await wait("Number(document.getElementById('scenario-fees').value)>400");
  assert.equal(await text('scenario-lp-value'), '$7,500.00');
  await evaluate("document.querySelector('[data-example-level=\"3\"]').click();document.querySelector('[data-example-id=range-boundary]').click()");
  await wait("document.getElementById('cl-future').value==='2200'");
  assert.equal(await text('cl-state'), 'At the upper edge');
  assert.equal(await text('cl-asset-state'), 'All USDC');
  await navigate(base+'#example=in-range-position');
  await wait("document.getElementById('position-heading-id').textContent==='Position #1382030' && document.getElementById('position-lab').getAttribute('aria-busy')==='false'");
  assert.equal(await text('position-state'), 'In range');
  assert.equal(await text('position-principal'), '$47,793.97');
  assert.equal(await evaluate("document.querySelector('[data-example-level=\"4\"]').getAttribute('aria-pressed')"), 'true');
  assert.equal(await evaluate("document.getElementById('example-library').open"), true);
  assert.deepEqual(await evaluate("['cl-investment','cl-start','cl-future','cl-lower','cl-upper','cl-fees','cl-full-fees'].map(id=>document.getElementById(id).value)"), ['5000','2000','2100','1800','2200','0','0']);
  await click('position-apply');
  assert.equal(await text('cl-value'), '$47,793.97');
  assert.match(await text('cl-origin'), /1382030/);
  assert.equal(await evaluate("localStorage.getItem('defi-sandbox-v1')"), saved[0]);
  assert.equal(await evaluate("localStorage.getItem('degenerator-learning-liquidity-v1')"), saved[1]);

  await navigate(base+'#example=position-fees');
  await wait("document.getElementById('position-fees').open && document.getElementById('position-fee-walkthrough').open && document.getElementById('position-lab').getAttribute('aria-busy')==='false'");
  assert.equal(await evaluate("document.querySelectorAll('#example-cards a').length"), 5);
  assert.equal(await evaluate("document.querySelector('[data-example-id=position-fees]').hash"), '#example=position-fees');
  assert.match(await text('position-fee-context'), /1382030.*26168941/);
  assert.equal(await text('position-collectable-value'), '$5.67');
  assert.equal(await evaluate("localStorage.getItem('defi-sandbox-v1')"), saved[0]);
  assert.equal(await evaluate("localStorage.getItem('degenerator-learning-liquidity-v1')"), saved[1]);

  // The live button uses a complete second-provider capture after a transport limit.
  await evaluate('window.examplePoolFixture='+JSON.stringify(pool));
  await evaluate(`(()=>{
    const pool=window.examplePoolFixture,original=window.fetch;
    const word=value=>BigInt(value).toString(16).padStart(64,'0');
    const encoded=(...values)=>'0x'+values.map(word).join('');
    const block={number:'0x'+BigInt(pool.block.number).toString(16),hash:pool.block.hash,timestamp:'0x'+pool.block.timestamp.toString(16)};
    const responses={'0xc45a0155':encoded(pool.factoryAddress),'0x0dfe1681':encoded(pool.tokens[0].address),'0xd21220a7':encoded(pool.tokens[1].address),'0x0902f1ac':encoded(pool.reserves.reserve0,pool.reserves.reserve1,pool.reserves.timestamp)};
    window.restoreExampleFetch=()=>window.fetch=original;window.backupRequests=[];
    window.fetch=async(url,options)=>{
      if(![pool.provider,'https://eth.drpc.org'].includes(String(url)))return original(url,options);
      const req=JSON.parse(options.body);window.backupRequests.push({provider:String(url),...req});
      if(String(url)===pool.provider)return new Response('{}',{status:429});
      let result;const data=req.params?.[0]?.data;
      if(req.method==='eth_chainId')result='0x1';
      else if(req.method==='eth_getBlockByNumber')result=block;
      else if(data.startsWith('0xe6a43905'))result=encoded(pool.poolAddress);
      else if(data.startsWith('0xd06ca61f'))result=encoded(32,2,pool.validation.amountInRaw,pool.validation.amountOutRaw);
      else if(data==='0x313ce567')result=req.params[0].to===pool.tokens[0].address?encoded(6):encoded(18);
      else result=responses[data];
      return new Response(JSON.stringify({jsonrpc:'2.0',id:req.id,result}),{status:200});
    };
  })()`);
  await click('source-pool-tab'); await click('pool-fetch');
  await wait("document.getElementById('pool-status').textContent.includes('Snapshot saved') && document.getElementById('pool-lab').getAttribute('aria-busy')==='false'");
  assert.equal(await text('pool-provider'), 'https://eth.drpc.org');
  assert.equal(await evaluate("window.backupRequests.filter(req=>req.provider==='https://eth.drpc.org'&&req.method==='eth_call').length"), 8);
  assert.equal(await evaluate("window.backupRequests.filter(req=>req.provider==='https://eth.drpc.org'&&req.method==='eth_call').every(req=>req.params[1]==='0x'+BigInt(window.examplePoolFixture.block.number).toString(16))"), true);
  await evaluate("window.restoreExampleFetch()");

  // Unreadable and newer-version saves remain until the user discards each one.
  await evaluate("localStorage.setItem('degenerator-pool-snapshot-v1','{');localStorage.setItem('degenerator-v3-position-snapshot-v1',"+JSON.stringify(JSON.stringify({...outside,version:99}))+")");
  await navigate(base);
  assert.match(await text('pool-status'), /unreadable/);
  assert.equal(await evaluate("document.getElementById('pool-clear-saved').hidden"), false);
  await click('pool-clear-saved');
  assert.equal(await evaluate("localStorage.getItem('degenerator-pool-snapshot-v1')"), null);
  assert.ok(await evaluate("localStorage.getItem('degenerator-v3-position-snapshot-v1')"));
  await click('source-position-tab');
  assert.match(await text('position-status'), /unsupported snapshot version/);
  await click('position-clear-saved');
  assert.equal(await evaluate("localStorage.getItem('degenerator-v3-position-snapshot-v1')"), null);
  assert.equal(await evaluate("localStorage.getItem('defi-sandbox-v1')"), saved[0]);
  assert.equal(await evaluate("localStorage.getItem('degenerator-learning-liquidity-v1')"), saved[1]);
  for (const [index,key] of keys.entries()) await evaluate(saved[index]===null ? 'localStorage.removeItem('+JSON.stringify(key)+')' : 'localStorage.setItem('+JSON.stringify(key)+','+JSON.stringify(saved[index])+')');
  await navigate(base);
  console.log('PASS: ordered examples, direct advanced entry, explicit range handoff, typed transport fallback and scoped save recovery');
}
