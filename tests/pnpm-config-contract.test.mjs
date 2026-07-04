import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()

test('pnpm build-script approvals are compatible with pnpm 11', () => {
  const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  const workspace = readFileSync(join(root, 'pnpm-workspace.yaml'), 'utf8')

  assert.equal(packageJson.pnpm?.onlyBuiltDependencies, undefined)
  assert.match(workspace, /^allowBuilds:\r?$/m)

  for (const dependency of ['electron', 'electron-winstaller', 'esbuild', 'onnxruntime-node', 'protobufjs', 'sharp']) {
    assert.match(workspace, new RegExp(`^  ${dependency}: true\\r?$`, 'm'), `missing allowBuilds approval for ${dependency}`)
  }

  assert.doesNotMatch(workspace, /set this to true or false/)
})
