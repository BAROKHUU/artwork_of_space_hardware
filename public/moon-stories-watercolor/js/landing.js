
(() => {
 'use strict';
 const reduced = matchMedia('(prefers-reduced-motion: reduce)');
 let paused = reduced.matches;
 const motionButton = document.querySelector('#motion-toggle');
 function applyMotion() {
  document.body.classList.toggle('no-motion', paused);
  motionButton.setAttribute('aria-pressed', String(paused));
  motionButton.textContent = paused ? '▷ Resume the magic' : 'Ⅱ Pause the magic';
  motionButton.disabled = reduced.matches;
  if (reduced.matches) motionButton.textContent = 'Reduced motion is on';
 }
 motionButton.addEventListener('click', () => { paused = !paused; applyMotion(); });
 reduced.addEventListener('change', () => { paused = reduced.matches; applyMotion(); });
 applyMotion();
 const speech = document.querySelector('#speech');
 let speechTimer;
 function greet(character) {
  clearTimeout(speechTimer);
  document.querySelectorAll('.interactive').forEach(el=>el.classList.remove('active'));
  character.classList.add('active');
  speech.hidden = false;
  speech.textContent = '“' + character.dataset.say + '”';
  speechTimer = setTimeout(() => {speech.hidden = true; character.classList.remove('active');},6500);
 }
 document.querySelectorAll('.interactive').forEach(character => {
  character.addEventListener('click', () => greet(character));
 });
 document.addEventListener('keydown',event=>{if(event.key==='Escape'){speech.hidden=true;clearTimeout(speechTimer);document.querySelectorAll('.interactive').forEach(el=>el.classList.remove('active'));}});
 ['meet-characters','meet-nav'].forEach(id=>document.getElementById(id).addEventListener('click',event=>{
  event.preventDefault();
  const character=document.querySelector('#cuoi-character');
  character.scrollIntoView({behavior:paused?'instant':'smooth',block:'center'});
  character.focus({preventScroll:true});greet(character);
 }));
 const chapters = [
  {title:'The Forgotten Explorer', paragraphs:[
   'For a very long time, the little rover had heard only silence. Moon dust tucked itself into his wheels. Far away, Earth shone like a blue marble that someone had forgotten to pick up.',
   '“I used to carry explorers,” he whispered. “Now I only carry dust.” His antenna drooped. Then something soft tapped his wheel. A white rabbit! Behind her stood a young woodcutter with kind eyes.',
   '“I’m Cuoi,” said the woodcutter. “And you look like someone with a wonderful story.” He pointed to a banyan tree, its roots resting in the silver dust. One golden leaf began to glow.'
  ],question:'Wonder together: What would you say to a friend who feels forgotten?'},
  {title:'The Wisdom of the Banyan',paragraphs:[
   'The rabbit hopped ahead while Cuoi walked beside the rover. Beneath the banyan, the air felt warm, like a blanket after a long day. Golden light threaded through the old tree’s roots.',
   '“My exploring days are over,” said the rover. “Did they matter?” The banyan rustled. “Look at my roots, little traveler. You cannot see how far they reach. Your journey is like that, too.”',
   'A leaf drifted down. Inside it, the rover saw Earth: books opening, children asking questions, and little hands drawing wheels. “Every discovery becomes a root for tomorrow,” whispered the tree.'
  ],question:'Imagine: If a tree could keep one of your memories, which would you give it?'},
  {title:'A Dream Across the Stars',paragraphs:[
   'In the golden leaf, a child sat at a kitchen table. She was drawing a rover with four big wheels and a tall antenna. “One day,” she told her family, “I want to discover something, too.”',
   'The little rover’s display flickered. “She remembers?” Cuoi smiled. “She dreams because someone began the journey. You helped make the Moon feel a little closer.”',
   'The rover looked up at Earth. He was still small. The universe was still enormous. But now he knew: you don’t have to be the biggest star in the universe to make a difference. Beside his new friends, his little light shone.'
  ],question:'Your turn: Draw a machine that could help someone. What would its first adventure be?'}
 ];
 const dialog=document.querySelector('#story-dialog');
 let currentChapter=0;
 function openChapter(index) {
  currentChapter=index;
  const chapter=chapters[index];
  document.querySelector('#dialog-kicker').textContent='THE IRON HEART AND THE IMMORTAL BANYAN TREE · '+String(index+1).padStart(2,'0');
  document.querySelector('#dialog-title').textContent=chapter.title;
  const content=document.querySelector('#dialog-content');content.replaceChildren();
  chapter.paragraphs.forEach(text=>{const p=document.createElement('p');p.textContent=text;content.append(p);});
  const question=document.createElement('p');question.className='question';question.textContent=chapter.question;content.append(question);
  document.querySelector('#page-count').textContent='Chapter '+(index+1)+' of 3';
  document.querySelector('#next-chapter').textContent=index===2?'Back to the Moon ↗':'Next chapter →';
  if(!dialog.open)dialog.showModal();
  dialog.scrollTop=0;
 }
 document.querySelectorAll('[data-chapter]').forEach(button=>button.addEventListener('click',()=>openChapter(Number(button.dataset.chapter))));
 document.querySelector('#explore-all').addEventListener('click',event=>{event.preventDefault();openChapter(0);});
 dialog.querySelector('.close').addEventListener('click',()=>dialog.close());
 document.querySelector('#next-chapter').addEventListener('click',()=>{if(currentChapter<2)openChapter(currentChapter+1);else dialog.close();});
 dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
})();
