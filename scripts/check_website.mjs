#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = process.cwd()
const websiteRoot = join(root, 'website')
const failures = []

function fail(message) {
  failures.push(message)
}

function requireFile(relativePath) {
  const path = join(root, relativePath)
  if (!existsSync(path)) fail(`missing ${relativePath}`)
  return path
}

function read(relativePath) {
  const path = requireFile(relativePath)
  return existsSync(path) ? readFileSync(path, 'utf8') : ''
}

function walk(dir) {
  if (!existsSync(dir)) return []
  const entries = []
  for (const name of readdirSync(dir)) {
    if (['node_modules', '.astro', 'dist', '.git'].includes(name)) continue
    const path = join(dir, name)
    const stat = statSync(path)
    if (stat.isDirectory()) entries.push(...walk(path))
    else entries.push(path)
  }
  return entries
}

requireFile('website/package.json')
requireFile('website/src/pages/index.astro')
requireFile('website/src/pages/download.astro')
requireFile('website/src/pages/privacy.astro')
requireFile('website/src/pages/katago-review.astro')
requireFile('website/src/pages/fox-go-review.astro')
requireFile('website/src/pages/ai-go-review.astro')
requireFile('website/src/pages/compare.astro')
requireFile('website/src/pages/[locale].astro')
requireFile('website/src/pages/[locale]/[page].astro')
requireFile('website/src/components/DownloadChooser.astro')
requireFile('website/DEPLOYMENT.md')
requireFile('.github/workflows/deploy-website.yml')
requireFile('website/public/sitemap.xml')
requireFile('website/public/site.webmanifest')
requireFile('website/public/llms.txt')
requireFile('website/public/llms-full.txt')
requireFile('website/public/ai.txt')
requireFile('website/public/_worker.js')

const index = read('website/src/pages/index.astro')
const home = read('website/src/components/HomePage.astro')
const homeCopy = read('website/src/data/home-copy.mjs')
const downloadPage = read('website/src/pages/download.astro')
const docsPage = read('website/src/pages/docs.astro')
const faqPage = read('website/src/pages/faq.astro')
const changelogPage = read('website/src/pages/changelog.astro')
const pagesCopy = read('website/src/data/pages-copy.mjs')
const localizedHome = read('website/src/pages/[locale].astro')
const localizedPages = read('website/src/pages/[locale]/[page].astro')
const downloadChooser = read('website/src/components/DownloadChooser.astro')
const downloadImplementation = downloadChooser + read('website/src/lib/download-catalog.mjs') + read('website/src/lib/download-ui.mjs')
const layout = read('website/src/layouts/BaseLayout.astro')
const privacy = read('website/src/pages/privacy.astro')
const deployment = read('website/DEPLOYMENT.md')
const workflow = read('.github/workflows/deploy-website.yml')
const sitemap = read('website/public/sitemap.xml')
const manifest = read('website/public/site.webmanifest')
const llms = read('website/public/llms.txt')
const llmsFull = read('website/public/llms-full.txt')
const ai = read('website/public/ai.txt')
const edgeWorker = read('website/public/_worker.js')
const chooserCopy = ['不会选', '也没关系'].join('')

if (!index.includes('<HomePage lang="zh-CN"')) fail('homepage must use the shared localized design')
for (const keyword of ['LizzieYzy Next', '下过的每一盘', '免费开源', 'AI 解说需自行连接服务']) {
  if (!homeCopy.includes(keyword)) fail(`homepage must include user-facing guidance: ${keyword}`)
}
for (const keyword of ['class="hero', 'GoBoard', 'showcase', 'lizzie-earred-127.webp', 'bento', 'step-list', 'DownloadChooser', 'compact', 'closing']) {
  if (!home.includes(keyword)) fail(`homepage must retain the selected design and real product image: ${keyword}`)
}
for (const image of ['lizzie-earred-127.webp', 'lizzie-curve-problems.webp', 'lizzie-candidates.webp', 'og-lizzieyzy-next.jpg', 'lizzieyzy-next-icon.png']) {
  requireFile(`website/public/images/${image}`)
}
// Product pictures must be real screenshots of the application, never generated mock-ups.
for (const path of walk(join(websiteRoot, 'src'))) {
  const body = readFileSync(path, 'utf8')
  for (const mockup of ['workbench.jpg', 'go-tools-hero', 'home-hero-board']) {
    if (body.includes(mockup)) fail(`${relative(root, path)} must not use the generated mock-up image ${mockup}`)
  }
}
for (const keyword of ['featuresTitle', 'features:']) {
  if (!homeCopy.includes(keyword)) fail(`homepage copy must include the feature grid: ${keyword}`)
}
for (const name of ['site.css', 'home.css', 'download.css']) {
  const css = read(`website/src/styles/${name}`)
  if (/width:\s*100vw|50vw\)/.test(css)) fail(`${name}: full-bleed bands must not use 100vw; it overflows next to classic Windows scrollbars`)
}
if (!read('website/src/components/SiteIcon.astro').includes('?raw')) fail('SiteIcon must inline SVG so icons follow currentColor')
if (index.includes(chooserCopy)) fail('homepage hero must not use unnecessary chooser copy')
if (index.includes('打不开再用')) fail('homepage should use priority/backup wording instead of troubleshooting-first wording')
if (!layout.includes('https://github.com/wimi321/GoAgent/releases')) fail('footer must retain the experimental project link')
if (!layout.includes('QQ 1030632742')) fail('site layout must expose QQ community')
if (index.includes('Trust')) fail('homepage should not include Trust section')
if (!downloadPage.includes('<DownloadChooser lang="zh-CN" />')) fail('download page must render the unified download chooser')
if (!downloadPage.includes('canonical="https://goagent.top/download/"')) fail('download page must use the trailing-slash canonical URL')
for (const keyword of [
  'download.goagent.top/channels/stable/catalog.json',
  "new Set(['download.goagent.top', 'github.com'])",
  'https://github.com/wimi321/lizzieyzy-next/releases',
  'catalogFetchAttempts = 3',
  'fetchCatalogWithRetry',
  'NVIDIA CUDA',
  'RTX 20 / 30 / 40 / 50',
  'AMD RX 9000',
  'amd-rocm-experimental',
  'rocm-gfx120x',
  'RX 6000 / RX 7000 / Ryzen AI Max',
  'data-amd-release-link',
  'safeGithubReleaseUrl',
  'TensorRT 可选版',
  'tensorrt-optional',
  'RTX 30 / 40 / 50 优先使用 CUDA，通常更快',
  'TensorRT 仅为 RTX 20 / GTX 16 提速',
  '/\\.7z\\.(001|002)$/',
  'usable.length !== requiredAssets',
  'CPU 通用版',
  'Apple 芯片',
  'Intel 芯片',
  '下载小更新',
]) {
  if (!downloadImplementation.includes(keyword)) fail(`download chooser must contain: ${keyword}`)
}
const nvidiaRow = downloadChooser.indexOf("['nvidia', 'windows-portable', 'nvidia'")
const amdRow = downloadChooser.indexOf("['amd', 'amd-rocm-experimental', 'rocm-gfx120x', 'x64'")
const openclRow = downloadChooser.indexOf("['opencl', 'windows-portable', 'opencl'")
if (!(nvidiaRow >= 0 && amdRow > nvidiaRow && openclRow > amdRow)) {
  fail('download chooser must place AMD RX 9000 between NVIDIA CUDA and OpenCL')
}
for (const keyword of ['ROCm 實驗版', 'Experimental ROCm', 'ROCm 実験版', 'ROCm 실험판', 'ROCm รุ่นทดลอง', 'ROCm thử nghiệm']) {
  if (!downloadChooser.includes(keyword)) fail(`download chooser must localize AMD RX 9000: ${keyword}`)
}
if (downloadChooser.includes('tensorrt-advanced')) fail('download chooser must use the stable TensorRT catalog category')
if (downloadChooser.includes('RTX 30 系及以下可选')) fail('TensorRT recommendation must not target RTX 30')
for (const keyword of [
  'TensorRT 僅供 RTX 20 / GTX 16 加速',
  'TensorRT is for speeding up RTX 20 / GTX 16 only',
  'TensorRT は RTX 20 / GTX 16 の高速化用のみ',
  'TensorRT는 RTX 20 / GTX 16 가속용만',
  'TensorRT ใช้เร่ง RTX 20 / GTX 16 เท่านั้น',
  'TensorRT chỉ để tăng tốc RTX 20 / GTX 16',
]) {
  if (!downloadChooser.includes(keyword)) fail(`download chooser must localize TensorRT guidance: ${keyword}`)
}
for (const keyword of [
  '通常比 CUDA 更快',
  'often faster than CUDA',
  'CUDA より高速な場合あり',
  'CUDA보다 빠른 경우가 많음',
  'มักเร็วกว่า CUDA',
  'thường nhanh hơn CUDA',
]) {
  if (downloadChooser.includes(keyword)) fail(`download chooser must not imply TensorRT is generally faster: ${keyword}`)
}
for (const keyword of ['www.goagent.top', 'goagent.top', 'Response.redirect', 'env.ASSETS.fetch']) {
  if (!edgeWorker.includes(keyword)) fail(`edge worker must contain: ${keyword}`)
}
if (!edgeWorker.includes('301')) fail('edge worker must permanently redirect www to the apex domain')
if (existsSync(join(root, 'website/public/_redirects'))) fail('legacy _redirects must not compete with the edge worker')
for (const keyword of ['Cloudflare R2', 'mirrorUrls', 'SHA256', 'manifest']) {
  if (downloadChooser.includes(keyword)) fail(`download chooser should avoid implementation wording: ${keyword}`)
}
for (const keyword of ['nvidia50.cuda', 'rtx50:', 'CPU build if unsure', '不确定时优先使用 CPU 通用版']) {
  if (downloadChooser.includes(keyword)) fail(`download chooser must not restore the obsolete Windows recommendation: ${keyword}`)
}
for (const [page, file] of [['docs', docsPage], ['faq', faqPage], ['privacy', privacy], ['changelog', changelogPage]]) {
  if (!file.includes(`<ContentPage lang="zh-CN" page="${page}" />`)) fail(`${page} page must use the shared seven-language ContentPage`)
}
for (const keyword of ['不用研究术语', '下载并解压', '官网下载中心', '整盘速览', '问题手']) {
  if (!pagesCopy.includes(keyword)) fail(`guide must contain simple user guidance: ${keyword}`)
}
if (pagesCopy.includes('百度网盘打不开：')) fail('guide should not lead with Baidu troubleshooting wording')
for (const keyword of ['我该下载哪个版本？', '需要另外安装 KataGo 或下载权重吗？', '不用先懂']) {
  if (!pagesCopy.includes(keyword)) fail(`FAQ must answer normal-user questions: ${keyword}`)
}
for (const keyword of ['next-2026-10-17.1', '当前正式版', 'GitHub Releases']) {
  if (!pagesCopy.includes(keyword)) fail(`changelog must summarize the stable release for users: ${keyword}`)
}
for (const keyword of ['HomePage', 'localeSlugs', 'getStaticPaths']) {
  if (!localizedHome.includes(keyword)) fail(`localized homepage must share the same components: ${keyword}`)
}
for (const forbidden of [
  'lizzieBaidu',
  'baiduCta',
  'pan.baidu.com',
  'China download (Baidu)',
  'Tải tại Trung Quốc (Baidu)',
  '百度網盤',
  'Baidu Netdisk'
]) {
  if (localizedHome.includes(forbidden)) fail(`localized homepage must not expose Baidu Netdisk download: ${forbidden}`)
}
if (localizedHome.includes('<figure class="hero-art">')) fail('localized homepage must not render the old hero-art layout')
if (localizedHome.includes('README')) fail('localized homepage should say official recommendation instead of README wording')
for (const keyword of ['DownloadChooser', 'downloadMeta', '<DownloadChooser lang={meta.lang} />']) {
  if (!localizedPages.includes(keyword)) fail(`localized download pages must use the unified chooser: ${keyword}`)
}
for (const keyword of ['本地', 'LLM', 'TTS', '遥测', 'user-data', '诊断包']) {
  if (!pagesCopy.includes(keyword)) fail(`privacy page must contain ${keyword}`)
}
for (const keyword of ['Cloudflare Pages', 'Cloudflare R2', 'download.goagent.top', 'lizzieyzy-next-downloads']) {
  if (!deployment.includes(keyword)) fail(`DEPLOYMENT.md must contain ${keyword}`)
}
for (const keyword of [
  'pnpm dlx wrangler@4.118.0',
  'CLOUDFLARE_API_TOKEN',
  'pages deploy website/dist --project-name=goagent',
]) {
  if (!workflow.includes(keyword)) fail(`deploy-website.yml must contain ${keyword}`)
}
for (const keyword of [
  'https://goagent.top/',
  'https://goagent.top/katago-review',
  'https://goagent.top/fox-go-review',
  'https://goagent.top/ai-go-review',
  'https://goagent.top/compare',
  'https://goagent.top/en',
  'https://goagent.top/zh-hant',
  'https://goagent.top/en/download',
  'https://goagent.top/en/faq',
  'https://goagent.top/ja/download',
  'https://goagent.top/ko/privacy',
  'https://goagent.top/th/docs',
  'https://goagent.top/vi/changelog'
]) {
  if (!sitemap.includes(keyword)) fail(`sitemap.xml must contain ${keyword}`)
}
for (const keyword of ['LizzieYzy Next', 'GoAgent', 'katago-review', 'AI Go review', 'Product comparison', 'https://goagent.top/download']) {
  if (!llms.includes(keyword)) fail(`llms.txt must contain ${keyword}`)
}
for (const keyword of ['Primary recommendation', 'Experimental project', 'Important pages', 'https://goagent.top/compare', 'Official download center']) {
  if (!llmsFull.includes(keyword)) fail(`llms-full.txt must contain ${keyword}`)
}
for (const keyword of ['canonical_product: LizzieYzy Next', 'secondary_product: GoAgent', 'best_links', 'official_download']) {
  if (!ai.includes(keyword)) fail(`ai.txt must contain ${keyword}`)
}
if (!manifest.includes('"name": "LizzieYzy Next"')) fail('site.webmanifest must name LizzieYzy Next')

for (const path of walk(join(websiteRoot, 'public'))) {
  if (/\.(exe|dmg|zip|tar\.gz)$/i.test(path)) fail(`website public must not contain installer/archive: ${path}`)
}

for (const path of walk(websiteRoot)) {
  const rel = relative(websiteRoot, path)
  if (rel === 'dist' || rel.startsWith(`dist/`)) continue
  const stat = statSync(path)
  if (stat.size > 1024 * 1024 && path.includes(`${join('website', 'public')}`)) {
    fail(`large static public file should not be committed: ${path}`)
  }
  const textFile = /\.(astro|css|js|mjs|json|md|txt|svg|html|yml|yaml)$/i.test(path)
  if (textFile) {
    const body = readFileSync(path, 'utf8')
    if (body.includes('goagnet.top')) fail(`wrong domain goagnet.top found in ${path}`)
    if (body.includes('goagent.com')) fail(`unexpected domain goagent.com found in ${path}`)
  }
}

if (failures.length) {
  for (const failure of failures) console.error(`[check-website] ${failure}`)
  process.exit(1)
}

console.log('[check-website] website contract OK')
