#!/usr/bin/env node
import { createDecipheriv, scryptSync } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import os from 'node:os'
import { join } from 'node:path'
import { tsImport } from 'tsx/esm/api'

const protocol = await tsImport('../src/main/services/zhiziGtpProtocol.ts', import.meta.url)
const api = await tsImport('../src/main/services/zhiziApiClient.ts', import.meta.url)
const { ZhiziPersistentSession } = await tsImport(
  '../src/main/services/zhiziSocketSession.ts',
  import.meta.url
)

const {
  buildZhiziRemoteArgs,
  findGtpCommandResponse,
  formatGtpCommand,
  parseKataAnalyzeInfo,
  zhiziAnalysisReachedVisits
} = protocol

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

async function sendCommand(session, signal, id, command, timeoutMs = 60_000) {
  const start = session.output().stdout.length
  const disconnectVersion = session.captureDisconnectVersion()
  const generation = session.captureGeneration()
  session.send(formatGtpCommand(id, command))
  let response
  await session.waitUntil(
    () => {
      if (session.captureGeneration() !== generation) return false
      response = findGtpCommandResponse(session.output().stdout.slice(start), id)
      return Boolean(response)
    },
    timeoutMs,
    `Zhizi smoke command ${id}`,
    signal,
    disconnectVersion
  )
  if (!response.ok) throw new Error(`GTP command ${id} rejected: ${response.firstLine}`)
}

async function analyze(session, signal, moves) {
  session.clearOutput()
  let commandId = 1
  for (const command of [
    'boardsize 19',
    'kata-set-rules chinese',
    'komi 7.5',
    'clear_board',
    ...moves.map(([color, point]) => `play ${color} ${point}`)
  ]) {
    await sendCommand(session, signal, commandId, command)
    commandId += 1
  }

  const player = moves.at(-1)?.[0] === 'B' ? 'W' : 'B'
  const start = session.output().stdout.length
  const disconnectVersion = session.captureDisconnectVersion()
  const generation = session.captureGeneration()
  const analysisId = commandId
  session.send(formatGtpCommand(analysisId, `kata-analyze ${player} 25 rootInfo true maxmoves 8`))
  let response
  const startedAt = Date.now()
  await session.waitUntil(
    () => {
      if (session.captureGeneration() !== generation) return false
      const output = session.output().stdout.slice(start)
      if (!/\binfo\s+/.test(output)) return false
      const parsed = parseKataAnalyzeInfo(output, player, 'zhizi-real-smoke')
      if (!parsed.moveInfos?.length) return false
      response = parsed
      return zhiziAnalysisReachedVisits(parsed, 64)
    },
    45_000,
    'Zhizi smoke analysis',
    signal,
    disconnectVersion
  )
  session.send(formatGtpCommand(analysisId + 1, 'stop'))
  return {
    elapsedMillis: Date.now() - startedAt,
    topMove: response.moveInfos[0].move,
    visits: response.moveInfos.reduce((sum, move) => sum + Number(move.visits ?? 0), 0),
    winrate: response.rootInfo?.winrate,
    scoreLead: response.rootInfo?.scoreLead
  }
}

if (!strict) {
  skipped('Set GOAGENT_ZHIZI_REAL=1 to run the saved-account remote smoke test.')
} else if (![settingsPath, secretsPath, keyPath].every(existsSync)) {
  skipped('GoAgent local settings or secret files are missing.')
} else {
  const settings = JSON.parse(readFileSync(settingsPath, 'utf8'))
  const secrets = JSON.parse(readFileSync(secretsPath, 'utf8'))
  const accountToken = decryptLocalSecret(secrets.zhiziToken)
  if (!accountToken) {
    skipped('No locally saved Zhizi login is available. Log in from GoAgent first.')
  } else {
    const profile = {
      zhiziGpuType: settings.zhiziGpuType || 'vip-share',
      zhiziKataName: settings.zhiziKataName || 'katago-TENSORRT',
      zhiziKataWeight: settings.zhiziKataWeight || '28bnbt'
    }
    const args = buildZhiziRemoteArgs(profile)
    const controller = new AbortController()
    const session = new ZhiziPersistentSession({
      accountToken,
      args,
      gpuType: profile.zhiziGpuType
    })
    try {
      const account = await api.getZhiziAccountOverview(accountToken)
      if (!account.tokenValid) throw new Error('Saved Zhizi login is no longer valid.')
      const result = await session.runExclusive(controller.signal, (channel) => analyze(
        channel,
        controller.signal,
        [
          ['B', 'D4'],
          ['W', 'Q16'],
          ['B', 'Q4'],
          ['W', 'D16']
        ]
      ))
      const telemetry = session.telemetry()
      console.log(JSON.stringify({
        status: 'passed',
        account: {
          identifier: account.identifierMasked,
          membership: account.isMembership,
          balanceAvailable: Boolean(account.balance)
        },
        profile,
        session: {
          state: telemetry.state,
          connectionCount: telemetry.connectionCount,
          generation: telemetry.generation,
          readyMillis: telemetry.lastReadyMillis
        },
        result
      }, null, 2))
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
