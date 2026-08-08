import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const root = process.cwd()
const read = (path) => readFile(`${root}/${path}`, 'utf8')

test('macOS release notarizes and verifies apps and final DMGs before upload', async () => {
  const workflow = await read('.github/workflows/release.yml')
  const notarizeStep = workflow.indexOf('name: Notarize final macOS disk images')
  const verifyStep = workflow.indexOf('name: Verify macOS signing and notarization')
  const uploadStep = workflow.indexOf('name: Upload packaged artifacts')

  assert.ok(notarizeStep >= 0)
  assert.ok(verifyStep > notarizeStep)
  assert.ok(uploadStep > verifyStep)
  assert.match(workflow, /xcrun notarytool submit/)
  assert.match(workflow, /report\.status !== "Accepted"/)
  assert.match(workflow, /xcrun stapler staple "\$dmg"/)
  assert.match(workflow, /codesign --verify --deep --strict/)
  assert.match(workflow, /spctl --assess --type execute/)
  assert.match(workflow, /xcrun stapler validate/)
  assert.match(workflow, /spctl --assess --type open --context context:primary-signature/)
  assert.match(workflow, /hdiutil verify/)
})

test('current download documentation does not claim macOS is unnotarized', async () => {
  const readmes = await Promise.all([
    'README.md',
    'README_EN.md',
    'README_JA.md',
    'README_KO.md',
    'README_TH.md',
    'README_VI.md'
  ].map(read))

  for (const readme of readmes) {
    assert.match(readme, /v0\.4\.20/)
    assert.match(readme, /notari/i)
    assert.doesNotMatch(readme, /v0\.4\.(?:1|8)\//)
  }

  assert.doesNotMatch(readmes[0], /暂未完成 notarization/)
  assert.doesNotMatch(readmes[1], /not yet Developer ID signed or notarized/)
})
