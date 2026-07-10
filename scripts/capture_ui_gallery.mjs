#!/usr/bin/env node
import { createServer } from 'node:http'
import { existsSync } from 'node:fs'
import { access, mkdir, readFile } from 'node:fs/promises'
import { dirname, extname, join, resolve, sep } from 'node:path'
import { spawn, spawnSync } from 'node:child_process'

const configuredUrl = process.env.GOAGENT_UI_GALLERY_URL?.trim()
const rendererRoot = resolve('out/renderer')
const outDir = resolve(process.env.GOAGENT_UI_GALLERY_OUT ?? 'release-evidence/ui-gallery')
const skipBuild = process.argv.includes('--skip-build') || process.env.GOAGENT_UI_GALLERY_SKIP_BUILD === '1'
const captureTargets = [
  ['board', '.ui-gallery__panel--board'],
  ['teacher-card', '.ui-gallery__panel--teacher'],
  ['teaching-artifact-card', '.teacher-artifact-card'],
  ['timeline', '.ks-timeline-v2'],
  ['diagnostics', '.diagnostics-page'],
  ['settings-readiness', '.beta-acceptance-panel']
]

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp'
}

function run(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      ...options
    })
    child.once('error', reject)
    child.once('close', (code) => {
      if (code === 0) resolvePromise()
      else reject(new Error(`${command} ${args.join(' ')} exited with ${code ?? 'unknown status'}`))
    })
  })
}

async function ensureRendererBuild() {
  if (!skipBuild) {
    await run('pnpm', ['build'], { cwd: process.cwd(), env: process.env })
  }
  await access(join(rendererRoot, 'index.html')).catch(() => {
    throw new Error('UI Gallery build is missing. Run `pnpm build` or omit `--skip-build`.')
  })
}

function safeRendererPath(pathname) {
  const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '')
  const candidate = resolve(rendererRoot, relativePath)
  return candidate === rendererRoot || candidate.startsWith(`${rendererRoot}${sep}`) ? candidate : null
}

async function startRendererServer() {
  await ensureRendererBuild()
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://127.0.0.1').pathname)
      const requestedPath = safeRendererPath(pathname)
      const fallbackPath = join(rendererRoot, 'index.html')
      let filePath = requestedPath ?? fallbackPath
      let body
      try {
        body = await readFile(filePath)
      } catch {
        filePath = fallbackPath
        body = await readFile(filePath)
      }
      response.writeHead(200, {
        'Cache-Control': 'no-store',
        'Content-Type': mimeTypes[extname(filePath).toLowerCase()] ?? 'application/octet-stream'
      })
      response.end(body)
    } catch (error) {
      response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
      response.end(String(error))
    }
  })
  await new Promise((resolvePromise, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolvePromise)
  })
  const address = server.address()
  if (!address || typeof address === 'string') {
    server.close()
    throw new Error('Unable to start the local UI Gallery server.')
  }
  return {
    server,
    url: `http://127.0.0.1:${address.port}/#/ui-gallery`
  }
}

function systemBrowserPath() {
  const candidates = [
    process.env.GOAGENT_BROWSER_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    process.env.PROGRAMFILES ? join(process.env.PROGRAMFILES, 'Google', 'Chrome', 'Application', 'chrome.exe') : '',
    process.env['PROGRAMFILES(X86)'] ? join(process.env['PROGRAMFILES(X86)'], 'Microsoft', 'Edge', 'Application', 'msedge.exe') : ''
  ].filter(Boolean)
  return candidates.find((candidate) => existsSync(candidate)) ?? ''
}

async function loadPlaywright() {
  try {
    return await import('playwright')
  } catch {
    return null
  }
}

async function captureWithCliFallback(url) {
  await mkdir(outDir, { recursive: true })
  const whichResult = spawnSync('npx', ['--yes', '-p', 'playwright', 'which', 'playwright'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit']
  })
  const playwrightBin = whichResult.stdout.trim()
  if (whichResult.status !== 0 || !playwrightBin) {
    throw new Error('Playwright package is unavailable and npx could not prepare it. Open this self-hosted route manually: ' + url)
  }
  const playwrightNodeModules = dirname(dirname(playwrightBin))
  const fallbackScript = `
    const { mkdir } = require('node:fs/promises')
    const { createRequire } = require('node:module')
    const { join } = require('node:path')
    const requireFromPlaywright = createRequire(join(process.env.PLAYWRIGHT_NODE_MODULES, 'playwright', 'package.json'))
    const { chromium } = requireFromPlaywright('playwright')

    ;(async () => {
      const url = process.env.GOAGENT_CAPTURE_URL
      const outDir = process.env.GOAGENT_CAPTURE_OUT
      const targets = ${JSON.stringify(captureTargets)}

      await mkdir(outDir, { recursive: true })
      const browserPath = process.env.GOAGENT_BROWSER_PATH || undefined
      const browser = await chromium.launch({ headless: true, executablePath: browserPath })
      const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 })
      await page.goto(url, { waitUntil: 'domcontentloaded' })
      await page.locator('.ui-gallery').waitFor({ state: 'visible' })
      await page.screenshot({ path: join(outDir, 'ui-gallery-overview.png'), fullPage: true })
      for (const [name, selector] of targets) {
        const locator = page.locator(selector).first()
        if (await locator.count()) {
          await locator.screenshot({ path: join(outDir, name + '.png') })
        }
      }
      const bindButton = page.getByRole('button', { name: '打开 SGF 绑定弹窗' })
      if (await bindButton.count()) {
        await bindButton.click()
        await page.locator('.student-dialog').screenshot({ path: join(outDir, 'student-bind-dialog.png') })
      }
      await browser.close()
    })().catch((error) => {
      console.error(error.message)
      process.exit(1)
    })
  `
  await run('npx', [
    '--yes',
    '-p',
    'playwright',
    'node',
    '-e',
    fallbackScript
  ], {
    env: {
      ...process.env,
      GOAGENT_CAPTURE_URL: url,
      GOAGENT_CAPTURE_OUT: outDir,
      GOAGENT_BROWSER_PATH: systemBrowserPath(),
      PLAYWRIGHT_NODE_MODULES: playwrightNodeModules
    },
    stdio: 'inherit'
  })
  console.log(`Captured UI Gallery screenshots in ${outDir}`)
}

async function capturePage(playwright, url) {
  const browserPath = systemBrowserPath()
  const { chromium } = playwright
  await mkdir(outDir, { recursive: true })
  const browser = await chromium.launch({ headless: true, executablePath: browserPath || undefined })
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 })
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await page.locator('.ui-gallery').waitFor({ state: 'visible' })
  await page.screenshot({ path: join(outDir, 'ui-gallery-overview.png'), fullPage: true })

  for (const [name, selector] of captureTargets) {
    const locator = page.locator(selector).first()
    if (await locator.count()) {
      await locator.screenshot({ path: join(outDir, `${name}.png`) })
    }
  }

  const bindButton = page.getByRole('button', { name: '打开 SGF 绑定弹窗' })
  if (await bindButton.count()) {
    await bindButton.click()
    await page.locator('.student-dialog').screenshot({ path: join(outDir, 'student-bind-dialog.png') })
  }

  await browser.close()
  console.log(`Captured UI Gallery screenshots in ${outDir}`)
}

async function capture() {
  const hosted = configuredUrl ? null : await startRendererServer()
  const url = configuredUrl || hosted?.url
  if (!url) throw new Error('Unable to resolve the UI Gallery URL.')
  const playwright = await loadPlaywright()
  try {
    if (playwright) await capturePage(playwright, url)
    else await captureWithCliFallback(url)
  } finally {
    if (hosted) {
      await new Promise((resolvePromise) => hosted.server.close(resolvePromise))
    }
  }
}

capture().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
