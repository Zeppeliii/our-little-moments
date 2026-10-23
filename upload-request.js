import {StoreError} from './memory-model.js';

export function uploadRequest(url,{method,body,onProgress},createXHR = () => new XMLHttpRequest()) {
  return new Promise((resolve,reject) => {
    const xhr = createXHR();
    const timeoutError = () => new StoreError('上传或保存超过 90 秒，请保留内容并先刷新回忆确认结果，再重试；可以减少照片后再保存');
    let timer;
    const finish = (error,response) => { clearTimeout(timer); error ? reject(error) : resolve(response); };
    xhr.open(method,url);
    xhr.timeout = 90000;
    xhr.setRequestHeader('Content-Type','application/json');
    xhr.upload.onprogress = event => {
      if(event.lengthComputable) onProgress?.({phase:'upload',percent:Math.round(event.loaded/event.total*100)});
    };
    xhr.upload.onload = () => onProgress?.({phase:'saving'});
    xhr.onerror = () => finish(new StoreError('上传连接中断，请保留内容，检查网络后重试'));
    xhr.ontimeout = () => finish(timeoutError());
    xhr.onabort = () => finish(timeoutError());
    xhr.onload = () => finish(null,{ok:xhr.status>=200 && xhr.status<300,status:xhr.status,json:async()=>JSON.parse(xhr.responseText)});
    timer = setTimeout(() => { finish(timeoutError()); xhr.abort(); },90000);
    onProgress?.({phase:'upload',percent:0});
    try { xhr.send(body); } catch { finish(new StoreError('无法开始上传，请保留内容，检查网络后重试')); }
  });
}
