import test from 'node:test';
import assert from 'node:assert/strict';
import {uploadRequest} from './upload-request.js';
function mockXHR() {return {upload:{},open(method,url){this.method=method;this.url=url;},headers:{},setRequestHeader(key,value){this.headers[key]=value;},send(body){this.body=body;},abort(){this.onabort();}};}
test('照片上传进度与后台保存分别展示，请求不携带令牌',async()=>{
 const xhr=mockXHR(),progress=[];
 const pending=uploadRequest('https://example.com/memories',{method:'POST',body:'{}',onProgress:p=>progress.push(p)},()=>xhr);
 xhr.upload.onprogress({lengthComputable:true,loaded:5,total:10});xhr.upload.onload();xhr.status=200;xhr.responseText='{"version":1,"memories":[]}';xhr.onload();
 const response=await pending;assert.equal(response.ok,true);assert.equal((await response.json()).version,1);
 assert.deepEqual(progress,[{phase:'upload',percent:0},{phase:'upload',percent:50},{phase:'saving'}]);assert.equal(xhr.timeout,90000);assert.deepEqual(xhr.headers,{'Content-Type':'application/json'});
});
test('照片上传超时会解除等待并说明确认保存结果',async()=>{
 const xhr=mockXHR();const pending=uploadRequest('https://example.com',{method:'POST',body:'{}'},()=>xhr);xhr.ontimeout();
 await assert.rejects(pending,/超过 90 秒.*确认结果/);
});
test('网络中断和冲突响应可明确返回给界面',async()=>{
 const xhr=mockXHR();const pending=uploadRequest('https://example.com',{method:'POST',body:'{}'},()=>xhr);xhr.onerror();await assert.rejects(pending,/连接中断/);
 const conflict=mockXHR();const result=uploadRequest('https://example.com',{method:'POST',body:'{}'},()=>conflict);conflict.status=409;conflict.responseText='{"error":"冲突"}';conflict.onload();const response=await result;assert.equal(response.ok,false);assert.equal(response.status,409);
});
