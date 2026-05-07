# GoAgent v0.3.10

GoAgent v0.3.10 is a Windows packaging hotfix. The standard Windows package now uses the Windows OpenCL runtime bundle from `wimi321/lizzieyzy-next` and keeps the KataGo OpenCL adjacent runtime files next to `katago.exe`; GPU vendor OpenCL drivers still come from the user's NVIDIA/AMD/Intel graphics driver. This release keeps the existing quality baseline: grounded shape recognition engine, local pattern matcher, knowledge source-policy gates, optimized move-range review, quality checks and eval gates, Real Eval / engine silver fixture gate, KataGo engine pool telemetry, Release artifact smoke, student level, student age, teacher persona style settings with evidence boundary, teacher sessions, and selective PR #6 integration. Thanks to layiku and wimi321.

QQ群：1030632742，欢迎一起交流、提建议、完善 GoAgent。

## 中文

### 下载前先选版本

| 平台 / 场景 | 推荐下载 |
| --- | --- |
| macOS Apple Silicon | `GoAgent-0.3.10-mac-arm64.dmg` |
| macOS Intel | `GoAgent-0.3.10-mac-x64.dmg` |
| Windows 普通版，OpenCL 推荐包 | `GoAgent-0.3.10-win-x64.exe` 或 `GoAgent-0.3.10-win-x64-portable.zip` |
| Windows NVIDIA 专版，适合 NVIDIA 显卡和 CUDA 环境 | `GoAgent-0.3.10-win-x64-nvidia.exe` 或 `GoAgent-0.3.10-win-x64-nvidia-portable.zip` |
| 校验文件 | `SHA256SUMS.txt` |

### 本版重点

- 修复普通 Windows 包只带裸 `katago.exe` 的问题；现在会像 lizzieyzy-next 的 OpenCL 推荐包一样，把官方 KataGo OpenCL runtime 目录整包带上。
- 普通 Windows 包会保留 `katago.exe` 旁边的 `*.dll` 和其他相邻 runtime 文件，降低用户安装后打不开引擎的风险。
- 注意：显卡厂商的 OpenCL 驱动仍来自用户电脑的 NVIDIA / AMD / Intel 驱动，GoAgent 不替代显卡驱动。
- Windows NVIDIA 专版继续保留官方 CUDA runtime 整合包。

## 繁體中文

### 下載前先選版本

| 平台 / 使用情境 | 建議下載 |
| --- | --- |
| macOS Apple Silicon | `GoAgent-0.3.10-mac-arm64.dmg` |
| macOS Intel | `GoAgent-0.3.10-mac-x64.dmg` |
| Windows 一般版，OpenCL 推薦包 | `GoAgent-0.3.10-win-x64.exe` 或 `GoAgent-0.3.10-win-x64-portable.zip` |
| Windows NVIDIA 專版 | `GoAgent-0.3.10-win-x64-nvidia.exe` 或 `GoAgent-0.3.10-win-x64-nvidia-portable.zip` |
| 校驗檔 | `SHA256SUMS.txt` |

### 本版重點

- 修正 Windows 一般版只帶單一 `katago.exe` 的問題；現在會整包帶入官方 KataGo OpenCL runtime 目錄。
- 會保留 `katago.exe` 旁邊的 `*.dll` 與相鄰 runtime 檔案，降低首次啟動失敗風險。
- NVIDIA / AMD / Intel 的 OpenCL 顯示卡驅動仍由使用者系統提供。
- Windows NVIDIA 專版維持 CUDA runtime 整合包。

## English

### Pick the right package before downloading

| Platform / use case | Recommended download |
| --- | --- |
| macOS Apple Silicon | `GoAgent-0.3.10-mac-arm64.dmg` |
| macOS Intel | `GoAgent-0.3.10-mac-x64.dmg` |
| Standard Windows x64, OpenCL recommended | `GoAgent-0.3.10-win-x64.exe` or `GoAgent-0.3.10-win-x64-portable.zip` |
| Windows NVIDIA edition for NVIDIA GPUs and CUDA runtimes | `GoAgent-0.3.10-win-x64-nvidia.exe` or `GoAgent-0.3.10-win-x64-nvidia-portable.zip` |
| Checksums | `SHA256SUMS.txt` |

### Why update

- Fixes the standard Windows package so it bundles the full official KataGo OpenCL runtime directory, following the LizzieYzy Next OpenCL package pattern.
- Keeps `katago.exe` together with adjacent `*.dll` runtime files instead of shipping a bare executable.
- GPU vendor OpenCL drivers still come from the user's installed NVIDIA, AMD, or Intel graphics driver.
- The Windows NVIDIA edition remains the CUDA runtime package for NVIDIA users.

## 日本語

### ダウンロード前に選ぶもの

| 環境 | 推奨ファイル |
| --- | --- |
| macOS Apple Silicon | `GoAgent-0.3.10-mac-arm64.dmg` |
| macOS Intel | `GoAgent-0.3.10-mac-x64.dmg` |
| Windows 標準版、OpenCL 推奨 | `GoAgent-0.3.10-win-x64.exe` または `GoAgent-0.3.10-win-x64-portable.zip` |
| NVIDIA GPU / CUDA 向け Windows NVIDIA 版 | `GoAgent-0.3.10-win-x64-nvidia.exe` または `GoAgent-0.3.10-win-x64-nvidia-portable.zip` |
| チェックサム | `SHA256SUMS.txt` |

### 主な修正

- Windows 標準版が `katago.exe` だけでなく、公式 KataGo OpenCL runtime ディレクトリ全体を同梱するようになりました。
- `katago.exe` と隣接する `*.dll` runtime ファイルを一緒に保持します。
- GPU ベンダーの OpenCL ドライバーは引き続き NVIDIA / AMD / Intel のグラフィックドライバーから提供されます。
- Windows NVIDIA 版は CUDA runtime 同梱版として継続します。

## 한국어

### 다운로드 전 선택 가이드

| 환경 | 권장 다운로드 |
| --- | --- |
| macOS Apple Silicon | `GoAgent-0.3.10-mac-arm64.dmg` |
| macOS Intel | `GoAgent-0.3.10-mac-x64.dmg` |
| Windows 표준 x64, OpenCL 권장 | `GoAgent-0.3.10-win-x64.exe` 또는 `GoAgent-0.3.10-win-x64-portable.zip` |
| NVIDIA GPU / CUDA용 Windows NVIDIA 에디션 | `GoAgent-0.3.10-win-x64-nvidia.exe` 또는 `GoAgent-0.3.10-win-x64-nvidia-portable.zip` |
| 체크섬 | `SHA256SUMS.txt` |

### 핵심 수정

- Windows 표준 패키지가 공식 KataGo OpenCL runtime 디렉터리 전체를 포함하도록 수정했습니다.
- `katago.exe` 옆의 `*.dll` runtime 파일을 함께 보존합니다.
- GPU vendor OpenCL drivers는 사용자의 NVIDIA / AMD / Intel 그래픽 드라이버에서 제공됩니다.
- Windows NVIDIA 에디션은 CUDA runtime 패키지로 유지됩니다.

## ภาษาไทย

### เลือกไฟล์ก่อนดาวน์โหลด

| ระบบ / การใช้งาน | ไฟล์ที่แนะนำ |
| --- | --- |
| macOS Apple Silicon | `GoAgent-0.3.10-mac-arm64.dmg` |
| macOS Intel | `GoAgent-0.3.10-mac-x64.dmg` |
| Windows x64 รุ่นมาตรฐาน แนะนำ OpenCL | `GoAgent-0.3.10-win-x64.exe` หรือ `GoAgent-0.3.10-win-x64-portable.zip` |
| Windows NVIDIA edition สำหรับ NVIDIA GPU และ CUDA | `GoAgent-0.3.10-win-x64-nvidia.exe` หรือ `GoAgent-0.3.10-win-x64-nvidia-portable.zip` |
| Checksums | `SHA256SUMS.txt` |

### สิ่งที่แก้ไข

- แพ็กเกจ Windows มาตรฐานตอนนี้รวม official KataGo OpenCL runtime directory ทั้งชุด
- เก็บ `katago.exe` พร้อมไฟล์ runtime `*.dll` ที่อยู่ข้างกัน
- GPU vendor OpenCL drivers ยังมาจากไดรเวอร์ NVIDIA / AMD / Intel ของเครื่องผู้ใช้
- Windows NVIDIA edition ยังคงเป็นแพ็กเกจ CUDA runtime

## Tiếng Việt

### Chọn đúng gói trước khi tải

| Nền tảng / nhu cầu | Tệp nên tải |
| --- | --- |
| macOS Apple Silicon | `GoAgent-0.3.10-mac-arm64.dmg` |
| macOS Intel | `GoAgent-0.3.10-mac-x64.dmg` |
| Windows x64 tiêu chuẩn, khuyến nghị OpenCL | `GoAgent-0.3.10-win-x64.exe` hoặc `GoAgent-0.3.10-win-x64-portable.zip` |
| Windows NVIDIA edition cho GPU NVIDIA và CUDA | `GoAgent-0.3.10-win-x64-nvidia.exe` hoặc `GoAgent-0.3.10-win-x64-nvidia-portable.zip` |
| Checksums | `SHA256SUMS.txt` |

### Bản sửa lỗi

- Gói Windows tiêu chuẩn nay đi kèm toàn bộ official KataGo OpenCL runtime directory.
- Giữ `katago.exe` cùng các tệp runtime `*.dll` bên cạnh nó.
- GPU vendor OpenCL drivers vẫn đến từ driver đồ họa NVIDIA / AMD / Intel trên máy người dùng.
- Windows NVIDIA edition vẫn là gói CUDA runtime.

## Verification

- `pnpm install --frozen-lockfile`
- `pnpm test`
- `pnpm typecheck`
- `pnpm build`
- `pnpm check:nvidia-release-assets`
- `pnpm check:release-notes-i18n`
- `pnpm check:release-quality`
- GitHub Release workflow packages standard Windows, Windows NVIDIA, and macOS assets.

## Known Notes

- Standard Windows is now the OpenCL-recommended package. If OpenCL behaves badly on a user's PC, use a future CPU fallback package or configure a custom engine.
- Windows NVIDIA edition is still intended for Windows x64 machines with NVIDIA GPUs and compatible CUDA drivers.
- Windows packages may trigger SmartScreen until the project has stronger signing reputation.
