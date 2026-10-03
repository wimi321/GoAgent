import { app } from 'electron'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { GameMove, KnowledgePacket } from '@main/lib/types'
import { extractKataGoShapeFeatures } from './katagoShapeFeatures'
import { findLocalPatternMatches, type ShapePatternCard } from './localPatternMatcher'
import type { BoardSnapshotStone, LocalWindow } from './matchEngine'

export type ShapeRecognitionConfidence = 'strong' | 'medium' | 'weak'

export interface ShapeRecognitionInput {
  text?: string
  moveNumber: number
  totalMoves: number
  boardSize: number
  recentMoves: GameMove[]
  userLevel?: string
  playerColor?: 'B' | 'W'
  boardSnapshot?: BoardSnapshotStone[]
  localWindows?: LocalWindow[]
  playedMove?: string
  candidateMoves?: string[]
  principalVariation?: string[]
  lossScore?: number
  judgement?: string
  contextTags?: string[]
  maxResults?: number
}

export interface RecognizedShape {
  id: string
  title: string
  shapeType: string
  category: string
  confidence: ShapeRecognitionConfidence
  score: number
  evidence: string[]
  counterEvidence: string[]
  safeWording: '可以明确说' | '更像是' | '只作为训练类比' | '不能主讲'
  relatedMoves: string[]
  recognition: string
  wrongThinking: string
  correctThinking: string
  drillPrompt: string
  sourceRefs: string[]
  sourceQuality: string
}

let cachedRoot = ''
let cachedCards: ShapePatternCard[] | null = null

function dataRoot(): string {
  if (app.isPackaged) return join(process.resourcesPath, 'data')
  return join(process.cwd(), 'data')
}

function loadShapePatternCards(root = dataRoot()): ShapePatternCard[] {
  if (cachedCards && cachedRoot === root) return cachedCards
  const path = join(root, 'knowledge', 'shape-pattern-cards-v1.json')
  if (!existsSync(path)) {
    cachedRoot = root
    cachedCards = []
    return cachedCards
  }
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as ShapePatternCard[]
    cachedCards = Array.isArray(parsed) ? parsed : []
  } catch {
    cachedCards = []
  }
  cachedRoot = root
  return cachedCards
}

function phase(input: ShapeRecognitionInput): 'opening' | 'middlegame' | 'endgame' {
  const ratio = input.totalMoves > 0 ? input.moveNumber / input.totalMoves : 0
  if (input.moveNumber <= 40 || ratio <= 0.2) return 'opening'
  if (ratio <= 0.72) return 'middlegame'
  return 'endgame'
}

function safeWording(confidence: ShapeRecognitionConfidence, counterEvidence: string[]): RecognizedShape['safeWording'] {
  if (counterEvidence.length >= 3) return '不能主讲'
  if (confidence === 'strong' && counterEvidence.length === 0) return '可以明确说'
  if (confidence === 'medium') return '更像是'
  return '只作为训练类比'
}

function fromLocalMatch(match: ReturnType<typeof findLocalPatternMatches>[number]): RecognizedShape {
  const observations: Record<string, string> = {
    cut_point: '局部存在需要检查连接与切断的几何关系；是否真的可断，需验证双方应手。',
    empty_triangle: '局部命中空三角的几何模式；形状本身不能证明本手低效或错误。',
    bamboo_joint: '局部命中竹节的几何模式；连接是否稳固仍需检查断点、气数及对方应手。',
    false_eye_risk: '局部具备检查眼位的几何条件；需要核对对角、断点及周边棋块，尚不能确定是假眼。',
    net: '局部具备检查枷的包围模式；尚未验证敌棋逃路，不能确定已经封住。',
    throw_in_snapback: '局部具备检查扑入或倒扑的几何条件；必须验证扑、提、吃回的合法变化。',
    semeai_liberty_race: '敌我棋块邻近且有局部空点，需要分别数气；邻近本身不能确定双方正在对杀。',
    ko_shape: '局部具备检查劫形的模式；必须验证提子、提回条件和劫禁，尚不能确定形成劫。'
  }
  // Pattern scores are retrieval similarity, not tactical proof or calibrated confidence.
  const confidence = match.confidence === 'strong' ? 'medium' : match.confidence
  const counterEvidence = [...match.counterEvidence, '局部模式未验证合法后续，不能单独证明死活、手筋或本手目的。']
  return {
    id: `local-pattern:${match.card.id}:${match.anchor}`,
    title: match.card.title,
    shapeType: match.card.shapeType,
    category: match.card.category,
    confidence,
    score: match.score,
    evidence: match.evidence,
    counterEvidence,
    safeWording: '只作为训练类比',
    relatedMoves: [match.anchor],
    recognition: observations[match.card.shapeType] ?? `局部命中${match.card.title}的相似模式；这不是已验证的战术结论。`,
    wrongThinking: '把局部模式相似度当成已证明的手筋、死活或这手棋的目的。',
    correctThinking: `检查提示：${match.card.teaching.correctThinking} 本局面仍需独立验证，不能把题库答案直接套用。`,
    drillPrompt: match.card.teaching.drillPrompt,
    sourceRefs: match.card.sourceRefs,
    sourceQuality: match.card.sourceQuality
  }
}

function featureConfidence(score: number): ShapeRecognitionConfidence {
  if (score >= 22) return 'strong'
  if (score >= 15) return 'medium'
  return 'weak'
}

function uniqueShapes(shapes: RecognizedShape[]): RecognizedShape[] {
  const best = new Map<string, RecognizedShape>()
  for (const shape of shapes) {
    const key = `${shape.shapeType}:${shape.relatedMoves[0] ?? ''}`
    const current = best.get(key)
    if (!current || shape.score > current.score) best.set(key, shape)
  }
  return Array.from(best.values()).sort((left, right) => right.score - left.score || left.title.localeCompare(right.title))
}

export function recognizeShapes(input: ShapeRecognitionInput): RecognizedShape[] {
  const anchors = [
    input.playedMove,
    ...(input.candidateMoves ?? []).slice(0, 6)
  ]
  const localMatches = findLocalPatternMatches(loadShapePatternCards(), {
    boardSize: input.boardSize,
    boardSnapshot: input.boardSnapshot,
    localWindows: input.localWindows,
    playedMove: input.playedMove,
    candidateMoves: input.candidateMoves,
    anchors,
    playerColor: input.playerColor,
    phase: phase(input)
  }).map(fromLocalMatch)

  const featureShapes = extractKataGoShapeFeatures(input).map((feature) => ({
    id: `katago-feature:${feature.id}`,
    title: feature.recognition.slice(0, 28),
    shapeType: feature.shapeType,
    category: 'katago-shape-feature',
    confidence: feature.confidence ?? featureConfidence(feature.score),
    score: feature.score,
    evidence: feature.evidence,
    counterEvidence: feature.counterEvidence,
    safeWording: safeWording(feature.confidence ?? featureConfidence(feature.score), feature.counterEvidence),
    relatedMoves: feature.relatedMoves,
    recognition: feature.recognition,
    wrongThinking: feature.wrongThinking,
    correctThinking: feature.correctThinking,
    drillPrompt: feature.drillPrompt,
    sourceRefs: ['katago-analysis-engine-docs', 'goagent-curated-original'],
    sourceQuality: 'engine-derived-local-feature'
  } satisfies RecognizedShape))

  return uniqueShapes([...localMatches, ...featureShapes]).slice(0, input.maxResults ?? 6)
}

export function recognizedShapesToKnowledgePackets(shapes: RecognizedShape[]): KnowledgePacket[] {
  return shapes
    .filter((shape) => shape.safeWording !== '不能主讲')
    .slice(0, 6)
    .map((shape) => ({
      id: shape.id,
      title: shape.title,
      category: `shape:${shape.shapeType}`,
      phase: 'any',
      tags: [shape.shapeType, shape.confidence, shape.safeWording, ...shape.sourceRefs.slice(0, 2)],
      summary: shape.recognition,
      selectedBody: [
        `棋形识别: ${shape.recognition}`,
        `安全措辞: ${shape.safeWording}`,
        '模式分数是检索排序，不是围棋语义准确率；未验证的战术模式只能作检查提示。',
        `识别依据: ${shape.evidence.join('；') || '无'}`,
        shape.counterEvidence.length ? `反证/降置信: ${shape.counterEvidence.join('；')}` : '',
        `常见误区: ${shape.wrongThinking}`,
        `正确思路: ${shape.correctThinking}`,
        `小练习: ${shape.drillPrompt}`,
        `sourceRefs: ${shape.sourceRefs.join(', ')}`
      ].filter(Boolean).join('\n'),
      score: shape.score + (shape.confidence === 'strong' ? 10 : shape.confidence === 'medium' ? 5 : 0)
    }))
}

export function formatShapeRecognitionForPrompt(shapes: RecognizedShape[]): string {
  if (!shapes.length) return '未识别到高置信局部棋形。请只基于 KataGo 和已验证知识讲解。'
  return shapes
    .slice(0, 6)
    .map((shape, index) => [
      `${index + 1}. ${shape.title} (${shape.shapeType}, ${shape.confidence}, score=${shape.score})`,
      `安全措辞：${shape.safeWording}`,
      `证据：${shape.evidence.join('；') || '无'}`,
      shape.counterEvidence.length ? `反证：${shape.counterEvidence.join('；')}` : '',
      `讲法：${shape.recognition}`,
      `误区：${shape.wrongThinking}`,
      `正确思路：${shape.correctThinking}`
    ].filter(Boolean).join('\n'))
    .join('\n\n')
}
