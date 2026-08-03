import { z } from 'zod'
import type {
  ZhiziAccountOverview,
  ZhiziApiError,
  ZhiziApiErrorCode,
  ZhiziBalanceInfo,
  ZhiziCloudLoginCodeRequest,
  ZhiziCloudLoginRequest,
  ZhiziCloudResetPasswordRequest,
  ZhiziCloudSendCodeRequest,
  ZhiziCreditPage,
  ZhiziIdentifier,
  ZhiziMembershipProduct,
  ZhiziUsagePage
} from '@main/lib/types'

export const ZHIZI_API_BASE_URL = 'https://www.zhizigo.com'
export const ZHIZI_OFFICIAL_APP_DOWNLOAD_URL = 'https://zhizigo.com/download'

const membershipProductNames = [
  'MEMBERSHIP_1_MONTH',
  'MEMBERSHIP_3_MONTH',
  'MEMBERSHIP_6_MONTH',
  'MEMBERSHIP_12_MONTH'
] as const

const accountSchema = z.object({
  id: z.string(),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  token: z.string().optional(),
  membershipExpiresAt: z.string().nullable().optional(),
  membershipAutoRenew: z.boolean().nullable().optional(),
  isMembership: z.boolean().optional()
}).passthrough()

const balanceSchema = z.object({
  totalCashAmount: z.number().optional(),
  totalCouponAmount: z.number().optional(),
  totalProductAmount: z.number().optional(),
  totalAmount: z.number().optional(),
  totalConsumption: z.number().optional(),
  totalCouponConsumption: z.number().optional(),
  remainingBalance: z.number().optional(),
  yesterdayConsumption: z.number().optional(),
  totalDuration: z.number().optional(),
  last24HrsShareDuration: z.number().optional(),
  last24HrsVIPShareDuration: z.number().optional(),
  currentNumOfMyConnections: z.number().optional(),
  currentNumOfNodes: z.number().optional()
}).passthrough()

const productSchema = z.object({
  name: z.enum(membershipProductNames),
  type: z.literal('MEMBERSHIP'),
  price: z.number().int().positive()
}).passthrough()

const usageSchema = z.object({
  id: z.string(),
  startedAt: z.string().optional(),
  endedAt: z.string().nullable().optional(),
  finished: z.boolean().optional(),
  ready: z.boolean().optional(),
  duration: z.number().optional(),
  totalCost: z.number().optional(),
  gpuType: z.string().optional(),
  gpusPricePerHour: z.number().optional(),
  occupationPricePerHour: z.number().optional(),
  vip: z.boolean().optional(),
  share: z.boolean().optional()
}).passthrough()

const usagePageSchema = z.object({
  total: z.number().int().nonnegative(),
  page: z.number().int().nullable().optional(),
  pageSize: z.number().int().nullable().optional(),
  items: z.array(usageSchema)
}).passthrough()

const creditSchema = z.object({
  id: z.string(),
  creditType: z.string(),
  amount: z.number(),
  source: z.string().nullable().optional(),
  productName: z.string().nullable().optional(),
  createdAt: z.string().optional()
}).passthrough()

const creditPageSchema = z.object({
  total: z.number().int().nonnegative(),
  page: z.number().int().nullable().optional(),
  pageSize: z.number().int().nullable().optional(),
  items: z.array(creditSchema)
}).passthrough()

export const zhiziOrderSchema = z.object({
  id: z.string(),
  amount: z.number().int().positive(),
  paidStatus: z.enum(['PENDING', 'SUCCESS', 'FAIL']),
  productName: z.enum(membershipProductNames).nullable().optional(),
  paidAt: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  errorMessage: z.string().nullable().optional(),
  nativePayRequest: z.object({
    codeURL: z.string().min(1)
  }).passthrough().nullable().optional()
}).passthrough()

export const zhiziSocketTokenSchema = z.object({
  token: z.string().min(1),
  socketIOURL: z.string().url(),
  createdAt: z.string().optional(),
  expiredAt: z.string().optional(),
  args: z.string().optional()
}).passthrough()

type ZhiziOrder = z.infer<typeof zhiziOrderSchema>

interface RequestOptions<T> {
  method?: 'GET' | 'POST' | 'PUT'
  token?: string
  body?: unknown
  schema: z.ZodType<T>
  timeoutMs?: number
  retrySafe?: boolean
}

interface ZhiziApiDependencies {
  fetch: typeof fetch
  sleep: (milliseconds: number) => Promise<void>
}

const defaultDependencies: ZhiziApiDependencies = {
  fetch: (...args) => globalThis.fetch(...args),
  sleep: (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
}

function normalizedIdentifier(identifier: ZhiziIdentifier): ZhiziIdentifier {
  const value = identifier.value.trim()
  if (identifier.kind === 'phone') {
    if (!/^\+?\d{6,20}$/.test(value)) {
      throw new ZhiziApiClientError({
        code: 'invalid-data',
        key: 'invalid_phone',
        retryable: false,
        message: '手机号格式不正确。'
      })
    }
    return { kind: 'phone', value }
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) {
    throw new ZhiziApiClientError({
      code: 'invalid-data',
      key: 'invalid_email',
      retryable: false,
      message: '邮箱格式不正确。'
    })
  }
  return { kind: 'email', value: value.toLowerCase() }
}

function identifierBody(identifier: ZhiziIdentifier): Record<string, string> {
  const normalized = normalizedIdentifier(identifier)
  return normalized.kind === 'phone'
    ? { phone: normalized.value }
    : { email: normalized.value }
}

function apiErrorCode(status: number | undefined, key: string): ZhiziApiErrorCode {
  if (status === 401 || status === 403) return 'unauthorized'
  if (status && status >= 500) return 'server-error'
  if (/invalid_verification_code/.test(key)) return 'invalid-verification-code'
  if (/fast_login_too_frequent/.test(key)) return 'too-frequent'
  if (/invalid_credentials|invalid_password/.test(key)) return 'invalid-credentials'
  if (/invalid_data|invalid_phone|invalid_email|invalid_amount|missing_product_name|invalid_product_name/.test(key)) return 'invalid-data'
  if (/not_found|order_not_found/.test(key)) return 'not-found'
  if (/not_enough_credit/.test(key)) return 'insufficient-credit'
  if (/no.worker|worker.unavailable|capacity/.test(key)) return 'capacity-unavailable'
  if (/failed_create_prepay_id|failed_insert_order|payment/.test(key)) return 'payment-failed'
  return 'unknown'
}

function apiErrorMessage(code: ZhiziApiErrorCode, status?: number): string {
  switch (code) {
    case 'invalid-credentials': return '账号或密码不正确。'
    case 'invalid-verification-code': return '验证码不正确或已过期。'
    case 'too-frequent': return '尝试次数过多，请稍后再试。'
    case 'not-found': return '没有找到对应的智子云数据。'
    case 'unauthorized': return '智子云登录已失效，请重新登录。'
    case 'insufficient-credit': return '当前余额或权益不足。'
    case 'capacity-unavailable': return '当前没有可用的远程算力，请稍后再试。'
    case 'payment-failed': return '支付订单创建失败，请稍后再试。'
    case 'network-error': return '无法连接智子云，请检查网络后重试。'
    case 'timeout': return '智子云请求超时，请稍后再试。'
    case 'server-error': return '智子云服务暂时不可用，请稍后再试。'
    case 'protocol-error': return '智子云返回了无法识别的数据。'
    case 'invalid-data': return '提交的信息不正确，请检查后重试。'
    default: return status ? `智子云请求失败（HTTP ${status}）。` : '智子云请求失败。'
  }
}

export class ZhiziApiClientError extends Error {
  readonly info: ZhiziApiError

  constructor(info: ZhiziApiError) {
    super(info.message)
    this.name = 'ZhiziApiClientError'
    this.info = info
  }
}

export function asZhiziApiError(cause: unknown): ZhiziApiError {
  if (cause instanceof ZhiziApiClientError) return cause.info
  const message = cause instanceof Error ? cause.message : String(cause)
  return {
    code: /abort|timeout|超时/i.test(message) ? 'timeout' : 'network-error',
    retryable: true,
    message: /abort|timeout|超时/i.test(message)
      ? apiErrorMessage('timeout')
      : apiErrorMessage('network-error')
  }
}

export async function requestZhiziApi<T>(
  path: string,
  options: RequestOptions<T>,
  dependencies: Partial<ZhiziApiDependencies> = {}
): Promise<T> {
  const deps = { ...defaultDependencies, ...dependencies }
  const attempts = options.retrySafe ? 2 : 1
  let lastError: unknown
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 15_000)
    try {
      const response = await deps.fetch(`${ZHIZI_API_BASE_URL}${path}`, {
        method: options.method ?? 'GET',
        headers: {
          Accept: 'application/json',
          ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...(options.token ? { Authorization: `Bearer ${options.token}` } : {})
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal
      })
      const rawText = await response.text()
      let parsed: unknown = undefined
      if (rawText.trim()) {
        try {
          parsed = JSON.parse(rawText)
        } catch {
          parsed = rawText
        }
      }
      if (!response.ok) {
        const key = typeof parsed === 'object' && parsed
          ? String((parsed as Record<string, unknown>).key ?? '')
          : ''
        const code = apiErrorCode(response.status, key)
        throw new ZhiziApiClientError({
          code,
          status: response.status,
          key: key || undefined,
          retryable: response.status >= 500,
          message: apiErrorMessage(code, response.status)
        })
      }
      const result = options.schema.safeParse(parsed)
      if (!result.success) {
        throw new ZhiziApiClientError({
          code: 'protocol-error',
          status: response.status,
          retryable: false,
          message: apiErrorMessage('protocol-error')
        })
      }
      return result.data
    } catch (cause) {
      lastError = cause
      const info = asZhiziApiError(cause)
      if (!info.retryable || attempt >= attempts) {
        if (cause instanceof ZhiziApiClientError) throw cause
        throw new ZhiziApiClientError(info)
      }
      await deps.sleep(500 * attempt)
    } finally {
      clearTimeout(timer)
    }
  }
  throw lastError
}

function requireToken(account: z.infer<typeof accountSchema>): string {
  const token = account.token?.trim()
  if (!token) {
    throw new ZhiziApiClientError({
      code: 'protocol-error',
      retryable: false,
      message: '智子云登录成功，但没有返回登录凭据。'
    })
  }
  return token
}

export async function loginZhiziPassword(request: ZhiziCloudLoginRequest): Promise<{ token: string }> {
  const password = request.password.trim()
  if (!password) {
    throw new ZhiziApiClientError({ code: 'invalid-data', retryable: false, message: '请输入密码。' })
  }
  const account = await requestZhiziApi('/api/cluster/account/login', {
    method: 'POST',
    body: { ...identifierBody(request.identifier), password },
    schema: accountSchema
  })
  return { token: requireToken(account) }
}

export async function sendZhiziVerificationCode(request: ZhiziCloudSendCodeRequest): Promise<void> {
  await requestZhiziApi('/api/cluster/account/send-code', {
    method: 'POST',
    body: {
      ...identifierBody(request.identifier),
      type: request.purpose ?? 'fast_login'
    },
    schema: z.undefined()
  })
}

export async function loginZhiziCode(request: ZhiziCloudLoginCodeRequest): Promise<{ token: string }> {
  const verificationCode = request.verificationCode.trim()
  if (!verificationCode) {
    throw new ZhiziApiClientError({ code: 'invalid-data', retryable: false, message: '请输入验证码。' })
  }
  const account = await requestZhiziApi('/api/cluster/account/fast-login', {
    method: 'POST',
    body: { ...identifierBody(request.identifier), verificationCode },
    schema: accountSchema
  })
  return { token: requireToken(account) }
}

export async function resetZhiziPassword(request: ZhiziCloudResetPasswordRequest): Promise<{ token: string }> {
  const password = request.password.trim()
  if (password.length < 8) {
    throw new ZhiziApiClientError({ code: 'invalid-data', retryable: false, message: '新密码至少需要 8 个字符。' })
  }
  const account = await requestZhiziApi('/api/cluster/account/reset-password', {
    method: 'POST',
    body: {
      ...identifierBody(request.identifier),
      verificationCode: request.verificationCode.trim(),
      password
    },
    schema: accountSchema
  })
  return { token: requireToken(account) }
}

function maskAccountIdentifier(phone?: string | null, email?: string | null): string | undefined {
  if (phone) return phone.replace(/^(\+?\d{3})\d+(\d{2})$/, '$1****$2')
  if (email) {
    const [name, domain] = email.split('@')
    if (!domain) return email
    return `${name.slice(0, 2)}***@${domain}`
  }
  return undefined
}

function balanceInfo(value: z.infer<typeof balanceSchema>): ZhiziBalanceInfo {
  return {
    totalCashAmount: value.totalCashAmount ?? 0,
    totalCouponAmount: value.totalCouponAmount ?? 0,
    totalProductAmount: value.totalProductAmount ?? 0,
    totalAmount: value.totalAmount ?? 0,
    totalConsumption: value.totalConsumption ?? 0,
    totalCouponConsumption: value.totalCouponConsumption ?? 0,
    remainingBalance: value.remainingBalance ?? 0,
    yesterdayConsumption: value.yesterdayConsumption ?? 0,
    totalDuration: value.totalDuration ?? 0,
    last24HrsShareDuration: value.last24HrsShareDuration ?? 0,
    last24HrsVIPShareDuration: value.last24HrsVIPShareDuration ?? 0,
    currentNumOfMyConnections: value.currentNumOfMyConnections ?? 0,
    currentNumOfNodes: value.currentNumOfNodes ?? 0
  }
}

export async function getZhiziAccountOverview(token: string): Promise<ZhiziAccountOverview> {
  try {
    const account = await requestZhiziApi('/api/cluster/account/me', {
      token,
      schema: accountSchema,
      retrySafe: true
    })
    let balance: ZhiziBalanceInfo | undefined
    let warning: ZhiziApiError | undefined
    try {
      balance = balanceInfo(await requestZhiziApi('/api/cluster/balance', {
        token,
        schema: balanceSchema,
        retrySafe: true
      }))
    } catch (cause) {
      warning = asZhiziApiError(cause)
    }
    const isMembership = account.isMembership === true
    return {
      tokenValid: true,
      identifierMasked: maskAccountIdentifier(account.phone, account.email),
      isMembership,
      membershipExpiresAt: account.membershipExpiresAt ?? undefined,
      membershipAutoRenew: account.membershipAutoRenew ?? undefined,
      recommendedGpuType: isMembership ? 'vip-share' : '1x',
      balance,
      warning
    }
  } catch (cause) {
    const error = asZhiziApiError(cause)
    if (error.code === 'unauthorized') {
      return {
        tokenValid: false,
        isMembership: false,
        recommendedGpuType: '1x'
      }
    }
    throw cause
  }
}

export async function listZhiziMembershipProducts(): Promise<ZhiziMembershipProduct[]> {
  const products = await requestZhiziApi('/api/cluster/product?type=MEMBERSHIP', {
    schema: z.array(productSchema),
    retrySafe: true
  })
  return products.map((product) => ({
    name: product.name,
    type: 'MEMBERSHIP',
    priceFen: product.price
  }))
}

export async function listZhiziUsages(token: string, page = 0, pageSize = 20): Promise<ZhiziUsagePage> {
  const result = await requestZhiziApi(`/api/cluster/usage/my-usages?page=${Math.max(0, page)}&pageSize=${Math.max(1, Math.min(100, pageSize))}`, {
    token,
    schema: usagePageSchema,
    retrySafe: true
  })
  return {
    total: result.total,
    page: result.page ?? page,
    pageSize: result.pageSize ?? pageSize,
    items: result.items.map((item) => ({
      id: item.id,
      startedAt: item.startedAt,
      endedAt: item.endedAt ?? undefined,
      finished: item.finished ?? false,
      ready: item.ready ?? false,
      durationSeconds: item.duration ?? 0,
      totalCostYuan: item.totalCost ?? 0,
      gpuType: item.gpuType,
      pricePerHourYuan: item.gpusPricePerHour ?? item.occupationPricePerHour,
      vip: item.vip ?? false,
      share: item.share ?? false
    }))
  }
}

export async function listZhiziCredits(token: string, page = 0, pageSize = 20): Promise<ZhiziCreditPage> {
  const result = await requestZhiziApi(`/api/cluster/credit/my-credits?page=${Math.max(0, page)}&pageSize=${Math.max(1, Math.min(100, pageSize))}`, {
    token,
    schema: creditPageSchema,
    retrySafe: true
  })
  return {
    total: result.total,
    page: result.page ?? page,
    pageSize: result.pageSize ?? pageSize,
    items: result.items.map((item) => ({
      id: item.id,
      creditType: item.creditType,
      amountYuan: item.amount,
      source: item.source ?? undefined,
      productName: item.productName ?? undefined,
      createdAt: item.createdAt
    }))
  }
}

export async function createZhiziOrder(token: string, body: Record<string, unknown>): Promise<ZhiziOrder> {
  return requestZhiziApi('/api/pay/orders', {
    method: 'POST',
    token,
    body,
    schema: zhiziOrderSchema,
    timeoutMs: 20_000
  })
}

export async function getZhiziOrder(token: string, orderId: string): Promise<ZhiziOrder> {
  return requestZhiziApi(`/api/pay/orders/${encodeURIComponent(orderId)}`, {
    token,
    schema: zhiziOrderSchema,
    retrySafe: true
  })
}

export async function createZhiziSocketToken(token: string, args: string): Promise<z.infer<typeof zhiziSocketTokenSchema>> {
  return requestZhiziApi('/api/cluster/account/fetch-socketio-token', {
    method: 'POST',
    token,
    body: { args },
    schema: zhiziSocketTokenSchema,
    timeoutMs: 20_000,
    retrySafe: true
  })
}
