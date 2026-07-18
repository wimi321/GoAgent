import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import test from 'node:test'

import {
  buildZhiziRemoteArgs,
  parseKataAnalyzeInfo,
  zhiziAnalysisReachedVisits
} from '../src/main/services/zhiziGtpProtocol.ts'
import { getZhiziCloudAccountStatus } from '../src/main/services/zhiziCloudAuth.ts'
import {
  classifyZhiziRemoteError,
  decodeZhiziSocketPayload,
  ZhiziPersistentSession,
  zhiziStartupRetryDelayMs
} from '../src/main/services/zhiziSocketSession.ts'

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

function fakeSession() {
  const sockets = []
  const session = new ZhiziPersistentSession(
    {
      accountToken: 'account-token',
      args: '--gpu-type vip-share',
      gpuType: 'vip-share'
    },
    {
      fetchSocketToken: async () => ({
        socketIOURL: 'https://socket.example',
        token: 'socket-token'
      }),
      createSocket: () => {
        const socket = new FakeSocket()
        sockets.push(socket)
        return socket
      },
      sleep: async (milliseconds) => {
        await new Promise((resolve) => setTimeout(resolve, Math.min(milliseconds, 5)))
      },
      now: Date.now
    }
  )
  return { session, sockets }
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

test('persistent Zhizi session accepts Socket.IO ready after an idle reconnect', async () => {
  const { session, sockets } = fakeSession()
  const signal = new AbortController().signal
  try {
    await session.runExclusive(signal, async (channel) => channel.send('name\n'))
    sockets[0].connected = false
    sockets[0].emit('disconnect', 'transport close')
    setTimeout(() => {
      sockets[0].connected = true
      sockets[0].emit('connect')
      sockets[0].emit('ready')
    }, 10)

    await session.runExclusive(signal, async (channel) => channel.send('version\n'))

    assert.equal(sockets.length, 1)
    assert.equal(session.telemetry().state, 'ready')
    assert.deepEqual(sockets[0].commands, ['name\n', 'version\n'])
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
      { tokenValid: false, isMembership: false, hasConnectAccount: false }
    )

    globalThis.fetch = async () => new Response('temporarily unavailable', { status: 503 })
    await assert.rejects(
      getZhiziCloudAccountStatus('valid-but-service-unavailable'),
      /账号资料暂时不可用/
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('remote args keep the selected VIP plan and strip conflicting managed options', () => {
  const args = buildZhiziRemoteArgs({
    zhiziGpuType: 'vip-share',
    zhiziExtraArgs: '--gpu-type 6x --kata-weight fdx --token secret --foo bar'
  })

  assert.match(args, /--gpu-type vip-share/)
  assert.match(args, /--kata-weight 28bnbt/)
  assert.match(args, /--foo bar/)
  assert.doesNotMatch(args, /6x|fdx|secret/)
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
