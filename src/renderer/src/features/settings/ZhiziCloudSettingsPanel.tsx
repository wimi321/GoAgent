import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react'
import type {
  AppSettings,
  DashboardData,
  ZhiziAccountData,
  ZhiziCreditPage,
  ZhiziEngineProfile,
  ZhiziGpuType,
  ZhiziIdentifier,
  ZhiziKataName,
  ZhiziKataWeight,
  ZhiziPaymentCreateRequest,
  ZhiziPaymentSession,
  ZhiziUsagePage
} from '@main/lib/types'

type Locale = AppSettings['reviewLanguage']
type ViewId = 'compute' | 'account' | 'history'
type LoginMode = 'password' | 'code' | 'reset'

const zhCN = {
  navTitle: '智子云', navSubtitle: '按需使用远程算力', navSummary: '登录智子云、购买套餐并在需要时启用远程分析。',
  local: '本机分析', remote: '智子云分析', loggedOut: '未登录', loggedIn: '已登录', ready: '已启用',
  compute: '算力', account: '账户与充值', history: '使用记录',
  computeTitle: '选择远程算力', computeIntro: 'GoAgent 默认使用本机分析。只有你确认启用后，棋局才会发送到智子云。',
  currentEngine: '当前分析方式', recommended: '为你推荐', membershipRecommended: '你的 VIP 可使用共享算力，不会额外按时计费。', paidRecommended: '当前没有有效 VIP，推荐从 1x 开始，按实际使用时间计费。',
  gpu: '算力档位', backend: '分析引擎', weight: '棋力权重',
  vipShare: 'VIP 共享', gpu1: '独享 1x', gpu3: '独享 3x', gpu6: '独享 6x', gpu12: '独享 12x', gpu24: '独享 24x',
  vipIncluded: '需有效 VIP', metered: '按时间计费', paidConfirm: '我知道独享算力会从余额中按使用时间扣费。',
  test: '检测连接', testing: '正在检测', enable: '启用智子云', enabling: '正在连接', disable: '回到本机分析',
  loginRequired: '请先登录智子云，再检测或启用远程算力。', connectionSuccess: '远程分析连接正常。',
  accountTitle: '智子云账户', accountIntro: '密码和验证码只用于智子官方登录。GoAgent 不保存密码，也不会在界面显示登录凭据。',
  identifier: '手机号或邮箱', password: '密码', code: '验证码', newPassword: '新密码',
  passwordLogin: '密码登录', codeLogin: '验证码登录', resetPassword: '忘记密码', sendCode: '发送验证码', sending: '发送中', login: '登录', loggingIn: '正在登录', reset: '重置并登录',
  balance: '可用余额', yesterday: '昨日消费', connections: '当前连接', membership: 'VIP 状态', active: '有效', inactive: '未开通', expires: '到期',
  vipProducts: 'VIP 套餐', topUp: '余额充值', customAmount: '自定义金额', payWechat: '微信扫码支付', logout: '退出登录', officialApp: '打开智子官方 App',
  month1: '1 个月', month3: '3 个月', month6: '6 个月', month12: '12 个月', buy: '购买', recharge: '充值',
  paymentTitle: '微信扫码支付', paymentPending: '请使用微信扫码完成支付。支付成功后页面会自动刷新。', paymentSuccess: '支付成功，账户信息已刷新。', paymentFailed: '支付未完成，请关闭后重新创建订单。', close: '关闭',
  historyTitle: '用量与入账', historyIntro: '这里显示智子官方返回的实际用量和账户变动。', usage: '算力用量', credits: '账户变动', refresh: '刷新', noRecords: '暂无记录',
  time: '时间', tier: '档位', duration: '时长', cost: '费用', change: '变动', source: '来源', previous: '上一页', next: '下一页',
  loading: '正在加载', retry: '重试', unknownError: '操作没有完成，请稍后重试。', accountExpired: '登录已失效，请重新登录。',
  localPrivacy: '使用本机分析时，棋局不会发送到智子云。', remotePrivacy: '启用智子云后，分析所需棋局会发送到智子官方远程引擎。'
} as const

type CopyKey = keyof typeof zhCN

const COPY: Record<Locale, Record<CopyKey, string>> = {
  'zh-CN': zhCN,
  'zh-TW': {
    ...zhCN,
    navTitle: '智子雲', navSubtitle: '按需使用遠端算力', navSummary: '登入智子雲、購買方案並在需要時啟用遠端分析。',
    local: '本機分析', remote: '智子雲分析', loggedOut: '未登入', loggedIn: '已登入', ready: '已啟用', compute: '算力', account: '帳戶與儲值', history: '使用記錄',
    computeTitle: '選擇遠端算力', computeIntro: 'GoAgent 預設使用本機分析。只有你確認啟用後，棋局才會傳送到智子雲。', currentEngine: '目前分析方式', recommended: '為你推薦',
    membershipRecommended: '你的 VIP 可使用共享算力，不會額外按時計費。', paidRecommended: '目前沒有有效 VIP，建議從 1x 開始，按實際使用時間計費。', gpu: '算力檔位', backend: '分析引擎', weight: '棋力權重',
    vipShare: 'VIP 共享', gpu1: '獨享 1x', gpu3: '獨享 3x', gpu6: '獨享 6x', gpu12: '獨享 12x', gpu24: '獨享 24x', vipIncluded: '需有效 VIP', metered: '按時間計費', paidConfirm: '我知道獨享算力會從餘額中按使用時間扣費。',
    test: '檢測連線', testing: '正在檢測', enable: '啟用智子雲', enabling: '正在連線', disable: '回到本機分析', loginRequired: '請先登入智子雲，再檢測或啟用遠端算力。', connectionSuccess: '遠端分析連線正常。',
    accountTitle: '智子雲帳戶', accountIntro: '密碼和驗證碼只用於智子官方登入。GoAgent 不儲存密碼，也不會在介面顯示登入憑據。', identifier: '手機號碼或電子郵件', password: '密碼', code: '驗證碼', newPassword: '新密碼', passwordLogin: '密碼登入', codeLogin: '驗證碼登入', resetPassword: '忘記密碼', sendCode: '傳送驗證碼', sending: '傳送中', login: '登入', loggingIn: '正在登入', reset: '重設並登入',
    balance: '可用餘額', yesterday: '昨日消費', connections: '目前連線', membership: 'VIP 狀態', active: '有效', inactive: '未開通', expires: '到期', vipProducts: 'VIP 方案', topUp: '餘額儲值', customAmount: '自訂金額', payWechat: '微信掃碼支付', logout: '登出', officialApp: '開啟智子官方 App', month1: '1 個月', month3: '3 個月', month6: '6 個月', month12: '12 個月', buy: '購買', recharge: '儲值',
    paymentTitle: '微信掃碼支付', paymentPending: '請使用微信掃碼完成支付。支付成功後頁面會自動重新整理。', paymentSuccess: '支付成功，帳戶資訊已更新。', paymentFailed: '支付未完成，請關閉後重新建立訂單。', close: '關閉', historyTitle: '用量與入帳', historyIntro: '這裡顯示智子官方回傳的實際用量和帳戶變動。', usage: '算力用量', credits: '帳戶變動', refresh: '重新整理', noRecords: '暫無記錄', time: '時間', tier: '檔位', duration: '時長', cost: '費用', change: '變動', source: '來源', previous: '上一頁', next: '下一頁', loading: '正在載入', retry: '重試', unknownError: '操作未完成，請稍後重試。', accountExpired: '登入已失效，請重新登入。', localPrivacy: '使用本機分析時，棋局不會傳送到智子雲。', remotePrivacy: '啟用智子雲後，分析所需棋局會傳送到智子官方遠端引擎。'
  },
  'en-US': {
    ...zhCN,
    navTitle: 'Zhizi Cloud', navSubtitle: 'Remote compute when you need it', navSummary: 'Sign in, purchase a plan, and explicitly enable remote analysis.', local: 'Local analysis', remote: 'Zhizi Cloud', loggedOut: 'Signed out', loggedIn: 'Signed in', ready: 'Enabled', compute: 'Compute', account: 'Account & billing', history: 'Usage',
    computeTitle: 'Choose remote compute', computeIntro: 'GoAgent uses local analysis by default. Games are sent to Zhizi only after you enable it.', currentEngine: 'Current analysis', recommended: 'Recommended', membershipRecommended: 'Your VIP includes shared compute without additional timed charges.', paidRecommended: 'No active VIP was found. Start with 1x, billed by actual use time.', gpu: 'Compute tier', backend: 'Engine', weight: 'Network', vipShare: 'VIP shared', gpu1: 'Dedicated 1x', gpu3: 'Dedicated 3x', gpu6: 'Dedicated 6x', gpu12: 'Dedicated 12x', gpu24: 'Dedicated 24x', vipIncluded: 'Active VIP required', metered: 'Usage billed', paidConfirm: 'I understand dedicated compute is charged from my balance by use time.', test: 'Test connection', testing: 'Testing', enable: 'Enable Zhizi Cloud', enabling: 'Connecting', disable: 'Use local analysis', loginRequired: 'Sign in before testing or enabling remote compute.', connectionSuccess: 'Remote analysis is available.',
    accountTitle: 'Zhizi account', accountIntro: 'Credentials are sent only to Zhizi for sign-in. GoAgent never stores your password or displays sign-in credentials.', identifier: 'Phone or email', password: 'Password', code: 'Verification code', newPassword: 'New password', passwordLogin: 'Password', codeLogin: 'Code', resetPassword: 'Reset password', sendCode: 'Send code', sending: 'Sending', login: 'Sign in', loggingIn: 'Signing in', reset: 'Reset and sign in', balance: 'Balance', yesterday: 'Yesterday', connections: 'Connections', membership: 'VIP', active: 'Active', inactive: 'Inactive', expires: 'Expires', vipProducts: 'VIP plans', topUp: 'Top up balance', customAmount: 'Custom amount', payWechat: 'Pay with WeChat', logout: 'Sign out', officialApp: 'Open Zhizi app', month1: '1 month', month3: '3 months', month6: '6 months', month12: '12 months', buy: 'Buy', recharge: 'Top up',
    paymentTitle: 'WeChat payment', paymentPending: 'Scan with WeChat. This page refreshes automatically after payment.', paymentSuccess: 'Payment completed and account data refreshed.', paymentFailed: 'Payment did not complete. Close this dialog and create a new order.', close: 'Close', historyTitle: 'Usage and credits', historyIntro: 'Actual usage and account changes returned by Zhizi.', usage: 'Compute usage', credits: 'Account changes', refresh: 'Refresh', noRecords: 'No records', time: 'Time', tier: 'Tier', duration: 'Duration', cost: 'Cost', change: 'Change', source: 'Source', previous: 'Previous', next: 'Next', loading: 'Loading', retry: 'Retry', unknownError: 'The operation did not complete. Please try again.', accountExpired: 'Your session expired. Please sign in again.', localPrivacy: 'Local analysis does not send games to Zhizi.', remotePrivacy: 'When enabled, positions required for analysis are sent to Zhizi’s official engine.'
  },
  'ja-JP': {
    ...zhCN,
    navTitle: '智子クラウド', navSubtitle: '必要なときだけリモート解析', navSummary: 'ログイン、プラン購入、リモート解析の有効化を行います。', local: 'ローカル解析', remote: '智子クラウド', loggedOut: '未ログイン', loggedIn: 'ログイン済み', ready: '有効', compute: '計算資源', account: 'アカウントと支払い', history: '利用履歴', computeTitle: 'リモート計算資源を選択', computeIntro: 'GoAgent は既定でローカル解析を使います。有効化した場合のみ棋局を智子クラウドへ送信します。', currentEngine: '現在の解析方式', recommended: 'おすすめ', membershipRecommended: 'VIP 共有計算は追加の時間課金なしで利用できます。', paidRecommended: '有効な VIP がありません。実使用時間で課金される 1x からの利用をおすすめします。', gpu: '計算プラン', backend: '解析エンジン', weight: 'ネットワーク', vipShare: 'VIP 共有', gpu1: '専用 1x', gpu3: '専用 3x', gpu6: '専用 6x', gpu12: '専用 12x', gpu24: '専用 24x', vipIncluded: '有効な VIP が必要', metered: '時間課金', paidConfirm: '専用計算資源は利用時間に応じて残高から引かれることを確認しました。', test: '接続テスト', testing: 'テスト中', enable: '智子クラウドを有効化', enabling: '接続中', disable: 'ローカル解析に戻す', loginRequired: '先に智子クラウドへログインしてください。', connectionSuccess: 'リモート解析に接続できます。',
    accountTitle: '智子アカウント', accountIntro: 'パスワードと認証コードは智子公式ログインにのみ使用します。GoAgent はパスワードを保存せず、ログイン情報を画面に表示しません。', identifier: '電話番号またはメール', password: 'パスワード', code: '認証コード', newPassword: '新しいパスワード', passwordLogin: 'パスワード', codeLogin: '認証コード', resetPassword: 'パスワード再設定', sendCode: 'コード送信', sending: '送信中', login: 'ログイン', loggingIn: 'ログイン中', reset: '再設定してログイン', balance: '利用可能残高', yesterday: '昨日の利用', connections: '接続数', membership: 'VIP', active: '有効', inactive: '未加入', expires: '期限', vipProducts: 'VIP プラン', topUp: '残高チャージ', customAmount: '金額を指定', payWechat: 'WeChat で支払う', logout: 'ログアウト', officialApp: '智子公式アプリを開く', month1: '1か月', month3: '3か月', month6: '6か月', month12: '12か月', buy: '購入', recharge: 'チャージ', paymentTitle: 'WeChat 支払い', paymentPending: 'WeChat でスキャンしてください。完了後に自動更新します。', paymentSuccess: '支払いが完了し、アカウント情報を更新しました。', paymentFailed: '支払いが完了しませんでした。閉じて新しい注文を作成してください。', close: '閉じる', historyTitle: '利用量と入金', historyIntro: '智子公式から返された実際の利用量とアカウント変更です。', usage: '計算資源の利用', credits: 'アカウント変更', refresh: '更新', noRecords: '履歴はありません', time: '日時', tier: 'プラン', duration: '時間', cost: '費用', change: '変更', source: '内容', previous: '前へ', next: '次へ', loading: '読み込み中', retry: '再試行', unknownError: '操作を完了できませんでした。もう一度お試しください。', accountExpired: 'ログインの有効期限が切れました。再度ログインしてください。', localPrivacy: 'ローカル解析では棋局を智子へ送信しません。', remotePrivacy: '有効化すると、解析に必要な棋局を智子公式エンジンへ送信します。'
  },
  'ko-KR': {
    ...zhCN,
    navTitle: 'Zhizi Cloud', navSubtitle: '필요할 때만 원격 연산', navSummary: '로그인, 요금제 구매, 원격 분석 활성화를 관리합니다.', local: '로컬 분석', remote: 'Zhizi Cloud', loggedOut: '로그아웃', loggedIn: '로그인됨', ready: '활성화됨', compute: '연산', account: '계정 및 결제', history: '사용 기록', computeTitle: '원격 연산 선택', computeIntro: 'GoAgent는 기본적으로 로컬 분석을 사용합니다. 직접 활성화한 경우에만 기보를 Zhizi로 보냅니다.', currentEngine: '현재 분석 방식', recommended: '추천', membershipRecommended: 'VIP 공유 연산은 추가 시간 요금 없이 사용할 수 있습니다.', paidRecommended: '유효한 VIP가 없습니다. 실제 사용 시간으로 과금되는 1x부터 권장합니다.', gpu: '연산 등급', backend: '분석 엔진', weight: '네트워크', vipShare: 'VIP 공유', gpu1: '전용 1x', gpu3: '전용 3x', gpu6: '전용 6x', gpu12: '전용 12x', gpu24: '전용 24x', vipIncluded: '유효한 VIP 필요', metered: '사용 시간 과금', paidConfirm: '전용 연산은 사용 시간에 따라 잔액에서 차감됨을 확인했습니다.', test: '연결 테스트', testing: '테스트 중', enable: 'Zhizi Cloud 활성화', enabling: '연결 중', disable: '로컬 분석 사용', loginRequired: '먼저 Zhizi Cloud에 로그인하세요.', connectionSuccess: '원격 분석 연결이 정상입니다.', accountTitle: 'Zhizi 계정', accountIntro: '비밀번호와 인증 코드는 Zhizi 공식 로그인에만 사용됩니다. GoAgent는 비밀번호를 저장하거나 로그인 정보를 화면에 표시하지 않습니다.', identifier: '전화번호 또는 이메일', password: '비밀번호', code: '인증 코드', newPassword: '새 비밀번호', passwordLogin: '비밀번호', codeLogin: '인증 코드', resetPassword: '비밀번호 재설정', sendCode: '코드 전송', sending: '전송 중', login: '로그인', loggingIn: '로그인 중', reset: '재설정 후 로그인', balance: '사용 가능 잔액', yesterday: '어제 사용액', connections: '현재 연결', membership: 'VIP', active: '유효', inactive: '미가입', expires: '만료', vipProducts: 'VIP 요금제', topUp: '잔액 충전', customAmount: '직접 입력', payWechat: 'WeChat 결제', logout: '로그아웃', officialApp: 'Zhizi 공식 앱 열기', month1: '1개월', month3: '3개월', month6: '6개월', month12: '12개월', buy: '구매', recharge: '충전', paymentTitle: 'WeChat 결제', paymentPending: 'WeChat으로 스캔하세요. 결제 후 자동으로 새로고침됩니다.', paymentSuccess: '결제가 완료되어 계정 정보를 갱신했습니다.', paymentFailed: '결제가 완료되지 않았습니다. 닫고 새 주문을 만드세요.', close: '닫기', historyTitle: '사용량 및 입금', historyIntro: 'Zhizi 공식 데이터의 실제 사용량과 계정 변경입니다.', usage: '연산 사용량', credits: '계정 변경', refresh: '새로고침', noRecords: '기록 없음', time: '시간', tier: '등급', duration: '기간', cost: '비용', change: '변동', source: '출처', previous: '이전', next: '다음', loading: '불러오는 중', retry: '다시 시도', unknownError: '작업을 완료하지 못했습니다. 다시 시도하세요.', accountExpired: '로그인이 만료되었습니다. 다시 로그인하세요.', localPrivacy: '로컬 분석에서는 기보를 Zhizi로 보내지 않습니다.', remotePrivacy: '활성화하면 분석에 필요한 기보가 Zhizi 공식 원격 엔진으로 전송됩니다.'
  },
  'th-TH': {
    ...zhCN,
    navTitle: 'Zhizi Cloud', navSubtitle: 'ใช้พลังประมวลผลระยะไกลเมื่อจำเป็น', navSummary: 'เข้าสู่ระบบ ซื้อแพ็กเกจ และเปิดใช้การวิเคราะห์ระยะไกล', local: 'วิเคราะห์บนเครื่อง', remote: 'Zhizi Cloud', loggedOut: 'ยังไม่เข้าสู่ระบบ', loggedIn: 'เข้าสู่ระบบแล้ว', ready: 'เปิดใช้อยู่', compute: 'พลังประมวลผล', account: 'บัญชีและการชำระเงิน', history: 'ประวัติการใช้', computeTitle: 'เลือกพลังประมวลผลระยะไกล', computeIntro: 'GoAgent ใช้การวิเคราะห์บนเครื่องเป็นค่าเริ่มต้น เกมจะถูกส่งไป Zhizi หลังจากคุณยืนยันเปิดใช้เท่านั้น', currentEngine: 'วิธีวิเคราะห์ปัจจุบัน', recommended: 'แนะนำ', membershipRecommended: 'VIP ของคุณใช้ระบบแชร์ได้โดยไม่มีค่าบริการตามเวลาเพิ่มเติม', paidRecommended: 'ไม่พบ VIP ที่ใช้งานได้ แนะนำเริ่มจาก 1x ซึ่งคิดค่าบริการตามเวลาที่ใช้จริง', gpu: 'ระดับพลังประมวลผล', backend: 'เอนจิน', weight: 'โมเดล', vipShare: 'VIP แชร์', gpu1: 'ส่วนตัว 1x', gpu3: 'ส่วนตัว 3x', gpu6: 'ส่วนตัว 6x', gpu12: 'ส่วนตัว 12x', gpu24: 'ส่วนตัว 24x', vipIncluded: 'ต้องมี VIP', metered: 'คิดตามเวลา', paidConfirm: 'ฉันเข้าใจว่าระบบส่วนตัวจะหักยอดตามเวลาที่ใช้', test: 'ทดสอบการเชื่อมต่อ', testing: 'กำลังทดสอบ', enable: 'เปิดใช้ Zhizi Cloud', enabling: 'กำลังเชื่อมต่อ', disable: 'กลับไปใช้เครื่อง', loginRequired: 'กรุณาเข้าสู่ระบบก่อนทดสอบหรือเปิดใช้', connectionSuccess: 'การวิเคราะห์ระยะไกลพร้อมใช้งาน', accountTitle: 'บัญชี Zhizi', accountIntro: 'รหัสผ่านและรหัสยืนยันใช้เข้าสู่ระบบ Zhizi เท่านั้น GoAgent ไม่เก็บรหัสผ่านหรือแสดงข้อมูลเข้าสู่ระบบ', identifier: 'โทรศัพท์หรืออีเมล', password: 'รหัสผ่าน', code: 'รหัสยืนยัน', newPassword: 'รหัสผ่านใหม่', passwordLogin: 'รหัสผ่าน', codeLogin: 'รหัสยืนยัน', resetPassword: 'ลืมรหัสผ่าน', sendCode: 'ส่งรหัส', sending: 'กำลังส่ง', login: 'เข้าสู่ระบบ', loggingIn: 'กำลังเข้าสู่ระบบ', reset: 'ตั้งใหม่และเข้าสู่ระบบ', balance: 'ยอดคงเหลือ', yesterday: 'ค่าใช้เมื่อวาน', connections: 'การเชื่อมต่อ', membership: 'VIP', active: 'ใช้งานได้', inactive: 'ยังไม่มี', expires: 'หมดอายุ', vipProducts: 'แพ็กเกจ VIP', topUp: 'เติมเงิน', customAmount: 'จำนวนเงินเอง', payWechat: 'จ่ายด้วย WeChat', logout: 'ออกจากระบบ', officialApp: 'เปิดแอป Zhizi', month1: '1 เดือน', month3: '3 เดือน', month6: '6 เดือน', month12: '12 เดือน', buy: 'ซื้อ', recharge: 'เติมเงิน', paymentTitle: 'ชำระด้วย WeChat', paymentPending: 'สแกนด้วย WeChat หน้านี้จะอัปเดตอัตโนมัติเมื่อชำระสำเร็จ', paymentSuccess: 'ชำระสำเร็จและอัปเดตบัญชีแล้ว', paymentFailed: 'ชำระไม่สำเร็จ โปรดปิดและสร้างรายการใหม่', close: 'ปิด', historyTitle: 'การใช้และรายการเงิน', historyIntro: 'ข้อมูลการใช้งานจริงและการเปลี่ยนแปลงบัญชีจาก Zhizi', usage: 'การใช้พลังประมวลผล', credits: 'รายการบัญชี', refresh: 'รีเฟรช', noRecords: 'ไม่มีข้อมูล', time: 'เวลา', tier: 'ระดับ', duration: 'ระยะเวลา', cost: 'ค่าใช้จ่าย', change: 'เปลี่ยนแปลง', source: 'ที่มา', previous: 'ก่อนหน้า', next: 'ถัดไป', loading: 'กำลังโหลด', retry: 'ลองอีกครั้ง', unknownError: 'ดำเนินการไม่สำเร็จ โปรดลองอีกครั้ง', accountExpired: 'เซสชันหมดอายุ โปรดเข้าสู่ระบบใหม่', localPrivacy: 'การวิเคราะห์บนเครื่องจะไม่ส่งเกมไป Zhizi', remotePrivacy: 'เมื่อเปิดใช้ เกมที่จำเป็นจะถูกส่งไปเอนจินทางการของ Zhizi'
  },
  'vi-VN': {
    ...zhCN,
    navTitle: 'Zhizi Cloud', navSubtitle: 'Dùng máy chủ khi cần', navSummary: 'Đăng nhập, mua gói và chủ động bật phân tích từ xa.', local: 'Phân tích trên máy', remote: 'Zhizi Cloud', loggedOut: 'Chưa đăng nhập', loggedIn: 'Đã đăng nhập', ready: 'Đang bật', compute: 'Máy chủ', account: 'Tài khoản & thanh toán', history: 'Lịch sử sử dụng', computeTitle: 'Chọn máy chủ từ xa', computeIntro: 'GoAgent mặc định phân tích trên máy. Ván cờ chỉ được gửi tới Zhizi sau khi bạn xác nhận bật.', currentEngine: 'Cách phân tích hiện tại', recommended: 'Đề xuất', membershipRecommended: 'VIP của bạn dùng được máy chủ chia sẻ mà không tính thêm theo thời gian.', paidRecommended: 'Không có VIP còn hiệu lực. Nên bắt đầu với 1x, tính phí theo thời gian thực dùng.', gpu: 'Gói máy chủ', backend: 'Engine', weight: 'Mạng cờ', vipShare: 'VIP chia sẻ', gpu1: 'Riêng 1x', gpu3: 'Riêng 3x', gpu6: 'Riêng 6x', gpu12: 'Riêng 12x', gpu24: 'Riêng 24x', vipIncluded: 'Cần VIP còn hiệu lực', metered: 'Tính phí theo giờ', paidConfirm: 'Tôi hiểu máy chủ riêng sẽ trừ số dư theo thời gian sử dụng.', test: 'Kiểm tra kết nối', testing: 'Đang kiểm tra', enable: 'Bật Zhizi Cloud', enabling: 'Đang kết nối', disable: 'Dùng phân tích trên máy', loginRequired: 'Hãy đăng nhập trước khi kiểm tra hoặc bật máy chủ.', connectionSuccess: 'Phân tích từ xa đã sẵn sàng.', accountTitle: 'Tài khoản Zhizi', accountIntro: 'Mật khẩu và mã chỉ được dùng để đăng nhập Zhizi. GoAgent không lưu mật khẩu hoặc hiển thị thông tin đăng nhập.', identifier: 'Số điện thoại hoặc email', password: 'Mật khẩu', code: 'Mã xác minh', newPassword: 'Mật khẩu mới', passwordLogin: 'Mật khẩu', codeLogin: 'Mã xác minh', resetPassword: 'Quên mật khẩu', sendCode: 'Gửi mã', sending: 'Đang gửi', login: 'Đăng nhập', loggingIn: 'Đang đăng nhập', reset: 'Đặt lại và đăng nhập', balance: 'Số dư', yesterday: 'Chi hôm qua', connections: 'Kết nối', membership: 'VIP', active: 'Còn hiệu lực', inactive: 'Chưa có', expires: 'Hết hạn', vipProducts: 'Gói VIP', topUp: 'Nạp số dư', customAmount: 'Số tiền khác', payWechat: 'Thanh toán WeChat', logout: 'Đăng xuất', officialApp: 'Mở ứng dụng Zhizi', month1: '1 tháng', month3: '3 tháng', month6: '6 tháng', month12: '12 tháng', buy: 'Mua', recharge: 'Nạp', paymentTitle: 'Thanh toán WeChat', paymentPending: 'Quét bằng WeChat. Trang sẽ tự cập nhật sau khi thanh toán.', paymentSuccess: 'Thanh toán thành công và dữ liệu tài khoản đã cập nhật.', paymentFailed: 'Thanh toán chưa hoàn tất. Hãy đóng và tạo đơn mới.', close: 'Đóng', historyTitle: 'Mức dùng và giao dịch', historyIntro: 'Mức sử dụng thực tế và thay đổi tài khoản do Zhizi trả về.', usage: 'Mức dùng máy chủ', credits: 'Thay đổi tài khoản', refresh: 'Làm mới', noRecords: 'Chưa có dữ liệu', time: 'Thời gian', tier: 'Gói', duration: 'Thời lượng', cost: 'Chi phí', change: 'Thay đổi', source: 'Nguồn', previous: 'Trước', next: 'Sau', loading: 'Đang tải', retry: 'Thử lại', unknownError: 'Thao tác chưa hoàn tất. Vui lòng thử lại.', accountExpired: 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.', localPrivacy: 'Phân tích trên máy không gửi ván cờ tới Zhizi.', remotePrivacy: 'Khi bật, vị trí cần phân tích được gửi tới engine chính thức của Zhizi.'
  }
}

export function zhiziSettingsNavCopy(locale: Locale): Pick<Record<CopyKey, string>, 'navTitle' | 'navSubtitle' | 'navSummary'> {
  const copy = COPY[locale] ?? COPY['en-US']
  return { navTitle: copy.navTitle, navSubtitle: copy.navSubtitle, navSummary: copy.navSummary }
}

function identifierFrom(value: string): ZhiziIdentifier {
  const trimmed = value.trim()
  return { kind: trimmed.includes('@') ? 'email' : 'phone', value: trimmed }
}

function cleanError(cause: unknown, fallback: string): string {
  const value = cause instanceof Error ? cause.message : String(cause)
  return value.replace(/^Error invoking remote method '[^']+': Error:\s*/i, '').replace(/^Error:\s*/i, '') || fallback
}

function formatYuan(value: number | undefined): string {
  return `¥${Number(value ?? 0).toFixed(2)}`
}

function yuanInputToFen(value: string): number | null {
  const match = value.trim().match(/^(\d+)(?:\.(\d{1,2}))?$/)
  if (!match) return null
  const fen = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'))
  return Number.isSafeInteger(fen) && fen > 0 ? fen : null
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`
  return `${(seconds / 3600).toFixed(1)}h`
}

function formatDate(value: string | undefined, locale: Locale): string {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(locale)
}

const productMonths: Record<string, CopyKey> = {
  MEMBERSHIP_1_MONTH: 'month1', MEMBERSHIP_3_MONTH: 'month3', MEMBERSHIP_6_MONTH: 'month6', MEMBERSHIP_12_MONTH: 'month12'
}

export function ZhiziCloudSettingsPanel({
  dashboard,
  busy,
  locale,
  onDashboardUpdated
}: {
  dashboard: DashboardData
  busy: string
  locale: Locale
  onDashboardUpdated: (next: DashboardData) => void
}): ReactElement {
  const c = COPY[locale] ?? COPY['en-US']
  const hasSavedLogin = dashboard.systemProfile.hasZhiziToken
  const remoteEnabled = dashboard.settings.katagoEngineMode === 'zhizi'
  const [view, setView] = useState<ViewId>('account')
  const [loginMode, setLoginMode] = useState<LoginMode>('password')
  const [identifier, setIdentifier] = useState(dashboard.settings.zhiziUsername)
  const [password, setPassword] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [codeCooldown, setCodeCooldown] = useState(0)
  const [accountData, setAccountData] = useState<ZhiziAccountData | null>(null)
  const [usagePage, setUsagePage] = useState<ZhiziUsagePage | null>(null)
  const [creditPage, setCreditPage] = useState<ZhiziCreditPage | null>(null)
  const [historyKind, setHistoryKind] = useState<'usage' | 'credits'>('usage')
  const [profile, setProfile] = useState<ZhiziEngineProfile>({
    gpuType: dashboard.settings.zhiziGpuType,
    kataName: dashboard.settings.zhiziKataName,
    kataWeight: dashboard.settings.zhiziKataWeight
  })
  const [paidConfirmed, setPaidConfirmed] = useState(false)
  const [working, setWorking] = useState(hasSavedLogin ? 'account' : '')
  const [message, setMessage] = useState('')
  const [customTopUp, setCustomTopUp] = useState('30')
  const [payment, setPayment] = useState<ZhiziPaymentSession | null>(null)

  const overview = accountData?.overview
  const loggedIn = overview?.tokenValid === true
  const accountChecking = hasSavedLogin && accountData === null && working === 'account'
  const isVip = Boolean(overview?.isMembership)
  const paidTier = profile.gpuType !== 'vip-share'
  const customTopUpFen = yuanInputToFen(customTopUp)

  const refreshAccount = useCallback(async (): Promise<void> => {
    setWorking('account')
    setMessage('')
    try {
      const next = await window.goagent.getZhiziAccountData()
      setAccountData(next)
      if (hasSavedLogin && !next.overview.tokenValid) setMessage(c.accountExpired)
    } catch (cause) {
      setMessage(cleanError(cause, c.unknownError))
    } finally {
      setWorking('')
    }
  }, [c.accountExpired, c.unknownError, hasSavedLogin])

  const refreshHistory = useCallback(async (kind = historyKind, page = 0): Promise<void> => {
    if (!loggedIn) return
    setWorking('history')
    setMessage('')
    try {
      if (kind === 'usage') setUsagePage(await window.goagent.getZhiziUsages(page, 20))
      else setCreditPage(await window.goagent.getZhiziCredits(page, 20))
    } catch (cause) {
      setMessage(cleanError(cause, c.unknownError))
    } finally {
      setWorking('')
    }
  }, [c.unknownError, historyKind, loggedIn])

  useEffect(() => {
    setIdentifier(dashboard.settings.zhiziUsername)
    setProfile({
      gpuType: dashboard.settings.zhiziGpuType,
      kataName: dashboard.settings.zhiziKataName,
      kataWeight: dashboard.settings.zhiziKataWeight
    })
  }, [dashboard.settings.zhiziGpuType, dashboard.settings.zhiziKataName, dashboard.settings.zhiziKataWeight, dashboard.settings.zhiziUsername])

  useEffect(() => {
    void refreshAccount()
  }, [hasSavedLogin, refreshAccount])

  useEffect(() => {
    if (!loggedIn) setView('account')
  }, [loggedIn])

  useEffect(() => {
    if (codeCooldown <= 0) return
    const timer = window.setTimeout(() => setCodeCooldown((value) => Math.max(0, value - 1)), 1000)
    return () => window.clearTimeout(timer)
  }, [codeCooldown])

  useEffect(() => {
    if (view === 'history' && loggedIn) void refreshHistory(historyKind, 0)
  }, [historyKind, loggedIn, refreshHistory, view])

  useEffect(() => {
    if (!payment || payment.status !== 'PENDING') return
    const orderId = payment.orderId
    const timer = window.setInterval(async () => {
      try {
        const next = await window.goagent.refreshZhiziPayment(orderId)
        setPayment((current) => current?.orderId === orderId ? { ...current, ...next } : current)
        if (next.status === 'SUCCESS') {
          window.clearInterval(timer)
          await refreshAccount()
        }
        if (next.status === 'FAIL') window.clearInterval(timer)
      } catch (cause) {
        setPayment((current) => current?.orderId === orderId
          ? { ...current, error: { code: 'network-error', retryable: true, message: cleanError(cause, c.unknownError) } }
          : current)
      }
    }, 2000)
    return () => window.clearInterval(timer)
  }, [c.unknownError, payment?.orderId, payment?.status, refreshAccount])

  const recommendation = useMemo<ZhiziGpuType>(() => overview?.recommendedGpuType ?? '1x', [overview?.recommendedGpuType])

  async function login(): Promise<void> {
    if (!identifier.trim() || (loginMode === 'password' && !password) || (loginMode !== 'password' && !verificationCode)) return
    setWorking('login')
    setMessage('')
    try {
      const id = identifierFrom(identifier)
      const result = loginMode === 'password'
        ? await window.goagent.loginZhiziCloudPassword({ identifier: id, password })
        : loginMode === 'code'
          ? await window.goagent.loginZhiziCloudCode({ identifier: id, verificationCode })
          : await window.goagent.resetZhiziCloudPassword({ identifier: id, verificationCode, password })
      if (result.dashboard) onDashboardUpdated(result.dashboard)
      setPassword('')
      setVerificationCode('')
      setMessage(result.message)
    } catch (cause) {
      setMessage(cleanError(cause, c.unknownError))
    } finally {
      setWorking('')
    }
  }

  async function sendCode(): Promise<void> {
    if (!identifier.trim()) return
    setWorking('code')
    setMessage('')
    try {
      const result = await window.goagent.sendZhiziCloudLoginCode({
        identifier: identifierFrom(identifier),
        purpose: loginMode === 'reset' ? 'reset_password' : 'fast_login'
      })
      setCodeCooldown(60)
      setMessage(result.message)
    } catch (cause) {
      setMessage(cleanError(cause, c.unknownError))
    } finally {
      setWorking('')
    }
  }

  async function testConnection(): Promise<void> {
    if (!loggedIn) {
      setMessage(c.loginRequired)
      setView('account')
      return
    }
    setWorking('test')
    setMessage('')
    try {
      await window.goagent.updateSettings({
        zhiziGpuType: profile.gpuType,
        zhiziKataName: profile.kataName,
        zhiziKataWeight: profile.kataWeight
      })
      const result = await window.goagent.testZhiziCloudConnection()
      setMessage(result.message || (result.ok ? c.connectionSuccess : c.unknownError))
    } catch (cause) {
      setMessage(cleanError(cause, c.unknownError))
    } finally {
      setWorking('')
    }
  }

  async function enableRemote(): Promise<void> {
    if (!loggedIn) {
      setMessage(c.loginRequired)
      setView('account')
      return
    }
    if (paidTier && !paidConfirmed) return
    if (profile.gpuType === 'vip-share' && !isVip) {
      setMessage(c.vipIncluded)
      setView('account')
      return
    }
    setWorking('enable')
    setMessage('')
    try {
      const result = await window.goagent.enableZhiziCloud(profile)
      if (result.dashboard) onDashboardUpdated(result.dashboard)
      setMessage(result.message)
    } catch (cause) {
      setMessage(cleanError(cause, c.unknownError))
    } finally {
      setWorking('')
    }
  }

  async function disableRemote(): Promise<void> {
    setWorking('disable')
    try {
      const result = await window.goagent.disableZhiziCloud()
      if (result.dashboard) onDashboardUpdated(result.dashboard)
      setMessage(result.message)
    } catch (cause) {
      setMessage(cleanError(cause, c.unknownError))
    } finally {
      setWorking('')
    }
  }

  async function logout(): Promise<void> {
    setWorking('logout')
    try {
      const result = await window.goagent.logoutZhiziCloud()
      if (result.dashboard) onDashboardUpdated(result.dashboard)
      setAccountData(null)
      setMessage(result.message)
    } catch (cause) {
      setMessage(cleanError(cause, c.unknownError))
    } finally {
      setWorking('')
    }
  }

  async function createPayment(request: ZhiziPaymentCreateRequest): Promise<void> {
    setWorking('payment')
    setMessage('')
    try {
      setPayment(await window.goagent.createZhiziPayment(request))
    } catch (cause) {
      setMessage(cleanError(cause, c.unknownError))
    } finally {
      setWorking('')
    }
  }

  function closePayment(): void {
    const orderId = payment?.orderId
    setPayment(null)
    if (orderId) void window.goagent.cancelZhiziPayment(orderId)
  }

  const activeHistory = historyKind === 'usage' ? usagePage : creditPage

  return (
    <section className="zhizi-settings" aria-label={c.navTitle}>
      <div className="zhizi-settings__tabs" role="tablist">
        {(loggedIn ? ['compute', 'account', 'history'] as const : ['account'] as const).map((id) => (
          <button key={id} type="button" role="tab" aria-selected={view === id} className={view === id ? 'is-active' : ''} onClick={() => setView(id)}>
            {c[id]}
          </button>
        ))}
      </div>

      {view === 'compute' ? (
        <div className="zhizi-page">
          <header className="zhizi-page__head"><div><h3>{c.computeTitle}</h3><p>{c.computeIntro}</p></div></header>
          <div className="zhizi-engine-status">
            <span>{c.currentEngine}</span>
            <strong>{remoteEnabled ? c.remote : c.local}</strong>
            <small>{remoteEnabled ? c.remotePrivacy : c.localPrivacy}</small>
          </div>
          <div className="zhizi-recommendation">
            <span>{c.recommended}</span>
            <strong>{recommendation === 'vip-share' ? c.vipShare : c.gpu1}</strong>
            <p>{isVip ? c.membershipRecommended : c.paidRecommended}</p>
            <button type="button" className="ghost-button" onClick={() => setProfile((value) => ({ ...value, gpuType: recommendation }))}>{c.recommended}</button>
          </div>
          <div className="zhizi-profile-grid">
            <label>{c.gpu}<select value={profile.gpuType} onChange={(event) => { setPaidConfirmed(false); setProfile((value) => ({ ...value, gpuType: event.target.value as ZhiziGpuType })) }}>
              <option value="vip-share">{c.vipShare} · {c.vipIncluded}</option><option value="1x">{c.gpu1} · {c.metered}</option><option value="3x">{c.gpu3} · {c.metered}</option><option value="6x">{c.gpu6} · {c.metered}</option><option value="12x">{c.gpu12} · {c.metered}</option><option value="24x">{c.gpu24} · {c.metered}</option>
            </select></label>
            <label>{c.backend}<select value={profile.kataName} onChange={(event) => setProfile((value) => ({ ...value, kataName: event.target.value as ZhiziKataName }))}><option value="katago-TENSORRT">KataGo TensorRT</option><option value="katago-CUDA">KataGo CUDA</option></select></label>
            <label>{c.weight}<select value={profile.kataWeight} onChange={(event) => setProfile((value) => ({ ...value, kataWeight: event.target.value as ZhiziKataWeight }))}><option value="28bnbt">28b NBT</option><option value="18bnbt">18b NBT</option><option value="fdx">FDX</option></select></label>
          </div>
          {paidTier ? <label className="zhizi-paid-confirm"><input type="checkbox" checked={paidConfirmed} onChange={(event) => setPaidConfirmed(event.target.checked)} /><span>{c.paidConfirm}</span></label> : null}
          <div className="zhizi-actions">
            <button type="button" className="ghost-button" disabled={Boolean(busy || working)} onClick={() => void testConnection()}>{working === 'test' ? c.testing : c.test}</button>
            {remoteEnabled
              ? <button type="button" className="primary-button" disabled={Boolean(busy || working)} onClick={() => void disableRemote()}>{c.disable}</button>
              : <button type="button" className="primary-button" disabled={Boolean(busy || working || (paidTier && !paidConfirmed))} onClick={() => void enableRemote()}>{working === 'enable' ? c.enabling : c.enable}</button>}
          </div>
        </div>
      ) : null}

      {view === 'account' ? (
        <div className="zhizi-page">
          <header className="zhizi-page__head"><div><h3>{c.accountTitle}</h3><p>{c.accountIntro}</p></div><span className={`settings-status-chip${loggedIn ? ' is-ready' : ''}`}>{accountChecking ? c.loading : loggedIn ? c.loggedIn : c.loggedOut}</span></header>
          {accountChecking ? <div className="zhizi-empty" role="status" aria-live="polite">{c.loading}</div> : !loggedIn ? (
            <div className="zhizi-login-card">
              <div className="zhizi-login-modes">{(['password', 'code', 'reset'] as const).map((mode) => <button key={mode} type="button" className={loginMode === mode ? 'is-active' : ''} onClick={() => { setLoginMode(mode); setMessage('') }}>{c[mode === 'password' ? 'passwordLogin' : mode === 'code' ? 'codeLogin' : 'resetPassword']}</button>)}</div>
              <label>{c.identifier}<input value={identifier} inputMode="email" autoCapitalize="off" autoCorrect="off" spellCheck={false} onChange={(event) => setIdentifier(event.target.value)} /></label>
              {loginMode !== 'code' ? <label>{loginMode === 'reset' ? c.newPassword : c.password}<input type="password" value={password} autoCapitalize="off" autoCorrect="off" spellCheck={false} onChange={(event) => setPassword(event.target.value)} /></label> : null}
              {loginMode !== 'password' ? <label>{c.code}<div className="zhizi-code-row"><input value={verificationCode} inputMode="numeric" autoComplete="one-time-code" onChange={(event) => setVerificationCode(event.target.value.trim())} /><button type="button" className="ghost-button" disabled={Boolean(working || codeCooldown || !identifier.trim())} onClick={() => void sendCode()}>{working === 'code' ? c.sending : codeCooldown ? `${codeCooldown}s` : c.sendCode}</button></div></label> : null}
              <button type="button" className="primary-button" disabled={Boolean(working || !identifier.trim() || (loginMode !== 'code' && !password) || (loginMode !== 'password' && !verificationCode))} onClick={() => void login()}>{working === 'login' ? c.loggingIn : loginMode === 'reset' ? c.reset : c.login}</button>
            </div>
          ) : (
            <>
              <div className="zhizi-account-summary">
                <div><span>{c.balance}</span><strong>{formatYuan(overview?.balance?.remainingBalance)}</strong></div>
                <div><span>{c.yesterday}</span><strong>{formatYuan(overview?.balance?.yesterdayConsumption)}</strong></div>
                <div><span>{c.connections}</span><strong>{overview?.balance?.currentNumOfMyConnections ?? 0}</strong></div>
                <div><span>{c.membership}</span><strong>{isVip ? c.active : c.inactive}</strong><small>{isVip && overview?.membershipExpiresAt ? `${c.expires} ${formatDate(overview.membershipExpiresAt, locale)}` : overview?.identifierMasked}</small></div>
              </div>
              <section className="zhizi-billing-section"><h4>{c.vipProducts}</h4><div className="zhizi-product-grid">{accountData?.products.map((product) => <button type="button" key={product.name} disabled={working === 'payment'} onClick={() => void createPayment({ kind: 'membership', productName: product.name })}><span>{c[productMonths[product.name] ?? 'membership']}</span><strong>{formatYuan(product.priceFen / 100)}</strong><small>{c.buy}</small></button>)}</div></section>
              <section className="zhizi-billing-section"><h4>{c.topUp}</h4><div className="zhizi-topup-row">{[10, 30, 50, 100].map((amount) => <button type="button" key={amount} disabled={working === 'payment'} onClick={() => void createPayment({ kind: 'top-up', amountFen: amount * 100 })}>¥{amount}</button>)}<label><span>{c.customAmount}</span><input value={customTopUp} inputMode="decimal" onChange={(event) => setCustomTopUp(event.target.value)} /></label><button type="button" className="primary-button" disabled={working === 'payment' || customTopUpFen === null} onClick={() => customTopUpFen !== null && void createPayment({ kind: 'top-up', amountFen: customTopUpFen })}>{c.recharge}</button></div></section>
              <div className="zhizi-account-actions"><button type="button" className="ghost-button" onClick={() => void window.goagent.openZhiziOfficialApp()}>{c.officialApp}</button><button type="button" className="ghost-button is-danger" disabled={Boolean(working)} onClick={() => void logout()}>{c.logout}</button></div>
            </>
          )}
        </div>
      ) : null}

      {view === 'history' ? (
        <div className="zhizi-page">
          <header className="zhizi-page__head"><div><h3>{c.historyTitle}</h3><p>{c.historyIntro}</p></div><button type="button" className="ghost-button" disabled={!loggedIn || working === 'history'} onClick={() => void refreshHistory(historyKind, activeHistory?.page ?? 0)}>{c.refresh}</button></header>
          {!loggedIn ? <div className="zhizi-empty">{c.loginRequired}</div> : <>
            <div className="zhizi-history-tabs"><button type="button" className={historyKind === 'usage' ? 'is-active' : ''} onClick={() => setHistoryKind('usage')}>{c.usage}</button><button type="button" className={historyKind === 'credits' ? 'is-active' : ''} onClick={() => setHistoryKind('credits')}>{c.credits}</button></div>
            {working === 'history' && !activeHistory ? <div className="zhizi-empty">{c.loading}</div> : null}
            {historyKind === 'usage' && usagePage ? <div className="zhizi-history-list">{usagePage.items.length ? usagePage.items.map((item) => <div key={item.id} className="zhizi-history-row"><span>{formatDate(item.startedAt, locale)}</span><strong>{item.gpuType || '—'}</strong><span>{formatDuration(item.durationSeconds)}</span><span>{formatYuan(item.totalCostYuan)}</span></div>) : <div className="zhizi-empty">{c.noRecords}</div>}</div> : null}
            {historyKind === 'credits' && creditPage ? <div className="zhizi-history-list">{creditPage.items.length ? creditPage.items.map((item) => <div key={item.id} className="zhizi-history-row"><span>{formatDate(item.createdAt, locale)}</span><strong>{item.productName || item.creditType}</strong><span>{item.source || '—'}</span><span>{formatYuan(item.amountYuan)}</span></div>) : <div className="zhizi-empty">{c.noRecords}</div>}</div> : null}
            {activeHistory ? <div className="zhizi-pagination"><button type="button" disabled={activeHistory.page <= 0 || working === 'history'} onClick={() => void refreshHistory(historyKind, activeHistory.page - 1)}>{c.previous}</button><span>{activeHistory.page + 1}</span><button type="button" disabled={(activeHistory.page + 1) * activeHistory.pageSize >= activeHistory.total || working === 'history'} onClick={() => void refreshHistory(historyKind, activeHistory.page + 1)}>{c.next}</button></div> : null}
          </>}
        </div>
      ) : null}

      {message ? <div className="zhizi-message" role="status" aria-live="polite">{message}</div> : null}

      {payment ? <div className="zhizi-payment-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) closePayment() }}><div className="zhizi-payment-dialog" role="dialog" aria-modal="true" aria-labelledby="zhizi-payment-title"><h3 id="zhizi-payment-title">{c.paymentTitle}</h3>{payment.qrImageDataUrl && payment.status === 'PENDING' ? <img src={payment.qrImageDataUrl} alt={c.payWechat} /> : null}<strong>{formatYuan(payment.amountFen / 100)}</strong><p>{payment.status === 'SUCCESS' ? c.paymentSuccess : payment.status === 'FAIL' ? c.paymentFailed : c.paymentPending}</p>{payment.error ? <small>{payment.error.message}</small> : null}<button type="button" className="primary-button" onClick={closePayment}>{c.close}</button></div></div> : null}
    </section>
  )
}
