import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateFarmConfig} from '../js/clay-config.js';
import {createGrowthState,advanceGrowth,growthRemainingMs,formatGrowthTime} from '../js/clay-growth.js';

const raw=JSON.parse(await readFile(new URL('../config/clay-farm.json',import.meta.url),'utf8'));
const config=validateFarmConfig(raw);
const crop=config.crops[0];

test('all eight configured crops start as seedlings and take one wet minute per stage',()=>{
 assert.equal(config.crops.length,8);
 assert.equal(new Set(config.crops.map(crop=>crop.id)).size,8);
 for(const type of config.crops){
  const state=createGrowthState(type,config.stages,false,0);
  assert.equal(state.stage,0);assert.equal(state.remainingMs,60000);
  assert.equal(advanceGrowth(state,type,config,59999),false);
  assert.equal(advanceGrowth(state,type,config,60000),true);
  assert.equal(state.stage,1);assert.equal(state.dry,true);assert.equal(state.remainingMs,60000);
  // Ten minutes without watering must not mature the crop.
  assert.equal(advanceGrowth(state,type,config,660000),false);
  assert.equal(state.stage,1);assert.equal(state.remainingMs,60000);
  state.dry=false;state.updatedAt=660000;
  assert.equal(advanceGrowth(state,type,config,719999),false);
  assert.equal(advanceGrowth(state,type,config,720000),true);
  assert.equal(state.stage,2);assert.equal(state.remainingMs,0);
  assert.equal(advanceGrowth(state,type,config,900000,true),false);
 }
});

test('debug-dried seedlings pause; later drying preserves partial progress',()=>{
 const state=createGrowthState(crop,config.stages,true,0);
 advanceGrowth(state,crop,config,300000);
 assert.equal(growthRemainingMs(state,config.growth,600000),60000);
 state.dry=false;state.updatedAt=600000;
 advanceGrowth(state,crop,config,620000);
 state.dry=true;
 advanceGrowth(state,crop,config,920000);
 assert.equal(state.remainingMs,40000);
 state.dry=false;state.updatedAt=920000;
 assert.equal(advanceGrowth(state,crop,config,959999),false);
 assert.equal(advanceGrowth(state,crop,config,960000),true);
});

test('delayed background ticks stop at the mandatory watering boundary',()=>{
 const state=createGrowthState(crop,config.stages,false,0);
 advanceGrowth(state,crop,config,3600000);
 assert.equal(state.stage,1);assert.equal(state.dry,true);assert.equal(state.remainingMs,60000);
});

test('debug advancement applies the same drying rule without advancing another plot',()=>{
 const a=createGrowthState(crop,config.stages,false,0),b=createGrowthState(crop,config.stages,false,10000);
 advanceGrowth(a,crop,config,15000,true);
 advanceGrowth(b,crop,config,15000);
 assert.equal(a.stage,1);assert.equal(a.dry,true);
 assert.equal(b.stage,0);assert.equal(b.remainingMs,55000);
 assert.equal(advanceGrowth(a,crop,config,20000,true),false);
});

test('replanting creates a fresh one-minute seedling clock',()=>{
 const old=createGrowthState(crop,config.stages,false,0);
 advanceGrowth(old,crop,config,60000);
 const replacement=createGrowthState(crop,config.stages,false,90000);
 assert.equal(replacement.stage,0);assert.equal(replacement.remainingMs,60000);assert.equal(replacement.dry,false);
 advanceGrowth(replacement,crop,config,91000);
 assert.equal(replacement.remainingMs,59000);
});

test('each crop and each stage use their own duration, independent of sprite order',()=>{
 const modified=structuredClone(raw);
 modified.crops[0].seeds=99;
 modified.crops[0].stageDurationSeconds={sprout:15,growing:90,mature:0};
 modified.crops[1].stageDurationSeconds={sprout:30,growing:120,mature:0};
 modified.crops.reverse();
 const loaded=validateFarmConfig(modified),wheat=loaded.crops.find(crop=>crop.id==='wheat');
 assert.equal(wheat.seeds,99);assert.equal(wheat.iconIndex,0);
 const wheatState=createGrowthState(wheat,loaded.stages,false,0);
 assert.equal(wheatState.remainingMs,15000);
 advanceGrowth(wheatState,wheat,loaded,15000);
 assert.equal(wheatState.remainingMs,90000);assert.equal(wheatState.durationMs,90000);
 wheatState.dry=false;
 assert.equal(advanceGrowth(wheatState,wheat,loaded,104999),false);
 assert.equal(advanceGrowth(wheatState,wheat,loaded,105000),true);
 assert.equal(wheatState.stage,2);assert.equal(wheatState.remainingMs,0);
 const corn=loaded.crops.find(crop=>crop.id==='corn'),cornState=createGrowthState(corn,loaded.stages,false,0);
 assert.equal(cornState.remainingMs,30000);
 advanceGrowth(cornState,corn,loaded,30000);
 assert.equal(cornState.remainingMs,120000);
 assert.deepEqual(loaded.crops.find(crop=>crop.id==='tomato').stageDurationSeconds,{sprout:60,growing:60,mature:0});
});

test('reject invalid crop counts, duplicate IDs, durations, quantities and stages',()=>{
 for(const mutate of [
  c=>c.crops.pop(),c=>c.crops[0].id='corn',c=>c.crops[0].stageDurationSeconds.sprout=0,
  c=>c.crops[0].seeds=-1,c=>c.growth.initialStage=0,c=>c.stages.reverse(),
  c=>c.crops[0].stageDurationSeconds.growing='60',c=>delete c.crops[0].stageDurationSeconds.growing,
  c=>c.crops[0].stageDurationSeconds.mature=60,
 ]){
  const broken=structuredClone(raw);mutate(broken);assert.throws(()=>validateFarmConfig(broken),/農場配置錯誤/);
 }
});

test('countdown rounds upward and never goes negative',()=>{
 assert.equal(formatGrowthTime(60000),'1M0S');assert.equal(formatGrowthTime(59999),'1M0S');
 assert.equal(formatGrowthTime(1000),'1S');assert.equal(formatGrowthTime(1),'1S');
 assert.equal(formatGrowthTime(0),'0S');assert.equal(formatGrowthTime(-100),'0S');
});

test('countdown uses day/hour, hour/minute, minute/second and seconds at their boundaries',()=>{
 for(const [seconds,expected] of [
  [59,'59S'],[60,'1M0S'],[61,'1M1S'],[3599,'59M59S'],
  [3600,'1H 0M'],[3660,'1H 1M'],[86399,'23H 59M'],
  [86400,'1D0H'],[169200,'1D23H'],[172800,'2D0H'],
 ])assert.equal(formatGrowthTime(seconds*1000),expected);
});
