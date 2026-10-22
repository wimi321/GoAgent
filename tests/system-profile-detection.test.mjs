import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import test from 'node:test'
import ts from 'typescript'

// Stub only host discovery and unrelated engine services. The actual /models
// request, body parsing, timeout and cache lifecycle run against a local server.
async function fixture(handler) {
  const root = await mkdtemp(join(tmpdir(), 'goagent-profile-'))
  const server = createServer(handler)
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const configDir = join(root, '.config/cliproxyapi')
  await mkdir(configDir, { recursive: true })
  await writeFile(join(configDir, 'config.yaml'), `host: 127.0.0.1\nport: ${server.address().port}\napi-keys:\n  - test-key\n`)
  await writeFile(join(root, 'host.mjs'), `
export const state = { calls: 0, options: null }
export function execFile() {}
execFile[Symbol.for('nodejs.util.promisify.custom')] = async (_command, _args, options) => {
  state.calls++; state.options = options; return { stdout: '' }
}
export default { homedir: () => ${JSON.stringify(root)} }
export const KATAGO_MODEL_PRESETS = []
export const hydrateKataGoSettings = s => s
export const resolveKataGoRuntime = s => ({ katagoBin: s.katagoBin, ready: true, status: 'Ready', modelPreset: { id: 'test' }, notes: [] })
export const ikatagoClientConfigured = () => false
export const shouldPreferIKataGoEngine = () => false
export const shouldPreferZhiziGtpEngine = () => false
export const zhiziGtpConfigured = () => false
export const getZhiziPersistentSessionTelemetry = () => ({ ready: false })
`)
  let source = await readFile(new URL('../src/main/services/systemProfile.ts', import.meta.url), 'utf8')
  for (const dependency of ['node:child_process', 'node:os', './katagoRuntime', './ikatagoClientEngine', './zhiziGtpEngine', './zhiziSocketSession']) {
    source = source.replaceAll(`from '${dependency}'`, "from './host.mjs'")
  }
  await writeFile(join(root, 'systemProfile.mjs'), ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 }
  }).outputText)
  const profile = await import(pathToFileURL(join(root, 'systemProfile.mjs')).href)
  const { state } = await import(pathToFileURL(join(root, 'host.mjs')).href)
  return { profile, state, cleanup: async () => {
    server.closeAllConnections()
    await new Promise((resolve) => server.close(resolve))
    await rm(root, { recursive: true, force: true })
  } }
}

const settings = { katagoBin: 'engine-a', llmConnections: [], activeLlmConnectionId: '', zhiziToken: '' }

test('concurrent and successive dashboard detections share proxy work while engine settings stay fresh', async (t) => {
  let requests = 0
  let now = Date.now()
  t.mock.method(Date, 'now', () => now)
  const { profile, state, cleanup } = await fixture((_request, response) => {
    requests++
    response.end(JSON.stringify({ data: [{ id: `model-${requests}` }] }))
  })
  try {
    const [first, second] = await Promise.all([profile.detectSystemProfile(settings), profile.detectSystemProfile({ ...settings, katagoBin: 'engine-b' })])
    assert.deepEqual(first.proxyModels, ['model-1'])
    assert.deepEqual(second.proxyModels, ['model-1'])
    assert.equal(first.katagoBin, 'engine-a')
    assert.equal(second.katagoBin, 'engine-b')
    await profile.detectSystemProfile(settings)
    assert.equal(requests, 1)
    assert.equal(state.calls, 1)
    assert.equal(state.options.timeout, 2000)
    assert.equal(state.options.windowsHide, true)
    now += 30_001
    const refreshed = await profile.detectSystemProfile(settings)
    assert.deepEqual(refreshed.proxyModels, ['model-2'])
    assert.equal(requests, 2)
    assert.equal(state.calls, 2)
  } finally { await cleanup() }
})

test('a stalled model-list body cannot hang the dashboard and a later probe recovers', { timeout: 15_000 }, async (t) => {
  let requests = 0
  let now = Date.now()
  t.mock.method(Date, 'now', () => now)
  const { profile, cleanup } = await fixture((_request, response) => {
    requests++
    if (requests === 1) {
      response.writeHead(200)
      response.flushHeaders()
    } else response.end(JSON.stringify({ data: [{ id: 'recovered' }] }))
  })
  try {
    const started = performance.now()
    const first = await profile.detectSystemProfile(settings)
    assert.ok(performance.now() - started < 10_000)
    assert.deepEqual(first.proxyModels, [])
    assert.ok(first.notes.some(note => note.includes('模型列表拉取失败')))
    await profile.detectSystemProfile(settings)
    assert.equal(requests, 1)
    now += 30_001
    assert.deepEqual((await profile.detectSystemProfile(settings)).proxyModels, ['recovered'])
  } finally { await cleanup() }
})

test('HTTP errors in discovery are visible instead of silently appearing successful', async () => {
  const { profile, cleanup } = await fixture((_request, response) => {
    response.writeHead(401)
    response.end('unauthorized')
  })
  try {
    const result = await profile.detectSystemProfile(settings)
    assert.deepEqual(result.proxyModels, [])
    assert.ok(result.notes.some(note => note.includes('HTTP 401')))
  } finally { await cleanup() }
})
