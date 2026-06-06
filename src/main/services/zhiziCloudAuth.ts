import type { ZhiziCloudLoginCodeRequest, ZhiziCloudLoginRequest, ZhiziCloudSendCodeRequest } from '@main/lib/types'

const ZHIZI_LOGIN_URL = 'https://www.zhizigo.com/api/cluster/account/login'
const ZHIZI_SEND_CODE_URL = 'https://www.zhizigo.com/api/cluster/account/send-code'
const ZHIZI_FAST_LOGIN_URL = 'https://www.zhizigo.com/api/cluster/account/fast-login'

function findToken(value: unknown): string {
  if (!value || typeof value !== 'object') return ''
  const object = value as Record<string, unknown>
  for (const key of ['token', 'accessToken', 'access_token']) {
    const candidate = object[key]
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim()
    }
  }
  for (const nested of ['data', 'result', 'account', 'user']) {
    const token = findToken(object[nested])
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
    return '智子云手机号无效，请检查后重试。'
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

export async function loginZhiziCloudByPassword(request: ZhiziCloudLoginRequest): Promise<{ token: string; message: string }> {
  const phone = request.phone.trim()
  const password = request.password.trim()
  if (!phone || !password) {
    throw new Error('请输入智子云账号和密码。')
  }

  const response = await postZhiziJson(ZHIZI_LOGIN_URL, { phone, password })
  if (!response.ok) {
    throw new Error(humanizeZhiziLoginError(response.status, response.json, response.rawText))
  }
  const token = findToken(response.json)
  if (!token) {
    throw new Error('智子云登录成功但没有返回 token，请更新智子客户端或稍后重试。')
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
