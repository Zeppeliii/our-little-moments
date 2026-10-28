import {enter,revealCards} from './motion.js?v=motion-20261028-1';
import { CloudStore } from './shared-store.js?v=netlify-1';
'use strict';
const $ = (selector) => document.querySelector(selector);
const categoryNames = {第一次:'第一次',心动回忆:'心动回忆',日常:'日常',纪念日:'纪念日'};
const categoryIcons = {第一次:'hearts',心动回忆:'heart',日常:'sun'};
const icon = name => `<svg class="icon" aria-hidden="true" focusable="false"><use href="#icon-${name}"/></svg>`;
const categoryIcon = category => category === '纪念日' ? '<img class="bow-icon" src="kitty-bow.png" alt="" aria-hidden="true">' : icon(categoryIcons[category] || 'heart');
const seriesDescriptions = {全部:'四个系列，收藏我们故事里的不同篇章。',第一次:'第一次牵手、第一次拥抱……每一个开始，都因为你而特别。',心动回忆:'收藏那些让心跳漏了一拍、想起来还会偷偷笑的瞬间。',日常:'一起吃饭、散步、说晚安，平凡的日子也闪闪发光。',纪念日:'生日、恋爱周年，还有每一个值得认真庆祝的日子。'};
function normalizeCategory(category) {
  if (Object.hasOwn(categoryNames, category)) return category;
  return category === '小事' ? '心动回忆' : '日常';
}
function newMemoryCategory(filter) { return Object.hasOwn(categoryNames, filter) ? filter : '日常'; }
let memories = [], selectedPhotos = [], editingId = null, activeFilter = '全部', toastTimer;
const store = new CloudStore();
let ready = false, reading = false, saving = false, lastReadError = '', lastReadAt = 0, localMemories = [];
let editingVersion = null, dataRevision = 0;
let detailId = null, galleryPhotos = [], galleryIndex = 0, galleryTitle = '', photoMode = 'fit';
const escapeHTML = (value = '') => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
function toast(message) { $('#toast').textContent = message; $('#toast').classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 3600); }
function localDate() { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
function validDate(value) { if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false; const date = new Date(value + 'T12:00:00'); return !isNaN(date) && `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}` === value; }
function updateLocalMigration() {
  const pending = localMemories.filter(item => !memories.some(remote => remote.id === item.id));
  $('#local-migration').hidden = !pending.length;
  $('#local-migration-note').textContent = `这台浏览器还有 ${pending.length} 条旧回忆，尚未公开到共享手账。`;
}
async function refresh({quiet = false} = {}) {
  if(reading || saving) return;
  const revision = dataRevision;
  reading = true; $('#sync-refresh').disabled = true;
  if(!quiet) $('#sync-status').textContent = '正在读取共享回忆…';
  try {
    const data = await store.read();
    if(revision !== dataRevision) return;
    memories = data.memories; ready = true; lastReadError = ''; lastReadAt = Date.now();
    $('#sync-status').textContent = '共享回忆已更新 · 两边都能看到';
    updateLocalMigration(); render();
  } catch(error) {
    if(revision !== dataRevision) return;
    lastReadError = error.message;
    $('#sync-status').textContent = '暂时无法更新，请检查网络后重试';
    if(!quiet) toast(error.message);
    render();
  } finally { reading = false; $('#sync-refresh').disabled = false; }
}
function renderLoveDays() {
  const section = $('#love-days');
  const together = memories.filter(memory => memory.category === '纪念日' && /^(我们)?在一起(啦|了)?[！!。]*$/.test(memory.title.trim()) && validDate(memory.date) && memory.date <= localDate()).sort((a,b) => a.date.localeCompare(b.date))[0];
  section.hidden = !ready || !together;
  if (!together) return;
  // 按日历日期计算，避免夏令时造成天数偏差；开始当天为第 1 天。
  const today = Date.parse(localDate() + 'T00:00:00Z');
  const start = Date.parse(together.date + 'T00:00:00Z');
  const [startYear, month, day] = together.date.split('-').map(Number);
  const anniversary = year => Date.UTC(year, month - 1, Math.min(day, new Date(Date.UTC(year, month, 0)).getUTCDate()));
  let year = Math.max(new Date(today).getUTCFullYear(), startYear + 1);
  if (anniversary(year) < today) year++;
  const remaining = Math.round((anniversary(year) - today) / 86400000);
  section.innerHTML = `<div class="love-days-copy"><span class="eyebrow">${icon('hearts')} 我们的日子</span><h2>在一起的第 <strong>${Math.floor((today-start)/86400000)+1}</strong> 天</h2><p>从 ${together.date.replaceAll('-', ' / ')} 开始，每一天都有你。</p></div><div class="anniversary-count"><img class="bow-icon" src="kitty-bow.png" alt=""><p>${remaining === 0 ? `今天是我们的 ${year-startYear} 周年纪念日` : `距离我们的 ${year-startYear} 周年还有 <strong>${remaining}</strong> 天`}</p><button type="button" class="text-button" data-detail="${escapeHTML(together.id)}">重温在一起的那一天 ${icon('arrow-up-right')}</button></div>`;
}
function render() {
  renderLoveDays();
  $('#series-title').textContent = activeFilter === '全部' ? '我们的回忆' : activeFilter;
  $('#series-description').textContent = seriesDescriptions[activeFilter];
  document.querySelectorAll('[data-series-count]').forEach(element => {
    element.textContent = memories.filter(memory => memory.category === element.dataset.seriesCount).length;
  });
  $('#memory-count').textContent = memories.length;
  $('#photo-count').textContent = memories.reduce((sum,memory) => sum + memory.photos.length,0);
  $('#day-count').textContent = new Set(memories.map(memory => memory.date)).size;
  const query = $('#search').value.trim().toLowerCase();
  const visible = memories.filter(m => (activeFilter === '全部' || m.category === activeFilter) && `${m.title} ${m.body} ${m.place}`.toLowerCase().includes(query)).sort((a,b) => b.date.localeCompare(a.date) || b.createdAt-a.createdAt);
  const list = $('#memory-list');
  if (!ready) {
    list.innerHTML = `<div class="empty"><svg aria-hidden="true"><use href="#kitty"/></svg><h3>${lastReadError ? '暂时没能翻开共享回忆' : '正在翻开我们的回忆…'}</h3><p>${lastReadError ? '请检查网络，再点击上方「刷新回忆」。' : '稍等一下，把属于我们的瞬间带过来。'}</p></div>`;
    return;
  }
  if (!visible.length) {
    const title = query ? '还没有找到这段回忆' : activeFilter === '全部' ? '我们的故事，从这里开始' : `「${activeFilter}」的故事，等你来写`;
    const description = query ? '试试其他关键词，找找那段属于我们的回忆。' : activeFilter === '全部' ? '选一个系列，把第一份小幸福收藏在这里。' : seriesDescriptions[activeFilter];
    list.innerHTML = `<div class="empty"><svg aria-hidden="true"><use href="#kitty"/></svg><h3>${title}</h3><p>${description}</p>${query ? '' : `<button class="primary" id="first-add">${icon('plus')} ${activeFilter === '全部' ? '写下第一段回忆' : `记录${activeFilter}`}</button>`}</div>`;
    $('#first-add')?.addEventListener('click', () => openEditor()); return;
  }
  let month = ''; let html = '';
  visible.forEach(memory => {
    const nextMonth = memory.date.slice(0,7);
    if (month !== nextMonth) { if(month) html += '</div>'; month = nextMonth; html += `<h3 class="month-title">${icon('heart')}${month.slice(0,4)} 年 ${Number(month.slice(5))} 月 <span>属于我们的时光</span></h3><div class="cards">`; }
    html += `<article class="memory-card" data-memory="${escapeHTML(memory.id)}"><button type="button" class="card-picture ${memory.photos.length ? '' : 'no-photo'}" data-detail="${escapeHTML(memory.id)}" aria-label="查看${escapeHTML(memory.title)}的详情">${memory.photos.length ? `<img src="${escapeHTML(memory.photos[0])}" alt="${escapeHTML(memory.title)}" loading="lazy"><span class="photo-badge">${memory.photos.length} 张照片</span>` : '<svg aria-hidden="true"><use href="#kitty"/></svg>'}</button><div class="card-content"><div class="card-meta"><time datetime="${memory.date}">${memory.date.replaceAll('-',' / ')}</time><span class="category">${categoryIcon(memory.category)}${categoryNames[memory.category]}</span></div><h3><button type="button" class="card-title" data-detail="${escapeHTML(memory.id)}">${escapeHTML(memory.title)}</button></h3><p class="card-body">${escapeHTML(memory.body || '那天有你，就是一件值得记住的小事。')}</p><div class="card-bottom"><span class="place">${memory.place ? icon('map-pin')+' '+escapeHTML(memory.place) : icon('heart')+' 收藏了一份小幸福'}</span><div class="card-actions"><button type="button" data-detail="${escapeHTML(memory.id)}">重温回忆 ${icon('arrow-up-right')}</button></div></div></div></article>`;
  }); list.innerHTML = html + '</div>';
  revealCards(list,activeFilter);
}
function renderPreviews() { $('#photo-preview').innerHTML = selectedPhotos.map((photo,index) => `<div class="preview-item"><img src="${escapeHTML(photo)}" alt="回忆照片 ${index+1}" data-preview="${index}"><button type="button" data-remove="${index}" aria-label="移除第 ${index+1} 张照片">${icon('x')}</button></div>`).join(''); }
function openEditor(id) { if(saving) return toast('正在保存回忆，请稍后再试'); if(id && !ready) return toast(lastReadError || '正在读取这条回忆，请稍后重试'); const memory = memories.find(item => item.id === id); editingId = memory?.id || null; editingVersion = memory?.version || null; $('#memory-form').reset(); $('#event-title').value = memory?.title || ''; $('#event-date').value = memory?.date || localDate(); $('#event-category').value = memory?.category || newMemoryCategory(activeFilter); $('#event-body').value = memory?.body || ''; $('#event-place').value = memory?.place || ''; selectedPhotos = [...(memory?.photos || [])]; $('#editor-title').innerHTML = `${memory ? '重温这件小事' : '记一件小事'} <span class="pink">${icon('heart')}</span>`; renderPreviews(); $('#save-status').hidden = true; $('#editor').showModal(); }
function openDetail(id) {
  const memory = memories.find(item => item.id === id);
  if (!memory) return;
  detailId = id;
  $('#detail-content').innerHTML = `<div class="modal-head"><div><div class="eyebrow">${categoryIcon(memory.category)} ${categoryNames[memory.category]}</div><h2 id="detail-title">${escapeHTML(memory.title)}</h2><p class="detail-meta">${memory.date.replaceAll('-',' / ')}${memory.place ? ` · ${escapeHTML(memory.place)}` : ''}</p></div><button type="button" class="icon-btn" id="detail-close" aria-label="关闭回忆详情">${icon('x')}</button></div><p class="detail-story">${escapeHTML(memory.body || '那天有你，就是一件值得记住的小事。')}</p>${memory.photos.length ? `<div class="detail-album-heading"><h3>那天的照片</h3><span>${memory.photos.length} 张 · 点开慢慢看</span></div><div class="detail-photos">${memory.photos.map((photo,index) => `<button type="button" data-gallery-index="${index}" aria-label="查看第 ${index+1} 张照片"><img src="${escapeHTML(photo)}" alt="${escapeHTML(memory.title)}，第 ${index+1} 张照片" loading="lazy"><span>${index+1} / ${memory.photos.length}</span></button>`).join('')}</div>` : ''}<div class="detail-footer"><span>把这一刻，好好收藏。</span><details class="memory-more"><summary>更多操作</summary><div><button type="button" data-detail-edit>编辑回忆</button><button type="button" data-delete="${escapeHTML(memory.id)}">删除回忆</button></div></details></div>`;
  if (!$('#memory-detail').open) $('#memory-detail').showModal();
  $('#memory-detail').scrollTop = 0;
}
function setPhotoMode(mode) {
  photoMode = mode;
  $('#viewer-stage').dataset.mode = mode;
  $('#viewer-stage').scrollTo(0,0);
  document.querySelectorAll('[data-photo-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.photoMode === mode)));
  $('#viewer-hint').textContent = mode === 'fit' ? (galleryPhotos.length > 1 ? '左右滑动切换照片' : '收藏这一刻') : '上下滚动阅读 · 可用按钮切换照片';
}
function renderPhoto() {
  const image = $('#viewer-image');
  image.hidden = true;
  $('#viewer-error').hidden = true;
  $('#viewer-count').textContent = `${galleryIndex+1} / ${galleryPhotos.length}`;
  $('#viewer-title').textContent = galleryTitle;
  $('#viewer-prev').disabled = galleryIndex === 0;
  $('#viewer-next').disabled = galleryIndex === galleryPhotos.length-1;
  setPhotoMode('fit');
  image.alt = `${galleryTitle}，第 ${galleryIndex+1} 张照片`;
  image.src = galleryPhotos[galleryIndex];
}
function showPhoto(photos, index = 0, title = '回忆相册') {
  if (!photos.length) return;
  galleryPhotos = [...photos]; galleryIndex = index; galleryTitle = title;
  if (!$('#viewer').open) $('#viewer').showModal();
  renderPhoto();
}
function stepPhoto(step) {
  const next = galleryIndex + step;
  if (next >= 0 && next < galleryPhotos.length) { galleryIndex = next; renderPhoto(); }
}
$('#viewer-image').addEventListener('load', () => {
  $('#viewer-image').hidden = false;
  setPhotoMode($('#viewer-image').naturalHeight > $('#viewer-image').naturalWidth * 1.8 ? 'read' : 'fit');
});
$('#viewer-image').addEventListener('error', () => { $('#viewer-error').hidden = false; });
$('#viewer-prev').addEventListener('click', () => stepPhoto(-1));
$('#viewer-next').addEventListener('click', () => stepPhoto(1));
$('#viewer').addEventListener('click', event => {
  const mode = event.target.closest('[data-photo-mode]');
  if (mode) setPhotoMode(mode.dataset.photoMode);
});
$('#viewer').addEventListener('keydown', event => {
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); stepPhoto(event.key === 'ArrowLeft' ? -1 : 1); }
});
let swipeStart = null;
$('#viewer-stage').addEventListener('touchstart', event => {
  swipeStart = event.touches.length === 1 && photoMode === 'fit' ? {x:event.touches[0].clientX,y:event.touches[0].clientY} : null;
}, {passive:true});
$('#viewer-stage').addEventListener('touchend', event => {
  if (!swipeStart || event.changedTouches.length !== 1) return;
  const dx = event.changedTouches[0].clientX - swipeStart.x, dy = event.changedTouches[0].clientY - swipeStart.y;
  if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)*1.5) stepPhoto(dx < 0 ? 1 : -1);
  swipeStart = null;
}, {passive:true});
$('#viewer-stage').addEventListener('touchcancel', () => { swipeStart = null; }, {passive:true});
$('#memory-detail').addEventListener('click', event => {
  if (event.target.closest('#detail-close')) $('#memory-detail').close();
  if (event.target.closest('[data-detail-edit]')) { $('#memory-detail').close(); openEditor(detailId); }
  const photo = event.target.closest('[data-gallery-index]');
  if (photo) { const memory = memories.find(item => item.id === detailId); if(memory) showPhoto(memory.photos, Number(photo.dataset.galleryIndex), memory.title); }
  if (event.target.closest('[data-delete]')) { const memory = memories.find(item => item.id === detailId); if(memory) removeMemory(memory); }
});
$('#love-days').addEventListener('click', event => { const button = event.target.closest('[data-detail]'); if (button) openDetail(button.dataset.detail); });
async function preparePhoto(file) { if(!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type)) throw new Error('请选择 JPG、PNG、WebP 或 GIF 图片'); if(file.size > 30*1024*1024) throw new Error('单张照片请小于 30 MB'); const source = await new Promise((resolve,reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); }); return new Promise((resolve,reject) => { const image = new Image(); image.onload = () => { const scale = Math.min(1,1600/Math.max(image.width,image.height)); const canvas = document.createElement('canvas'); canvas.width = Math.max(1,Math.round(image.width*scale)); canvas.height = Math.max(1,Math.round(image.height*scale)); const context = canvas.getContext('2d'); context.fillStyle = '#fff'; context.fillRect(0,0,canvas.width,canvas.height); context.drawImage(image,0,0,canvas.width,canvas.height); let photo = canvas.toDataURL('image/jpeg',.8); if(photo.length > 950000) photo = canvas.toDataURL('image/jpeg',.6); resolve(photo); }; image.onerror = () => reject(new Error('这张照片无法读取，请换一张试试')); image.src = source; }); }
['#top-add','#hero-add','#section-add'].forEach(selector => $(selector).addEventListener('click', () => openEditor()));
['#editor-close','#editor-cancel'].forEach(selector => $(selector).addEventListener('click', () => { if (!processingPhotos && !saving) $('#editor').close(); }));
$('#viewer-close').addEventListener('click', () => $('#viewer').close());
$('#memories').addEventListener('click', event => { const button = event.target.closest('[data-filter]'); if(!button) return; activeFilter = button.dataset.filter; document.querySelectorAll('[data-filter]').forEach(item => { item.classList.toggle('active',item === button); item.setAttribute('aria-pressed',String(item === button)); }); render(); enter($('#series-title')); }); $('#search').addEventListener('input',render);
let processingPhotos = false;
$('#editor').addEventListener('cancel', event => { if(processingPhotos || saving) event.preventDefault(); });
$('#event-photos').addEventListener('change',async event => { const files = [...event.target.files]; if(files.length+selectedPhotos.length > 12) { event.target.value = ''; return toast('每件回忆最多收藏 12 张照片'); } processingPhotos = true; event.target.disabled = true; $('#save-button').disabled = true; $('#save-button').textContent = '正在整理照片…'; try { const photos = await Promise.all(files.map(preparePhoto)); selectedPhotos.push(...photos); renderPreviews(); } catch(error) { toast(error.message || '照片读取失败，请重试'); } finally { event.target.value = ''; event.target.disabled = false; processingPhotos = false; $('#save-button').disabled = false; $('#save-button').innerHTML = `收藏这段回忆 ${icon('heart')}`; } });
$('#photo-preview').addEventListener('click',event => { const remove = event.target.closest('[data-remove]'); if(remove) { selectedPhotos.splice(Number(remove.dataset.remove),1); renderPreviews(); } else if(event.target.dataset.preview !== undefined) showPhoto(selectedPhotos, Number(event.target.dataset.preview), $('#event-title').value || '回忆相册'); });
$('#memory-form').addEventListener('submit', async event => {
  event.preventDefault(); if(processingPhotos || saving) return;
  const title = $('#event-title').value.trim(); const date = $('#event-date').value;
  if(!title || !validDate(date)) return toast('请填写回忆的名字和有效日期');
  const existing = memories.find(memory => memory.id === editingId);
  editingId ||= crypto.randomUUID();
  const memory = {id:editingId,title,date,category:$('#event-category').value,body:$('#event-body').value.trim(),place:$('#event-place').value.trim(),photos:[...selectedPhotos],createdAt:existing?.createdAt || Date.now()};
  $('#save-status').hidden = false; $('#save-status').textContent = '正在连接共享手账…';
  saving = true; $('#save-button').disabled = true; $('#save-button').textContent = '正在收藏到共享手账…'; $('#event-photos').disabled = true;
  try {
    const data = await store.publish(memory, editingVersion, progress => {
      const message = progress.phase === 'saving' ? '照片已上传，正在保存回忆…' : `正在上传回忆与照片 ${progress.percent}%`;
      $('#save-button').textContent = message; $('#save-status').textContent = message;
    });
    dataRevision++; ready = true; lastReadError = '';
    memories = data.memories; updateLocalMigration(); render(); $('#editor').close();
    $('#sync-status').textContent = '已保存到共享手账 · 另一边刷新就能看到';
    toast(existing ? '共享回忆已更新' : '已收藏，另一边也能看到这段回忆了');
  } catch(error) { $('#save-status').textContent = error.message; toast(error.message); }
  finally { saving = false; $('#save-button').disabled = false; $('#save-button').innerHTML = `收藏这段回忆 ${icon('heart')}`; $('#event-photos').disabled = false; }
});
async function removeMemory(memory) {
  if(saving) return;
  if(!confirm(`确定从共享手账移除「${memory.title}」吗？两边将不再显示这条回忆。公开过的文件仍可能保留在 GitHub 历史版本中。`)) return;
  saving = true; document.querySelectorAll('[data-delete]').forEach(button => button.disabled = true);
  try { const data = await store.remove(memory.id,memory.version); dataRevision++; memories = data.memories; render(); updateLocalMigration(); if(detailId === memory.id) $('#memory-detail').close(); toast('已从共享手账移除'); }
  catch(error) { toast(error.message); }
  finally { saving = false; document.querySelectorAll('[data-delete]').forEach(button => button.disabled = false); }
}
$('#memory-list').addEventListener('click',event => {
  const card = event.target.closest('[data-memory]');
  if(card) openDetail(card.dataset.memory);
});
$('#memory-list').addEventListener('load', event => {
  const image = event.target;
  if (image.matches('.card-picture img') && image.naturalHeight > image.naturalWidth * 1.8) image.classList.add('long-preview');
}, true);
$('#sync-refresh').addEventListener('click', () => refresh());
async function publishLocal() {
  if(!ready || saving) return;
  const pending = localMemories.filter(item => !memories.some(remote => remote.id === item.id));
  saving = true; $('#publish-local').disabled = true;
  try {
    for(const [index,memory] of pending.entries()) {
      $('#sync-status').textContent = `正在公开本机回忆 ${index+1} / ${pending.length}…`;
      const data = await store.publish(memory,null); dataRevision++; memories = data.memories; render(); updateLocalMigration();
    }
    $('#sync-status').textContent = '本机回忆已公开到共享手账'; toast('两边现在都可以看到这些回忆了');
  } catch(error) { toast(error.message); }
  finally { saving = false; $('#publish-local').disabled = false; }
}
$('#publish-local').addEventListener('click',publishLocal);
async function readLocalMemories() {
  if(!window.indexedDB) return;
  try {
    const localDb = await new Promise((resolve,reject) => { const request = indexedDB.open('our-little-moments',1); request.onupgradeneeded = () => request.result.createObjectStore('memories',{keyPath:'id'}); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    try { localMemories = await new Promise((resolve,reject) => { const request = localDb.transaction('memories').objectStore('memories').getAll(); request.onsuccess = () => resolve(request.result.map(memory => ({...memory,category:normalizeCategory(memory.category)}))); request.onerror = () => reject(request.error); }); } finally { localDb.close(); }
    if(ready) updateLocalMigration();
  } catch { /* 本机旧记录读取失败不会阻止共享手账加载。 */ }
}
function autoRefresh() { if(!document.hidden && !document.querySelector('dialog[open]') && Date.now()-lastReadAt > 15000) refresh({quiet:true}); }
window.addEventListener('focus',autoRefresh);
setInterval(() => { autoRefresh(); if(ready) renderLoveDays(); },60000);
render(); refresh(); readLocalMemories();
