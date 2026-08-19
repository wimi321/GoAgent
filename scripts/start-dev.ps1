param(
  [switch]$SkipInstall
)

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$dataRoot = Join-Path $projectRoot '.goagent-dev-data'
$kataGoBinary = 'D:\KataGo\katago.exe'
$kataGoModel = 'D:\KataGo\b18c384nbt-humanv0.bin.gz'

function Require-Command([string]$name) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    throw "找不到 $name。请先安装它并重新运行此脚本。"
  }
}

Require-Command node
Require-Command corepack

if (-not (Test-Path -LiteralPath $kataGoBinary)) {
  throw "找不到 KataGo 引擎：$kataGoBinary"
}
if (-not (Test-Path -LiteralPath $kataGoModel)) {
  throw "找不到 KataGo 模型：$kataGoModel"
}

# Keep development-only package-manager files and application data outside the release build.
$env:COREPACK_HOME = Join-Path $projectRoot '.corepack'
$env:GOAGENT_APP_HOME = $dataRoot
$env:ELECTRON_CACHE = Join-Path $projectRoot '.electron-cache'
$env:electron_config_cache = $env:ELECTRON_CACHE
# The official GitHub release CDN is often slow or unavailable on mainland networks.
$env:ELECTRON_MIRROR = 'https://npmmirror.com/mirrors/electron/'
New-Item -ItemType Directory -Force -Path $dataRoot | Out-Null

# The Electron dev launcher invokes `pnpm` itself. Make a local shim so that
# the pinned Corepack pnpm remains available to that child process too.
$toolRoot = Join-Path $projectRoot '.dev-tools'
New-Item -ItemType Directory -Force -Path $toolRoot | Out-Null
$pnpmShim = Join-Path $toolRoot 'pnpm.cmd'
@"
@echo off
corepack pnpm %*
"@ | Set-Content -LiteralPath $pnpmShim -Encoding ascii
$env:PATH = "$toolRoot;$env:PATH"

# Persist the local KataGo paths for the source build, without overwriting other settings.
$settingsPath = Join-Path $dataRoot 'settings.json'
if (Test-Path -LiteralPath $settingsPath) {
  $settings = Get-Content -Raw -LiteralPath $settingsPath | ConvertFrom-Json -AsHashtable
} else {
  $settings = @{}
}
if ([string]::IsNullOrWhiteSpace([string]$settings['katagoBin'])) {
  $settings['katagoBin'] = $kataGoBinary
}
if ([string]::IsNullOrWhiteSpace([string]$settings['katagoModel'])) {
  $settings['katagoModel'] = $kataGoModel
}
# The local OpenCL engine is KataGo v1.15. The default Transformer presets
# require v1.17+, while the supplied b18 model is compatible with this engine.
if ([string]::IsNullOrWhiteSpace([string]$settings['katagoModelPreset']) -or $settings['katagoModelPreset'] -eq 'official-transformer-balanced') {
  $settings['katagoModelPreset'] = 'official-b18-recommended'
}
$settings | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $settingsPath -Encoding utf8

Set-Location $projectRoot
if (-not $SkipInstall -and -not (Test-Path -LiteralPath (Join-Path $projectRoot 'node_modules\electron\dist\electron.exe'))) {
  Write-Host '首次运行：安装 Node.js 依赖…'
  corepack pnpm install --frozen-lockfile
  if ($LASTEXITCODE -ne 0) { throw 'Node.js 依赖安装失败。' }
}

Write-Host "启动 GoAgent 源码开发版。开发数据目录：$dataRoot"
# `pnpm dev` delegates to a Node wrapper which launches pnpm again. Invoke the
# Windows development target directly so the pinned local Corepack runtime is
# used reliably even when pnpm is not installed globally.
corepack pnpm exec electron-vite dev
if ($LASTEXITCODE -ne 0) { throw 'GoAgent 开发版启动失败。' }
