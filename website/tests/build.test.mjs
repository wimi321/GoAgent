import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { localeSlugs } from '../src/data/home-copy.mjs'

const dist = resolve(dirname(fileURLToPath(import.meta.url)), '../dist')
const read = path => readFileSync(join(dist,path),'utf8')
const walk = dir => readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(dir,e.name)):[join(dir,e.name)])

test('built homepage and download routes share the official catalog in seven languages', () => {
  for (const [lang, slug] of Object.entries(localeSlugs)) {
    const prefix = slug ? `${slug}/` : ''
    for (const path of [`${prefix}index.html`,`${prefix}download/index.html`]) {
      const html=read(path)
      assert.ok(html.includes(`lang="${lang}"`),path)
      assert.ok(html.includes('https://download.goagent.top/channels/stable/catalog.json'),path)
      assert.ok(!html.includes('/__dev/'),path)
      assert.equal((html.match(/<h1(?:\s|>)/g)||[]).length,1,path)
      assert.ok(html.includes('data-platform-tab="linux"'),path)
      assert.ok(html.includes('data-download-retry'),path)
      assert.ok(html.includes('<noscript>'),path)
      if (path.includes('download/')) assert.ok(html.includes('data-platform-only="windows"'),path)
    }
  }
})
test('all built pages have valid internal links, image assets and unique IDs', () => {
  const pages=walk(dist).filter(p=>p.endsWith('.html'))
  assert.ok(pages.length>=40)
  for (const page of pages) {
    const html=readFileSync(page,'utf8')
    const ids=[...html.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1])
    assert.equal(ids.length,new Set(ids).size,`duplicate IDs in ${page}`)
    for (const [,raw] of html.matchAll(/\s(?:href|src)="(\/[^"#?]*)(?:[#?][^"]*)?"/g)) {
      if (raw.startsWith('//')) continue
      const path=join(dist,decodeURIComponent(raw))
      assert.ok(existsSync(path)||existsSync(join(path,'index.html'))||existsSync(path+'.html'),`${page}: missing ${raw}`)
    }
    for(const [,id] of html.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.includes(id),`${page}: missing #${id}`)
  }
})
