import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { tsImport } from 'tsx/esm/api'

const api = await tsImport('../src/main/services/zhiziApiClient.ts', import.meta.url)
const payment = await tsImport('../src/main/services/zhiziPayment.ts', import.meta.url)
const repoRoot = new URL('..', import.meta.url)

async function source(path) {
  return readFile(new URL(path, repoRoot), 'utf8')
}

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' }
  })
}

test('official authentication accepts phone or email and never puts bearer tokens in URLs', async () => {
  const calls = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options, body: options.body ? JSON.parse(String(options.body)) : undefined })
    return jsonResponse({ id: 'account-1', token: 'private-token' })
  }
  try {
    await api.loginZhiziPassword({ identifier: { kind: 'email', value: 'User@Example.com' }, password: 'password' })
    await api.loginZhiziCode({ identifier: { kind: 'phone', value: '13800000000' }, verificationCode: '1234' })
  } finally {
    globalThis.fetch = originalFetch
  }

  assert.equal(calls[0].url, 'https://www.zhizigo.com/api/cluster/account/login')
  assert.deepEqual(calls[0].body, { email: 'user@example.com', password: 'password' })
  assert.equal(calls[1].url, 'https://www.zhizigo.com/api/cluster/account/fast-login')
  assert.deepEqual(calls[1].body, { phone: '13800000000', verificationCode: '1234' })
  assert.equal(calls.every((call) => !call.url.includes('private-token')), true)
})

test('official API maps JSON and plain-text failures to stable user-facing errors', async () => {
  await assert.rejects(
    api.requestZhiziApi('/private', {
      token: 'expired',
      schema: { safeParse: () => ({ success: true, data: undefined }) }
    }, {
      fetch: async () => new Response('Not Authorized', { status: 401 })
    }),
    (error) => error?.info?.code === 'unauthorized' && !String(error.message).includes('Not Authorized')
  )

  await assert.rejects(
    api.requestZhiziApi('/login', {
      method: 'POST',
      schema: { safeParse: () => ({ success: true, data: undefined }) }
    }, {
      fetch: async () => jsonResponse({ statusCode: 400, key: 'invalid_password' }, 400)
    }),
    (error) => error?.info?.code === 'invalid-credentials'
  )
})

test('membership payment uses the live product name and exact fen price', async () => {
  const calls = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (url, options = {}) => {
    const body = options.body ? JSON.parse(String(options.body)) : undefined
    calls.push({ url: String(url), body })
    if (String(url).includes('/api/cluster/product')) {
      return jsonResponse([{ name: 'MEMBERSHIP_3_MONTH', type: 'MEMBERSHIP', price: 8765 }])
    }
    return jsonResponse({
      id: '66a000000000000000000010',
      userId: '66a000000000000000000001',
      amount: 8765,
      paidStatus: 'PENDING',
      productName: 'MEMBERSHIP_3_MONTH',
      nativePayRequest: { codeURL: 'weixin://wxpay/bizpayurl?pr=official-value' }
    })
  }
  let session
  try {
    session = await payment.createZhiziPaymentSession('account-token', {
      kind: 'membership',
      productName: 'MEMBERSHIP_3_MONTH'
    })
  } finally {
    globalThis.fetch = originalFetch
  }

  const order = calls.find((call) => call.url.endsWith('/api/pay/orders'))
  assert.equal(order.body.amount, 8765)
  assert.equal(order.body.productName, 'MEMBERSHIP_3_MONTH')
  assert.equal(order.body.orderType, 'PURCHASE_PRODUCT')
  assert.match(session.qrImageDataUrl, /^data:image\/png;base64,/)
  assert.equal(session.amountFen, 8765)
  payment.cancelZhiziPaymentSession(session.orderId)
})

test('money conversion is exact at the UI boundary', () => {
  assert.equal(payment.yuanTextToFen('10'), 1000)
  assert.equal(payment.yuanTextToFen('30.5'), 3050)
  assert.equal(payment.yuanTextToFen('0.01'), 1)
  assert.throws(() => payment.yuanTextToFen('10.001'))
  assert.throws(() => payment.yuanTextToFen('0'))
})

test('renderer never receives account or Socket.IO tokens', async () => {
  const main = await source('src/main/index.ts')
  const preload = await source('src/preload/index.ts')
  const component = await source('src/renderer/src/features/settings/ZhiziCloudSettingsPanel.tsx')

  assert.doesNotMatch(main, /ipcMain\.handle\('zhizi:get-saved-token'/)
  assert.doesNotMatch(preload, /getSavedZhiziToken/)
  assert.doesNotMatch(component, /zhiziToken|Socket\.IO|GTP/)
  assert.match(main, /getZhiziToken\(\)\.trim\(\)/)
  assert.match(main, /ipcMain\.handle\('zhizi:account-data'/)
  assert.match(main, /ipcMain\.handle\('zhizi:payment-create'/)
})
