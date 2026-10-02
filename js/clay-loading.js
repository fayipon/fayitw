// Progress follows completed preparation stages, including their fallbacks.
// It does not estimate network bytes or advance on a timer.
const stages=[
 ['config','正在讀取種子與成長設定…'],
 ['soil','正在鬆整田土…'],
 ['grass','正在鋪上柔軟的草地…'],
 ['fence','正在圍起小小農田…'],
 ['trellis','正在架起庭院木格柵…'],
 ['apple','正在種下蘋果樹…'],
 ['cottage','正在安置鄉村小屋…'],
 ['shed','正在整理藍瓦工具棚…'],
 ['hay','正在堆放金黃稻草…'],
 ['windmill','正在讓風車轉起來…'],
 ['rocks','正在擺放溪岸石塊…'],
 ['dock','正在搭建小碼頭…'],
 ['river','正在引入清澈的溪水…'],
 ['paths','正在鋪好泥土小徑…'],
 ['waterPlants','正在種下荷花與水草…'],
 ['fish','正在讓小魚游進河道…'],
 ['trees','正在種下大大小小的樹…'],
 ['backdrop','正在展開遠方的山景…'],
 ['clouds','正在把雲朵放上天空…'],
];

export function createFarmLoading(){
 const farm=document.querySelector('#farm'),screen=document.querySelector('#loading');
 const scene=document.querySelector('#farm-scene'),status=document.querySelector('#loading-status');
 const stageLabel=document.querySelector('#loading-stage');
 const progress=document.querySelector('#loading-progress'),percent=document.querySelector('#loading-percent');
 const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
 const setProgress=value=>{progress.value=value;percent.textContent=`${value}%`;};
 const setStatus=message=>{status.textContent=message;stageLabel.textContent=message;};
 document.querySelector('#loading-retry').onclick=()=>location.reload();
 return {
  start(id){
   const index=stages.findIndex(stage=>stage[0]===id);
   if(index<0)throw new Error(`Unknown farm loading stage: ${id}`);
   setStatus(stages[index][1]);setProgress(Math.round(index/stages.length*100));
  },
  finish(){
   setProgress(100);setStatus('農場準備好了，歡迎回家。');
   // Paint the completed scene before uncovering it.
   requestAnimationFrame(()=>requestAnimationFrame(()=>{
    farm.classList.add('is-ready');farm.setAttribute('aria-busy','false');
    scene.inert=false;scene.removeAttribute('aria-hidden');
    const focused=screen.contains(document.activeElement);
    if(focused)document.querySelector('.back').focus({preventScroll:true});
    screen.inert=true;
    setTimeout(()=>{screen.hidden=true;},reducedMotion.matches?0:500);
   }));
  },
  fail(message){
   farm.setAttribute('aria-busy','false');screen.classList.add('has-error');
   document.querySelector('#loading-title').textContent='農場還沒準備好';
   setStatus(message);progress.hidden=true;percent.hidden=true;
   document.querySelector('#loading-retry').hidden=false;
  },
 };
}
