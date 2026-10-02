import test from 'node:test'
import assert from 'node:assert/strict'
import { fetchCatalogWithRetry, safeDownloadUrl, safeGithubReleaseUrl, validateCatalog, selectAssets, formatSize } from '../src/lib/download-catalog.mjs'
import { homeCopy, localeSlugs } from '../src/data/home-copy.mjs'

const tag = 'next-test'
const catalog = { schemaVersion: 1, releaseTag: tag, assets: [] }
const asset = (overrides = {}) => ({ category: 'windows-portable', flavor: 'nvidia', arch: 'x64', name: 'windows.zip', sizeBytes: 1024, downloadUrl: `https://download.goagent.top/releases/${tag}/windows.zip`, ...overrides })
const target = { category: 'windows-portable', flavor: 'nvidia', arch: 'x64' }

test('downloads accept only project-owned HTTPS release paths', () => {
  assert.ok(safeDownloadUrl(asset().downloadUrl))
  assert.ok(safeDownloadUrl(`https://github.com/wimi321/lizzieyzy-next/releases/download/${tag}/a.zip`))
  for (const url of ['javascript:alert(1)', 'http://download.goagent.top/releases/a', 'https://evil.test/releases/a', 'https://github.com/other/repo/releases/download/a', 'https://download.goagent.top.evil.test/releases/a', 'https://user:password@download.goagent.top/releases/a', 'https://download.goagent.top:8443/releases/a', 'https://download.goagent.top/channels/a']) assert.equal(safeDownloadUrl(url), null)
})
test('release fallback cannot point to another repository or scheme', () => {
  assert.ok(safeGithubReleaseUrl(`https://github.com/wimi321/lizzieyzy-next/releases/tag/${tag}`))
  for (const value of [null, '', 'https://evil.test', 'https://github.com/wimi321/other/releases/tag/a', 'http://github.com/wimi321/lizzieyzy-next/releases/tag/a']) assert.equal(safeGithubReleaseUrl(value), null)
})
test('invalid catalog schema is rejected', () => {
  assert.equal(validateCatalog(catalog), catalog)
  for (const value of [null, {}, {...catalog, schemaVersion: 2}, {...catalog, assets: {}}, {...catalog, releaseTag: ''}]) assert.throws(() => validateCatalog(value))
})
test('flavor and architecture selection never guesses', () => {
  const value = {...catalog, assets: [asset({arch:'arm64'}), asset({flavor:'opencl'}), asset()]}
  assert.deepEqual(selectAssets(value, target).map(x=>x.asset), [value.assets[2]])
  assert.deepEqual(selectAssets(value, {...target, flavor:'missing'}), [])
})
test('unsafe URLs and invalid sizes cannot become enabled buttons', () => {
  for (const overrides of [{downloadUrl:'https://evil.test/a'}, {sizeBytes:0}, {sizeBytes:-1}, {sizeBytes:'100'}, {sizeBytes:1.5}]) assert.deepEqual(selectAssets({...catalog, assets:[asset(overrides)]}, target), [])
})
test('TensorRT needs two distinct matching volumes, excluding README and manifests', () => {
  const a = asset({category:'tensorrt-optional', name:'trt.7z.001'})
  const b = {...a, name:'trt.7z.002'}
  const options = {category:'tensorrt-optional', multipart:'true'}
  const select = assets => selectAssets({...catalog, assets}, options)
  assert.equal(select([b,a,{...a,name:'README.txt'}]).length, 2)
  for (const values of [[a], [a,a], [a,{...b,name:'other.7z.002'}], [a,{...b,sizeBytes:0}]]) assert.deepEqual(select(values), [])
})
test('catalog retries transient failures and succeeds on the third request', async () => {
  let calls = 0
  const result = await fetchCatalogWithRetry('test', {retryDelayMs:0, fetcher:async()=> {
    calls++
    return calls < 3 ? {ok:false,status:503} : {ok:true,json:async()=>catalog}
  }})
  assert.equal(calls,3)
  assert.equal(result,catalog)
})
test('persistent or malformed responses stop after three attempts', async () => {
  let calls = 0
  await assert.rejects(fetchCatalogWithRetry('test',{retryDelayMs:0,fetcher:async()=>{calls++;return {ok:true,json:async()=>({})}}}))
  assert.equal(calls,3)
})
test('a stalled request is aborted rather than leaving the page loading forever', async () => {
  let aborted = 0
  await assert.rejects(fetchCatalogWithRetry('test',{timeoutMs:5,retryDelayMs:0,fetcher:(_, {signal})=>new Promise((_,reject)=>signal.addEventListener('abort',()=>{aborted++;reject(new Error('timeout'))}))}))
  assert.equal(aborted,3)
})
test('file sizes are readable and never display NaN', () => {
  assert.equal(formatSize(1024),'1.0 KB')
  assert.equal(formatSize(1024**3),'1.0 GB')
  for (const value of [NaN, Infinity, -1, 0]) assert.equal(formatSize(value),'—')
})
test('all seven languages have the same homepage fields and three review steps', () => {
  assert.equal(Object.keys(homeCopy).length,7)
  const keys = Object.keys(homeCopy['zh-CN']).sort()
  for (const [lang, copy] of Object.entries(homeCopy)) {
    assert.deepEqual(Object.keys(copy).sort(),keys,lang)
    assert.ok(lang in localeSlugs)
    assert.equal(copy.steps.length,3)
    assert.equal(copy.headline.length,2)
    assert.ok(copy.aiNote.length>10)
    for (const value of Object.values(copy)) assert.ok(value.length>0,lang)
  }
})
