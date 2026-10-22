#!/usr/bin/env node
import { createServer } from 'node:http'
import { existsSync } from 'node:fs'
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { extname, join, resolve, sep } from 'node:path'
import { spawn } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const require = createRequire(import.meta.url)

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
    const packagePath = require.resolve('electron-vite/package.json')
    const bin = require(packagePath).bin['electron-vite']
    await run(process.execPath, [resolve(packagePath, '..', bin), 'build'], { cwd: process.cwd(), env: process.env })
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
    const loaded = process.env.GOAGENT_PLAYWRIGHT_MODULE
      ? await import(pathToFileURL(process.env.GOAGENT_PLAYWRIGHT_MODULE).href)
      : await import('playwright')
    return loaded.chromium ? loaded : loaded.default
  } catch {
    return null
  }
}

async function captureWithCliFallback(url) {
  // npm/pnpm expose their JS entry when invoked as a package script. Running it
  // with Node avoids .cmd spawning and shell quoting on Windows.
  const manager = process.env.npm_execpath
  if (!manager || !/\.(?:c?js|mjs)$/i.test(manager)) {
    throw new Error('Playwright is unavailable. Run `pnpm capture:ui-gallery` to prepare it, or install Playwright locally. Preview: ' + url)
  }
  const temporary = await mkdtemp(join(tmpdir(), 'goagent-gallery-'))
  try {
    const wrapper = join(temporary, 'capture.cjs')
    await writeFile(wrapper, `
      const { existsSync } = require('node:fs')
      const { delimiter, join } = require('node:path')
      const { createRequire } = require('node:module')
      const packageJson = (process.env.PATH || '').split(delimiter)
        .map(directory => join(directory.replace(/^"|"$/g, ''), '..', 'playwright', 'package.json'))
        .find(file => existsSync(file))
      if (!packageJson) throw new Error('The package runner did not provide Playwright')
      process.env.GOAGENT_PLAYWRIGHT_MODULE = createRequire(packageJson).resolve('playwright')
      import(${JSON.stringify(import.meta.url)}).catch(error => { console.error(error); process.exitCode = 1 })
    `, 'utf8')
    const managerArgs = /pnpm/i.test(manager)
      ? ['--package=playwright', 'dlx', 'node', wrapper]
      : ['exec', '--yes', '--package=playwright', '--', 'node', wrapper]
    await run(process.execPath, [manager, ...managerArgs], {
      env: {
        ...process.env,
        GOAGENT_UI_GALLERY_URL: url,
        GOAGENT_UI_GALLERY_OUT: outDir,
        GOAGENT_BROWSER_PATH: systemBrowserPath()
      }
    })
  } finally {
    await rm(temporary, { recursive: true, force: true })
  }
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
