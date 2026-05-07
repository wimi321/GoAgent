# GoAgent v0.3.8

This hotfix keeps the v0.3.7 top-quality upgrade and fixes first-launch detection for the Windows NVIDIA edition. The NVIDIA package now opens as a ready-to-analyze desktop app instead of showing `KataGo missing` when the bundled model is named `default.bin.gz`.

QQ群：1030632742，欢迎一起交流、提建议、完善 GoAgent。

## 中文

### 下载前先选版本

| 平台 / 场景 | 推荐下载 |
| --- | --- |
| macOS Apple Silicon | `GoAgent-0.3.8-mac-arm64.dmg` |
| macOS Intel | `GoAgent-0.3.8-mac-x64.dmg` |
| Windows 普通版，适合大多数电脑 | `GoAgent-0.3.8-win-x64.exe` 或 `GoAgent-0.3.8-win-x64-portable.zip` |
| Windows NVIDIA 专版，适合 NVIDIA 显卡和 CUDA 环境 | `GoAgent-0.3.8-win-x64-nvidia.exe` 或 `GoAgent-0.3.8-win-x64-nvidia-portable.zip` |
| 校验文件 | `SHA256SUMS.txt` |

### 修复重点

- 修复 Windows NVIDIA 专版首次启动显示 `KataGo missing` 的问题；应用现在会识别随包 `edition.json` 和 `models/default.bin.gz`。
- 打包时同步更新 `manifest.json` 的真实模型路径、模型 checksum 和二进制 checksum，避免 release 包元数据和实际文件不一致。
- 继续保留 grounded shape recognition engine、local pattern matcher、knowledge source-policy gates、optimized move-range review from PR #5、quality checks and eval gates。
- 感谢 layiku 对 PR #3、PR #4、PR #5 的贡献；感谢 wimi321 的 PR #1 / PR #2 为 P0 beta、v5 teaching knowledge、joseki 数据和证据链打下基础。

## 繁體中文

### 下載前先選版本

| 平台 / 使用情境 | 建議下載 |
| --- | --- |
| macOS Apple Silicon | `GoAgent-0.3.8-mac-arm64.dmg` |
| macOS Intel | `GoAgent-0.3.8-mac-x64.dmg` |
| Windows 一般版 | `GoAgent-0.3.8-win-x64.exe` 或 `GoAgent-0.3.8-win-x64-portable.zip` |
| Windows NVIDIA 專版 | `GoAgent-0.3.8-win-x64-nvidia.exe` 或 `GoAgent-0.3.8-win-x64-nvidia-portable.zip` |
| 校驗檔 | `SHA256SUMS.txt` |

### 本版重點

- 修復 Windows NVIDIA 專版首次啟動顯示 `KataGo missing` 的問題，現在會識別隨包模型與 `edition.json`。
- 發布包會同步寫入正確的 `manifest.json` 模型路徑與 checksum。
- 保留 grounded shape recognition engine、local pattern matcher、knowledge source-policy gates、optimized move-range review、quality checks and eval gates。
- 感謝 layiku 與 wimi321 的 PR 貢獻。

## English

### Pick the right package before downloading

| Platform / use case | Recommended download |
| --- | --- |
| macOS Apple Silicon | `GoAgent-0.3.8-mac-arm64.dmg` |
| macOS Intel | `GoAgent-0.3.8-mac-x64.dmg` |
| Standard Windows x64 | `GoAgent-0.3.8-win-x64.exe` or `GoAgent-0.3.8-win-x64-portable.zip` |
| Windows NVIDIA edition for NVIDIA GPUs and CUDA runtimes | `GoAgent-0.3.8-win-x64-nvidia.exe` or `GoAgent-0.3.8-win-x64-nvidia-portable.zip` |
| Checksums | `SHA256SUMS.txt` |

### Why update

- Fixes first-launch runtime detection for the Windows NVIDIA edition. The app now recognizes bundled `edition.json` metadata and `models/default.bin.gz` instead of showing `KataGo missing`.
- Updates package preparation so `manifest.json` records the actual bundled model path plus model and binary checksums.
- Keeps the grounded shape recognition engine, local pattern matcher, knowledge source-policy gates, optimized move-range review from PR #5, and quality checks and eval gates.
- Thanks to layiku for PR #3, PR #4, and PR #5, and thanks to wimi321 for PR #1 and PR #2.

## 日本語

### ダウンロード前に選ぶもの

| 環境 | 推奨ファイル |
| --- | --- |
| macOS Apple Silicon | `GoAgent-0.3.8-mac-arm64.dmg` |
| macOS Intel | `GoAgent-0.3.8-mac-x64.dmg` |
| Windows 標準版 | `GoAgent-0.3.8-win-x64.exe` または `GoAgent-0.3.8-win-x64-portable.zip` |
| NVIDIA GPU / CUDA 向け Windows NVIDIA 版 | `GoAgent-0.3.8-win-x64-nvidia.exe` または `GoAgent-0.3.8-win-x64-nvidia-portable.zip` |
| チェックサム | `SHA256SUMS.txt` |

### 主な修正

- Windows NVIDIA 版の初回起動時に `KataGo missing` と表示される問題を修正しました。
- `edition.json` と同梱モデル `models/default.bin.gz` を自動検出します。
- grounded shape recognition engine、local pattern matcher、knowledge source-policy gates、optimized move-range review、quality checks and eval gates は継続搭載です。
- layiku と wimi321 の PR 貢献に感謝します。

## 한국어

### 다운로드 전 선택 가이드

| 환경 | 권장 다운로드 |
| --- | --- |
| macOS Apple Silicon | `GoAgent-0.3.8-mac-arm64.dmg` |
| macOS Intel | `GoAgent-0.3.8-mac-x64.dmg` |
| Windows 표준 x64 | `GoAgent-0.3.8-win-x64.exe` 또는 `GoAgent-0.3.8-win-x64-portable.zip` |
| NVIDIA GPU / CUDA용 Windows NVIDIA 에디션 | `GoAgent-0.3.8-win-x64-nvidia.exe` 또는 `GoAgent-0.3.8-win-x64-nvidia-portable.zip` |
| 체크섬 | `SHA256SUMS.txt` |

### 핵심 수정

- Windows NVIDIA 에디션 첫 실행에서 `KataGo missing`으로 보이던 문제를 수정했습니다.
- 앱이 `edition.json`과 번들 모델 `models/default.bin.gz`를 자동 인식합니다.
- grounded shape recognition engine, local pattern matcher, knowledge source-policy gates, optimized move-range review, quality checks and eval gates를 유지합니다.
- layiku와 wimi321의 PR 기여에 감사드립니다.

## ภาษาไทย

### เลือกไฟล์ก่อนดาวน์โหลด

| ระบบ / การใช้งาน | ไฟล์ที่แนะนำ |
| --- | --- |
| macOS Apple Silicon | `GoAgent-0.3.8-mac-arm64.dmg` |
| macOS Intel | `GoAgent-0.3.8-mac-x64.dmg` |
| Windows x64 รุ่นมาตรฐาน | `GoAgent-0.3.8-win-x64.exe` หรือ `GoAgent-0.3.8-win-x64-portable.zip` |
| Windows NVIDIA edition สำหรับ NVIDIA GPU และ CUDA | `GoAgent-0.3.8-win-x64-nvidia.exe` หรือ `GoAgent-0.3.8-win-x64-nvidia-portable.zip` |
| Checksums | `SHA256SUMS.txt` |

### สิ่งที่แก้ไข

- แก้ปัญหา Windows NVIDIA edition แสดง `KataGo missing` ตอนเปิดครั้งแรก
- แอปรู้จัก `edition.json` และ bundled model `models/default.bin.gz` ได้แล้ว
- ยังคงมี grounded shape recognition engine, local pattern matcher, knowledge source-policy gates, optimized move-range review, quality checks and eval gates
- ขอบคุณ layiku และ wimi321 สำหรับ PR contributions

## Tiếng Việt

### Chọn đúng gói trước khi tải

| Nền tảng / nhu cầu | Tệp nên tải |
| --- | --- |
| macOS Apple Silicon | `GoAgent-0.3.8-mac-arm64.dmg` |
| macOS Intel | `GoAgent-0.3.8-mac-x64.dmg` |
| Windows x64 tiêu chuẩn | `GoAgent-0.3.8-win-x64.exe` hoặc `GoAgent-0.3.8-win-x64-portable.zip` |
| Windows NVIDIA edition cho GPU NVIDIA và CUDA | `GoAgent-0.3.8-win-x64-nvidia.exe` hoặc `GoAgent-0.3.8-win-x64-nvidia-portable.zip` |
| Checksums | `SHA256SUMS.txt` |

### Bản sửa lỗi

- Sửa lỗi Windows NVIDIA edition hiển thị `KataGo missing` khi mở lần đầu.
- Ứng dụng nay nhận diện `edition.json` và bundled model `models/default.bin.gz`.
- Giữ grounded shape recognition engine, local pattern matcher, knowledge source-policy gates, optimized move-range review, quality checks and eval gates.
- Cảm ơn layiku và wimi321 vì các PR contributions.

## Verification

- `pnpm test`
- `pnpm typecheck`
- `pnpm build`
- `pnpm check:release-quality`
- Actual-user Windows NVIDIA QA: portable first launch, CUDA KataGo analysis, benchmark, desktop launch, installer install/run/uninstall smoke.

## Known Notes

- Windows NVIDIA edition is intended for Windows x64 machines with NVIDIA GPUs and compatible drivers.
- Windows packages may trigger SmartScreen until the project has stronger signing reputation.
- macOS packages may still require the usual trust/open steps if notarization is not available in the build environment.
