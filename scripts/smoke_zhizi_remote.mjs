#!/usr/bin/env node
import { createDecipheriv, scryptSync } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import os from 'node:os'
import { join } from 'node:path'

import {
  buildZhiziRemoteArgs,
  parseKataAnalyzeInfo,
  zhiziAnalysisReachedVisits
} from '../src/main/services/zhiziGtpProtocol.ts'
import { ZhiziPersistentSession } from '../src/main/services/zhiziSocketSession.ts'

const strict = process.env.GOAGENT_ZHIZI_REAL === '1'
const appHome = process.env.GOAGENT_APP_HOME || join(os.homedir(), '.goagent')
const settingsPath = join(appHome, 'settings.json')
const secretsPath = join(appHome, 'secrets.json')
const keyPath = join(appHome, 'secrets.key')

function skipped(reason) {
  console.log(JSON.stringify({ status: 'skipped', reason }, null, 2))
  if (strict) process.exitCode = 1
}

function decryptLocalSecret(secret) {
  if (!secret || secret.mode !== 'local-v1') return ''
  const seed = readFileSync(keyPath, 'utf8').trim()
  const key = scryptSync(seed, 'goagent-local-secret-store-v1', 32)
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(secret.iv, 'base64'))
  decipher.setAuthTag(Buffer.from(secret.tag, 'base64'))
  return Buffer.concat([
    decipher.update(Buffer.from(secret.value, 'base64')),
    decipher.final()
  ]).toString('utf8')
}

function responseCount(text) {
  return (text.match(/\r?\n\r?\n/g) ?? []).length
}

async function sendSetup(session, signal, commands) {
  const start = session.output().stdout.length
  const disconnectVersion = session.captureDisconnectVersion()
  session.send(`${commands.join('\n')}\n`)
  await session.waitUntil(
    () => responseCount(session.output().stdout.slice(start)) >= commands.length,
    15_000,
    'Zhizi smoke setup',
    signal,
    disconnectVersion
  )
  const output = session.output().stdout.slice(start)
  if (/(?:^|\n)\?/.test(output.trim())) {
    throw new Error(`GTP setup rejected: ${output.trim().slice(0, 300)}`)
  }
}

async function analyze(session, signal, id, moves) {
  session.clearOutput()
  await sendSetup(session, signal, [
    'boardsize 19',
    'kata-set-rules chinese',
    'komi 7.5',
    'clear_board',
    ...moves.map(([color, point]) => `play ${color} ${point}`)
  ])
  const start = session.output().stdout.length
  const disconnectVersion = session.captureDisconnectVersion()
  const player = moves.at(-1)?.[0] === 'B' ? 'W' : 'B'
  session.send(`kata-analyze ${player} 25 rootInfo true maxmoves 8\n`)
  let response
  const startedAt = Date.now()
  await session.waitUntil(
    () => {
      const output = session.output().stdout.slice(start)
      if (!/\binfo\s+/.test(output)) return false
      const parsed = parseKataAnalyzeInfo(output, player, id)
      if (!parsed.moveInfos?.length) return false
      response = parsed
      return zhiziAnalysisReachedVisits(parsed, 64)
    },
    30_000,
    'Zhizi smoke analysis',
    signal,
    disconnectVersion
  )
  session.send('stop\n')
  await session.waitUntil(
    () => responseCount(session.output().stdout.slice(start)) >= 1,
    10_000,
    'Zhizi smoke stop',
    signal,
    disconnectVersion
  )
  return {
    id,
    elapsedMillis: Date.now() - startedAt,
    topMove: response.moveInfos[0].move,
    visits: response.moveInfos.reduce((sum, move) => sum + Number(move.visits ?? 0), 0),
    winrate: response.rootInfo?.winrate,
    scoreLead: response.rootInfo?.scoreLead
  }
}

if (!strict) {
  skipped('Set GOAGENT_ZHIZI_REAL=1 to run the real Zhizi cloud smoke test.')
} else if (![settingsPath, secretsPath, keyPath].every(existsSync)) {
  skipped('GoAgent local settings or secret files are missing.')
} else {
  const settings = JSON.parse(readFileSync(settingsPath, 'utf8'))
  const secrets = JSON.parse(readFileSync(secretsPath, 'utf8'))
  const accountToken = decryptLocalSecret(secrets.zhiziToken)
  if (!accountToken) {
    skipped('No locally saved Zhizi token is available.')
  } else {
    const gpuType = String(settings.zhiziGpuType || 'vip-share')
    const args = buildZhiziRemoteArgs({
      zhiziGpuType: gpuType,
      zhiziExtraArgs: String(settings.zhiziExtraArgs || '')
    })
    const session = new ZhiziPersistentSession({ accountToken, args, gpuType })
    const controller = new AbortController()
    try {
      const results = await session.runExclusive(controller.signal, async (channel) => [
        await analyze(channel, controller.signal, 'smoke-1', [
          ['B', 'D4'],
          ['W', 'Q16'],
          ['B', 'Q4']
        ]),
        await analyze(channel, controller.signal, 'smoke-2', [
          ['B', 'D4'],
          ['W', 'Q16'],
          ['B', 'Q4'],
          ['W', 'D16']
        ])
      ])
      const telemetry = session.telemetry()
      console.log(JSON.stringify({
        status: 'passed',
        gpuType,
        connectionCount: telemetry.connectionCount,
        sessionReadyMillis: telemetry.lastReadyMillis,
        results
      }, null, 2))
      if (telemetry.connectionCount !== 1) {
        throw new Error(`Expected one persistent connection, received ${telemetry.connectionCount}.`)
      }
    } catch (error) {
      console.error(JSON.stringify({
        status: 'failed',
        error: error instanceof Error ? error.message : String(error)
      }, null, 2))
      process.exitCode = 1
    } finally {
      session.close()
    }
  }
}
