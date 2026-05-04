#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const types = readFileSync(join(root, 'src/main/lib/types.ts'), 'utf8')
const store = readFileSync(join(root, 'src/main/lib/store.ts'), 'utf8')
const persona = readFileSync(join(root, 'src/main/services/teacher/teacherPersona.ts'), 'utf8')
const agent = readFileSync(join(root, 'src/main/services/teacherAgent.ts'), 'utf8')
const composer = readFileSync(join(root, 'src/renderer/src/features/teacher/TeacherComposerPro.tsx'), 'utf8')

assert.match(types, /TeacherPersonaStyle = 'balanced' \| 'rigorous' \| 'gentle' \| 'strict' \| 'humorous'/)
assert.match(types, /StudentAgeRange = 'unknown' \| 'child' \| 'teen' \| 'adult' \| 'senior'/)
assert.match(types, /defaultCoachLevel: CoachUserLevel/)
assert.match(types, /defaultStudentAgeRange: StudentAgeRange/)
assert.match(types, /teacherStyle: TeacherPersonaStyle/)
assert.match(store, /defaultCoachLevel: 'intermediate'/)
assert.match(store, /defaultStudentAgeRange: 'unknown'/)
assert.match(store, /teacherStyle: 'balanced'/)
assert.match(persona, /buildTeacherPersonaInstruction/)
assert.match(persona, /风格和年龄只影响表达方式/)
assert.match(persona, /永远以证据约束为准/)
assert.match(agent, /buildTeacherPersonaInstruction/)
assert.match(agent, /studentAgeRange/)
assert.match(agent, /teacherStyle/)
assert.match(composer, /学生级别/)
assert.match(composer, /老师风格/)
assert.match(composer, /年龄/)
console.log('teacher style and student age eval passed')
