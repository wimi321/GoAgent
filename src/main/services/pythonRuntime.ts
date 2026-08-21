import { createHash } from 'node:crypto'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { devNull } from 'node:os'
import { appHome } from '@main/lib/store'

const execFileAsync = promisify(execFile)

const runtimeRoot = join(appHome, 'runtime')
const venvRoot = join(runtimeRoot, 'venv')
const venvBinDir = process.platform === 'win32' ? 'Scripts' : 'bin'
const pythonPath = join(venvRoot, venvBinDir, process.platform === 'win32' ? 'python.exe' : 'python3')
const stampPath = join(runtimeRoot, 'requirements.sha256')

interface PythonLauncher {
  command: string
  args: string[]
  label: string
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await access(target)
    return true
  } catch {
    return false
  }
}

function parseConfiguredPython(value?: string): PythonLauncher[] {
  const trimmed = value?.trim() ?? ''
  if (!trimmed) return []
  if (/^py(?:\.exe)?(?:\s|$)/i.test(trimmed)) {
    const [, ...args] = trimmed.split(/\s+/)
    return [{ command: 'py', args: args.length ? args : ['-3'], label: trimmed }]
  }
  return [{ command: trimmed, args: [], label: trimmed }]
}

function pythonLaunchers(preferredPythonBin?: string): PythonLauncher[] {
  const candidates: PythonLauncher[] = [
    ...parseConfiguredPython(preferredPythonBin),
    ...parseConfiguredPython(process.env.PYTHON)
  ]
  if (process.platform === 'win32') {
    candidates.push(
      { command: 'python', args: [], label: 'python' },
      { command: 'py', args: ['-3'], label: 'py -3' },
      { command: 'python3', args: [], label: 'python3' }
    )
  } else {
    candidates.push(
      { command: 'python3', args: [], label: 'python3' },
      { command: 'python', args: [], label: 'python' }
    )
  }
  const seen = new Set<string>()
  return candidates.filter((candidate) => {
    const key = `${candidate.command}\0${candidate.args.join('\0')}`.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

async function probePythonLauncher(candidate: PythonLauncher): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync(candidate.command, [
      ...candidate.args,
      '-c',
      'import sys; print(sys.version_info[0]); print(sys.executable)'
    ], { windowsHide: true, timeout: 10_000 })
    const [majorText] = stdout.trim().split(/\r?\n/)
    return Number(majorText) >= 3
  } catch {
    return false
  }
}

function pipFallbackEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    PIP_CONFIG_FILE: devNull,
    PIP_INDEX_URL: 'https://pypi.org/simple',
    PIP_DISABLE_PIP_VERSION_CHECK: '1',
    PIP_NO_INPUT: '1'
  }
}

async function runPython(args: string[], usePipFallback = false): Promise<void> {
  if (usePipFallback) {
    try {
      await execFileAsync(pythonPath, args, {
        windowsHide: true,
        timeout: 120_000,
        env: pipFallbackEnv()
      })
      return
    } catch (firstError) {
      try {
        await execFileAsync(pythonPath, args, { windowsHide: true, timeout: 120_000 })
      } catch (secondError) {
        throw new Error(`Python 依赖安装失败。官方 PyPI 错误：${String(firstError)}；默认 pip 源也失败：${String(secondError)}`)
      }
    }
    return
  }
  try {
    await execFileAsync(pythonPath, args, { windowsHide: true, timeout: 120_000 })
  } catch (error) {
    throw error
  }
}

export async function resolvePythonLauncher(preferredPythonBin?: string): Promise<PythonLauncher> {
  const candidates = pythonLaunchers(preferredPythonBin)
  for (const candidate of candidates) {
    if (await probePythonLauncher(candidate)) {
      return candidate
    }
  }
  throw new Error(`找不到可用的 Python 3。已尝试：${candidates.map((candidate) => candidate.label).join('、')}。请在设置里把 Python 路径改为 python.exe，或安装 Python 3。`)
}

export async function ensurePythonRuntime(projectRoot: string, preferredPythonBin?: string): Promise<string> {
  await mkdir(runtimeRoot, { recursive: true })

  let createdVenv = false
  if (!(await pathExists(pythonPath))) {
    const launcher = await resolvePythonLauncher(preferredPythonBin)
    await execFileAsync(launcher.command, [...launcher.args, '-m', 'venv', venvRoot], { windowsHide: true })
    createdVenv = true
  }

  if (!(await pathExists(pythonPath))) {
    throw new Error(`Python 虚拟环境创建失败：没有找到 ${pythonPath}`)
  }

  const requirementsPath = join(projectRoot, 'scripts', 'requirements.txt')
  const requirements = await readFile(requirementsPath, 'utf8')
  const digest = createHash('sha256').update(requirements).digest('hex')
  const installedDigest = (await pathExists(stampPath)) ? (await readFile(stampPath, 'utf8')).trim() : ''

  if (createdVenv || installedDigest !== digest) {
    await runPython(['-m', 'ensurepip', '--upgrade'])
    await runPython(['-m', 'pip', 'install', '-r', requirementsPath], true)
    await writeFile(stampPath, `${digest}\n`, 'utf8')
  }

  return pythonPath
}
