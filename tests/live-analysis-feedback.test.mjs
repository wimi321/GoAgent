import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import {
  createKataGoSearchProgressTracker,
  kataGoResponseVisits,
  onlyKataGoSearchProgressFor
} from '../src/main/services/analysis/searchTelemetry.ts'

const repoRoot = new URL('..', import.meta.url)
const text = (path) => readFile(new URL(path, repoRoot), 'utf8')

test('live search telemetry derives visits per second from cumulative KataGo responses', () => {
  let sampledAt = 1_000
  const events = []
  const tracker = createKataGoSearchProgressTracker((progress) => events.push(progress), () => sampledAt)

  sampledAt += 200
  tracker.observe({ id: 'position', isDuringSearch: true, moveInfos: [{ visits: 70 }, { visits: 30 }] })
  sampledAt += 200
  tracker.observe({ id: 'position', isDuringSearch: true, moveInfos: [{ visits: 112 }, { visits: 48 }] })
  sampledAt += 200
  tracker.observe({ id: 'position', isDuringSearch: false, moveInfos: [{ visits: 182 }, { visits: 78 }] })

  assert.equal(events.length, 3)
  assert.equal(events[0].visits, 100)
  assert.equal(Math.round(events[0].visitsPerSecond), 500)
  assert.equal(Math.round(events[1].visitsPerSecond), 424)
  assert.equal(Math.round(events[2].visitsPerSecond), 453)
  assert.equal(events[2].isDuringSearch, false)
})

test('live search telemetry prefers the engine root visit count when available', () => {
  assert.equal(kataGoResponseVisits({
    rootInfo: { visits: 720 },
    moveInfos: [{ visits: 420 }, { visits: 180 }]
  }), 720)
})

test('batched telemetry measures each serial query from its own start', () => {
  let sampledAt = 1_000
  const events = []
  const tracker = createKataGoSearchProgressTracker(
    (progress) => events.push(progress),
    () => sampledAt,
    ['baseline', 'primary']
  )

  sampledAt += 200
  tracker.observe({ id: 'baseline', isDuringSearch: false, rootInfo: { visits: 40 } })
  sampledAt += 200
  tracker.observe({ id: 'primary', isDuringSearch: true, rootInfo: { visits: 100 } })

  assert.equal(Math.round(events[0].visitsPerSecond), 200)
  assert.equal(Math.round(events[1].visitsPerSecond), 500)
})

test('foreground telemetry only exposes the primary candidate search', () => {
  const events = []
  const reportPrimary = onlyKataGoSearchProgressFor('before-position', (progress) => events.push(progress))

  reportPrimary?.({ id: 'after-position', visits: 64, visitsPerSecond: 320, isDuringSearch: false })
  reportPrimary?.({ id: 'before-position', visits: 120, visitsPerSecond: 600, isDuringSearch: true })
  reportPrimary?.({ id: 'actual-move', visits: 96, visitsPerSecond: 480, isDuringSearch: false })

  assert.deepEqual(events.map((event) => event.id), ['before-position'])
})

test('manual live analysis bypasses cache and foreground work preempts the graph sweep', async () => {
  const app = await text('src/renderer/src/App.tsx')
  const runtime = await text('src/main/services/analysis/runtimeIntegration.ts')
  const katago = await text('src/main/services/katago.ts')
  const persistent = await text('src/main/services/katagoPersistentEngine.ts')
  const types = await text('src/main/lib/types.ts')
  const preload = await text('src/preload/index.ts')

  assert.match(types, /bypassCache\?: boolean/)
  assert.match(runtime, /fresh streaming analysis requested; cache lookup bypassed/)
  assert.match(app, /bypassCache: forceManualRefresh/)
  assert.match(app, /await cancelKataGoWork\(\{ group: 'quick' \}\)/)
  assert.match(app, /liveAnalysis\.running && liveAnalysis\.visitsPerSecond > 0/)
  assert.match(app, /let trialSpeedSample = 0/)
  assert.match(app, /status: progress\.isDuringSearch\s*\? `试下搜索/)
  assert.match(app, /disposeSearchProgress\(\)/)
  assert.match(app, /k v\/s/)
  assert.match(app, /v\/s/)
  assert.match(preload, /Promise<KataGoMoveAnalysis \| null>/)
  assert.match(katago, /createKataGoSearchProgressTracker/)
  assert.match(katago, /onlyKataGoSearchProgressFor\(beforeId/)
  assert.match(katago, /progressTracker\.observe\(response\)/)
  assert.match(katago, /foregroundLiveSearch\s*\? \[afterQuery, beforeQuery\]/)
  assert.match(katago, /Math\.max\(24, Math\.min\(64, Math\.round\(maxVisits \* 0\.01\)\)\)/)
  assert.match(katago, /if \(latestBefore\?\.rootInfo && latestAfter\?\.rootInfo\)/)
  assert.match(persistent, /action: 'terminate'/)
  assert.match(persistent, /terminateId: queryId/)
  assert.match(persistent, /const wireId = `\$\{batchId\}:\$\{index\}`/)
  assert.match(persistent, /const normalizedResponse = \{ \.\.\.response, id: originalId \}/)
  assert.match(persistent, /restart.*failed query termination/i)
})
