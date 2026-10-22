import { execFile, spawn } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import type { AppSettings, KataGoCustomEngineCheckRequest, KataGoCustomEngineCheckResult } from '@main/lib/types'
import { resolveKataGoRuntime } from '../katagoRuntime'
import { parseKataGoVersion } from './version'

// The first launch of a new binary can wait on the OS malware scan, and the first
// analysis on OpenCL also runs GPU tuning, so both limits are generous.
const VERSION_TIMEOUT_MS = 120_000
const ANALYSIS_TIMEOUT_MS = 240_000
const SMOKE_QUERY_ID = 'goagent-custom-engine-check'

function tail(text: string, lines = 12): string {
  return text.split(/\r?\n/).map((line) => line.trimEnd()).filter(Boolean).slice(-lines).join('\n')
}

function runVersion(binaryPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(binaryPath, ['version'], { encoding: 'utf8', timeout: VERSION_TIMEOUT_MS, windowsHide: true }, (error, stdout, stderr) => {
      if (error) {
        const status = typeof (error as { code?: unknown }).code === 'number' ? ` (exit ${(error as { code: number }).code})` : ''
        reject(new Error(`${error.message}${status}\n${tail(String(stderr || stdout))}`.trim()))
        return
      }
      resolve(String(stdout))
    })
  })
}

function runAnalysisSmokeTest(binaryPath: string, modelPath: string, configPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(binaryPath, ['analysis', '-config', configPath, '-model', modelPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    })
    let stdout = ''
    let stderr = ''
    let settled = false
    const finish = (error?: Error): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      child.kill()
      if (error) reject(error)
      else resolve()
    }
    const timer = setTimeout(() => {
      finish(new Error(`KataGo 在 ${ANALYSIS_TIMEOUT_MS / 1000} 秒内没有返回试算结果。\n${tail(stderr)}`.trim()))
    }, ANALYSIS_TIMEOUT_MS)

    child.stdin.on('error', () => undefined)
    child.stderr.on('data', (chunk) => {
      stderr = (stderr + String(chunk)).slice(-20_000)
    })
    child.stdout.on('data', (chunk) => {
      stdout += String(chunk)
      let newline = stdout.indexOf('\n')
      while (newline >= 0) {
        const line = stdout.slice(0, newline).trim()
        stdout = stdout.slice(newline + 1)
        newline = stdout.indexOf('\n')
        if (!line) continue
        let response: { id?: string; error?: unknown; isDuringSearch?: boolean }
        try {
          response = JSON.parse(line)
        } catch {
          continue
        }
        if (response.id !== SMOKE_QUERY_ID) continue
        if (response.error) {
          finish(new Error(`KataGo 拒绝了试算请求: ${String(response.error)}`))
          return
        }
        if (!response.isDuringSearch) {
          finish()
          return
        }
      }
    })
    child.once('error', (error) => finish(error))
    child.once('close', (code) => finish(new Error(`KataGo 在试算前退出（代码 ${code ?? '未知'}）。\n${tail(stderr)}`.trim())))
    child.stdin.write(`${JSON.stringify({
      id: SMOKE_QUERY_ID,
      moves: [],
      rules: 'chinese',
      komi: 7.5,
      boardXSize: 19,
      boardYSize: 19,
      maxVisits: 8
    })}\n`)
  })
}

/**
 * Runs the chosen KataGo files the way analysis will: version probe, then one short
 * analysis query. Blank fields use GoAgent's automatic choice, so a custom model can be
 * checked with the bundled engine and vice versa.
 */
export async function checkCustomKataGoEngine(
  request: KataGoCustomEngineCheckRequest,
  settings: AppSettings
): Promise<KataGoCustomEngineCheckResult> {
  const startedAt = Date.now()
  const automatic = resolveKataGoRuntime({ ...settings, katagoCustomBin: '', katagoCustomModel: '', katagoCustomConfig: '' })
  const binaryPath = request.katagoCustomBin.trim() || automatic.katagoBin
  const modelPath = request.katagoCustomModel.trim() || automatic.katagoModel
  const configPath = request.katagoCustomConfig.trim() || automatic.katagoConfig
  const result = (ok: boolean, message: string, detail = '', engineVersion = ''): KataGoCustomEngineCheckResult => ({
    ok,
    binaryPath,
    modelPath,
    configPath,
    engineVersion,
    elapsedMs: Date.now() - startedAt,
    message,
    detail
  })

  const files: Array<[string, string]> = [['KataGo 程序', binaryPath], ['模型', modelPath], ['分析配置', configPath]]
  for (const [label, path] of files) {
    if (!path) return result(false, `没有可用的${label}，请选择文件。`)
    if (!existsSync(path) || !statSync(path).isFile()) return result(false, `${label}不存在: ${path}`)
  }

  let engineVersion = ''
  try {
    engineVersion = parseKataGoVersion(await runVersion(binaryPath))
  } catch (error) {
    return result(false, 'KataGo 程序无法启动。', error instanceof Error ? error.message : String(error))
  }
  if (!engineVersion) {
    return result(false, '无法识别 KataGo 版本，请确认选择的是 KataGo 程序。')
  }

  try {
    await runAnalysisSmokeTest(binaryPath, modelPath, configPath)
  } catch (error) {
    return result(false, 'KataGo 无法用这个模型和配置完成试算。', error instanceof Error ? error.message : String(error), engineVersion)
  }
  return result(true, `KataGo ${engineVersion} 已用这个模型完成一次试算。`, '', engineVersion)
}
