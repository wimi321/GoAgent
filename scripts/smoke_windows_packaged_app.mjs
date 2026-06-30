#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { setTimeout as delay } from 'node:timers/promises'
import process from 'node:process'

const root = resolve(process.cwd())
const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))

function arg(name, fallback = '') {
  const prefix = `--${name}=`
  const found = process.argv.find((item) => item.startsWith(prefix))
  return found ? found.slice(prefix.length) : fallback
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`)
}

function defaultExePath() {
  return join(root, 'release', packageJson.version, 'win-unpacked', 'GoAgent.exe')
}

function freePort() {
  return new Promise((resolvePromise, reject) => {
    const server = createServer()
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      server.close(() => {
        if (address && typeof address === 'object') {
          resolvePromise(address.port)
        } else {
          reject(new Error('Cannot allocate a local CDP port.'))
        }
      })
    })
    server.on('error', reject)
  })
}

function fail(message) {
  throw new Error(`[windows-packaged-smoke] ${message}`)
}

function tail(value, max = 4000) {
  return value.length > max ? value.slice(value.length - max) : value
}

async function waitForJson(url, timeoutMs, child, childError) {
  const deadline = Date.now() + timeoutMs
  let lastError = ''
  while (Date.now() < deadline) {
    if (childError.current) {
      throw new Error(`Packaged app failed to start: ${childError.current.message}`)
    }
    if (child.exitCode !== null) {
      throw new Error(`Packaged app exited before CDP was available. exitCode=${child.exitCode} signal=${child.signalCode ?? ''} lastCdpError=${lastError || 'none'}`)
    }
    try {
      const response = await fetch(url)
      if (response.ok) return response.json()
      lastError = `${response.status} ${response.statusText}`
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }
    await delay(500)
  }
  throw new Error(`Timed out waiting for ${url}. Last CDP error: ${lastError || 'none'}`)
}

async function connectRuntime(page) {
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  let id = 0
  const pending = new Map()
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data)
    if (!message.id || !pending.has(message.id)) return
    const { resolve: resolvePromise, reject } = pending.get(message.id)
    pending.delete(message.id)
    if (message.error) reject(new Error(JSON.stringify(message.error)))
    else resolvePromise(message.result)
  })
  await new Promise((resolvePromise, reject) => {
    ws.addEventListener('open', resolvePromise, { once: true })
    ws.addEventListener('error', reject, { once: true })
  })
  function send(method, params = {}) {
    const messageId = ++id
    ws.send(JSON.stringify({ id: messageId, method, params }))
    return new Promise((resolvePromise, reject) => {
      const timer = setTimeout(() => {
        pending.delete(messageId)
        reject(new Error(`${method} timed out`))
      }, 60_000)
      pending.set(messageId, {
        resolve: (value) => {
          clearTimeout(timer)
          resolvePromise(value)
        },
        reject: (error) => {
          clearTimeout(timer)
          reject(error)
        }
      })
    })
  }
  await send('Runtime.enable')
  async function evaluate(expression) {
    const result = await send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
      timeout: 60_000
    })
    if (result.exceptionDetails) {
      throw new Error(JSON.stringify(result.exceptionDetails))
    }
    return result.result?.value
  }
  return {
    evaluate,
    close: () => ws.close()
  }
}

async function main() {
  if (process.platform !== 'win32') {
    console.log(JSON.stringify({ skipped: true, reason: 'Windows packaged app smoke only runs on win32.' }, null, 2))
    return
  }

  const mode = arg('mode', 'full')
  const exe = resolve(arg('exe', defaultExePath()))
  const requireKatago = hasFlag('require-katago') || (mode !== 'lite' && !hasFlag('allow-missing-katago'))
  if (!existsSync(exe)) fail(`Missing packaged executable: ${exe}`)

  const port = Number(arg('port', '')) || await freePort()
  const smokeHome = resolve(arg('home', join(root, '.tmp', 'windows-packaged-smoke', `${Date.now()}-${mode}`)))
  rmSync(smokeHome, { recursive: true, force: true })
  mkdirSync(smokeHome, { recursive: true })
  const electronUserData = resolve(arg('electron-user-data', join(smokeHome, 'electron-user-data')))
  mkdirSync(electronUserData, { recursive: true })

  let stdout = ''
  let stderr = ''
  const childError = { current: null }
  const child = spawn(exe, [
    `--user-data-dir=${electronUserData}`,
    `--remote-debugging-port=${port}`,
    '--remote-allow-origins=*',
    '--disable-gpu',
    '--disable-software-rasterizer',
    '--disable-gpu-compositing',
    '--disable-gpu-sandbox',
    '--disable-features=Vulkan'
  ], {
    cwd: dirname(exe),
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      GOAGENT_APP_HOME: smokeHome,
      GOAGENT_REMOTE_DEBUGGING_PORT: String(port),
      ELECTRON_ENABLE_LOGGING: '1'
    }
  })
  child.stdout?.on('data', (chunk) => { stdout += String(chunk) })
  child.stderr?.on('data', (chunk) => { stderr += String(chunk) })
  child.once('error', (error) => { childError.current = error })

  try {
    const pages = await waitForJson(`http://127.0.0.1:${port}/json/list`, 60_000, child, childError)
    if (!Array.isArray(pages) || pages.length === 0) fail('Remote debugging exposed no renderer pages.')
    const page = pages.find((entry) => entry?.type === 'page' && entry?.webSocketDebuggerUrl) ?? pages[0]
    if (!page?.webSocketDebuggerUrl) fail('Remote debugging exposed no renderer WebSocket URL.')
    const runtime = await connectRuntime(page)
    let report
    try {
      report = {
        pageUrl: await runtime.evaluate('location.href'),
        title: await runtime.evaluate('document.title'),
        hasApi: await runtime.evaluate('Boolean(window.goagent && window.goagent.getDiagnostics && window.goagent.inspectKataGoAssets && window.goagent.getReleaseReadiness)'),
        diagnostics: await runtime.evaluate('window.goagent.getDiagnostics()'),
        katagoAssets: await runtime.evaluate('window.goagent.inspectKataGoAssets()'),
        releaseReadiness: await runtime.evaluate('window.goagent.getReleaseReadiness()')
      }
    } finally {
      runtime.close()
    }

    const failures = []
    const pageUrl = String(report.pageUrl || '').replace(/\\/g, '/')
    if (!pageUrl.includes('/resources/app.asar/out/renderer/index.html')) {
      failures.push(`Renderer did not load from packaged app.asar: ${report.pageUrl}`)
    }
    if (!report.hasApi) failures.push('window.goagent API is missing.')

    const requiredDiagnosticFailures = (report.diagnostics?.checks ?? []).filter((check) => check.required && check.status === 'fail')
    for (const check of requiredDiagnosticFailures) {
      failures.push(`Required diagnostic failed: ${check.id} - ${check.detail}`)
    }

    const readinessFailures = (report.releaseReadiness?.items ?? []).filter((entry) => entry.status === 'fail')
    for (const entry of readinessFailures) {
      failures.push(`Release readiness failed: ${entry.id} - ${entry.detail ?? ''}`)
    }

    if (requireKatago && !report.katagoAssets?.ready) {
      failures.push(`KataGo assets are not ready: ${report.katagoAssets?.detail ?? 'unknown'}`)
    }
    if (mode === 'lite' && report.diagnostics?.overall === 'blocked') {
      failures.push('Lite package must not block startup just because bundled KataGo is absent.')
    }

    const output = {
      mode,
      exe,
      smokeHome,
      electronUserData,
      pid: child.pid,
      requireKatago,
      pageUrl: report.pageUrl,
      diagnosticsOverall: report.diagnostics?.overall,
      katagoReady: report.katagoAssets?.ready,
      katagoDetail: report.katagoAssets?.detail,
      releaseReadinessStatus: report.releaseReadiness?.status,
      releaseReadinessFlags: report.releaseReadiness?.flags,
      failures
    }
    const evidencePath = arg('evidence', '')
    if (evidencePath) {
      mkdirSync(dirname(resolve(evidencePath)), { recursive: true })
      writeFileSync(resolve(evidencePath), `${JSON.stringify(output, null, 2)}\n`, 'utf8')
    }
    console.log(JSON.stringify(output, null, 2))
    if (failures.length) process.exitCode = 1
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const output = {
      mode,
      exe,
      smokeHome,
      electronUserData,
      pid: child.pid,
      requireKatago,
      childExitCode: child.exitCode,
      childSignal: child.signalCode,
      error: message,
      stdoutTail: tail(stdout.trim()),
      stderrTail: tail(stderr.trim()),
      failures: [message]
    }
    const evidencePath = arg('evidence', '')
    if (evidencePath) {
      mkdirSync(dirname(resolve(evidencePath)), { recursive: true })
      writeFileSync(resolve(evidencePath), `${JSON.stringify(output, null, 2)}\n`, 'utf8')
    }
    console.error(JSON.stringify(output, null, 2))
    process.exitCode = 1
  } finally {
    if (!child.killed) {
      child.kill('SIGTERM')
      await delay(1000)
      if (child.exitCode === null) child.kill('SIGKILL')
    }
    if (process.exitCode) {
      console.error(stdout.trim())
      console.error(stderr.trim())
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
