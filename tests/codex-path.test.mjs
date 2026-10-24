import assert from 'node:assert/strict'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { runInNewContext } from 'node:vm'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { findCodexOnPath } from '../src/main/services/llm/codexPath.ts'

// Exercise the production selection logic without starting Electron or reading
// credentials. Runtime discovery is stubbed so the default cannot silently
// acquire a dependency on the developer machine's PATH.
const source = readFileSync(new URL('../src/main/services/llm/codexAppServerClient.ts', import.meta.url), 'utf8')
const resolverSource = stripTypeScriptTypes(source.slice(
  source.indexOf('export function resolveCodexExecutable('),
  source.indexOf('\nfunction startupError(')
).replace('export function', 'function'))

function resolver({ system = '/system/codex', envPath, packaged = '/bundled/codex' } = {}) {
  let searches = 0
  const resolve = runInNewContext(`${resolverSource}\nresolveCodexExecutable`, {
    process: { env: { GOAGENT_CODEX_BIN: envPath } },
    existsSync: () => true,
    findCodexOnPath: () => { searches++; return system },
    packagedCodexExecutable: () => packaged,
    bundledCodexExecutable: () => '/dev/codex'
  })
  return { resolve, searches: () => searches }
}

test('existing settings never search PATH; opting in enables discovery and fallback', () => {
  const runtime = resolver()
  assert.equal(runtime.resolve(), '/bundled/codex')
  assert.equal(runtime.resolve('', false), '/bundled/codex')
  assert.equal(runtime.searches(), 0)
  assert.equal(runtime.resolve('', true), '/system/codex')
  assert.equal(runtime.searches(), 1)
  assert.equal(resolver({ system: null }).resolve('', true), '/bundled/codex')
  assert.equal(resolver({ system: null, packaged: null }).resolve('', true), '/dev/codex')
})

test('explicit settings and environment overrides take precedence over opted-in PATH', () => {
  const runtime = resolver({ envPath: '/environment/codex' })
  assert.equal(runtime.resolve('/chosen/codex', true), '/chosen/codex')
  assert.equal(runtime.resolve('', true), '/environment/codex')
  assert.equal(runtime.searches(), 0)
})

test('PATH discovery respects ordering, quoted paths, and missing commands', () => {
  const root = mkdtempSync(join(tmpdir(), 'goagent-path-'))
  try {
    const first = join(root, 'first folder')
    const second = join(root, 'second')
    mkdirSync(first)
    mkdirSync(second)
    writeFileSync(join(first, 'codex.exe'), '')
    writeFileSync(join(second, 'codex.exe'), '')
    assert.equal(findCodexOnPath(`"${first}";${second}`, 'win32'), join(first, 'codex.exe'))
    assert.equal(findCodexOnPath(`${second};${first}`, 'win32'), join(second, 'codex.exe'))
    assert.equal(findCodexOnPath(`${root};.;`, 'win32'), null)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('Windows npm shim resolves to its native payload without a command shell', () => {
  const root = mkdtempSync(join(tmpdir(), 'goagent-npm-path-'))
  try {
    writeFileSync(join(root, 'codex.cmd'), '@echo off')
    assert.equal(findCodexOnPath(root, 'win32', 'x64'), null)
    const pkg = join(root, 'node_modules', '@openai', 'codex')
    const native = join(pkg, 'vendor', 'x86_64-pc-windows-msvc', 'bin', 'codex.exe')
    mkdirSync(join(native, '..'), { recursive: true })
    writeFileSync(join(pkg, 'package.json'), '{"name":"@openai/codex"}')
    writeFileSync(native, '')
    assert.equal(findCodexOnPath(root, 'win32', 'x64'), native)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('Unix PATH discovery requires an executable file', { skip: process.platform === 'win32' }, () => {
  const root = mkdtempSync(join(tmpdir(), 'goagent-unix-path-'))
  try {
    const file = join(root, 'codex')
    writeFileSync(file, '#!/bin/sh\n')
    chmodSync(file, 0o644)
    assert.equal(findCodexOnPath(root, process.platform), null)
    chmodSync(file, 0o755)
    assert.equal(findCodexOnPath(root, process.platform), file)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
