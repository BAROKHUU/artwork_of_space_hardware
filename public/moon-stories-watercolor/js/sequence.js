/* Pure timeline math is shared by the renderer and non-GUI checks. */
(() => {
 'use strict';
 const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(n)?n:a));
 const ease=t=>t*t*(3-2*t);
 function splitCaption(text,limit=38){
  const words=text.split(/\s+/),parts=[];let line='';
  for(const word of words){if(line&&(line+' '+word).length>limit){parts.push(line);line=word;}else line+=(line?' ':'')+word;}
  if(line)parts.push(line);
  return parts;
 }
 function buildTimeline(shots){
  const segments=[];let cursor=0,beat=0;
  const add=segment=>{segment.start=cursor;cursor+=segment.duration;segment.end=cursor;segments.push(segment);};
  shots.forEach((shot,index)=>{
   const slow=shot.image>=11&&shot.image<=13,hopeful=shot.image>=16&&shot.image<=20;
   add({type:'image',shot:index,previous:index-1,duration:slow?.95:.65});
   shot.captions.forEach((caption,captionIndex)=>{
    const parts=splitCaption(caption.text);beat++;
    parts.forEach((text,part)=>add({type:'caption',shot:index,speaker:caption.speaker,text,beat,part,parts:parts.length,emphasis:caption.text==='FIND YOU IN THE UNIVERSE!'||caption.text==='Or maybe... YOU!',final:index===shots.length-1&&captionIndex===shot.captions.length-1&&part===parts.length-1,duration:slow?1.35:hopeful?.95:1.12}));
   });
  });
  // A quiet ending with the final words held; never auto-return to the cover.
  const last=segments.at(-1);add({...last,type:'ending',duration:2.2,final:true});
  return {segments,total:cursor,authoredBeats:beat,displayUnits:segments.filter(s=>s.type==='caption').length};
 }
 function stateAt(timeline,position,reduced=false){
  const p=clamp(position,0,timeline.total);let lo=0,hi=timeline.segments.length-1;
  while(lo<hi){const mid=Math.floor((lo+hi)/2);if(p>=timeline.segments[mid].end)lo=mid+1;else hi=mid;}
  const segment=timeline.segments[lo],local=clamp((p-segment.start)/segment.duration);
  if(segment.type==='image'){
   const mix=reduced?Number(local>=.5):ease(local);
   return {segment,shot:segment.shot,previous:segment.previous,mix,captionOpacity:0,text:'',speaker:'',emphasis:false};
  }
  const alpha=reduced?1:segment.type==='ending'?1:Math.min(ease(clamp(local/.16)),segment.final?1:ease(clamp((1-local)/.16)));
  return {segment,shot:segment.shot,previous:-1,mix:1,captionOpacity:alpha,text:segment.text,speaker:segment.speaker,emphasis:segment.emphasis};
 }
 globalThis.MoonTimeline={splitCaption,buildTimeline,stateAt};
 if(typeof document==='undefined')return;
 const shots=globalThis.MoonStoryData,timeline=buildTimeline(shots);
 const section=document.getElementById('story-sequence'),stage=section.querySelector('.sticky-stage');
 const slots=[...section.querySelectorAll('.story-image')];
 const caption=document.getElementById('caption'),speaker=document.getElementById('speaker');
 const captionGroup=document.querySelector('.cinematic-caption'),sceneLabel=document.getElementById('scene-label');
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let top=0,unit=1,raf=0,lastText='',lastShot=-1,lastSpeaker='';
 const requestRender=()=>{if(!raf)raf=requestAnimationFrame(render);};
 function assign(slot,index){
  slot.dataset.shot=String(index);slot.dataset.ready='false';slot.style.opacity='0';
  slot.alt=shots[index].description;slot.loading='eager';slot.decoding='async';
  const expected=String(index);
  slot.onload=()=>{const done=()=>{if(slot.dataset.shot===expected){slot.dataset.ready='true';requestRender();}};if(slot.decode)slot.decode().then(done,done);else done();};
  slot.onerror=()=>{if(slot.dataset.shot===expected){slot.dataset.ready='error';requestRender();}};
  slot.src=shots[index].src;
 }
 function prepareImages(index){
  const wanted=[index,index-1,index+1].filter(i=>i>=0&&i<shots.length);
  wanted.forEach(i=>{if(!slots.some(s=>Number(s.dataset.shot)===i&&s.dataset.shot!=='')){const free=slots.find(s=>s.dataset.shot===''||!wanted.includes(Number(s.dataset.shot)));if(free)assign(free,i);}});
  slots.forEach(s=>{if(s.dataset.shot!==''&&!wanted.includes(Number(s.dataset.shot))){s.removeAttribute('src');s.dataset.shot='';s.dataset.ready='false';}});
 }
 // Fit is measured only when caption/font/viewport changes, never on every scroll.
 const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
 function fitCaption(){
  caption.style.fontSize='';if(!ctx||!lastText)return;
  const style=getComputedStyle(caption),width=caption.clientWidth;let size=parseFloat(style.fontSize);
  function linesAt(px){ctx.font=`700 ${px}px "Cabin Sketch", Georgia`;let lines=1,line='';for(const word of lastText.split(' ')){const next=line?line+' '+word:word;if(line&&ctx.measureText(next).width>width){lines++;line=word;}else line=next;}return lines;}
  while(size>22&&linesAt(size)>2)size-=.5;
  caption.style.fontSize=size+'px';
 }
 function measure(){
  const view=stage.offsetHeight;unit=Math.max(1,view*.68);
  section.style.height=(timeline.total*unit+view)+'px';
  top=section.getBoundingClientRect().top+scrollY;
  fitCaption();requestRender();
 }
 function render(){
  raf=0;const state=stateAt(timeline,(scrollY-top)/unit,reduced.matches);
  prepareImages(state.shot);
  const current=slots.find(s=>Number(s.dataset.shot)===state.shot&&s.dataset.shot!=='');
  const ready=current?.dataset.ready==='true';
  stage.dataset.assetError=String(current?.dataset.ready==='error');
  slots.forEach(slot=>{
   const i=slot.dataset.shot===''?-99:Number(slot.dataset.shot);
   let opacity=i===state.shot?state.mix:i===state.previous?1:0;
   slot.style.zIndex=i===state.shot?'2':i===state.previous?'1':'0';
   if(!ready&&i===state.previous)opacity=1;
   slot.style.opacity=slot.dataset.ready==='true'?opacity:0;
   slot.setAttribute('aria-hidden',String(i!==state.shot));
  });
  if(lastText!==state.text){lastText=state.text;caption.textContent=state.text;caption.classList.toggle('emphasis',state.emphasis);fitCaption();}
  if(lastSpeaker!==state.speaker){lastSpeaker=state.speaker;speaker.textContent=state.speaker;speaker.hidden=!state.speaker;}
  captionGroup.style.opacity=ready?state.captionOpacity:0;
  if(lastShot!==state.shot){lastShot=state.shot;sceneLabel.textContent=shots[state.shot].scene;stage.dataset.image=String(shots[state.shot].image);}
 }
 addEventListener('scroll',requestRender,{passive:true});addEventListener('resize',measure,{passive:true});addEventListener('pageshow',measure);
 reduced.addEventListener('change',requestRender);
 if(document.fonts)document.fonts.ready.then(()=>{fitCaption();requestRender();});
 globalThis.MoonStory={open(){section.scrollIntoView({behavior:'auto'});}};
 measure();render();
})();
