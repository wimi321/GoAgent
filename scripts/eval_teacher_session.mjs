#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const types = readFileSync(join(root, 'src/main/lib/types.ts'), 'utf8')
const service = readFileSync(join(root, 'src/main/services/teacherSession.ts'), 'utf8')
const preload = readFileSync(join(root, 'src/preload/index.ts'), 'utf8')
const main = readFileSync(join(root, 'src/main/index.ts'), 'utf8')
const composer = readFileSync(join(root, 'src/renderer/src/features/teacher/TeacherComposerPro.tsx'), 'utf8')
const app = readFileSync(join(root, 'src/renderer/src/App.tsx'), 'utf8')

assert.match(types, /export interface TeacherSession/)
assert.match(types, /export interface TeacherChatMessage/)
assert.match(service, /createTeacherSession/)
assert.match(service, /archiveTeacherSession/)
assert.match(service, /updateTeacherSessionMessages/)
assert.match(preload, /listTeacherSessions/)
assert.match(preload, /createTeacherSession/)
assert.match(main, /teacher-sessions:list/)
assert.match(main, /teacher-sessions:create/)
assert.match(composer, /新会话/)
assert.match(composer, /关闭会话/)
assert.match(composer, /历史/)
assert.match(app, /goagent:teacher-session-action/)
assert.match(app, /persistCurrentTeacherSession/)
console.log('teacher session eval passed')
