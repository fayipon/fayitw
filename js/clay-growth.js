// Wall-clock growth is independent of rendering, selection and reduced motion.
export function createGrowthState(crop,stages,dry,now){
 const stage=crop.initialStage-1;
 const durationMs=crop.stageDurationSeconds[stages[stage].id]*1000;
 return {stage,dry,durationMs,remainingMs:durationMs,updatedAt:now};
}

export function growthRemainingMs(state,rules,now){
 const elapsed=state.dry&&rules.pauseWhenDry?0:Math.max(0,now-state.updatedAt);
 return Math.max(0,state.remainingMs-elapsed);
}

export function advanceGrowth(state,crop,config,now,force=false){
 const elapsed=Math.max(0,now-state.updatedAt);
 state.updatedAt=now;
 if(state.stage>=config.stages.length-1||(state.dry&&config.growth.pauseWhenDry))return false;
 state.remainingMs=Math.max(0,state.remainingMs-elapsed);
 if(!force&&state.remainingMs>0)return false;
 // A stage boundary can dry the soil, so never skip across it after a long sleep.
 state.stage++;
 state.durationMs=crop.stageDurationSeconds[config.stages[state.stage].id]*1000;
 state.remainingMs=state.durationMs;
 if(state.stage+1===config.growth.dryOnEnteringStage)state.dry=true;
 return true;
}

export function formatGrowthTime(milliseconds){
 const seconds=Math.max(0,Math.ceil(milliseconds/1000));
 if(seconds>=86400)return `${Math.floor(seconds/86400)}D${Math.floor(seconds%86400/3600)}H`;
 if(seconds>=3600)return `${Math.floor(seconds/3600)}H ${Math.floor(seconds%3600/60)}M`;
 if(seconds>=60)return `${Math.floor(seconds/60)}M${seconds%60}S`;
 return `${seconds}S`;
}
