const { createHash } = require('node:crypto')
const { createReadStream } = require('node:fs')
const { readFile, rename, writeFile } = require('node:fs/promises')
const { join } = require('node:path')

const ARCH_NAMES = {
  0: 'ia32',
  1: 'x64',
  2: 'armv7l',
  3: 'arm64',
  4: 'universal'
}

function sha256File(path) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(path)
    stream.on('error', reject)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
  })
}

async function refreshPackagedKataGoChecksum(appOutDir, arch) {
  const resourceRoot = join(appOutDir, 'resources', 'data', 'katago')
  const manifestPath = join(resourceRoot, 'manifest.json')
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  const archName = typeof arch === 'string' ? arch : ARCH_NAMES[arch]
  const platformKey = `win32-${archName}`
  const platform = manifest.supportedPlatforms?.[platformKey]
  if (!platform?.binaryPath) {
    throw new Error(`Packaged KataGo manifest does not support ${platformKey}.`)
  }

  const binaryPath = join(resourceRoot, platform.binaryPath)
  const signedSha256 = await sha256File(binaryPath)
  const nextManifest = {
    ...manifest,
    supportedPlatforms: {
      ...manifest.supportedPlatforms,
      [platformKey]: {
        ...platform,
        sha256: signedSha256
      }
    }
  }
  const temporaryPath = `${manifestPath}.tmp`
  await writeFile(temporaryPath, `${JSON.stringify(nextManifest, null, 2)}\n`, 'utf8')
  await rename(temporaryPath, manifestPath)
  console.log(`[after-sign] refreshed packaged KataGo checksum for ${platformKey}: ${signedSha256}`)
  return signedSha256
}

exports.refreshPackagedKataGoChecksum = refreshPackagedKataGoChecksum
exports.default = async function afterSign(context) {
  if (context.electronPlatformName !== 'win32') return
  await refreshPackagedKataGoChecksum(context.appOutDir, context.arch)
}
