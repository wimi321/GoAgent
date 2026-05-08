import { createHash } from 'node:crypto'
import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { devNull } from 'node:os'
import { app } from 'electron'
import { appHome } from '@main/lib/store'

const execFileAsync = promisify(execFile)

const runtimeRoot = join(appHome, 'runtime', 'tts-python')
const venvRoot = join(runtimeRoot, 'venv')
const venvBinDir = process.platform === 'win32' ? 'Scripts' : 'bin'
const pythonPath = join(venvRoot, venvBinDir, process.platform === 'win32' ? 'python.exe' : 'python3')
const stampPath = join(runtimeRoot, 'requirements.sha256')
const materializedRequirementsPath = join(runtimeRoot, 'requirements-tts.txt')

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
    return [{ command: 'py', args: args.length ? args : ['-3.12'], label: trimmed }]
  }
  return [{ command: trimmed, args: [], label: trimmed }]
}

function pythonLaunchers(preferredPythonBin?: string): PythonLauncher[] {
  const configured = [
    ...parseConfiguredPython(process.env.GOAGENT_TTS_PYTHON),
    ...parseConfiguredPython(preferredPythonBin),
    ...parseConfiguredPython(process.env.PYTHON)
  ]
  const candidates: PythonLauncher[] = [...configured]
  if (process.platform === 'win32') {
    candidates.push(
      { command: 'py', args: ['-3.13'], label: 'py -3.13' },
      { command: 'py', args: ['-3.12'], label: 'py -3.12' },
      { command: 'py', args: ['-3.11'], label: 'py -3.11' },
      { command: 'py', args: ['-3.10'], label: 'py -3.10' },
      { command: 'python', args: [], label: 'python' },
      { command: 'python3', args: [], label: 'python3' }
    )
  } else {
    candidates.push(
      { command: 'python3.13', args: [], label: 'python3.13' },
      { command: 'python3.12', args: [], label: 'python3.12' },
      { command: 'python3.11', args: [], label: 'python3.11' },
      { command: 'python3.10', args: [], label: 'python3.10' },
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
      'import sys; ok = sys.version_info.major == 3 and 10 <= sys.version_info.minor <= 13; print("1" if ok else "0"); print(sys.version); print(sys.executable)'
    ], { windowsHide: true, timeout: 10_000 })
    return stdout.trim().split(/\r?\n/)[0] === '1'
  } catch {
    return false
  }
}

function uvLaunchers(): PythonLauncher[] {
  const configured = process.env.UV?.trim()
  const candidates = [
    ...(configured ? [{ command: configured, args: [], label: configured }] : []),
    { command: 'uv', args: [], label: 'uv' },
    { command: '/opt/homebrew/bin/uv', args: [], label: '/opt/homebrew/bin/uv' },
    { command: '/usr/local/bin/uv', args: [], label: '/usr/local/bin/uv' }
  ]
  const seen = new Set<string>()
  return candidates.filter((candidate) => {
    if (seen.has(candidate.command)) return false
    seen.add(candidate.command)
    return true
  })
}

async function resolveUvLauncher(): Promise<PythonLauncher | null> {
  for (const candidate of uvLaunchers()) {
    try {
      await execFileAsync(candidate.command, ['--version'], { windowsHide: true, timeout: 10_000 })
      return candidate
    } catch {
      // Try the next uv location.
    }
  }
  return null
}

async function resolveUvManagedPython(): Promise<PythonLauncher | null> {
  const uv = await resolveUvLauncher()
  if (!uv) return null
  try {
    await execFileAsync(uv.command, ['python', 'install', '3.12'], {
      windowsHide: true,
      timeout: 300_000,
      maxBuffer: 1024 * 1024
    })
    const { stdout } = await execFileAsync(uv.command, ['python', 'find', '3.12'], {
      windowsHide: true,
      timeout: 30_000,
      maxBuffer: 256 * 1024
    })
    const command = stdout.trim().split(/\r?\n/).at(-1)?.trim()
    if (command && await probePythonLauncher({ command, args: [], label: 'uv python 3.12' })) {
      return { command, args: [], label: 'uv-managed python 3.12' }
    }
  } catch {
    return null
  }
  return null
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

function sourceCandidates(projectRoot: string, filename: string): string[] {
  const candidates = [
    join(projectRoot, 'scripts', filename),
    join(process.cwd(), 'scripts', filename)
  ]
  try {
    candidates.push(join(app.getAppPath(), 'scripts', filename))
  } catch {
    // app.getAppPath can be unavailable in unusual test harnesses.
  }
  if (process.resourcesPath) {
    candidates.push(
      join(process.resourcesPath, 'scripts', filename),
      join(process.resourcesPath, 'app.asar', 'scripts', filename)
    )
  }
  return [...new Set(candidates)]
}

async function readBundledScript(projectRoot: string, filename: string): Promise<string> {
  const errors: string[] = []
  for (const candidate of sourceCandidates(projectRoot, filename)) {
    try {
      return await readFile(candidate, 'utf8')
    } catch (error) {
      errors.push(`${candidate}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  throw new Error(`找不到 TTS 运行脚本 ${filename}。已尝试：${errors.join('；')}`)
}

async function runVenvPython(args: string[], timeout = 120_000, usePipFallback = false): Promise<void> {
  if (!usePipFallback) {
    await execFileAsync(pythonPath, args, { windowsHide: true, timeout, maxBuffer: 1024 * 1024 })
    return
  }
  try {
    await execFileAsync(pythonPath, args, {
      windowsHide: true,
      timeout,
      maxBuffer: 1024 * 1024,
      env: pipFallbackEnv()
    })
  } catch (firstError) {
    try {
      await execFileAsync(pythonPath, args, { windowsHide: true, timeout, maxBuffer: 1024 * 1024 })
    } catch (secondError) {
      throw new Error(`TTS Python 依赖安装失败。官方 PyPI 错误：${String(firstError)}；默认 pip 源也失败：${String(secondError)}`)
    }
  }
}

export async function materializeTtsScript(projectRoot: string, filename: string): Promise<string> {
  await mkdir(runtimeRoot, { recursive: true })
  const content = await readBundledScript(projectRoot, filename)
  const target = join(runtimeRoot, filename)
  await writeFile(target, content, 'utf8')
  return target
}

export async function resolveTtsPythonLauncher(preferredPythonBin?: string): Promise<PythonLauncher> {
  const attempted: string[] = []
  for (const candidate of pythonLaunchers(preferredPythonBin)) {
    attempted.push(candidate.label)
    if (await probePythonLauncher(candidate)) return candidate
  }
  const uvPython = await resolveUvManagedPython()
  if (uvPython) return uvPython
  throw new Error(`Kokoro 中文离线语音需要 Python 3.10-3.13 与 misaki[zh]。未找到可用解释器，已尝试：${attempted.join('、')}。请安装 Python 3.12，或在设置里把 Python 路径指向 Python 3.10-3.13。`)
}

export async function ensureTtsPythonRuntime(projectRoot: string, preferredPythonBin?: string): Promise<string> {
  await mkdir(runtimeRoot, { recursive: true })

  let createdVenv = false
  if (await pathExists(pythonPath) && !(await probePythonLauncher({ command: pythonPath, args: [], label: 'tts venv python' }))) {
    await rm(venvRoot, { recursive: true, force: true })
  }
  if (!(await pathExists(pythonPath))) {
    const launcher = await resolveTtsPythonLauncher(preferredPythonBin)
    await execFileAsync(launcher.command, [...launcher.args, '-m', 'venv', venvRoot], {
      windowsHide: true,
      timeout: 120_000,
      maxBuffer: 1024 * 1024
    })
    createdVenv = true
  }

  if (!(await pathExists(pythonPath))) {
    throw new Error(`TTS Python 虚拟环境创建失败：没有找到 ${pythonPath}`)
  }

  const requirements = await readBundledScript(projectRoot, 'requirements-tts.txt')
  await writeFile(materializedRequirementsPath, requirements, 'utf8')
  const digest = createHash('sha256').update(requirements).digest('hex')
  const installedDigest = (await pathExists(stampPath)) ? (await readFile(stampPath, 'utf8')).trim() : ''

  if (createdVenv || installedDigest !== digest) {
    await runVenvPython(['-m', 'ensurepip', '--upgrade'], 120_000)
    await runVenvPython(['-m', 'pip', 'install', '-r', materializedRequirementsPath], 360_000, true)
    await writeFile(stampPath, `${digest}\n`, 'utf8')
  }

  return pythonPath
}
