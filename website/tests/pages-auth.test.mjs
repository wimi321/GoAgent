import test from 'node:test'
import assert from 'node:assert/strict'
import { checkPagesAuth } from '../scripts/check-pages-auth.mjs'

const credentials = { accountId: 'a'.repeat(32), token: 'test-only-token' }

test('Pages authorization uses only the configured account and existing project', async () => {
  let requests = 0
  assert.equal(await checkPagesAuth({ ...credentials, fetcher: async (url, options) => {
    requests++
    assert.equal(url, `https://api.cloudflare.com/client/v4/accounts/${credentials.accountId}/pages/projects/goagent`)
    assert.equal(options.headers.Authorization, 'Bearer test-only-token')
    assert.equal(options.redirect, 'error')
    assert.ok(options.signal instanceof AbortSignal)
    return { ok: true, status: 200, json: async () => ({ success: true, result: { name: 'goagent' } }) }
  } }), true)
  assert.equal(requests, 1)
})

test('Pages authorization rejects missing credentials before any request', async () => {
  await assert.rejects(checkPagesAuth({ accountId: '', token: '', fetcher: () => assert.fail('must not call') }), /missing or malformed/)
})

test('Pages authorization rejects denied, malformed and wrong-project responses', async () => {
  for (const [status, payload] of [[403, { success: false }], [200, { success: false }], [200, { success: true, result: { name: 'another-project' } }]]) {
    await assert.rejects(checkPagesAuth({ ...credentials, fetcher: async () => ({ ok: status === 200, status, json: async () => payload }) }), /authorization failed/)
  }
})

test('Pages authorization does not expose raw network errors or response bodies', async () => {
  await assert.rejects(checkPagesAuth({ ...credentials, fetcher: async () => { throw new Error(credentials.token) } }), error => !error.message.includes(credentials.token))
  await assert.rejects(checkPagesAuth({ ...credentials, fetcher: async () => ({ ok: false, status: 401, json: async () => ({ success: false, errors: [credentials.token] }) }) }), error => !error.message.includes(credentials.token))
})
