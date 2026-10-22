import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { withPrimaryOwnershipOnly } from '../src/shared/analysisOwnership.ts'
import { createLatestThrottle } from '../src/renderer/src/features/timeline/progressThrottle.ts'

const ownership = Array.from({ length: 361 }, () => 0.5)

test('progress updates keep only the ownership maps that are read', () => {
  const analysis = {
    playedMove: { move: 'q16' },
    before: {
      ownership,
      topMoves: [
        { move: 'D4', ownership, ownershipStdev: ownership },
        { move: 'C3', ownership },
        { move: 'Q16', ownership }
      ]
    },
    after: { ownership, topMoves: [{ move: 'R17', ownership }, { move: 'R16', ownership }] }
  }
  const trimmed = withPrimaryOwnershipOnly(analysis)

  assert.equal(trimmed.before.ownership, ownership, 'root ownership feeds the territory judgement')
  assert.equal(trimmed.before.topMoves[0].ownership, ownership, 'best candidate feeds the teacher trace')
  assert.equal(trimmed.before.topMoves[0].ownershipStdev, ownership)
  assert.equal(trimmed.before.topMoves[1].ownership, undefined)
  assert.equal(trimmed.before.topMoves[2].ownership, ownership, 'the played move is matched case-insensitively')
  assert.equal(trimmed.after.topMoves[0].ownership, ownership)
  assert.equal(trimmed.after.topMoves[1].ownership, undefined)
  assert.equal(analysis.before.topMoves[1].ownership, ownership, 'the input is not mutated')
})

test('the latest-value throttle applies the newest value once per interval and flushes finals at once', async () => {
  const applied = []
  const throttle = createLatestThrottle((value) => applied.push(value), 60)
  throttle.push(1)
  await new Promise((resolve) => setTimeout(resolve, 5))
  throttle.push(2)
  throttle.push(3)
  assert.deepEqual(applied, [1], 'the first value applies immediately')
  await new Promise((resolve) => setTimeout(resolve, 250))
  assert.deepEqual(applied, [1, 3], 'intermediate values are dropped')
  throttle.push(4)
  throttle.push(5, true)
  assert.deepEqual(applied, [1, 3, 5], 'an immediate value replaces the pending one')
  throttle.push(6)
  throttle.dispose()
  await new Promise((resolve) => setTimeout(resolve, 250))
  assert.deepEqual(applied, [1, 3, 5], 'dispose drops the pending value')
})

async function source(path) {
  return (await readFile(new URL(`../${path}`, import.meta.url), 'utf8')).replace(/\r\n/g, '\n')
}

test('foreground live analysis caps the forced played-move search and trims progress', async () => {
  const katago = await source('src/main/services/katago.ts')
  assert.match(katago, /foregroundLiveSearch \? FORCED_ACTUAL_EVIDENCE_MIN_VISITS : forcedActualVisits\(maxVisits, FORCED_ACTUAL_EVIDENCE_MIN_VISITS\)/)
  assert.equal((katago.match(/onProgress\?\.\(isFinal \? partial : withPrimaryOwnershipOnly\(partial\), isFinal\)/g) ?? []).length, 2)
})

test('the board, graph, library and teacher panel only re-render for their own props', async () => {
  const app = await source('src/renderer/src/App.tsx')
  for (const name of ['LibraryPanel', 'TimelineIssueList', 'TeacherPanel', 'TeacherInlineResponse', 'GoBoardV2', 'WinrateTimelineV2']) {
    assert.match(app, new RegExp(`const ${name}Memo = memo\\(${name}\\)`))
    assert.match(app, new RegExp(`<${name}Memo\\b`))
  }
  assert.doesNotMatch(app, /evaluations=\{Object\.values\(evaluations\)\}/)
  assert.match(app, /onDesktopCommand\?\.\(\(command\) => handleDesktopCommand\(command\)\)\n {4}return \(\) => dispose\?\.\(\)\n {2}\}, \[handleDesktopCommand\]\)/)
  assert.match(app, /if \(isCurrentLiveProgress\(progress\)\) searchProgressThrottle\.push\(progress\)/)
  assert.match(app, /progressThrottle\.push\(progress, progress\.isFinal\)/)
  assert.match(app, /if \(!deltaFrame\) deltaFrame = requestAnimationFrame\(flushDelta\)/)
  assert.match(app, /if \(followThreadRef\.current\) threadBottomRef\.current\?\.scrollIntoView/)
  assert.match(app, /Object\.values\(evaluations\)\.map\(withPrimaryOwnershipOnly\)/)
})
