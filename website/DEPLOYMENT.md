# goagent.top Cloudflare Pages 部署说明

goagent 官网使用 Cloudflare Pages 部署，部署目录为 `website/`。官网只提供静态页面，不依赖 VPS、数据库或服务端 API。

## 1. Cloudflare 和域名

1. 在 Cloudflare 添加 `goagent.top` 站点。
2. 在 Spaceship 把 `goagent.top` 的 nameservers 改成 Cloudflare 分配的 nameservers。
3. DNS 传播可能最长 48 小时。传播期间 `goagent.top`、`www.goagent.top` 可能出现间歇性不可访问。
4. 不要在文档或代码中写死 Cloudflare 分配的 nameserver 名称，以 Cloudflare 控制台显示为准。

## 2. Cloudflare Pages 项目

在 Cloudflare Pages 创建项目：

- 连接 GitHub 仓库：`wimi321/GoAgent`
- Root directory: `website`
- Build command: `pnpm build`
- Output directory: `dist`
- Framework preset: Astro

`website/` 是独立 Astro 静态站，生成纯静态 HTML/CSS/少量 JS，不使用服务端渲染。

## 3. Custom domains

在 Pages 项目的 Custom domains 中添加：

- `goagent.top`
- `www.goagent.top`

建议 apex 作为主域名：`goagent.top`。

项目内已经提供 `_redirects`：

```text
https://www.goagent.top/* https://goagent.top/:splat 301
```

如果 Cloudflare Pages 控制台中另行配置了 www 跳转，也可以保留该文件作为静态部署兜底。

## 4. 下载文件策略

不要把安装包放入 Cloudflare Pages：

- Pages 适合静态官网，不适合作为大型安装包仓库。
- Pages 单文件大小有限，不适合托管 `.exe`、`.dmg`、`.zip`。
- 官网下载按钮链接 GitHub Releases：
  `https://github.com/wimi321/GoAgent/releases`

未来可以用 VPS 或对象存储做：

- `api.goagent.top`
- `download.goagent.top`
- release mirror

但 VPS 不参与官网主站。

## 5. 本地构建和检查

从仓库根目录执行：

```bash
pnpm install
pnpm website:build
pnpm check:website
```

也可以在 `website/` 内执行：

```bash
cd website
pnpm install
pnpm build
```

构建输出目录为：

```text
website/dist
```

## 6. 部署后验收

发布后检查：

```bash
curl -I https://goagent.top/
curl -I https://www.goagent.top/
curl https://goagent.top/ | grep -i goagent
```

期望：

- `https://goagent.top/` 返回 200。
- `https://www.goagent.top/` 跳转到 `https://goagent.top/` 或正常展示同一站点。
- 页面中包含 `goagent`、GitHub Releases 链接和隐私说明入口。
