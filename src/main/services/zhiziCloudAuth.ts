import type {
  ZhiziAccountOverview,
  ZhiziCloudLoginCodeRequest,
  ZhiziCloudLoginRequest,
  ZhiziCloudResetPasswordRequest,
  ZhiziCloudSendCodeRequest
} from '@main/lib/types'
import {
  getZhiziAccountOverview,
  loginZhiziCode,
  loginZhiziPassword,
  resetZhiziPassword,
  sendZhiziVerificationCode,
  ZHIZI_OFFICIAL_APP_DOWNLOAD_URL
} from './zhiziApiClient'

export { ZHIZI_OFFICIAL_APP_DOWNLOAD_URL }
export type ZhiziCloudAccountStatus = ZhiziAccountOverview

export async function getZhiziCloudAccountStatus(token: string): Promise<ZhiziAccountOverview> {
  const trimmed = token.trim()
  if (!trimmed) {
    return {
      tokenValid: false,
      isMembership: false,
      recommendedGpuType: '1x'
    }
  }
  return getZhiziAccountOverview(trimmed)
}

export async function loginZhiziCloudByPassword(
  request: ZhiziCloudLoginRequest
): Promise<{ token: string; message: string }> {
  const result = await loginZhiziPassword(request)
  return { token: result.token, message: '智子云登录成功。' }
}

export async function sendZhiziCloudLoginCode(
  request: ZhiziCloudSendCodeRequest
): Promise<{ message: string }> {
  await sendZhiziVerificationCode(request)
  return {
    message: request.purpose === 'reset_password'
      ? '重置密码验证码已发送。'
      : '验证码已发送。'
  }
}

export async function loginZhiziCloudByCode(
  request: ZhiziCloudLoginCodeRequest
): Promise<{ token: string; message: string }> {
  const result = await loginZhiziCode(request)
  return { token: result.token, message: '智子云验证码登录成功。' }
}

export async function resetZhiziCloudPassword(
  request: ZhiziCloudResetPasswordRequest
): Promise<{ token: string; message: string }> {
  const result = await resetZhiziPassword(request)
  return { token: result.token, message: '密码已重置，并已重新登录。' }
}
