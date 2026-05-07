#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

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
requireFile('website/DEPLOYMENT.md')

const index = read('website/src/pages/index.astro')
const privacy = read('website/src/pages/privacy.astro')
const deployment = read('website/DEPLOYMENT.md')

if (!index.toLowerCase().includes('goagent')) fail('homepage must contain goagent')
if (!index.includes('https://github.com/wimi321/GoAgent/releases')) fail('homepage must link GitHub Releases')
for (const keyword of ['本地', 'LLM', 'TTS']) {
  if (!privacy.includes(keyword)) fail(`privacy page must contain ${keyword}`)
}
for (const keyword of ['Cloudflare Pages', 'Spaceship', 'goagent.top']) {
  if (!deployment.includes(keyword)) fail(`DEPLOYMENT.md must contain ${keyword}`)
}

for (const path of walk(join(websiteRoot, 'public'))) {
  if (/\.(exe|dmg|zip|tar\.gz)$/i.test(path)) fail(`website public must not contain installer/archive: ${path}`)
}

for (const path of walk(websiteRoot)) {
  if (path.includes(`${join('website', 'dist')}${'/'.replace('/', '')}`)) continue
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
