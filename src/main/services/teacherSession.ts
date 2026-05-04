import Store from 'electron-store'
import { randomUUID } from 'node:crypto'
import { appHome } from '@main/lib/store'
import type { TeacherChatMessage, TeacherSession } from '@main/lib/types'

interface TeacherSessionStoreShape {
  sessions: TeacherSession[]
  activeSessionId: string
}

const teacherSessionStore = new Store<TeacherSessionStoreShape>({
  name: 'teacher-sessions',
  cwd: appHome,
  defaults: { sessions: [], activeSessionId: '' }
})

function nowIso(): string {
  return new Date().toISOString()
}

function readSessions(): TeacherSession[] {
  return teacherSessionStore.get('sessions', [])
}

function hasVisibleTeacherMessages(session: TeacherSession): boolean {
  return session.messages.some((message) =>
    message.content.trim().length > 0 ||
    Boolean(message.result) ||
    (message.toolLogs?.length ?? 0) > 0
  )
}

function materializeSession(input: Partial<TeacherSession> = {}, timestamp = nowIso()): TeacherSession {
  return {
    id: input.id || randomUUID(),
    title: sessionTitle(input),
    gameId: input.gameId,
    moveNumber: input.moveNumber,
    moveRange: input.moveRange,
    studentId: input.studentId,
    createdAt: input.createdAt || timestamp,
    updatedAt: timestamp,
    messages: input.messages ?? []
  }
}

function sessionTitle(input?: Partial<TeacherSession>): string {
  if (input?.title?.trim()) return input.title.trim()
  if (input?.moveRange) return `区间复盘 ${input.moveRange.start}-${input.moveRange.end}`
  if (typeof input?.moveNumber === 'number') return `第 ${input.moveNumber} 手会话`
  return '新老师会话'
}

function saveSessions(sessions: TeacherSession[], activeSessionId = teacherSessionStore.get('activeSessionId', '')): void {
  const compacted = sessions.filter((session) => session.id === activeSessionId || hasVisibleTeacherMessages(session))
  teacherSessionStore.set('sessions', compacted.slice(0, 80))
  teacherSessionStore.set('activeSessionId', activeSessionId)
}

export function listTeacherSessions(includeArchived = true): TeacherSession[] {
  const sessions = readSessions()
  return sessions
    .filter(hasVisibleTeacherMessages)
    .filter((session) => includeArchived || !session.archivedAt)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function getActiveTeacherSession(): TeacherSession {
  const activeId = teacherSessionStore.get('activeSessionId', '')
  const existing = readSessions().find((session) => session.id === activeId && !session.archivedAt)
  if (existing) return existing
  return createTeacherSession()
}

export function createTeacherSession(input: Partial<TeacherSession> = {}): TeacherSession {
  const timestamp = nowIso()
  const session = materializeSession(input, timestamp)
  const sessions = [session, ...readSessions().filter((item) => item.id !== session.id)]
  saveSessions(sessions, session.id)
  return session
}

export function updateTeacherSessionMessages(sessionId: string, messages: TeacherChatMessage[]): TeacherSession {
  const sessions = readSessions()
  const current = sessions.find((session) => session.id === sessionId) ?? materializeSession({ id: sessionId })
  const next: TeacherSession = { ...current, messages, updatedAt: nowIso(), archivedAt: undefined }
  saveSessions([next, ...sessions.filter((session) => session.id !== sessionId)], next.id)
  return next
}

export function archiveTeacherSession(sessionId: string): TeacherSession | null {
  const sessions = readSessions()
  const current = sessions.find((session) => session.id === sessionId)
  if (!current) return null
  if (!hasVisibleTeacherMessages(current)) {
    const remainingActive = sessions.find((session) => session.id !== sessionId && !session.archivedAt && hasVisibleTeacherMessages(session))?.id ?? ''
    saveSessions(sessions.filter((session) => session.id !== sessionId), remainingActive)
    return null
  }
  const next = { ...current, archivedAt: nowIso(), updatedAt: nowIso() }
  const remainingActive = sessions.find((session) => session.id !== sessionId && !session.archivedAt && hasVisibleTeacherMessages(session))?.id ?? ''
  saveSessions([next, ...sessions.filter((session) => session.id !== sessionId)], remainingActive)
  return next
}
