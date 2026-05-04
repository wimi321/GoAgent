import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')

test('teacher persona settings include level, age, style, and evidence boundary', () => {
  const types = read('src/main/lib/types.ts')
  const store = read('src/main/lib/store.ts')
  const persona = read('src/main/services/teacher/teacherPersona.ts')
  const agent = read('src/main/services/teacherAgent.ts')
  assert.match(types, /defaultCoachLevel: CoachUserLevel/)
  assert.match(types, /defaultStudentAgeRange: StudentAgeRange/)
  assert.match(types, /teacherStyle: TeacherPersonaStyle/)
  assert.match(types, /ageRange\?: StudentAgeRange/)
  assert.match(store, /defaultCoachLevel: 'intermediate'/)
  assert.match(store, /defaultStudentAgeRange: 'unknown'/)
  assert.match(store, /teacherStyle: 'balanced'/)
  assert.match(persona, /风格和年龄只影响表达方式/)
  assert.match(persona, /不能改变 KataGo/)
  assert.match(agent, /buildTeacherPersonaInstruction/)
})

test('teacher sessions are typed, persisted through IPC, and exposed in composer', () => {
  const types = read('src/main/lib/types.ts')
  const service = read('src/main/services/teacherSession.ts')
  const preload = read('src/preload/index.ts')
  const main = read('src/main/index.ts')
  const composer = read('src/renderer/src/features/teacher/TeacherComposerPro.tsx')
  const app = read('src/renderer/src/App.tsx')
  assert.match(types, /interface TeacherSession/)
  assert.match(service, /electron-store/)
  assert.match(service, /archiveTeacherSession/)
  assert.match(preload, /listTeacherSessions/)
  assert.match(main, /teacher-sessions:update-messages/)
  assert.match(composer, /新会话/)
  assert.match(composer, /关闭会话/)
  assert.match(app, /gomentor:teacher-session-action/)
})
