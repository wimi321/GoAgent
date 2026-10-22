import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import { test } from 'node:test'
import { checkReleaseVersion } from '../scripts/check_release_version.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
const version = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version
const workflow = readFileSync(new URL('../.github/workflows/release.yml', import.meta.url), 'utf8').replace(/\r\n/g, '\n')

function job(name) {
  const section = workflow.match(new RegExp(`^  ${name}:\\n([\\s\\S]*?)(?=^  [a-z][a-z-]*:|$(?![\\s\\S]))`, 'm'))
  assert.ok(section, `Missing workflow job ${name}`)
  return section[1]
}

test('release tags must match the package version, including prereleases', () => {
  assert.equal(checkReleaseVersion('refs/tags/v0.4.22', '0.4.22'), true)
  assert.equal(checkReleaseVersion('refs/tags/v0.4.22-rc.1', '0.4.22-rc.1'), true)
  for (const ref of ['refs/tags/v0.4.21', 'refs/tags/0.4.22', 'refs/tags/v0.4.22-rc.1']) {
    assert.throws(() => checkReleaseVersion(ref, '0.4.22'), /does not match/)
  }
  assert.equal(checkReleaseVersion('refs/heads/main', '0.4.22'), false)
})

test('a mismatched tag exits nonzero before release preparation', () => {
  const script = fileURLToPath(new URL('../scripts/check_release_version.mjs', import.meta.url))
  for (const [ref, expectedStatus] of [
    [`refs/tags/v${version}`, 0],
    [`refs/tags/v${version}-wrong-version`, 1],
    ['refs/heads/main', 0]
  ]) {
    const result = spawnSync(process.execPath, [script], {
      cwd: root,
      env: { ...process.env, GITHUB_REF: ref },
      encoding: 'utf8',
      windowsHide: true
    })
    assert.equal(result.status, expectedStatus, result.stderr)
    if (expectedStatus) assert.match(result.stderr, /does not match package.json version/)
  }
})

test('quality checks must succeed before preflight exposes packaging outputs', () => {
  const preflight = job('release-preflight')
  const checks = [
    'node scripts/check_release_version.mjs',
    'pnpm install --frozen-lockfile',
    'pnpm test',
    'pnpm typecheck',
    'pnpm check:teacher-quality',
    'pnpm check:codex-runtime',
    'pnpm check:no-lite-release-assets',
    'pnpm check:nvidia-release-assets',
    'pnpm check:release-notes-i18n'
  ]
  const outputsStep = preflight.indexOf('id: katago-assets')
  assert.ok(outputsStep >= 0)
  for (const command of checks) {
    const offset = preflight.indexOf(command)
    assert.ok(offset >= 0 && offset < outputsStep, `${command} must gate packaging outputs`)
  }
  assert.doesNotMatch(preflight, /^\s*(?:continue-on-error|if):|\|\|\s*(?:true|:)/m)
  for (const name of ['prepare-tts-assets', 'package', 'package-nvidia-windows', 'github-release']) {
    const needs = job(name).match(/^    needs:(.*(?:\n      - .*)*)/m)
    assert.ok(needs?.[1].includes('release-preflight'), `${name} must depend on release preflight`)
  }
})

test('the actual publish condition blocks failed, cancelled or skipped gates', () => {
  const rawCondition = job('github-release').match(/^    if: (.+)$/m)?.[1]
  assert.ok(rawCondition)
  // Evaluate the workflow's expression with Actions-compatible values, including
  // the always() that otherwise lets a job run after a failed dependency.
  const condition = rawCondition.replace(/needs\.([a-z][a-z-]*)\./g, 'needs["$1"].')
  function canPublish(results = {}, ref = `refs/tags/v${version}`, outputs = {}) {
    const needs = Object.fromEntries(['release-preflight', 'package', 'package-nvidia-windows'].map(name => [name, {
      result: results[name] ?? 'success',
      outputs: { 'can-package': 'true', 'can-package-nvidia': 'true', ...outputs }
    }]))
    // Hyphenated output names use the same property syntax as job identifiers.
    const expression = condition.replace(/\.outputs\.([a-z][a-z-]*)/g, '.outputs["$1"]')
    return runInNewContext(expression, {
      needs,
      github: { ref },
      always: () => true,
      startsWith: (value, prefix) => value.startsWith(prefix)
    }, { timeout: 1000 })
  }
  assert.equal(canPublish(), true)
  for (const name of ['release-preflight', 'package', 'package-nvidia-windows']) {
    for (const result of ['failure', 'cancelled', 'skipped']) {
      assert.equal(canPublish({ [name]: result }), false, `${name} ${result} must block publication`)
    }
  }
  assert.equal(canPublish({}, 'refs/heads/main'), false)
  assert.equal(canPublish({}, undefined, { 'can-package': 'false' }), false)
  assert.equal(canPublish({}, undefined, { 'can-package-nvidia': 'false' }), false)
})

test('both Windows installer checks gate artifact upload and preserve failure evidence', () => {
  for (const [name, suffix, edition] of [
    ['package', '', 'standard'],
    ['package-nvidia-windows', '-nvidia', 'nvidia']
  ]) {
    const content = job(name)
    const steps = content.split(/^      - name: /m).slice(1)
    const checkIndex = steps.findIndex(step => step.includes('./scripts/smoke_windows_installer.ps1'))
    const uploadIndex = steps.findIndex(step => /^Upload (?:NVIDIA )?packaged artifacts\n/.test(step))
    assert.ok(checkIndex >= 0 && checkIndex < uploadIndex, `${name} must validate its actual installer before upload`)
    const check = steps[checkIndex]
    assert.match(check, /^        shell: pwsh$/m)
    assert.ok(check.includes(`-Installer "release/$version/GoAgent-$version-win-x64${suffix}.exe"`))
    assert.ok(check.includes('-ExpectedDir "release/$version/win-unpacked"'))
    assert.ok(check.includes(`-EvidencePath "release-evidence/windows-${edition}-installer.json"`))
    assert.match(check, /if \(\$LASTEXITCODE -ne 0\) \{ throw /)
    assert.doesNotMatch(check, /continue-on-error:|if:.*(?:always\(|failure\()/)
    if (edition === 'standard') assert.match(check, /^        if: runner.os == 'Windows'$/m)

    const evidence = steps[checkIndex + 1]
    assert.match(evidence, /^        if: always\(\)/m)
    assert.match(evidence, /uses: actions\/upload-artifact@v4/)
    assert.ok(evidence.includes(`path: release-evidence/windows-${edition}-installer.json`))
    // Uploading evidence after a failure must not make package upload succeed.
    assert.doesNotMatch(steps[uploadIndex], /^        (?:if:|continue-on-error:)/m)
    assert.doesNotMatch(content, /^    continue-on-error:/m)
  }
})
