import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export type PackagedRuntimeFlavor = 'source' | 'standard' | 'nvidia' | 'lite' | 'unknown'

export interface PackagedRuntimeInfo {
  packaged: boolean
  resourcesRoot: string
  appRoot: string
  katagoRoot: string
  flavor: PackagedRuntimeFlavor
  version: string
}

function readJson(path: string): Record<string, unknown> | null {
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>
  } catch {
    return null
  }
}

function versionFrom(packageJson: Record<string, unknown> | null): string {
  return typeof packageJson?.version === 'string' && packageJson.version.trim()
    ? packageJson.version
    : ''
}

function readPackageVersion(projectRoot: string, appRoot: string, packaged: boolean): string {
  const packagedPackage = readJson(join(appRoot, 'package.json'))
  const sourcePackage = readJson(join(projectRoot, 'package.json'))
  const packagedVersion = versionFrom(packagedPackage)
  const sourceVersion = versionFrom(sourcePackage)
  if (packaged) {
    return packagedVersion || sourceVersion || 'unknown'
  }
  return sourceVersion || packagedVersion || 'unknown'
}

function detectFlavor(katagoRoot: string, packaged: boolean): PackagedRuntimeFlavor {
  if (!packaged) return 'source'
  const edition = readJson(join(katagoRoot, 'edition.json'))
  const flavor = typeof edition?.flavor === 'string' ? edition.flavor : ''
  if (flavor === 'nvidia') return 'nvidia'
  if (flavor === 'opencl' || flavor === 'standard') return 'standard'

  const hasManifest = existsSync(join(katagoRoot, 'manifest.json'))
  const hasPreparedRuntime =
    existsSync(join(katagoRoot, 'bin')) ||
    existsSync(join(katagoRoot, 'models')) ||
    existsSync(join(katagoRoot, 'edition.json'))
  if (hasManifest && !hasPreparedRuntime) return 'lite'
  if (hasManifest && hasPreparedRuntime) return 'standard'
  return 'unknown'
}

export function inspectPackagedRuntime(projectRoot = process.cwd()): PackagedRuntimeInfo {
  const resourcesRoot = process.resourcesPath || ''
  const packaged = Boolean(resourcesRoot && !process.env.ELECTRON_RENDERER_URL)
  const appRoot = packaged ? join(resourcesRoot, 'app.asar') : projectRoot
  const katagoRoot = packaged ? join(resourcesRoot, 'data', 'katago') : join(projectRoot, 'data', 'katago')
  return {
    packaged,
    resourcesRoot,
    appRoot,
    katagoRoot,
    flavor: detectFlavor(katagoRoot, packaged),
    version: readPackageVersion(projectRoot, appRoot, packaged)
  }
}

export function isLitePackagedRuntime(projectRoot = process.cwd()): boolean {
  return inspectPackagedRuntime(projectRoot).flavor === 'lite'
}
