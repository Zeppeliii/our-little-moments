import {GitHubStore} from './github-store.js';
import {MenuStore} from './menu-store.js';
import {StoreError,validateDraft} from './memory-model.js';

const LIMIT = 16 * 1024 * 1024;
const ID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
async function readJSON(request) {
  if(!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) throw new StoreError('请求格式不正确',415);
  if(Number(request.headers.get('Content-Length')) > LIMIT) throw new StoreError('本次照片较大，请减少照片张数后再保存',413);
  const reader = request.body?.getReader();
  if(!reader) throw new StoreError('缺少回忆内容',400);
  let size = 0; const chunks = [];
  while(true) {
    const {done,value} = await reader.read(); if(done) break;
    size += value.byteLength;
    if(size > LIMIT) { await reader.cancel(); throw new StoreError('本次照片较大，请减少照片张数后再保存',413); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for(const chunk of chunks) { bytes.set(chunk,offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new StoreError('回忆数据格式不正确',400); }
}
export function createHandler(makeStore = env => new GitHubStore({token:env.GITHUB_TOKEN})) {
  return async function handle(request,env) {
    const origin = request.headers.get('Origin');
    const allowedOrigin = env.ALLOWED_ORIGIN || 'https://zeppeliii.github.io';
    const headers = {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin'};
    const json = (data,status = 200) => new Response(JSON.stringify(data),{status,headers});
    if(origin && origin !== allowedOrigin) return json({error:'此页面不能操作共享手账'},403);
    if(origin) headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'GET, POST, DELETE, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type';
    if(request.method === 'OPTIONS') return new Response(null,{status:204,headers});
    try {
      const path = new URL(request.url).pathname.replace(/\/$/,'');
      if(path === '/health' && request.method === 'GET') return json({ok:true,configured:Boolean(env.GITHUB_TOKEN)});
      if(path === '/menu') {
        const menu = new MenuStore({token:env.GITHUB_TOKEN});
        if(request.method === 'GET') return json(await menu.read());
        if(request.method !== 'POST') return json({error:'不支持此操作'},405);
        if(!origin || origin !== allowedOrigin) return json({error:'请从手账网站点单'},403);
        if(!env.GITHUB_TOKEN) return json({error:'共享菜单服务尚未配置完成'},503);
        const body = await readJSON(request);
        if(!body || typeof body !== 'object' || Array.isArray(body)) throw new StoreError('请求格式不正确',400);
        return json(await menu.change(body.action,body.value,body.expectedVersion ?? null));
      }
      if(path !== '/memories' && !/^\/memories\/[^/]+$/.test(path)) return json({error:'未找到请求的功能'},404);
      const store = makeStore(env);
      if(path === '/memories' && request.method === 'GET') return json(await store.read());
      if(request.method !== 'POST' && request.method !== 'DELETE') return json({error:'不支持此操作'},405);
      if(!origin || origin !== allowedOrigin) return json({error:'请从手账网站保存回忆'},403);
      if(!env.GITHUB_TOKEN) return json({error:'共享保存服务尚未配置完成，请稍后再试'},503);
      const body = await readJSON(request);
      if(!body || typeof body !== 'object' || Array.isArray(body)) throw new StoreError('请求格式不正确',400);
      const expected = body.expectedVersion ?? null;
      if(expected !== null && (typeof expected !== 'string' || !ID.test(expected))) throw new StoreError('回忆版本不正确，请刷新后重试',400);
      if(path === '/memories' && request.method === 'POST') {
        const value = body.memory;
        if(!value || !ID.test(value.id)) throw new StoreError('回忆编号不正确',400);
        const memory = {id:value.id,title:value.title,date:value.date,category:value.category,body:value.body,place:value.place,photos:value.photos,createdAt:value.createdAt};
        validateDraft(memory);
        return json(await store.publish(memory,expected));
      }
      if(request.method === 'DELETE' && path.startsWith('/memories/')) {
        const id = path.slice('/memories/'.length);
        if(!ID.test(id) || !expected) throw new StoreError('回忆编号或版本不正确，请刷新后重试',400);
        return json(await store.remove(id,expected));
      }
      return json({error:'不支持此操作'},405);
    } catch(error) {
      if(error instanceof StoreError) {
        const status = error.status || 502;
        if([401,403,404].includes(status)) return json({error:'共享保存服务暂时不可用，请稍后重试'},502);
        return json({error:error.message},status);
      }
      return json({error:'共享保存服务暂时不可用，请保留内容并稍后重试'},502);
    }
  };
}
export default {fetch:createHandler()};
