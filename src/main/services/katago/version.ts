import { execFile } from 'node:child_process'
import { open } from 'node:fs/promises'
import { promisify } from 'node:util'

export const KATAGO_NON_TENSORRT_RELEASE = '1.17.1'
export const KATAGO_TENSORRT_RELEASE = '1.17.2'

const execFileAsync = promisify(execFile)

export interface KataGoVersionProbe {
  version: string
  backend: string
  output: string
}

export function parseKataGoVersion(value: string): string {
  return /KataGo\s+v?(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)/i.exec(value)?.[1] ?? ''
}

export function compareKataGoVersions(left: string, right: string): number {
  const parse = (value: string): number[] => value.split(/[.-]/).slice(0, 3).map((part) => Number(part) || 0)
  const leftParts = parse(left)
  const rightParts = parse(right)
  for (let index = 0; index < 3; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0)
    if (difference !== 0) return difference
  }
  return 0
}

export function kataGoVersionSatisfies(actual: string, minimum = ''): boolean {
  return Boolean(actual) && (!minimum || compareKataGoVersions(actual, minimum) >= 0)
}

export function parseKataGoBackend(value: string): string {
  if (/TensorRT/i.test(value)) return 'tensorrt'
  if (/OpenCL/i.test(value)) return 'opencl'
  if (/Metal/i.test(value)) return 'metal'
  if (/CUDA|CUDNN/i.test(value)) return 'cuda'
  if (/Eigen/i.test(value)) return 'eigen'
  return ''
}

async function readEmbeddedKataGoVersion(path: string): Promise<string> {
  const handle = await open(path, 'r')
  try {
    const chunkSize = 4 * 1024 * 1024
    const buffer = Buffer.allocUnsafe(chunkSize)
    let position = 0
    let carry = ''
    while (true) {
      const { bytesRead } = await handle.read(buffer, 0, chunkSize, position)
      if (!bytesRead) return ''
      const text = carry + buffer.subarray(0, bytesRead).toString('latin1')
      const version = parseKataGoVersion(text)
      if (version) return version
      carry = text.slice(-128)
      position += bytesRead
    }
  } finally {
    await handle.close()
  }
}

function failedProbeOutput(error: unknown): string {
  if (!error || typeof error !== 'object') return ''
  const value = error as { stdout?: unknown; stderr?: unknown }
  return `${value.stdout ?? ''}\n${value.stderr ?? ''}`.trim()
}

export async function probeKataGoVersion(path: string, timeoutMs = 5_000): Promise<KataGoVersionProbe> {
  let output = ''
  let executableError: unknown
  try {
    const { stdout, stderr } = await execFileAsync(path, ['version'], {
      encoding: 'utf8',
      timeout: timeoutMs,
      maxBuffer: 1024 * 1024,
      windowsHide: true
    })
    output = `${stdout ?? ''}\n${stderr ?? ''}`.trim()
  } catch (error) {
    executableError = error
    output = failedProbeOutput(error)
  }

  const executableVersion = parseKataGoVersion(output)
  if (executableVersion) {
    return {
      version: executableVersion,
      backend: parseKataGoBackend(output),
      output
    }
  }

  // CUDA/CUDNN builds can fail before printing `version` on a runner without
  // the matching GPU runtime. Their embedded build string still lets us verify
  // the engine version without pretending that the backend itself was started.
  const embeddedVersion = await readEmbeddedKataGoVersion(path).catch(() => '')
  if (embeddedVersion) {
    return {
      version: embeddedVersion,
      backend: parseKataGoBackend(output),
      output: [output, `KataGo v${embeddedVersion} (embedded binary metadata)`].filter(Boolean).join('\n')
    }
  }

  if (executableError) throw executableError
  return { version: '', backend: parseKataGoBackend(output), output }
}
