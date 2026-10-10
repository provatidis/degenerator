import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const recorded = JSON.parse(await readFile(new URL('../../public/examples/uniswap-v3-mainnet-37.json', import.meta.url), 'utf8'));
const word = value => {
  let n = BigInt(value);
  if (n < 0n) n += 1n << 256n;
  return n.toString(16).padStart(64, '0');
};
const encoded = (...values) => '0x' + values.map(word).join('');

export async function checkPositions({ base, call, evaluate, click, fill, text, reload, navigate, downloadFile, profile }) {
  const waitStatus = fragment => evaluate(`new Promise((resolve,reject)=>{const deadline=Date.now()+10000;const check=()=>{if(document.getElementById('position-status').textContent.includes(${JSON.stringify(fragment)})&&document.getElementById('position-lab').getAttribute('aria-busy')==='false')resolve();else if(Date.now()>deadline)reject(new Error('Position status timed out: '+document.getElementById('position-status').textContent));else setTimeout(check,20)};check()})`);
  const inputState = () => evaluate("['cl-investment','cl-start','cl-future','cl-lower','cl-upper','cl-fees','cl-full-fees'].map(id=>document.getElementById(id).value)");
  const priorInputs = await inputState();
  const priorWallet = await text('portfolio');
  await click('source-position-tab');
  assert.equal(await evaluate("document.getElementById('pool-source').hidden"),true);
  assert.equal(await evaluate("document.getElementById('position-lab').hidden"),false);
  await fill('position-id','0');
  assert.equal(await evaluate("document.getElementById('position-fetch').disabled"),true);
  await fill('position-id','37');
  await click('position-example');
  await waitStatus('Position saved');
  assert.equal(await text('position-state'),'Below range');
  assert.equal(await text('position-eth'),'0.01 WETH');
  assert.equal(await text('position-usdc'),'0.00 USDC');
  assert.equal(await text('position-principal'),'$24.92');
  assert.equal(await text('position-lower'),'$3,999.75');
  assert.equal(await text('position-upper'),'$4,509.68');
  assert.match(await text('position-evidence'),/Recorded example/);
  assert.deepEqual(await inputState(),priorInputs,'Loading does not change a range setup.');
  assert.equal(await text('portfolio'),priorWallet);
  assert.equal(await evaluate("document.getElementById('position-allocation-bar').getBoundingClientRect().height"),8);
  const exportedPath = await downloadFile('position-export');
  const exported = JSON.parse(await readFile(exportedPath,'utf8'));
  assert.deepEqual(exported,recorded);
  await click('position-apply');
  assert.equal(await evaluate("document.getElementById('lab-range-tab').getAttribute('aria-selected')"),'true');
  assert.equal(await evaluate("Number(document.getElementById('cl-future').value)"),await evaluate("Number(document.getElementById('cl-start').value)"));
  assert.equal(await text('cl-value'),'$24.92');
  assert.equal(await text('cl-il'),'0.00%');
  assert.equal(await evaluate("document.getElementById('cl-fees').value"),'0');
  assert.equal(await evaluate("document.getElementById('cl-full-fees').value"),'0');
  assert.match(await text('cl-origin'),/position #37/);
  await fill('cl-future','4300');
  assert.equal(await text('cl-state'),'In range');
  assert.equal(await evaluate("document.getElementById('cl-origin').hidden"),false);
  await fill('cl-lower','3900');
  assert.equal(await evaluate("document.getElementById('cl-origin').hidden"),true,'Editing imported bounds clears provenance.');
  await navigate(base+'#position-lab');
  assert.equal(await evaluate("document.getElementById('source-position-tab').getAttribute('aria-selected')"),'true');
  assert.match(await text('position-evidence'),/not been rechecked/);
  assert.equal(await text('position-principal'),'$24.92');
  await evaluate("document.getElementById('source-position-tab').focus()");
  await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Home',code:'Home'});
  await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Home',code:'Home'});
  assert.equal(await evaluate("document.getElementById('source-pool-tab').getAttribute('aria-selected')"),'true');
  await call('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight'});
  await call('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowRight',code:'ArrowRight'});
  assert.equal(await evaluate('document.activeElement.id'),'source-position-tab');

  async function loadFile(path) {
    const document = await call('DOM.getDocument');
    const input = await call('DOM.querySelector',{nodeId:document.root.nodeId,selector:'#position-file'});
    await call('DOM.setFileInputFiles',{nodeId:input.nodeId,files:[path]});
  }
  const badPath = join(profile,'invalid-position.json');
  await writeFile(badPath,JSON.stringify({...recorded,principal:{...recorded.principal,amount1Raw:'1'}}));
  await loadFile(badPath); await waitStatus('does not match');
  assert.equal(await text('position-principal'),'$24.92');
  assert.match(await text('position-status'),/previous position/);
  const closedPath = join(profile,'closed-position.json');
  await writeFile(closedPath,JSON.stringify({...recorded,position:{...recorded.position,liquidity:'0',tokensOwed0:'123'},principal:{amount0Raw:'0',amount1Raw:'0'}}));
  await loadFile(closedPath); await waitStatus('Position saved');
  assert.equal(await text('position-state'),'No active liquidity');
  assert.equal(await evaluate("document.getElementById('position-apply').disabled"),true);
  assert.equal(await evaluate("document.getElementById('position-allocation-bar').hidden"),true);
  assert.equal(await text('position-owed0'),'0.000123 USDC');
  await loadFile(exportedPath); await waitStatus('Position saved');
  assert.equal(await evaluate("document.getElementById('position-apply').disabled"),false);

  // Deterministic transport responses exercise the live UI path without relying on an external provider in CI.
  const block = {number:'0x'+BigInt(recorded.block.number).toString(16),hash:recorded.block.hash,timestamp:'0x'+BigInt(recorded.block.timestamp).toString(16)};
  const responses = {
    '0xc45a0155':encoded(recorded.factoryAddress),'0x0dfe1681':encoded(recorded.tokens[0].address),'0xd21220a7':encoded(recorded.tokens[1].address),
    '0xddca3f43':encoded(recorded.position.fee),'0xd0c93a7c':encoded(recorded.pool.tickSpacing),
    '0x3850c7bd':encoded(recorded.pool.sqrtPriceX96,recorded.pool.tick,0,1,1,0,1),
  };
  const position = encoded(0,0,recorded.tokens[0].address,recorded.tokens[1].address,recorded.position.fee,recorded.position.tickLower,recorded.position.tickUpper,recorded.position.liquidity,0,0,0,0);
  await evaluate(`(()=>{const original=window.fetch;window.restorePositionFetch=()=>{window.fetch=original};window.positionRequests=[];window.positionRpcMode='valid';window.fetch=async(url,options)=>{if(String(url)!==${JSON.stringify(recorded.provider)})return original(url,options);const request=JSON.parse(options.body);window.positionRequests.push(request);let result;const data=request.params?.[0]?.data;if(request.method==='eth_chainId')result='0x1';else if(request.method==='eth_getBlockByNumber')result=${JSON.stringify(block)};else if(data.startsWith('0x99fbab88'))result=window.positionRpcMode==='invalid'?'0x':${JSON.stringify(position)};else if(data.startsWith('0x1698ee82'))result=${JSON.stringify(encoded(recorded.poolAddress))};else if(data==='0x313ce567')result=request.params[0].to===${JSON.stringify(recorded.tokens[0].address)}?${JSON.stringify(encoded(6))}:${JSON.stringify(encoded(18))};else result=${JSON.stringify(responses)}[data];return new Response(JSON.stringify({jsonrpc:'2.0',id:request.id,result}),{status:200,headers:{'Content-Type':'application/json'}})}})()`);
  const largeId = ((1n<<256n)-1n).toString();
  await fill('position-id',largeId); await click('position-fetch'); await waitStatus('Position saved');
  assert.equal(await text('position-heading-id'),'Position #'+largeId);
  assert.match(await text('position-evidence'),/checked against the contracts/);
  assert.equal(await evaluate('window.positionRequests.length'),14);
  assert.equal(await evaluate(`window.positionRequests.filter(request=>request.method==='eth_call').every(request=>request.params[1]===${JSON.stringify(block.number)})`),true);
  assert.equal(await evaluate('document.documentElement.scrollWidth<=window.innerWidth'),true);
  await evaluate("window.positionRpcMode='invalid'"); await fill('position-id','37');
  await click('position-fetch'); await waitStatus('unsupported ABI');
  assert.equal(await text('position-heading-id'),'Position #'+largeId);
  await evaluate('window.restorePositionFetch()');
  await click('position-example'); await waitStatus('Position saved');
  await click('cl-reset'); await click('source-pool-tab');
  console.log('PASS: v3 source tabs, deterministic live reads, NFT precision, recorded files, exact display, explicit range seeding, provenance, exports, reload and failure recovery');
}

export async function checkMobilePositions({evaluate,click,fill,text}) {
  await click('source-position-tab');
  assert.equal(await evaluate("document.getElementById('position-setup').open"),false);
  await click('position-setup-summary');
  assert.equal(await evaluate("document.getElementById('position-setup').open"),true);
  await fill('position-id','0');
  assert.equal(await evaluate("document.getElementById('position-fetch').disabled"),true);
  await fill('position-id','37');
  await click('position-example');
  await evaluate("new Promise((resolve,reject)=>{const deadline=Date.now()+10000;const check=()=>{if(document.getElementById('position-lab').getAttribute('aria-busy')==='false'&&!document.getElementById('position-setup').open)resolve();else if(Date.now()>deadline)reject(new Error('Mobile position setup did not close'));else setTimeout(check,20)};check()})");
  assert.equal(await evaluate('document.activeElement.id'),'position-result');
  assert.equal(await text('position-state'),'Below range');
  assert.equal(await evaluate('document.documentElement.scrollWidth<=window.innerWidth'),true);
  const wallet=await text('portfolio');
  await click('position-apply');
  assert.equal(await text('cl-value'),'$24.92');
  assert.equal(await evaluate("document.getElementById('cl-setup-details').open"),false);
  assert.equal(await text('portfolio'),wallet);
  await click('cl-reset'); await click('lab-full-tab'); await click('source-pool-tab');
  console.log('PASS: mobile position editing, collapsed import controls, exact results and explicit range application');
}
