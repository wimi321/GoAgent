import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import test from 'node:test'
import { tsImport } from 'tsx/esm/api'

const {
  buildZhiziRemoteArgs,
  findGtpCommandResponse,
  formatGtpCommand,
  parseKataAnalyzeInfo,
  parseGtpCommandResponses,
  zhiziAnalysisReachedVisits
} = await tsImport('../src/main/services/zhiziGtpProtocol.ts', import.meta.url)
const { getZhiziCloudAccountStatus } = await tsImport('../src/main/services/zhiziCloudAuth.ts', import.meta.url)
const {
  classifyZhiziRemoteError,
  decodeZhiziSocketPayload,
  ZhiziPersistentSession,
  zhiziStartupRetryDelayMs
} = await tsImport('../src/main/services/zhiziSocketSession.ts', import.meta.url)

class FakeSocket extends EventEmitter {
  connected = false
  active = false
  commands = []

  connect() {
    this.connected = true
    this.active = true
    this.emit('connect')
    this.emit('ready')
  }

  disconnect() {
    this.connected = false
    this.active = false
  }

  emit(event, ...args) {
    if (event === 'stdin') this.commands.push(String(args[0] ?? ''))
    return super.emit(event, ...args)
  }
}

class ManualReadySocket extends FakeSocket {
  connect() {
    this.connected = true
    this.active = true
    this.emit('connect')
  }
}

function fakeSession() {
  const sockets = []
  const socketTokens = []
  const session = new ZhiziPersistentSession(
    {
      accountToken: 'account-token',
      args: '--gpu-type vip-share',
      gpuType: 'vip-share'
    },
    {
      fetchSocketToken: async () => {
        const token = `socket-token-${socketTokens.length + 1}`
        socketTokens.push(token)
        return { socketIOURL: 'https://socket.example', token }
      },
      createSocket: (_url, options) => {
        const socket = new FakeSocket()
        socket.options = options
        sockets.push(socket)
        return socket
      },
      sleep: async (milliseconds) => {
        await new Promise((resolve) => setTimeout(resolve, Math.min(milliseconds, 5)))
      },
      now: Date.now
    }
  )
  return { session, sockets, socketTokens }
}

test('persistent Zhizi session reuses one ready Socket.IO connection', async () => {
  const { session, sockets } = fakeSession()
  const signal = new AbortController().signal
  try {
    await session.runExclusive(signal, async (channel) => {
      channel.send('name\n')
    })
    await session.runExclusive(signal, async (channel) => {
      channel.send('version\n')
    })

    assert.equal(sockets.length, 1)
    assert.deepEqual(sockets[0].commands, ['name\n', 'version\n'])
    assert.equal(session.telemetry().state, 'ready')
    assert.equal(session.telemetry().reusedConnections, 1)
  } finally {
    session.close()
  }
})

test('cancelling a Zhizi task stops the active remote analysis', async () => {
  const { session, sockets } = fakeSession()
  const controller = new AbortController()
  try {
    const task = session.runExclusive(controller.signal, async (channel) => {
      const disconnectVersion = channel.captureDisconnectVersion()
      await channel.waitUntil(
        () => false,
        2_000,
        'test wait',
        controller.signal,
        disconnectVersion
      )
    })
    setTimeout(() => controller.abort(), 10)

    await assert.rejects(task, (error) => error?.code === 'cancelled')
    assert.equal(sockets[0].commands.includes('stop\n'), true)
  } finally {
    session.close()
  }
})

test('releasing a Zhizi session interrupts in-flight waits immediately', async () => {
  const { session } = fakeSession()
  const controller = new AbortController()
  const task = session.runExclusive(controller.signal, async (channel) => {
    const disconnectVersion = channel.captureDisconnectVersion()
    await channel.waitUntil(
      () => false,
      5_000,
      'test wait',
      controller.signal,
      disconnectVersion
    )
  })
  setTimeout(() => session.close(), 10)

  await assert.rejects(task, (error) => error?.code === 'cancelled')
})

test('persistent Zhizi session obtains a fresh token and socket after disconnect', async () => {
  const { session, sockets, socketTokens } = fakeSession()
  const signal = new AbortController().signal
  try {
    await session.runExclusive(signal, async (channel) => channel.send('name\n'))
    sockets[0].emit('disconnect', 'transport close')

    await session.runExclusive(signal, async (channel) => channel.send('version\n'))

    assert.equal(sockets.length, 2)
    assert.deepEqual(socketTokens, ['socket-token-1', 'socket-token-2'])
    assert.equal(session.telemetry().state, 'ready')
    assert.deepEqual(sockets[0].commands, ['name\n'])
    assert.deepEqual(sockets[1].commands, ['version\n'])
    assert.equal(sockets[1].options.reconnection, false)
    assert.equal(sockets[1].options.query['zz-socketio-token'], 'socket-token-2')
  } finally {
    session.close()
  }
})

test('Zhizi session accepts only the official ready event', async () => {
  const socket = new ManualReadySocket()
  const session = new ZhiziPersistentSession(
    { accountToken: 'account-token', args: '--gpu-type vip-share', gpuType: 'vip-share' },
    {
      fetchSocketToken: async () => ({ socketIOURL: 'https://socket.example', token: 'short-lived-token' }),
      createSocket: () => socket,
      sleep: async () => new Promise((resolve) => setTimeout(resolve, 2)),
      now: Date.now
    }
  )
  let completed = false
  const run = session.runExclusive(new AbortController().signal, async (channel) => {
    completed = true
    channel.send('name\n')
  })
  try {
    await new Promise((resolve) => setTimeout(resolve, 10))
    socket.emit('stderr', 'GTP ready; beginning main protocol loop\n')
    await new Promise((resolve) => setTimeout(resolve, 10))
    assert.equal(completed, false)

    socket.emit('ready')
    await run
    assert.equal(completed, true)
    assert.deepEqual(socket.commands, ['name\n'])
  } finally {
    session.close()
  }
})

test('Zhizi payload decoding handles Socket.IO Buffer JSON payloads', () => {
  assert.equal(
    decodeZhiziSocketPayload({ type: 'Buffer', data: [105, 110, 102, 111, 10] }),
    'info\n'
  )
  assert.equal(decodeZhiziSocketPayload(Uint8Array.from([61, 10])), '=\n')
})

test('Zhizi error classification distinguishes VIP entitlement from worker capacity', () => {
  const vip = classifyZhiziRemoteError('not_enough_credit', 'vip-share')
  assert.equal(vip.code, 'entitlement')
  assert.equal(vip.retryable, true)
  assert.match(vip.message, /VIP/)
  assert.doesNotMatch(vip.message, /余额不足/)

  const capacity = classifyZhiziRemoteError('no worker available', 'vip-share')
  assert.equal(capacity.code, 'capacity')
  assert.equal(capacity.retryable, true)

  const onDemand = classifyZhiziRemoteError('not_enough_credit', '3x')
  assert.equal(onDemand.retryable, false)
  assert.match(onDemand.message, /余额不足/)
})

test('Zhizi startup retry follows bounded LizzieYZY-style backoff', () => {
  assert.equal(zhiziStartupRetryDelayMs(1), 1_500)
  assert.equal(zhiziStartupRetryDelayMs(2), 4_000)
  assert.equal(zhiziStartupRetryDelayMs(3), 10_000)
})

test('Zhizi account metadata distinguishes an expired token from a temporary service outage', async () => {
  const originalFetch = globalThis.fetch
  try {
    globalThis.fetch = async () => new Response('{}', { status: 401 })
    assert.deepEqual(
      await getZhiziCloudAccountStatus('expired-token'),
      { tokenValid: false, isMembership: false, recommendedGpuType: '1x' }
    )

    globalThis.fetch = async () => new Response('temporarily unavailable', { status: 503 })
    await assert.rejects(
      getZhiziCloudAccountStatus('valid-but-service-unavailable'),
      /智子云服务暂时不可用/
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('remote args are built only from the official allowlist fields', () => {
  const args = buildZhiziRemoteArgs({
    zhiziGpuType: 'vip-share',
    zhiziKataName: 'katago-CUDA',
    zhiziKataWeight: 'fdx'
  })

  assert.match(args, /--gpu-type vip-share/)
  assert.match(args, /--kata-name katago-CUDA/)
  assert.match(args, /--kata-weight fdx/)
  assert.doesNotMatch(args, /token|foo|redirect|;/)
})

test('KataGo parser uses the newest streaming frame and real visit target', () => {
  const response = parseKataAnalyzeInfo(
    [
      'info move Q16 visits 8 winrate 0.51 scoreLead 0.2 order 0 pv Q16 D4 rootInfo winrate 0.51 scoreLead 0.2',
      'info move D4 visits 64 winrate 0.61 scoreLead 3.2 order 0 pv D4 Q16 rootInfo winrate 0.61 scoreLead 3.2'
    ].join('\n'),
    'B',
    'stream'
  )

  assert.equal(response.moveInfos?.length, 1)
  assert.equal(response.moveInfos?.[0]?.move, 'D4')
  assert.equal(response.moveInfos?.[0]?.visits, 64)
  assert.equal(zhiziAnalysisReachedVisits(response, 48), true)
  assert.equal(zhiziAnalysisReachedVisits(response, 80), false)
})

test('GTP parsing tolerates fragmented responses, errors, unknown fields and multiple info records', () => {
  const commandText = '=12' + ' ok\n\n?13 invalid move\n\n'
  assert.deepEqual(parseGtpCommandResponses(commandText), [
    { id: 12, ok: true, firstLine: 'ok' },
    { id: 13, ok: false, firstLine: 'invalid move' }
  ])
  assert.equal(findGtpCommandResponse(commandText, 13)?.ok, false)
  assert.equal(formatGtpCommand(14, 'play B D4'), '14 play B D4\n')

  const analysis = parseKataAnalyzeInfo(
    'info move Q16 visits 72 futureField 99 winrate 0.55 order 0 pv Q16 D4 info move D4 visits 31 winrate 0.53 order 1 pv D4 Q16 rootInfo winrate 0.55 scoreLead 1.8\n',
    'B',
    'multi-info'
  )
  assert.deepEqual(analysis.moveInfos?.map((move) => move.move), ['Q16', 'D4'])
  assert.equal(analysis.moveInfos?.[0]?.visits, 72)
  assert.equal(analysis.rootInfo?.scoreLead, 1.8)
})
