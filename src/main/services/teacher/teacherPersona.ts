import type {
  CoachUserLevel,
  StudentAgeRange,
  StudentRank,
  TeacherExplanationPace,
  TeacherPersonaStyle,
  TeacherTerminologyDensity,
  TeacherVariationDetail
} from '@main/lib/types'

export interface TeacherPersonaInput {
  level: CoachUserLevel
  rank?: StudentRank
  exactAge?: number
  ageRange?: StudentAgeRange
  style?: TeacherPersonaStyle
  terminologyDensity?: TeacherTerminologyDensity
  explanationPace?: TeacherExplanationPace
  variationDetail?: TeacherVariationDetail
}

export const TEACHER_STYLE_LABELS: Record<TeacherPersonaStyle, string> = {
  balanced: '平衡自然',
  rigorous: '严谨细致',
  gentle: '温柔和蔼',
  strict: '严格专业',
  humorous: '风趣幽默'
}

export const STUDENT_AGE_LABELS: Record<StudentAgeRange, string> = {
  unknown: '未指定年龄',
  child: '儿童',
  teen: '青少年',
  adult: '成年人',
  senior: '年长学习者'
}

function levelInstruction(level: CoachUserLevel): string {
  if (level === 'beginner') return '学生是入门水平。少用术语，优先讲“这手下一次怎么想”、气、断点、连接、先后手和一两个可执行提醒。PV 不要展开太长。'
  if (level === 'intermediate') return '学生是级位/中级水平。可以讲 1-2 个关键变化，重点解释棋形目的、目差代价和常见误区。'
  if (level === 'advanced') return '学生是高级水平。可以比较候选点、方向、转换、ownership 和 PV，但仍要先讲判断顺序。'
  return '学生是段位水平。可以讲更细的目差、候选分歧、PV 支撑、ownership 摆动和局面策略，但必须保持证据可追溯。'
}

function rankInstruction(rank: StudentRank | undefined): string {
  if (rank === '10k') return '学生段位：10级。优先讲可执行的下一手判断，避免堆变化。'
  if (rank === '1k') return '学生段位：1级。可以讲关键变化和形势取舍，但仍要给清晰判断顺序。'
  if (rank === '1d') return '学生段位：初段。可以比较候选点、方向和厚薄转换。'
  if (rank === '3d') return '学生段位：3段。可以讲更细的目差、PV 分歧和中盘攻防节奏。'
  if (rank === '5d') return '学生段位：5段。可以讲高阶次序、交换价值、全局转换和局部读秒级判断。'
  return ''
}

function ageInstruction(ageRange: StudentAgeRange | undefined): string {
  if (ageRange === 'child') return '学生年龄偏小。句子要短，避免讽刺和过度批评，多用具体动作和小练习；不要用恐吓式语言。'
  if (ageRange === 'teen') return '学生是青少年。可以直接指出问题，但要保留鼓励和下一步训练目标。'
  if (ageRange === 'adult') return '学生是成年人。讲解可以更直接，重点给出复盘方法、判断顺序和训练安排。'
  if (ageRange === 'senior') return '学生是年长学习者。节奏放慢，少堆术语，多用清晰结构和复盘步骤。'
  return '学生年龄未指定。按普通成人学习者讲解，避免过度假设。'
}

function exactAgeInstruction(exactAge: number | undefined): string {
  if (!exactAge || exactAge < 1) return ''
  return `学生年龄：${exactAge} 岁。年龄只用于调整表达节奏和训练建议，不能改变事实判断。`
}

function styleInstruction(style: TeacherPersonaStyle | undefined): string {
  if (style === 'rigorous') return '老师风格：严谨细致。结构清晰，证据完整，坐标、目差、置信度和变化分支要交代清楚。'
  if (style === 'gentle') return '老师风格：温柔和蔼。少用“恶手/崩了”等刺激词，多说“这里可以换个思路”，但不能淡化关键错误。'
  if (style === 'strict') return '老师风格：严格专业。可以直接指出问题和训练要求，但低置信度证据下仍禁止“唯一、必败、必杀、绝对”等强断言。'
  if (style === 'humorous') return '老师风格：风趣幽默。可以轻微比喻，但幽默只能服务理解，不能编故事、编棋理、编坐标、编胜率或牺牲准确性。'
  return '老师风格：平衡自然。像正常人类教练一样先讲判断，再讲原因，最后给一个可执行提醒。'
}

function densityInstruction(density: TeacherTerminologyDensity | undefined): string {
  if (density === 'low') return '术语密度：少。每次最多引入少量术语，先用自然语言解释。'
  if (density === 'high') return '术语密度：多。可以使用专业术语，但每个关键术语仍需和证据绑定。'
  return '术语密度：中。术语和自然语言保持平衡。'
}

function paceInstruction(pace: TeacherExplanationPace | undefined): string {
  if (pace === 'brief') return '讲解节奏：简洁。优先给结论和一条行动建议。'
  if (pace === 'detailed') return '讲解节奏：细讲。可以补充判断过程、应手和后续训练建议。'
  return '讲解节奏：标准。先讲走势，再讲关键证据，最后给下一步。'
}

function variationInstruction(detail: TeacherVariationDetail | undefined): string {
  if (detail === 'few') return '参考变化：少讲。只讲最关键的 1 个变化或直接建议。'
  if (detail === 'many') return '参考变化：详细。证据充足时可讲 2-3 个重要分支。'
  return '参考变化：适中。只展开最能说明问题的变化。'
}

export function buildTeacherPersonaInstruction(input: TeacherPersonaInput): string {
  return [
    '【学生与老师风格设置】',
    levelInstruction(input.level),
    rankInstruction(input.rank),
    exactAgeInstruction(input.exactAge),
    ageInstruction(input.ageRange),
    styleInstruction(input.style),
    densityInstruction(input.terminologyDensity),
    paceInstruction(input.explanationPace),
    variationInstruction(input.variationDetail),
    '风格和年龄只影响表达方式、讲解节奏、术语密度和训练建议；不能改变 KataGo、TeachingEvidence、棋形识别、PV、坐标、胜率、目差、定式名或死活结论。',
    '如果风格要求和证据约束冲突，永远以证据约束为准。'
  ].filter(Boolean).join('\n')
}

export function normalizeCoachLevel(value: unknown): CoachUserLevel {
  return value === 'beginner' || value === 'advanced' || value === 'dan' ? value : 'intermediate'
}

export function normalizeStudentAgeRange(value: unknown): StudentAgeRange {
  return value === 'child' || value === 'teen' || value === 'adult' || value === 'senior' ? value : 'unknown'
}

export function normalizeTeacherStyle(value: unknown): TeacherPersonaStyle {
  return value === 'rigorous' || value === 'gentle' || value === 'strict' || value === 'humorous' ? value : 'balanced'
}

export function normalizeStudentRank(value: unknown): StudentRank {
  return value === '10k' || value === '1k' || value === '1d' || value === '3d' || value === '5d' ? value : '1k'
}

export function normalizeExactStudentAge(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  return Math.max(0, Math.min(120, Math.round(value)))
}

export function normalizeTerminologyDensity(value: unknown): TeacherTerminologyDensity {
  return value === 'low' || value === 'high' ? value : 'medium'
}

export function normalizeExplanationPace(value: unknown): TeacherExplanationPace {
  return value === 'brief' || value === 'detailed' ? value : 'standard'
}

export function normalizeVariationDetail(value: unknown): TeacherVariationDetail {
  return value === 'few' || value === 'many' ? value : 'moderate'
}
