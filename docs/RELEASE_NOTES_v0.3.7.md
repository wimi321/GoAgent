# GoMentor v0.3.7

This release keeps the v0.3.6 teaching-quality upgrade and adds a dedicated Windows NVIDIA edition plus a lizzieyzy-next style multilingual release page.

QQ群：1030632742，欢迎一起交流、提建议、完善 GoMentor。

## 中文

### 下载前先选版本

| 平台 / 场景 | 推荐下载 |
| --- | --- |
| macOS Apple Silicon | `GoMentor-0.3.7-mac-arm64.dmg` |
| macOS Intel | `GoMentor-0.3.7-mac-x64.dmg` |
| Windows 普通版，适合大多数电脑 | `GoMentor-0.3.7-win-x64.exe` 或 `GoMentor-0.3.7-win-x64-portable.zip` |
| Windows NVIDIA 专版，适合 NVIDIA 显卡和 CUDA 运行环境 | `GoMentor-0.3.7-win-x64-nvidia.exe` 或 `GoMentor-0.3.7-win-x64-nvidia-portable.zip` |
| 校验文件 | `SHA256SUMS.txt` |

### 为什么值得升级

- 新增 Windows NVIDIA 专版发布链路，直接从 `wimi321/lizzieyzy-next` 的 NVIDIA KataGo runtime asset 恢复 CUDA 运行目录和模型，不把普通包改名伪装成 NVIDIA 包。
- 继续保留 grounded shape recognition engine、KataGo shape features、local pattern matcher、v6-v11 知识卡和 source-policy gates。
- 保留并加强 optimized move-range review from PR #5：Alt+drag 选区间、Esc/普通点击清除、多语言手数 parser、80 手默认限制、range summary + key move screenshots。
- 质量门禁覆盖 teacher accuracy、claim verifier、knowledge source-policy gates、knowledge coverage、shape recognition、move-range eval 和 release asset contract。
- release 页面改成多语言下载引导，方便不同语言用户直接选对桌面包。

### 感谢

感谢 layiku 提供 PR #3 的全局方向键早期实现；该思路已由 PR #4 完整吸收。感谢 layiku 的 PR #4，全局方向键导航已合并，显著改善复盘操作体验。感谢 layiku 的 PR #5，区间复盘、Alt+drag 选择和多语言手数 parser 很有价值，本次继续在性能、quality gate 和 shape recognition evidence 基础上优化整合。感谢 wimi321 的 PR #1 / PR #2，为 P0 beta、v5 teaching knowledge、joseki 数据和证据链打下基础。

## 繁體中文

### 下載前先選版本

| 平台 / 使用情境 | 建議下載 |
| --- | --- |
| macOS Apple Silicon | `GoMentor-0.3.7-mac-arm64.dmg` |
| macOS Intel | `GoMentor-0.3.7-mac-x64.dmg` |
| Windows 一般版，適合多數電腦 | `GoMentor-0.3.7-win-x64.exe` 或 `GoMentor-0.3.7-win-x64-portable.zip` |
| Windows NVIDIA 專版，適合 NVIDIA 顯示卡與 CUDA 環境 | `GoMentor-0.3.7-win-x64-nvidia.exe` 或 `GoMentor-0.3.7-win-x64-nvidia-portable.zip` |
| 校驗檔 | `SHA256SUMS.txt` |

### 本版重點

- 新增 Windows NVIDIA 專版發布流程，會還原 NVIDIA KataGo runtime 目錄與模型，而不是只重新命名一般 Windows 包。
- 保留 grounded shape recognition engine、local pattern matcher、knowledge source-policy gates 與 v6-v11 知識卡。
- 延續 PR #5 的 optimized move-range review：時間軸 Alt+drag 選區間、多語手數解析、80 手限制、區間摘要與關鍵手截圖。
- 新增 release contract 檢查，確保 NVIDIA 包、品質檢查與多語 release notes 不會漏掉。

## English

### Pick the right package before downloading

| Platform / use case | Recommended download |
| --- | --- |
| macOS Apple Silicon | `GoMentor-0.3.7-mac-arm64.dmg` |
| macOS Intel | `GoMentor-0.3.7-mac-x64.dmg` |
| Standard Windows x64 | `GoMentor-0.3.7-win-x64.exe` or `GoMentor-0.3.7-win-x64-portable.zip` |
| Windows NVIDIA edition for NVIDIA GPUs and CUDA runtimes | `GoMentor-0.3.7-win-x64-nvidia.exe` or `GoMentor-0.3.7-win-x64-nvidia-portable.zip` |
| Checksums | `SHA256SUMS.txt` |

### Why try this release

- Adds a real Windows NVIDIA edition pipeline. It restores the NVIDIA KataGo runtime directory and model from `wimi321/lizzieyzy-next` release assets instead of relabeling the standard Windows build.
- Keeps the grounded shape recognition engine, KataGo shape features, local pattern matcher, v6-v11 teaching knowledge, and knowledge source-policy gates.
- Keeps the optimized move-range review from PR #5: Alt+drag timeline selection, Esc/plain-click clearing, multilingual move-range parser, 80-move default limit, range summary, and key move screenshots.
- Adds quality checks and eval gates for teacher accuracy, claim verification, knowledge sources, coverage, shape recognition, move-range behavior, NVIDIA release assets, and multilingual release notes.
- Release notes now follow a multilingual download-guide style so users can choose the right desktop package quickly.

### Thanks

Thanks to layiku for PR #3's early global arrow-key idea; PR #4 fully absorbed that direction. Thanks to layiku for PR #4, which is merged and improves review navigation. Thanks to layiku for PR #5; move-range review, Alt+drag selection, and multilingual parsing are valuable and remain integrated with performance limits, quality gates, and shape recognition evidence. Thanks to wimi321 for PR #1 and PR #2, which established the P0 beta, v5 teaching knowledge, joseki data, and the evidence chain foundation.

## 日本語

### ダウンロード前に選ぶもの

| 環境 | 推奨ファイル |
| --- | --- |
| macOS Apple Silicon | `GoMentor-0.3.7-mac-arm64.dmg` |
| macOS Intel | `GoMentor-0.3.7-mac-x64.dmg` |
| Windows 標準版 | `GoMentor-0.3.7-win-x64.exe` または `GoMentor-0.3.7-win-x64-portable.zip` |
| NVIDIA GPU / CUDA 向け Windows NVIDIA 版 | `GoMentor-0.3.7-win-x64-nvidia.exe` または `GoMentor-0.3.7-win-x64-nvidia-portable.zip` |
| チェックサム | `SHA256SUMS.txt` |

### 主な変更

- Windows NVIDIA 版のビルド経路を追加し、NVIDIA KataGo runtime ディレクトリとモデルを含めて配布します。
- grounded shape recognition engine、local pattern matcher、knowledge source-policy gates、v6-v11 知識カードを継続搭載。
- PR #5 由来の optimized move-range review を継続改善：Alt+drag 範囲選択、多言語手数 parser、80 手制限、区間まとめ、重要手のスクリーンショット。
- teacher accuracy、claim verifier、shape recognition、move-range、NVIDIA release asset、多言語 release notes の品質チェックを追加。

## 한국어

### 다운로드 전 선택 가이드

| 환경 | 권장 다운로드 |
| --- | --- |
| macOS Apple Silicon | `GoMentor-0.3.7-mac-arm64.dmg` |
| macOS Intel | `GoMentor-0.3.7-mac-x64.dmg` |
| Windows 표준 x64 | `GoMentor-0.3.7-win-x64.exe` 또는 `GoMentor-0.3.7-win-x64-portable.zip` |
| NVIDIA GPU / CUDA용 Windows NVIDIA 에디션 | `GoMentor-0.3.7-win-x64-nvidia.exe` 또는 `GoMentor-0.3.7-win-x64-nvidia-portable.zip` |
| 체크섬 | `SHA256SUMS.txt` |

### 이번 버전의 핵심

- Windows NVIDIA 에디션 릴리스 파이프라인을 추가하여 NVIDIA KataGo runtime 디렉터리와 모델을 함께 패키징합니다.
- grounded shape recognition engine, local pattern matcher, knowledge source-policy gates, v6-v11 지식 카드를 유지합니다.
- PR #5의 optimized move-range review를 강화했습니다: Alt+drag 구간 선택, 다국어 수순 parser, 80수 제한, 구간 요약, 핵심 수 스크린샷.
- teacher accuracy, claim verifier, shape recognition, move-range, NVIDIA release asset, 다국어 release notes 검사를 추가했습니다.

## ภาษาไทย

### เลือกไฟล์ก่อนดาวน์โหลด

| ระบบ / การใช้งาน | ไฟล์ที่แนะนำ |
| --- | --- |
| macOS Apple Silicon | `GoMentor-0.3.7-mac-arm64.dmg` |
| macOS Intel | `GoMentor-0.3.7-mac-x64.dmg` |
| Windows x64 รุ่นมาตรฐาน | `GoMentor-0.3.7-win-x64.exe` หรือ `GoMentor-0.3.7-win-x64-portable.zip` |
| Windows NVIDIA edition สำหรับ NVIDIA GPU และ CUDA | `GoMentor-0.3.7-win-x64-nvidia.exe` หรือ `GoMentor-0.3.7-win-x64-nvidia-portable.zip` |
| Checksums | `SHA256SUMS.txt` |

### จุดเด่น

- เพิ่ม pipeline สำหรับ Windows NVIDIA edition ที่บรรจุ NVIDIA KataGo runtime directory และ model จริง
- ยังคงมี grounded shape recognition engine, local pattern matcher, knowledge source-policy gates และ knowledge cards v6-v11
- ปรับ optimized move-range review จาก PR #5: Alt+drag เลือกช่วง, parser หลายภาษา, จำกัดเริ่มต้น 80 moves, range summary และ key move screenshots
- เพิ่ม quality checks and eval gates สำหรับ teacher, claim verifier, shape recognition, move-range, NVIDIA release assets และ release notes หลายภาษา

## Tiếng Việt

### Chọn đúng gói trước khi tải

| Nền tảng / nhu cầu | Tệp nên tải |
| --- | --- |
| macOS Apple Silicon | `GoMentor-0.3.7-mac-arm64.dmg` |
| macOS Intel | `GoMentor-0.3.7-mac-x64.dmg` |
| Windows x64 tiêu chuẩn | `GoMentor-0.3.7-win-x64.exe` hoặc `GoMentor-0.3.7-win-x64-portable.zip` |
| Windows NVIDIA edition cho GPU NVIDIA và CUDA | `GoMentor-0.3.7-win-x64-nvidia.exe` hoặc `GoMentor-0.3.7-win-x64-nvidia-portable.zip` |
| Checksums | `SHA256SUMS.txt` |

### Điểm mới

- Thêm pipeline cho Windows NVIDIA edition, đóng gói đúng NVIDIA KataGo runtime directory và model.
- Giữ grounded shape recognition engine, local pattern matcher, knowledge source-policy gates và knowledge cards v6-v11.
- Tiếp tục tối ưu optimized move-range review từ PR #5: Alt+drag để chọn đoạn, parser đa ngôn ngữ, giới hạn mặc định 80 nước, range summary và key move screenshots.
- Bổ sung quality checks and eval gates cho teacher, claim verifier, shape recognition, move-range, NVIDIA release assets và release notes đa ngôn ngữ.

## Verification

- `pnpm test`
- `pnpm typecheck`
- `pnpm build`
- `pnpm eval:teacher`
- `pnpm eval:claims`
- `pnpm eval:quality-gate`
- `pnpm check:knowledge-sources`
- `pnpm eval:knowledge-coverage`
- `pnpm eval:shape-recognition`
- `pnpm eval:move-range`
- `pnpm check:teacher-quality`
- `pnpm check:nvidia-release-assets`
- `pnpm check:release-notes-i18n`

## Known Notes

- Windows NVIDIA edition is intended for Windows x64 machines with NVIDIA GPUs and compatible CUDA runtime expectations from the bundled KataGo build.
- macOS packages may still require the usual trust/open steps if notarization is not available in the build environment.
- Windows packages may trigger SmartScreen until the project has stronger signing reputation.
- Windows ARM64 is not included in this release.
