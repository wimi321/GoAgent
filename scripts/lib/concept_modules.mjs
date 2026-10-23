import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'

// Execute the real recognizers in Node, with only Electron's app path lookup stubbed.
const urls = new Map()
export function conceptModuleUrl(relative, revision) {
  if (revision && !/^[a-f0-9]{7,40}$/.test(revision)) throw new Error('Expected a pinned commit hash')
  const key = `${revision ?? 'working'}:${relative}`
  if (urls.has(key)) return urls.get(key)
  const path = new URL(`../../${relative}`, import.meta.url)
  const input = revision ? execFileSync('git', ['show', `${revision}:${relative}`], { cwd: fileURLToPath(new URL('../../', import.meta.url)), encoding: 'utf8' }) : readFileSync(path, 'utf8')
  let source = ts.transpileModule(input, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 }
  }).outputText
  source = source.replace(/from ['"]([^'"]+)['"]/g, (match, spec) => {
    if (spec === 'electron') return `from 'data:text/javascript,export const app={isPackaged:false}'`
    if (spec.startsWith('node:')) return match
    if (!spec.startsWith('.')) throw new Error(`Unexpected runtime dependency: ${spec}`)
    const dependency = new URL(`${spec}.ts`, path)
    const root = new URL('../../', import.meta.url)
    const relativeDependency = fileURLToPath(dependency).slice(fileURLToPath(root).length).replaceAll('\\', '/')
    return `from '${conceptModuleUrl(relativeDependency, revision)}'`
  })
  const url = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
  urls.set(key, url)
  return url
}

export async function loadConceptModule(relative, revision) { return import(conceptModuleUrl(relative, revision)) }
