const RAW = "https://raw.githubusercontent.com/Zeppeliii/our-little-moments";
const BRANCH = "main";
const PHOTO_PATH = /^data\/photos\/[a-f0-9-]{36}\/[a-f0-9-]{36}\.jpg$/;
const DATA_PHOTO = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/;
const ID = /^[a-f0-9-]{36}$/;
const CATEGORIES = ['第一次','心动回忆','日常','纪念日'];
export class StoreError extends Error {
  constructor(message, status = 0) { super(message); this.status = status; }
}
export function photoPath(photo) {
  const prefix = `${RAW}/${BRANCH}/`;
  return typeof photo === 'string' && photo.startsWith(prefix) && PHOTO_PATH.test(photo.slice(prefix.length)) ? photo.slice(prefix.length) : null;
}
export function validateManifest(data) {
  if (!data || data.version !== 1 || !Array.isArray(data.memories)) throw new StoreError('共享记录格式不正确，请先检查仓库数据');
  const ids = new Set();
  for (const memory of data.memories) {
    if (!memory || !ID.test(memory.id) || ids.has(memory.id) || typeof memory.title !== 'string' || !memory.title.trim() || memory.title.length > 80 || !CATEGORIES.includes(memory.category) || !/^\d{4}-\d{2}-\d{2}$/.test(memory.date) || typeof memory.body !== 'string' || memory.body.length > 10000 || typeof memory.place !== 'string' || memory.place.length > 100 || !Number.isFinite(memory.createdAt) || !ID.test(memory.version) || !Array.isArray(memory.photos) || memory.photos.length > 12 || !memory.photos.every(photo => photoPath(photo)?.startsWith(`data/photos/${memory.id}/`))) throw new StoreError('共享记录格式不正确，请先检查仓库数据');
    ids.add(memory.id);
  }
  return data;
}

export function validateDraft(memory) {
  if(!memory || !Array.isArray(memory.photos)) throw new StoreError('回忆内容不完整',400);
  const remotePhotos = memory.photos.filter(photo => photoPath(photo));
  if(memory.photos.length > 12 || memory.photos.some(photo => !photoPath(photo) && (typeof photo !== 'string' || !DATA_PHOTO.test(photo) || photo.length > 4 * 1024 * 1024))) throw new StoreError('照片过大或格式不正确，请减少照片数量后重试',400);
  try { validateManifest({version:1,memories:[{...memory,version:'00000000-0000-4000-8000-000000000000',photos:remotePhotos}]}); }
  catch { throw new StoreError('回忆内容不完整或格式不正确，请检查标题、日期和照片',400); }
  const date = new Date(memory.date + 'T12:00:00Z');
  if(!Number.isFinite(date.getTime()) || date.toISOString().slice(0,10) !== memory.date) throw new StoreError('请选择有效日期',400);
  return memory;
}
