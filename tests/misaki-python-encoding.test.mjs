import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import ts from 'typescript'

function findPython() {
  const configured = process.env.GOAGENT_TEST_PYTHON
  const candidates = configured ? [configured] : ['python3', 'python']
  for (const command of candidates) {
    const probe = spawnSync(command, ['-c', 'import sys; print(sys.executable)'], {
      encoding: 'utf8', timeout: 10_000, windowsHide: true,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' }
    })
    if (probe.status === 0) return probe.stdout.trim()
  }
  assert.ok(!configured, `GOAGENT_TEST_PYTHON is not executable: ${configured}`)
  return null
}

const python = findPython()

async function bridge(t, script) {
  const root = await mkdtemp(join(tmpdir(), 'goagent 中文 G2P '))
  t.after(() => rm(root, { recursive: true, force: true }))
  const scriptPath = join(root, '中文 注音.py')
  await writeFile(scriptPath, script, 'utf8')
  const source = (await readFile(new URL('../src/main/services/tts/misakiZhG2p.ts', import.meta.url), 'utf8'))
    .replace("import { ensureTtsPythonRuntime, materializeTtsScript } from './ttsPythonRuntime'",
      `const ensureTtsPythonRuntime = async () => ${JSON.stringify(python)}; const materializeTtsScript = async () => ${JSON.stringify(scriptPath)};`)
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 }
  }).outputText
  return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`)
}

async function withLegacyEncoding(action) {
  const previous = { PYTHONIOENCODING: process.env.PYTHONIOENCODING, PYTHONUTF8: process.env.PYTHONUTF8 }
  process.env.PYTHONIOENCODING = 'gbk:strict'
  process.env.PYTHONUTF8 = '0'
  try {
    await action()
    assert.equal(process.env.PYTHONIOENCODING, 'gbk:strict', 'The bridge must not mutate the parent environment')
    assert.equal(process.env.PYTHONUTF8, '0')
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
}

test('Misaki bridge accepts Chinese UTF-8 input and phonemes despite a legacy Windows Python encoding', { skip: !python && 'Python 3 is unavailable' }, async (t) => {
  const { phonemizeChineseWithMisaki } = await bridge(t, `
import json, sys
payload = json.load(sys.stdin)
sys.stderr.reconfigure(errors='strict')
print('中文注音诊断 ❓', file=sys.stderr)
print(json.dumps({'engine': 'misaki.zh.ZHG2P', 'version': '1.1', 'text': payload['text'], 'phonemes': 'ʈʂʰ 中文 ❓', 'unknownCount': 0}, ensure_ascii=False))
`)
  await withLegacyEncoding(async () => {
    const result = await phonemizeChineseWithMisaki('现在复盘第八十七手 ❓', {})
    assert.equal(result.text, '现在复盘第八十七手 ❓')
    assert.equal(result.phonemes, 'ʈʂʰ 中文 ❓')
    assert.equal(result.unknownCount, 0)
  })
})

test('Misaki bridge preserves real Chinese Python stderr on failure under a legacy Windows encoding', { skip: !python && 'Python 3 is unavailable' }, async (t) => {
  const { phonemizeChineseWithMisaki } = await bridge(t, `
import json, sys
json.load(sys.stdin)
sys.stderr.reconfigure(errors='strict')
print('中文注音失败 ❓ 请检查输入', file=sys.stderr)
sys.exit(7)
`)
  await withLegacyEncoding(async () => {
    await assert.rejects(phonemizeChineseWithMisaki('围棋 ❓', {}), { message: '中文注音失败 ❓ 请检查输入' })
  })
})
