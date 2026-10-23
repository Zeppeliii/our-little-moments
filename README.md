# 我们的小事

经典 Hello Kitty 风格的共享恋爱手账，包含第一次、心动回忆、日常、纪念日。

正式网站：https://zeppeliii.github.io/our-little-moments/

## 日常使用

直接在网站新增、修改、删除回忆和上传照片，无需登录或填写令牌。保存成功后，另一边打开网站或点击「刷新回忆」即可看到。页面可见且未编辑时，每分钟自动刷新，也会在返回页面时更新。

每条回忆最多 12 张照片，单张原图最多 30 MB。照片缩小到最长边 1800 像素并转为 JPEG；GIF 保存为静态图片。单次请求最多 16 MiB，超过时需要减少照片数量。保存失败会保留编辑内容；网络超时后请先刷新确认是否已保存，再重试。

不同回忆同时修改时会合并；同一条回忆已被另一边修改时会提示刷新，防止覆盖。旧浏览器记录可用「发布本机回忆」迁移，不会删除本机原数据。旧分类「约会」「旅行」归为「日常」，「小事」归为「心动回忆」。

## 存储方式

GitHub Pages 托管页面，Cloudflare Worker 接收保存请求，GitHub 仓库保存 `memories.json` 和 `data/photos/` 下的照片。照片和文字通过同一次 Git 提交发布。

本方案按用户选择开放操作，没有网站身份认证。知道服务地址的人也可能修改记录；来源检查仅用于浏览器跨域控制，不是身份认证。文字和照片公开，删除后的内容仍可能保留在 GitHub 历史中。

## 后台一次性配置

1. 部署 `worker.js`，可使用 `wrangler.jsonc`，或运行 `node build-worker.mjs` 后将生成的 `worker-bundle.js` 粘贴到 Cloudflare 编辑器部署。
2. 由仓库所有者在 GitHub 创建细粒度令牌，仅选择 `our-little-moments`，授予 Contents 读写权限并设置有效期。
3. 在 Worker 设置的变量与机密中添加 Secret `GITHUB_TOKEN`。令牌只放后台，不提交到仓库、浏览器或聊天。
4. `ALLOWED_ORIGIN` 默认是 `https://zeppeliii.github.io`；将实际 Worker 地址填入 `site-config.js`。
5. 检查 `/health` 的 `configured` 为 `true`，再发布前端。令牌过期时只需更新后台 Secret。

网站代码更新时不要用空白 `memories.json` 覆盖已保存的回忆。

## 开发与验证

运行 `python3 -m http.server 8000` 预览。正式后台只接受正式网站来源；本机调试使用模拟存储，不向真实手账发布虚构记录。

运行 `node --test shared-store.test.mjs worker.test.mjs` 验证原子保存、冲突处理、输入验证、跨域与前端请求。运行 `node build-worker.mjs` 生成单文件后台部署包。

- `app.js`、`index.html`、`style.css`：展示、编辑与照片处理。
- `shared-store.js`、`site-config.js`：前端请求和公开后台地址。
- `worker.js`、`github-store.js`、`memory-model.js`：后台路由、GitHub 保存和格式校验。
- `memories.json`：共享回忆数据。
- `hello-kitty.png`：来自[三丽鸥官方角色页](https://www.sanrio.co.jp/characters/hellokitty/)的图片，权利归原权利人所有。
