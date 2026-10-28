import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=(await readFile(new URL('./app.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'');
function setup({failSave=false} = {}) {
 const elements=new Map();
 const element=selector=>{if(!elements.has(selector)) elements.set(selector,{value:'',dataset:{},classList:{add(){},remove(){}},listeners:{},addEventListener(event,fn){this.listeners[event]=fn;},reset(){},showModal(){this.open=true;},close(){this.open=false;}});return elements.get(selector);};
 let resolveRead;
 class CloudStore {read(){return new Promise(resolve=>{resolveRead=resolve;});} async publish(memory){if(failSave) throw new Error('模拟上传超时'); return {version:1,memories:[{...memory,version:'模拟版本'}]};}}
 const context=vm.createContext({CloudStore,readSnapshot:()=>null,writeSnapshot(){},previewPhoto:value=>value,restoreOriginalPhoto(){},validateManifest:value=>value,enter(){},revealCards(){},document:{addEventListener(){},querySelector:element,querySelectorAll:()=>[],hidden:false},window:{addEventListener(){}},setInterval(){},setTimeout(){},clearTimeout(){},console,crypto:{randomUUID:()=> '11111111-1111-4111-8111-111111111111'}});
 vm.runInContext(source,context);
 return {context,element,resolveRead:()=>resolveRead({version:1,memories:[]})};
}
test('共享读取尚未完成时可立即填写新回忆',()=>{
 const {element}=setup();element('#top-add').listeners.click();assert.equal(element('#editor').open,true);
});
test('已有数据正在后台刷新时仍可打开编辑，保存保留版本检查',()=>{
 const {context,element}=setup();vm.runInContext("ready=true;reading=true;memories=[{id:'已有回忆',title:'回忆',date:'2026-10-23',category:'日常',body:'',place:'',photos:[],version:'原版本'}];openEditor('已有回忆');",context);
 assert.equal(element('#editor').open,true);assert.equal(vm.runInContext('editingVersion',context),'原版本');
});
test('先保存的新回忆不会被更早发出的读取请求覆盖',async()=>{
 const {context,element,resolveRead}=setup();element('#top-add').listeners.click();element('#event-title').value='新回忆';element('#event-category').value='日常';
 await element('#memory-form').listeners.submit({preventDefault(){}});resolveRead();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(vm.runInContext('ready',context),true);assert.equal(vm.runInContext('memories.length',context),1);assert.equal(vm.runInContext('memories[0].title',context),'新回忆');
});

test('保存失败保留文字照片与回忆编号，重试不会创建另一条记录',async()=>{
 const {context,element}=setup({failSave:true});element('#top-add').listeners.click();element('#event-title').value='保留的回忆';element('#event-category').value='日常';
 vm.runInContext("selectedPhotos=['照片数据']",context);
 await element('#memory-form').listeners.submit({preventDefault(){}});const id=vm.runInContext('editingId',context);
 assert.equal(element('#editor').open,true);assert.equal(element('#event-title').value,'保留的回忆');assert.equal(element('#save-status').textContent,'模拟上传超时');assert.equal(element('#save-button').disabled,false);assert.equal(vm.runInContext('selectedPhotos.length',context),1);
 await element('#memory-form').listeners.submit({preventDefault(){}});assert.equal(vm.runInContext('editingId',context),id);
});
