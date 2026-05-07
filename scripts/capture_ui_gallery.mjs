#!/usr/bin/env node
import { mkdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const url = process.env.GOAGENT_UI_GALLERY_URL ?? 'http://localhost:5173/#/ui-gallery'
const outDir = resolve(process.env.GOAGENT_UI_GALLERY_OUT ?? 'release-evidence/ui-gallery')

async function loadPlaywright() {
  try {
    return await import('playwright')
  } catch {
    return null
  }
}

async function captureWithCliFallback() {
  await mkdir(outDir, { recursive: true })
  const overviewPath = join(outDir, 'ui-gallery-overview.png')
  const result = spawnSync('npx', [
    '--yes',
    'playwright',
    'screenshot',
    '--viewport-size=1440,1100',
    '--full-page',
    '--wait-for-selector=.ui-gallery',
    url,
    overviewPath
  ], {
    stdio: 'inherit'
  })
  if (result.status !== 0) {
    throw new Error('Playwright package is not installed and npx playwright screenshot failed. Run pnpm dev, then capture this route manually: ' + url)
  }
  console.log(`Captured UI Gallery overview in ${overviewPath}`)
}

async function capture() {
  const playwright = await loadPlaywright()
  if (!playwright) {
    await captureWithCliFallback()
    return
  }
  const { chromium } = playwright
  await mkdir(outDir, { recursive: true })
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 })
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.screenshot({ path: join(outDir, 'ui-gallery-overview.png'), fullPage: true })

  const targets = [
    ['board', '.ui-gallery__panel--board'],
    ['teacher-card', '.ui-gallery__panel--teacher'],
    ['timeline', '.ks-timeline-v2'],
    ['diagnostics', '.diagnostics-page'],
    ['settings-readiness', '.beta-acceptance-panel']
  ]

  for (const [name, selector] of targets) {
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

capture().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
