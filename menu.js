import {enter,pulse,revealCards,heartAt,celebrate} from './motion.js?v=heart-20261028-2';
import {sameOrderDraft} from './menu-order.js';
import {WORKER_URL} from './site-config.js?v=netlify-1';
import {MENU_CATEGORIES,ORDER_STATUSES,validateMenu} from './menu-model.js?v=menu-1';

const $ = selector => document.querySelector(selector);
const escapeHTML = (value = '') => String(value).replace(/[&<>"']/g,char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const icon = name => `<svg class="icon" aria-hidden="true"><use href="#icon-${name}"/></svg>`;
let data = {version:1,dishes:[],orders:[]}, ready = false, reading = false, busy = false, photoBusy = false;
let category = '全部', mode = 'home', view = 'choose', orderFilter = 'active', managing = false;
let cart = new Map(), dishId = null, dishVersion = null, dishPhoto = '', homeOrderId = null, outsideOrderId = null;
const categoryIcons = {
  '全部':'<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  '荤菜':'<path d="M10 14c-3-3-2-7 1-9s7-1 8 1c2 3 1 6-2 8-2 1-4 1-5 0l-4 4a2 2 0 1 1-3 3 2 2 0 1 1-2-3l5-5"/>',
  '素菜':'<path d="M20 3C10 2 3 6 4 13c1 7 9 8 13 3 3-4 3-8 3-13ZM4 21 16 8"/>',
  '主食':'<path d="M3 11h18c0 6-4 9-9 9s-9-3-9-9Zm5 10h8M8 7V3m4 4V2m4 5V3"/>',
  '汤羹':'<path d="M3 12h18c0 5-4 8-9 8s-9-3-9-8Zm5 9h8M8 8c-3-2 3-3 0-5m8 5c-3-2 3-3 0-5"/>',
  '小吃甜品':'<path d="m6 11 2 10h8l2-10ZM5 11h14M7 11a4 4 0 0 1 2-7 3 3 0 0 1 6 0 4 4 0 0 1 2 7M10 14v4m4-4v4"/>',
};
const categoryIcon = name => name === '酒水饮品' ? icon('drink') : `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${categoryIcons[name]}</svg>`;
let lastRead = 0;
let feedbackTimer;
const mobileMenu = matchMedia('(max-width:580px)');
function status(message, pending = false) {
  clearTimeout(feedbackTimer);
  const feedback = $('#menu-feedback');
  feedback.textContent = message; feedback.hidden = !message;
  if(message && !pending) feedbackTimer = setTimeout(() => { feedback.hidden = true; },7000);
}
function setBusy(value) {
  busy = value;
  document.querySelectorAll('#home-order-form input,#home-order-form textarea,#outside-order-form input,#outside-order-form textarea,#dish-form input,#dish-form textarea,#dish-form select,[data-order-status],[data-dish-rating],[data-add-to-cart],[data-cart-step]').forEach(control => { control.disabled = value || reading; });
  document.querySelectorAll('[data-cart-step="1"]').forEach(control => { control.disabled ||= (cart.get(control.dataset.dishId) || 0) >= 20; });
  $('#home-submit').disabled = value || reading || !ready || !cart.size;
  $('#outside-submit').disabled = value || reading || !ready;
  $('#dish-save').disabled = value || photoBusy || reading;
  $('#dish-photo-input').disabled = value || photoBusy;
  $('#home-submit').textContent = value ? '正在提交…' : '提交点单';
  $('#outside-submit').textContent = value ? '正在提交…' : '提交约饭单';
  $('#dish-save').textContent = value ? '正在保存…' : '保存菜品';
  updateCartbar();
}
function updateCartbar() {
  const visible = mobileMenu.matches && location.hash === '#menu' && view === 'choose' && mode === 'home' && !$('#cart-sheet').open;
  $('#mobile-cartbar').hidden = !visible;
  $('#menu-page').classList.toggle('has-cartbar',visible);
  $('#cartbar-summary').textContent = cart.size ? `已选 ${cart.size} 道 · ${[...cart.values()].reduce((a,b) => a+b,0)} 份` : '还没选菜';
  $('#cart-checkout').disabled = !cart.size || !ready;
}
function openCart() {
  if(!mobileMenu.matches || $('#cart-sheet').open) return;
  $('#cart-sheet-slot').append($('#menu-cart'),$('#menu-feedback')); $('#cart-sheet').showModal();
  document.body.classList.add('cart-sheet-open'); updateCartbar();
}
function closeCart() { if($('#cart-sheet').open) $('#cart-sheet').close(); }
$('#cart-sheet').addEventListener('close', () => {
  $('#home-dining').append($('#menu-cart')); document.body.append($('#menu-feedback')); document.body.classList.remove('cart-sheet-open'); updateCartbar();
});
$('#cart-close').addEventListener('click',closeCart);
$('#cart-open').addEventListener('click',openCart);
$('#cart-checkout').addEventListener('click',openCart);
mobileMenu.addEventListener('change', () => { if(!mobileMenu.matches) closeCart(); updateCartbar(); });
function confirmSavedOrder(result,order) {
  if(!sameOrderDraft(result.orders.find(item => item.id === order.id),order)) {
    const error = new Error('上次点单已提交，当前修改已保留。请先查看点单记录，再决定是否另点一单。');
    error.status = 409; throw error;
  }
}
async function request(body) {
  let response;
  try {
    response = await fetch(`${WORKER_URL}/menu`,{method:body ? 'POST' : 'GET',headers:body ? {'Content-Type':'application/json'} : {},...(body ? {body:JSON.stringify(body)} : {}),cache:'no-store',signal:AbortSignal.timeout(body ? 90000 : 20000)});
  } catch { throw new Error('连接共享菜单超时，请保留内容，刷新点单记录确认后再试。'); }
  let result;
  try { result = await response.json(); } catch { throw new Error('菜单服务暂时不可用，请稍后再试。'); }
  if (!response.ok) { const error = new Error(result.error || '保存失败，请保留内容后重试。'); error.status = response.status; throw error; }
  return validateMenu(result);
}
async function readMenu(quiet = false) {
  if(reading || busy || photoBusy) return;
  reading = true; setBusy(busy); $('#menu-refresh').disabled = true;
  if(!quiet) status('正在翻开我们的小菜单…');
  try { data = await request(); ready = true; lastRead = Date.now(); render(); status(''); }
  catch(error) { status(error.message); if(!ready) render(); }
  finally { reading = false; setBusy(busy); $('#menu-refresh').disabled = false; }
}
async function change(action,value,expectedVersion = null) {
  if(busy || reading || photoBusy) throw new Error('正在整理菜单，请稍等一下再操作。');
  setBusy(true); status('正在保存…',true);
  try { data = await request({action,value,expectedVersion}); ready = true; lastRead = Date.now(); render(); return data; }
  finally { setBusy(false); }
}
function render() {
  const categories = MENU_CATEGORIES.filter(name => data.dishes.some(dish => dish.category === name));
  if(ready && category !== '全部' && !categories.includes(category)) category = '全部';
  $('#dish-categories').innerHTML = ['全部',...categories].map(name => `<button type="button" data-menu-category="${name}" aria-pressed="${category === name}">${categoryIcon(name)}<span>${name}</span></button>`).join('');
  const dishes = data.dishes.filter(dish => category === '全部' || dish.category === category).sort((a,b) => b.createdAt-a.createdAt);
  $('#dish-list').innerHTML = !ready ? '<div class="menu-empty"><h3>菜单还没打开</h3><p>正在连接，或点击上方“刷新菜单”再试一次。</p></div>' : !dishes.length ? `<div class="menu-empty">${icon('utensils')}<h3>${data.dishes.length ? '这一页还没有菜品' : '我们的小餐厅，等你来开张'}</h3><p>把拿手菜、喜欢的小吃和饮品收进来，<br>以后想吃什么，就在这里点。</p><button type="button" class="outline" data-add-dish>添加${category === '全部' ? '第一道菜' : category}</button></div>` : dishes.map(dish => `<article class="dish-card" data-menu-dish="${dish.id}"><div class="dish-picture">${dish.photo ? `<img src="${escapeHTML(dish.photo)}" alt="${escapeHTML(dish.name)}" loading="lazy">` : `<span class="dish-placeholder">${icon(dish.category === '酒水饮品' ? 'drink' : 'utensils')}</span>`}<span class="dish-category">${dish.category}</span></div><div class="dish-content"><h3>${escapeHTML(dish.name)}</h3><p>${escapeHTML(dish.description || '')}</p>${ratingStars(dish)}<div class="dish-bottom">${cart.get(dish.id) ? `<div class="quantity"><button type="button" data-cart-step="-1" data-dish-id="${dish.id}" aria-label="减少${escapeHTML(dish.name)}的份数">${icon('minus')}</button><b>${cart.get(dish.id)}</b><button type="button" data-cart-step="1" data-dish-id="${dish.id}" aria-label="增加${escapeHTML(dish.name)}的份数">${icon('plus')}</button></div>` : `<button type="button" class="dish-select" data-add-to-cart="${dish.id}" aria-label="点一份${escapeHTML(dish.name)}">${icon('plus')}<span>点一份</span></button>`}</div>${managing ? `<div class="dish-manage-actions"><button type="button" data-edit-dish="${dish.id}">编辑</button><button type="button" data-delete-dish="${dish.id}">下架</button></div>` : ''}</div></article>`).join('');
  renderCart(); renderOrders(); renderRanking(); setBusy(busy);
  revealCards($('#dish-list'),category);
}
function ratingStars(dish) {
  const score = dish.rating || 0;
  return `<div class="dish-rating"><div role="group" aria-label="${escapeHTML(dish.name)}评分">${[1,2,3,4,5].map(value => {
    const fill = Math.min(1,Math.max(0,score-value+1))*100;
    return `<span class="rating-cell"><span class="rating-outline" aria-hidden="true">${icon('star')}</span><span class="rating-fill" style="width:100%;clip-path:inset(0 ${100-fill}% 0 0)" aria-hidden="true">${icon('star')}</span>${[value-0.5,value].map((rating,index) => `<button type="button" class="rating-half rating-half-${index}" data-dish-rating="${rating}" data-rating-dish="${dish.id}" aria-label="给${escapeHTML(dish.name)}打 ${rating} 星" aria-pressed="${rating === score}"></button>`).join('')}</span>`;
  }).join('')}</div><b>${score || '—'}</b></div>`;
}
function renderRanking() {
  const ranked = data.dishes.filter(dish => dish.rating > 0).sort((a,b) => b.rating-a.rating || b.createdAt-a.createdAt);
  const scores = [...new Set(ranked.map(dish => dish.rating))];
  $('#menu-ranking-list').innerHTML = !ranked.length ? `<div class="menu-empty">${icon('star')}<h3>第一道心头好，等你来选</h3><p>给喜欢的菜或饮品点颗星，<br>评分后就会出现在这里。</p><button type="button" class="outline" data-menu-view="choose">去给菜单打分</button></div>` : ranked.map(dish => {
    const rank = scores.indexOf(dish.rating)+1;
    return `<article class="ranking-card ${rank <= 3 ? 'ranking-top' : ''}"><span class="ranking-number">${String(rank).padStart(2,'0')}</span><div class="ranking-photo">${dish.photo ? `<img src="${escapeHTML(dish.photo)}" alt="${escapeHTML(dish.name)}" loading="lazy">` : icon(dish.category === '酒水饮品' ? 'drink' : 'utensils')}</div><div class="ranking-copy"><span>${dish.category}</span><h3>${escapeHTML(dish.name)}</h3></div><div class="ranking-score">${icon('star')}<strong>${dish.rating}</strong></div></article>`;
  }).join('');
}
function renderCart() {
  for(const id of cart.keys()) if(!data.dishes.some(dish => dish.id === id)) cart.delete(id);
  $('#cart-items').innerHTML = cart.size ? [...cart].map(([id,quantity]) => {
    const dish = data.dishes.find(item => item.id === id);
    return `<div class="cart-item"><span>${escapeHTML(dish.name)}</span><div class="quantity"><button type="button" data-cart-step="-1" data-dish-id="${id}" aria-label="减少${escapeHTML(dish.name)}的份数">${icon('minus')}</button><b>${quantity}</b><button type="button" data-cart-step="1" data-dish-id="${id}" aria-label="增加${escapeHTML(dish.name)}的份数" ${quantity >= 20 ? 'disabled' : ''}>${icon('plus')}</button></div></div>`;
  }).join('') + `<p class="cart-total">共 ${cart.size} 道 · ${[...cart.values()].reduce((a,b) => a+b,0)} 份</p>` : '<p class="cart-empty">菜单上点个小加号，<br>把想吃的放进来。</p>';
  $('#home-submit').disabled = busy || reading || !ready || !cart.size; updateCartbar();
}
function renderOrders() {
  document.querySelectorAll('[data-order-filter]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.orderFilter === orderFilter)));
  $('#order-pending-count').textContent = data.orders.filter(order => order.status === 'pending' || order.status === 'accepted').length;
  const orders = data.orders.filter(order => orderFilter === 'all' || ['pending','accepted'].includes(order.status)).sort((a,b) => b.createdAt-a.createdAt);
  $('#order-list').innerHTML = !ready ? '<div class="menu-empty"><h3>正在读取点单记录</h3><p>连接成功后，两个人的点单都会出现在这里。</p></div>' : !orders.length ? `<div class="menu-empty">${icon('heart')}<h3>${orderFilter === 'active' ? '暂时没有待安排的点单' : '第一份点单，等你来写'}</h3><p>选几道菜，或者约一家想去的小店。</p><button type="button" class="outline" data-menu-view="choose">去点菜</button></div>` : orders.map(order => `<article class="order-card"><div class="order-card-top"><div><span class="eyebrow">${order.mode === 'home' ? '在家吃' : '外出吃'}</span><h3>${escapeHTML(order.who)}${order.mode === 'home' ? '想吃这些' : `想去「${escapeHTML(order.restaurant)}」`}</h3><time>${new Date(order.createdAt).toLocaleString('zh-CN',{month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'})}</time></div><span class="order-status status-${order.status}">${ORDER_STATUSES[order.status]}</span></div><ul class="order-items">${order.items.map(item => `<li><span>${escapeHTML(item.name)}</span><b>× ${item.quantity}</b></li>`).join('')}</ul>${order.note ? `<p class="order-note">${escapeHTML(order.note)}</p>` : ''}<div class="order-actions">${order.status === 'pending' ? `<button type="button" class="primary small" data-order-status="accepted" data-order-id="${order.id}">安排上了</button>` : ''}${['pending','accepted'].includes(order.status) ? `<button type="button" class="outline small" data-order-status="completed" data-order-id="${order.id}">吃过啦</button><button type="button" class="text-button" data-order-status="cancelled" data-order-id="${order.id}">取消这单</button>` : `<span>${order.status === 'completed' ? '又一起好好吃了一顿。' : '这次先放一放，下次再约。'}</span>`}</div></article>`).join('');
}
function switchView(next) {
  closeCart();
  view = next; $('#menu-choose').hidden = next !== 'choose'; $('#menu-orders').hidden = next !== 'orders'; $('#menu-ranking').hidden = next !== 'ranking';
  document.querySelectorAll('[data-menu-view]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.menuView === next))); updateCartbar();
  enter($(`#menu-${next}`));
}
function switchPage() {
  closeCart();
  const active = location.hash === '#menu';
  $('#memories-page').hidden = active; $('#menu-page').hidden = !active;
  document.querySelectorAll('[data-page-link]').forEach(link => { link.classList.toggle('nav-active', (link.dataset.pageLink === 'menu') === active); if(link.classList.contains('nav-active')) link.setAttribute('aria-current','page'); else link.removeAttribute('aria-current'); });
  $('#top-add').hidden = active;
  updateCartbar();
  enter(active ? document.querySelector('.menu-intro') : document.querySelector('.hero'));
  if(active && !ready && !reading) readMenu();
}
function openDish(id) {
  if(busy || photoBusy || reading) return status('正在整理菜单，请稍等一下。');
  if(!ready) return status('请先刷新并打开共享菜单，再添加菜品。');
  const dish = data.dishes.find(item => item.id === id);
  dishId = dish?.id || crypto.randomUUID(); dishVersion = dish?.version || null; dishPhoto = dish?.photo || '';
  $('#dish-form').reset(); $('#dish-name').value = dish?.name || ''; $('#dish-category').value = dish?.category || (category !== '全部' ? category : MENU_CATEGORIES[0]); $('#dish-description').value = dish?.description || '';
  $('#dish-editor-title').textContent = dish ? '把这道菜写得更好' : '添加一道拿手菜'; $('#dish-form-status').textContent = '';
  renderDishPhoto(); $('#dish-editor').showModal();
}
function renderDishPhoto() { $('#dish-photo-preview').hidden = !dishPhoto; if(dishPhoto) $('#dish-photo-preview-image').src = dishPhoto; else $('#dish-photo-preview-image').removeAttribute('src'); }
async function preparePhoto(file) {
  if(!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 30*1024*1024) throw new Error('请选择 30 MB 以内的 JPG、PNG 或 WebP 图片。');
  const source = await new Promise((resolve,reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error('照片读取失败，请重新选择。')); reader.readAsDataURL(file); });
  return new Promise((resolve,reject) => {
    const image = new Image(); image.onload = () => { const scale = Math.min(1,1000/Math.max(image.width,image.height)); const canvas = document.createElement('canvas'); canvas.width = Math.max(1,Math.round(image.width*scale)); canvas.height = Math.max(1,Math.round(image.height*scale)); const context = canvas.getContext('2d'); context.fillStyle = '#fff'; context.fillRect(0,0,canvas.width,canvas.height); context.drawImage(image,0,0,canvas.width,canvas.height); resolve(canvas.toDataURL('image/jpeg',0.8)); }; image.onerror = () => reject(new Error('这张照片无法读取，请换一张试试。')); image.src = source;
  });
}
$('#dish-category').innerHTML = MENU_CATEGORIES.map(name => `<option>${name}</option>`).join('');
document.addEventListener('click', async event => {
  if(!event.target.closest('#menu-page,#cart-sheet')) return;
  const target = event.target.closest('button'); if(!target) return;
  if(target.dataset.menuView) { switchView(target.dataset.menuView); return; }
  if(busy || photoBusy || reading) return status('正在保存或读取菜单，请稍等。');
  if(target.dataset.diningMode) {
    mode = target.dataset.diningMode; $('#home-dining').hidden = mode !== 'home'; $('#outside-dining').hidden = mode !== 'outside';
    document.querySelectorAll('[data-dining-mode]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.diningMode === mode))); updateCartbar(); enter($(mode === 'home' ? '#home-dining' : '#outside-dining')); return;
  }
  if(target.dataset.dishRating) {
    const dish = data.dishes.find(item => item.id === target.dataset.ratingDish);
    if(!dish || dish.rating === Number(target.dataset.dishRating)) return;
    target.closest('.dish-rating').setAttribute('aria-busy','true');
    try { await change('rate-dish',{id:dish.id,rating:Number(target.dataset.dishRating)},dish.version);
      document.querySelectorAll(`[data-menu-dish="${dish.id}"] .rating-cell`).forEach((star,index) => { if(index < Number(target.dataset.dishRating)) pulse(star,index*35); });
      status(''); }
    catch(error) { status(error.message); }
    finally { target.closest('.dish-rating')?.removeAttribute('aria-busy'); }
  }
  if(target.dataset.menuCategory) { category = target.dataset.menuCategory; render(); }
  if(target.matches('#dish-add,[data-add-dish]')) openDish();
  if(target.id === 'dish-manage') { managing = !managing; target.setAttribute('aria-pressed',String(managing)); target.textContent = managing ? '完成管理' : '管理菜谱'; render(); }
  if(target.dataset.editDish) openDish(target.dataset.editDish);
  if(target.dataset.addToCart) {
    const id = target.dataset.addToCart, quantity = cart.get(id) || 0;
    if(quantity >= 20) return status('每道菜最多选 20 份。');
    if(!cart.has(id) && cart.size >= 30) return status('一份点单最多选 30 道菜。');
    const rect = target.getBoundingClientRect();
    cart.set(id,quantity+1); render(); heartAt(rect); pulse($('#cartbar-summary')); pulse(document.querySelector(`[data-menu-dish="${id}"] .quantity`)); status('已加入这顿想吃 · 选好后记得提交点单');
  }
  if(target.dataset.cartStep) { const id = target.dataset.dishId; const quantity = (cart.get(id)||0)+Number(target.dataset.cartStep); if(quantity <= 0) cart.delete(id); else if(quantity <= 20) cart.set(id,quantity); render(); pulse($('#cartbar-summary')); }
  if(target.dataset.orderFilter) { orderFilter = target.dataset.orderFilter; document.querySelectorAll('[data-order-filter]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.orderFilter === orderFilter))); renderOrders(); }
  if(target.dataset.deleteDish) {
    const dish = data.dishes.find(item => item.id === target.dataset.deleteDish);
    if(!dish || !confirm(`下架「${dish.name}」吗？已提交的点单记录会保留。`)) return;
    try { await change('delete-dish',{id:dish.id},dish.version); status('菜品已下架，已有点单仍保留。'); } catch(error) { status(error.message); }
  }
  if(target.dataset.orderStatus) {
    const order = data.orders.find(item => item.id === target.dataset.orderId);
    if(!order) return;
    if(target.dataset.orderStatus === 'cancelled' && !confirm('这次先不吃了吗？取消后仍保留这份记录。')) return;
    try { await change('order-status',{id:order.id,status:target.dataset.orderStatus},order.version); status('点单状态已更新 · 对方刷新网页就能看到'); } catch(error) { status(error.message); }
  }
});
$('#menu-refresh').addEventListener('click', () => readMenu());
$('#dish-photo-input').addEventListener('change', async event => {
  const file = event.target.files[0]; if(!file || busy || photoBusy) return;
  photoBusy = true; setBusy(busy); $('#dish-form-status').textContent = '正在整理照片…';
  try { dishPhoto = await preparePhoto(file); renderDishPhoto(); $('#dish-form-status').textContent = '照片整理好了，保存后会和菜品一起共享。'; }
  catch(error) { $('#dish-form-status').textContent = error.message; }
  finally { photoBusy = false; setBusy(busy); event.target.value = ''; }
});
$('#dish-photo-remove').addEventListener('click', () => { if(!busy && !photoBusy) { dishPhoto = ''; renderDishPhoto(); } });
['#dish-editor-close','#dish-editor-cancel'].forEach(selector => $(selector).addEventListener('click', () => { if(!busy && !photoBusy) $('#dish-editor').close(); }));
$('#dish-editor').addEventListener('cancel', event => { if(busy || photoBusy) event.preventDefault(); });
$('#dish-form').addEventListener('submit', async event => {
  event.preventDefault(); if(busy || reading || photoBusy) return;
  const dish = {id:dishId,name:$('#dish-name').value.trim(),category:$('#dish-category').value,description:$('#dish-description').value.trim(),photo:dishPhoto};
  $('#dish-form-status').textContent = '正在收藏这道菜，请稍等…';
  try { await change('save-dish',dish,dishVersion); $('#dish-editor').close(); status('已收进我们的菜单 · 对方也可以点这道菜了'); }
  catch(error) { $('#dish-form-status').textContent = error.message; status(error.message); }
});
function rememberWho(who) { try { localStorage.setItem('moments-menu-who',who); } catch {} $('#home-who').value = who; $('#outside-who').value = who; }
try { const who = localStorage.getItem('moments-menu-who'); if(who) { $('#home-who').value = who; $('#outside-who').value = who; } } catch {}
$('#home-order-form').addEventListener('submit', async event => {
  event.preventDefault(); if(busy || reading || !ready || !cart.size) return;
  homeOrderId ||= crypto.randomUUID();
  const who = $('#home-who').value.trim();
  const order = {id:homeOrderId,mode:'home',who,restaurant:'',note:$('#home-note').value.trim(),items:[...cart].map(([id,quantity]) => ({dishId:id,name:data.dishes.find(dish => dish.id === id).name,quantity}))};
  try { const result = await change('place-order',order); confirmSavedOrder(result,order); closeCart(); cart.clear(); homeOrderId = null; $('#home-note').value = ''; rememberWho(who); orderFilter = 'active'; switchView('orders'); render(); celebrate($('#menu-orders .order-card')); status('点单已送到我们的小餐厅 · 对方打开网页就能看到'); }
  catch(error) { if(error.status === 409) homeOrderId = null; status(error.message); }
});
$('#outside-order-form').addEventListener('submit', async event => {
  event.preventDefault(); if(busy || reading || !ready) return;
  const foods = $('#outside-food').value.split('\n').map(item => item.trim()).filter(Boolean);
  if(!foods.length || foods.length > 30 || foods.some(name => name.length > 60)) return status('每行写一道想吃的，最多 30 道，每道名字不超过 60 字。');
  outsideOrderId ||= crypto.randomUUID();
  const who = $('#outside-who').value.trim();
  const order = {id:outsideOrderId,mode:'outside',who,restaurant:$('#outside-restaurant').value.trim(),note:$('#outside-note').value.trim(),items:foods.map(name => ({dishId:null,name,quantity:1}))};
  try { const result = await change('place-order',order); confirmSavedOrder(result,order); outsideOrderId = null; $('#outside-order-form').reset(); rememberWho(who); orderFilter = 'active'; switchView('orders'); render(); celebrate($('#menu-orders .order-card')); status('约饭单已共享 · 等对方一起安排这顿饭'); }
  catch(error) { if(error.status === 409) outsideOrderId = null; status(error.message); }
});
window.addEventListener('hashchange',switchPage);
window.addEventListener('focus', () => { if(!$('#menu-page').hidden && !$('#dish-editor').open && !$('#cart-sheet').open && Date.now()-lastRead > 15000) readMenu(true); });
setInterval(() => { if(!document.hidden && !$('#menu-page').hidden && !$('#dish-editor').open && !$('#cart-sheet').open) readMenu(true); },60000);
render(); switchPage();
