import test from 'node:test'
import assert from 'node:assert/strict'
import { verifyVisionEvidenceMarkdown } from '../src/main/services/teacher/visionEvidenceVerifier.ts'

const attached = { required: true, attached: true }
test('successful captured image cannot be denied by alternate missing-image wording', () => {
  for (const text of [
    '工具没有返回图像，所以我不能把棋盘图当作已核对的依据。',
    '由于这次没取得截图，局部棋形判断只依据棋谱。',
    '目前未能获取棋盘图像。',
    '截图工具未返回图片。',
    '本轮未附图，工具没有返回可查看截图。',
    "The tool didn't return an image."
  ]) {
    assert.equal(verifyVisionEvidenceMarkdown(text, attached)[0]?.type, 'false-no-board-image-claim', text)
  }
})
test('image verification preserves uncertainty about the position and real missing-image reports', () => {
  assert.deepEqual(verifyVisionEvidenceMarkdown('图中没有敌棋，不能凭小飞配置证明守角已经成功。', attached), [])
  assert.deepEqual(verifyVisionEvidenceMarkdown('工具没有返回图像。', { required: false, attached: false }), [])
  assert.equal(verifyVisionEvidenceMarkdown('暂时无法核对。', { required: true, attached: false })[0]?.type, 'required-image-missing')
})
