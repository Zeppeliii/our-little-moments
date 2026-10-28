import test from 'node:test';
import assert from 'node:assert/strict';
import {previewPhoto,restoreOriginalPhoto} from './photo-delivery.js';
import {readSnapshot,writeSnapshot} from './site-cache.js';
test('列表使用缩略图，非共享图片不送往图片服务，失败只回退一次原图',()=>{
 const original='https://raw.githubusercontent.com/Zeppeliii/our-little-moments/main/data/photos/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222.jpg';
 const url=new URL(previewPhoto(original));assert.equal(url.searchParams.get('url'),original);assert.equal(url.searchParams.get('w'),'640');
 for(const value of ['data:image/jpeg;base64,abc','https://example.org/a.jpg','menu-art/noodles.svg'])assert.equal(previewPhoto(value),value);
 const image={tagName:'IMG',dataset:{original},src:'失败的缩略图'};restoreOriginalPhoto({target:image});assert.equal(image.src,original);assert.equal(image.dataset.original,undefined);restoreOriginalPhoto({target:image});assert.equal(image.src,original);
});
test('展示快照可以立即恢复，过期、损坏、存储禁用均不阻止联网',()=>{
 const entries=new Map(),storage={getItem:key=>entries.get(key),setItem:(key,value)=>entries.set(key,value)};
 const validate=data=>{assert.equal(data.version,1);return data};writeSnapshot('a',{version:1},storage);assert.deepEqual(readSnapshot('a',validate,storage),{version:1});
 entries.set('a','损坏');assert.equal(readSnapshot('a',validate,storage),null);
 entries.set('a',JSON.stringify({time:0,data:{version:1}}));assert.equal(readSnapshot('a',validate,storage),null);
 assert.doesNotThrow(()=>writeSnapshot('a',{}, {setItem(){throw Error()}}));
});
