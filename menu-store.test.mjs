import test from 'node:test';
import assert from 'node:assert/strict';
import {MenuStore} from './menu-store.js';
const id='11111111-1111-4111-8111-111111111111',version='22222222-2222-4222-8222-222222222222',next='33333333-3333-4333-8333-333333333333';
const dish={id,version,name:'彩椒牛肉',description:'',category:'荤菜',photo:'',rating:2,createdAt:1};
const menu=()=>({version:1,dishes:[{...dish}],orders:[]});
const encoded=data=>Buffer.from(JSON.stringify(data)).toString('base64');
test('半星评分只读写菜单文件两次请求，正确保存中文且保留其他内容',async()=>{
 const calls=[];const store=new MenuStore({token:'模拟',uuid:()=>next,fetcher:async(url,options)=>{calls.push([url,options]);
  if(options.method==='GET')return Response.json({sha:'blob1',encoding:'base64',content:encoded(menu())});
  assert.equal(options.method,'PUT');const body=JSON.parse(options.body);assert.equal(body.sha,'blob1');const saved=JSON.parse(Buffer.from(body.content,'base64').toString());assert.equal(saved.dishes[0].name,'彩椒牛肉');assert.equal(saved.dishes[0].rating,4.5);assert.equal(saved.dishes[0].version,next);assert.deepEqual(saved.orders,[]);return Response.json({});
 }});
 const result=await store.change('rate-dish',{id,rating:4.5},version);assert.equal(result.dishes[0].rating,4.5);assert.equal(calls.length,2);assert.ok(calls.every(([url])=>url.includes('/contents/menu.json')));
});
test('文件写入冲突后重新读取并合并，另一边同菜品已更新时拒绝覆盖',async()=>{
 let reads=0,writes=0;const store=new MenuStore({token:'模拟',uuid:()=>next,fetcher:async(url,options)=>{
  if(options.method==='GET'){reads++;const data=menu();if(reads===2)data.dishes[0].version=next;return Response.json({sha:'blob'+reads,encoding:'base64',content:encoded(data)});}
  writes++;return Response.json({},{status:409});
 }});await assert.rejects(store.change('rate-dish',{id,rating:4},version),e=>e.status===409);assert.equal(reads,2);assert.equal(writes,1);
});
test('非法分数不访问 GitHub',async()=>{
 const store=new MenuStore({token:'模拟',fetcher:async()=>assert.fail('不应发送请求')});
 for(const rating of [0,5.5,3.2,NaN])await assert.rejects(store.change('rate-dish',{id,rating},version),e=>e.status===400);
});
