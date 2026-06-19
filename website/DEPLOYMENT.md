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

Cloudflare Pages 绑定成功后，不要保留指向 `198.18.*`、内网 IP、VPS 占位地址或其它临时 origin 的 A 记录。`198.18.0.0/15` 是基准测试专用地址段，公网用户访问会超时。Pages custom domain 应由 Cloudflare 自动创建并管理对应的 CNAME/路由记录。

项目内已经提供 `_redirects`：

```text
https://www.goagent.top/* https://goagent.top/:splat 301
```

如果 Cloudflare Pages 控制台中另行配置了 www 跳转，也可以保留该文件作为静态部署兜底。

## 4. 下载文件策略

不要把安装包放入 Cloudflare Pages：

- Pages 适合静态官网，不适合作为大型安装包仓库。
- Pages 单文件大小有限，不适合托管 `.exe`、`.dmg`、`.zip`。
- 官网首推下载按钮链接 LizzieYzy Next GitHub Releases：
  `https://github.com/wimi321/lizzieyzy-next/releases`
- GoAgent 作为实验围棋智能体，下载入口链接：
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

## 6. GitHub Actions 自动部署

仓库提供 `.github/workflows/deploy-website.yml`。当 `main` 分支里的 `website/**`、`scripts/check_website.mjs` 或部署 workflow 变化时，GitHub Actions 会：

1. 安装网站依赖。
2. 构建 Astro 静态站。
3. 执行 `pnpm check:website`。
4. 使用 Cloudflare Wrangler Direct Upload 部署到 Pages 项目 `goagent`。

Cloudflare Pages 项目当前是 Direct Upload 项目，不依赖 Pages 控制台的 Git 绑定。自动部署需要 GitHub 仓库 secrets：

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

`CLOUDFLARE_API_TOKEN` 建议使用 Cloudflare 用户 API Token，权限覆盖 Account / Cloudflare Pages 编辑能力，并限定到当前 account。没有 token 时 workflow 会完成构建和检查，并以 warning 提示跳过 Cloudflare 部署，不会把主分支标红。

可以用 GitHub CLI 设置：

```bash
gh secret set CLOUDFLARE_ACCOUNT_ID --repo wimi321/GoAgent
gh secret set CLOUDFLARE_API_TOKEN --repo wimi321/GoAgent
```

本地兜底部署命令：

```bash
pnpm website:build
pnpm check:website
npx wrangler pages deploy website/dist --project-name=goagent --branch=main
```

## 7. SEO 和 AI 可读性

站点提供：

- `sitemap.xml`，列出首页、下载页、多语言页面和中文专题页。
- `robots.txt`，声明站点可抓取并指向 sitemap。
- `llms.txt` 和 `llms-full.txt`，给 AI 检索和摘要工具提供产品定位、重要链接和推荐表述。
- `ai.txt`，提供机器可读的产品摘要和关键链接。
- 页面内 JSON-LD，覆盖 SoftwareApplication、FAQPage、TechArticle 和 BreadcrumbList。

新增 SEO 专题页：

- `/katago-review`：KataGo 围棋复盘软件推荐。
- `/fox-go-review`：野狐棋谱复盘流程。
- `/ai-go-review`：围棋 AI 复盘怎么看。
- `/compare`：LizzieYzy Next 与 GoAgent 怎么选。

## 8. 部署后验收

发布后检查：

```bash
curl -I https://goagent.top/
curl -I https://www.goagent.top/
curl https://goagent.top/ | grep -i goagent
curl https://goagent.top/sitemap.xml | grep -i goagent.top
```

期望：

- `https://goagent.top/` 返回 200。
- `https://www.goagent.top/` 跳转到 `https://goagent.top/` 或正常展示同一站点。
- 页面中包含 `LizzieYzy Next`、`GoAgent`、GitHub Releases 链接和隐私说明入口。

如果 `dig goagent.top A` 返回 `198.18.*`，请先删除 Cloudflare DNS 中的占位 A 记录，再回到 Pages 项目的 Custom domains 重新激活 `goagent.top`。如果 `www.goagent.top` 返回 Cloudflare `530`，通常表示 DNS 到了 Cloudflare，但没有指向有效 Pages 部署或 custom domain 还未激活。
