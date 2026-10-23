import {StoreError, validateDraft, validateManifest} from './memory-model.js';
import {uploadRequest} from './upload-request.js';
import {WORKER_URL} from './site-config.js';

export class CloudStore {
  constructor({url = WORKER_URL, fetcher = (...args) => fetch(...args)} = {}) { this.url = url.replace(/\/$/,''); this.fetcher = fetcher; }
  async request(path, {method = 'GET',body,onProgress} = {}) {
    if(!this.url) throw new StoreError('共享保存服务尚未配置完成，请稍后再试');
    const serialized = body ? JSON.stringify(body) : undefined;
    if(serialized && new TextEncoder().encode(serialized).length > 16 * 1024 * 1024) throw new StoreError('本次照片较大，请减少照片张数后再保存');
    let response;
    try {
      if(body && typeof XMLHttpRequest === 'function') response = await uploadRequest(`${this.url}${path}`,{method,body:serialized,onProgress});
      else response = await this.fetcher(`${this.url}${path}`,{method,headers:body?{'Content-Type':'application/json'}:{},body:serialized,cache:'no-store',signal:AbortSignal.timeout(15000)});
    }
    catch(error) { if(error instanceof StoreError) throw error; throw new StoreError('连接共享手账超时或网络不可用，请保留内容，稍后刷新确认是否保存'); }
    let data;
    try { data = await response.json(); } catch { throw new StoreError('共享手账暂时无法连接，请稍后再试'); }
    if(!response.ok) throw new StoreError(data.error || '保存暂时失败，请保留内容并稍后重试',response.status);
    return validateManifest(data);
  }
  async read() { return this.request('/memories'); }
  async publish(memory, expectedVersion = null, onProgress) { validateDraft(memory); return this.request('/memories',{method:'POST',body:{memory,expectedVersion},onProgress}); }
  async remove(id, expectedVersion) { return this.request(`/memories/${encodeURIComponent(id)}`,{method:'DELETE',body:{expectedVersion}}); }
}
