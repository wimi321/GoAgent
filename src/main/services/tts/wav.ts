import { readFileSync, unlinkSync, writeFileSync } from 'node:fs'

interface WavChunk {
  offset: number
  size: number
}

interface ParsedWav {
  format: number
  channels: number
  sampleRate: number
  bitsPerSample: number
  fmt: WavChunk
  data: WavChunk
  buffer: Buffer
}

function readChunkSize(buffer: Buffer, offset: number): number {
  if (offset + 8 > buffer.length) return -1
  return buffer.readUInt32LE(offset + 4)
}

function parseWav(buffer: Buffer): ParsedWav {
  if (buffer.length < 44 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('TTS 输出不是有效 WAV 文件。')
  }
  let fmt: WavChunk | null = null
  let data: WavChunk | null = null
  for (let offset = 12; offset + 8 <= buffer.length;) {
    const id = buffer.toString('ascii', offset, offset + 4)
    const size = readChunkSize(buffer, offset)
    if (size < 0 || offset + 8 + size > buffer.length) break
    const chunk = { offset: offset + 8, size }
    if (id === 'fmt ') fmt = chunk
    if (id === 'data') data = chunk
    offset += 8 + size + (size % 2)
  }
  if (!fmt || fmt.size < 16 || !data) throw new Error('TTS 输出 WAV 缺少 fmt/data 块。')
  return {
    format: buffer.readUInt16LE(fmt.offset),
    channels: buffer.readUInt16LE(fmt.offset + 2),
    sampleRate: buffer.readUInt32LE(fmt.offset + 4),
    bitsPerSample: buffer.readUInt16LE(fmt.offset + 14),
    fmt,
    data,
    buffer
  }
}

function float32Stats(buffer: Buffer, chunk: WavChunk): { valid: boolean; peak: number } {
  let peak = 0
  for (let offset = chunk.offset; offset + 4 <= chunk.offset + chunk.size; offset += 4) {
    const value = buffer.readFloatLE(offset)
    if (!Number.isFinite(value)) return { valid: false, peak: 0 }
    peak = Math.max(peak, Math.abs(value))
  }
  return { valid: peak > 0.00001, peak }
}

function pcm16Stats(buffer: Buffer, chunk: WavChunk): { valid: boolean; peak: number } {
  let peak = 0
  for (let offset = chunk.offset; offset + 2 <= chunk.offset + chunk.size; offset += 2) {
    peak = Math.max(peak, Math.abs(buffer.readInt16LE(offset)))
  }
  return { valid: peak > 0, peak }
}

function floatToInt16(value: number): number {
  const clipped = Math.max(-1, Math.min(1, value))
  return clipped < 0 ? Math.round(clipped * 32768) : Math.round(clipped * 32767)
}

function buildPcm16Wav(parsed: ParsedWav): Buffer {
  const sampleCount = Math.floor(parsed.data.size / 4)
  const pcm = Buffer.alloc(sampleCount * 2)
  for (let input = parsed.data.offset, output = 0; input + 4 <= parsed.data.offset + parsed.data.size; input += 4, output += 2) {
    pcm.writeInt16LE(floatToInt16(parsed.buffer.readFloatLE(input)), output)
  }

  const fmtSize = 16
  const riffSize = 4 + (8 + fmtSize) + (8 + pcm.length)
  const wav = Buffer.alloc(8 + riffSize)
  wav.write('RIFF', 0, 'ascii')
  wav.writeUInt32LE(riffSize, 4)
  wav.write('WAVE', 8, 'ascii')
  wav.write('fmt ', 12, 'ascii')
  wav.writeUInt32LE(fmtSize, 16)
  wav.writeUInt16LE(1, 20)
  wav.writeUInt16LE(parsed.channels, 22)
  wav.writeUInt32LE(parsed.sampleRate, 24)
  wav.writeUInt32LE(parsed.sampleRate * parsed.channels * 2, 28)
  wav.writeUInt16LE(parsed.channels * 2, 32)
  wav.writeUInt16LE(16, 34)
  wav.write('data', 36, 'ascii')
  wav.writeUInt32LE(pcm.length, 40)
  pcm.copy(wav, 44)
  return wav
}

function buildPcm16WavFromData(sampleRate: number, channels: number, pcm: Buffer): Buffer {
  const fmtSize = 16
  const riffSize = 4 + (8 + fmtSize) + (8 + pcm.length)
  const wav = Buffer.alloc(8 + riffSize)
  wav.write('RIFF', 0, 'ascii')
  wav.writeUInt32LE(riffSize, 4)
  wav.write('WAVE', 8, 'ascii')
  wav.write('fmt ', 12, 'ascii')
  wav.writeUInt32LE(fmtSize, 16)
  wav.writeUInt16LE(1, 20)
  wav.writeUInt16LE(channels, 22)
  wav.writeUInt32LE(sampleRate, 24)
  wav.writeUInt32LE(sampleRate * channels * 2, 28)
  wav.writeUInt16LE(channels * 2, 32)
  wav.writeUInt16LE(16, 34)
  wav.write('data', 36, 'ascii')
  wav.writeUInt32LE(pcm.length, 40)
  pcm.copy(wav, 44)
  return wav
}

export function prepareWavForBrowserPlayback(path: string): boolean {
  try {
    const parsed = parseWav(readFileSync(path))
    if (parsed.format === 1 && parsed.bitsPerSample === 16) {
      return pcm16Stats(parsed.buffer, parsed.data).valid
    }
    if (parsed.format === 3 && parsed.bitsPerSample === 32) {
      if (!float32Stats(parsed.buffer, parsed.data).valid) return false
      writeFileSync(path, buildPcm16Wav(parsed))
      return true
    }
    return false
  } catch {
    return false
  }
}

export function removeInvalidWavCache(path: string): void {
  try {
    unlinkSync(path)
  } catch {
    // Best-effort cache cleanup. The caller will surface synthesis errors.
  }
}

export function concatPcm16WavFiles(inputs: string[], output: string): boolean {
  try {
    const parsed = inputs.map((path) => parseWav(readFileSync(path)))
    if (parsed.length === 0) return false
    const [first] = parsed
    if (first.format !== 1 || first.bitsPerSample !== 16 || !pcm16Stats(first.buffer, first.data).valid) return false
    const pcmParts: Buffer[] = []
    for (const item of parsed) {
      if (
        item.format !== 1 ||
        item.bitsPerSample !== 16 ||
        item.channels !== first.channels ||
        item.sampleRate !== first.sampleRate ||
        !pcm16Stats(item.buffer, item.data).valid
      ) {
        return false
      }
      pcmParts.push(item.buffer.subarray(item.data.offset, item.data.offset + item.data.size))
    }
    writeFileSync(output, buildPcm16WavFromData(first.sampleRate, first.channels, Buffer.concat(pcmParts)))
    return prepareWavForBrowserPlayback(output)
  } catch {
    return false
  }
}
