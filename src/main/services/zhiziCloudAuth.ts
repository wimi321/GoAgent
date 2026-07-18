import type { ZhiziCloudLoginCodeRequest, ZhiziCloudLoginRequest, ZhiziCloudSendCodeRequest } from '@main/lib/types'

const ZHIZI_LOGIN_URL = 'https://www.zhizigo.com/api/cluster/account/login'
const ZHIZI_SEND_CODE_URL = 'https://www.zhizigo.com/api/cluster/account/send-code'
const ZHIZI_FAST_LOGIN_URL = 'https://www.zhizigo.com/api/cluster/account/fast-login'
const ZHIZI_ME_URL = 'https://www.zhizigo.com/api/cluster/account/me'
const ZHIZI_CONNECT_ACCOUNT_FETCH_URL = 'https://www.zhizigo.com/api/cluster/account/connectAccount/fetch'

export interface ZhiziCloudAccountStatus {
  tokenValid: boolean
  isMembership: boolean
  membershipExpiresAt?: string
  hasConnectAccount: boolean
  connectAccountId?: string
  connectUsernameMasked?: string
}

function findToken(value: unknown, depth = 0): string {
  if (depth > 6) return ''
  if (!value || typeof value !== 'object') return ''
  const object = value as Record<string, unknown>
  for (const key of ['token', 'accessToken', 'access_token', 'jwt', 'accessJwt', 'connectToken', 'connectAccountToken']) {
    const candidate = object[key]
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim()
    }
  }
  for (const [key, candidate] of Object.entries(object)) {
    if (/(token|jwt)/i.test(key) && typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim()
    }
  }
  for (const candidate of Object.values(object)) {
    const token = findToken(candidate, depth + 1)
    if (token) return token
  }
  return ''
}

function humanizeZhiziLoginError(status: number, body: unknown, rawText: string): string {
  const object = body && typeof body === 'object' ? body as Record<string, unknown> : {}
  const key = String(object.key ?? object.error ?? object.message ?? '').trim()
  if (/invalid_verification_code|verification/i.test(key)) {
    return '智子云验证码不正确或已过期，请重新获取验证码。'
  }
  if (/invalid_phone|phone/i.test(key)) {
    return '智子云账号无效：手机号请直接填写数字；zz- 开头的连接账号请确认账号名完整。'
  }
  if (/invalid_password|password/i.test(key)) {
    return '智子云登录失败：密码不正确。你也可以改用短信验证码登录。'
  }
  if (/invalid|credential/i.test(key)) {
    return '智子云登录失败：账号凭据无效。'
  }
  if (status === 429) {
    return '智子云登录请求过于频繁，请稍后再试。'
  }
  if (status >= 500) {
    return '智子云登录服务暂时不可用，请稍后再试。'
  }
  return `智子云登录失败：HTTP ${status}${key ? ` · ${key}` : rawText ? ` · ${rawText.slice(0, 120)}` : ''}`
}

function isPhoneAccount(account: string): boolean {
  return /^\+?\d{6,20}$/.test(account)
}

function isEmailAccount(account: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(account)
}

function isConnectAccount(account: string): boolean {
  return /^zz[-_]/i.test(account)
}

async function postZhiziJson(url: string, body: Record<string, unknown>, timeoutMs = 20_000): Promise<{ status: number; ok: boolean; json: unknown; rawText: string }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
      signal: controller.signal
    })
    const rawText = await response.text()
    let json: unknown = undefined
    try {
      json = rawText ? JSON.parse(rawText) : undefined
    } catch {
      json = undefined
    }
    return { status: response.status, ok: response.ok, json, rawText }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('智子云登录超时，请检查网络后重试。')
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}

function maskZhiziUsername(value: unknown): string {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) return ''
  if (/^zz[-_]/i.test(text)) return text.replace(/^(.{3}).+(.{2})$/, '$1***$2')
  return text.replace(/(\d{3})\d+(\d{2})/, '$1***$2')
}

async function getZhiziJsonOnce(url: string, token: string, timeoutMs = 15_000): Promise<{ status: number; ok: boolean; json: unknown; rawText: string }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`
      },
      signal: controller.signal
    })
    const rawText = await response.text()
    let json: unknown = undefined
    try {
      json = rawText ? JSON.parse(rawText) : undefined
    } catch {
      json = undefined
    }
    return { status: response.status, ok: response.ok, json, rawText }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('智子云账号状态检查超时，请检查网络后重试。')
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}

async function getZhiziJson(url: string, token: string, timeoutMs = 15_000): Promise<{ status: number; ok: boolean; json: unknown; rawText: string }> {
  let lastError: unknown
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      return await getZhiziJsonOnce(url, token, timeoutMs)
    } catch (cause) {
      lastError = cause
      if (attempt >= 2) throw cause
      await new Promise((resolve) => setTimeout(resolve, 650))
    }
  }
  throw lastError
}

function objectValue(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') return {}
  return value as Record<string, unknown>
}

function responsePayload(value: unknown): Record<string, unknown> {
  const root = objectValue(value)
  for (const key of ['data', 'result', 'account', 'user']) {
    const nested = objectValue(root[key])
    if (Object.keys(nested).length) return nested
  }
  return root
}

export async function getZhiziCloudAccountStatus(token: string): Promise<ZhiziCloudAccountStatus> {
  const trimmed = token.trim()
  if (!trimmed) {
    return { tokenValid: false, isMembership: false, hasConnectAccount: false }
  }
  const meResponse = await getZhiziJson(ZHIZI_ME_URL, trimmed)
  if (!meResponse.ok) {
    if (meResponse.status === 401 || meResponse.status === 403) {
      return { tokenValid: false, isMembership: false, hasConnectAccount: false }
    }
    throw new Error(`智子云账号资料暂时不可用（HTTP ${meResponse.status}）。`)
  }
  const me = responsePayload(meResponse.json)
  const connectResponse = await getZhiziJson(ZHIZI_CONNECT_ACCOUNT_FETCH_URL, trimmed)
  const connect = connectResponse.ok ? responsePayload(connectResponse.json) : {}
  const rawConnectAccountId = connect.id ?? connect.connectAccountId
  const connectAccountId = typeof rawConnectAccountId === 'string' || typeof rawConnectAccountId === 'number'
    ? String(rawConnectAccountId)
    : undefined
  const membershipExpiresAt = me.membershipExpiresAt ?? me.membershipExpiredAt ?? me.expiredAt
  return {
    tokenValid: true,
    isMembership: me.isMembership === true || me.membership === true,
    membershipExpiresAt: typeof membershipExpiresAt === 'string' ? membershipExpiresAt : undefined,
    hasConnectAccount: Boolean(connectAccountId || connect.connectUsername),
    connectAccountId,
    connectUsernameMasked: maskZhiziUsername(connect.connectUsername)
  }
}

export async function loginZhiziCloudByPassword(request: ZhiziCloudLoginRequest): Promise<{ token: string; message: string }> {
  const account = request.phone.trim()
  const password = request.password.trim()
  if (!account || !password) {
    throw new Error('请输入智子云账号和密码。')
  }
  if (isConnectAccount(account)) {
    throw new Error('这是智子云连接账号，不是可直接登录的主账号。请用智子云手机号或邮箱登录 GoAgent；连接账号需要先在智子官方账号体系里绑定后，由主账号 token 分配远程算力。')
  }
  if (!isPhoneAccount(account) && !isEmailAccount(account)) {
    throw new Error('智子云账号格式不正确：请填写手机号或邮箱。zz- 开头的是连接账号，不能直接换取 GoAgent 所需的远程算力 token。')
  }

  const response = await postZhiziJson(ZHIZI_LOGIN_URL, isEmailAccount(account) ? { email: account, password } : { phone: account, password })
  if (!response.ok) {
    throw new Error(humanizeZhiziLoginError(response.status, response.json, response.rawText))
  }
  const token = findToken(response.json)
  if (!token) {
    throw new Error('智子云登录成功但没有返回 token。请稍后重试，或确认当前账号是智子云主账号而不是连接账号。')
  }
  return { token, message: '智子云登录成功，已保存 token。' }
}

export async function sendZhiziCloudLoginCode(request: ZhiziCloudSendCodeRequest): Promise<{ message: string }> {
  const phone = request.phone.trim()
  if (!phone) {
    throw new Error('请输入智子云手机号。')
  }
  const response = await postZhiziJson(ZHIZI_SEND_CODE_URL, { phone, type: 'fast_login' }, 15_000)
  if (!response.ok) {
    throw new Error(humanizeZhiziLoginError(response.status, response.json, response.rawText))
  }
  return { message: '验证码已发送，请查看手机短信。' }
}

export async function loginZhiziCloudByCode(request: ZhiziCloudLoginCodeRequest): Promise<{ token: string; message: string }> {
  const phone = request.phone.trim()
  const verificationCode = request.verificationCode.trim()
  if (!phone || !verificationCode) {
    throw new Error('请输入智子云手机号和短信验证码。')
  }
  const response = await postZhiziJson(ZHIZI_FAST_LOGIN_URL, { phone, verificationCode })
  if (!response.ok) {
    throw new Error(humanizeZhiziLoginError(response.status, response.json, response.rawText))
  }
  const token = findToken(response.json)
  if (!token) {
    throw new Error('智子云验证码登录成功但没有返回 token，请稍后重试。')
  }
  return { token, message: '智子云验证码登录成功，已保存 token。' }
}
