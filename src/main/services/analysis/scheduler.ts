import { randomUUID } from 'node:crypto'
import type { KataGoAnalysisGroup } from '@main/lib/types'
import { cancelKataGoAnalysis } from '../katago'
import { cancelKataGoBenchmark } from '../katagoBenchmark'

export type ScheduledAnalysisPriority = 'live' | 'teacher' | 'quick' | 'background'

export interface ScheduledAnalysisInput {
  runId?: string
  group?: KataGoAnalysisGroup
  priority?: ScheduledAnalysisPriority
  description: string
  replaceGroup?: boolean
}

export interface ScheduledAnalysisSnapshot {
  id: string
  runId?: string
  group?: KataGoAnalysisGroup
  priority: ScheduledAnalysisPriority
  description: string
  status: 'queued' | 'running' | 'done' | 'error' | 'cancelled'
  queuedAt: string
  startedAt?: string
  endedAt?: string
  queueWaitMs?: number
  runMs?: number
  error?: string
}

export interface AnalysisSchedulerStats {
  running: number
  queued: number
  completed: number
  errored: number
  cancelled: number
  recent: ScheduledAnalysisSnapshot[]
}

interface QueueEntry<T> extends ScheduledAnalysisSnapshot {
  seq: number
  task: () => Promise<T>
  resolve: (value: T) => void
  reject: (reason: Error) => void
}

const queue: Array<QueueEntry<unknown>> = []
const recent = new Map<string, ScheduledAnalysisSnapshot>()
let active = 0
let seq = 0

const MAX_CONCURRENT_ANALYSIS = 1
const MAX_RECENT = 120

const priorityRank: Record<ScheduledAnalysisPriority, number> = {
  live: 0,
  teacher: 1,
  quick: 2,
  background: 3
}

function nowIso(): string {
  return new Date().toISOString()
}

function priorityForGroup(group?: KataGoAnalysisGroup): ScheduledAnalysisPriority {
  if (group === 'live' || group === 'single') return 'live'
  if (group === 'teacher') return 'teacher'
  if (group === 'quick') return 'quick'
  return 'background'
}

function updateRecent(snapshot: ScheduledAnalysisSnapshot): void {
  recent.set(snapshot.id, {
    id: snapshot.id,
    runId: snapshot.runId,
    group: snapshot.group,
    priority: snapshot.priority,
    description: snapshot.description,
    status: snapshot.status,
    queuedAt: snapshot.queuedAt,
    startedAt: snapshot.startedAt,
    endedAt: snapshot.endedAt,
    queueWaitMs: snapshot.queueWaitMs,
    runMs: snapshot.runMs,
    error: snapshot.error
  })
  const ordered = Array.from(recent.values()).sort((a, b) => b.queuedAt.localeCompare(a.queuedAt))
  for (const stale of ordered.slice(MAX_RECENT)) recent.delete(stale.id)
}

function pickNext(): QueueEntry<unknown> | undefined {
  if (queue.length === 0) return undefined
  queue.sort((left, right) => priorityRank[left.priority] - priorityRank[right.priority] || left.seq - right.seq)
  return queue.shift()
}

function cancelQueuedByGroup(group: KataGoAnalysisGroup | undefined, reason: string): number {
  if (!group) return 0
  let cancelled = 0
  for (let index = queue.length - 1; index >= 0; index -= 1) {
    const entry = queue[index]
    if (entry.group !== group) continue
    queue.splice(index, 1)
    entry.status = 'cancelled'
    entry.endedAt = nowIso()
    entry.error = reason
    updateRecent(entry)
    entry.reject(new Error(reason))
    cancelled += 1
  }
  return cancelled
}

function pump(): void {
  while (active < MAX_CONCURRENT_ANALYSIS) {
    const entry = pickNext()
    if (!entry) return
    active += 1
    entry.status = 'running'
    entry.startedAt = nowIso()
    entry.queueWaitMs = Date.now() - Date.parse(entry.queuedAt)
    updateRecent(entry)

    entry.task().then(
      (value) => {
        entry.status = 'done'
        entry.endedAt = nowIso()
        entry.runMs = entry.startedAt ? Date.now() - Date.parse(entry.startedAt) : undefined
        updateRecent(entry)
        entry.resolve(value)
      },
      (error) => {
        const text = String(error)
        entry.status = /cancel|取消|stopped|停止/i.test(text) ? 'cancelled' : 'error'
        entry.endedAt = nowIso()
        entry.runMs = entry.startedAt ? Date.now() - Date.parse(entry.startedAt) : undefined
        entry.error = text.slice(0, 500)
        updateRecent(entry)
        entry.reject(error instanceof Error ? error : new Error(text))
      }
    ).finally(() => {
      active -= 1
      pump()
    })
  }
}

export function runScheduledAnalysis<T>(input: ScheduledAnalysisInput, task: () => Promise<T>): Promise<T> {
  cancelKataGoBenchmark()
  const id = input.runId || randomUUID()
  const priority = input.priority ?? priorityForGroup(input.group)
  if (input.replaceGroup && input.group) {
    cancelQueuedByGroup(input.group, `Analysis group ${input.group} was replaced by a newer task.`)
    cancelKataGoAnalysis({ group: input.group })
  }

  return new Promise<T>((resolve, reject) => {
    const entry: QueueEntry<T> = {
      id,
      runId: input.runId,
      group: input.group,
      priority,
      description: input.description,
      status: 'queued',
      queuedAt: nowIso(),
      seq: ++seq,
      task,
      resolve,
      reject
    }
    queue.push(entry as QueueEntry<unknown>)
    updateRecent(entry)
    pump()
  })
}

export function getAnalysisSchedulerStats(): AnalysisSchedulerStats {
  const values = Array.from(recent.values())
  return {
    running: values.filter((item) => item.status === 'running').length,
    queued: queue.length,
    completed: values.filter((item) => item.status === 'done').length,
    errored: values.filter((item) => item.status === 'error').length,
    cancelled: values.filter((item) => item.status === 'cancelled').length,
    recent: values.sort((left, right) => right.queuedAt.localeCompare(left.queuedAt)).slice(0, 40)
  }
}

export function cancelScheduledAnalysis(filter: { runId?: string; group?: KataGoAnalysisGroup } = {}): { cancelled: number } {
  let cancelled = 0
  for (let index = queue.length - 1; index >= 0; index -= 1) {
    const entry = queue[index]
    const matchesRun = filter.runId ? entry.runId === filter.runId || entry.id === filter.runId : true
    const matchesGroup = filter.group ? entry.group === filter.group : true
    if (!matchesRun || !matchesGroup) continue
    queue.splice(index, 1)
    entry.status = 'cancelled'
    entry.endedAt = nowIso()
    entry.error = 'Scheduled analysis was cancelled before it started.'
    updateRecent(entry)
    entry.reject(new Error(entry.error))
    cancelled += 1
  }
  cancelled += cancelKataGoAnalysis(filter).cancelled
  return { cancelled }
}
