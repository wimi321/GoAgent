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
requireFile('website/DEPLOYMENT.md')
requireFile('.github/workflows/deploy-website.yml')
requireFile('website/public/sitemap.xml')
requireFile('website/public/site.webmanifest')
requireFile('website/public/llms.txt')
requireFile('website/public/llms-full.txt')
requireFile('website/public/ai.txt')

const index = read('website/src/pages/index.astro')
const downloadPage = read('website/src/pages/download.astro')
const docsPage = read('website/src/pages/docs.astro')
const faqPage = read('website/src/pages/faq.astro')
const changelogPage = read('website/src/pages/changelog.astro')
const localizedHome = read('website/src/pages/[locale].astro')
const localizedPages = read('website/src/pages/[locale]/[page].astro')
const layout = read('website/src/layouts/BaseLayout.astro')
const privacy = read('website/src/pages/privacy.astro')
const deployment = read('website/DEPLOYMENT.md')
const workflow = read('.github/workflows/deploy-website.yml')
const sitemap = read('website/public/sitemap.xml')
const manifest = read('website/public/site.webmanifest')
const llms = read('website/public/llms.txt')
const llmsFull = read('website/public/llms-full.txt')
const ai = read('website/public/ai.txt')
const baiduCodeLabel = ['提取', '码'].join('')
const chooserCopy = ['不会选', '也没关系'].join('')

if (!index.includes('LizzieYzy Next')) fail('homepage must contain LizzieYzy Next')
if (!index.includes('想复盘围棋')) fail('homepage must use the simple Go review hero headline')
if (!index.includes('首推')) fail('homepage must present LizzieYzy Next as the recommended product')
if (!index.includes('实验围棋智能体')) fail('homepage must position GoAgent as an experimental Go agent')
if (!index.includes('https://pan.baidu.com/s/1wthaL8YwGMxy_u0U7Mabpw?pwd=3i8w')) fail('homepage must link LizzieYzy Next Baidu Netdisk')
if (!index.includes('国内下载（百度网盘）')) fail('homepage hero must expose the domestic Baidu download button')
if (!index.includes('国内用户优先用百度网盘下载')) fail('homepage hero must explain Baidu Netdisk as the domestic priority')
if (!index.includes('备用：从 GitHub 下载')) fail('homepage hero must explain GitHub as backup')
if (index.includes(chooserCopy)) fail('homepage hero must not use unnecessary chooser copy')
if (index.includes('打不开再用')) fail('homepage should use priority/backup wording instead of troubleshooting-first wording')
if (index.includes(baiduCodeLabel)) fail('homepage must not show a separate Baidu code label because it is already in the link')
if (!index.includes('https://github.com/wimi321/lizzieyzy-next/releases')) fail('homepage must link LizzieYzy Next GitHub download')
if (!index.includes('https://github.com/wimi321/GoAgent/releases')) fail('homepage must still link GoAgent GitHub download')
if (!layout.includes('QQ 1030632742')) fail('site layout must expose QQ community')
if (index.includes('Trust')) fail('homepage should not include Trust section')
if (!index.includes('下载顺序很简单')) fail('homepage download section must use simple download sequence copy')
if (!downloadPage.includes('不知道选哪个？国内用户优先用百度网盘下载')) fail('download page must explain the simplest download choice')
for (const keyword of ['SHA256', '回滚', '归档']) {
  if (downloadPage.includes(keyword)) fail(`download page should avoid technical wording: ${keyword}`)
}
for (const keyword of ['不用研究术语', '第一步：先下载 LizzieYzy Next', '国内用户：优先用百度网盘下载']) {
  if (!docsPage.includes(keyword)) fail(`docs page must contain simple user guidance: ${keyword}`)
}
if (docsPage.includes('百度网盘打不开：')) fail('docs page should not lead with Baidu troubleshooting wording')
for (const keyword of ['我应该先下载哪个？', 'GitHub 是备用下载入口', '不用先懂']) {
  if (!faqPage.includes(keyword)) fail(`FAQ page must answer normal-user questions: ${keyword}`)
}
for (const keyword of ['官网首页更简单', '多语言页面同步更新', '普通用户不用先理解项目区别']) {
  if (!changelogPage.includes(keyword)) fail(`changelog page must use user-facing copy: ${keyword}`)
}
for (const keyword of [
  'homeCopy',
  'Review Go games?',
  'China download (Baidu)',
  'GitHub download',
  'home-proof-strip',
  'hero-actions',
  'Tải tại Trung Quốc (Baidu)'
]) {
  if (!localizedHome.includes(keyword)) fail(`localized homepage must use the simplified homepage system: ${keyword}`)
}
if (localizedHome.includes('<figure class="hero-art">')) fail('localized homepage must not render the old hero-art layout')
for (const keyword of [
  'simpleDownloads',
  'Download LizzieYzy Next first',
  'What should I download first?',
  'Changelog - LizzieYzy Next and GoAgent Website',
  'Tải LizzieYzy Next trước',
  'ดาวน์โหลด LizzieYzy Next',
  "page === 'download' ? simpleDownloads"
]) {
  if (!localizedPages.includes(keyword)) fail(`localized pages must use simple download/docs/FAQ/changelog copy: ${keyword}`)
}
for (const keyword of ['本地', 'LLM', 'TTS']) {
  if (!privacy.includes(keyword)) fail(`privacy page must contain ${keyword}`)
}
for (const keyword of ['Cloudflare Pages', 'Spaceship', 'goagent.top', '百度网盘']) {
  if (!deployment.includes(keyword)) fail(`DEPLOYMENT.md must contain ${keyword}`)
}
for (const keyword of ['cloudflare/wrangler-action@v3', 'CLOUDFLARE_API_TOKEN', 'pages deploy website/dist --project-name=goagent']) {
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
for (const keyword of ['LizzieYzy Next', 'GoAgent', 'katago-review', 'AI Go review', 'Product comparison', 'pan.baidu.com']) {
  if (!llms.includes(keyword)) fail(`llms.txt must contain ${keyword}`)
}
for (const keyword of ['Primary recommendation', 'Experimental project', 'Important pages', 'https://goagent.top/compare', 'Baidu Netdisk']) {
  if (!llmsFull.includes(keyword)) fail(`llms-full.txt must contain ${keyword}`)
}
for (const keyword of ['canonical_product: LizzieYzy Next', 'secondary_product: GoAgent', 'best_links', 'baidu_netdisk']) {
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
