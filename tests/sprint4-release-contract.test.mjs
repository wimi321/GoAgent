import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()

function read(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8')
}

test('Sprint 4 UI interaction files exist', () => {
  for (const relativePath of [
    'src/renderer/src/features/board/CandidateTooltip.tsx',
    'src/renderer/src/features/board/KeyMoveNavigator.tsx',
    'src/renderer/src/features/board/timelineInteraction.ts',
    'src/renderer/src/features/teacher/TeacherKeyMoveActions.tsx',
    'src/renderer/src/features/release/BetaAcceptancePanel.tsx',
    'src/main/services/release/packageRuntime.ts'
  ]) {
    assert.equal(existsSync(join(root, relativePath)), true, `${relativePath} should exist`)
  }
})

test('Candidate tooltip exposes PV continuation context', () => {
  const tooltip = read('src/renderer/src/features/board/CandidateTooltip.tsx')
  const styles = read('src/renderer/src/features/board/sprint4-board.css')
  assert.match(tooltip, /candidate-tooltip__pv/)
  assert.match(tooltip, /candidate\.pv/)
  assert.match(styles, /candidate-tooltip__pv/)
})

test('Sprint 4 scripts exist', () => {
  assert.equal(existsSync(join(root, 'scripts/p0_beta_acceptance.mjs')), true)
  assert.equal(existsSync(join(root, 'scripts/package_artifact_smoke.mjs')), true)
  assert.equal(existsSync(join(root, 'scripts/smoke_windows_packaged_app.mjs')), true)
})

test('Windows portable release artifact is a ZIP, not a portable EXE', () => {
  const packageJson = JSON.parse(read('package.json'))
  const targets = packageJson.build.win.target.map((entry) => entry.target)
  assert.equal(targets.includes('zip'), true)
  assert.equal(targets.includes('portable'), false)
  assert.match(packageJson.build.win.artifactName, /portable\.\$\{ext\}/)
})

test('timelineInteraction exports move helpers', () => {
  const text = read('src/renderer/src/features/board/timelineInteraction.ts')
  assert.match(text, /moveFromPointer/)
  assert.match(text, /moveFromTimelineSvgX/)
  assert.match(text, /progressFromMove/)
  assert.match(text, /lossSeverityFromWinrateDrop/)
})

test('Windows release workflow smoke-starts packaged apps before upload', () => {
  const packageJson = JSON.parse(read('package.json'))
  const workflow = read('.github/workflows/release.yml')
  const smoke = read('scripts/smoke_windows_packaged_app.mjs')
  assert.equal(packageJson.scripts['smoke:windows-packaged'], 'node scripts/smoke_windows_packaged_app.mjs')
  assert.match(workflow, /Smoke packaged Windows app/)
  assert.match(workflow, /smoke_windows_packaged_app\.mjs --mode=full --require-katago/)
  assert.match(workflow, /Smoke NVIDIA packaged Windows app/)
  assert.match(workflow, /smoke_windows_packaged_app\.mjs --mode=nvidia --require-katago/)
  assert.match(smoke, /window\.goagent\.getDiagnostics\(\)/)
  assert.match(smoke, /window\.goagent\.inspectKataGoAssets\(\)/)
  assert.match(smoke, /window\.goagent\.getReleaseReadiness\(\)/)
  assert.match(smoke, /--user-data-dir=\$\{electronUserData\}/)
  assert.match(smoke, /--disable-gpu/)
  assert.match(smoke, /--disable-software-rasterizer/)
  assert.match(smoke, /--disable-features=Vulkan/)
})

test('release readiness uses packaged runtime paths and current package version', () => {
  const readiness = read('src/main/services/release/readiness.ts')
  const runtime = read('src/main/services/release/packageRuntime.ts')
  const diagnostics = read('src/main/services/diagnostics/index.ts')
  assert.doesNotMatch(readiness, /0\.2\.0-beta\.1/)
  assert.match(readiness, /inspectPackagedRuntime/)
  assert.match(readiness, /packagedReadiness/)
  assert.match(readiness, /resourcesRoot/)
  assert.match(runtime, /process\.resourcesPath/)
  assert.match(runtime, /app\.asar/)
  assert.match(runtime, /flavor === 'lite'/)
  assert.match(diagnostics, /isLitePackagedRuntime/)
  assert.match(diagnostics, /Lite 安装包不内置 KataGo/)
})

test('Windows packaged startup avoids fragile legacy Electron profile state', () => {
  const index = read('src/main/index.ts')
  const store = read('src/main/lib/store.ts')
  const katagoAssets = read('src/main/services/katago/katagoAssets.ts')
  assert.match(index, /process\.platform === 'win32'/)
  assert.match(index, /GOAGENT_ENABLE_ELECTRON_GPU/)
  assert.match(index, /appendSwitch\('disable-software-rasterizer'\)/)
  assert.match(index, /appendSwitch\('disable-features', 'Vulkan'\)/)
  assert.match(index, /app\.disableHardwareAcceleration\(\)/)
  assert.match(store, /legacyElectronUserData = app\.getPath\('userData'\)/)
  assert.match(store, /electronUserData = .*electron-user-data/)
  assert.match(store, /app\.setPath\('userData', electronUserData\)/)
  assert.match(katagoAssets, /appHome/)
  assert.match(katagoAssets, /legacyElectronUserData/)
  assert.match(katagoAssets, /join\(appHome, 'katago'\)/)
  assert.match(katagoAssets, /join\(legacyElectronUserData, 'katago'\)/)
})
