import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import test from 'node:test'
import { checkWindowsRuntimeDependencies, isWindowsSystemDependency, peImports } from '../scripts/lib/windows_pe_dependencies.mjs'

function fixture({ imports = [], delays = [] } = {}) {
  const b = Buffer.alloc(4096)
  b.write('MZ'); b.writeUInt32LE(0x80, 0x3c); b.write('PE\0\0', 0x80)
  b.writeUInt16LE(0x8664, 0x84); b.writeUInt16LE(1, 0x86); b.writeUInt16LE(240, 0x94)
  b.writeUInt16LE(0x20b, 0x98)
  const section = 0x98 + 240
  b.writeUInt32LE(3072, section + 8); b.writeUInt32LE(0x1000, section + 12)
  b.writeUInt32LE(3072, section + 16); b.writeUInt32LE(0x400, section + 20)
  let strings = 0x900
  const build = (names, index, raw, stride, nameOffset) => {
    if (!names.length) return
    b.writeUInt32LE(0x1000 + raw - 0x400, 0x98 + 112 + index * 8)
    names.forEach((name, i) => {
      if (index === 13) b.writeUInt32LE(1, raw + stride * i)
      b.writeUInt32LE(0x1000 + strings - 0x400, raw + stride * i + nameOffset)
      b.write(name, strings); strings += name.length + 1
    })
  }
  build(imports, 1, 0x400, 20, 12); build(delays, 13, 0x600, 32, 4)
  return b
}
async function temp(t) {
  const root = await mkdtemp(join(tmpdir(), 'goagent-pe-test-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  return root
}
test('reads normal and delay imports, rejecting malformed or wrong-architecture PE', () => {
  assert.deepEqual(peImports(fixture({ imports: ['KERNEL32.dll'], delays: ['nvrtc64_120_0.dll'] })), ['KERNEL32.dll', 'nvrtc64_120_0.dll'])
  const x86 = fixture(); x86.writeUInt16LE(0x14c, 0x84)
  assert.throws(() => peImports(x86), /Expected x64/)
  assert.throws(() => peImports(Buffer.from('not a PE')), /Not a PE/)
})
test('rejects a missing transitive CUDA dependency instead of consulting host PATH', async (t) => {
  const root = await temp(t)
  await writeFile(join(root, 'katago.exe'), fixture({ imports: ['cudnn64_9.dll'] }))
  await writeFile(join(root, 'cudnn64_9.dll'), fixture({ delays: ['nvrtc64_120_0.dll'] }))
  assert.equal(isWindowsSystemDependency('nvrtc64_120_0.dll'), false)
  assert.equal(isWindowsSystemDependency('cublas64_12.dll'), false)
  await assert.rejects(checkWindowsRuntimeDependencies(root), /cudnn64_9.dll -> nvrtc64_120_0.dll/)
})
test('resolves case-insensitive local import cycles and OS/API-set dependencies', async (t) => {
  const root = await temp(t)
  await writeFile(join(root, 'katago.exe'), fixture({ imports: ['HELPER.dll', 'api-ms-win-crt-runtime-l1-1-0.dll'] }))
  await writeFile(join(root, 'helper.DLL'), fixture({ imports: ['katago.exe.dll', 'KERNEL32.dll'] }))
  await writeFile(join(root, 'katago.exe.dll'), fixture({ imports: ['helper.dll'] }))
  const report = await checkWindowsRuntimeDependencies(root)
  assert.equal(report.checkedBinaries.length, 3)
})
test('requires dynamic NVRTC builtins even when the PE import graph is satisfied', async (t) => {
  const root = await temp(t)
  await writeFile(join(root, 'katago.exe'), fixture())
  await assert.rejects(checkWindowsRuntimeDependencies(root, { nvidia: true }), /Missing bundled NVRTC component/)
  await writeFile(join(root, 'nvrtc64_120_0.dll'), Buffer.from('wrong component'))
  await assert.rejects(checkWindowsRuntimeDependencies(root, { nvidia: true }), /Bundled NVRTC hash mismatch/)
})
test('preparation rejects a tampered offline archive before copying any DLL', { skip: process.platform !== 'win32' }, async (t) => {
  const root = await temp(t), runtime = join(root, 'runtime'), archive = join(root, 'bad.zip')
  await mkdir(runtime)
  await writeFile(join(runtime, 'katago.exe'), fixture())
  await writeFile(archive, 'tampered archive')
  await assert.rejects(promisify(execFile)(process.execPath, ['scripts/prepare_nvidia_nvrtc.mjs', `--runtime-dir=${runtime}`, `--archive=${archive}`]), /SHA-256 mismatch/)
  await assert.rejects(readFile(join(runtime, 'nvrtc64_120_0.dll')), { code: 'ENOENT' })
})
