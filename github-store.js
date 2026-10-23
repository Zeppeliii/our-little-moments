import {StoreError, validateManifest, validateDraft, photoPath} from './memory-model.js';
const OWNER = 'Zeppeliii';
const REPO = 'our-little-moments';
const BRANCH = 'main';
const MANIFEST = 'memories.json';
const API = `https://api.github.com/repos/${OWNER}/${REPO}`;
const RAW = `https://raw.githubusercontent.com/${OWNER}/${REPO}`;
const DATA_PHOTO = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/;
const ID = /^[a-f0-9-]{36}$/;
export class GitHubStore {
  constructor({token = '', fetcher = (...args) => fetch(...args), uuid = () => crypto.randomUUID()} = {}) { this.fetcher = fetcher; this.uuid = uuid; this.token = token; }
  get connected() { return Boolean(this.token); }
  async request(path, {method = 'GET', body, token = this.token} = {}) {
    let response;
    try { response = await this.fetcher(`${API}${path}`, {method, headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'our-little-moments-worker',...(token ? {Authorization:`Bearer ${token}`} : {}),...(body ? {'Content-Type':'application/json'} : {})}, ...(body ? {body:JSON.stringify(body)} : {}), cache:'no-store'}); }
    catch { throw new StoreError('网络连接失败，请保留当前内容并稍后重试'); }
    if (!response.ok) {
      const messages = {401:'GitHub 授权已失效，请重新连接',403:'GitHub 权限不足或请求过于频繁，请检查此仓库的 Contents 读写权限后重试',404:'未找到仓库或文件，请检查仓库授权',409:'共享记录刚刚发生变化，请稍后重试',422:'共享记录刚刚发生变化，请稍后重试'};
      throw new StoreError(messages[response.status] || 'GitHub 保存失败，请保留当前内容并稍后重试',response.status);
    }
    return response.json();
  }
  async read(ref = BRANCH) {
    let response;
    try { response = await this.fetcher(`${RAW}/${encodeURIComponent(ref)}/${MANIFEST}?t=${Date.now()}`, {cache:'no-store'}); }
    catch { throw new StoreError('共享回忆暂时无法读取，请检查网络后刷新'); }
    if (!response.ok) throw new StoreError('共享回忆暂时无法读取，请检查网络后刷新',response.status);
    let data;
    try { data = await response.json(); } catch { throw new StoreError('共享记录格式不正确，请先检查仓库数据'); }
    return validateManifest(data);
  }
  async publish(memory, expectedVersion = null) { return this.mutate(memory.id, memory, expectedVersion); }
  async remove(id, expectedVersion) { return this.mutate(id, null, expectedVersion); }
  async mutate(id, memory, expectedVersion) {
    if (!this.connected) throw new StoreError('请先连接 GitHub，再保存共享回忆');
    if (!ID.test(id)) throw new StoreError('回忆编号无效',400);
    if (memory) validateDraft(memory);
    const prepared = memory ? {...memory,version:this.uuid(),updatedAt:Date.now(),photos:[]} : null;
    const photoEntries = [];
    if (memory) {
      for (const photo of memory.photos) {
        const existingPath = photoPath(photo);
        if (existingPath) { prepared.photos.push(photo); continue; }
        const match = typeof photo === 'string' && photo.match(DATA_PHOTO);
        if (!match) throw new StoreError('照片格式不正确，请重新选择照片');
        const path = `data/photos/${id}/${this.uuid()}.jpg`;
        const blob = await this.request('/git/blobs', {method:'POST',body:{content:match[1],encoding:'base64'}});
        photoEntries.push({path,mode:'100644',type:'blob',sha:blob.sha});
        prepared.photos.push(`${RAW}/${BRANCH}/${path}`);
      }
      validateManifest({version:1,memories:[prepared]});
    }
    for (let attempt = 0; attempt < 3; attempt++) {
      const ref = await this.request(`/git/ref/heads/${BRANCH}`);
      const commit = await this.request(`/git/commits/${ref.object.sha}`);
      const data = await this.read(ref.object.sha);
      const previous = data.memories.find(item => item.id === id);
      if ((previous?.version || null) !== expectedVersion) throw new StoreError('这条回忆已在另一边修改，请先关闭编辑、刷新后再修改',409);
      if (!memory && !previous) throw new StoreError('这条回忆已经被移除，请刷新页面',409);
      const next = data.memories.filter(item => item.id !== id);
      if (prepared) next.push(prepared);
      const removedPhotos = (previous?.photos || []).filter(photo => !prepared?.photos.includes(photo)).map(photo => ({path:photoPath(photo),mode:'100644',type:'blob',sha:null}));
      const tree = await this.request('/git/trees', {method:'POST',body:{base_tree:commit.tree.sha,tree:[...photoEntries,...removedPhotos,{path:MANIFEST,mode:'100644',type:'blob',content:JSON.stringify({version:1,memories:next},null,2)}]}});
      const created = await this.request('/git/commits', {method:'POST',body:{message:memory ? `${previous ? '更新' : '收藏'}回忆：${memory.title}` : `移除回忆：${previous.title}`,tree:tree.sha,parents:[ref.object.sha]}});
      try {
        await this.request(`/git/refs/heads/${BRANCH}`, {method:'PATCH',body:{sha:created.sha,force:false}});
        return {version:1,memories:next};
      } catch (error) { if (![409,422].includes(error.status) || attempt === 2) throw error; }
    }
  }
}
