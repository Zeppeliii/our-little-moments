import { GitHubStore } from './shared-store.js';
'use strict';
const $ = (selector) => document.querySelector(selector);
const categoryNames = {第一次:'01 第一次',心动回忆:'♡ 心动回忆',日常:'☀ 日常',纪念日:'🎀 纪念日'};
const seriesDescriptions = {全部:'四个系列，收藏我们故事里的不同篇章。',第一次:'第一次牵手、第一次拥抱……每一个开始，都因为你而特别。',心动回忆:'收藏那些让心跳漏了一拍、想起来还会偷偷笑的瞬间。',日常:'一起吃饭、散步、说晚安，平凡的日子也闪闪发光。',纪念日:'生日、恋爱周年，还有每一个值得认真庆祝的日子。'};
function normalizeCategory(category) {
  if (Object.hasOwn(categoryNames, category)) return category;
  return category === '小事' ? '心动回忆' : '日常';
}
function newMemoryCategory(filter) { return Object.hasOwn(categoryNames, filter) ? filter : '日常'; }
let memories = [], selectedPhotos = [], editingId = null, activeFilter = '全部', toastTimer;
const store = new GitHubStore();
let ready = false, reading = false, saving = false, lastReadError = '', lastReadAt = 0, pendingAction = null, localMemories = [];
let editingVersion = null;
const escapeHTML = (value = '') => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
function toast(message) { $('#toast').textContent = message; $('#toast').classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 3600); }
function localDate() { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
function validDate(value) { if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false; const date = new Date(value + 'T12:00:00'); return !isNaN(date) && `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}` === value; }
function updateConnection() { $('#connect-open').textContent = store.connected ? '已连接 · 断开' : '连接 GitHub'; }
function updateLocalMigration() {
  const pending = localMemories.filter(item => !memories.some(remote => remote.id === item.id));
  $('#local-migration').hidden = !pending.length;
  $('#local-migration-note').textContent = `这台浏览器还有 ${pending.length} 条旧回忆，尚未公开到共享手账。`;
}
async function refresh({quiet = false} = {}) {
  if(reading || saving) return;
  reading = true; $('#sync-refresh').disabled = true;
  if(!quiet) $('#sync-status').textContent = '正在读取共享回忆…';
  try {
    const data = await store.read();
    memories = data.memories; ready = true; lastReadError = ''; lastReadAt = Date.now();
    $('#sync-status').textContent = '♡ 共享回忆已更新 · 两边都能看到';
    updateLocalMigration(); render();
  } catch(error) {
    lastReadError = error.message;
    $('#sync-status').textContent = '暂时无法更新，请检查网络后重试';
    if(!quiet) toast(error.message);
    render();
  } finally { reading = false; $('#sync-refresh').disabled = false; }
}
function showConnection(action) { pendingAction = action || null; $('#connection-error').textContent = ''; $('#github-token').value = ''; $('#connection').showModal(); }
function render() {
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
    list.innerHTML = `<div class="empty"><svg aria-hidden="true"><use href="#kitty"/></svg><h3>${title}</h3><p>${description}</p>${query ? '' : `<button class="primary" id="first-add">＋ ${activeFilter === '全部' ? '写下第一段回忆' : `记录${activeFilter}`}</button>`}</div>`;
    $('#first-add')?.addEventListener('click', () => openEditor()); return;
  }
  let month = ''; let html = '';
  visible.forEach(memory => {
    const nextMonth = memory.date.slice(0,7);
    if (month !== nextMonth) { if(month) html += '</div>'; month = nextMonth; html += `<h3 class="month-title">${month.slice(0,4)} 年 ${Number(month.slice(5))} 月 <span>属于我们的时光</span></h3><div class="cards">`; }
    html += `<article class="memory-card"><div class="card-picture ${memory.photos.length ? '' : 'no-photo'}">${memory.photos.length ? `<img src="${escapeHTML(memory.photos[0])}" alt="${escapeHTML(memory.title)}" loading="lazy" data-view="${escapeHTML(memory.id)}"><span class="photo-badge">${memory.photos.length} 张照片</span>` : '<svg aria-hidden="true"><use href="#kitty"/></svg>'}</div><div class="card-content"><div class="card-meta"><time datetime="${memory.date}">${memory.date.replaceAll('-',' / ')}</time><span class="category">${categoryNames[memory.category]}</span></div><h3>${escapeHTML(memory.title)}</h3><p class="card-body">${escapeHTML(memory.body || '那天有你，就是一件值得记住的小事。')}</p><div class="card-bottom"><span class="place">${memory.place ? '⌖ '+escapeHTML(memory.place) : '♡ 收藏了一份小幸福'}</span><div class="card-actions"><button data-edit="${escapeHTML(memory.id)}">查看 / 编辑</button><button data-delete="${escapeHTML(memory.id)}" aria-label="删除${escapeHTML(memory.title)}">删除</button></div></div></div></article>`;
  }); list.innerHTML = html + '</div>';
}
function renderPreviews() { $('#photo-preview').innerHTML = selectedPhotos.map((photo,index) => `<div class="preview-item"><img src="${escapeHTML(photo)}" alt="回忆照片 ${index+1}" data-preview="${index}"><button type="button" data-remove="${index}" aria-label="移除第 ${index+1} 张照片">×</button></div>`).join(''); }
function openEditor(id) { if(!ready || reading || saving) return toast('共享手账正在准备，请稍后再试'); const memory = memories.find(item => item.id === id); editingId = memory?.id || null; editingVersion = memory?.version || null; $('#memory-form').reset(); $('#event-title').value = memory?.title || ''; $('#event-date').value = memory?.date || localDate(); $('#event-category').value = memory?.category || newMemoryCategory(activeFilter); $('#event-body').value = memory?.body || ''; $('#event-place').value = memory?.place || ''; selectedPhotos = [...(memory?.photos || [])]; $('#editor-title').innerHTML = `${memory ? '重温这件小事' : '记一件小事'} <span class="pink">♡</span>`; renderPreviews(); $('#editor').showModal(); }
function showPhoto(photo) { $('#viewer-image').src = photo; $('#viewer').showModal(); }
async function preparePhoto(file) { if(!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type)) throw new Error('请选择 JPG、PNG、WebP 或 GIF 图片'); if(file.size > 30*1024*1024) throw new Error('单张照片请小于 30 MB'); const source = await new Promise((resolve,reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); }); return new Promise((resolve,reject) => { const image = new Image(); image.onload = () => { const scale = Math.min(1,1800/Math.max(image.width,image.height)); const canvas = document.createElement('canvas'); canvas.width = Math.max(1,Math.round(image.width*scale)); canvas.height = Math.max(1,Math.round(image.height*scale)); const context = canvas.getContext('2d'); context.fillStyle = '#fff'; context.fillRect(0,0,canvas.width,canvas.height); context.drawImage(image,0,0,canvas.width,canvas.height); resolve(canvas.toDataURL('image/jpeg',.85)); }; image.onerror = () => reject(new Error('这张照片无法读取，请换一张试试')); image.src = source; }); }
['#top-add','#hero-add','#section-add'].forEach(selector => $(selector).addEventListener('click', () => openEditor()));
['#editor-close','#editor-cancel'].forEach(selector => $(selector).addEventListener('click', () => { if (!processingPhotos && !saving) $('#editor').close(); }));
$('#viewer-close').addEventListener('click', () => $('#viewer').close());
$('#memories').addEventListener('click', event => { const button = event.target.closest('[data-filter]'); if(!button) return; activeFilter = button.dataset.filter; document.querySelectorAll('[data-filter]').forEach(item => { item.classList.toggle('active',item === button); item.setAttribute('aria-pressed',String(item === button)); }); render(); }); $('#search').addEventListener('input',render);
let processingPhotos = false;
$('#editor').addEventListener('cancel', event => { if(processingPhotos || saving) event.preventDefault(); });
$('#event-photos').addEventListener('change',async event => { const files = [...event.target.files]; if(files.length+selectedPhotos.length > 12) { event.target.value = ''; return toast('每件回忆最多收藏 12 张照片'); } processingPhotos = true; event.target.disabled = true; $('#save-button').disabled = true; $('#save-button').textContent = '正在整理照片…'; try { const photos = await Promise.all(files.map(preparePhoto)); selectedPhotos.push(...photos); renderPreviews(); } catch(error) { toast(error.message || '照片读取失败，请重试'); } finally { event.target.value = ''; event.target.disabled = false; processingPhotos = false; $('#save-button').disabled = false; $('#save-button').textContent = '收藏这段回忆 ♡'; } });
$('#photo-preview').addEventListener('click',event => { const remove = event.target.closest('[data-remove]'); if(remove) { selectedPhotos.splice(Number(remove.dataset.remove),1); renderPreviews(); } else if(event.target.dataset.preview !== undefined) showPhoto(selectedPhotos[Number(event.target.dataset.preview)]); });
$('#memory-form').addEventListener('submit', async event => {
  event.preventDefault(); if(processingPhotos || saving) return;
  const title = $('#event-title').value.trim(); const date = $('#event-date').value;
  if(!title || !validDate(date)) return toast('请填写回忆的名字和有效日期');
  if(!store.connected) return showConnection(() => $('#memory-form').requestSubmit());
  const existing = memories.find(memory => memory.id === editingId);
  const memory = {id:editingId || crypto.randomUUID(),title,date,category:$('#event-category').value,body:$('#event-body').value.trim(),place:$('#event-place').value.trim(),photos:[...selectedPhotos],createdAt:existing?.createdAt || Date.now()};
  saving = true; $('#save-button').disabled = true; $('#save-button').textContent = '正在收藏到共享手账…'; $('#event-photos').disabled = true;
  try {
    const data = await store.publish(memory, editingVersion);
    memories = data.memories; updateLocalMigration(); render(); $('#editor').close();
    $('#sync-status').textContent = '♡ 已保存到共享手账 · 另一边刷新就能看到';
    toast(existing ? '共享回忆已更新 ♡' : '已收藏，另一边也能看到这段回忆了 ♡');
  } catch(error) { toast(error.message); }
  finally { saving = false; $('#save-button').disabled = false; $('#save-button').textContent = '收藏这段回忆 ♡'; $('#event-photos').disabled = false; }
});
async function removeMemory(memory) {
  if(saving) return;
  if(!store.connected) return showConnection(() => removeMemory(memory));
  if(!confirm(`确定从共享手账移除「${memory.title}」吗？两边将不再显示这条回忆。公开过的文件仍可能保留在 GitHub 历史版本中。`)) return;
  saving = true; document.querySelectorAll('[data-delete]').forEach(button => button.disabled = true);
  try { const data = await store.remove(memory.id,memory.version); memories = data.memories; render(); updateLocalMigration(); toast('已从共享手账移除'); }
  catch(error) { toast(error.message); }
  finally { saving = false; document.querySelectorAll('[data-delete]').forEach(button => button.disabled = false); }
}
$('#memory-list').addEventListener('click',event => {
  const edit = event.target.closest('[data-edit]'); const remove = event.target.closest('[data-delete]'); const view = event.target.closest('[data-view]');
  if(edit) openEditor(edit.dataset.edit);
  if(view) { const memory = memories.find(m => m.id === view.dataset.view); showPhoto(memory.photos[0]); }
  if(remove) { const memory = memories.find(m => m.id === remove.dataset.delete); removeMemory(memory); }
});
$('#connect-open').addEventListener('click', () => { if(store.connected) { store.disconnect(); updateConnection(); toast('已断开连接，仍可查看共享回忆'); } else showConnection(); });
$('#connect-close').addEventListener('click', () => { $('#github-token').value = ''; pendingAction = null; $('#connection').close(); });
$('#connection').addEventListener('close', () => { $('#github-token').value = ''; });
$('#connection-form').addEventListener('submit',async event => {
  event.preventDefault(); $('#connect-button').disabled = true; $('#connection-error').textContent = '';
  try { await store.connect($('#github-token').value); $('#github-token').value = ''; updateConnection(); $('#connection').close(); const action = pendingAction; pendingAction = null; if(action) await action(); else toast('已连接，现在可以收藏共享回忆 ♡'); }
  catch(error) { $('#connection-error').textContent = error.message; }
  finally { $('#connect-button').disabled = false; }
});
$('#sync-refresh').addEventListener('click', () => refresh());
async function publishLocal() {
  if(!ready || saving) return;
  if(!store.connected) return showConnection(publishLocal);
  const pending = localMemories.filter(item => !memories.some(remote => remote.id === item.id));
  saving = true; $('#publish-local').disabled = true;
  try {
    for(const [index,memory] of pending.entries()) {
      $('#sync-status').textContent = `正在公开本机回忆 ${index+1} / ${pending.length}…`;
      const data = await store.publish(memory,null); memories = data.memories; render(); updateLocalMigration();
    }
    $('#sync-status').textContent = '♡ 本机回忆已公开到共享手账'; toast('两边现在都可以看到这些回忆了 ♡');
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
setInterval(autoRefresh,60000);
render(); updateConnection(); refresh(); readLocalMemories();
