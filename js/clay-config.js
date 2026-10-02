const CROP_IDS=['wheat','corn','tomato','carrot','cabbage','pumpkin','eggplant','pepper'];
const STAGE_IDS=['sprout','growing','mature'];
const nonEmpty=value=>typeof value==='string'&&value.trim().length>0;

export function validateFarmConfig(config){
 const require=(valid,message)=>{if(!valid)throw new Error(`農場配置錯誤：${message}`);};
 require(config?.version===1,'不支援的版本');
 require(Array.isArray(config.stages)&&config.stages.length===STAGE_IDS.length,'需要幼苗、成長、成熟三個階段');
 config.stages.forEach((stage,i)=>require(stage?.id===STAGE_IDS[i]&&nonEmpty(stage.label)&&nonEmpty(stage.shortLabel),'階段名稱或順序不正確'));
 const growth=config.growth;
 require(growth&&Number.isInteger(growth.initialStage)&&growth.initialStage>=1&&growth.initialStage<=3,'initialStage 必須是 1 至 3');
 require(Number.isInteger(growth.dryOnEnteringStage)&&growth.dryOnEnteringStage>=2&&growth.dryOnEnteringStage<=3,'dryOnEnteringStage 必須是 2 或 3');
 require(typeof growth.pauseWhenDry==='boolean','pauseWhenDry 必須是布林值');
 require(Array.isArray(config.crops)&&config.crops.length===CROP_IDS.length,'需要 8 種作物');
 const seen=new Set();
 const crops=config.crops.map(crop=>{
  require(crop&&CROP_IDS.includes(crop.id)&&!seen.has(crop.id),'作物 ID 重複或不支援');seen.add(crop.id);
  require(nonEmpty(crop.label),`${crop.id} 缺少名稱`);
  require(Number.isInteger(crop.seeds)&&crop.seeds>=0,`${crop.id} 的 seeds 必須是非負整數`);
  require(crop.stageDurationSeconds&&typeof crop.stageDurationSeconds==='object',`${crop.id} 缺少各階段時間`);
  for(const [i,id] of STAGE_IDS.entries()){
   const duration=crop.stageDurationSeconds[id];
   require(Number.isFinite(duration)&&(i===STAGE_IDS.length-1?duration===0:duration>0),
    `${crop.id} 的 ${id} 秒數${i===STAGE_IDS.length-1?'必須是 0（成熟不倒數）':'必須大於 0'}`);
  }
  return {...crop,initialStage:growth.initialStage,iconIndex:CROP_IDS.indexOf(crop.id)};
 });
 return {...config,crops};
}

export async function loadFarmConfig(){
 const response=await fetch(new URL('../config/clay-farm.json',import.meta.url),{cache:'no-cache'});
 if(!response.ok)throw new Error(`農場配置載入失敗（${response.status}）`);
 return validateFarmConfig(await response.json());
}
