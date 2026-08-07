import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'

const require = createRequire(import.meta.url)
const packageJson = require('../package.json')
const { default: afterSign } = require('../build/afterSign.cjs')

test('Windows after-sign hook records the signed KataGo binary checksum', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'goagent-after-sign-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const appOutDir = join(root, 'win-unpacked')
  const manifestPath = join(appOutDir, 'resources', 'data', 'katago', 'manifest.json')
  const binaryPath = join(appOutDir, 'resources', 'data', 'katago', 'bin', 'win32-x64', 'katago.exe')
  await mkdir(dirname(binaryPath), { recursive: true })
  const signedBytes = Buffer.from('authenticode-mutated-katago-binary')
  await writeFile(binaryPath, signedBytes)
  await writeFile(manifestPath, JSON.stringify({
    supportedPlatforms: {
      'win32-x64': {
        binaryPath: 'bin/win32-x64/katago.exe',
        sha256: 'pre-signing-checksum'
      }
    }
  }))

  await afterSign({ electronPlatformName: 'win32', appOutDir, arch: 1 })

  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  assert.equal(
    manifest.supportedPlatforms['win32-x64'].sha256,
    createHash('sha256').update(signedBytes).digest('hex')
  )
})

test('release packaging refreshes checksums after signing and supports GPU-less version probes', async () => {
  assert.equal(packageJson.build.afterSign, 'build/afterSign.cjs')
  const versionSource = await readFile(join(process.cwd(), 'src/main/services/katago/version.ts'), 'utf8')
  assert.match(versionSource, /readEmbeddedKataGoVersion/)
  assert.match(versionSource, /embedded binary metadata/)
  assert.match(versionSource, /if \(executableError\) throw executableError/)
})
