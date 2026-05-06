import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()

function read(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8')
}

test('teacher markdown turns move numbers and board coordinates into board actions', () => {
  const app = read('src/renderer/src/App.tsx')
  const styles = read('src/renderer/src/styles.css')

  assert.match(app, /function firstInlineReference/)
  assert.match(app, /第\\s\*\(\\d\{1,4\}\)\\s\*手/)
  assert.match(app, /\\bmove\\s\*#\?\\s\*\(\\d\{1,4\}\)\\b/)
  assert.match(app, /\[A-HJ-Z\]/)
  assert.match(app, /parseBoardPoint\(pointLabel, boardSize\)/)
  assert.match(app, /chat-reference-link--move/)
  assert.match(app, /chat-reference-link--point/)
  assert.match(app, /onJumpToMove\(reference\.moveNumber\)/)
  assert.match(app, /onFlashPoint\(reference\.pointLabel\)/)
  assert.match(app, /t\('jumpToReferencedMove'/)
  assert.match(app, /t\('flashReferencedPoint'/)
  assert.match(styles, /\.chat-reference-link/)
  assert.match(styles, /\.chat-reference-link--point/)
})

test('board exposes a polished coordinate flash layer controlled by the app', () => {
  const app = read('src/renderer/src/App.tsx')
  const board = read('src/renderer/src/features/board/GoBoardV2.tsx')
  const boardCss = read('src/renderer/src/features/board/board-v2.css')

  assert.match(app, /const \[boardFlash, setBoardFlash\]/)
  assert.match(app, /function flashBoardCoordinate/)
  assert.match(app, /boardFlashNonceRef/)
  assert.match(app, /flashPoint=\{boardFlash\}/)
  assert.match(app, /onFlashPoint=\{flashBoardCoordinate\}/)
  assert.match(board, /flashPoint\?: \(BoardPoint & \{ nonce\?: number; label\?: string \}\) \| null/)
  assert.match(board, /function BoardFlashMark/)
  assert.match(board, /ks-board-flash-layer/)
  assert.match(board, /ks-board-flash__halo/)
  assert.match(boardCss, /@keyframes ks-board-flash-halo/)
  assert.match(boardCss, /@keyframes ks-board-flash-ring/)
  assert.match(boardCss, /@keyframes ks-board-flash-label/)
})

test('clickable reference labels are localized across every supported locale', () => {
  const i18n = read('src/renderer/src/i18n.ts')
  assert.match(i18n, /jumpToReferencedMove/)
  assert.match(i18n, /flashReferencedPoint/)
  assert.match(i18n, /Jump to move/)
  assert.match(i18n, /高亮/)
  assert.match(i18n, /強調表示/)
  assert.match(i18n, /강조/)
  assert.match(i18n, /ไฮไลต์/)
  assert.match(i18n, /Tô sáng/)
})
