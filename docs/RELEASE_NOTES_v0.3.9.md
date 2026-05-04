# GoMentor v0.3.9

GoMentor v0.3.9 adds the next quality layer for serious teaching use: Real Eval / engine silver fixture gate, KataGo engine pool telemetry, Release artifact smoke, student level and student age controls, teacher persona style settings with evidence boundary, teacher sessions, and selective PR #6 integration. It also keeps the v0.3.6-v0.3.8 baseline: grounded shape recognition engine, local pattern matcher, knowledge source-policy gates, optimized move-range review, quality checks and eval gates, and the Windows NVIDIA edition.

QQ群：1030632742，欢迎一起交流、提建议、完善 GoMentor。

## 中文

### 下载前先选版本

| 平台 / 场景 | 推荐下载 |
| --- | --- |
| macOS Apple Silicon | `GoMentor-0.3.9-mac-arm64.dmg` |
| macOS Intel | `GoMentor-0.3.9-mac-x64.dmg` |
| Windows 普通版，适合大多数电脑 | `GoMentor-0.3.9-win-x64.exe` 或 `GoMentor-0.3.9-win-x64-portable.zip` |
| Windows NVIDIA 专版，适合 NVIDIA 显卡和 CUDA 环境 | `GoMentor-0.3.9-win-x64-nvidia.exe` 或 `GoMentor-0.3.9-win-x64-nvidia-portable.zip` |
| 校验文件 | `SHA256SUMS.txt` |

### 本版重点

- 新增 Real Eval / engine silver fixture gate，用高 visits KataGo 银标准 fixture 给未来真实引擎评测打基础。
- 新增 KataGo engine pool telemetry，记录任务排队、运行、成功、失败和超时数据，为 persistent engine queue 做准备。
- 新增 Release artifact smoke，并接入 release quality gate。
- 新增学生级别、学生年龄和老师风格设置；teacher persona style settings with evidence boundary 明确只改变表达、节奏、术语密度和训练建议，不改变 KataGo / TeachingEvidence / PV / 坐标 / 胜率 / 目差 / 定式名 / 死活结论等 facts。
- 右侧 LLM 老师支持 teacher sessions：新会话、关闭/归档、历史列表和恢复，不再只是清空聊天。
- selective PR #6 integration：感谢 layiku 的 PR #6，本次吸收 move-range progression 和 board text render，并继续保留 optimized move-range review 的 key-move-only 精读、shared parser 边界、grounded shape recognition engine、local pattern matcher、knowledge source-policy gates、quality checks and eval gates。
- 感谢 layiku 的 PR #5、PR #4、PR #3；感谢 wimi321 的 PR #1 / PR #2。

## 繁體中文

### 下載前先選版本

| 平台 / 使用情境 | 建議下載 |
| --- | --- |
| macOS Apple Silicon | `GoMentor-0.3.9-mac-arm64.dmg` |
| macOS Intel | `GoMentor-0.3.9-mac-x64.dmg` |
| Windows 一般版 | `GoMentor-0.3.9-win-x64.exe` 或 `GoMentor-0.3.9-win-x64-portable.zip` |
| Windows NVIDIA 專版 | `GoMentor-0.3.9-win-x64-nvidia.exe` 或 `GoMentor-0.3.9-win-x64-nvidia-portable.zip` |
| 校驗檔 | `SHA256SUMS.txt` |

### 本版重點

- 加入 Real Eval / engine silver fixture gate，使用高 visits KataGo 銀標準 fixture 建立真實評測基準。
- 加入 KataGo engine pool telemetry，為 persistent engine queue 做準備。
- 加入 Release artifact smoke，並納入 release quality gate。
- 新增學生級別、學生年齡與老師風格；teacher persona style settings with evidence boundary 只影響表達與節奏，不改變證據 facts。
- 右側 LLM 老師新增 teacher sessions：新會話、關閉/封存、歷史與恢復。
- selective PR #6 integration：感謝 layiku 的 PR #6，本次吸收 move-range progression 與 board text render，並保留 grounded shape recognition engine、local pattern matcher、knowledge source-policy gates、optimized move-range review、quality checks and eval gates。
- 感謝 layiku 與 wimi321 的 PR 貢獻。

## English

### Pick the right package before downloading

| Platform / use case | Recommended download |
| --- | --- |
| macOS Apple Silicon | `GoMentor-0.3.9-mac-arm64.dmg` |
| macOS Intel | `GoMentor-0.3.9-mac-x64.dmg` |
| Standard Windows x64 | `GoMentor-0.3.9-win-x64.exe` or `GoMentor-0.3.9-win-x64-portable.zip` |
| Windows NVIDIA edition for NVIDIA GPUs and CUDA runtimes | `GoMentor-0.3.9-win-x64-nvidia.exe` or `GoMentor-0.3.9-win-x64-nvidia-portable.zip` |
| Checksums | `SHA256SUMS.txt` |

### Why update

- Adds a Real Eval / engine silver fixture gate so high-visits KataGo silver fixtures can become the stable accuracy oracle for future CI.
- Adds KataGo engine pool telemetry for queue wait, run time, success, error, and timeout measurements.
- Adds Release artifact smoke and wires it into the release quality gate.
- Adds student level, student age, and teacher persona style settings with evidence boundary: style and age change wording, pacing, term density, and training advice only, never KataGo or TeachingEvidence facts.
- Adds teacher sessions for the right-side LLM teacher: new, close/archive, history, and restore.
- selective PR #6 integration: thanks to layiku, GoMentor now keeps move-range progression and board text render while preserving the shared parser boundary and key-move-only optimized move-range review.
- Keeps the grounded shape recognition engine, local pattern matcher, knowledge source-policy gates, optimized move-range review, quality checks and eval gates.
- Thanks to layiku for PR #3, PR #4, PR #5, and PR #6, and thanks to wimi321 for PR #1 and PR #2.

## 日本語

### ダウンロード前に選ぶもの

| 環境 | 推奨ファイル |
| --- | --- |
| macOS Apple Silicon | `GoMentor-0.3.9-mac-arm64.dmg` |
| macOS Intel | `GoMentor-0.3.9-mac-x64.dmg` |
| Windows 標準版 | `GoMentor-0.3.9-win-x64.exe` または `GoMentor-0.3.9-win-x64-portable.zip` |
| NVIDIA GPU / CUDA 向け Windows NVIDIA 版 | `GoMentor-0.3.9-win-x64-nvidia.exe` または `GoMentor-0.3.9-win-x64-nvidia-portable.zip` |
| チェックサム | `SHA256SUMS.txt` |

### 主な変更

- Real Eval / engine silver fixture gate を追加し、高 visits KataGo の銀標準 fixture を将来の評価基盤にしました。
- KataGo engine pool telemetry を追加し、persistent engine queue に向けた計測を始めました。
- Release artifact smoke を追加し、release quality gate に接続しました。
- 学生レベル、学生年齢、教師スタイルを追加しました。teacher persona style settings with evidence boundary により、表現や説明テンポだけを変え、KataGo / TeachingEvidence の facts は変えません。
- 右側 LLM 教師に teacher sessions を追加し、新規、終了/アーカイブ、履歴、復元ができます。
- selective PR #6 integration：layiku の PR #6 から move-range progression と board text render を取り込み、grounded shape recognition engine、local pattern matcher、knowledge source-policy gates、optimized move-range review、quality checks and eval gates と整合させました。
- layiku と wimi321 の PR 貢献に感謝します。

## 한국어

### 다운로드 전 선택 가이드

| 환경 | 권장 다운로드 |
| --- | --- |
| macOS Apple Silicon | `GoMentor-0.3.9-mac-arm64.dmg` |
| macOS Intel | `GoMentor-0.3.9-mac-x64.dmg` |
| Windows 표준 x64 | `GoMentor-0.3.9-win-x64.exe` 또는 `GoMentor-0.3.9-win-x64-portable.zip` |
| NVIDIA GPU / CUDA용 Windows NVIDIA 에디션 | `GoMentor-0.3.9-win-x64-nvidia.exe` 또는 `GoMentor-0.3.9-win-x64-nvidia-portable.zip` |
| 체크섬 | `SHA256SUMS.txt` |

### 핵심 변경

- Real Eval / engine silver fixture gate를 추가해 고 visits KataGo 실버 fixture 기반 평가를 준비했습니다.
- KataGo engine pool telemetry를 추가해 persistent engine queue를 위한 작업 대기/실행/성공/오류/타임아웃 데이터를 기록합니다.
- Release artifact smoke를 추가하고 release quality gate에 연결했습니다.
- 학생 레벨, 학생 나이, 교사 스타일을 추가했습니다. teacher persona style settings with evidence boundary는 표현과 속도만 바꾸며 evidence facts는 바꾸지 않습니다.
- 오른쪽 LLM 교사에 teacher sessions를 추가해 새 세션, 닫기/보관, 히스토리, 복원이 가능합니다.
- selective PR #6 integration: layiku의 PR #6에서 move-range progression과 board text render를 흡수하고 grounded shape recognition engine, local pattern matcher, knowledge source-policy gates, optimized move-range review, quality checks and eval gates와 맞췄습니다.
- layiku와 wimi321의 PR 기여에 감사드립니다.

## ภาษาไทย

### เลือกไฟล์ก่อนดาวน์โหลด

| ระบบ / การใช้งาน | ไฟล์ที่แนะนำ |
| --- | --- |
| macOS Apple Silicon | `GoMentor-0.3.9-mac-arm64.dmg` |
| macOS Intel | `GoMentor-0.3.9-mac-x64.dmg` |
| Windows x64 รุ่นมาตรฐาน | `GoMentor-0.3.9-win-x64.exe` หรือ `GoMentor-0.3.9-win-x64-portable.zip` |
| Windows NVIDIA edition สำหรับ NVIDIA GPU และ CUDA | `GoMentor-0.3.9-win-x64-nvidia.exe` หรือ `GoMentor-0.3.9-win-x64-nvidia-portable.zip` |
| Checksums | `SHA256SUMS.txt` |

### สิ่งใหม่

- เพิ่ม Real Eval / engine silver fixture gate สำหรับ fixture จาก KataGo แบบ high-visits
- เพิ่ม KataGo engine pool telemetry เพื่อเตรียม persistent engine queue
- เพิ่ม Release artifact smoke และเชื่อมกับ release quality gate
- เพิ่ม student level, student age และ teacher persona style settings with evidence boundary โดย style มีผลต่อถ้อยคำและจังหวะเท่านั้น ไม่เปลี่ยน evidence facts
- เพิ่ม teacher sessions สำหรับ LLM teacher: new, close/archive, history และ restore
- selective PR #6 integration: ขอบคุณ layiku สำหรับ move-range progression และ board text render พร้อมคง grounded shape recognition engine, local pattern matcher, knowledge source-policy gates, optimized move-range review, quality checks and eval gates
- ขอบคุณ layiku และ wimi321 สำหรับ PR contributions

## Tiếng Việt

### Chọn đúng gói trước khi tải

| Nền tảng / nhu cầu | Tệp nên tải |
| --- | --- |
| macOS Apple Silicon | `GoMentor-0.3.9-mac-arm64.dmg` |
| macOS Intel | `GoMentor-0.3.9-mac-x64.dmg` |
| Windows x64 tiêu chuẩn | `GoMentor-0.3.9-win-x64.exe` hoặc `GoMentor-0.3.9-win-x64-portable.zip` |
| Windows NVIDIA edition cho GPU NVIDIA và CUDA | `GoMentor-0.3.9-win-x64-nvidia.exe` hoặc `GoMentor-0.3.9-win-x64-nvidia-portable.zip` |
| Checksums | `SHA256SUMS.txt` |

### Điểm mới

- Thêm Real Eval / engine silver fixture gate cho fixture KataGo high-visits.
- Thêm KataGo engine pool telemetry để chuẩn bị persistent engine queue.
- Thêm Release artifact smoke và đưa vào release quality gate.
- Thêm student level, student age, và teacher persona style settings with evidence boundary: chỉ đổi cách diễn đạt và nhịp giảng, không đổi evidence facts.
- Thêm teacher sessions cho LLM teacher: new, close/archive, history, restore.
- selective PR #6 integration: cảm ơn layiku vì move-range progression và board text render; bản này vẫn giữ grounded shape recognition engine, local pattern matcher, knowledge source-policy gates, optimized move-range review, quality checks and eval gates.
- Cảm ơn layiku và wimi321 vì các PR contributions.

## Verification

- `pnpm install`
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
- `pnpm eval:engine-silver`
- `pnpm eval:teacher-style`
- `pnpm eval:teacher-session`
- `pnpm smoke:release-artifacts`
- `pnpm check:teacher-quality`
- `pnpm check:release-quality`

## Known Notes

- Windows NVIDIA edition is intended for Windows x64 machines with NVIDIA GPUs and compatible CUDA drivers.
- Windows packages may trigger SmartScreen until the project has stronger signing reputation.
- macOS packages may still require the usual trust/open steps if notarization is not available in the build environment.
