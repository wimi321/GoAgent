import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import test from 'node:test'
import ts from 'typescript'

const DAY = 24 * 60 * 60 * 1000
const compilerOptions = {
  module: ts.ModuleKind.ES2022,
  target: ts.ScriptTarget.ES2022,
  verbatimModuleSyntax: false
}

async function transpileModule(sourcePath, replacements = []) {
  const root = await mkdtemp(join(tmpdir(), 'goagent-storage-'))
  let source = await readFile(new URL(`../${sourcePath}`, import.meta.url), 'utf8')
  for (const [from, to] of replacements) source = source.replaceAll(from, to)
  const target = join(root, 'module.js')
  await writeFile(target, ts.transpileModule(source, { compilerOptions }).outputText, 'utf8')
  return { root, module: await import(`${pathToFileURL(target).href}?t=${Date.now()}`) }
}

async function file(path, bytes, ageDays, now) {
  await mkdir(join(path, '..'), { recursive: true })
  await writeFile(path, 'x'.repeat(bytes), 'utf8')
  const time = new Date(now - ageDays * DAY)
  await utimes(path, time, time)
  return path
}

test('analysis cache pruning drops entries reads no longer accept, except oracle entries', async () => {
  const { root: moduleRoot, module: pruning } = await transpileModule('src/main/services/maintenance/storagePruning.ts')
  const cache = await mkdtemp(join(tmpdir(), 'goagent-analysis-cache-'))
  const now = Date.now()
  try {
    const staleSweep = await file(join(cache, 'sweep', 'gameOld', 'modelA', '1-a.json'), 100, 60, now)
    const staleTeaching = await file(join(cache, 'teaching', 'gameOld', 'modelB', '1-b.json'), 100, 50, now)
    const oldOracle = await file(join(cache, 'oracle', 'gameOld', 'modelA', '1-c.json'), 100, 60, now)
    const recent = await file(join(cache, 'sweep', 'gameRecent', 'modelA', '1-d.json'), 100, 40, now)

    const result = await pruning.pruneAnalysisCache(cache, { now })

    assert.equal(existsSync(staleSweep), false, 'entries past the read window are removed')
    assert.equal(existsSync(staleTeaching), false)
    assert.equal(existsSync(oldOracle), true, 'oracle entries never go stale')
    assert.equal(existsSync(recent), true)
    assert.equal(existsSync(join(cache, 'teaching', 'gameOld')), false, 'emptied directories are removed')
    assert.deepEqual([result.removedFiles, result.removedBytes, result.keptBytes], [2, 200, 200])
  } finally {
    await rm(cache, { recursive: true, force: true })
    await rm(moduleRoot, { recursive: true, force: true })
  }
})

test('analysis cache over the size cap evicts least recently used games across tiers', async () => {
  const { root: moduleRoot, module: pruning } = await transpileModule('src/main/services/maintenance/storagePruning.ts')
  const cache = await mkdtemp(join(tmpdir(), 'goagent-analysis-cache-'))
  const now = Date.now()
  try {
    const lruSweep = await file(join(cache, 'sweep', 'gameLru', 'modelA', '1-a.json'), 400, 10, now)
    const lruOracle = await file(join(cache, 'oracle', 'gameLru', 'modelB', '2-b.json'), 400, 9, now)
    const used = await file(join(cache, 'sweep', 'gameUsed', 'modelA', '1-c.json'), 400, 5, now)
    const recent = await file(join(cache, 'teaching', 'gameRecent', 'modelA', '1-d.json'), 400, 1, now)

    const result = await pruning.pruneAnalysisCache(cache, { maxBytes: 900, now })

    assert.equal(existsSync(lruSweep), false)
    assert.equal(existsSync(lruOracle), false, 'a whole game goes, whatever the tier')
    assert.equal(existsSync(used), true)
    assert.equal(existsSync(recent), true)
    assert.deepEqual([result.removedFiles, result.keptBytes], [2, 800])
  } finally {
    await rm(cache, { recursive: true, force: true })
    await rm(moduleRoot, { recursive: true, force: true })
  }
})

test('TTS cache pruning keeps the most recently played audio under the cap', async () => {
  const { root: moduleRoot, module: pruning } = await transpileModule('src/main/services/maintenance/storagePruning.ts')
  const cache = await mkdtemp(join(tmpdir(), 'goagent-tts-cache-'))
  const now = Date.now()
  try {
    const oldest = await file(join(cache, 'kokoro-bundled', 'a.wav'), 300, 30, now)
    const middle = await file(join(cache, 'volcengine-doubao', 'b.mp3'), 300, 20, now)
    const newest = await file(join(cache, 'kokoro-bundled', 'c.wav'), 300, 1, now)
    const notAudio = await file(join(cache, 'kokoro-bundled', 'notes.txt'), 5000, 99, now)

    const result = await pruning.pruneTtsCache(cache, { maxBytes: 650 })

    assert.equal(existsSync(oldest), false)
    assert.equal(existsSync(middle), true)
    assert.equal(existsSync(newest), true)
    assert.equal(existsSync(notAudio), true)
    assert.deepEqual([result.removedFiles, result.keptBytes], [1, 600])
  } finally {
    await rm(cache, { recursive: true, force: true })
    await rm(moduleRoot, { recursive: true, force: true })
  }
})

test('KataGo logs are capped by age and count', async () => {
  const { root: moduleRoot, module: pruning } = await transpileModule('src/main/services/maintenance/storagePruning.ts')
  const logs = await mkdtemp(join(tmpdir(), 'goagent-katago-logs-'))
  const now = Date.now()
  try {
    const recent = await Promise.all([1, 2, 3].map((age) => file(join(logs, `recent-${age}.log`), 10, age, now)))
    const old = await file(join(logs, 'old.log'), 10, 20, now)

    await pruning.pruneKataGoLogs(logs, { keep: 2, maxAgeMs: 14 * DAY, now })

    assert.deepEqual(recent.map((path) => existsSync(path)), [true, true, false])
    assert.equal(existsSync(old), false)
  } finally {
    await rm(logs, { recursive: true, force: true })
    await rm(moduleRoot, { recursive: true, force: true })
  }
})

test('deleting a game removes its cached analysis in every tier and nothing else', async () => {
  const appCache = await mkdtemp(join(tmpdir(), 'goagent-app-cache-'))
  const { root: moduleRoot, module: cache } = await transpileModule('src/main/services/analysis/cache.ts', [
    ["import { cacheDir } from '@main/lib/store'", `const cacheDir = ${JSON.stringify(appCache)}`]
  ])
  try {
    const entry = (gameFingerprint, tier) => ({ gameId: 'g', gameFingerprint, moveNumber: 3, maxVisits: 40, tier })
    const analysis = { moveNumber: 3, before: { topMoves: [] }, after: { topMoves: [] } }
    for (const tier of ['sweep', 'teaching']) cache.writeAnalysisCache(entry('deleted-game', tier), analysis)
    cache.writeAnalysisCache(entry('kept-game', 'sweep'), analysis)

    cache.removeAnalysisCacheForGame('deleted-game')

    assert.equal(existsSync(cache.analysisCachePath(entry('deleted-game', 'sweep'))), false)
    assert.equal(existsSync(cache.analysisCachePath(entry('deleted-game', 'teaching'))), false)
    assert.equal(existsSync(cache.analysisCachePath(entry('kept-game', 'sweep'))), true)
    const written = await readFile(cache.analysisCachePath(entry('kept-game', 'sweep')), 'utf8')
    assert.doesNotMatch(written, /\n/, 'cache entries are written as compact JSON')
  } finally {
    await rm(appCache, { recursive: true, force: true })
    await rm(moduleRoot, { recursive: true, force: true })
  }
})

test('maintenance runs off the startup path and cache hits refresh file times', async () => {
  const read = async (path) => (await readFile(new URL(`../${path}`, import.meta.url), 'utf8')).replace(/\r\n/g, '\n')
  const main = await read('src/main/index.ts')
  const cacheSource = await read('src/main/services/analysis/cache.ts')
  const ttsCache = await read('src/main/services/tts/cache.ts')
  const deleteGame = await read('src/main/services/library/deleteGame.ts')
  assert.match(main, /setTimeout\(\(\) => \{\n {4}runStorageMaintenance\(/)
  assert.match(main, /\}, 60_000\)\.unref\(\)/)
  assert.match(cacheSource, /utimesSync\(path, now, now\)\n {4}\} catch[\s\S]*?return \{ status: 'hit'/)
  assert.match(ttsCache, /export function audioDataUrl[\s\S]*?utimesSync\(path, now, now\)/)
  assert.match(deleteGame, /removeGameAnalysisCache\(gameId\)\n {2}const removedFile = removeManagedGameFile\(game\)/)
})
