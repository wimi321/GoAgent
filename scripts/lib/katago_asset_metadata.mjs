import { execFile } from 'node:child_process'
import { open } from 'node:fs/promises'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export function parseKataGoVersion(value) {
  return /KataGo\s+v?(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)/i.exec(String(value))?.[1] ?? ''
}

export function compareKataGoVersions(left, right) {
  const parse = (value) => String(value).split(/[.-]/).slice(0, 3).map((part) => Number(part) || 0)
  const leftParts = parse(left)
  const rightParts = parse(right)
  for (let index = 0; index < 3; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0)
    if (difference !== 0) return difference
  }
  return 0
}

export function kataGoVersionSatisfies(actual, minimum = '') {
  return Boolean(actual) && (!minimum || compareKataGoVersions(actual, minimum) >= 0)
}

async function versionFromBinaryStrings(path) {
  const handle = await open(path, 'r')
  try {
    const chunkSize = 4 * 1024 * 1024
    const buffer = Buffer.allocUnsafe(chunkSize)
    let position = 0
    let carry = ''
    while (true) {
      const { bytesRead } = await handle.read(buffer, 0, chunkSize, position)
      if (!bytesRead) break
      const text = carry + buffer.subarray(0, bytesRead).toString('latin1')
      const version = parseKataGoVersion(text)
      if (version) return version
      carry = text.slice(-128)
      position += bytesRead
    }
    return ''
  } finally {
    await handle.close()
  }
}

function nativePlatformKey() {
  return `${process.platform}-${process.arch}`
}

export async function inspectKataGoBinaryMetadata(path, platformKey = nativePlatformKey()) {
  if (platformKey === nativePlatformKey()) {
    try {
      const { stdout, stderr } = await execFileAsync(path, ['version'], {
        timeout: 10_000,
        maxBuffer: 1024 * 1024,
        windowsHide: true
      })
      const output = `${stdout ?? ''}\n${stderr ?? ''}`
      const version = parseKataGoVersion(output)
      if (version) return { version, source: 'executable-output' }
    } catch {
      // Cross-architecture macOS binaries and Windows binaries on CI can still
      // be verified from their embedded version string.
    }
  }
  return { version: await versionFromBinaryStrings(path), source: 'embedded-string' }
}
