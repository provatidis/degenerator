import assert from 'node:assert/strict';

const settle=evaluate=>evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
const wait=(evaluate,condition)=>evaluate('new Promise((resolve,reject)=>{const deadline=Date.now()+10000;const check=()=>{if('+condition+')resolve();else if(Date.now()>deadline)reject(new Error("Navigation check timed out"));else setTimeout(check,20)};check()})');
async function headerVisible(evaluate){
 const geometry=await evaluate("(()=>{const r=document.querySelector('.topbar').getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:r.height,viewport:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth}})()");
 assert.ok(geometry.top>=-1&&geometry.bottom<=geometry.viewport,'Primary navigation stays visible.');assert.equal(geometry.overflow,false);return geometry;
}
async function targetClear(evaluate,id){
 await settle(evaluate);const header=await headerVisible(evaluate);
 const top=await evaluate('document.getElementById('+JSON.stringify(id)+').getBoundingClientRect().top');
 assert.ok(top>=header.bottom+10,id+' must clear the sticky header ('+top+' vs '+header.bottom+').');
 if(['lp-lab','range-lab'].includes(id)){const bottom=await evaluate("document.querySelector('.lab-switch').getBoundingClientRect().bottom");assert.ok(top>=bottom+10,id+' must also clear the lab tabs.');}
}
export async function checkNavigation({evaluate,click,fill,navigate,base,nextEvent,call}){
 await navigate(base+'#experiment');
 const storage=await evaluate("['defi-sandbox-v1','degenerator-experiments-v1'].map(key=>localStorage.getItem(key))");
 const completed=await evaluate("JSON.parse(localStorage.getItem('degenerator-learning-liquidity-v1')||'{\"completed\":[]}').completed");
 await click('nav-inspect');await settle(evaluate);assert.equal(await evaluate('location.hash'),'#inspect');assert.ok(await evaluate('scrollY<=1'));
 await evaluate('scrollTo(0,document.body.scrollHeight)');await click('nav-inspect');await settle(evaluate);assert.ok(await evaluate('scrollY<=1'),'Clicking the active primary link returns to its introduction.');
 await evaluate("document.querySelector('.workspace-links a[href=\"#lp-lab\"]').click()");await targetClear(evaluate,'lp-lab');
 const tabs=await evaluate("document.querySelector('.lab-switch').getBoundingClientRect().top");const header=await headerVisible(evaluate);assert.ok(tabs>=header.bottom+10,'Lab tabs sit below primary navigation.');
 await evaluate("document.getElementById('lab-full-tab').focus()");
 await call('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight'});await call('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowRight',code:'ArrowRight'});
 await targetClear(evaluate,'range-lab');assert.equal(await evaluate('document.activeElement.id'),'lab-range-tab');
 await evaluate("if(!document.querySelector('.cl-fee-details').open)document.querySelector('.cl-fee-details>summary').click()");
 await fill('cl-future','2400');await fill('cl-fees','25');await click('lab-full-tab');await fill('scenario-future','3570');await fill('scenario-fees','172');await click('lab-range-tab');
 const learned=nextEvent('Page.loadEventFired');await evaluate("document.querySelector('.site-nav a[href=\"learn.html\"]').click()");await learned;
 assert.equal(await evaluate("document.querySelector('h1').textContent"),'Liquidity essentials');
 await click('learn-resume');await targetClear(evaluate,'learn-lesson-title');
 const returned=nextEvent('Page.loadEventFired');await evaluate("document.querySelector('.product-nav a[href=\"./#experiment\"]').click()");await returned;
 await settle(evaluate);assert.ok(await evaluate('scrollY<=1'));assert.equal(await evaluate("document.getElementById('lab-range-tab').getAttribute('aria-selected')"),'true');
 assert.deepEqual(await evaluate("['scenario-future','scenario-fees','cl-future','cl-fees'].map(id=>document.getElementById(id).value)"),['3570','172','2400','25']);
 assert.deepEqual(await evaluate("['defi-sandbox-v1','degenerator-experiments-v1'].map(key=>localStorage.getItem(key))"),storage);
 assert.deepEqual(await evaluate("JSON.parse(localStorage.getItem('degenerator-learning-liquidity-v1')).completed"),completed);
 assert.equal(await evaluate("sessionStorage.getItem('degenerator-learn-return-v1')"),null,'A restored handoff is consumed.');
 // Shared scenario inputs remain authoritative even with a pending Learn draft.
 const learnedAgain=nextEvent('Page.loadEventFired');await evaluate("document.querySelector('.site-nav a[href=\"learn.html\"]').click()");await learnedAgain;
 await navigate(base+'#scenario=cp50-v1&investment=5000&start=2000&future=3333&fees=9');
 assert.equal(await evaluate("document.getElementById('scenario-future').value"),'3333');assert.equal(await evaluate("document.getElementById('scenario-fees').value"),'9');
 assert.ok(await evaluate("sessionStorage.getItem('degenerator-learn-return-v1')"));
 await navigate(base+'#experiment');assert.equal(await evaluate("document.getElementById('cl-future').value"),'2400');
 // Native history changes the workspace without dropping the primary navigation.
 await click('nav-inspect');await evaluate("document.querySelector('.brand').click()");await settle(evaluate);
 assert.equal(await evaluate('location.hash'),'#experiment');assert.equal(await evaluate("document.getElementById('cl-future').value"),'2400');
 await click('nav-inspect');await click('nav-experiment');
 await evaluate("new Promise(resolve=>{addEventListener('hashchange',resolve,{once:true});history.back()})");await settle(evaluate);assert.equal(await evaluate('location.hash'),'#inspect');assert.ok(await evaluate('scrollY<=1'));
 await evaluate("new Promise(resolve=>{addEventListener('hashchange',resolve,{once:true});history.forward()})");await settle(evaluate);assert.equal(await evaluate('location.hash'),'#experiment');assert.ok(await evaluate('scrollY<=1'));
 for(const id of ['saved-experiments','historical-case','swap-sandbox','pool-lab']){
   await navigate(base+'#'+id);await targetClear(evaluate,id);
 }
 await navigate(base+'#lp-lab');await click('scenario-reset');await click('lab-range-tab');await click('cl-reset');await click('lab-full-tab');
 console.log('PASS: primary navigation, sticky offsets, keyboard tabs, Learn-return drafts, explicit scenario precedence, browser history and deep links');
}
export async function checkMobileNavigation({evaluate,click,navigate,base,call}){
 for(const [width,height] of [[390,844],[320,740]]){
   await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});
   await navigate(base+'#range-lab');await targetClear(evaluate,'range-lab');
   const header=await headerVisible(evaluate);assert.ok(await evaluate("document.querySelector('.lab-switch').getBoundingClientRect().top")>=header.bottom+10);
   await click('nav-inspect');await settle(evaluate);assert.ok(await evaluate('scrollY<=1'));
   await click('nav-experiment');await settle(evaluate);assert.ok(await evaluate('scrollY<=1'));
   await navigate(base+'learn.html#lesson=range-boundaries');await click('learn-resume');await targetClear(evaluate,'learn-lesson-title');
   await click('learn-topics');await targetClear(evaluate,'learn-course');
 }
 await navigate(base+'#experiment');
 console.log('PASS: 390px/320px primary navigation, measured header offsets, lab tabs, lesson headings and topic list');
}
