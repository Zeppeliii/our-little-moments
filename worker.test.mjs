import test from 'node:test';
import assert from 'node:assert/strict';
import {createHandler} from './worker.js';
import {CloudStore} from './shared-store.js';
import {StoreError} from './memory-model.js';
const origin='https://zeppeliii.github.io';
const id='11111111-1111-4111-8111-111111111111';
const version='22222222-2222-4222-8222-222222222222';
const memory={id,title:'回忆',date:'2026-10-23',category:'日常',body:'',place:'',photos:[],createdAt:1};
const data={version:1,memories:[]};
const request=(path,method='GET',body,source=origin)=>new Request('https://example.com'+path,{method,headers:{...(source?{Origin:source}:{}),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
test('预检允许正式网站，其他来源和无来源写入被拒绝',async()=>{
 const handle=createHandler(()=>({}));
 const pre=await handle(request('/memories','OPTIONS'),{});
 assert.equal(pre.status,204); assert.equal(pre.headers.get('Access-Control-Allow-Origin'),origin);
 assert.equal((await handle(request('/memories','POST',{},'https://example.org'),{})).status,403);
 assert.equal((await handle(request('/memories','POST',{},null),{})).status,403);
});
test('后台缺少凭据时禁止写入，公开读取正常',async()=>{
 const handle=createHandler(()=>({read:async()=>data}));
 assert.equal((await handle(request('/memories','POST',{memory}),{})).status,503);
 assert.deepEqual(await (await handle(request('/memories'),{})).json(),data);
});
test('合法保存只传递回忆字段，无效日期和任意文件地址不触发保存',async()=>{
 let count=0;
 const handle=createHandler(()=>({publish:async(value,expected)=>{count++;assert.deepEqual(value,memory);assert.equal(expected,null);return data;}}));
 assert.equal((await handle(request('/memories','POST',{memory:{...memory,token:'忽略'}}),{GITHUB_TOKEN:'模拟'})).status,200);
 for(const invalid of [{...memory,date:'2026-02-30'},{...memory,photos:['https://example.org/a.jpg']}]) assert.equal((await handle(request('/memories','POST',{memory:invalid}),{GITHUB_TOKEN:'模拟'})).status,400);
 assert.equal(count,1);
});
test('冲突返回409，后台凭据错误不暴露细节，删除需要版本',async()=>{
 const handle=createHandler(()=>({publish:async()=>{throw new StoreError('冲突',409)},remove:async(value,expected)=>{assert.equal(value,id);assert.equal(expected,version);return data;}}));
 assert.equal((await handle(request('/memories','POST',{memory}),{GITHUB_TOKEN:'模拟'})).status,409);
 assert.equal((await handle(request('/memories/'+id,'DELETE',{}),{GITHUB_TOKEN:'模拟'})).status,400);
 assert.equal((await handle(request('/memories/'+id,'DELETE',{expectedVersion:version}),{GITHUB_TOKEN:'模拟'})).status,200);
 const broken=createHandler(()=>({read:async()=>{throw new StoreError('秘密',401)}}));
 const response=await broken(request('/memories'),{}); assert.equal(response.status,502); assert.ok(!(await response.text()).includes('秘密'));
});
test('前端无需授权头，保存版本和错误状态正确传递',async()=>{
 const store=new CloudStore({url:'https://example.com/',fetcher:async(url,options)=>{assert.equal(url,'https://example.com/memories');assert.equal(options.headers.Authorization,undefined);assert.deepEqual(JSON.parse(options.body),{memory,expectedVersion:version});return Response.json(data);}});
 assert.deepEqual(await store.publish(memory,version),data);
 const failing=new CloudStore({url:'https://example.com',fetcher:async()=>Response.json({error:'已在另一边修改'},{status:409})});
 await assert.rejects(failing.publish(memory),error=>error.status===409&&error.message==='已在另一边修改');
});
