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
const privacy = read('website/src/pages/privacy.astro')
const deployment = read('website/DEPLOYMENT.md')
const workflow = read('.github/workflows/deploy-website.yml')
const sitemap = read('website/public/sitemap.xml')
const manifest = read('website/public/site.webmanifest')
const llms = read('website/public/llms.txt')
const llmsFull = read('website/public/llms-full.txt')
const ai = read('website/public/ai.txt')

if (!index.includes('LizzieYzy Next')) fail('homepage must contain LizzieYzy Next')
if (!index.includes('首推')) fail('homepage must present LizzieYzy Next as the recommended product')
if (!index.includes('实验围棋智能体')) fail('homepage must position GoAgent as an experimental Go agent')
if (!index.includes('https://pan.baidu.com/s/1wthaL8YwGMxy_u0U7Mabpw?pwd=3i8w')) fail('homepage must link LizzieYzy Next Baidu Netdisk')
if (!index.includes('提取码')) fail('homepage must show the Baidu Netdisk extraction code label')
if (!index.includes('https://github.com/wimi321/lizzieyzy-next/releases')) fail('homepage must link LizzieYzy Next Releases')
if (!index.includes('https://github.com/wimi321/GoAgent/releases')) fail('homepage must still link GoAgent Releases')
if (!index.includes('QQ 1030632742')) fail('homepage must expose QQ community')
if (index.includes('Trust')) fail('homepage should not include Trust section')
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
