import type { ReactElement, ReactNode } from 'react'
import { useEffect } from 'react'

type DiagnosticsOverall = 'ready' | 'fixable' | 'blocked'

interface DiagnosticsReport {
  overall: DiagnosticsOverall
  summary: string
  generatedAt: string
  checks: Array<{
    id: string
    title: string
    status: 'pass' | 'warn' | 'fail'
    required: boolean
    detail: string
    action?: string
    technicalDetail?: string
  }>
}

interface DiagnosticsApi {
  getDiagnostics?: () => Promise<DiagnosticsReport>
}

function diagnosticsApi(): DiagnosticsApi {
  return (window as unknown as { goagent?: DiagnosticsApi }).goagent ?? {}
}

export function DiagnosticsGate({
  children,
  ready = true,
  onboarding
}: {
  children: ReactNode
  ready?: boolean
  onboarding?: ReactNode
}): ReactElement {
  async function runDiagnostics(): Promise<void> {
    try {
      const api = diagnosticsApi()
      await api.getDiagnostics?.()
    } catch (cause) {
      console.warn('[GoAgent] startup diagnostics failed', cause)
    }
  }

  useEffect(() => {
    void runDiagnostics()
  }, [])

  if (!ready) {
    return (
      <main className="startup-splash" aria-busy="true" aria-label="GoAgent is starting">
        <span className="startup-splash__mark" aria-hidden="true" />
        <strong>GoAgent</strong>
      </main>
    )
  }

  return onboarding ? <>{onboarding}</> : <>{children}</>
}
