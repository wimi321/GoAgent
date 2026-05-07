import type { ReactElement } from 'react'

export type DiagnosticStatus = 'pass' | 'warn' | 'fail'
export type DiagnosticsOverall = 'ready' | 'fixable' | 'blocked'

export interface DiagnosticCheck {
  id: string
  title: string
  status: DiagnosticStatus
  required: boolean
  detail: string
  action?: string
  technicalDetail?: string
}

export interface DiagnosticsReport {
  overall: DiagnosticsOverall
  summary: string
  generatedAt: string
  checks: DiagnosticCheck[]
}

function statusLabel(status: DiagnosticStatus): string {
  return status === 'pass' ? '通过' : status === 'warn' ? '需配置' : '阻塞'
}

export function DiagnosticsPanel({ report, onRetry, onContinue }: {
  report: DiagnosticsReport
  onRetry: () => void
  onContinue?: () => void
}): ReactElement {
  return (
    <main className={`diagnostics-page diagnostics-page--${report.overall}`}>
      <section className="diagnostics-hero">
        <div>
          <p className="eyebrow">GoAgent 启动诊断</p>
          <h1>{report.overall === 'ready' ? '准备好了' : report.overall === 'fixable' ? '基础可用，还需配置' : '需要先修复环境'}</h1>
          <p>{report.summary}</p>
        </div>
        <div className="diagnostics-actions">
          <button className="ghost-button" onClick={onRetry}>重新检查</button>
          {onContinue ? <button className="primary-button" onClick={onContinue}>进入工作台</button> : null}
        </div>
      </section>

      <section className="diagnostics-grid">
        {report.checks.map((check) => (
          <article key={check.id} className={`diagnostic-card diagnostic-card--${check.status}`}>
            <div className="diagnostic-card-head">
              <strong>{check.title}</strong>
              <span>{statusLabel(check.status)}</span>
            </div>
            <p>{check.detail}</p>
            {check.action ? <p className="diagnostic-action">{check.action}</p> : null}
            {check.technicalDetail ? <details><summary>技术详情</summary><pre>{check.technicalDetail}</pre></details> : null}
          </article>
        ))}
      </section>
    </main>
  )
}
