import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, normalize } from 'node:path'
import test from 'node:test'
import ts from 'typescript'

async function loadTs(path, transform = (source) => source) {
  const source = transform(await readFile(new URL(`../${path}`, import.meta.url), 'utf8'))
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 }
  }).outputText
  return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`)
}

async function workspace(t) {
  // Node and PowerShell may expand macOS /var aliases or Windows 8.3 paths.
  const root = await realpath(await mkdtemp(join(tmpdir(), 'goagent Windows 围棋 # ')))
  t.after(() => rm(root, { recursive: true, force: true }))
  await mkdir(join(root, 'scripts'), { recursive: true })
  return root
}

for (const mode of ['dev', 'preview']) {
  test(`development launcher starts ${mode} in a path with spaces, Unicode and #`, { skip: process.platform === 'darwin' }, async (t) => {
    const root = await workspace(t)
    const pkg = join(root, 'node_modules', 'electron-vite')
    await mkdir(pkg, { recursive: true })
    await writeFile(join(pkg, 'package.json'), JSON.stringify({ bin: { 'electron-vite': 'cli.cjs' } }))
    await writeFile(join(pkg, 'cli.cjs'), 'console.log(JSON.stringify({ cwd: process.cwd(), args: process.argv.slice(2) }))')
    await writeFile(join(root, 'scripts', 'start_dev_app.mjs'), await readFile(new URL('../scripts/start_dev_app.mjs', import.meta.url)))
    const result = spawnSync(process.execPath, [join(root, 'scripts', 'start_dev_app.mjs'), ...(mode === 'preview' ? ['--skip-build'] : [])], {
      encoding: 'utf8', timeout: 10_000, windowsHide: true
    })
    assert.equal(result.status, 0, result.stderr || String(result.error))
    assert.deepEqual(JSON.parse(result.stdout.trim()), { cwd: root, args: [mode] })
  })
}

for (const script of ['teacher_llm_smoke.mjs', 'teacher_llm_real_smoke.mjs']) {
  test(`${script} resolves the native Electron binary and decoded workspace path`, async (t) => {
    const root = await workspace(t)
    const pkg = join(root, 'node_modules', 'electron')
    await mkdir(pkg, { recursive: true })
    await writeFile(join(pkg, 'package.json'), JSON.stringify({ main: 'index.cjs' }))
    const nativePath = join(pkg, 'dist', process.platform === 'win32' ? 'electron.exe' : 'electron')
    await writeFile(join(pkg, 'index.cjs'), `module.exports = ${JSON.stringify(nativePath)}`)
    const source = await readFile(new URL(`../scripts/${script}`, import.meta.url), 'utf8')
    const prelude = source.slice(0, source.indexOf('function freePort()'))
    await writeFile(join(root, 'scripts', script), `${prelude}\nconsole.log(JSON.stringify({ root, electronBin }))`)
    const result = spawnSync(process.execPath, [join(root, 'scripts', script)], { encoding: 'utf8', timeout: 10_000, windowsHide: true })
    assert.equal(result.status, 0, result.stderr || String(result.error))
    const values = JSON.parse(result.stdout)
    assert.equal(normalize(values.root).replace(/[\\/]$/, ''), root)
    assert.equal(values.electronBin, nativePath)
  })
}

const { splitCommandLine, buildIKataGoAnalysisCommand } = await loadTs('src/main/services/ikatagoClientEngine.ts')

test('iKataGo preserves Windows drive paths, UNC paths, Unicode and empty arguments', () => {
  assert.deepEqual(splitCommandLine(String.raw`--config "C:\围棋 数据\config.cfg" --cache \\server\share\cache --name ""`, 'win32'), [
    '--config', String.raw`C:\围棋 数据\config.cfg`, '--cache', String.raw`\\server\share\cache`, '--name', ''
  ])
  assert.deepEqual(splitCommandLine(String.raw`"C:\Go Data\\" "a\"b"`, 'win32'), ['C:\\Go Data\\', 'a"b'])
})

test('iKataGo keeps POSIX escaping and literal backslashes inside single quotes', () => {
  assert.deepEqual(splitCommandLine(String.raw`--config /tmp/Go\ Data/config.cfg --name "" --literal 'a\b'`, 'linux'), [
    '--config', '/tmp/Go Data/config.cfg', '--name', '', '--literal', String.raw`a\b`
  ])
})

test('iKataGo passes a Windows config path unchanged to the analysis process', { skip: process.platform !== 'win32' }, () => {
  const command = buildIKataGoAnalysisCommand({
    ikatagoClientBin: 'C:\\Go Tools\\ikatago.exe', ikatagoPlatform: 'all', ikatagoUsername: 'test', ikatagoPassword: 'test',
    ikatagoWorldUrl: '', ikatagoExtraArgs: String.raw`--config "C:\围棋 数据\config.cfg"`
  })
  assert.deepEqual(command.slice(-4), ['--config', String.raw`C:\围棋 数据\config.cfg`, '--', 'analysis'])
})

const { teacherShellCommand } = await loadTs('src/main/services/teacher/shellCommand.ts')

test('teacher shell chooses Windows PowerShell and retains configured POSIX shells', () => {
  const windows = teacherShellCommand('Write-Output test', 'win32', { SystemRoot: 'D:\\Windows', SHELL: '/bin/bash' })
  assert.equal(windows.command, 'D:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe')
  assert.deepEqual(windows.args.slice(0, 4), ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command'])
  assert.deepEqual(teacherShellCommand('printf test', 'linux', {}), { command: '/bin/sh', args: ['-lc', 'printf test'] })
  assert.deepEqual(teacherShellCommand('printf test', 'darwin', { SHELL: '/bin/zsh' }), { command: '/bin/zsh', args: ['-lc', 'printf test'] })
})

test('teacher shell executes on Windows with UTF-8 output and a Unicode working directory', { skip: process.platform !== 'win32' }, async (t) => {
  const root = await workspace(t)
  const shell = teacherShellCommand("Write-Output '围棋 测试'; Write-Output (Get-Location).Path")
  const result = spawnSync(shell.command, shell.args, { cwd: root, encoding: 'utf8', timeout: 10_000, windowsHide: true })
  assert.equal(result.status, 0, result.stderr || String(result.error))
  assert.deepEqual(result.stdout.trim().split(/\r?\n/), ['围棋 测试', root])
  const failure = teacherShellCommand('exit 7')
  assert.equal(spawnSync(failure.command, failure.args, { timeout: 10_000, windowsHide: true }).status, 7)
})

test('KataGo discovery reads Windows PATH directly and refreshes when it changes', { skip: process.platform !== 'win32' }, async (t) => {
  const root = await workspace(t)
  const bin = join(root, '引擎 bin')
  const other = join(root, 'other')
  await mkdir(bin)
  await mkdir(other)
  await writeFile(join(bin, 'katago.exe'), '')
  await mkdir(join(other, 'katago.exe'))
  const originalPath = process.env.PATH
  t.after(() => { process.env.PATH = originalPath })
  const runtime = await loadTs('src/main/services/katagoRuntime.ts', (source) => {
    // Exercise the private discovery function unchanged, without loading the
    // Electron store or launching version probes for the rest of the runtime.
    const discovery = source.slice(source.indexOf('let pathKatagoLookup:'), source.indexOf('function binaryCandidates()'))
    return `import { statSync } from 'node:fs'; import { join } from 'node:path'; import { execFileSync } from 'node:child_process';\n${discovery}\nexport { pathKatago }`
  })
  process.env.PATH = `${other};"${bin}"`
  assert.equal(runtime.pathKatago(), join(bin, 'katago.exe'))
  process.env.PATH = other
  assert.equal(runtime.pathKatago(), '')
})

test('Python review materializes packaged scripts outside app.asar independently of the launch directory', async (t) => {
  const root = await workspace(t)
  const appRoot = join(root, 'resources', 'app.asar')
  const appHome = join(root, '用户 data')
  await mkdir(join(appRoot, 'scripts'), { recursive: true })
  await writeFile(join(appRoot, 'scripts', 'review_game.py'), 'print("围棋")\n')
  await writeFile(join(appRoot, 'scripts', 'requirements.txt'), 'sgfmill==1.1.1\n')
  const runtime = await loadTs('src/main/services/pythonRuntime.ts', (source) => source
    .replace("import { app } from 'electron'", `const app = { getAppPath: () => ${JSON.stringify(appRoot)} }`)
    .replace("import { appHome } from '@main/lib/store'", `const appHome = ${JSON.stringify(appHome)}`))
  const requirements = await runtime.materializeReviewScripts(join(root, 'unrelated launch directory'))
  assert.equal(runtime.reviewScriptPath, join(appHome, 'runtime', 'review_game.py'))
  assert.equal(await readFile(runtime.reviewScriptPath, 'utf8'), 'print("围棋")\n')
  assert.equal(await readFile(requirements, 'utf8'), 'sgfmill==1.1.1\n')
  await writeFile(join(appRoot, 'scripts', 'review_game.py'), 'print("updated")\n')
  await runtime.materializeReviewScripts(root)
  assert.equal(await readFile(runtime.reviewScriptPath, 'utf8'), 'print("updated")\n')
})

test('UI gallery builds and captures through native package-manager entries without Unix which', async (t) => {
  const root = await workspace(t)
  const vite = join(root, 'node_modules', 'electron-vite')
  const runnerRoot = join(root, 'runner', 'node_modules')
  const playwright = join(runnerRoot, 'playwright')
  await mkdir(vite, { recursive: true })
  await mkdir(playwright, { recursive: true })
  await mkdir(join(runnerRoot, '.bin'))
  await writeFile(join(vite, 'package.json'), JSON.stringify({ bin: { 'electron-vite': 'cli.cjs' } }))
  await writeFile(join(vite, 'cli.cjs'), `
    const fs = require('node:fs')
    if (process.argv[2] !== 'build') process.exit(2)
    fs.mkdirSync('out/renderer', { recursive: true })
    fs.writeFileSync('out/renderer/index.html', '<html></html>')
  `)
  await writeFile(join(playwright, 'package.json'), JSON.stringify({ main: 'index.cjs' }))
  await writeFile(join(playwright, 'index.cjs'), `
    const { writeFile } = require('node:fs/promises')
    const capture = async ({ path }) => writeFile(path, 'captured')
    const locator = { first: () => locator, waitFor: async () => {}, count: async () => 0, screenshot: capture }
    const chromium = { launch: async () => ({
      newPage: async () => ({ goto: async () => {}, locator: () => locator, getByRole: () => locator, screenshot: capture }),
      close: async () => {}
    }) }
    // Real Playwright's CommonJS entry forwards dynamically generated exports.
    module.exports = Object.fromEntries([['chromium', chromium]])
  `)
  const manager = join(root, 'pnpm.mjs')
  await writeFile(manager, `
    import assert from 'node:assert/strict'
    import { spawnSync } from 'node:child_process'
    import { delimiter } from 'node:path'
    assert.deepEqual(process.argv.slice(2, 5), ['--package=playwright', 'dlx', 'node'])
    const result = spawnSync(process.execPath, [process.argv[5]], {
      env: { ...process.env, PATH: ${JSON.stringify(join(runnerRoot, '.bin'))} + delimiter + process.env.PATH },
      stdio: 'inherit', windowsHide: true
    })
    process.exit(result.status ?? 1)
  `)
  await writeFile(join(root, 'scripts', 'capture_ui_gallery.mjs'), await readFile(new URL('../scripts/capture_ui_gallery.mjs', import.meta.url)))
  const result = spawnSync(process.execPath, [join(root, 'scripts', 'capture_ui_gallery.mjs')], {
    cwd: root, encoding: 'utf8', timeout: 10_000, windowsHide: true,
    env: { ...process.env, npm_execpath: manager, GOAGENT_UI_GALLERY_URL: '', GOAGENT_UI_GALLERY_OUT: '', GOAGENT_UI_GALLERY_SKIP_BUILD: '0', GOAGENT_PLAYWRIGHT_MODULE: '' }
  })
  assert.equal(result.status, 0, result.stderr || String(result.error))
  assert.equal(await readFile(join(root, 'ui-gallery-overview.png'), 'utf8'), 'captured')
})
