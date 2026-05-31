#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const baseBuild = packageJson.build

if (!baseBuild) {
  throw new Error('package.json is missing build configuration')
}

const liteBuild = structuredClone(baseBuild)

liteBuild.artifactName = '${productName}-${version}-${os}-${arch}-lite.${ext}'
liteBuild.extraResources = [
  {
    from: 'data/knowledge',
    to: 'data/knowledge',
    filter: ['**/*']
  },
  {
    from: 'data/katago',
    to: 'data/katago',
    filter: ['manifest.json', 'README.md']
  },
  {
    from: 'data/tts',
    to: 'data/tts',
    filter: ['**/*', '!kokoro/zh-CN/onnx/model_int8.onnx']
  }
]
liteBuild.asarUnpack = ['data/tts/**/*']

liteBuild.win = {
  ...(liteBuild.win ?? {}),
  artifactName: '${productName}-${version}-${os}-${arch}-lite-portable.${ext}'
}

liteBuild.nsis = {
  ...(liteBuild.nsis ?? {}),
  artifactName: '${productName}-${version}-${os}-${arch}-lite.${ext}'
}

const outputPath = join(root, '.release', 'electron-builder-lite.json')
mkdirSync(dirname(outputPath), { recursive: true })
writeFileSync(outputPath, `${JSON.stringify(liteBuild, null, 2)}\n`, 'utf8')
console.log(`[lite-builder] wrote ${outputPath}`)
