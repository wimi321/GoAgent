import type { ReactElement } from 'react'
import { useState } from 'react'
import './teacher-pro.css'

interface TeacherRunCardProProps {
  result?: unknown
  markdown?: string
  running?: boolean
  onJumpToMove?: (moveNumber: number) => void
  onAnalyzeMove?: (moveNumber: number) => void
}

type AnyRecord = Record<string, unknown>

function asRecord(value: unknown): AnyRecord {
  return typeof value === 'object' && value !== null ? value as AnyRecord : {}
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function pickToolLogs(result: unknown): AnyRecord[] {
  return arrayValue(asRecord(result).toolLogs).map(asRecord)
}

function pickAssistantText(result: unknown, markdown: string): string {
  if (markdown.trim()) return markdown.trim()
  const record = asRecord(result)
  const structured = asRecord(record.structured ?? record.structuredResult)
  return stringValue(record.markdown) || stringValue(structured.markdown)
}

function toolStatus(log: AnyRecord): string {
  const status = stringValue(log.status)
  if (status === 'running') return '进行中'
  if (status === 'error') return '异常'
  if (status === 'skipped') return '跳过'
  return '完成'
}

function toolTitle(log: AnyRecord, logs: AnyRecord[] = [], index = 0): string {
  const name = stringValue(log.name)
  const sameToolCount = logs.filter((item) => stringValue(item.name) === name).length
  const occurrence = logs.slice(0, index + 1).filter((item) => stringValue(item.name) === name).length
  if (name === 'katago.analyzePosition') {
    if (sameToolCount <= 1) return 'KataGo 读取当前局面'
    if (occurrence === 1) return 'KataGo 读取当前局面'
    if (occurrence === 2) return 'KataGo 复核候选点'
    return `KataGo 补充验证 ${occurrence}`
  }
  const byName: Record<string, string> = {
    'library.findGames': '筛选棋谱',
    'sgf.readGameRecord': '读取棋谱',
    'katago.analyzeGameBatch': 'KataGo 整盘分析',
    'board.captureTeachingImage': '读取棋盘图',
    'knowledge.searchLocal': '检索知识库',
    'studentProfile.read': '读取棋手画像',
    'studentProfile.write': '更新棋手画像',
    'system.detectEnvironment': '检查环境',
    'settings.writeAppConfig': '写入设置',
    'katago.verifyAnalysis': '验证 KataGo',
    'web.searchGoKnowledge': '联网检索',
    'filesystem.read': '读取文件',
    'shell.exec': '执行 Shell',
    'shell.kill': '停止 Shell',
    'report.saveAnalysis': '保存报告'
  }
  return byName[name] ?? stringValue(log.label ?? log.tool) ?? '调用工具'
}

function toolDetail(log: AnyRecord, logs: AnyRecord[], index: number): string {
  const name = stringValue(log.name)
  const occurrence = logs.slice(0, index + 1).filter((item) => stringValue(item.name) === name).length
  const status = stringValue(log.status)
  if (status === 'error') return stringValue(log.detail).replace(/\s+/g, ' ').slice(0, 96)
  if (name === 'katago.analyzePosition') {
    if (occurrence === 1) return '获取候选点、胜率、目差和 PV，作为讲解的主证据。'
    if (occurrence === 2) return '再次核对候选点和胜率差，避免只凭一次引擎结果下结论。'
    return `第 ${occurrence} 次补充验证，用来确认局部细节或回答追问。`
  }
  if (name === 'knowledge.searchLocal') return '匹配棋形、定式、死活、手筋和常见错误类型。'
  if (name === 'board.captureTeachingImage') return '读取当前棋盘图，保证讲解对得上画面。'
  if (name === 'sgf.readGameRecord') return '读取棋谱手顺和当前手上下文。'
  if (name === 'katago.analyzeGameBatch') return '扫描整盘胜率走势和问题手分布。'
  return status === 'running' ? '正在处理，完成后会继续组织老师回复。' : '已完成，结果会进入最终讲解。'
}

function toolSummary(logs: AnyRecord[]): string {
  const runningIndex = logs.findIndex((log) => stringValue(log.status) === 'running')
  if (runningIndex >= 0) {
    return `查看工具调用 · ${logs.length} · 正在${toolTitle(logs[runningIndex], logs, runningIndex)}`
  }
  const katagoChecks = logs.filter((log) => stringValue(log.name) === 'katago.analyzePosition').length
  return katagoChecks > 1 ? `查看工具调用 · ${logs.length} · KataGo 复核 ${katagoChecks} 次` : `查看工具调用 · ${logs.length}`
}

export function TeacherRunCardPro({
  result,
  markdown = '',
  running = false
}: TeacherRunCardProProps): ReactElement {
  const [toolsOpen, setToolsOpen] = useState(false)
  const toolLogs = pickToolLogs(result)
  const error = stringValue(asRecord(result).error)
  const assistantText = pickAssistantText(result, markdown)

  return (
    <article className={`ks-teacher-pro-card ks-agent-response ${running ? 'ks-teacher-pro-card--running' : ''}`}>
      <header className="ks-teacher-pro-card__header">
        <div>
          <span className="ks-teacher-pro-card__eyebrow">GoMentor</span>
          <h3>{running ? '正在思考…' : 'assistant response'}</h3>
        </div>
        <span className="ks-teacher-pro-card__status">{running ? '执行中' : error ? '需处理' : '完成'}</span>
      </header>

      {error ? <div className="ks-teacher-pro-error">{error}</div> : null}

      {running && !assistantText ? (
        <section className="ks-teacher-pro-summary ks-teacher-pro-summary--loading">
          <span>agent is working</span>
          <p>正在读取棋盘、KataGo数据，正在开始分析。</p>
          <small>准备局面快照 · 获取候选点 · 检索证据链 · 组织老师讲解</small>
        </section>
      ) : null}

      {assistantText ? (
        <section className="ks-teacher-pro-markdown">
          {assistantText}
        </section>
      ) : null}

      {toolLogs.length > 0 ? (
        <section className="ks-tool-log-pro">
          <button type="button" onClick={() => setToolsOpen((value) => !value)}>
            {toolsOpen ? '收起工具调用' : toolSummary(toolLogs)}
          </button>
          {toolsOpen ? (
            <div className="ks-tool-log-pro__rows">
              {toolLogs.map((log, index) => {
                const title = toolTitle(log, toolLogs, index)
                return (
                  <div key={index} className={`ks-tool-log-pro__row ks-tool-log-pro__row--${stringValue(log.status) || 'done'}`}>
                    <span aria-hidden="true" />
                    <div>
                      <strong>{title}</strong>
                      <small>{toolDetail(log, toolLogs, index)}</small>
                    </div>
                    <em>{toolStatus(log)}</em>
                  </div>
                )
              })}
            </div>
          ) : null}
        </section>
      ) : null}
    </article>
  )
}
