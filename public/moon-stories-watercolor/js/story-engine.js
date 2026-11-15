/* Build-free scene infrastructure. All narration lives in story-data.js. */
(() => {
  'use strict';
  class DialogueState {
    constructor(lines) { if (!lines.length) throw new Error('A scene needs dialogue'); this.lines=lines; this.index=0; }
    get current() { return this.lines[this.index]; }
    get last() { return this.index===this.lines.length-1; }
    next() { this.index=Math.min(this.index+1,this.lines.length-1); return this.current; }
    previous() { this.index=Math.max(0,this.index-1); return this.current; }
    replay() { this.index=0; return this.current; }
  }
  class SceneManager {
    constructor() { this.scenes=new Map(); this.active=null; }
    register(id,scene) { this.scenes.set(id,scene); }
    enter(id) { const scene=this.scenes.get(id); if(!scene) throw new Error('Unknown scene: '+id); this.active?.exit(); this.active=scene; scene.enter(); }
    exit() { this.active?.exit(); this.active=null; }
    next() { this.active?.next?.(); }
    previous() { this.active?.previous?.(); }
    replay() { this.active?.replay?.(); }
  }
  class AudioController {
    constructor() { this.enabled=false; this.context=null; this.voices=[]; }
    async toggle() {
      if(this.enabled) { this.enabled=false; this.stop(); return false; }
      try {
        const Audio=globalThis.AudioContext||globalThis.webkitAudioContext;
        if(!Audio) return false;
        this.context ||= new Audio();
        await this.context.resume(); this.enabled=this.context.state==='running';
      } catch { this.enabled=false; }
      return this.enabled;
    }
    tick() {
      this.stop();
      if(!this.enabled||this.context?.state!=='running') return;
      for(let i=0;i<3;i++) {
        const at=this.context.currentTime+i*.48;
        const oscillator=this.context.createOscillator(), gain=this.context.createGain();
        oscillator.type='sine'; oscillator.frequency.setValueAtTime(1050,at);
        oscillator.frequency.exponentialRampToValueAtTime(440,at+.045);
        gain.gain.setValueAtTime(0,at); gain.gain.linearRampToValueAtTime(.045,at+.003); gain.gain.exponentialRampToValueAtTime(.001,at+.065);
        oscillator.connect(gain); gain.connect(this.context.destination);
        oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();this.voices=this.voices.filter(v=>v!==oscillator);};
        this.voices.push(oscillator); oscillator.start(at); oscillator.stop(at+.08);
      }
    }
    stop() { this.voices.forEach(v=>{try{v.stop();}catch{}}); this.voices=[]; }
  }
  class AnimationController {
    constructor(reduced,onChange) { this.reduced=reduced; this.running=[]; this.onChange=onChange; }
    play(node,frames,options={}) {
      if(this.reduced()||!node?.animate) return;
      const animation=node.animate(frames,{duration:850,easing:'ease-in-out',...options});
      this.running.push(animation); this.onChange?.(true);
      const done=()=>{this.running=this.running.filter(a=>a!==animation);this.onChange?.(this.running.length>0);};
      animation.onfinish=done; animation.oncancel=done;
    }
    skip() { [...this.running].forEach(a=>a.finish()); this.running=[]; this.onChange?.(false); }
    cancel() { [...this.running].forEach(a=>a.cancel()); this.running=[]; this.onChange?.(false); }
  }

  // Public seams for future scenes and small state-machine tests; no framework needed.
  globalThis.MoonStory={DialogueState,SceneManager,AudioController,AnimationController};
  if(typeof document==='undefined') return;
  const data=globalThis.MoonStoryData;
  function buildBackground(stage) {
    stage.innerHTML=`<div class="book-art book-camera" role="img" aria-label="Cuoi and Rabbit stand beneath the banyan; a mysterious part of the lunar dust lies to the right.">
    <img class="book-landscape" src="assets/images/22.jpg" alt="">
    <div class="book-cuoi book-character"><div class="book-cuoi-pose book-idle sprite-window sprite-cuoi"><img src="assets/images/chucuoi.png" alt=""></div></div>
    <div class="book-rabbit book-character"><div class="book-rabbit-pose book-idle sprite-window sprite-rabbit"><img src="assets/images/thongoc.png" alt=""></div></div>
    <div class="book-signal" aria-hidden="true"></div></div><span class="book-scene-label">01 · OPENING</span><button class="book-listen" hidden aria-label="Listen to the distant ticking sound">Listen · tick… tick…</button>`;
  }

  const book=document.createElement('dialog');
  book.className='story-book';book.setAttribute('aria-labelledby','book-title');
  book.innerHTML=`<div class="book-header"><button class="book-home">← Main page</button><div class="book-brand"><h2 id="book-title"></h2><p class="book-tagline"></p></div><span class="book-progress">Scene 01 / 06</span></div>
    <div class="book-stage" data-mystery="false"></div>
    <section class="book-panel" aria-label="Story dialogue"><div aria-live="polite" aria-atomic="true"><h3 class="book-speaker"></h3><p class="book-dialogue"></p></div><div class="book-controls"><button class="pill book-back">← Back</button><span class="book-step"></span><button class="pill book-next">Next →</button></div></section>
    <div class="book-tools"><button class="book-tool book-replay">↺ Replay</button><button class="book-tool book-skip" disabled>Skip animation</button><button class="book-tool book-sound" aria-pressed="false">Sound: Off</button></div><p class="book-hint">Take your time. Use Next and Back, or the arrow keys. Escape returns to the main page.</p>
    <section class="book-divider" hidden aria-labelledby="divider-title"><div class="divider-mark" aria-hidden="true">✧</div><span class="book-progress">NEXT · SCENE 02 / 06</span><h3 id="divider-title">The Little One in the Dust</h3><p>Your next chapter begins just beyond the moon dust.</p><p>This part of the story is still being prepared. For now, you can revisit the opening or return to the main page.</p><button class="pill divider-replay">Replay the opening ↺</button></section>`;
  document.body.append(book);
  const find=s=>book.querySelector(s);
  find('#book-title').textContent=data.title;find('.book-tagline').textContent=data.tagline;
  const stage=find('.book-stage');buildBackground(stage);
  const preference=matchMedia('(prefers-reduced-motion: reduce)');
  const audio=new AudioController();
  const animations=new AnimationController(()=>preference.matches||document.body.classList.contains('no-motion'),running=>find('.book-skip').disabled=!running);
  const manager=new SceneManager();
  const state=new DialogueState(data.opening.lines);
  let returnFocus=null;
  function pulse() {
    animations.play(find('.book-signal'),[{opacity:.35},{opacity:1},{opacity:.45},{opacity:1}],{duration:1800});audio.tick();
  }
  function showReader(show) {
    ['.book-stage','.book-panel','.book-tools','.book-hint'].forEach(s=>find(s).hidden=!show);
    find('.book-divider').hidden=show;
  }
  function render() {
    animations.cancel();audio.stop();
    const line=state.current;
    find('.book-speaker').textContent=line.speaker;
    find('.book-dialogue').textContent=line.text;
    find('.book-step').textContent=`${state.index+1} / ${state.lines.length}`;
    find('.book-back').disabled=state.index===0;
    find('.book-next').textContent=state.last?'Follow the Sound →':'Next →';
    const mystery=state.index>=3;
    stage.dataset.mystery=String(mystery);stage.dataset.departure=String(state.last);
    find('.book-listen').hidden=!mystery;
    if(mystery) pulse();
    if(line.speaker==='Uncle Cuoi'||line.stage==='storytelling') {
      const arm=stage.querySelector('.book-cuoi-pose');
      arm.style.transformOrigin='center bottom';
      animations.play(arm,[{rotate:'0deg'},{rotate:'-2deg'},{rotate:'0deg'}],{duration:1400});
    }
    if(state.last) {
      animations.play(find('.book-rabbit-pose'),[{translate:'0 0'},{translate:'0 -12px'},{translate:'0 0'}],{duration:650});
      animations.play(find('.book-camera'),[{translate:'0 0'},{translate:'-12px 0'}],{duration:1500,fill:'none'});
    }
  }
  const opening={
    enter(){showReader(true);find('.book-header .book-progress').textContent='Scene 01 / 06';state.replay();render();animations.play(stage,[{opacity:0},{opacity:1}],{duration:1400});},
    exit(){animations.cancel();audio.stop();},
    next(){if(state.last){manager.enter('scene-02-divider');return;}state.next();render();},
    previous(){state.previous();render();},
    replay(){this.enter();}
  };
  manager.register('opening',opening);
  manager.register('scene-02-divider',{
    enter(){showReader(false);find('.book-header .book-progress').textContent='Next: Scene 02 / 06';find('.divider-replay').focus();},
    exit(){},replay(){manager.enter('opening');}
  });
  function open() {returnFocus=document.activeElement;if(!book.open)book.showModal();manager.enter('opening');find('.book-next').focus();}
  function close() {manager.exit();book.close();returnFocus?.focus({preventScroll:true});}
  find('.book-home').addEventListener('click',close);
  book.addEventListener('cancel',event=>{event.preventDefault();close();});
  find('.book-next').addEventListener('click',()=>manager.next());
  find('.book-back').addEventListener('click',()=>{manager.previous();if(state.index===0)find('.book-next').focus();});
  find('.book-replay').addEventListener('click',()=>manager.replay());
  find('.divider-replay').addEventListener('click',()=>{manager.enter('opening');find('.book-next').focus();});
  find('.book-skip').addEventListener('click',()=>{animations.skip();audio.stop();find('.book-next').focus();});
  find('.book-listen').addEventListener('click',pulse);
  find('.book-sound').addEventListener('click',async()=>{
    const button=find('.book-sound');button.disabled=true;
    const enabled=await audio.toggle();
    button.textContent=enabled?'Sound: On':'Sound: Off';button.setAttribute('aria-pressed',String(enabled));button.disabled=false;
    if(!enabled&&!audio.context){button.textContent='Sound unavailable';button.disabled=true;}
    if(book.open&&enabled&&state.index>=3&&manager.active===opening)audio.tick();
  });
  book.addEventListener('keydown',event=>{
    if(event.altKey||event.ctrlKey||event.metaKey||event.target.closest('input,textarea,select'))return;
    if(event.key==='ArrowRight'){event.preventDefault();manager.next();}
    if(event.key==='ArrowLeft'){event.preventDefault();manager.previous();}
  });
  preference.addEventListener('change',()=>{if(preference.matches)animations.skip();});
  new MutationObserver(()=>{if(document.body.classList.contains('no-motion'))animations.skip();}).observe(document.body,{attributes:true,attributeFilter:['class']});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)audio.stop();});
  document.querySelector('[data-open-story]').addEventListener('click',open);
  Object.assign(globalThis.MoonStory,{open,close,manager});
})();
