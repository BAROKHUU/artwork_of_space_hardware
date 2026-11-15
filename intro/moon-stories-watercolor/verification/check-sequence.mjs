import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import '../js/full-story-data.js';
import '../js/sequence.js';
const data=globalThis.MoonStoryData,{buildTimeline,stateAt,splitCaption}=globalThis.MoonTimeline;
const timeline=buildTimeline(data);
assert.deepEqual(data.map(s=>s.image),Array.from({length:22},(_,i)=>i+1));
assert.equal(timeline.authoredBeats,51);assert.equal(timeline.displayUnits,97);
assert.equal(timeline.segments.filter(s=>s.type==='image').length,22);
let beat=0;
for(const shot of data)for(const caption of shot.captions){
 beat++;const parts=timeline.segments.filter(s=>s.type==='caption'&&s.beat===beat);
 assert.equal(parts.map(s=>s.text).join(' '),caption.text);
 parts.forEach(p=>{assert.equal(p.speaker,caption.speaker);assert.equal(p.shot,shot.image-1);assert.ok(p.text.length<=38)});
}
assert.equal(stateAt(timeline,-100).shot,0);
assert.equal(stateAt(timeline,Infinity).shot,0);
const end=stateAt(timeline,timeline.total+100);
assert.equal(end.shot,21);assert.equal(end.text,'Your dreams decide how far you can go.');assert.equal(end.captionOpacity,1);
for(const seg of timeline.segments){
 const middle=(seg.start+seg.end)/2,s=stateAt(timeline,middle),reduced=stateAt(timeline,middle,true);
 assert.equal(s.shot,seg.shot);
 if(seg.type==='image'){assert.equal(s.captionOpacity,0);assert.ok(Math.abs(s.mix-.5)<1e-9);assert.ok([0,1].includes(reduced.mix));}
 else{assert.equal(s.text,seg.text);assert.equal(s.captionOpacity,1);assert.equal(reduced.captionOpacity,1);}
}
const positions=Array.from({length:5001},(_,i)=>i/5000*timeline.total);
const forward=positions.map(p=>stateAt(timeline,p));
for(let i=5000;i>=0;i--)assert.deepEqual(stateAt(timeline,positions[i]),forward[i]);
// Actual renderer exercised using a minimal DOM, simulated loads and scroll events.
const style=()=>({height:'',fontSize:'',opacity:0,zIndex:''});
const node=()=>({style:style(),dataset:{},textContent:'',hidden:false,clientWidth:700,classList:{toggle(){}},setAttribute(){},removeAttribute(){}});
const caption=node(),speaker=node(),group=node(),label=node(),stage=node();stage.offsetHeight=800;
const callbacks={},loads=[],frames=[],requests=[];
const slots=Array.from({length:3},()=>{const n=node();n.dataset={shot:'',ready:'false'};Object.defineProperty(n,'src',{set(v){requests.push(v);loads.push(()=>n.onload?.())}});n.removeAttribute=()=>{};return n;});
let context;
const section={style:style(),querySelector:()=>stage,querySelectorAll:()=>slots,getBoundingClientRect:()=>({top:800-context.scrollY}),scrollIntoView(){}};
context={MoonStoryData:data,scrollY:0,document:{getElementById:id=>({'story-sequence':section,caption,speaker,'scene-label':label}[id]),querySelector:()=>group,createElement:()=>({getContext:()=>({measureText:t=>({width:t.length*10}),font:''})})},getComputedStyle:()=>({fontSize:'36'}),matchMedia:()=>({matches:false,addEventListener(){}}),addEventListener:(event,fn,options)=>{callbacks[event]=fn;if(event==='scroll')assert.equal(options.passive,true)},requestAnimationFrame:fn=>{frames.push(fn);return frames.length}};
vm.runInNewContext(fs.readFileSync(new URL('../js/sequence.js',import.meta.url),'utf8'),context);
function flush(){let guard=0;while(loads.length||frames.length){while(loads.length)loads.shift()();while(frames.length)frames.shift()();assert.ok(++guard<20);}}
flush();assert.equal(requests.length,2,'Only opening and next image requested at startup');
assert.ok(parseFloat(section.style.height)>800*70,'Physical scroll track exists');
for(const index of [...Array(22).keys(),21,10,0]){
 const seg=timeline.segments.find(s=>s.type==='caption'&&s.shot===index);
 context.scrollY=800+(seg.start+seg.duration*.5)*544;callbacks.scroll();flush();
 assert.equal(stage.dataset.image,String(index+1));assert.equal(caption.textContent,seg.text);assert.equal(speaker.textContent,seg.speaker);
 assert.equal(Number(group.style.opacity),1);
 const actual=slots.filter(s=>s.dataset.shot!=='').map(s=>Number(s.dataset.shot)).sort((a,b)=>a-b);
 const expected=[index-1,index,index+1].filter(i=>i>=0&&i<22);
 assert.deepEqual(actual,expected);assert.equal(slots.filter(s=>Number(s.style.opacity)>0).length,1);
}
for(const seg of timeline.segments.filter(s=>s.type==='image'&&s.shot>0)){
 context.scrollY=800+(seg.start+seg.duration*.5)*544;callbacks.scroll();flush();
 assert.equal(slots.filter(s=>Number(s.style.opacity)>0).length,2);
 assert.equal(Number(group.style.opacity),0);
}
console.log('PASS: 22 ordered shots; 51 exact authored captions; 97 attributed display units; 5001 reversible positions; final hold; reduced motion; actual render/scroll path; preload window <=3 images; no more than 2 visible during crossfades.');

// Images must stay inside their own stacking context, below caption overlays.
const css = fs.readFileSync(new URL('../css/sequence.css', import.meta.url), 'utf8');
const rule = selector => css.slice(css.indexOf(selector+'{') + selector.length + 1).split('}')[0];
assert.match(rule('.illustration-stage'), /z-index:0;/);
assert.match(rule('.illustration-stage'), /isolation:isolate/);
assert.match(rule('.caption-shade'), /z-index:1;/);
assert.match(rule('.cinematic-caption'), /z-index:3;/);
assert.match(rule('.scene-marker'), /z-index:4;/);
console.log('PASS: image stacking context is below gradient, captions and speaker labels.');
