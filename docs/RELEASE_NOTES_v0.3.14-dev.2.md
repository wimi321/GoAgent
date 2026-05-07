# GoAgent v0.3.14-dev.2

GoAgent v0.3.14-dev.2 is a development hotfix for the Real Teaching Eval path. It tightens the real-eval teacher prompt so strict scoring only allows coordinates already present in the KataGo evidence coordinate set. This release keeps the v0.3.14-dev.1 development baseline: real local KataGo + LLM teaching evaluation, opt-in persistent KataGo analysis engine, spawn fallback, grounded shape recognition engine, local pattern matcher, knowledge source-policy gates, optimized move-range review, quality checks and eval gates, Real Eval / engine silver fixture gate, KataGo engine pool telemetry, Release artifact smoke, student level, student age, teacher persona style settings with evidence boundary, teacher sessions, and selective PR #6 integration. Windows packages continue to include the Windows OpenCL runtime bundle and KataGo OpenCL adjacent runtime files; GPU vendor OpenCL drivers still come from the user's GPU driver. Thanks to layiku and wimi321.

QQ群：1030632742，欢迎一起交流、提建议、完善 GoAgent。

## 中文

### 下载前先选版本

| 平台 / 场景 | 推荐下载 |
| --- | --- |
| macOS Apple Silicon | `GoAgent-0.3.14-dev.2-mac-arm64.dmg` |
| macOS Intel | `GoAgent-0.3.14-dev.2-mac-x64.dmg` |
| Windows 普通版，OpenCL 推荐包 | `GoAgent-0.3.14-dev.2-win-x64.exe` 或 `GoAgent-0.3.14-dev.2-win-x64-portable.zip` |
| Windows NVIDIA 专版，适合 NVIDIA 显卡和 CUDA 环境 | `GoAgent-0.3.14-dev.2-win-x64-nvidia.exe` 或 `GoAgent-0.3.14-dev.2-win-x64-nvidia-portable.zip` |
| 校验文件 | `SHA256SUMS.txt` |

### 本版重点

- 修复真实教学评测 strict 模式中，LLM 可能提到 evidence 之外坐标而导致失败的问题。
- 本机已用真实 KataGo v1.16.4 Metal、b18 推荐模型、CLIProxyAPI 和 `gpt-5.5` 跑通 strict eval。
- `pnpm eval:real-teaching` 未配置时仍会干净跳过；`pnpm eval:real-teaching:strict` 仍要求真实 KataGo 和 LLM 环境。
- persistent KataGo engine 仍通过 `GOAGENT_KATAGO_ENGINE_POOL=1` opt-in，默认保留 spawn fallback。

## 繁體中文

### 下載前先選版本

| 平台 / 使用情境 | 建議下載 |
| --- | --- |
| macOS Apple Silicon | `GoAgent-0.3.14-dev.2-mac-arm64.dmg` |
| macOS Intel | `GoAgent-0.3.14-dev.2-mac-x64.dmg` |
| Windows 一般版，OpenCL 推薦包 | `GoAgent-0.3.14-dev.2-win-x64.exe` 或 `GoAgent-0.3.14-dev.2-win-x64-portable.zip` |
| Windows NVIDIA 專版 | `GoAgent-0.3.14-dev.2-win-x64-nvidia.exe` 或 `GoAgent-0.3.14-dev.2-win-x64-nvidia-portable.zip` |
| 校驗檔 | `SHA256SUMS.txt` |

### 本版重點

- 修正真實教學評測 strict 模式中，LLM 可能提到 evidence 之外座標的問題。
- 已在本機以真實 KataGo、CLIProxyAPI 和 `gpt-5.5` 跑通 strict eval。
- 未配置時 `pnpm eval:real-teaching` 仍會乾淨跳過；strict 模式仍要求完整真實環境。
- persistent KataGo engine 仍為 opt-in，預設保留 spawn fallback。

## English

### Pick the right package before downloading

| Platform / use case | Recommended download |
| --- | --- |
| macOS Apple Silicon | `GoAgent-0.3.14-dev.2-mac-arm64.dmg` |
| macOS Intel | `GoAgent-0.3.14-dev.2-mac-x64.dmg` |
| Standard Windows x64, OpenCL recommended | `GoAgent-0.3.14-dev.2-win-x64.exe` or `GoAgent-0.3.14-dev.2-win-x64-portable.zip` |
| Windows NVIDIA edition for NVIDIA GPUs and CUDA runtimes | `GoAgent-0.3.14-dev.2-win-x64-nvidia.exe` or `GoAgent-0.3.14-dev.2-win-x64-nvidia-portable.zip` |
| Checksums | `SHA256SUMS.txt` |

### Why update

- Fixes strict real teaching eval so the LLM is explicitly limited to coordinates present in `evidence.knownCoordinates`.
- Verified locally with real KataGo v1.16.4 Metal, the bundled b18 recommended model, CLIProxyAPI, and `gpt-5.5`.
- `pnpm eval:real-teaching` still skips cleanly without configuration; strict mode still requires real KataGo and LLM credentials.
- The persistent KataGo engine remains opt-in via `GOAGENT_KATAGO_ENGINE_POOL=1`, with spawn fallback as the default.

## 日本語

### ダウンロード前に選ぶもの

| 環境 | 推奨ファイル |
| --- | --- |
| macOS Apple Silicon | `GoAgent-0.3.14-dev.2-mac-arm64.dmg` |
| macOS Intel | `GoAgent-0.3.14-dev.2-mac-x64.dmg` |
| Windows 標準版、OpenCL 推奨 | `GoAgent-0.3.14-dev.2-win-x64.exe` または `GoAgent-0.3.14-dev.2-win-x64-portable.zip` |
| NVIDIA GPU / CUDA 向け Windows NVIDIA 版 | `GoAgent-0.3.14-dev.2-win-x64-nvidia.exe` または `GoAgent-0.3.14-dev.2-win-x64-nvidia-portable.zip` |
| チェックサム | `SHA256SUMS.txt` |

### 主な変更

- strict real teaching eval で、LLM が evidence 外の座標を述べる問題を修正しました。
- 実際の KataGo、CLIProxyAPI、`gpt-5.5` で strict eval をローカル確認済みです。
- 未設定時の通常 eval は引き続き clean skip します。
- persistent KataGo engine は引き続き opt-in です。

## 한국어

### 다운로드 전 선택 가이드

| 환경 | 권장 다운로드 |
| --- | --- |
| macOS Apple Silicon | `GoAgent-0.3.14-dev.2-mac-arm64.dmg` |
| macOS Intel | `GoAgent-0.3.14-dev.2-mac-x64.dmg` |
| Windows 표준 x64, OpenCL 권장 | `GoAgent-0.3.14-dev.2-win-x64.exe` 또는 `GoAgent-0.3.14-dev.2-win-x64-portable.zip` |
| NVIDIA GPU / CUDA용 Windows NVIDIA 에디션 | `GoAgent-0.3.14-dev.2-win-x64-nvidia.exe` 또는 `GoAgent-0.3.14-dev.2-win-x64-nvidia-portable.zip` |
| 체크섬 | `SHA256SUMS.txt` |

### 핵심 변경

- strict real teaching eval에서 LLM이 evidence 밖의 좌표를 언급하던 문제를 수정했습니다.
- 실제 KataGo, CLIProxyAPI, `gpt-5.5`로 strict eval을 로컬에서 통과했습니다.
- 일반 real eval은 설정이 없으면 계속 clean skip합니다.
- persistent KataGo engine은 계속 opt-in입니다.

## ภาษาไทย

### เลือกไฟล์ก่อนดาวน์โหลด

| ระบบ / การใช้งาน | ไฟล์ที่แนะนำ |
| --- | --- |
| macOS Apple Silicon | `GoAgent-0.3.14-dev.2-mac-arm64.dmg` |
| macOS Intel | `GoAgent-0.3.14-dev.2-mac-x64.dmg` |
| Windows x64 รุ่นมาตรฐาน แนะนำ OpenCL | `GoAgent-0.3.14-dev.2-win-x64.exe` หรือ `GoAgent-0.3.14-dev.2-win-x64-portable.zip` |
| Windows NVIDIA edition สำหรับ NVIDIA GPU และ CUDA | `GoAgent-0.3.14-dev.2-win-x64-nvidia.exe` หรือ `GoAgent-0.3.14-dev.2-win-x64-nvidia-portable.zip` |
| Checksums | `SHA256SUMS.txt` |

### สิ่งที่เปลี่ยน

- แก้ strict real teaching eval เพื่อจำกัดพิกัดที่ LLM กล่าวถึงให้อยู่ใน `evidence.knownCoordinates`
- ผ่าน strict eval ในเครื่องด้วย KataGo จริง, CLIProxyAPI และ `gpt-5.5`
- eval ปกติยัง skip ได้อย่างสะอาดเมื่อไม่มี config
- persistent KataGo engine ยังเป็น opt-in

## Tiếng Việt

### Chọn đúng gói trước khi tải

| Nền tảng / nhu cầu | Tệp nên tải |
| --- | --- |
| macOS Apple Silicon | `GoAgent-0.3.14-dev.2-mac-arm64.dmg` |
| macOS Intel | `GoAgent-0.3.14-dev.2-mac-x64.dmg` |
| Windows x64 tiêu chuẩn, khuyến nghị OpenCL | `GoAgent-0.3.14-dev.2-win-x64.exe` hoặc `GoAgent-0.3.14-dev.2-win-x64-portable.zip` |
| Windows NVIDIA edition cho GPU NVIDIA và CUDA | `GoAgent-0.3.14-dev.2-win-x64-nvidia.exe` hoặc `GoAgent-0.3.14-dev.2-win-x64-nvidia-portable.zip` |
| Checksums | `SHA256SUMS.txt` |

### Điểm mới

- Sửa strict real teaching eval để LLM chỉ dùng tọa độ có trong `evidence.knownCoordinates`.
- Đã chạy strict eval thành công cục bộ với KataGo thật, CLIProxyAPI và `gpt-5.5`.
- Eval thường vẫn skip sạch khi thiếu cấu hình.
- persistent KataGo engine vẫn là opt-in.

## Verification

- `pnpm test`: passed.
- `pnpm eval:real-teaching:strict`: passed with real KataGo v1.16.4 Metal, b18 recommended model, CLIProxyAPI, and `gpt-5.5`.

## Known Notes

- `pnpm eval:real-teaching:strict` requires real KataGo binary/config/model paths and a real LLM API key.
- Development releases are prereleases and do not replace the latest stable release.
