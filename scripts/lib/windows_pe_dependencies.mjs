import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { NVRTC } from './nvidia_nvrtc.mjs'

// Parse normal and delay imports; this deliberately does not claim to discover
// DLL names assembled at runtime via LoadLibrary (NVRTC builtins is explicit).
export function peImports(bytes) {
  if (bytes.toString('ascii', 0, 2) !== 'MZ') throw new Error('Not a PE binary')
  const pe = bytes.readUInt32LE(0x3c)
  if (bytes.toString('ascii', pe, pe + 4) !== 'PE\0\0') throw new Error('Invalid PE signature')
  const machine = bytes.readUInt16LE(pe + 4)
  if (machine !== 0x8664) throw new Error(`Expected x64 PE, machine=0x${machine.toString(16)}`)
  const optional = pe + 24
  if (bytes.readUInt16LE(optional) !== 0x20b) throw new Error('Expected PE32+')
  const directory = optional + 112
  const sections = []
  for (let i = 0; i < bytes.readUInt16LE(pe + 6); i++) {
    const s = optional + bytes.readUInt16LE(pe + 20) + 40 * i
    sections.push({ va: bytes.readUInt32LE(s + 12), size: Math.max(bytes.readUInt32LE(s + 8), bytes.readUInt32LE(s + 16)), raw: bytes.readUInt32LE(s + 20) })
  }
  const offset = (rva) => {
    const s = sections.find((s) => rva >= s.va && rva < s.va + s.size)
    if (!s) throw new Error(`Invalid PE RVA: ${rva}`)
    return s.raw + rva - s.va
  }
  const name = (rva) => {
    const start = offset(rva), end = bytes.indexOf(0, start)
    if (end < 0) throw new Error('Unterminated PE import name')
    const value = bytes.toString('ascii', start, end)
    if (!/^[\w.-]+\.dll$/i.test(value)) throw new Error(`Invalid import DLL: ${value}`)
    return value
  }
  const imports = []
  for (const [index, stride, nameOffset] of [[1, 20, 12], [13, 32, 4]]) {
    const rva = bytes.readUInt32LE(directory + index * 8)
    if (!rva) continue
    for (let p = offset(rva); bytes.readUInt32LE(p + nameOffset); p += stride) {
      // PE32+ delay descriptors must use RVAs, not truncated 32-bit VAs.
      if (index === 13 && !(bytes.readUInt32LE(p) & 1)) throw new Error('Unsupported delay-import VA descriptor')
      imports.push(name(bytes.readUInt32LE(p + nameOffset)))
    }
  }
  return imports
}

// OS/driver dependencies only. Never allow a CUDA Toolkit DLL to be supplied
// by System32 or the developer's PATH; every other import must be app-local.
export function isWindowsSystemDependency(name) {
  return /^(?:api-ms-|ext-ms-)/i.test(name) || /^(?:kernel32|user32|gdi32|advapi32|shell32|shlwapi|ole32|oleaut32|ws2_32|crypt32|bcrypt|ncrypt|secur32|normaliz|version|winmm|winhttp|wininet|iphlpapi|psapi|setupapi|cfgmgr32|ntdll|rpcrt4|comdlg32|comctl32|dbghelp|msvcrt|ucrtbase|d3d12|dxgi|nvcuda)\.dll$/i.test(name)
}

export async function checkWindowsRuntimeDependencies(runtime, { nvidia = false } = {}) {
  const names = new Map((await readdir(runtime)).map((name) => [name.toLowerCase(), name]))
  const queue = ['katago.exe'], seen = new Set(), imports = []
  while (queue.length) {
    const next = queue.shift().toLowerCase()
    if (seen.has(next)) continue
    seen.add(next)
    const actual = names.get(next)
    if (!actual) throw new Error(`Missing bundled dependency: ${next}`)
    const deps = peImports(await readFile(join(runtime, actual)))
    for (const dep of deps) {
      imports.push({ from: actual, dll: dep })
      if (names.has(dep.toLowerCase())) queue.push(dep)
      else if (!isWindowsSystemDependency(dep)) throw new Error(`Missing bundled dependency: ${actual} -> ${dep}`)
    }
  }
  if (nvidia) {
    for (const [name, expected] of Object.entries(NVRTC.files)) {
      const actual = names.get(name.toLowerCase())
      if (!actual) throw new Error(`Missing bundled NVRTC component: ${name}`)
      const hash = createHash('sha256').update(await readFile(join(runtime, actual))).digest('hex')
      if (hash !== expected) throw new Error(`Bundled NVRTC hash mismatch: ${name}`)
    }
    const license = await readFile(join(runtime, 'licenses/nvidia-runtime/cuda_nvrtc-LICENSE'))
    if (createHash('sha256').update(license).digest('hex') !== NVRTC.licenseSha256) throw new Error('NVRTC license hash mismatch')
  }
  return { checkedBinaries: [...seen], imports }
}
