// One lock per plot, with independent reusable effects for simultaneous actions.
export function createPlotActions(factories){
 const active=new Map(),idle=new Map(Object.keys(factories).map(kind=>[kind,[]]));
 return {
  has:index=>active.has(index),
  get:index=>active.get(index)?.kind??null,
  start(index,kind){
   if(active.has(index))return null;
   const pool=idle.get(kind);
   if(!pool)throw new Error(`Unknown plot action: ${kind}`);
   const action={index,kind,effect:pool.pop()??factories[kind]()};
   active.set(index,action);return action;
  },
  finish(action){
   // An old completion must never release a newer operation on this plot.
   if(active.get(action.index)!==action)return false;
   active.delete(action.index);idle.get(action.kind).push(action.effect);return true;
  },
  update(now){
   for(const {effect} of active.values())effect.update(now);
  },
 };
}
