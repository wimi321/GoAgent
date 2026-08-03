import QRCode from 'qrcode'
import type {
  ZhiziMembershipProduct,
  ZhiziPaymentCreateRequest,
  ZhiziPaymentSession
} from '@main/lib/types'
import {
  asZhiziApiError,
  createZhiziOrder,
  getZhiziOrder,
  listZhiziMembershipProducts
} from './zhiziApiClient'

const activeOrders = new Map<string, Pick<ZhiziPaymentSession, 'kind' | 'productName' | 'amountFen'>>()
let createOrderPromise: Promise<ZhiziPaymentSession> | null = null

export function yuanTextToFen(input: string): number {
  const normalized = input.trim()
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
    throw new Error('请输入正确的充值金额，最多保留两位小数。')
  }
  const [yuan, decimals = ''] = normalized.split('.')
  const fen = Number(yuan) * 100 + Number(decimals.padEnd(2, '0'))
  if (!Number.isSafeInteger(fen) || fen <= 0) {
    throw new Error('充值金额必须大于 0。')
  }
  return fen
}

function productForName(
  products: ZhiziMembershipProduct[],
  productName: ZhiziMembershipProduct['name'] | undefined
): ZhiziMembershipProduct {
  const product = products.find((candidate) => candidate.name === productName)
  if (!product) {
    throw new Error('所选 VIP 套餐已经变化，请刷新套餐后重新选择。')
  }
  return product
}

async function buildPaymentSession(
  token: string,
  request: ZhiziPaymentCreateRequest
): Promise<ZhiziPaymentSession> {
  let amountFen: number
  let productName: ZhiziMembershipProduct['name'] | undefined
  let body: Record<string, unknown>

  if (request.kind === 'membership') {
    const product = productForName(await listZhiziMembershipProducts(), request.productName)
    amountFen = product.priceFen
    productName = product.name
    body = {
      payType: 'WECHAT',
      amount: amountFen,
      tradeType: 'NATIVE',
      body: 'GoAgent Zhizi VIP membership',
      orderType: 'PURCHASE_PRODUCT',
      productName,
      extraInfo: { autoRenew: false }
    }
  } else {
    amountFen = Number(request.amountFen)
    if (!Number.isSafeInteger(amountFen) || amountFen <= 0) {
      throw new Error('充值金额无效。')
    }
    body = {
      payType: 'WECHAT',
      amount: amountFen,
      tradeType: 'NATIVE',
      body: 'GoAgent Zhizi account top-up'
    }
  }

  const order = await createZhiziOrder(token, body)
  const codeURL = order.nativePayRequest?.codeURL
  if (order.paidStatus === 'PENDING' && !codeURL) {
    throw new Error('智子云没有返回微信支付二维码，请创建新订单。')
  }
  const qrImageDataUrl = codeURL
    ? await QRCode.toDataURL(codeURL, {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 360,
        color: { dark: '#16211f', light: '#ffffff' }
      })
    : undefined
  const session: ZhiziPaymentSession = {
    orderId: order.id,
    kind: request.kind,
    amountFen: order.amount,
    productName,
    status: order.paidStatus,
    qrImageDataUrl,
    createdAt: order.createdAt,
    paidAt: order.paidAt ?? undefined
  }
  activeOrders.set(order.id, { kind: request.kind, productName, amountFen: order.amount })
  return session
}

export async function createZhiziPaymentSession(
  token: string,
  request: ZhiziPaymentCreateRequest
): Promise<ZhiziPaymentSession> {
  if (createOrderPromise || activeOrders.size > 0) {
    throw new Error('已有支付订单正在处理，请先完成或关闭当前订单。')
  }
  createOrderPromise = buildPaymentSession(token, request).finally(() => {
    createOrderPromise = null
  })
  return createOrderPromise
}

export async function refreshZhiziPaymentSession(
  token: string,
  orderId: string
): Promise<ZhiziPaymentSession> {
  const active = activeOrders.get(orderId)
  if (!active) {
    throw new Error('支付会话已结束，请创建新订单。')
  }
  try {
    const order = await getZhiziOrder(token, orderId)
    const terminal = order.paidStatus === 'SUCCESS' || order.paidStatus === 'FAIL'
    if (terminal) activeOrders.delete(orderId)
    return {
      orderId: order.id,
      kind: active.kind,
      amountFen: order.amount,
      productName: active.productName,
      status: order.paidStatus,
      createdAt: order.createdAt,
      paidAt: order.paidAt ?? undefined,
      error: order.paidStatus === 'FAIL'
        ? {
            code: 'payment-failed',
            retryable: false,
            message: '支付没有完成，请创建新订单后重试。'
          }
        : undefined
    }
  } catch (cause) {
    return {
      orderId,
      kind: active.kind,
      amountFen: active.amountFen,
      productName: active.productName,
      status: 'PENDING',
      error: asZhiziApiError(cause)
    }
  }
}

export function cancelZhiziPaymentSession(orderId: string): ZhiziPaymentSession | null {
  const active = activeOrders.get(orderId)
  if (!active) return null
  activeOrders.delete(orderId)
  return {
    orderId,
    kind: active.kind,
    amountFen: active.amountFen,
    productName: active.productName,
    status: 'CANCELLED'
  }
}
