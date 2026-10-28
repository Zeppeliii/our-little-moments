import test from 'node:test';
import assert from 'node:assert/strict';
import {RatingSaver} from './menu-rating.js';
const deferred = () => { let resolve,reject; const promise = new Promise((a,b) => {resolve=a;reject=b;}); return {promise,resolve,reject}; };
function setup(send) {
 let dishes=[{id:'a',rating:2,version:'v1'},{id:'b',rating:3,version:'b1'}]; const errors=[]; let updates=0;
 const saver=new RatingSaver({getDish:id=>dishes.find(d=>d.id===id),send,accept:result=>{dishes=result.dishes;},onUpdate:()=>updates++,onError:error=>errors.push(error.message)});
 return {saver,errors,get dish(){return dishes[0]},get updates(){return updates}};
}
test('点击立刻显示新分数，连续点击只保存最后一次选择',async()=>{
 const sent=[];const gate=deferred();const state=setup((...args)=>{sent.push(args);return gate.promise});
 state.saver.set('a',3.5);state.saver.set('a',4.5);
 assert.equal(state.saver.score(state.dish),4.5);assert.equal(state.dish.rating,2);assert.equal(state.updates,2);
 const done=state.saver.flush();assert.deepEqual(sent,[['a',4.5,'v1']]);
 gate.resolve({dishes:[{id:'a',rating:4.5,version:'v2'}]});await done;
 assert.equal(state.saver.pending,false);assert.equal(state.dish.rating,4.5);
});
test('保存中再次改分使用新版本，其他菜品的待保存分数不被响应覆盖',async()=>{
 const first=deferred();const sent=[];let state;
 state=setup((id,rating,version)=>{sent.push([id,rating,version]);return sent.length===1 ? first.promise : Promise.resolve({dishes:[{id:'a',rating:id==='a'?rating:4,version:'v3'},{id:'b',rating:id==='b'?5:3,version:id==='b'?'b2':'b1'}]});});
 state.saver.set('a',3);const done=state.saver.flush();state.saver.set('a',4);state.saver.set('b',5);
 first.resolve({dishes:[{id:'a',rating:3,version:'v2'},{id:'b',rating:3,version:'b1'}]});await done;
 assert.deepEqual(sent,[['a',3,'v1'],['a',4,'v2'],['b',5,'b1']]);assert.equal(state.saver.pending,false);
});
test('保存失败恢复确认过的分数，并通知失败',async()=>{
 const state=setup(async()=>{throw new Error('保存失败')});state.saver.set('a',5);await state.saver.flush();
 assert.equal(state.saver.score(state.dish),2);assert.equal(state.saver.pending,false);assert.deepEqual(state.errors,['保存失败']);
});
