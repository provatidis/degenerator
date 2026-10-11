import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { EXPERIMENTS_KEY, MAX_LIBRARY_BYTES, emptyLibrary, validateExperimentDraft, validateExperiment, validateLibrary, libraryJSON, parseLibrary, readLibrary, writeLibrary, createExperiment, addExperiment, editExperiment, removeExperiment, mergeLibraries } from '../public/data/saved-experiments.js';
import { experimentView, defaultExperimentName, comparisonContext } from '../public/lib/saved-experiments.js';
import { DEFAULT_SCENARIO } from '../public/models/cp50-v1.js';
import { DEFAULT_RANGE } from '../public/models/cl-range-v1.js';
import { positionScenario } from '../public/data/position-snapshot.js';
import { snapshotView } from '../public/data/snapshot.js';

const now = '2026-10-11T12:00:00.000Z', later = '2026-10-11T13:00:00.000Z';
const id = n => '00000000-0000-4000-8000-' + String(n).padStart(12,'0');
const fullDraft = { model: 'cp50-v1', inputs: DEFAULT_SCENARIO, origin: null };
const rangeDraft = { model: 'cl-range-v1', inputs: DEFAULT_RANGE, origin: null };
const make = (n, draft = fullDraft, name = 'Experiment ' + n) => createExperiment(draft, name, 'Reasoning\nAnother assumption', { id:id(n), now });
const pool = JSON.parse(await readFile(new URL('../public/examples/uniswap-v2-mainnet.json',import.meta.url)));
const position = JSON.parse(await readFile(new URL('../public/examples/uniswap-v3-mainnet-fees.json',import.meta.url)));

test('experiment files preserve exact inputs, names, notes and model versions while dropping derived fields', () => {
  const full=make(1),range=make(2,rangeDraft);
  const library=addExperiment(addExperiment(emptyLibrary(),full),range);
  assert.deepEqual(parseLibrary(libraryJSON(library)),library);
  assert.deepEqual(library.experiments.map(entry=>entry.id),[id(2),id(1)]);
  const clean=validateExperiment({...full,lpValue:1,inputs:{...full.inputs,lpValue:1}});
  assert.deepEqual(clean,full);
  assert.equal(experimentView(clean).result.lpValue,7171.067811865476);
});
test('names, notes, IDs, dates, models and assumptions must validate before storage', () => {
  const entry=make(1);
  for(const patch of [{name:'  '},{name:'a'.repeat(81)},{name:'two\nlines'},{notes:'a'.repeat(1001)},{notes:'\u0000'},{id:'invalid'},{createdAt:'bad'},{updatedAt:'2020-01-01T00:00:00Z'},{model:'unknown-v2'},{inputs:{...entry.inputs,investment:NaN}}]) assert.throws(()=>validateExperiment({...entry,...patch}));
  assert.equal(validateExperiment({...entry,name:'  My setup  ',notes:'  Reason\nwhy  '}).name,'My setup');
  assert.equal(validateExperiment({...entry,notes:'  Reason\nwhy  '}).notes,'Reason\nwhy');
});
test('source snapshots are retained and must support the saved starting assumptions', () => {
  const draft={model:'cl-range-v1',inputs:{...positionScenario(position),futurePrice:2800,fees:20},origin:{kind:'position',snapshot:position}};
  const entry=make(1,draft);
  assert.deepEqual(parseLibrary(libraryJSON(addExperiment(emptyLibrary(),entry))).experiments[0].origin.snapshot,position);
  for(const key of ['investment','initialPrice','lowerPrice','upperPrice']) assert.throws(()=>validateExperimentDraft({...draft,inputs:{...draft.inputs,[key]:draft.inputs[key]+1}}),/does not match/);
  assert.throws(()=>validateExperimentDraft({...draft,model:'cp50-v1'}),/unsupported source/);
  assert.throws(()=>validateExperimentDraft({...draft,origin:{kind:'position',snapshot:{...position,fees:{...position.fees,accrued0Raw:'1'}}}}),/fee estimate/);
  assert.equal(experimentView(entry).result.fees,20);
  assert.equal(entry.origin.snapshot.fees.collectable0Raw,'524593');
});
test('a pool source is a price reference, not a claim about investment size or hypothetical range', () => {
  const initialPrice=snapshotView(pool).ethPrice;
  for(const draft of [fullDraft,rangeDraft]) {
    const candidate={...draft,inputs:{...draft.inputs,initialPrice},origin:{kind:'pool',snapshot:pool}};
    assert.equal(validateExperimentDraft(candidate).origin.snapshot.block.number,pool.block.number);
    assert.throws(()=>validateExperimentDraft({...candidate,inputs:{...candidate.inputs,initialPrice:2000}}),/starting price/);
  }
});
test('editing name or notes never changes saved inputs and rejects concurrent changes', () => {
  const entry=make(1),library=addExperiment(emptyLibrary(),entry);
  const edited=editExperiment(library,entry,'Renamed','New reasoning',later);
  assert.deepEqual(edited.experiments[0].inputs,entry.inputs);
  assert.equal(edited.experiments[0].createdAt,now);
  assert.equal(edited.experiments[0].updatedAt,later);
  assert.equal(library.experiments[0].name,'Experiment 1');
  assert.throws(()=>editExperiment(edited,entry,'Stale','',later),/another tab/);
  assert.throws(()=>removeExperiment(edited,entry),/another tab/);
});
test('removal and undo can be applied without mutating the original library', () => {
  const entry=make(1),library=addExperiment(emptyLibrary(),entry);
  const removed=removeExperiment(library,entry);
  assert.equal(removed.experiments.length,0); assert.equal(library.experiments.length,1);
  assert.deepEqual(addExperiment(removed,entry),library);
});
test('imports deduplicate identical IDs and preserve conflicting versions as independent copies', () => {
  const entry=make(1),existing=addExperiment(emptyLibrary(),entry);
  assert.equal(mergeLibraries(existing,existing).added,0);
  const changed={...entry,name:'Edited elsewhere',inputs:{...entry.inputs,fees:500}};
  const merged=mergeLibraries(existing,addExperiment(emptyLibrary(),changed),()=>id(2));
  assert.equal(merged.added,1); assert.equal(merged.copies,1);
  assert.equal(merged.library.experiments[0].id,id(2));
  assert.equal(merged.library.experiments[0].inputs.fees,500);
  assert.equal(merged.library.experiments[1].inputs.fees,100);
  assert.deepEqual(existing.experiments,[entry]);
});
test('capacity, repeated IDs, malformed JSON and unknown versions fail atomically', () => {
  const full={...emptyLibrary(),experiments:Array.from({length:50},(_,n)=>make(n+1))};
  assert.equal(validateLibrary(full).experiments.length,50);
  assert.throws(()=>addExperiment(full,make(51)),/at most 50/);
  assert.throws(()=>mergeLibraries(full,addExperiment(emptyLibrary(),make(51))),/at most 50/);
  assert.equal(full.experiments.length,50);
  assert.throws(()=>validateLibrary({...emptyLibrary(),experiments:[make(1),make(1)]}),/repeated IDs/);
  assert.throws(()=>parseLibrary('{'),/valid JSON/);
  assert.throws(()=>parseLibrary(JSON.stringify({...emptyLibrary(),version:2})),/unsupported version/);
  assert.throws(()=>parseLibrary(' '.repeat(MAX_LIBRARY_BYTES+1)),/512 KB/);
});
test('library storage is isolated and unavailable, invalid and newer saves remain distinct', () => {
  const values=new Map([['defi-sandbox-v1','wallet'],['degenerator-learning-liquidity-v1','lessons'],['degenerator-pool-snapshot-v1','pool'],['degenerator-v3-position-snapshot-v1','position']]);
  const storage=()=>({getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)});
  assert.equal(readLibrary(storage).status,'empty');
  const library=addExperiment(emptyLibrary(),make(1));assert.equal(writeLibrary(library,storage),true);
  assert.deepEqual(readLibrary(storage).library,library);
  assert.deepEqual([...values.keys()].filter(key=>key!==EXPERIMENTS_KEY),['defi-sandbox-v1','degenerator-learning-liquidity-v1','degenerator-pool-snapshot-v1','degenerator-v3-position-snapshot-v1']);
  values.set(EXPERIMENTS_KEY,'{');assert.equal(readLibrary(storage).status,'invalid');assert.equal(values.get(EXPERIMENTS_KEY),'{');
  const future=JSON.stringify({...emptyLibrary(),version:99});values.set(EXPERIMENTS_KEY,future);
  assert.equal(readLibrary(storage).status,'incompatible');assert.equal(values.get(EXPERIMENTS_KEY),future);
  const blocked=()=>{throw Error('blocked')};assert.equal(readLibrary(blocked).status,'unavailable');assert.equal(writeLibrary(library,blocked),false);
  assert.equal(values.get(EXPERIMENTS_KEY),future);
});
test('comparisons distinguish a common starting basket from different price scenarios and ranges', () => {
  const full=make(1),fees=make(2,{...fullDraft,inputs:{...DEFAULT_SCENARIO,fees:500}});
  assert.match(comparisonContext([full,fees]),/share the same starting token basket and future/);
  assert.match(comparisonContext([full,make(3,{...fullDraft,inputs:{...DEFAULT_SCENARIO,futurePrice:1000}})]),/different future prices/);
  const range=make(4,{...rangeDraft,inputs:{...DEFAULT_RANGE,futurePrice:4000}});
  assert.match(comparisonContext([full,range]),/different budgets, prices or token mixes/);
  const symmetric=make(5,{...rangeDraft,inputs:{...DEFAULT_RANGE,lowerPrice:1000,upperPrice:4000,futurePrice:4000}});
  assert.match(comparisonContext([full,symmetric]),/share the same starting token basket/);
  assert.match(comparisonContext([full,make(6,{...fullDraft,inputs:{...DEFAULT_SCENARIO,investment:5000.01}})]),/different budgets/);
});
test('suggested names expose relevant assumptions and stay valid even for uint256 NFT IDs', () => {
  assert.notEqual(defaultExperimentName(fullDraft),defaultExperimentName({...fullDraft,inputs:{...DEFAULT_SCENARIO,fees:0}}));
  assert.match(defaultExperimentName(rangeDraft),/Range.*1,800.*2,200/);
  const source={model:'cl-range-v1',inputs:positionScenario(position),origin:{kind:'position',snapshot:{...position,tokenId:((1n<<256n)-1n).toString()}}};
  const name=defaultExperimentName(source);assert.ok(name.length<=80);
  assert.match(name,/Position #.*….*range experiment/);
  assert.equal(createExperiment(source,name,'',{id:id(1),now}).name,name);
});
