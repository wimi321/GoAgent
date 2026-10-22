import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname } from 'node:path'
import test from 'node:test'
import { runInNewContext } from 'node:vm'

const require = createRequire(import.meta.url)
const builderRequire = createRequire(require.resolve('electron-builder/package.json'))
const signerPath = builderRequire.resolve('app-builder-lib/out/codeSign/macCodeSign.js')
const signerRequire = createRequire(signerPath)
const signerSource = readFileSync(signerPath, 'utf8')

// Exercise the installed, pnpm-patched module, not a copy of its implementation.
// Backport: https://github.com/electron-userland/electron-builder/pull/10101
// No real certificates, macOS keychains, filesystem writes or security processes.
function signerHarness(rejectCommand) {
  const calls = []
  const keychains = new Map()
  const exec = async (file, rawArgs) => {
    assert.equal(file, '/usr/bin/security')
    const args = Array.from(rawArgs)
    calls.push(args)
    const command = args[0]
    if (command === rejectCommand) throw new Error(`security ${command} rejected`)
    const keychain = args.at(-1)
    if (command === 'create-keychain') keychains.set(keychain, flag(args, '-p'))
    if (command === 'unlock-keychain' || command === 'set-key-partition-list') {
      const password = flag(args, command === 'unlock-keychain' ? '-p' : '-k')
      if (!keychains.has(keychain) || password !== keychains.get(keychain)) {
        throw new Error('security rejected the incorrect keychain password')
      }
    }
    return ''
  }
  const mockRequire = name => {
    if (name === 'builder-util') return { ...signerRequire(name), exec }
    if (name === './codesign') return { importCertificate: async link => link }
    return signerRequire(name)
  }
  const module = { exports: {} }
  const evaluate = runInNewContext(`(function (exports, require, module, __filename, __dirname) {\n${signerSource}\n})`, {
    // Skip the unrelated bundled root-certificate copy; all keychain commands
    // still execute through the password-validating mock above.
    process: { env: { TRAVIS: 'true' }, platform: 'darwin' }
  }, { filename: signerPath, timeout: 1000 })
  evaluate(module.exports, mockRequire, module, signerPath, dirname(signerPath))
  return { createKeychain: module.exports.createKeychain, calls }
}

function flag(args, name) {
  const index = args.indexOf(name)
  assert.ok(index >= 0, `Missing ${name} in ${args[0]}`)
  return args[index + 1]
}

function options(password, extra = {}) {
  return { tmpDir: {}, cscLink: 'fixture-application.p12', cscKeyPassword: password, currentDir: dirname(signerPath), ...extra }
}

for (const certificatePassword of ['certificate-import-password', '']) {
  test(`macOS signing uses its random keychain password with ${certificatePassword ? 'protected' : 'empty-password'} certificates`, async () => {
    const { createKeychain, calls } = signerHarness()
    const result = await createKeychain(options(certificatePassword))
    const created = calls.find(args => args[0] === 'create-keychain')
    const keychainPassword = flag(created, '-p')
    assert.ok(keychainPassword.length > 0)
    assert.notEqual(keychainPassword, certificatePassword)
    assert.equal(flag(calls.find(args => args[0] === 'unlock-keychain'), '-p'), keychainPassword)
    assert.equal(flag(calls.find(args => args[0] === 'import'), '-P'), certificatePassword)
    assert.equal(flag(calls.find(args => args[0] === 'set-key-partition-list'), '-k'), keychainPassword)
    assert.equal(result.keychainFile, created.at(-1))
  })
}

test('application and installer certificates keep separate import passwords but share the keychain password', async () => {
  const { createKeychain, calls } = signerHarness()
  await createKeychain(options('app-password', { cscILink: 'fixture-installer.p12', cscIKeyPassword: 'installer-password' }))
  const imports = calls.filter(args => args[0] === 'import')
  assert.deepEqual(imports.map(args => flag(args, '-P')), ['app-password', 'installer-password'])
  const partitions = calls.filter(args => args[0] === 'set-key-partition-list')
  assert.equal(partitions.length, 2)
  const keychainPassword = flag(calls.find(args => args[0] === 'create-keychain'), '-p')
  for (const args of partitions) assert.equal(flag(args, '-k'), keychainPassword)
})

for (const command of ['import', 'set-key-partition-list']) {
  test(`macOS signing propagates ${command} failures instead of bypassing signing`, async () => {
    const { createKeychain } = signerHarness(command)
    await assert.rejects(createKeychain(options('certificate-password')), new RegExp(`security ${command} rejected`))
  })
}
