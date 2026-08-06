import { execFile } from 'node:child_process'
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

export async function probeKataGoVersion(path: string, timeoutMs = 5_000): Promise<KataGoVersionProbe> {
  const { stdout, stderr } = await execFileAsync(path, ['version'], {
    encoding: 'utf8',
    timeout: timeoutMs,
    maxBuffer: 1024 * 1024,
    windowsHide: true
  })
  const output = `${stdout ?? ''}\n${stderr ?? ''}`.trim()
  return {
    version: parseKataGoVersion(output),
    backend: parseKataGoBackend(output),
    output
  }
}
