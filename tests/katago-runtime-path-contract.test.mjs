import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()

function read(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8')
}

test('KataGo runtime never resolves bundled executables from inside app.asar', () => {
  const runtime = read('src/main/services/katagoRuntime.ts')

  assert.match(runtime, /function isAsarPath\(path: string\): boolean/)
  assert.match(runtime, /normalized\.includes\('\/app\.asar\/'\) \|\| normalized\.endsWith\('\/app\.asar'\)/)
  assert.match(runtime, /function probeKataGoBinary\(path: string\)/)
  assert.match(runtime, /execFileSync\(path, \['version'\]/)
  assert.match(runtime, /跳过无法启动的 KataGo/)
  assert.match(runtime, /return unique\(roots\)\.filter\(\(root\) => !isAsarPath\(root\)\)/)
})

test('KataGo runtime prioritizes unpacked Windows portable resources over source-tree asar paths', () => {
  const runtime = read('src/main/services/katagoRuntime.ts')
  const resourcesIndex = runtime.indexOf("join(process.resourcesPath, 'data', 'katago')")
  const unpackedIndex = runtime.indexOf("join(process.resourcesPath, 'app.asar.unpacked', 'data', 'katago')")
  const cwdIndex = runtime.indexOf("join(process.cwd(), 'data', 'katago')")
  const dirnameIndex = runtime.indexOf("join(__dirname, '../../data/katago')")

  assert.notEqual(resourcesIndex, -1)
  assert.notEqual(unpackedIndex, -1)
  assert.notEqual(cwdIndex, -1)
  assert.notEqual(dirnameIndex, -1)
  assert.ok(resourcesIndex < cwdIndex, 'packaged resources/data/katago should be checked before source-tree fallback')
  assert.ok(unpackedIndex < cwdIndex, 'packaged app.asar.unpacked/data/katago should be checked before source-tree fallback')
  assert.ok(cwdIndex < dirnameIndex, '__dirname fallback should remain last because it can point inside app.asar')
})
