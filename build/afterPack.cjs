const { createHash } = require('node:crypto')
const { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, statSync } = require('node:fs')
const { join } = require('node:path')
const { Arch } = require('builder-util')

module.exports = async function afterPack(context) {
  const projectDir = context.packager.projectDir
  const manifestPath = join(projectDir, 'data', 'codex', 'manifest.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const arch = Arch[context.arch]
  const target = `${context.electronPlatformName}-${arch}`
  const asset = manifest.targets[target]
  if (!asset) throw new Error(`Codex runtime manifest does not support ${target}`)

  const source = join(projectDir, 'data', 'codex', 'bin', target, asset.executable)
  if (!existsSync(source)) throw new Error(`Codex runtime is missing for ${target}. Run the matching prepare:codex-runtime script first.`)
  const digest = createHash('sha256').update(readFileSync(source)).digest('hex')
  if (statSync(source).size !== asset.bytes || digest !== asset.sha256) {
    throw new Error(`Codex runtime validation failed for ${target}`)
  }

  const resources = context.electronPlatformName === 'darwin'
    ? join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`, 'Contents', 'Resources')
    : join(context.appOutDir, 'resources')
  const destinationDir = join(resources, 'data', 'codex')
  const destination = join(destinationDir, 'bin', target, asset.executable)
  mkdirSync(join(destinationDir, 'bin', target), { recursive: true })
  copyFileSync(source, destination)
  copyFileSync(manifestPath, join(destinationDir, 'manifest.json'))
  copyFileSync(join(projectDir, 'data', 'codex', 'LICENSE'), join(destinationDir, 'LICENSE'))
  if (context.electronPlatformName !== 'win32') chmodSync(destination, 0o755)
}
