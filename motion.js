// 动效只在出现或操作时播放；减少动态效果时立即停用。
const reducedMotion = matchMedia('(prefers-reduced-motion:reduce)');
const running = new Set();
const lists = new Map();
function play(element,frames,options = {}) {
  if(!element || reducedMotion.matches || !element.animate) return;
  const animation = element.animate(frames,{duration:280,easing:'cubic-bezier(.22,.7,.3,1)',...options});
  running.add(animation);
  const clean = () => running.delete(animation);
  animation.addEventListener('finish',clean,{once:true});
  animation.addEventListener('cancel',clean,{once:true});
  return animation;
}
export function enter(element,delay = 0) {
  return play(element,[{opacity:0,transform:'translateY(9px)'},{opacity:1,transform:'translateY(0)'}],{delay,duration:320,fill:'backwards'});
}
export function pulse(element,delay = 0) {
  return play(element,[{transform:'scale(1)'},{transform:'scale(1.13)',offset:.42},{transform:'scale(1)'}],{delay,duration:280});
}
export function revealCards(root,scope = '') {
  if(!root) return;
  let state = lists.get(root);
  if(!state) { state = {scope,seen:new Set(),observer:null}; lists.set(root,state); }
  state.observer?.disconnect();
  if(state.scope !== scope) { state.scope = scope; state.seen.clear(); }
  if(reducedMotion.matches || !('IntersectionObserver' in window)) return;
  state.observer = new IntersectionObserver(entries => {
    let index = 0;
    for(const entry of entries) {
      if(!entry.isIntersecting) continue;
      const card = entry.target;
      const key = card.dataset.memory || card.dataset.menuDish;
      if(!state.seen.has(key)) { enter(card,Math.min(index++,3)*45); state.seen.add(key); }
      state.observer.unobserve(card);
    }
  },{threshold:.06});
  root.querySelectorAll('.memory-card,.dish-card').forEach(card => {
    const key = card.dataset.memory || card.dataset.menuDish;
    if(!state.seen.has(key)) state.observer.observe(card);
  });
}
export function heartAt(rect) {
  if(reducedMotion.matches || document.querySelectorAll('.motion-heart').length >= 4) return;
  const heart = document.createElement('span');
  heart.className = 'motion-heart'; heart.setAttribute('aria-hidden','true');
  heart.innerHTML = '<svg viewBox="0 0 24 24"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0l-1 1-1-1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg>';
  heart.style.left = `${rect.left+rect.width/2-9}px`; heart.style.top = `${rect.top-5}px`;
  (document.querySelector('#cart-sheet[open]') || document.body).append(heart);
  const animation = play(heart,[{opacity:0,transform:'translateY(0) scale(.6)'},{opacity:1,transform:'translateY(-14px) scale(1)',offset:.25},{opacity:0,transform:'translateY(-42px) scale(.8)'}],{duration:620});
  if(animation) { animation.addEventListener('finish',()=>heart.remove(),{once:true}); animation.addEventListener('cancel',()=>heart.remove(),{once:true}); }
  else heart.remove();
}
export function celebrate(element) {
  if(!element || reducedMotion.matches) return;
  const rect = element.getBoundingClientRect();
  [-28,0,28].forEach(offset => heartAt({left:rect.left+rect.width/2+offset,top:rect.top+24,width:0}));
  pulse(element);
}
// 彩色 Kitty 从中央向四周散开，仅在打开新文档时播放。
async function welcome() {
  if(reducedMotion.matches || !document.body) return;
  const poses = ['classic','melody','hibiscus','hula','teddy','parasol','surf','leap','flower','summer','fan','friends'];
  await Promise.all(poses.map(async pose => {
    const image = new Image();
    image.src = `entrance-art/kitty-${pose}.png?v=heart-20261028-2`;
    try { await image.decode(); } catch { /* 图片缺失时不阻碍页面打开。 */ }
  }));
  if(reducedMotion.matches) return;
  const entrance = document.createElement('div');
  entrance.className = 'site-entrance'; entrance.setAttribute('aria-hidden','true');
  entrance.innerHTML = '<div class="entrance-glow"></div><div class="entrance-center"><img src="kitty-bow.png" alt=""><strong>我们的小事<span>♡</span></strong></div><div class="entrance-kitties"></div>';
  const group = entrance.querySelector('.entrance-kitties');
  const count = poses.length;
  const cleanup = () => { clearTimeout(fallback); entrance.remove(); };
  const fallback = setTimeout(cleanup,2200);
  document.body.append(entrance);
  play(group,[{opacity:0,transform:'scale(.94)'},{opacity:1,transform:'scale(1)'}],{duration:320,fill:'backwards'});
  for(let i = 0; i < count; i++) {
    const kitty = document.createElement('img');
    kitty.src = `entrance-art/kitty-${poses[i%poses.length]}.png?v=heart-20261028-2`;
    kitty.alt = ''; kitty.className = 'entrance-kitty';
    // 十二个不同形象沿爱心外围排列，顶部留出心形凹口、中间留白。
    const outline = [[0,-.45],[.55,-.95],[1,-.52],[1,-.15],[.78,.35],[.42,.74],[0,1.08],[-.42,.74],[-.78,.35],[-1,-.15],[-1,-.52],[-.55,-.95]];
    const [pointX,pointY] = outline[i];
    const x = pointX*Math.min(innerWidth*.35,250);
    const y = pointY*Math.min(innerHeight*.30,240);
    const angle = Math.atan2(y,x);
    const rotation = (i%3-1)*5;
    const size = Math.min(innerWidth*.23,125);
    kitty.style.width = `${size}px`;
    kitty.style.height = `${Math.min(innerWidth*.25,135)}px`;
    const initial = `translate(-50%,-50%) translate(${x}px,${y}px) rotate(${rotation}deg)`;
    kitty.style.transform = initial;
    group.append(kitty);
    const reach = Math.hypot(innerWidth,innerHeight)*.72+140;
    const bend = (i%2 ? 1 : -1)*Math.min(innerWidth*.15,80);
    const midX = x+Math.cos(angle)*reach*.38-Math.sin(angle)*bend;
    const midY = y+Math.sin(angle)*reach*.38+Math.cos(angle)*bend;
    const animation = play(kitty,[
      {opacity:1,transform:initial,offset:0},
      {opacity:1,transform:`translate(-50%,-50%) translate(${x*.97}px,${y*.97}px) rotate(${rotation-3}deg) scale(1.01)`,offset:.16,easing:'cubic-bezier(.45,0,.55,1)'},
      {opacity:1,transform:`translate(-50%,-50%) translate(${midX}px,${midY}px) rotate(${rotation+(i%2 ? 12 : -12)}deg) scale(.98)`,offset:.62,easing:'cubic-bezier(.2,.55,.35,1)'},
      {opacity:0,transform:`translate(-50%,-50%) translate(${Math.cos(angle)*reach}px,${Math.sin(angle)*reach}px) rotate(${rotation+(i%2 ? 28 : -28)}deg) scale(.86)`,offset:1}
    ],{delay:320+(i%4)*45,duration:1400,easing:'ease-in-out',fill:'forwards'});
    if(!animation) { cleanup(); return; }
    animation.addEventListener('cancel',cleanup,{once:true});
  }
  play(entrance.querySelector('.entrance-center'),[{opacity:0,transform:'translate(-50%,-45%) scale(.92)',offset:0},{opacity:1,transform:'translate(-50%,-50%) scale(1)',offset:.23},{opacity:1,transform:'translate(-50%,-50%) scale(1)',offset:.5},{opacity:0,transform:'translate(-50%,-50%) scale(1.06)',offset:1}],{duration:1550,fill:'forwards'});
  const fade = play(entrance.querySelector('.entrance-glow'),[{opacity:1},{opacity:0}],{delay:650,duration:1000,fill:'forwards'});
  if(!fade) cleanup();
  else fade.addEventListener('cancel',cleanup,{once:true});
  const finalKitty = group.lastElementChild;
  // 最迟一只离开后立即清理，不留下不可见的全屏图层。
  const done = play(finalKitty,[{},{}],{duration:1900});
  if(done) done.addEventListener('finish',cleanup,{once:true});
}
welcome();
reducedMotion.addEventListener('change',() => {
  if(!reducedMotion.matches) return;
  for(const animation of running) animation.cancel();
  for(const state of lists.values()) state.observer?.disconnect();
});
