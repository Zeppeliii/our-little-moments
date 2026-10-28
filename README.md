# 我们的小事

经典 Hello Kitty 风格的共享恋爱手账，包含第一次、心动回忆、日常、纪念日。

正式网站：https://zeppeliii.github.io/our-little-moments/

## 日常使用

直接在网站新增、修改、删除回忆和上传照片，无需登录或填写令牌。保存成功后，另一边打开网站或点击「刷新回忆」即可看到。页面可见且未编辑时，每分钟自动刷新，也会在返回页面时更新。

每条回忆最多 12 张照片，单张原图最多 30 MB。照片缩小到最长边 1600 像素并转为 JPEG；GIF 保存为静态图片。单次请求最多 5 MiB，超过时需要减少照片数量。上传时显示百分比，上传完成后显示后台保存状态；超过 90 秒会明确提示。保存失败会保留编辑内容；网络超时后请先刷新确认是否已保存，再重试。

不同回忆同时修改时会合并；同一条回忆已被另一边修改时会提示刷新，防止覆盖。旧浏览器记录可用「发布本机回忆」迁移，不会删除本机原数据。旧分类「约会」「旅行」归为「日常」，「小事」归为「心动回忆」。

评分点击后立即亮星，连续改分合并为最后一次选择，再在后台保存；保存失败会恢复并提示。回忆和菜单再次打开时先显示本机快照，再同步最新内容，后台刷新不会锁住已有菜单。照片列表通过 Netlify Image CDN 读取缩略图，失败回退原图；相册保留原图，并在非省流模式预加载相邻照片。多张新照片并行上传，仍在同一次提交中保存。

## 存储方式

GitHub Pages 托管页面，Netlify Functions 接收保存请求，GitHub 仓库保存 `memories.json` 和 `data/photos/` 下的照片。照片和文字通过同一次 Git 提交发布。

本方案按用户选择开放操作，没有网站身份认证。知道服务地址的人也可能修改记录；来源检查仅用于浏览器跨域控制，不是身份认证。文字和照片公开，删除后的内容仍可能保留在 GitHub 历史中。

## 后台一次性配置

1. 在 Netlify 创建项目，发布目录设为 `netlify-public`，函数目录设为 `netlify/functions`，使用 `netlify.toml`。本机可运行 `npx netlify-cli deploy --prod --dir netlify-public --functions netlify/functions --no-build` 部署。
2. 由仓库所有者在 GitHub 创建细粒度令牌，仅选择 `our-little-moments`，授予 Contents 读写权限并设置有效期。
3. 在 Netlify 的 Environment variables 添加 `GITHUB_TOKEN`，勾选 Contains secret values，仅填写 Production。令牌只放后台，不提交到仓库、浏览器源码或聊天。
4. 重新部署使环境变量生效。`ALLOWED_ORIGIN` 默认是 `https://zeppeliii.github.io`；实际后台地址填入 `site-config.js`。
5. 将 Production 访问设为公开，检查 `/health` 的 `configured` 为 `true`，确认手机可达，再发布前端。令牌过期时更新后台机密并重新部署。

`worker.js` 的路由和存储逻辑由 Netlify 函数复用；也可通过 `wrangler.jsonc` 部署到 Cloudflare。
网站代码更新时不要用空白 `memories.json` 覆盖已保存的回忆。

## 开发与验证

运行 `python3 -m http.server 8000` 预览。正式后台只接受正式网站来源；本机调试使用模拟存储，不向真实手账发布虚构记录。

运行 `node --test shared-store.test.mjs worker.test.mjs app-loading.test.mjs upload-request.test.mjs menu-rating.test.mjs menu-store.test.mjs menu-loading.test.mjs delivery.test.mjs` 验证原子保存、冲突处理、评分队列、缓存、缩略图回退、跨域与前端请求。运行 `node build-worker.mjs` 生成单文件后台部署包。

- `app.js`、`index.html`、`style.css`：展示、编辑与照片处理。
- `shared-store.js`、`site-config.js`：前端请求和公开后台地址。
- `worker.js`、`github-store.js`、`memory-model.js`：后台路由、GitHub 保存和格式校验。
- `memories.json`：共享回忆数据。
- `hello-kitty.png`：来自[三丽鸥官方角色页](https://www.sanrio.co.jp/characters/hellokitty/)的图片，权利归原权利人所有。
