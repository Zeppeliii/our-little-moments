import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source = await readFile(new URL('./menu.js',import.meta.url),'utf8');
function setup() {
  const elements = new Map();
  const element = key => { if(!elements.has(key)) elements.set(key,{}); return elements.get(key); };
  const control = {dataset:{}};
  let resolveRead;
  const context = vm.createContext({
    $:element,document:{querySelectorAll:()=>[control]},updateCartbar(){},status(){},render(){},writeSnapshot(){},
    request:body=>body ? Promise.resolve({dishes:[{id:'新菜'}],orders:[]}) : new Promise(resolve=>{resolveRead=resolve;}),
    ratings:{pending:false,flush:async()=>{}},
  });
  vm.runInContext(`let ready=true,reading=false,busy=false,photoBusy=false,lastRead=0,menuRevision=0,data={dishes:[],orders:[]}; const cart=new Map();`,context);
  vm.runInContext(source.slice(source.indexOf('function setBusy('),source.indexOf('function updateCartbar(')),context);
  vm.runInContext(source.slice(source.indexOf('async function readMenu('),source.indexOf('const ratings =')),context);
  return {context,control,resolveRead:()=>resolveRead({dishes:[],orders:[]})};
}
test('菜单有快照时，后台读取不会禁用评分或阻止保存',async()=>{
  const state=setup(); const reading=vm.runInContext('readMenu(true)',state.context);
  assert.equal(state.control.disabled,false);
  await vm.runInContext("change('place-order',{})",state.context);
  state.resolveRead(); await reading;
  assert.equal(vm.runInContext('data.dishes[0].id',state.context),'新菜');
});
test('后台读响应在评分仍待保存时不会覆盖当前菜单',async()=>{
  const state=setup(); const reading=vm.runInContext('readMenu(true)',state.context);
  vm.runInContext("ratings.pending=true;data={dishes:[{id:'当前菜'}],orders:[]}",state.context);
  state.resolveRead(); await reading;
  assert.equal(vm.runInContext('data.dishes[0].id',state.context),'当前菜');
});
