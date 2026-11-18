/* Local curated guide: no network, storage, account, or generated advice. */
(() => {
 'use strict';
 const answers={
  story:"Choose Begin the Adventure or simply scroll down. All 22 illustrations unfold through six scenes and a quiet closing. Scroll up to revisit any line.",
  cuoi:'I’m Uncle Cuoi, the storyteller beneath the banyan. Our story draws on Vietnamese Moon folklore and imagines a meeting with lunar exploration. Come sit with us for a little while.',
  rabbit:"Moon Rabbit is my curious companion in these watercolor story illustrations.",
  rover:"ROVER is a fictional, talking, four-wheeled explorer. Our story combines ideas from real lunar science, including moonquakes and laser reflectors. The pictured vehicle is not the Apollo 11 scientific instrument package.",
  tree:"The banyan is our keeper of memories. Its roots remind us that small discoveries can help tomorrow’s dreams grow.",
  feelings:'Feeling forgotten can hurt. You deserve kindness and company, even on quiet days. You could tell someone you trust how you feel, or invite a friend to share a small adventure.',
  sound:"The ticking is described in our captions. This page does not play audio. Our imagined story is not a demonstration of sound travelling through space.",
  chapters:"Explore Opening, The Little One in the Dust, The Rover That Went Quiet, The Coldest Night, A Thin Line of Light, Find You, and The Roots of Tomorrow.",
  motion:"Scrolling controls every image and caption. Characters stay still. Your device’s reduced-motion preference removes crossfades while keeping the complete story.",
  fallback:'I have a few prepared answers about our story, Rabbit, the banyan, ROVER, feelings, sound and reading controls. Choose a question above, or try one of those topics.'
 };
 function answerFor(question){
  const q=question.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const rules=[...(globalThis.CuoiGuide?.extraRules||[]),['feelings',/forgot|lonely|alone|sad|feel|buon/],['rover',/rover|robot|instrument|apollo/],['rabbit',/rabbit|bunny|tho/],['tree',/tree|banyan|root/],['cuoi',/cuoi|folklore/],['sound',/sound|tick|audio|hear/],['motion',/motion|animat|pause|movement/],['chapters',/chapter|scene|next part/],['story',/start|begin|story|read|help/]];
  return answers[rules.find(([,pattern])=>pattern.test(q))?.[0]||'fallback'];
 }
 globalThis.CuoiGuide={answerFor,answers,extraRules:null};
 if(globalThis.MoonStoryI18n)globalThis.MoonStoryI18n.applyLocale(globalThis.MoonStoryI18n.getLang());
 if(typeof document==='undefined')return;
 const dialog=document.getElementById('cuoi-guide');
 const launch=document.querySelector('.guide-launch');
 const answer=document.getElementById('guide-answer');
 let origin;
 function close(){dialog.close();origin?.focus({preventScroll:true});}
 launch.addEventListener('click',()=>{origin=document.activeElement;dialog.showModal();dialog.querySelector('[data-topic]').focus();});
 dialog.querySelector('.close').addEventListener('click',close);
 dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
 dialog.querySelectorAll('[data-topic]').forEach(button=>button.addEventListener('click',()=>{answer.textContent=answers[button.dataset.topic];}));
 document.getElementById('guide-form').addEventListener('submit',event=>{event.preventDefault();const input=document.getElementById('guide-question');if(!input.value.trim()){input.focus();return;}answer.textContent=answerFor(input.value);});
 document.getElementById('guide-begin').addEventListener('click',()=>{close();globalThis.MoonStory.open();});
})();
