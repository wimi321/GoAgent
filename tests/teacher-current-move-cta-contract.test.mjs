import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (path) => readFile(path, 'utf8')

test('AI explain-current-move control stays beside the composer and only runs on click', async () => {
  const [app, composer, styles, i18n] = await Promise.all([
    read('src/renderer/src/App.tsx'),
    read('src/renderer/src/features/teacher/TeacherComposerPro.tsx'),
    read('src/renderer/src/features/teacher/teacher-pro.css'),
    read('src/renderer/src/i18n.ts')
  ])

  assert.match(app, /onExplainCurrentMove=\{onAnalyze\}/)
  assert.match(composer, /onExplainCurrentMove\?: \(\) => void/)
  assert.match(composer, /type="button"\s+className="ks-composer-pro__explain-current"\s+onClick=\{onExplainCurrentMove\}/s)
  assert.match(composer, /\{translate\('explainCurrentMove'\)\}/)
  assert.match(styles, /grid-template-columns:\s*minmax\(0,\s*1fr\) auto 82px/)
  assert.match(styles, /\.ks-composer-pro__box \.ks-composer-pro__explain-current/)
  assert.match(i18n, /explainCurrentMove: 'AI讲这步'/)
})
