import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {LEARN_RETURN_KEY,validateLearnReturn,readLearnReturn,saveLearnReturn,clearLearnReturn} from '../public/data/learn-return-drafts.js';
import {positionScenario} from '../public/data/position-snapshot.js';
const position=JSON.parse(await readFile(new URL('../public/examples/uniswap-v3-mainnet-fees.json',import.meta.url)));
const full={model:'cp50-v1',inputs:{investment:5000,initialPrice:2000,futurePrice:3570,fees:172},origin:null};
const range={model:'cl-range-v1',inputs:positionScenario(position),origin:{kind:'position',snapshot:position}};
const draft={version:1,activeModel:range.model,drafts:[full,range]};
const memory=()=>{const entries=new Map([['unrelated','keep']]);return {entries,getItem:key=>entries.get(key)||null,setItem:(key,value)=>entries.set(key,value),removeItem:key=>entries.delete(key)};};

test('working drafts round trip exact assumptions, active tool and retained provenance independently',()=>{
 const storage=memory();assert.equal(saveLearnReturn(draft,()=>storage),true);
 const restored=readLearnReturn(()=>storage);assert.equal(restored.status,'ready');assert.deepEqual(restored.draft,validateLearnReturn(draft));
 assert.equal(restored.draft.drafts[1].origin.snapshot.block.hash,position.block.hash);
 assert.equal(clearLearnReturn(()=>storage),true);assert.equal(storage.entries.has(LEARN_RETURN_KEY),false);assert.equal(storage.entries.get('unrelated'),'keep');
});
test('invalid inputs, duplicate models and mismatched position attribution cannot be restored',()=>{
 assert.throws(()=>validateLearnReturn({...draft,drafts:[full,full]}),/Duplicate/);
 assert.throws(()=>validateLearnReturn({...draft,activeModel:'unknown'}),/active/);
 assert.throws(()=>validateLearnReturn({...draft,drafts:[{...full,inputs:{...full.inputs,investment:-1}}]}));
 assert.throws(()=>validateLearnReturn({...draft,drafts:[{...range,inputs:{...range.inputs,initialPrice:3000}}]}),/source/);
});
test('damaged or future session entries are preserved and do not overwrite independent saved work',()=>{
 for(const raw of ['{',JSON.stringify({...draft,version:99})]){
   const storage=memory();storage.setItem(LEARN_RETURN_KEY,raw);assert.equal(readLearnReturn(()=>storage).draft,null);
   assert.equal(saveLearnReturn(draft,()=>storage),false);assert.equal(storage.getItem(LEARN_RETURN_KEY),raw);assert.equal(storage.getItem('unrelated'),'keep');
 }
});
test('blocked or full session storage leaves navigation usable',()=>{
 const blocked=()=>{throw new Error('blocked')};assert.equal(readLearnReturn(blocked).draft,null);assert.equal(saveLearnReturn(draft,blocked),false);assert.equal(clearLearnReturn(blocked),false);
 const fullStorage=memory();fullStorage.setItem=()=>{throw new Error('quota')};assert.equal(saveLearnReturn(draft,()=>fullStorage),false);assert.equal(fullStorage.getItem('unrelated'),'keep');
});
