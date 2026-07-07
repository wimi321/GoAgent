import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()

function read(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8')
}

test('board workspace supports mouse-wheel move replay without hijacking form controls', () => {
  const app = read('src/renderer/src/App.tsx')

  assert.match(app, /REPLAY_WHEEL_STEP_PX/)
  assert.match(app, /REPLAY_WHEEL_MAX_STEPS_PER_EVENT/)
  assert.match(app, /function isReplayNavigationTarget/)
  assert.match(app, /input, textarea, select, button/)
  assert.match(app, /function normalizedWheelPixels/)
  assert.match(app, /function handleReplayWheel/)
  assert.match(app, /event\.preventDefault\(\)/)
  assert.match(app, /jumpToMoveRef\.current\(nextMove\)/)
  assert.match(app, /<main className="board-workspace" onWheel=\{handleReplayWheel\}>/)
})
