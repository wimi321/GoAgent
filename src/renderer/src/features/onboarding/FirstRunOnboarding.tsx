import type { ReactElement } from 'react'
import { useEffect, useMemo, useState } from 'react'
import type {
  DashboardData,
  KataGoAssetInstallProgress,
  KataGoAssetStatus,
  LlmSettingsTestResult
} from '@main/lib/types'
import logoUrl from '../../../../../assets/logo.png'
import { detectSystemUiLocale, normalizeUiLocale, SUPPORTED_UI_LOCALES, type UiLocale } from '../../i18n'

export const FIRST_RUN_ONBOARDING_VERSION = 1

type Copy = {
  language: string
  eyebrow: string
  title: string
  subtitle: string
  aiStep: string
  engineStep: string
  serviceUrl: string
  accessKey: string
  model: string
  urlPlaceholder: string
  keyPlaceholder: string
  modelPlaceholder: string
  refresh: string
  refreshing: string
  show: string
  hide: string
  savedKey: string
  verify: string
  verifying: string
  later: string
  retryHint: string
  text: string
  vision: string
  tools: string
  engineReady: string
  engineReadyDetail: string
  engineMissing: string
  engineMissingDetail: string
  prepare: string
  preparing: string
  autoBenchmark: string
  autoBenchmarkDetail: string
  benchmarkOptional: string
  back: string
  enter: string
  enterLimited: string
  localDefault: string
  modelListEmpty: string
  modelsLoaded: string
  checkPassed: string
  checkFailed: string
  verificationReady: string
  verificationNeedsAttention: string
  technicalDetails: string
  downloadActive: string
  downloadPaused: string
}

const COPY: Record<UiLocale, Copy> = {
  'zh-CN': {
    language: '语言', eyebrow: '首次使用', title: '先连接你的 AI 围棋老师', subtitle: 'GoAgent 会用棋盘图片、KataGo 证据和工具来讲棋。现在配置最完整，也可以稍后再连接。',
    aiStep: 'AI 老师', engineStep: '分析引擎', serviceUrl: 'AI 服务地址', accessKey: '访问密钥', model: '多模态模型',
    urlPlaceholder: 'https://api.example.com/v1', keyPlaceholder: '粘贴访问密钥', modelPlaceholder: '输入或选择模型', refresh: '刷新模型', refreshing: '刷新中…', show: '显示', hide: '隐藏', savedKey: '本机已保存密钥，留空即可继续使用。',
    verify: '验证并继续', verifying: '正在验证…', later: '稍后配置', retryHint: '配置会保存在本机。验证失败也可以稍后处理。',
    text: '文字回复', vision: '棋盘图片', tools: 'Agent 工具', engineReady: '围棋分析已准备好', engineReadyDetail: '内置 KataGo 和模型可以直接使用。', engineMissing: '还需要准备分析引擎', engineMissingDetail: 'GoAgent 可以自动下载并校验所需资源。',
    prepare: '自动准备分析引擎', preparing: '正在准备…', autoBenchmark: '自动优化分析速度', autoBenchmarkDetail: '在后台寻找适合这台电脑的配置；随时可以取消或永久关闭。', benchmarkOptional: '不测速也能正常分析，GoAgent 会使用均衡设置。', back: '返回', enter: '进入 GoAgent', enterLimited: '稍后准备，先进入', localDefault: '默认使用本机分析，不会自动切换远程算力。', modelListEmpty: '模型列表不可用时，可以直接输入模型名称。', modelsLoaded: '模型列表已更新。', checkPassed: '已通过', checkFailed: '需要处理', verificationReady: 'AI 老师已就绪。', verificationNeedsAttention: '还有能力未通过，请核对配置或展开技术详情。', technicalDetails: '技术详情', downloadActive: '正在下载并校验分析资源。', downloadPaused: '下载已暂停，再次点击可以继续。'
  },
  'zh-TW': {
    language: '語言', eyebrow: '首次使用', title: '先連接你的 AI 圍棋老師', subtitle: 'GoAgent 會使用棋盤圖片、KataGo 證據與工具講棋。現在設定最完整，也可以稍後再連接。',
    aiStep: 'AI 老師', engineStep: '分析引擎', serviceUrl: 'AI 服務位址', accessKey: '存取金鑰', model: '多模態模型', urlPlaceholder: 'https://api.example.com/v1', keyPlaceholder: '貼上存取金鑰', modelPlaceholder: '輸入或選擇模型', refresh: '重新整理模型', refreshing: '整理中…', show: '顯示', hide: '隱藏', savedKey: '本機已儲存金鑰，留空即可繼續使用。', verify: '驗證並繼續', verifying: '正在驗證…', later: '稍後設定', retryHint: '設定會儲存在本機。驗證失敗也可以稍後處理。', text: '文字回覆', vision: '棋盤圖片', tools: 'Agent 工具', engineReady: '圍棋分析已準備好', engineReadyDetail: '內建 KataGo 和模型可以直接使用。', engineMissing: '還需要準備分析引擎', engineMissingDetail: 'GoAgent 可以自動下載並驗證所需資源。', prepare: '自動準備分析引擎', preparing: '正在準備…', autoBenchmark: '自動最佳化分析速度', autoBenchmarkDetail: '在背景尋找適合此電腦的設定；隨時可以取消或永久關閉。', benchmarkOptional: '不測速也能正常分析，GoAgent 會使用均衡設定。', back: '返回', enter: '進入 GoAgent', enterLimited: '稍後準備，先進入', localDefault: '預設使用本機分析，不會自動切換遠端算力。', modelListEmpty: '模型清單不可用時，可以直接輸入模型名稱。', modelsLoaded: '模型清單已更新。', checkPassed: '已通過', checkFailed: '需要處理', verificationReady: 'AI 老師已就緒。', verificationNeedsAttention: '仍有能力未通過，請檢查設定或展開技術詳情。', technicalDetails: '技術詳情', downloadActive: '正在下載並驗證分析資源。', downloadPaused: '下載已暫停，再次點擊即可繼續。'
  },
  'en-US': {
    language: 'Language', eyebrow: 'First launch', title: 'Connect your AI Go teacher', subtitle: 'GoAgent teaches with board images, KataGo evidence, and agent tools. Connect now for the full experience, or do it later.',
    aiStep: 'AI teacher', engineStep: 'Analysis engine', serviceUrl: 'AI service URL', accessKey: 'Access key', model: 'Multimodal model', urlPlaceholder: 'https://api.example.com/v1', keyPlaceholder: 'Paste your access key', modelPlaceholder: 'Type or choose a model', refresh: 'Refresh models', refreshing: 'Refreshing…', show: 'Show', hide: 'Hide', savedKey: 'A key is already saved on this device. Leave this blank to keep it.', verify: 'Verify and continue', verifying: 'Verifying…', later: 'Set up later', retryHint: 'Settings stay on this device. You can continue even if verification fails.', text: 'Text response', vision: 'Board image', tools: 'Agent tools', engineReady: 'Go analysis is ready', engineReadyDetail: 'The bundled KataGo engine and model are ready to use.', engineMissing: 'The analysis engine needs setup', engineMissingDetail: 'GoAgent can download and verify the required files automatically.', prepare: 'Prepare analysis engine', preparing: 'Preparing…', autoBenchmark: 'Optimize analysis speed automatically', autoBenchmarkDetail: 'Finds a good configuration in the background. You can cancel or turn it off at any time.', benchmarkOptional: 'Analysis works without a benchmark by using balanced settings.', back: 'Back', enter: 'Enter GoAgent', enterLimited: 'Set up later and enter', localDefault: 'Local analysis is the default. GoAgent never switches to remote compute automatically.', modelListEmpty: 'If the model list is unavailable, type the model name directly.', modelsLoaded: 'Model list updated.', checkPassed: 'Passed', checkFailed: 'Needs attention', verificationReady: 'The AI teacher is ready.', verificationNeedsAttention: 'Some capabilities still need attention. Check the settings or open technical details.', technicalDetails: 'Technical details', downloadActive: 'Downloading and verifying analysis resources.', downloadPaused: 'Download paused. Click again to resume.'
  },
  'ja-JP': {
    language: '言語', eyebrow: '初回起動', title: 'AI 囲碁先生を接続', subtitle: 'GoAgent は盤面画像、KataGo の根拠、ツールを使って解説します。今すぐ設定するか、後から接続できます。', aiStep: 'AI 先生', engineStep: '解析エンジン', serviceUrl: 'AI サービス URL', accessKey: 'アクセスキー', model: 'マルチモーダルモデル', urlPlaceholder: 'https://api.example.com/v1', keyPlaceholder: 'アクセスキーを貼り付け', modelPlaceholder: 'モデルを入力または選択', refresh: 'モデルを更新', refreshing: '更新中…', show: '表示', hide: '非表示', savedKey: 'この端末にキーが保存済みです。空欄のままで利用できます。', verify: '確認して続ける', verifying: '確認中…', later: '後で設定', retryHint: '設定は端末内に保存されます。確認に失敗しても後で設定できます。', text: 'テキスト応答', vision: '盤面画像', tools: 'Agent ツール', engineReady: '囲碁解析の準備完了', engineReadyDetail: '内蔵 KataGo とモデルをすぐに利用できます。', engineMissing: '解析エンジンの準備が必要です', engineMissingDetail: '必要なファイルを自動でダウンロードして確認できます。', prepare: '解析エンジンを準備', preparing: '準備中…', autoBenchmark: '解析速度を自動最適化', autoBenchmarkDetail: 'この端末に合う設定をバックグラウンドで探します。いつでも中止・無効化できます。', benchmarkOptional: '測定しなくてもバランス設定で解析できます。', back: '戻る', enter: 'GoAgent を開く', enterLimited: '後で準備して開く', localDefault: '標準はローカル解析です。自動でリモート計算へ切り替えません。', modelListEmpty: '一覧を取得できない場合はモデル名を直接入力できます。', modelsLoaded: 'モデル一覧を更新しました。', checkPassed: '確認済み', checkFailed: '要確認', verificationReady: 'AI 先生の準備ができました。', verificationNeedsAttention: '未確認の機能があります。設定または技術詳細を確認してください。', technicalDetails: '技術詳細', downloadActive: '解析リソースをダウンロードして確認しています。', downloadPaused: 'ダウンロードを一時停止しました。もう一度押すと再開します。'
  },
  'ko-KR': {
    language: '언어', eyebrow: '첫 실행', title: 'AI 바둑 선생님 연결', subtitle: 'GoAgent는 바둑판 이미지, KataGo 근거, 도구를 사용해 설명합니다. 지금 연결하거나 나중에 설정할 수 있습니다.', aiStep: 'AI 선생님', engineStep: '분석 엔진', serviceUrl: 'AI 서비스 URL', accessKey: '접근 키', model: '멀티모달 모델', urlPlaceholder: 'https://api.example.com/v1', keyPlaceholder: '접근 키 붙여넣기', modelPlaceholder: '모델 입력 또는 선택', refresh: '모델 새로고침', refreshing: '새로고침 중…', show: '표시', hide: '숨기기', savedKey: '이 기기에 키가 저장되어 있습니다. 비워 두면 계속 사용합니다.', verify: '확인하고 계속', verifying: '확인 중…', later: '나중에 설정', retryHint: '설정은 이 기기에 저장됩니다. 확인에 실패해도 나중에 처리할 수 있습니다.', text: '텍스트 응답', vision: '바둑판 이미지', tools: 'Agent 도구', engineReady: '바둑 분석 준비 완료', engineReadyDetail: '내장 KataGo와 모델을 바로 사용할 수 있습니다.', engineMissing: '분석 엔진 준비가 필요합니다', engineMissingDetail: '필요한 파일을 자동으로 다운로드하고 검증할 수 있습니다.', prepare: '분석 엔진 자동 준비', preparing: '준비 중…', autoBenchmark: '분석 속도 자동 최적화', autoBenchmarkDetail: '백그라운드에서 이 컴퓨터에 맞는 설정을 찾습니다. 언제든 취소하거나 끌 수 있습니다.', benchmarkOptional: '속도 측정 없이도 균형 설정으로 정상 분석됩니다.', back: '뒤로', enter: 'GoAgent 시작', enterLimited: '나중에 준비하고 시작', localDefault: '기본은 로컬 분석이며 원격 연산으로 자동 전환하지 않습니다.', modelListEmpty: '모델 목록을 가져오지 못하면 이름을 직접 입력할 수 있습니다.', modelsLoaded: '모델 목록을 새로고침했습니다.', checkPassed: '통과', checkFailed: '확인 필요', verificationReady: 'AI 선생님이 준비되었습니다.', verificationNeedsAttention: '확인할 기능이 남아 있습니다. 설정이나 기술 세부 정보를 확인하세요.', technicalDetails: '기술 세부 정보', downloadActive: '분석 리소스를 다운로드하고 검증하고 있습니다.', downloadPaused: '다운로드를 일시정지했습니다. 다시 누르면 계속됩니다.'
  },
  'th-TH': {
    language: 'ภาษา', eyebrow: 'เปิดครั้งแรก', title: 'เชื่อมต่อครู AI หมากล้อม', subtitle: 'GoAgent อธิบายด้วยภาพกระดาน หลักฐานจาก KataGo และเครื่องมือ คุณตั้งค่าตอนนี้หรือภายหลังก็ได้', aiStep: 'ครู AI', engineStep: 'เอนจินวิเคราะห์', serviceUrl: 'URL บริการ AI', accessKey: 'คีย์เข้าถึง', model: 'โมเดลมัลติโหมด', urlPlaceholder: 'https://api.example.com/v1', keyPlaceholder: 'วางคีย์เข้าถึง', modelPlaceholder: 'พิมพ์หรือเลือกโมเดล', refresh: 'รีเฟรชโมเดล', refreshing: 'กำลังรีเฟรช…', show: 'แสดง', hide: 'ซ่อน', savedKey: 'มีคีย์บันทึกในเครื่องแล้ว เว้นว่างเพื่อใช้คีย์เดิม', verify: 'ตรวจสอบและไปต่อ', verifying: 'กำลังตรวจสอบ…', later: 'ตั้งค่าภายหลัง', retryHint: 'การตั้งค่าเก็บไว้ในเครื่อง แม้ตรวจสอบไม่ผ่านก็ทำภายหลังได้', text: 'ตอบข้อความ', vision: 'ภาพกระดาน', tools: 'เครื่องมือ Agent', engineReady: 'พร้อมวิเคราะห์หมากล้อม', engineReadyDetail: 'KataGo และโมเดลที่มากับแอปพร้อมใช้งาน', engineMissing: 'ต้องเตรียมเอนจินวิเคราะห์', engineMissingDetail: 'GoAgent ดาวน์โหลดและตรวจสอบไฟล์ที่ต้องใช้ให้อัตโนมัติได้', prepare: 'เตรียมเอนจินอัตโนมัติ', preparing: 'กำลังเตรียม…', autoBenchmark: 'ปรับความเร็วอัตโนมัติ', autoBenchmarkDetail: 'ค้นหาค่าที่เหมาะกับเครื่องในเบื้องหลัง ยกเลิกหรือปิดได้ทุกเมื่อ', benchmarkOptional: 'ไม่ทดสอบความเร็วก็วิเคราะห์ได้ด้วยค่ามาตรฐานสมดุล', back: 'ย้อนกลับ', enter: 'เข้า GoAgent', enterLimited: 'เตรียมภายหลังแล้วเข้าใช้', localDefault: 'ค่าเริ่มต้นวิเคราะห์ในเครื่องและไม่สลับไปคำนวณระยะไกลอัตโนมัติ', modelListEmpty: 'หากรายการโมเดลใช้ไม่ได้ ให้พิมพ์ชื่อโมเดลโดยตรง', modelsLoaded: 'อัปเดตรายการโมเดลแล้ว', checkPassed: 'ผ่าน', checkFailed: 'ต้องตรวจสอบ', verificationReady: 'ครู AI พร้อมใช้งานแล้ว', verificationNeedsAttention: 'ยังมีความสามารถที่ต้องตรวจสอบ กรุณาดูการตั้งค่าหรือรายละเอียดทางเทคนิค', technicalDetails: 'รายละเอียดทางเทคนิค', downloadActive: 'กำลังดาวน์โหลดและตรวจสอบทรัพยากรวิเคราะห์', downloadPaused: 'พักการดาวน์โหลดแล้ว กดอีกครั้งเพื่อทำต่อ'
  },
  'vi-VN': {
    language: 'Ngôn ngữ', eyebrow: 'Lần mở đầu', title: 'Kết nối giáo viên cờ vây AI', subtitle: 'GoAgent giảng bằng ảnh bàn cờ, bằng chứng KataGo và công cụ. Bạn có thể kết nối ngay hoặc thiết lập sau.', aiStep: 'Giáo viên AI', engineStep: 'Engine phân tích', serviceUrl: 'URL dịch vụ AI', accessKey: 'Khóa truy cập', model: 'Model đa phương thức', urlPlaceholder: 'https://api.example.com/v1', keyPlaceholder: 'Dán khóa truy cập', modelPlaceholder: 'Nhập hoặc chọn model', refresh: 'Làm mới model', refreshing: 'Đang làm mới…', show: 'Hiện', hide: 'Ẩn', savedKey: 'Khóa đã được lưu trên máy. Để trống để tiếp tục dùng.', verify: 'Xác minh và tiếp tục', verifying: 'Đang xác minh…', later: 'Thiết lập sau', retryHint: 'Cấu hình được lưu trên máy. Bạn vẫn có thể tiếp tục nếu xác minh thất bại.', text: 'Phản hồi chữ', vision: 'Ảnh bàn cờ', tools: 'Công cụ Agent', engineReady: 'Phân tích cờ vây đã sẵn sàng', engineReadyDetail: 'KataGo và model đi kèm có thể dùng ngay.', engineMissing: 'Cần chuẩn bị engine phân tích', engineMissingDetail: 'GoAgent có thể tự tải và kiểm tra các tệp cần thiết.', prepare: 'Tự chuẩn bị engine', preparing: 'Đang chuẩn bị…', autoBenchmark: 'Tự tối ưu tốc độ phân tích', autoBenchmarkDetail: 'Tìm cấu hình phù hợp trong nền; có thể hủy hoặc tắt bất cứ lúc nào.', benchmarkOptional: 'Không đo tốc độ vẫn phân tích bình thường với cấu hình cân bằng.', back: 'Quay lại', enter: 'Vào GoAgent', enterLimited: 'Chuẩn bị sau và vào', localDefault: 'Mặc định phân tích trên máy, không tự chuyển sang máy chủ từ xa.', modelListEmpty: 'Nếu không lấy được danh sách, hãy nhập trực tiếp tên model.', modelsLoaded: 'Đã cập nhật danh sách model.', checkPassed: 'Đạt', checkFailed: 'Cần xử lý', verificationReady: 'Giáo viên AI đã sẵn sàng.', verificationNeedsAttention: 'Một số khả năng vẫn cần xử lý. Hãy kiểm tra cấu hình hoặc chi tiết kỹ thuật.', technicalDetails: 'Chi tiết kỹ thuật', downloadActive: 'Đang tải và xác minh tài nguyên phân tích.', downloadPaused: 'Đã tạm dừng tải. Nhấn lại để tiếp tục.'
  }
}

const PAUSE_DOWNLOAD: Record<UiLocale, string> = {
  'zh-CN': '暂停下载', 'zh-TW': '暫停下載', 'en-US': 'Pause download', 'ja-JP': 'ダウンロードを一時停止',
  'ko-KR': '다운로드 일시정지', 'th-TH': 'พักการดาวน์โหลด', 'vi-VN': 'Tạm dừng tải'
}

const RESUME_DOWNLOAD: Record<UiLocale, string> = {
  'zh-CN': '继续下载', 'zh-TW': '繼續下載', 'en-US': 'Resume download', 'ja-JP': 'ダウンロードを再開',
  'ko-KR': '다운로드 계속', 'th-TH': 'ดาวน์โหลดต่อ', 'vi-VN': 'Tiếp tục tải'
}

function CapabilityRow({
  label,
  check,
  passedLabel,
  failedLabel
}: {
  label: string
  check?: { ok: boolean; message: string }
  passedLabel: string
  failedLabel: string
}): ReactElement {
  return (
    <div className={`onboarding-capability${check ? check.ok ? ' is-ready' : ' is-failed' : ''}`}>
      <span aria-hidden="true">{check ? check.ok ? '✓' : '!' : '·'}</span>
      <div><strong>{label}</strong><small>{check ? check.ok ? passedLabel : failedLabel : '—'}</small></div>
    </div>
  )
}

export function FirstRunOnboarding({
  dashboard,
  katagoAssets,
  installBusy,
  installProgress,
  installMessage,
  onDashboardUpdated,
  onInstallModel,
  onPauseInstall
}: {
  dashboard: DashboardData
  katagoAssets: KataGoAssetStatus | null
  installBusy: boolean
  installProgress: KataGoAssetInstallProgress | null
  installMessage: string
  onDashboardUpdated: (dashboard: DashboardData) => void
  onInstallModel: () => void
  onPauseInstall: () => void
}): ReactElement {
  const [step, setStep] = useState<'ai' | 'engine'>('ai')
  const [locale, setLocale] = useState<UiLocale>(() => detectSystemUiLocale())
  const [baseUrl, setBaseUrl] = useState(dashboard.settings.llmBaseUrl)
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState(dashboard.settings.llmModel)
  const [showKey, setShowKey] = useState(false)
  const [models, setModels] = useState<string[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<LlmSettingsTestResult | null>(null)
  const [message, setMessage] = useState('')
  const [technicalError, setTechnicalError] = useState('')
  const [autoBenchmark, setAutoBenchmark] = useState(dashboard.settings.katagoAutoBenchmarkEnabled)
  const copy = COPY[locale]

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  useEffect(() => {
    setAutoBenchmark(dashboard.settings.katagoAutoBenchmarkEnabled)
  }, [dashboard.settings.katagoAutoBenchmarkEnabled])

  const modelOptions = useMemo(() => Array.from(new Set([model, ...models].map((value) => value.trim()).filter(Boolean))), [model, models])
  const technicalDetails = useMemo(() => {
    const failedCapabilities = testResult
      ? Object.values(testResult.capabilities)
          .filter((capability) => !capability.ok)
          .map((capability) => capability.technicalDetail || capability.message)
      : []
    return [technicalError, ...failedCapabilities].filter(Boolean).join('\n')
  }, [technicalError, testResult])

  async function saveDraft(status: DashboardData['settings']['llmSetupStatus']): Promise<DashboardData> {
    const next = await window.goagent.updateSettings({
      reviewLanguage: locale,
      llmBaseUrl: baseUrl.trim(),
      ...(apiKey.trim() ? { llmApiKey: apiKey.trim() } : {}),
      llmModel: model.trim(),
      llmSetupStatus: status
    })
    onDashboardUpdated(next)
    return next
  }

  async function refreshModels(): Promise<void> {
    setRefreshing(true)
    setMessage('')
    setTechnicalError('')
    try {
      const result = await window.goagent.listLlmModels({ llmBaseUrl: baseUrl.trim(), llmApiKey: apiKey.trim() })
      setModels(result.models)
      setMessage(result.models.length ? copy.modelsLoaded : copy.modelListEmpty)
    } catch (error) {
      setMessage(copy.modelListEmpty)
    } finally {
      setRefreshing(false)
    }
  }

  async function revealKey(): Promise<void> {
    if (showKey) {
      setShowKey(false)
      return
    }
    if (!apiKey && dashboard.systemProfile.hasLlmApiKey) {
      const result = await window.goagent.getSavedLlmApiKey()
      if (result.hasKey) setApiKey(result.apiKey)
    }
    setShowKey(true)
  }

  async function verifyAndContinue(): Promise<void> {
    setTesting(true)
    setMessage('')
    setTechnicalError('')
    setTestResult(null)
    try {
      await saveDraft('needs-attention')
      const result = await window.goagent.testLlmSettings({
        llmBaseUrl: baseUrl.trim(),
        llmApiKey: apiKey.trim(),
        llmModel: model.trim()
      })
      setTestResult(result)
      setMessage(result.ok ? copy.verificationReady : copy.verificationNeedsAttention)
      const next = await window.goagent.getDashboard()
      onDashboardUpdated(next)
      if (result.ok) setStep('engine')
    } catch (error) {
      setMessage(copy.verificationNeedsAttention)
      setTechnicalError(String(error).replace(/^Error:\s*/, ''))
    } finally {
      setTesting(false)
    }
  }

  async function continueLater(): Promise<void> {
    const unchangedVerifiedConfiguration =
      dashboard.settings.llmSetupStatus === 'verified' &&
      !apiKey.trim() &&
      baseUrl.trim() === dashboard.settings.llmBaseUrl.trim() &&
      model.trim() === dashboard.settings.llmModel.trim()
    const status = unchangedVerifiedConfiguration ? 'verified' : 'skipped'
    await saveDraft(status)
    setStep('engine')
  }

  async function finish(): Promise<void> {
    const next = await window.goagent.updateSettings({
      onboardingVersion: FIRST_RUN_ONBOARDING_VERSION,
      katagoAutoBenchmarkEnabled: autoBenchmark
    })
    onDashboardUpdated(next)
  }

  const engineReady = Boolean(katagoAssets?.ready || dashboard.systemProfile.katagoReady)
  return (
    <main className="first-run" aria-label={`${copy.eyebrow}: ${copy.title}`}>
      <header className="first-run__topbar">
        <div className="first-run__brand"><img src={logoUrl} alt="" /><strong>GoAgent</strong></div>
        <label className="first-run__language">
          <span>{copy.language}</span>
          <select value={locale} onChange={(event) => setLocale(normalizeUiLocale(event.target.value))}>
            {SUPPORTED_UI_LOCALES.map((item) => <option key={item.value} value={item.value}>{item.nativeName}</option>)}
          </select>
        </label>
      </header>
      <section className="first-run__shell">
        <nav className="first-run__steps" aria-label={`${copy.aiStep} / ${copy.engineStep}`}>
          <span className={step === 'ai' ? 'is-active' : 'is-done'}><i>1</i>{copy.aiStep}</span>
          <b />
          <span className={step === 'engine' ? 'is-active' : ''}><i>2</i>{copy.engineStep}</span>
        </nav>
        {step === 'ai' ? (
          <div className="first-run__content">
            <p className="first-run__eyebrow">{copy.eyebrow}</p>
            <h1>{copy.title}</h1>
            <p className="first-run__lead">{copy.subtitle}</p>
            <div className="first-run__form">
              <label><span>{copy.serviceUrl}</span><input value={baseUrl} placeholder={copy.urlPlaceholder} spellCheck={false} autoCapitalize="off" autoCorrect="off" onChange={(event) => setBaseUrl(event.target.value)} /></label>
              <label><span>{copy.accessKey}</span><div className="first-run__secret"><input type={showKey ? 'text' : 'password'} value={apiKey} placeholder={dashboard.systemProfile.hasLlmApiKey ? copy.savedKey : copy.keyPlaceholder} spellCheck={false} autoCapitalize="off" autoCorrect="off" onChange={(event) => setApiKey(event.target.value)} /><button type="button" onClick={() => void revealKey()}>{showKey ? copy.hide : copy.show}</button></div></label>
              <label><span>{copy.model}</span><div className="first-run__model"><input value={model} list="first-run-models" placeholder={copy.modelPlaceholder} spellCheck={false} autoCapitalize="off" autoCorrect="off" onChange={(event) => setModel(event.target.value)} /><datalist id="first-run-models">{modelOptions.map((item) => <option key={item} value={item} />)}</datalist><button type="button" disabled={refreshing} onClick={() => void refreshModels()}>{refreshing ? copy.refreshing : copy.refresh}</button></div><small>{copy.modelListEmpty}</small></label>
            </div>
            {testResult ? <div className="onboarding-capabilities"><CapabilityRow label={copy.text} check={testResult.capabilities.text} passedLabel={copy.checkPassed} failedLabel={copy.checkFailed} /><CapabilityRow label={copy.vision} check={testResult.capabilities.vision} passedLabel={copy.checkPassed} failedLabel={copy.checkFailed} /><CapabilityRow label={copy.tools} check={testResult.capabilities.tools} passedLabel={copy.checkPassed} failedLabel={copy.checkFailed} /></div> : null}
            {message ? <p className={`first-run__message${testResult?.ok ? ' is-success' : ''}`} role="status">{message}</p> : null}
            {technicalDetails ? <details className="first-run__technical"><summary>{copy.technicalDetails}</summary><pre>{technicalDetails}</pre></details> : null}
            <div className="first-run__actions"><button className="primary-button" type="button" disabled={testing || !baseUrl.trim() || !model.trim() || (!apiKey.trim() && !dashboard.systemProfile.hasLlmApiKey)} onClick={() => void verifyAndContinue()}>{testing ? copy.verifying : copy.verify}</button><button className="ghost-button" type="button" disabled={testing} onClick={() => void continueLater()}>{copy.later}</button><small>{copy.retryHint}</small></div>
          </div>
        ) : (
          <div className="first-run__content first-run__engine">
            <div className={`first-run__engine-mark${engineReady ? ' is-ready' : ''}`} aria-hidden="true">{engineReady ? '✓' : '↓'}</div>
            <p className="first-run__eyebrow">KataGo</p>
            <h1>{engineReady ? copy.engineReady : copy.engineMissing}</h1>
            <p className="first-run__lead">{engineReady ? copy.engineReadyDetail : copy.engineMissingDetail}</p>
            {!engineReady ? (
              <button className="primary-button first-run__prepare" type="button" onClick={installBusy ? onPauseInstall : onInstallModel}>
                {installBusy ? PAUSE_DOWNLOAD[locale] : installProgress?.stage === 'paused' ? RESUME_DOWNLOAD[locale] : copy.prepare}
              </button>
            ) : null}
            {installProgress ? <div className="first-run__progress"><span style={{ width: `${Math.max(4, installProgress.percent ?? 8)}%` }} /></div> : null}
            {installProgress || installMessage ? <p className="first-run__message" role="status">{installProgress?.stage === 'paused' ? copy.downloadPaused : installBusy ? copy.downloadActive : installProgress?.stage === 'done' ? copy.engineReady : installMessage}</p> : null}
            <label className="first-run__toggle"><input type="checkbox" checked={autoBenchmark} onChange={(event) => setAutoBenchmark(event.target.checked)} /><span><strong>{copy.autoBenchmark}</strong><small>{copy.autoBenchmarkDetail}</small></span></label>
            <p className="first-run__note">{copy.benchmarkOptional}<br />{copy.localDefault}</p>
            <div className="first-run__actions"><button className="primary-button" type="button" onClick={() => void finish()}>{engineReady ? copy.enter : copy.enterLimited}</button><button className="ghost-button" type="button" onClick={() => setStep('ai')}>{copy.back}</button></div>
          </div>
        )}
      </section>
    </main>
  )
}
