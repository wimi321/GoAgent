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
requireFile('website/src/pages/[locale].astro')
requireFile('website/DEPLOYMENT.md')
requireFile('website/public/sitemap.xml')
requireFile('website/public/site.webmanifest')
requireFile('website/public/llms.txt')

const index = read('website/src/pages/index.astro')
const privacy = read('website/src/pages/privacy.astro')
const deployment = read('website/DEPLOYMENT.md')
const sitemap = read('website/public/sitemap.xml')
const manifest = read('website/public/site.webmanifest')

if (!index.includes('GoAgent')) fail('homepage must contain GoAgent')
if (!index.includes('https://github.com/wimi321/GoAgent/releases')) fail('homepage must link GitHub Releases')
if (!index.includes('QQ 1030632742')) fail('homepage must expose QQ community')
if (index.includes('Trust')) fail('homepage should not include Trust section')
for (const keyword of ['本地', 'LLM', 'TTS']) {
  if (!privacy.includes(keyword)) fail(`privacy page must contain ${keyword}`)
}
for (const keyword of ['Cloudflare Pages', 'Spaceship', 'goagent.top']) {
  if (!deployment.includes(keyword)) fail(`DEPLOYMENT.md must contain ${keyword}`)
}
for (const keyword of ['https://goagent.top/', 'https://goagent.top/en', 'https://goagent.top/zh-hant']) {
  if (!sitemap.includes(keyword)) fail(`sitemap.xml must contain ${keyword}`)
}
if (!manifest.includes('"name": "GoAgent"')) fail('site.webmanifest must name GoAgent')

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
