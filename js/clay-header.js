const rules=document.querySelector('#farm-rules');
document.querySelector('#farm-rules-open').addEventListener('click',()=>{
 rules.showModal();
 rules.querySelector('.farm-rules-scroll').scrollTop=0;
});
rules.addEventListener('keydown',event=>{
 if(event.key==='Escape')event.stopPropagation();
});
rules.addEventListener('click',event=>{
 if(event.target!==rules)return;
 const bounds=rules.getBoundingClientRect();
 if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)rules.close();
});
