#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export function checkReleaseVersion(ref, version) {
  // A manual branch run builds preview artifacts without publishing a release.
  if (!ref?.startsWith('refs/tags/')) return false
  const expectedRef = `refs/tags/v${version}`
  if (typeof version !== 'string' || !version || ref !== expectedRef) {
    throw new Error(`Release tag ${ref} does not match package.json version ${version}; expected ${expectedRef}`)
  }
  return true
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { version } = JSON.parse(readFileSync('package.json', 'utf8'))
    const matched = checkReleaseVersion(process.env.GITHUB_REF, version)
    console.log(matched
      ? `[release-version] Tag matches package.json v${version}`
      : '[release-version] Branch preview; no release will be published')
  } catch (error) {
    console.error(`[release-version] ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  }
}
