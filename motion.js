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
reducedMotion.addEventListener('change',() => {
  if(!reducedMotion.matches) return;
  for(const animation of running) animation.cancel();
  for(const state of lists.values()) state.observer?.disconnect();
});
