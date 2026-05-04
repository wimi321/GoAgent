import { randomUUID } from 'node:crypto'
import type { KataGoAnalysisGroup } from '@main/lib/types'

export type KataGoTaskPriority = 'live' | 'teacher' | 'quick' | 'background'
export interface KataGoEngineTaskLease { id: string; priority: KataGoTaskPriority; group?: KataGoAnalysisGroup; queryCount: number; startedAt: string; finish: (status: 'done' | 'error' | 'cancelled') => void }
export interface KataGoEnginePoolStats { running: number; completed: number; errored: number; cancelled: number; byPriority: Record<KataGoTaskPriority, number>; recent: Array<{ id: string; priority: KataGoTaskPriority; group?: KataGoAnalysisGroup; queryCount: number; status: 'running' | 'done' | 'error' | 'cancelled'; startedAt: string; endedAt?: string }> }

interface InternalTask { id: string; priority: KataGoTaskPriority; group?: KataGoAnalysisGroup; queryCount: number; status: 'running' | 'done' | 'error' | 'cancelled'; startedAt: string; endedAt?: string }
const tasks = new Map<string, InternalTask>()
const MAX_RECENT_TASKS = 80

function nowIso(): string { return new Date().toISOString() }
export function priorityForGroup(group?: KataGoAnalysisGroup): KataGoTaskPriority {
  if (group === 'live' || group === 'single') return 'live'
  if (group === 'quick') return 'quick'
  if (group === 'batch') return 'background'
  return 'teacher'
}
export function beginKataGoEngineTask(input: { priority?: KataGoTaskPriority; group?: KataGoAnalysisGroup; queryCount: number }): KataGoEngineTaskLease {
  const id = randomUUID()
  const priority = input.priority ?? priorityForGroup(input.group)
  const task: InternalTask = { id, priority, group: input.group, queryCount: input.queryCount, status: 'running', startedAt: nowIso() }
  tasks.set(id, task)
  trimTasks()
  return { id, priority, group: input.group, queryCount: input.queryCount, startedAt: task.startedAt, finish: (status) => finishKataGoEngineTask(id, status) }
}
export function finishKataGoEngineTask(id: string, status: 'done' | 'error' | 'cancelled'): void {
  const task = tasks.get(id)
  if (!task || task.status !== 'running') return
  task.status = status
  task.endedAt = nowIso()
}
export function getKataGoEnginePoolStats(): KataGoEnginePoolStats {
  const values = Array.from(tasks.values())
  const byPriority: KataGoEnginePoolStats['byPriority'] = { live: 0, teacher: 0, quick: 0, background: 0 }
  for (const task of values) byPriority[task.priority] += task.status === 'running' ? 1 : 0
  return { running: values.filter((task) => task.status === 'running').length, completed: values.filter((task) => task.status === 'done').length, errored: values.filter((task) => task.status === 'error').length, cancelled: values.filter((task) => task.status === 'cancelled').length, byPriority, recent: values.sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 20).map((task) => ({ ...task })) }
}
function trimTasks(): void { for (const stale of Array.from(tasks.values()).sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(MAX_RECENT_TASKS)) tasks.delete(stale.id) }
