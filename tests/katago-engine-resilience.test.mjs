import assert from 'node:assert/strict'
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import test from 'node:test'
import ts from 'typescript'

const compilerOptions = {
  module: ts.ModuleKind.ES2022,
  target: ts.ScriptTarget.ES2022,
  verbatimModuleSyntax: false
}

async function transpile(sourcePath, targetPath, replacements = [], prelude = '') {
  let source = await readFile(new URL(`../${sourcePath}`, import.meta.url), 'utf8')
  for (const [from, to] of replacements) {
    source = source.replaceAll(from, to)
  }
  await writeFile(targetPath, prelude + ts.transpileModule(source, { compilerOptions }).outputText, 'utf8')
}

async function importPersistentEngine() {
  const root = await mkdtemp(join(tmpdir(), 'goagent-persistent-engine-'))
  await writeFile(join(root, 'store.js'), "export function getSettings() { return { katagoEngineMode: 'auto' } }\n", 'utf8')
  await transpile('src/main/services/katagoPersistentEngine.ts', join(root, 'katagoPersistentEngine.js'), [
    ["from '@main/lib/store'", "from './store.js'"]
  ])
  const engine = await import(`${pathToFileURL(join(root, 'katagoPersistentEngine.js')).href}?t=${Date.now()}`)
  return { engine, root }
}

async function importKataGoRuntime(appHome) {
  const root = await mkdtemp(join(tmpdir(), 'goagent-katago-runtime-'))
  await writeFile(join(root, 'store.js'), `export const appHome = ${JSON.stringify(appHome)}\n`, 'utf8')
  await transpile('src/main/services/katago/version.ts', join(root, 'version.js'))
  // electron-vite provides __dirname in the bundled ESM main process.
  await transpile('src/main/services/katagoRuntime.ts', join(root, 'katagoRuntime.js'), [
    ["from '@main/lib/store'", "from './store.js'"],
    ["from '@main/services/katago/version'", "from './version.js'"]
  ], `const __dirname = ${JSON.stringify(root)};\n`)
  const runtime = await import(`${pathToFileURL(join(root, 'katagoRuntime.js')).href}?t=${Date.now()}`)
  return { runtime, root }
}

function withDeadline(promise, ms, label) {
  let timer
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} did not settle within ${ms}ms`)), ms)
  })
  return Promise.race([promise, deadline]).finally(() => clearTimeout(timer))
}

const FAKE_KATAGO = `
import { createInterface } from 'node:readline'
createInterface({ input: process.stdin }).on('line', (line) => {
  const query = JSON.parse(line)
  if (query.action === 'terminate') return
  process.stdout.write(JSON.stringify({ id: query.id, isDuringSearch: false, rootInfo: { winrate: 0.5 }, moveInfos: [] }) + '\\n')
})
`

test('a KataGo that exits during startup fails the query instead of hanging every later one', async () => {
  const { engine, root } = await importPersistentEngine()
  const command = [process.execPath, '-e', "process.stderr.write('model file is corrupt'); process.exit(3)"]
  try {
    for (const attempt of ['first', 'second']) {
      await assert.rejects(
        withDeadline(engine.queryKataGoPersistentBatch({ command, queries: [{ id: 'q', moves: [] }], timeoutMs: 60_000 }), 5000, `${attempt} query`),
        /model file is corrupt|exited/
      )
    }
  } finally {
    engine.stopPersistentKataGoEngines()
    await rm(root, { recursive: true, force: true })
  }
})

test('writing a large batch to a KataGo that already exited does not crash the main process', async () => {
  const { engine, root } = await importPersistentEngine()
  const uncaught = []
  const onUncaught = (error) => uncaught.push(error)
  process.on('uncaughtException', onUncaught)
  const exitAfterStartup = [process.execPath, '-e', 'setTimeout(() => process.exit(1), 400)']
  const moves = Array.from({ length: 250 }, (_, index) => [index % 2 ? 'W' : 'B', 'D4'])
  const queries = Array.from({ length: 251 }, (_, index) => ({ id: `move-${index}`, moves: moves.slice(0, index) }))
  try {
    await assert.rejects(
      withDeadline(engine.queryKataGoPersistentBatch({ command: exitAfterStartup, queries, timeoutMs: 60_000 }), 5000, 'sweep'),
      /exited/
    )
    await new Promise((resolve) => setTimeout(resolve, 200))
    assert.deepEqual(uncaught.map(String), [])
  } finally {
    process.off('uncaughtException', onUncaught)
    engine.stopPersistentKataGoEngines()
    await rm(root, { recursive: true, force: true })
  }
})

test('the persistent engine answers with the caller ids and can be stopped', async () => {
  const { engine, root } = await importPersistentEngine()
  const script = join(root, 'fake-katago.mjs')
  await writeFile(script, FAKE_KATAGO, 'utf8')
  const command = [process.execPath, script]
  try {
    const results = await withDeadline(
      engine.queryKataGoPersistentBatch({ command, queries: [{ id: 'before' }, { id: 'after' }], timeoutMs: 10_000 }),
      5000,
      'batch'
    )
    assert.deepEqual([...results.keys()].sort(), ['after', 'before'])
    assert.equal(results.get('before').rootInfo.winrate, 0.5)
  } finally {
    engine.stopPersistentKataGoEngines()
    await rm(root, { recursive: true, force: true })
  }
})

test('a version probe that times out on first launch is retried in the background, not cached as missing', { skip: process.platform === 'win32' }, async () => {
  const home = await mkdtemp(join(tmpdir(), 'goagent-probe-home-'))
  const binDir = join(home, 'engine')
  await mkdir(binDir, { recursive: true })
  const fakeBinary = join(binDir, 'katago')
  // Simulates an OS malware scan that delays only the very first launch of a new binary.
  await writeFile(fakeBinary, [
    '#!/bin/sh',
    'marker="$(dirname "$0")/scanned"',
    'if [ ! -f "$marker" ]; then touch "$marker"; sleep 30; fi',
    'echo "KataGo v1.17.1"',
    ''
  ].join('\n'), 'utf8')
  await chmod(fakeBinary, 0o755)
  const previousBin = process.env.GOAGENT_KATAGO_BIN
  process.env.GOAGENT_KATAGO_BIN = fakeBinary
  const { runtime, root } = await importKataGoRuntime(home)
  try {
    const first = runtime.resolveKataGoRuntime()
    assert.notEqual(first.katagoBin, fakeBinary)
    assert.ok(first.notes.some((note) => note.includes('首次启动校验中') && note.includes(fakeBinary)), first.notes.join('\n'))

    let resolved = first
    for (let attempt = 0; attempt < 40 && resolved.katagoBin !== fakeBinary; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 100))
      resolved = runtime.resolveKataGoRuntime()
    }
    assert.equal(resolved.katagoBin, fakeBinary)
    assert.ok(resolved.notes.some((note) => note.includes('v1.17.1')), resolved.notes.join('\n'))
  } finally {
    if (previousBin === undefined) delete process.env.GOAGENT_KATAGO_BIN
    else process.env.GOAGENT_KATAGO_BIN = previousBin
    await rm(root, { recursive: true, force: true })
    await rm(home, { recursive: true, force: true })
  }
})
