# 我们的小事

经典 Hello Kitty 风格的共享恋爱手账：第一次、心动回忆、日常、纪念日。

正式网站：https://zeppeliii.github.io/our-little-moments/

## 两个人一起看

网站从公开 GitHub 仓库 `Zeppeliii/our-little-moments` 读取同一份 `memories.json`。照片保存为仓库中的 `data/photos/<回忆编号>/<照片编号>.jpg`。查看无需登录；保存成功后，另一边打开网站或点击「刷新回忆」即可看到。页面可见且没有正在编辑的内容时，每分钟自动刷新，也会在返回页面时更新。

文字和照片均为公开内容，其他人也可能查看或下载。移除记录会从当前网站和当前分支移除，对应内容仍可能保留在 GitHub 历史版本中。

## 新增与修改

1. 点击「连接 GitHub」，打开 GitHub 创建细粒度授权令牌。
2. Repository access 选择 Only select repositories，只选择 `our-little-moments`。
3. Repository permissions 中的 Contents 设为 Read and write。设置合理有效期，由仓库所有者或已有写入权限的账号创建。
4. 把令牌粘贴到网站的连接窗口即可。不要放进代码、提交信息或聊天里。
5. 选择系列，添加日期、故事、地点和照片，点击保存。

授权令牌只保存在当前页面的内存里，不写入浏览器存储、仓库或回忆数据。关闭或刷新页面后需要重新连接。读取公开记录时不发送令牌。

每条回忆最多 12 张照片，单张原图最多 30 MB。照片自动缩小到最长边 1800 像素、转为 JPEG；GIF 保存为静态图片。图片文件与回忆数据通过同一个 Git 提交发布，全部完成后才提示成功。保存失败会保留编辑内容。

两边同时添加不同回忆时会合并重试；同一条回忆已被另一边修改时，会拒绝覆盖并提示刷新，防止丢失修改。公开文件的刷新可能受 GitHub 网络和缓存影响。

## 旧记录

旧版浏览器里的记录不会删除。如检测到尚未发布的本机记录，会显示「发布本机回忆」；连接 GitHub 后点击即可公开到共享手账。此功能只读取当前网址下的旧浏览器记录，本机 `localhost` 和线上网站的数据相互独立。

旧分类「约会」「旅行」归为「日常」，「小事」归为「心动回忆」，「纪念日」保持不变。

## 开发与部署

运行 `python3 -m http.server 8000`，打开 `http://localhost:8000`。本机预览也读取并写入同一个公开 GitHub 仓库，测试请使用模拟测试，不要向真实手账发布虚构回忆。

运行 `node --test shared-store.test.mjs` 验证共享存储、并发冲突与错误处理。网站无需构建，GitHub Pages 从 `main` 分支根目录发布。

- `index.html`、`style.css`：页面与样式。
- `app.js`：回忆展示、编辑、照片处理、连接窗口与旧记录发布。
- `shared-store.js`：GitHub 共享读取、图片发布与并发保护。
- `memories.json`：所有共享回忆的数据，后续更新代码时不要用空文件覆盖。
- `hello-kitty.png`：来自[三丽鸥官方角色页](https://www.sanrio.co.jp/characters/hellokitty/)的角色图；原图为 `https://www.sanrio.co.jp/wp-content/uploads/2022/06/mv-hellokitty.png`，权利归原权利人所有。

使用系统字体和本地角色图片；共享读写需要连接 GitHub。
