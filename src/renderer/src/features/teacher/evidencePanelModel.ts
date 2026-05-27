import type { KataGoMoveAnalysis, KnowledgeMatch } from '@main/lib/types'
import { evidenceChipsFromAnalysis, type TeacherEvidenceChip } from './evidenceChips'

export type TeacherEvidencePanelSectionKind = 'position' | 'loss' | 'candidate' | 'pv' | 'knowledge' | 'confidence' | 'next-action'

export interface TeacherEvidencePanelSection {
  id: string
  kind: TeacherEvidencePanelSectionKind
  title: string
  chips: TeacherEvidenceChip[]
  summary: string
  priority: number
}

function chipsOf(chips: TeacherEvidenceChip[], ...kinds: TeacherEvidenceChip['kind'][]): TeacherEvidenceChip[] {
  const wanted = new Set(kinds)
  return chips.filter((chip) => wanted.has(chip.kind))
}

export function buildTeacherEvidencePanel(input: {
  analysis: KataGoMoveAnalysis
  knowledgeMatches?: KnowledgeMatch[]
}): TeacherEvidencePanelSection[] {
  const chips = evidenceChipsFromAnalysis(input.analysis, input.knowledgeMatches ?? [])
  const classification = input.analysis.moveClassification
  const pv = input.analysis.pvConfidence
  const sections: TeacherEvidencePanelSection[] = [
    {
      id: 'position',
      kind: 'position',
      title: '当前局面',
      chips: chipsOf(chips, 'move', 'coordinate'),
      summary: `第 ${input.analysis.moveNumber} 手，实战 ${input.analysis.playedMove?.move ?? input.analysis.currentMove?.gtp ?? '未知'}。`,
      priority: 100
    },
    {
      id: 'candidate',
      kind: 'candidate',
      title: 'AI 候选',
      chips: chipsOf(chips, 'candidate'),
      summary: input.analysis.before.topMoves[0]
        ? `AI 首选 ${input.analysis.before.topMoves[0].move}，搜索 ${input.analysis.before.topMoves[0].visits}。`
        : '暂无 AI 候选点。',
      priority: 90
    },
    {
      id: 'loss',
      kind: 'loss',
      title: '损失判断',
      chips: chipsOf(chips, 'loss', 'confidence'),
      summary: classification
        ? `${classification.severity}/${classification.confidence}。${classification.shouldDeepen ? '建议加深后再做最终结论。' : '证据可用于当前讲解。'}`
        : '尚未生成结构化问题手分类。',
      priority: 80
    },
    {
      id: 'pv',
      kind: 'pv',
      title: '变化可信度',
      chips: chipsOf(chips, 'pv'),
      summary: pv ? `${pv.overall}: ${pv.recommendedWording}` : '尚未生成 PV 可信度。',
      priority: 70
    },
    {
      id: 'knowledge',
      kind: 'knowledge',
      title: '知识匹配',
      chips: chipsOf(chips, 'knowledge'),
      summary: input.knowledgeMatches?.length
        ? input.knowledgeMatches.slice(0, 3).map((match) => `${match.title}/${match.confidence}`).join('；')
        : '没有强知识匹配。',
      priority: 60
    },
    {
      id: 'next-action',
      kind: 'next-action',
      title: '下一步',
      chips: [],
      summary: classification?.shouldDeepen || pv?.shouldDeepen
        ? '建议加深分析或只输出保守讲解。'
        : '可以进入老师讲解、区间复盘或训练题推荐。',
      priority: 50
    }
  ]
  return sections.filter((section) => section.chips.length > 0 || section.kind === 'next-action').sort((left, right) => right.priority - left.priority)
}

export function evidencePanelCopyText(sections: TeacherEvidencePanelSection[]): string {
  return sections.map((section) => [
    `## ${section.title}`,
    section.summary,
    section.chips.map((chip) => `- ${chip.label}: ${chip.detail}`).join('\n')
  ].filter(Boolean).join('\n')).join('\n\n')
}
