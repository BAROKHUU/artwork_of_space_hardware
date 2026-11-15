/* One-shot scroll reveals. Default HTML stays visible if JS/Observer is unavailable.
   Add .reveal to an element; data-stagger on a parent assigns child delays.
   Optional .reveal-soft / .reveal-illustration and --reveal-delay customize motion. */
(() => {
  'use strict';
  const root=document.documentElement;
  const preference=matchMedia('(prefers-reduced-motion: reduce)');
  const mobile=matchMedia('(max-width: 820px)');
  const paused=()=>preference.matches||document.body.classList.contains('no-motion');
  const items=[...document.querySelectorAll('.reveal')];
  const depths=[...document.querySelectorAll('[data-depth]')];
  const hero=document.querySelector('.hero');
  let observer=null,frame=0;
  const timers=new Map();
  document.querySelectorAll('[data-stagger]').forEach(group=>{
    const step=Number(group.dataset.stagger)||90;
    [...group.children].filter(child=>child.classList.contains('reveal')).forEach((child,i)=>{
      child.style.setProperty('--reveal-delay',`${Math.min(i*step,450)}ms`);
    });
  });
  function settle(item){clearTimeout(timers.get(item));timers.delete(item);item.classList.add('is-visible','is-settled');observer?.unobserve(item);}
  function reveal(item,immediate=false){
    if(immediate||paused()){settle(item);return;}
    if(item.classList.contains('is-visible'))return;
    item.classList.add('is-visible');observer?.unobserve(item);
    timers.set(item,setTimeout(()=>settle(item),1550));
  }
  function finish(){items.forEach(settle);observer?.disconnect();depths.forEach(el=>el.style.setProperty('--depth-y','0px'));}
  function updateDepth(){
    frame=0;
    if(paused()||mobile.matches||document.hidden||!hero||document.querySelector('dialog[open]')){
      depths.forEach(el=>el.style.setProperty('--depth-y','0px'));return;
    }
    const rect=hero.getBoundingClientRect();
    if(rect.bottom<=0||rect.top>=innerHeight)return;
    const travelled=Math.max(0,-rect.top);
    depths.forEach(el=>{
      const value=Math.min(12,travelled*(Number(el.dataset.depth)||.015));
      el.style.setProperty('--depth-y',`${value.toFixed(2)}px`);
    });
  }
  function scheduleDepth(){if(!frame)frame=requestAnimationFrame(updateDepth);}
  if('IntersectionObserver' in globalThis&&!paused()){
    try{
      observer=new IntersectionObserver(entries=>entries.forEach(entry=>{
        if(entry.isIntersecting)reveal(entry.target);
      }),{threshold:.08,rootMargin:'0px 0px -18px 0px'});
      root.classList.add('reveal-ready');items.forEach(item=>observer.observe(item));
    }catch{root.classList.remove('reveal-ready');finish();}
  }else finish();
  document.addEventListener('focusin',event=>{
    let node=event.target;
    while(node&&node!==document){if(node.classList?.contains('reveal'))reveal(node,true);node=node.parentElement;}
  });
  function sync(){if(paused())finish();scheduleDepth();}
  preference.addEventListener('change',sync);mobile.addEventListener('change',scheduleDepth);
  new MutationObserver(sync).observe(document.body,{attributes:true,attributeFilter:['class']});
  addEventListener('scroll',scheduleDepth,{passive:true});addEventListener('resize',scheduleDepth,{passive:true});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){if(frame)cancelAnimationFrame(frame);frame=0;}else scheduleDepth();});
  addEventListener('pageshow',scheduleDepth);scheduleDepth();
})();
