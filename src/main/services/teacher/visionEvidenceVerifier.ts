import type { VisionEvidenceReport } from '@main/lib/types'

const NO_BOARD_IMAGE_PATTERNS = [
  /没有棋盘图/,
  /没有(?:提供|看到|收到).{0,8}(?:棋盘|图片|图像)/,
  /看不到(?:棋盘|图片|图像)/,
  /未提供(?:棋盘|图片|图像)/,
  /无法看到(?:棋盘|图片|图像)/,
  /(?:工具|截图工具).{0,8}(?:没有|未|没能).{0,8}返回.{0,6}(?:图像|图片|棋盘图|截图)/,
  /(?:没有|未能|没(?:有|能)?)(?:取得|获取|收到|拿到)(?:棋盘)?(?:图像|图片|截图)/,
  /(?:本轮|本次|这次).{0,4}(?:未|没有)(?:附图|附上.{0,4}(?:图片|图像|截图|棋盘图))/,
  /no\s+(?:board\s+)?image/i,
  /(?:tool\s+)?(?:did\s+not|didn't|has\s+not|hasn't)\s+return\s+(?:an?\s+)?(?:board\s+)?(?:image|screenshot)/i,
  /cannot\s+see\s+(?:the\s+)?(?:board|image)/i,
  /no\s+visual\s+input/i
]

export interface VisionEvidenceVerificationIssue {
  type: 'false-no-board-image-claim' | 'required-image-missing'
  message: string
  severity: 'error' | 'warning'
}

export function verifyVisionEvidenceMarkdown(markdown: string, report: VisionEvidenceReport | undefined): VisionEvidenceVerificationIssue[] {
  if (!report) return []
  const issues: VisionEvidenceVerificationIssue[] = []
  if (report.required && !report.attached) {
    issues.push({
      type: 'required-image-missing',
      message: '该老师任务要求棋盘图，但 VisionEvidenceReport 显示没有附图。',
      severity: 'error'
    })
  }
  if (report.attached && NO_BOARD_IMAGE_PATTERNS.some((pattern) => pattern.test(markdown))) {
    issues.push({
      type: 'false-no-board-image-claim',
      message: '本轮已附棋盘图，但老师回答声称没有棋盘图或看不到图片。',
      severity: 'error'
    })
  }
  return issues
}

export function buildVisionEvidenceRepairNote(issues: VisionEvidenceVerificationIssue[]): string {
  if (!issues.length) return ''
  return [
    '【棋盘图证据修正】',
    ...issues.map((issue) => `- ${issue.message}`),
    '请删除“没有棋盘图/看不到图片”的说法，并基于本轮 visionEvidence、KataGo 数据和知识库重新表述。'
  ].join('\n')
}
