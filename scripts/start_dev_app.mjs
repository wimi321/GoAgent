#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(new URL('..', import.meta.url).pathname)
const args = new Set(process.argv.slice(2))
const skipBuild = args.has('--skip-build')
const devOutputDir = join(root, '.dev-release')
const builderCacheDir = join(root, '.dev-cache', 'electron-builder')

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
    ...options
  })
  if (result.error) {
    throw result.error
  }
  if (typeof result.status === 'number' && result.status !== 0) {
    process.exit(result.status)
  }
}

function findFirstApp(directory) {
  if (!existsSync(directory)) {
    return null
  }
  const entries = readdirSync(directory, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = join(directory, entry.name)
    if (entry.isDirectory() && entry.name.endsWith('.app')) {
      return fullPath
    }
    if (entry.isDirectory()) {
      const nested = findFirstApp(fullPath)
      if (nested) {
        return nested
      }
    }
  }
  return null
}

if (process.platform === 'darwin') {
  if (!skipBuild) {
    // The afterPack hook embeds the checksummed Codex App Server runtime and fails on a
    // fresh clone without it. The script is a no-op once the binary is verified.
    run('node', ['scripts/prepare_codex_runtime.mjs', `--platform=${process.platform}-${process.arch}`])
    run('pnpm', ['exec', 'electron-vite', 'build'])
    run(
      'pnpm',
      [
        'exec',
        'electron-builder',
        '--mac',
        'dir',
        '--publish',
        'never',
        '-c.directories.output=.dev-release',
        '-c.mac.target=dir',
        '-c.mac.notarize=false',
        '-c.mac.identity=null'
      ],
      {
        env: {
          ...process.env,
          ELECTRON_BUILDER_CACHE: builderCacheDir
        }
      }
    )
  }

  const appPath = findFirstApp(devOutputDir)
  if (!appPath) {
    throw new Error('GoAgent dev app was not found. Run `pnpm dev` once before `pnpm preview`.')
  }
  run('open', ['-n', appPath])
  console.log(`GoAgent dev app launched from ${appPath}`)
} else {
  run('pnpm', ['exec', 'electron-vite', skipBuild ? 'preview' : 'dev'])
}
