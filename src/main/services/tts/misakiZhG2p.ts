import { spawn } from 'node:child_process'
import type { AppSettings } from '@main/lib/types'
import { ensureTtsPythonRuntime, materializeTtsScript } from './ttsPythonRuntime'

export interface MisakiZhG2pResult {
  engine: 'misaki.zh.ZHG2P'
  version: '1.1'
  text: string
  phonemes: string
  unknownCount: number
}

function sanitizeToolOutput(value: string, limit = 1800): string {
  const cleaned = value.replace(/[A-Za-z0-9_./-]{20,}KEY[A-Za-z0-9_./-]*/gi, '[redacted]')
  return cleaned.length <= limit ? cleaned : `${cleaned.slice(0, limit)}...`
}

function parseLastJsonObject(output: string): MisakiZhG2pResult {
  const lines = output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const jsonLine = [...lines].reverse().find((line) => line.startsWith('{') && line.endsWith('}'))
  if (!jsonLine) throw new Error('没有找到 JSON 结果。')
  return JSON.parse(jsonLine) as MisakiZhG2pResult
}

function runG2pScript(pythonPath: string, scriptPath: string, text: string): Promise<MisakiZhG2pResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(pythonPath, [scriptPath], {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe']
    })
    const stdout: Buffer[] = []
    const stderr: Buffer[] = []
    const timer = setTimeout(() => {
      child.kill()
      reject(new Error('Misaki 中文分词/注音超时。请稍后重试，或检查 TTS Python 运行环境。'))
    }, 45_000)
    child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk))
    child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk))
    child.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      const out = Buffer.concat(stdout).toString('utf8').trim()
      const err = sanitizeToolOutput(Buffer.concat(stderr).toString('utf8').trim())
      if (code !== 0) {
        reject(new Error(err || `Misaki 中文 G2P 失败，退出码 ${code}`))
        return
      }
      try {
        const parsed = parseLastJsonObject(out)
        if (!parsed.phonemes?.trim()) throw new Error('Misaki 返回了空 phonemes。')
        resolve(parsed)
      } catch (error) {
        reject(new Error(`Misaki 中文 G2P 输出无法解析：${error instanceof Error ? error.message : String(error)}；stdout=${sanitizeToolOutput(out)}`))
      }
    })
    child.stdin.end(JSON.stringify({ text }))
  })
}

export async function phonemizeChineseWithMisaki(text: string, settings: AppSettings, projectRoot = process.cwd()): Promise<MisakiZhG2pResult> {
  const pythonPath = await ensureTtsPythonRuntime(projectRoot, settings.pythonBin)
  const scriptPath = await materializeTtsScript(projectRoot, 'tts_misaki_zh_g2p.py')
  return runG2pScript(pythonPath, scriptPath, text)
}
