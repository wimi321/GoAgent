import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { join } from 'node:path'

const root = process.cwd()

test('release workflow publishes a real Windows NVIDIA edition', () => {
  const workflow = readFileSync(join(root, '.github', 'workflows', 'release.yml'), 'utf8')

  assert.match(workflow, /package-nvidia-windows:/)
  assert.match(workflow, /wimi321\/lizzieyzy-next/)
  assert.match(workflow, /\*windows64\.nvidia\.portable\.zip/)
  assert.match(workflow, /--copy-runtime-dir/)
  assert.match(workflow, /--preserve-model-name/)
  assert.match(workflow, /GoMentor-\*-win-x64-nvidia-portable\.zip/)
  assert.match(workflow, /GoMentor-\*-win-x64-nvidia\.exe/)
})

test('KataGo asset preparation can scan and copy a runtime directory', () => {
  const prepareScript = readFileSync(join(root, 'scripts', 'prepare_katago_assets.mjs'), 'utf8')

  assert.match(prepareScript, /function hasFlag/)
  assert.match(prepareScript, /async function findRuntimeBinary/)
  assert.match(prepareScript, /async function copyRuntimeDirectory/)
  assert.match(prepareScript, /preserve-model-name/)
  assert.match(prepareScript, /edition\.json/)
})
