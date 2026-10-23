import test from 'node:test';
import assert from 'node:assert/strict';
import {GitHubStore,validateManifest} from './shared-store.js';
const id = '11111111-1111-4111-8111-111111111111';
const version = '22222222-2222-4222-8222-222222222222';
const otherId = '33333333-3333-4333-8333-333333333333';
const uuid = () => '44444444-4444-4444-8444-444444444444';
const memory = (extra = {}) => ({id,title:'第一次一起散步',date:'2026-10-23',category:'第一次',body:'那天晚风很温柔',place:'',photos:[],createdAt:1,version,...extra});
const response = (data,status=200) => ({ok:status>=200&&status<300,status,json:async()=>data});
function fixture({records=[],refFailure=false}={}) {
  const calls=[]; let refs=0;
  const fetcher=async(url,options={}) => {
    const body=options.body?JSON.parse(options.body):undefined; calls.push({url,options,body});
    if(url.includes('raw.githubusercontent.com')) return response({version:1,memories:records});
    if(url.endsWith('/git/ref/heads/main')) return response({object:{sha:`head-${refs++}`}});
    if(url.includes('/git/commits/head-')) return response({tree:{sha:'base-tree'}});
    if(url.endsWith('/git/blobs')) return response({sha:'photo-blob'});
    if(url.endsWith('/git/trees')) return response({sha:'new-tree'});
    if(url.endsWith('/git/commits')) return response({sha:'new-commit'});
    if(url.endsWith('/git/refs/heads/main')) { if(refFailure) { refFailure=false; records=[...records,memory({id:otherId,title:'另一边刚刚添加的日常',category:'日常'})]; return response({},422); } return response({}); }
    return response({default_branch:'main',permissions:{push:true}});
  };
  const store=new GitHubStore({fetcher,uuid}); return {store,calls};
}
test('未授权时禁止保存，读取不发送令牌',async()=>{
  const {store,calls}=fixture(); await store.read(); await assert.rejects(store.publish(memory(),null),/连接 GitHub/);
  assert.equal(calls.length,1); assert.equal(calls[0].options.headers,undefined);
});
test('文字与图片先组装同一棵树，最后一次更新主分支',async()=>{
  const {store,calls}=fixture(); await store.connect('test-token');
  const result=await store.publish(memory({photos:['data:image/jpeg;base64,YWJj']}),null);
  assert.equal(result.memories.length,1); assert.match(result.memories[0].photos[0],/raw.githubusercontent.com/);
  const tree=calls.find(call=>call.url.endsWith('/git/trees')).body;
  assert.equal(tree.base_tree,'base-tree'); assert.equal(tree.tree.length,2);
  const manifest=JSON.parse(tree.tree.find(entry=>entry.path==='memories.json').content);
  assert.equal(manifest.memories[0].title,'第一次一起散步');
  assert.equal(calls.at(-1).body.force,false);
  assert.equal(calls.filter(call=>call.url.includes('raw.githubusercontent.com')).every(call=>!call.options.headers),true);
});
test('同一条回忆被另一边编辑后禁止覆盖',async()=>{
  const {store,calls}=fixture({records:[memory()]}); await store.connect('test-token');
  await assert.rejects(store.publish(memory(),otherId),/另一边修改/);
  assert.equal(calls.some(call=>call.url.endsWith('/git/trees')),false);
});
test('更新主分支冲突后重试，保留另一边新添加的回忆',async()=>{
  const {store,calls}=fixture({refFailure:true}); await store.connect('test-token');
  const result=await store.publish(memory(),null);
  assert.equal(result.memories.length,2); assert.equal(result.memories.some(item=>item.id===otherId),true);
  assert.equal(calls.filter(call=>call.url.endsWith('/git/refs/heads/main')).length,2);
});
test('移除回忆时同时移除当前版本的照片引用',async()=>{
  const photo=`https://raw.githubusercontent.com/Zeppeliii/our-little-moments/main/data/photos/${id}/${version}.jpg`;
  const {store,calls}=fixture({records:[memory({photos:[photo]})]}); await store.connect('test-token');
  const result=await store.remove(id,version); assert.equal(result.memories.length,0);
  const tree=calls.find(call=>call.url.endsWith('/git/trees')).body.tree;
  assert.equal(tree[0].sha,null); assert.match(tree[0].path,/data\/photos/);
});
test('损坏的数据、外部图片链接和重复编号不能进入共享手账',()=>{
  assert.throws(()=>validateManifest({version:1,memories:[memory({photos:['https://example.com/private.jpg']})]}));
  assert.throws(()=>validateManifest({version:1,memories:[memory(),memory()]}));
  assert.throws(()=>validateManifest({version:1,memories:[memory({title:''})]}));
});
test('共享文件读取失败不伪装为空白手账',async()=>{
  const store=new GitHubStore({fetcher:async()=>response({},404)});
  await assert.rejects(store.read(),/无法读取/);
});
