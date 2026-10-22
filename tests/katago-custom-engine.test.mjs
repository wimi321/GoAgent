import assert from 'node:assert/strict'
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import test from 'node:test'
import ts from 'typescript'

const posixOnly = { skip: process.platform === 'win32' }
const compilerOptions = {
  module: ts.ModuleKind.ES2022,
  target: ts.ScriptTarget.ES2022,
  verbatimModuleSyntax: false
}

async function transpile(sourcePath, targetPath, replacements = [], prelude = '') {
  let source = await readFile(new URL(`../${sourcePath}`, import.meta.url), 'utf8')
  for (const [from, to] of replacements) source = source.replaceAll(from, to)
  await mkdir(join(targetPath, '..'), { recursive: true })
  await writeFile(targetPath, prelude + ts.transpileModule(source, { compilerOptions }).outputText, 'utf8')
}

// Lays the modules out like src/main/services so relative imports keep working.
async function importKataGoModules(appHome) {
  const root = await mkdtemp(join(tmpdir(), 'goagent-custom-engine-'))
  await writeFile(join(root, 'store.js'), `export const appHome = ${JSON.stringify(appHome)}\n`, 'utf8')
  await transpile('src/main/services/katago/version.ts', join(root, 'katago', 'version.js'))
  await transpile('src/main/services/katagoRuntime.ts', join(root, 'katagoRuntime.js'), [
    ["from '@main/lib/store'", "from './store.js'"],
    ["from '@main/services/katago/version'", "from './katago/version.js'"]
  ], `const __dirname = ${JSON.stringify(root)};\n`)
  await transpile('src/main/services/katago/customEngine.ts', join(root, 'katago', 'customEngine.js'), [
    ["from '../katagoRuntime'", "from '../katagoRuntime.js'"],
    ["from './version'", "from './version.js'"]
  ])
  const stamp = Date.now()
  return {
    root,
    runtime: await import(`${pathToFileURL(join(root, 'katagoRuntime.js')).href}?t=${stamp}`),
    customEngine: await import(`${pathToFileURL(join(root, 'katago', 'customEngine.js')).href}?t=${stamp}`)
  }
}

async function importPersistentEngine() {
  const root = await mkdtemp(join(tmpdir(), 'goagent-engine-eviction-'))
  await writeFile(join(root, 'store.js'), "export function getSettings() { return { katagoEngineMode: 'auto' } }\n", 'utf8')
  await transpile('src/main/services/katagoPersistentEngine.ts', join(root, 'katagoPersistentEngine.js'), [
    ["from '@main/lib/store'", "from './store.js'"]
  ])
  return { root, engine: await import(`${pathToFileURL(join(root, 'katagoPersistentEngine.js')).href}?t=${Date.now()}`) }
}

function settings(overrides = {}) {
  return {
    katagoBin: '',
    katagoModel: '',
    katagoConfig: '',
    katagoCustomBin: '',
    katagoCustomModel: '',
    katagoCustomConfig: '',
    katagoModelPreset: 'official-transformer-balanced',
    katagoAnalysisThreads: 1,
    katagoSearchThreadsPerAnalysisThread: 1,
    katagoMaxBatchSize: 8,
    katagoCacheSizePowerOfTwo: 16,
    ...overrides
  }
}

// A stand-in KataGo: `version`, and `analysis` answering one JSON query per line.
// FAKE_KATAGO_FAIL makes analysis print an error and exit like a broken model would.
const FAKE_KATAGO = `#!/usr/bin/env node
const [command] = process.argv.slice(2)
if (command === 'version') {
  console.log('KataGo v1.16.0')
  console.log('Using Eigen(CPU) backend')
  process.exit(0)
}
if (process.env.FAKE_KATAGO_FAIL) {
  console.error('Error loading model: unexpected end of file')
  process.exit(1)
}
let buffer = ''
process.stdin.on('data', (chunk) => {
  buffer += chunk
  let newline
  while ((newline = buffer.indexOf('\\n')) >= 0) {
    const query = JSON.parse(buffer.slice(0, newline))
    buffer = buffer.slice(newline + 1)
    process.stdout.write(JSON.stringify({ id: query.id, isDuringSearch: false, rootInfo: { winrate: 0.5 }, moveInfos: [] }) + '\\n')
  }
})
`

async function fakeKataGo(dir) {
  // Not `<home>/katago`: that is the app's own KataGo data directory.
  await mkdir(join(dir, 'engine'), { recursive: true })
  const path = join(dir, 'engine', 'katago')
  await writeFile(path, FAKE_KATAGO, 'utf8')
  await chmod(path, 0o755)
  return path
}

test('a custom engine, model and config take priority over automatic detection', posixOnly, async () => {
  const home = await mkdtemp(join(tmpdir(), 'goagent-custom-home-'))
  const binary = await fakeKataGo(home)
  const model = join(home, 'my-net.bin.gz')
  const config = join(home, 'my-analysis.cfg')
  await writeFile(model, 'model', 'utf8')
  await writeFile(config, 'numAnalysisThreads = 2\n', 'utf8')
  const { runtime, root } = await importKataGoModules(home)
  try {
    const resolved = runtime.resolveKataGoRuntime(settings({ katagoCustomBin: binary, katagoCustomModel: model, katagoCustomConfig: config }))
    assert.equal(resolved.katagoBin, binary)
    assert.equal(resolved.katagoModel, model)
    assert.equal(resolved.katagoConfig, config)
    assert.equal(resolved.ready, true)
    // A custom network is not held to the official preset's minimum engine version (1.17).
    assert.equal(resolved.status, '自定义模型 Ready')
    assert.ok(resolved.notes.some((note) => note.includes('v1.16.0（自定义）')), resolved.notes.join('\n'))
  } finally {
    await rm(root, { recursive: true, force: true })
    await rm(home, { recursive: true, force: true })
  }
})

test('unusable custom files fall back to automatic detection and say why', posixOnly, async () => {
  const home = await mkdtemp(join(tmpdir(), 'goagent-custom-home-'))
  const missingBinary = join(home, 'missing-katago')
  const missingModel = join(home, 'missing.bin.gz')
  const missingConfig = join(home, 'missing.cfg')
  const { runtime, root } = await importKataGoModules(home)
  try {
    const resolved = runtime.resolveKataGoRuntime(settings({ katagoCustomBin: missingBinary, katagoCustomModel: missingModel, katagoCustomConfig: missingConfig }))
    assert.notEqual(resolved.katagoBin, missingBinary)
    assert.notEqual(resolved.katagoModel, missingModel)
    assert.equal(resolved.katagoConfig, join(home, 'katago', 'configs', 'analysis_builtin.cfg'))
    assert.ok(resolved.notes.some((note) => note.startsWith('自定义 KataGo 不可用') && note.includes(missingBinary)), resolved.notes.join('\n'))
    assert.ok(resolved.notes.some((note) => note.startsWith('自定义模型不存在')), resolved.notes.join('\n'))
    assert.ok(resolved.notes.some((note) => note.startsWith('自定义配置不存在')), resolved.notes.join('\n'))
  } finally {
    await rm(root, { recursive: true, force: true })
    await rm(home, { recursive: true, force: true })
  }
})

test('checking a custom engine runs a real analysis query and reports KataGo errors', posixOnly, async () => {
  const home = await mkdtemp(join(tmpdir(), 'goagent-custom-home-'))
  const binary = await fakeKataGo(home)
  const model = join(home, 'my-net.bin.gz')
  await writeFile(model, 'model', 'utf8')
  const { customEngine, root } = await importKataGoModules(home)
  const request = { katagoCustomBin: binary, katagoCustomModel: model, katagoCustomConfig: '' }
  try {
    const passed = await customEngine.checkCustomKataGoEngine(request, settings())
    assert.equal(passed.ok, true, `${passed.message}\n${passed.detail}`)
    assert.equal(passed.engineVersion, '1.16.0')
    assert.equal(passed.configPath, join(home, 'katago', 'configs', 'analysis_builtin.cfg'))

    process.env.FAKE_KATAGO_FAIL = '1'
    const failed = await customEngine.checkCustomKataGoEngine(request, settings())
    assert.equal(failed.ok, false)
    assert.match(failed.detail, /unexpected end of file/)

    const missing = await customEngine.checkCustomKataGoEngine({ ...request, katagoCustomModel: join(home, 'nope.bin.gz') }, settings())
    assert.equal(missing.ok, false)
    assert.match(missing.message, /模型不存在/)
  } finally {
    delete process.env.FAKE_KATAGO_FAIL
    await rm(root, { recursive: true, force: true })
    await rm(home, { recursive: true, force: true })
  }
})

test('switching engine, model or config stops the idle engine of the previous command', async () => {
  const { engine, root } = await importPersistentEngine()
  const script = join(root, 'fake-engine.mjs')
  await writeFile(script, `
import { appendFileSync } from 'node:fs'
appendFileSync(process.argv[2], process.pid + '\\n')
process.stdin.setEncoding('utf8')
let buffer = ''
process.stdin.on('data', (chunk) => {
  buffer += chunk
  let newline
  while ((newline = buffer.indexOf('\\n')) >= 0) {
    const query = JSON.parse(buffer.slice(0, newline))
    buffer = buffer.slice(newline + 1)
    if (query.action !== 'terminate') process.stdout.write(JSON.stringify({ id: query.id, isDuringSearch: false }) + '\\n')
  }
})
`, 'utf8')
  const pidsA = join(root, 'a.pids')
  const commandA = [process.execPath, script, pidsA]
  const commandB = [process.execPath, script, join(root, 'b.pids')]
  const isAlive = (pid) => {
    try {
      process.kill(pid, 0)
      return true
    } catch {
      return false
    }
  }
  try {
    await engine.queryKataGoPersistentBatch({ command: commandA, queries: [{ id: 'a1' }], timeoutMs: 10_000 })
    const [firstA] = (await readFile(pidsA, 'utf8')).trim().split('\n').map(Number)
    assert.equal(isAlive(firstA), true)

    await engine.queryKataGoPersistentBatch({ command: commandB, queries: [{ id: 'b1' }], timeoutMs: 10_000 })
    for (let attempt = 0; attempt < 50 && isAlive(firstA); attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
    assert.equal(isAlive(firstA), false, 'the engine for the previous command should be stopped')

    await engine.queryKataGoPersistentBatch({ command: commandA, queries: [{ id: 'a2' }], timeoutMs: 10_000 })
    assert.equal((await readFile(pidsA, 'utf8')).trim().split('\n').length, 2)
  } finally {
    engine.stopPersistentKataGoEngines()
    await rm(root, { recursive: true, force: true })
  }
})

async function sourceText(path) {
  return (await readFile(new URL(`../${path}`, import.meta.url), 'utf8')).replace(/\r\n/g, '\n')
}

test('settings expose custom KataGo files with a picker, a real check and a reset', async () => {
  const preload = await sourceText('src/preload/index.ts')
  const main = await sourceText('src/main/index.ts')
  const app = await sourceText('src/renderer/src/App.tsx')
  const panel = await sourceText('src/renderer/src/features/settings/KataGoCustomEnginePanel.tsx')
  const store = await sourceText('src/main/lib/store.ts')

  assert.match(preload, /pickKataGoCustomPath: .*'katago:pick-custom-path'/)
  assert.match(preload, /checkKataGoCustomEngine: .*'katago:check-custom-engine'/)
  assert.match(main, /ipcMain\.handle\('katago:check-custom-engine'.*checkCustomKataGoEngine\(payload, getSettings\(\)\)/)
  assert.match(store, /katagoCustomBin: '',\n {2}katagoCustomModel: '',\n {2}katagoCustomConfig: ''/)
  assert.match(app, /<KataGoCustomEnginePanel[\s\S]*?onEngineChanged=\{onKataGoEngineChanged\}/)
  assert.match(app, /customModel \? `custom:\$\{customModel\}` : ''/)
  for (const key of ['customEngineCheck', 'customEngineApply', 'customEngineReset', 'customEngineBrowse']) {
    assert.match(panel, new RegExp(`t\\('${key}'\\)`))
  }
})

test('only a custom engine changes analysis cache keys', async () => {
  const integration = await sourceText('src/main/services/analysis/runtimeIntegration.ts')
  assert.match(integration, /\.\.\.\(settings\.katagoCustomBin\?\.trim\(\) \? \[`custom-engine:\$\{fileFingerprint\(settings\.katagoBin\)\}`\] : \[\]\)/)
})
