import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const root = new URL('..', import.meta.url)

async function text(path) {
  return readFile(new URL(path, root), 'utf8')
}

async function importTypeScript(path) {
  const source = await text(path)
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022
    },
    fileName: path
  }).outputText
  return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`)
}

function analysisFixture(overrides = {}) {
  return {
    gameId: 'game-1',
    moveNumber: 42,
    boardSize: 19,
    currentMove: { moveNumber: 42, color: 'W', point: 'dd', row: 3, col: 3, gtp: 'D16', pass: false },
    before: { winrate: 55, scoreLead: 1.5, topMoves: [{ move: 'Q4', winrate: 55, scoreLead: 1.5, visits: 120, order: 0, prior: 20, pv: [] }] },
    after: { winrate: 48, scoreLead: -0.4, topMoves: [] },
    playedMove: { move: 'D16', winrate: 48, scoreLead: -0.4, visits: 1200, source: 'forced', winrateLoss: 7, scoreLoss: 1.9 },
    judgement: 'mistake',
    analysisQuality: {
      phase: 'opening', totalVisits: 240, bestVisits: 120, actualVisits: 1200,
      candidateSpreadWinrate: 2, candidateSpreadScore: 1, pvStable: true,
      confidence: 'medium', reason: 'fixture', deepenRecommended: true
    },
    moveClassification: {
      severity: 'mistake', confidence: 'medium', phase: 'opening', winrateLoss: 7, scoreLoss: 1.9,
      shouldTeach: true, shouldDeepen: true, reason: 'fixture', evidenceWarnings: []
    },
    ...overrides
  }
}

test('timeline issues require direct, non-low-confidence played-move evidence', async () => {
  const trust = await importTypeScript('src/renderer/src/features/timeline/analysisTrust.ts')
  const verified = analysisFixture()
  assert.equal(trust.assessAnalysisTrust(verified).evidenceState, 'verified')
  assert.equal(trust.analysisDisplaySeverity(verified), 'mistake')
  assert.equal(trust.isVerifiedTimelineIssue(verified), true)

  const provisional = analysisFixture({
    playedMove: { move: 'D16', winrate: 48, scoreLead: -0.4, source: 'after-root', winrateLoss: 28, scoreLoss: 4.5 },
    analysisQuality: { ...analysisFixture().analysisQuality, bestVisits: 24, actualVisits: 0, confidence: 'low' },
    moveClassification: { ...analysisFixture().moveClassification, severity: 'blunder', confidence: 'low', winrateLoss: 28 }
  })
  assert.equal(trust.assessAnalysisTrust(provisional).evidenceState, 'provisional')
  assert.equal(trust.analysisDisplaySeverity(provisional), 'quiet')
  assert.equal(trust.isVerifiedTimelineIssue(provisional), false)
})

test('candidate rank badge follows the side whose values are displayed', async () => {
  const geometry = await importTypeScript('src/renderer/src/features/board/boardGeometry.ts')
  const beforeWhite = analysisFixture()
  assert.equal(geometry.candidatePerspectiveColor(beforeWhite), 'W')
  assert.equal(geometry.candidatePerspectiveColor({ ...beforeWhite, before: { ...beforeWhite.before, topMoves: [] } }), 'B')
  assert.equal(geometry.candidatePerspectiveColor({ ...beforeWhite, trialContext: { active: true, nextColor: 'B' } }), 'B')

  const board = await text('src/renderer/src/features/board/GoBoardV2.tsx')
  const css = await text('src/renderer/src/features/board/board-v2.css')
  assert.match(board, /candidatePerspectiveColor\(analysis\)/)
  assert.match(board, /ks-candidate-perspective--\$\{perspectiveColor\}/)
  assert.match(css, /\.ks-candidate-perspective--W \.ks-candidate-rank-badge/)
})

test('quick analysis and visible review UI share the evidence-aware classification contract', async () => {
  const katago = await text('src/main/services/katago.ts')
  const app = await text('src/renderer/src/App.tsx')
  const timeline = await text('src/renderer/src/features/board/WinrateTimelineV2.tsx')
  assert.match(katago, /analysisQuality: buildAnalysisQuality\(moveNumber, currentMove, beforeTopMoves, forcedActual\)/)
  assert.match(katago, /QUICK_ANALYSIS_REFINE_VISITS = 180/)
  assert.match(app, /isVerifiedTimelineIssue\(item, TIMELINE_ISSUE_MIN_LOSS\)/)
  assert.match(app, /return analysisDisplaySeverity\(item\)/)
  assert.match(app, /ANALYSIS_CACHE_SCHEMA_VERSION = 'v6-evidence-aware-issues'/)
  assert.match(timeline, /analysisDisplaySeverity\(item\)/)
})

test('UI Gallery capture builds and self-hosts the current renderer', async () => {
  const script = await text('scripts/capture_ui_gallery.mjs')
  const docs = await text('docs/VISUAL_QA_CAPTURE.md')
  const pkg = JSON.parse(await text('package.json'))
  assert.equal(pkg.scripts['capture:ui-gallery'], 'node scripts/capture_ui_gallery.mjs')
  assert.match(script, /startRendererServer/)
  assert.match(script, /server\.listen\(0, '127\.0\.0\.1'/)
  assert.match(script, /await run\('pnpm', \['build'\]/)
  assert.match(script, /GOAGENT_BROWSER_PATH/)
  assert.match(docs, /pnpm capture:ui-gallery/)
})
