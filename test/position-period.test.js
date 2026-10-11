import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validatePositionPeriod,periodModelPoint} from '../public/data/position-period.js';
import {calculateFixedPositionPeriod} from '../public/models/fixed-position-period.js';
import {periodPointView} from '../public/lib/period-presentation.js';
const record=JSON.parse(await readFile(new URL('../public/examples/uniswap-v3-position-period.json',import.meta.url)));
const copy=()=>structuredClone(record);

test('recorded period reproduces independently checked fees and contract range time',()=>{
 const period=validatePositionPeriod(record),result=periodPointView(period,8);
 assert.equal(period.points.length,9);assert.equal(result.earned0,112674n);assert.equal(result.earned1,896672855663157n);
 assert.equal(result.durationSeconds,4992);assert.equal(result.secondsInRange,4992);
 assert.deepEqual(period.validation.roundingDeltaRaw,['1','1']);
 assert.ok(Math.abs(result.feesUSD-2.357246933034502)<.00001);
 assert.deepEqual(result.holding,{amount0:22046660876n,amount1:10283485726696667741n});
});
test('the initial checkpoint excludes previously accrued fees and keeps identical principal baskets',()=>{
 const period=validatePositionPeriod(record),view=periodPointView(period,0);
 assert.deepEqual(view.principal,view.holding);assert.equal(view.earned0,0n);assert.equal(view.earned1,0n);assert.equal(view.lpUSD,view.holdingUSD);assert.equal(view.gapUSD,0);
 assert.ok(BigInt(period.points[0].snapshot.fees.accrued0Raw)>0n);
});
test('holding keeps the initial token basket at every checkpoint and period fees remain separate tokens',()=>{
 const period=validatePositionPeriod(record),initial=periodPointView(period,0);
 for(let i=0;i<period.points.length;i++){
   const view=periodPointView(period,i);assert.deepEqual(view.holding,initial.holding);
   assert.equal(view.lpUSD,view.principalUSD+view.feesUSD);
   assert.ok(view.durationSeconds>=view.secondsInRange);assert.ok(view.feesUSD>=0);
 }
 assert.throws(()=>periodPointView(period,9),/checkpoint/);
});
test('continuity evidence must cover every block and reject any position update',()=>{
 for(const mutate of [p=>p.eventQueries[0].fromBlock=String(BigInt(p.eventQueries[0].fromBlock)+1n),p=>p.eventQueries[0].toBlock=String(BigInt(p.eventQueries[0].toBlock)-1n),p=>p.eventQueries[0].matchingEvents=1,p=>p.eventQueries=[]]){
   const p=copy();mutate(p);assert.throws(()=>validatePositionPeriod(p),/continuity/);
 }
 const changed=copy();changed.points[1].snapshot.position.tokensOwed0='1';changed.points[1].snapshot.fees.collectable0Raw=String(BigInt(changed.points[1].snapshot.fees.collectable0Raw)+1n);assert.throws(()=>validatePositionPeriod(changed),/accounting changed/);
});
test('changed fee checks, summaries and unordered checkpoints cannot become a replay',()=>{
 const p=copy();p.points[2].simulatedCollect[0]='0';assert.throws(()=>validatePositionPeriod(p),/independent check/);
 const altered=copy();altered.validation.earnedRaw[0]='999';assert.throws(()=>validatePositionPeriod(altered),/summary/);
 const reordered=copy();[reordered.points[1],reordered.points[2]]=[reordered.points[2],reordered.points[1]];assert.throws(()=>validatePositionPeriod(reordered),/ordered/);
 const wrong=copy();wrong.chainId=42161;assert.throws(()=>validatePositionPeriod(wrong),/Unsupported/);
});
test('range-time counters wrap at uint32 and impossible duration is rejected',()=>{
 const start=periodModelPoint(record.points[0]),end={...start,timestamp:start.timestamp+30,secondsInside:14n};
 start.secondsInside=(1n<<32n)-16n;
 const result=calculateFixedPositionPeriod(start,end);assert.equal(result.secondsInRange,30);
 assert.throws(()=>calculateFixedPositionPeriod(start,{...end,timestamp:start.timestamp+20}),/exceeds/);
 assert.throws(()=>calculateFixedPositionPeriod(start,{...end,liquidity:start.liquidity+1n}),/unchanged/);
 assert.throws(()=>calculateFixedPositionPeriod(start,{...end,secondsInside:-1n}),/counters/);
});
