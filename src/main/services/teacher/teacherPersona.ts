import type { CoachUserLevel, StudentAgeRange, TeacherPersonaStyle } from '@main/lib/types'

export interface TeacherPersonaInput {
  level: CoachUserLevel
  ageRange?: StudentAgeRange
  style?: TeacherPersonaStyle
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

function ageInstruction(ageRange: StudentAgeRange | undefined): string {
  if (ageRange === 'child') return '学生年龄偏小。句子要短，避免讽刺和过度批评，多用具体动作和小练习；不要用恐吓式语言。'
  if (ageRange === 'teen') return '学生是青少年。可以直接指出问题，但要保留鼓励和下一步训练目标。'
  if (ageRange === 'adult') return '学生是成年人。讲解可以更直接，重点给出复盘方法、判断顺序和训练安排。'
  if (ageRange === 'senior') return '学生是年长学习者。节奏放慢，少堆术语，多用清晰结构和复盘步骤。'
  return '学生年龄未指定。按普通成人学习者讲解，避免过度假设。'
}

function styleInstruction(style: TeacherPersonaStyle | undefined): string {
  if (style === 'rigorous') return '老师风格：严谨细致。结构清晰，证据完整，坐标、目差、置信度和变化分支要交代清楚。'
  if (style === 'gentle') return '老师风格：温柔和蔼。少用“恶手/崩了”等刺激词，多说“这里可以换个思路”，但不能淡化关键错误。'
  if (style === 'strict') return '老师风格：严格专业。可以直接指出问题和训练要求，但低置信度证据下仍禁止“唯一、必败、必杀、绝对”等强断言。'
  if (style === 'humorous') return '老师风格：风趣幽默。可以轻微比喻，但幽默只能服务理解，不能编故事、编棋理、编坐标、编胜率或牺牲准确性。'
  return '老师风格：平衡自然。像正常人类教练一样先讲判断，再讲原因，最后给一个可执行提醒。'
}

export function buildTeacherPersonaInstruction(input: TeacherPersonaInput): string {
  return [
    '【学生与老师风格设置】',
    levelInstruction(input.level),
    ageInstruction(input.ageRange),
    styleInstruction(input.style),
    '风格和年龄只影响表达方式、讲解节奏、术语密度和训练建议；不能改变 KataGo、TeachingEvidence、棋形识别、PV、坐标、胜率、目差、定式名或死活结论。',
    '如果风格要求和证据约束冲突，永远以证据约束为准。'
  ].join('\n')
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
