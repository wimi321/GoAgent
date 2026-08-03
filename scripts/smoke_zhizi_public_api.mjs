#!/usr/bin/env node
import assert from 'node:assert/strict'

const API_BASE = 'https://www.zhizigo.com'
const OPENAPI_URL = 'https://raw.githubusercontent.com/kinfkong/zhizi-open-api/main/openapi/zhizi-public-api.yaml'
const timeoutMs = 20_000

async function fetchWithTimeout(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, {
      headers: { Accept: url.endsWith('.yaml') ? 'text/yaml' : 'application/json' },
      signal: controller.signal
    })
  } finally {
    clearTimeout(timer)
  }
}

try {
  const [specResponse, productResponse] = await Promise.all([
    fetchWithTimeout(OPENAPI_URL),
    fetchWithTimeout(`${API_BASE}/api/cluster/product?type=MEMBERSHIP`)
  ])
  assert.equal(specResponse.ok, true, `OpenAPI request returned HTTP ${specResponse.status}`)
  assert.equal(productResponse.ok, true, `Product request returned HTTP ${productResponse.status}`)

  const spec = await specResponse.text()
  for (const path of [
    '/api/cluster/account/login',
    '/api/cluster/account/fetch-socketio-token',
    '/api/cluster/usage/my-usages',
    '/api/pay/orders'
  ]) {
    assert.equal(spec.includes(path), true, `OpenAPI is missing ${path}`)
  }

  const products = await productResponse.json()
  assert.equal(Array.isArray(products), true, 'Membership product response must be an array.')
  assert.equal(products.length > 0, true, 'Membership product response is empty.')
  const allowed = new Set([
    'MEMBERSHIP_1_MONTH',
    'MEMBERSHIP_3_MONTH',
    'MEMBERSHIP_6_MONTH',
    'MEMBERSHIP_12_MONTH'
  ])
  for (const product of products) {
    assert.equal(allowed.has(product?.name), true, `Unexpected membership product: ${product?.name}`)
    assert.equal(product?.type, 'MEMBERSHIP')
    assert.equal(Number.isInteger(product?.price) && product.price > 0, true)
  }

  console.log(JSON.stringify({
    status: 'passed',
    openapi: OPENAPI_URL,
    apiBase: API_BASE,
    products: products.map(({ name, price }) => ({ name, priceFen: price }))
  }, null, 2))
} catch (error) {
  console.error(JSON.stringify({
    status: 'failed',
    error: error instanceof Error ? error.message : String(error)
  }, null, 2))
  process.exitCode = 1
}
