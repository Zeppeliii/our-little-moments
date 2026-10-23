import {createHandler} from '../../worker.js';

// 复用现有保存逻辑，GitHub 凭据只从托管平台的后台环境变量读取。
const handle = createHandler();
export default request => handle(request,{
  GITHUB_TOKEN:process.env.GITHUB_TOKEN,
  ALLOWED_ORIGIN:process.env.ALLOWED_ORIGIN || 'https://zeppeliii.github.io'
});
export const config = {path:['/memories','/memories/*','/health']};
