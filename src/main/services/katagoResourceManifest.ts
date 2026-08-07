import { existsSync } from 'node:fs'
import { join } from 'node:path'

export interface KataGoResourceManifest {
  platformKey: string
  binaryRelativePath: string
  defaultModelRelativePath: string
  optionalModelRelativePaths: string[]
}

export function currentPlatformKey(): string {
  return `${process.platform}-${process.arch}`
}

export function binaryFileName(): string {
  return process.platform === 'win32' ? 'katago.exe' : 'katago'
}

export function expectedBundledManifest(): KataGoResourceManifest {
  const platformKey = currentPlatformKey()
  return {
    platformKey,
    binaryRelativePath: join('bin', platformKey, binaryFileName()),
    defaultModelRelativePath: join('models', 'b10c512h8nbt3tflrs-fson-silu-rsnh.bin.gz'),
    optionalModelRelativePaths: [
      join('models', 'b10c384h6nbttflrs.bin.gz'),
      join('models', 'kata1-b18c384nbt-s9996604416-d4316597426.bin.gz')
    ]
  }
}

export function validateBundledResourceRoot(root: string): { ok: boolean; missing: string[] } {
  const manifest = expectedBundledManifest()
  const required = [manifest.binaryRelativePath, manifest.defaultModelRelativePath]
  const missing = required.filter((relativePath) => !existsSync(join(root, relativePath)))
  return { ok: missing.length === 0, missing }
}
