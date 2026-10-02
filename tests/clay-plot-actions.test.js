import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlotActions } from '../js/clay-plot-actions.js';

function setup(){
 const created=[];
 const factory=kind=>()=>{
  const effect={kind,frames:[],update(now){this.frames.push(now);}};
  created.push(effect);return effect;
 };
 return {actions:createPlotActions({water:factory('water'),harvest:factory('harvest')}),created};
}

test('several plots water and harvest together while duplicate actions on one plot are rejected',()=>{
 const {actions,created}=setup();
 const first=actions.start(0,'water'),second=actions.start(1,'water'),third=actions.start(2,'harvest');
 assert.ok(first&&second&&third);
 assert.notEqual(first.effect,second.effect);
 assert.equal(actions.start(0,'water'),null);
 assert.equal(actions.start(0,'harvest'),null);
 assert.equal(created.length,3);
 actions.update(1250);
 for(const action of [first,second,third])assert.deepEqual(action.effect.frames,[1250]);
});

test('finishing one plot preserves other actions and only reuses an idle effect',()=>{
 const {actions,created}=setup();
 const first=actions.start(0,'water'),second=actions.start(1,'water');
 assert.equal(actions.finish(first),true);
 assert.equal(actions.has(0),false);
 assert.equal(actions.get(1),'water');
 const next=actions.start(2,'water');
 assert.equal(next.effect,first.effect);
 assert.notEqual(next.effect,second.effect);
 assert.equal(created.length,2);
 actions.finish(second);actions.finish(next);
 actions.update(2000);
 for(const effect of created)assert.deepEqual(effect.frames,[]);
});

test('a stale completion cannot unlock or release a newer action on the same plot',()=>{
 const {actions}=setup();
 const old=actions.start(3,'harvest');actions.finish(old);
 const current=actions.start(3,'water');
 assert.equal(actions.finish(old),false);
 assert.equal(actions.get(3),'water');
 assert.equal(actions.start(3,'harvest'),null);
 actions.update(500);
 assert.deepEqual(current.effect.frames,[500]);
 assert.deepEqual(old.effect.frames,[]);
});

test('failed effect creation leaves the plot available for another attempt',()=>{
 let attempts=0;
 const actions=createPlotActions({water:()=>{
  if(attempts++===0)throw new Error('Effect unavailable');
  return {update(){}};
 }});
 assert.throws(()=>actions.start(4,'water'),/Effect unavailable/);
 assert.equal(actions.has(4),false);
 assert.ok(actions.start(4,'water'));
});
