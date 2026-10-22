import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const scriptPath = fileURLToPath(new URL('../scripts/smoke_windows_installer.ps1', import.meta.url))
const quote = value => `'${value.replaceAll("'", "''")}'`
const windowsOnly = { skip: process.platform !== 'win32' }

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'goagent 安装 unit '))
  t.after(() => rm(root, { recursive: true, force: true }))
  return root
}

function helper(body) {
  // Load function definitions from the real script without invoking its installer.
  const command = `
    $ErrorActionPreference = 'Stop'
    [Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
    $tokens = $null; $errors = $null
    $ast = [Management.Automation.Language.Parser]::ParseFile(${quote(scriptPath)}, [ref]$tokens, [ref]$errors)
    if ($errors.Count) { throw ($errors | Out-String) }
    foreach ($fn in $ast.FindAll({ param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] }, $true)) {
      Invoke-Expression $fn.Extent.Text
    }
    ${body}
  `
  const result = spawnSync('pwsh', ['-NoProfile', '-NonInteractive', '-Command', command], {
    encoding: 'utf8', timeout: 20_000, windowsHide: true
  })
  assert.equal(result.status, 0, result.stderr || result.error?.message)
  return JSON.parse(result.stdout.trim())
}

test('installer integrity detects missing DLLs and changed bytes while allowing its extra uninstaller', windowsOnly, async (t) => {
  const root = await fixture(t)
  const expected = join(root, 'expected'), actual = join(root, '安装 GoAgent')
  await mkdir(expected); await mkdir(actual)
  await writeFile(join(expected, 'GoAgent.exe'), 'same executable')
  await writeFile(join(actual, 'GoAgent.exe'), 'same executable')
  await writeFile(join(expected, 'missing.dll'), 'required DLL')
  await writeFile(join(expected, 'changed.dll'), 'expected content')
  await writeFile(join(actual, 'changed.dll'), 'different content')
  await writeFile(join(actual, 'Uninstall GoAgent.exe'), 'uninstaller')
  const result = helper(`Compare-InstallFiles -Expected ${quote(expected)} -Actual ${quote(actual)} | ConvertTo-Json -Depth 5`)
  assert.equal(result.ok, false)
  assert.equal(result.expectedFileCount, 3)
  assert.equal(result.matchedFileCount, 1)
  assert.deepEqual(result.missingFiles, ['missing.dll'])
  assert.deepEqual(result.changedFiles, ['changed.dll'])
  assert.deepEqual(result.extraFiles, ['Uninstall GoAgent.exe'])
  assert.match(result.files.find(file => file.path === 'GoAgent.exe').actualSha256, /^[A-F0-9]{64}$/)
  await writeFile(join(actual, 'missing.dll'), 'required DLL')
  await writeFile(join(actual, 'changed.dll'), 'expected content')
  const repaired = helper(`Compare-InstallFiles -Expected ${quote(expected)} -Actual ${quote(actual)} | ConvertTo-Json -Depth 5`)
  assert.equal(repaired.ok, true)
  assert.equal(repaired.matchedFileCount, 3)
})

test('installer cleanup guard rejects root, traversal, sibling-prefix and junction targets', windowsOnly, async (t) => {
  const root = await fixture(t)
  const owned = join(root, 'owned'), outside = join(root, 'outside'), child = join(owned, '安装 GoAgent')
  await mkdir(owned); await mkdir(outside); await mkdir(child)
  const junction = join(owned, 'redirect')
  await symlink(outside, junction, 'junction')
  const paths = [owned, join(owned, '..', 'outside'), `${owned}-sibling`, join(junction, 'GoAgent.exe')]
  const result = helper(`
    $allowed = Assert-WithinTestRoot -Path ${quote(child)} -TestRoot ${quote(owned)}
    $rejected = @(foreach ($path in @(${paths.map(quote).join(',')})) {
      try { [void](Assert-WithinTestRoot -Path $path -TestRoot ${quote(owned)}); $false } catch { $true }
    })
    @{ allowed = $allowed; rejected = $rejected } | ConvertTo-Json
  `)
  assert.equal(result.allowed, child)
  assert.deepEqual(result.rejected, [true, true, true, true])
})
