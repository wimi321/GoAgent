# GoMentor v0.3.14-dev.1

GoMentor v0.3.14-dev.1 is a development release for Real Teaching Eval and KataGo Engine Pool 2.0. It adds a local real-eval path that can run real KataGo plus a real LLM teacher response, and an opt-in persistent KataGo analysis engine for reusing a long-lived `katago analysis` process. The existing spawn fallback remains the default. This release keeps the existing top-quality baseline: grounded shape recognition engine, local pattern matcher, knowledge source-policy gates, optimized move-range review, quality checks and eval gates, Real Eval / engine silver fixture gate, KataGo engine pool telemetry, Release artifact smoke, student level, student age, teacher persona style settings with evidence boundary, teacher sessions, and selective PR #6 integration. Windows packages continue to include the Windows OpenCL runtime bundle and KataGo OpenCL adjacent runtime files; GPU vendor OpenCL drivers still come from the user's GPU driver. Thanks to layiku and wimi321.

QQ群：1030632742，欢迎一起交流、提建议、完善 GoMentor。

## 中文

### 下载前先选版本

| 平台 / 场景 | 推荐下载 |
| --- | --- |
| macOS Apple Silicon | `GoMentor-0.3.14-dev.1-mac-arm64.dmg` |
| macOS Intel | `GoMentor-0.3.14-dev.1-mac-x64.dmg` |
| Windows 普通版，OpenCL 推荐包 | `GoMentor-0.3.14-dev.1-win-x64.exe` 或 `GoMentor-0.3.14-dev.1-win-x64-portable.zip` |
| Windows NVIDIA 专版，适合 NVIDIA 显卡和 CUDA 环境 | `GoMentor-0.3.14-dev.1-win-x64-nvidia.exe` 或 `GoMentor-0.3.14-dev.1-win-x64-nvidia-portable.zip` |
| 校验文件 | `SHA256SUMS.txt` |

### 本版重点

- 新增真实教学质量评测：配置 `GOMENTOR_REAL_EVAL=1`、真实 KataGo 和真实 LLM 后，可以本地跑当前手讲解质量检查。
- 新增可选 persistent KataGo analysis engine：设置 `GOMENTOR_KATAGO_ENGINE_POOL=1` 后复用长驻 KataGo 进程；默认仍保留 spawn fallback。
- 默认 CI 不强制真实评测，避免没有 KataGo/LLM 凭据的环境失败；严格模式请使用 `pnpm eval:real-teaching:strict`。
- 本版是开发版 release，主要给开发者和高阶测试用户验证真实评测和 engine pool。

## 繁體中文

### 下載前先選版本

| 平台 / 使用情境 | 建議下載 |
| --- | --- |
| macOS Apple Silicon | `GoMentor-0.3.14-dev.1-mac-arm64.dmg` |
| macOS Intel | `GoMentor-0.3.14-dev.1-mac-x64.dmg` |
| Windows 一般版，OpenCL 推薦包 | `GoMentor-0.3.14-dev.1-win-x64.exe` 或 `GoMentor-0.3.14-dev.1-win-x64-portable.zip` |
| Windows NVIDIA 專版 | `GoMentor-0.3.14-dev.1-win-x64-nvidia.exe` 或 `GoMentor-0.3.14-dev.1-win-x64-nvidia-portable.zip` |
| 校驗檔 | `SHA256SUMS.txt` |

### 本版重點

- 新增真實教學品質評測，可在本機以真實 KataGo 與真實 LLM 檢查講解品質。
- 新增 opt-in persistent KataGo analysis engine；啟用 `GOMENTOR_KATAGO_ENGINE_POOL=1` 後重用長駐 KataGo，預設仍使用 spawn fallback。
- 預設 CI 不強制真實評測；嚴格模式使用 `pnpm eval:real-teaching:strict`。
- 這是開發版 release，適合開發者與進階測試使用。

## English

### Pick the right package before downloading

| Platform / use case | Recommended download |
| --- | --- |
| macOS Apple Silicon | `GoMentor-0.3.14-dev.1-mac-arm64.dmg` |
| macOS Intel | `GoMentor-0.3.14-dev.1-mac-x64.dmg` |
| Standard Windows x64, OpenCL recommended | `GoMentor-0.3.14-dev.1-win-x64.exe` or `GoMentor-0.3.14-dev.1-win-x64-portable.zip` |
| Windows NVIDIA edition for NVIDIA GPUs and CUDA runtimes | `GoMentor-0.3.14-dev.1-win-x64-nvidia.exe` or `GoMentor-0.3.14-dev.1-win-x64-nvidia-portable.zip` |
| Checksums | `SHA256SUMS.txt` |

### Why update

- Adds real local teaching evaluation with true KataGo analysis plus a true LLM teacher response when real credentials and assets are configured.
- Adds an opt-in persistent KataGo analysis engine via `GOMENTOR_KATAGO_ENGINE_POOL=1`; the spawn fallback remains the default path.
- Keeps real eval out of default CI, while `pnpm eval:real-teaching:strict` and `pnpm check:deep-teacher-quality` are available for release/deep machines.
- This is a development release for validating the real-eval and engine-pool path before promoting it to the next stable release.

## 日本語

### ダウンロード前に選ぶもの

| 環境 | 推奨ファイル |
| --- | --- |
| macOS Apple Silicon | `GoMentor-0.3.14-dev.1-mac-arm64.dmg` |
| macOS Intel | `GoMentor-0.3.14-dev.1-mac-x64.dmg` |
| Windows 標準版、OpenCL 推奨 | `GoMentor-0.3.14-dev.1-win-x64.exe` または `GoMentor-0.3.14-dev.1-win-x64-portable.zip` |
| NVIDIA GPU / CUDA 向け Windows NVIDIA 版 | `GoMentor-0.3.14-dev.1-win-x64-nvidia.exe` または `GoMentor-0.3.14-dev.1-win-x64-nvidia-portable.zip` |
| チェックサム | `SHA256SUMS.txt` |

### 主な変更

- 実際の KataGo と LLM を使うローカル teaching eval を追加しました。
- `GOMENTOR_KATAGO_ENGINE_POOL=1` で長駐 KataGo analysis engine を有効化できます。既定では spawn fallback を使います。
- 既定 CI では実 eval を強制しません。厳格な確認には `pnpm eval:real-teaching:strict` を使います。
- 本リリースは開発版で、Real Eval と engine pool の検証向けです。

## 한국어

### 다운로드 전 선택 가이드

| 환경 | 권장 다운로드 |
| --- | --- |
| macOS Apple Silicon | `GoMentor-0.3.14-dev.1-mac-arm64.dmg` |
| macOS Intel | `GoMentor-0.3.14-dev.1-mac-x64.dmg` |
| Windows 표준 x64, OpenCL 권장 | `GoMentor-0.3.14-dev.1-win-x64.exe` 또는 `GoMentor-0.3.14-dev.1-win-x64-portable.zip` |
| NVIDIA GPU / CUDA용 Windows NVIDIA 에디션 | `GoMentor-0.3.14-dev.1-win-x64-nvidia.exe` 또는 `GoMentor-0.3.14-dev.1-win-x64-nvidia-portable.zip` |
| 체크섬 | `SHA256SUMS.txt` |

### 핵심 변경

- 실제 KataGo와 실제 LLM을 사용하는 로컬 teaching eval을 추가했습니다.
- `GOMENTOR_KATAGO_ENGINE_POOL=1`로 persistent KataGo analysis engine을 켤 수 있으며, 기본값은 기존 spawn fallback입니다.
- 기본 CI에서는 실제 eval을 강제하지 않습니다. 엄격한 검증은 `pnpm eval:real-teaching:strict`를 사용합니다.
- 이 릴리스는 개발 버전으로, real eval과 engine pool 검증을 위한 것입니다.

## ภาษาไทย

### เลือกไฟล์ก่อนดาวน์โหลด

| ระบบ / การใช้งาน | ไฟล์ที่แนะนำ |
| --- | --- |
| macOS Apple Silicon | `GoMentor-0.3.14-dev.1-mac-arm64.dmg` |
| macOS Intel | `GoMentor-0.3.14-dev.1-mac-x64.dmg` |
| Windows x64 รุ่นมาตรฐาน แนะนำ OpenCL | `GoMentor-0.3.14-dev.1-win-x64.exe` หรือ `GoMentor-0.3.14-dev.1-win-x64-portable.zip` |
| Windows NVIDIA edition สำหรับ NVIDIA GPU และ CUDA | `GoMentor-0.3.14-dev.1-win-x64-nvidia.exe` หรือ `GoMentor-0.3.14-dev.1-win-x64-nvidia-portable.zip` |
| Checksums | `SHA256SUMS.txt` |

### สิ่งที่เปลี่ยน

- เพิ่ม real teaching eval ที่ใช้ KataGo จริงและ LLM จริงเมื่อมีการตั้งค่า credentials และ assets
- เพิ่ม persistent KataGo analysis engine แบบ opt-in ผ่าน `GOMENTOR_KATAGO_ENGINE_POOL=1` โดยยังคง spawn fallback เป็นค่าเริ่มต้น
- CI ปกติไม่บังคับ real eval; ใช้ `pnpm eval:real-teaching:strict` สำหรับเครื่อง release/deep check
- รุ่นนี้เป็น development release สำหรับทดสอบ real eval และ engine pool

## Tiếng Việt

### Chọn đúng gói trước khi tải

| Nền tảng / nhu cầu | Tệp nên tải |
| --- | --- |
| macOS Apple Silicon | `GoMentor-0.3.14-dev.1-mac-arm64.dmg` |
| macOS Intel | `GoMentor-0.3.14-dev.1-mac-x64.dmg` |
| Windows x64 tiêu chuẩn, khuyến nghị OpenCL | `GoMentor-0.3.14-dev.1-win-x64.exe` hoặc `GoMentor-0.3.14-dev.1-win-x64-portable.zip` |
| Windows NVIDIA edition cho GPU NVIDIA và CUDA | `GoMentor-0.3.14-dev.1-win-x64-nvidia.exe` hoặc `GoMentor-0.3.14-dev.1-win-x64-nvidia-portable.zip` |
| Checksums | `SHA256SUMS.txt` |

### Điểm mới

- Thêm real teaching eval dùng KataGo thật và LLM thật khi đã cấu hình credentials và assets.
- Thêm persistent KataGo analysis engine dạng opt-in qua `GOMENTOR_KATAGO_ENGINE_POOL=1`; spawn fallback vẫn là mặc định.
- CI mặc định không bắt buộc real eval; dùng `pnpm eval:real-teaching:strict` cho máy release/deep check.
- Đây là development release để kiểm thử real eval và engine pool.

## Verification

- `pnpm install`: passed.
- `pnpm test`: 111/111 passed.
- `pnpm typecheck`: passed.
- `pnpm build`: passed.
- `pnpm check`: passed.
- `pnpm check:teacher-quality`: passed.
- `pnpm eval:real-teaching`: skipped cleanly without real KataGo/LLM config.
- `GOMENTOR_KATAGO_ENGINE_POOL=1 pnpm test`: 111/111 passed.

## Known Notes

- `pnpm eval:real-teaching:strict` requires `GOMENTOR_REAL_EVAL=1`, real KataGo binary/config/model paths, and a real LLM API key.
- The persistent KataGo engine is opt-in. Use `GOMENTOR_KATAGO_ENGINE_POOL=1` only when you want to test long-lived analysis engine reuse.
- Standard Windows is the OpenCL-recommended package. If OpenCL behaves badly on a user's PC, use the Windows NVIDIA edition for NVIDIA/CUDA machines or configure a custom engine.
- Windows packages may trigger SmartScreen until the project has stronger signing reputation.
