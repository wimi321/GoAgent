# GoAgent v0.4.17

GoAgent v0.4.17 is a user-download hardening release. It removes the smaller package family from public releases and keeps only full Standard packages plus the Windows NVIDIA edition, so users are guided toward downloads that already include the required KataGo runtime path.

QQ 群：1030632742，欢迎一起交流、提建议、完善 GoAgent。

## v0.4 系列延续能力

This release keeps the broader v0.4 foundation: grounded shape recognition engine, local pattern matcher, knowledge source-policy gates, optimized move-range review, quality checks and eval gates, Real Eval / engine silver fixture gate, KataGo engine pool telemetry, Release artifact smoke, student level, student age, teacher persona style settings with evidence boundary, teacher sessions, selective PR #6 integration, Tool-first Agent runtime, Kokoro selected-provider TTS with offline synthesis, Windows OpenCL runtime bundle, KataGo OpenCL adjacent runtime files, GPU vendor OpenCL drivers, and the community contribution path from layiku and wimi321.

## 中文

### 下载前先选版本

| 平台 / 场景 | 推荐下载 |
| --- | --- |
| macOS Apple Silicon（M 系列） | [GoAgent-0.4.17-mac-arm64.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.17/GoAgent-0.4.17-mac-arm64.dmg) |
| macOS Intel | [GoAgent-0.4.17-mac-x64.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.17/GoAgent-0.4.17-mac-x64.dmg) |
| Windows x64 标准版（OpenCL）免安装版，普通用户推荐 | [GoAgent-0.4.17-win-x64-portable.zip](https://github.com/wimi321/GoAgent/releases/download/v0.4.17/GoAgent-0.4.17-win-x64-portable.zip) |
| Windows x64 NVIDIA 专版（CUDA）免安装包，NVIDIA 显卡用户推荐 | [GoAgent-0.4.17-win-x64-nvidia-portable.7z](https://github.com/wimi321/GoAgent/releases/download/v0.4.17/GoAgent-0.4.17-win-x64-nvidia-portable.7z) |

### 本版重点

- 公开发布页只保留完整 Standard 包和 Windows NVIDIA 专版，避免用户误下缺少内置 KataGo 的包。
- Windows 推荐下载只展示免安装包；标准版是 OpenCL 版，NVIDIA 专版是 CUDA 版。
- Release workflow 不再构建或上传较小但不完整的包线。
- 发布前继续启动 Windows Standard 和 Windows NVIDIA 包做 packaged smoke，确认下载包能进入应用并读取 KataGo 资源。
- NVIDIA 免安装包继续保留重复 KataGo 检查、solid 7z 压缩和体积预算。

## 繁體中文

### 下載前先選版本

| 平台 / 使用情境 | 建議下載 |
| --- | --- |
| macOS Apple Silicon | [GoAgent-0.4.17-mac-arm64.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.17/GoAgent-0.4.17-mac-arm64.dmg) |
| macOS Intel | [GoAgent-0.4.17-mac-x64.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.17/GoAgent-0.4.17-mac-x64.dmg) |
| Windows x64 Standard（OpenCL）免安裝版，一般使用者推薦 | [GoAgent-0.4.17-win-x64-portable.zip](https://github.com/wimi321/GoAgent/releases/download/v0.4.17/GoAgent-0.4.17-win-x64-portable.zip) |
| Windows x64 NVIDIA（CUDA）免安裝包，NVIDIA 顯卡使用者推薦 | [GoAgent-0.4.17-win-x64-nvidia-portable.7z](https://github.com/wimi321/GoAgent/releases/download/v0.4.17/GoAgent-0.4.17-win-x64-nvidia-portable.7z) |

### 本版重點

- 發布頁只保留完整 Standard 包與 Windows NVIDIA 專版，降低使用者選錯下載項的機率。
- Windows 建議下載只顯示免安裝包；Standard 是 OpenCL 版，NVIDIA 專版是 CUDA 版。
- Release workflow 不再產生或上傳較小但不完整的包線。
- Windows Standard 與 Windows NVIDIA 包仍會在上傳前 smoke 啟動並檢查 KataGo 資源。

## English

### Pick the right package before downloading

| Platform / use case | Recommended download |
| --- | --- |
| macOS Apple Silicon | [GoAgent-0.4.17-mac-arm64.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.17/GoAgent-0.4.17-mac-arm64.dmg) |
| macOS Intel | [GoAgent-0.4.17-mac-x64.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.17/GoAgent-0.4.17-mac-x64.dmg) |
| Windows x64 Standard (OpenCL) portable ZIP, recommended for most users | [GoAgent-0.4.17-win-x64-portable.zip](https://github.com/wimi321/GoAgent/releases/download/v0.4.17/GoAgent-0.4.17-win-x64-portable.zip) |
| Windows x64 NVIDIA (CUDA) portable package, recommended for NVIDIA GPUs | [GoAgent-0.4.17-win-x64-nvidia-portable.7z](https://github.com/wimi321/GoAgent/releases/download/v0.4.17/GoAgent-0.4.17-win-x64-nvidia-portable.7z) |

### Highlights

- Public releases now expose only complete Standard packages and the Windows NVIDIA edition.
- Recommended Windows downloads only show portable packages: Standard is the OpenCL edition and NVIDIA is the CUDA edition.
- The release workflow no longer builds or uploads the smaller incomplete package family.
- Windows Standard and Windows NVIDIA packaged-app smoke checks still run before upload.
- NVIDIA portable packages keep duplicate KataGo checks, solid 7z compression, and the release size budget.

## 日本語

### ダウンロード前に選ぶもの

| 環境 | 推奨ファイル |
| --- | --- |
| macOS Apple Silicon | [GoAgent-0.4.17-mac-arm64.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.17/GoAgent-0.4.17-mac-arm64.dmg) |
| macOS Intel | [GoAgent-0.4.17-mac-x64.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.17/GoAgent-0.4.17-mac-x64.dmg) |
| Windows x64 Standard（OpenCL）ポータブル ZIP、通常はこちら | [GoAgent-0.4.17-win-x64-portable.zip](https://github.com/wimi321/GoAgent/releases/download/v0.4.17/GoAgent-0.4.17-win-x64-portable.zip) |
| Windows x64 NVIDIA（CUDA）ポータブル、NVIDIA GPU 向け | [GoAgent-0.4.17-win-x64-nvidia-portable.7z](https://github.com/wimi321/GoAgent/releases/download/v0.4.17/GoAgent-0.4.17-win-x64-nvidia-portable.7z) |

### 主な変更

- 公開リリースでは、完全な Standard パッケージと Windows NVIDIA 版だけを案内します。
- Windows の推奨ダウンロードはポータブル版のみです。Standard は OpenCL 版、NVIDIA は CUDA 版です。
- 小さいが KataGo 実行環境を同梱しないパッケージ系統はビルドおよびアップロードしません。
- Windows Standard / NVIDIA の packaged smoke はアップロード前に継続します。

## 한국어

### 다운로드 전 선택

| 환경 | 권장 다운로드 |
| --- | --- |
| macOS Apple Silicon | [GoAgent-0.4.17-mac-arm64.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.17/GoAgent-0.4.17-mac-arm64.dmg) |
| macOS Intel | [GoAgent-0.4.17-mac-x64.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.17/GoAgent-0.4.17-mac-x64.dmg) |
| Windows x64 Standard (OpenCL) 포터블 ZIP, 일반 사용자 권장 | [GoAgent-0.4.17-win-x64-portable.zip](https://github.com/wimi321/GoAgent/releases/download/v0.4.17/GoAgent-0.4.17-win-x64-portable.zip) |
| Windows x64 NVIDIA (CUDA) 포터블, NVIDIA GPU 권장 | [GoAgent-0.4.17-win-x64-nvidia-portable.7z](https://github.com/wimi321/GoAgent/releases/download/v0.4.17/GoAgent-0.4.17-win-x64-nvidia-portable.7z) |

### 이번 버전

- 공개 릴리스에는 완전한 Standard 패키지와 Windows NVIDIA 에디션만 제공합니다.
- Windows 권장 다운로드는 포터블 패키지만 표시합니다. Standard는 OpenCL 에디션이고 NVIDIA는 CUDA 에디션입니다.
- 더 작지만 KataGo 실행 환경이 포함되지 않는 패키지 계열은 더 이상 빌드하거나 업로드하지 않습니다.
- Windows Standard / NVIDIA smoke 검사는 계속 실행됩니다.

## ภาษาไทย

### เลือกไฟล์ก่อนดาวน์โหลด

| แพลตฟอร์ม | ไฟล์ที่แนะนำ |
| --- | --- |
| macOS Apple Silicon | [GoAgent-0.4.17-mac-arm64.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.17/GoAgent-0.4.17-mac-arm64.dmg) |
| macOS Intel | [GoAgent-0.4.17-mac-x64.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.17/GoAgent-0.4.17-mac-x64.dmg) |
| Windows x64 Standard (OpenCL) portable ZIP, recommended for most users | [GoAgent-0.4.17-win-x64-portable.zip](https://github.com/wimi321/GoAgent/releases/download/v0.4.17/GoAgent-0.4.17-win-x64-portable.zip) |
| Windows x64 NVIDIA (CUDA) portable, recommended for NVIDIA GPUs | [GoAgent-0.4.17-win-x64-nvidia-portable.7z](https://github.com/wimi321/GoAgent/releases/download/v0.4.17/GoAgent-0.4.17-win-x64-nvidia-portable.7z) |

### จุดสำคัญของรุ่นนี้

- หน้า release แสดงเฉพาะแพ็กเกจ Standard แบบครบถ้วนและ Windows NVIDIA edition
- รายการ Windows ที่แนะนำจะแสดงเฉพาะแพ็กเกจ portable: Standard คือ OpenCL edition ส่วน NVIDIA คือ CUDA edition
- workflow จะไม่ build หรือ upload ชุดแพ็กเกจขนาดเล็กที่ไม่มี KataGo runtime ในตัว
- Windows Standard / NVIDIA packaged smoke ยังคงทำงานก่อนอัปโหลด

## Tiếng Việt

### Chọn gói tải xuống

| Nền tảng | Gói khuyến nghị |
| --- | --- |
| macOS Apple Silicon | [GoAgent-0.4.17-mac-arm64.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.17/GoAgent-0.4.17-mac-arm64.dmg) |
| macOS Intel | [GoAgent-0.4.17-mac-x64.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.17/GoAgent-0.4.17-mac-x64.dmg) |
| Windows x64 Standard (OpenCL) portable ZIP, khuyến nghị cho đa số người dùng | [GoAgent-0.4.17-win-x64-portable.zip](https://github.com/wimi321/GoAgent/releases/download/v0.4.17/GoAgent-0.4.17-win-x64-portable.zip) |
| Windows x64 NVIDIA (CUDA) portable, khuyến nghị cho GPU NVIDIA | [GoAgent-0.4.17-win-x64-nvidia-portable.7z](https://github.com/wimi321/GoAgent/releases/download/v0.4.17/GoAgent-0.4.17-win-x64-nvidia-portable.7z) |

### Điểm mới

- Trang release chỉ hiển thị gói Standard đầy đủ và Windows NVIDIA edition.
- Mục tải xuống Windows khuyến nghị chỉ hiển thị gói portable: Standard là OpenCL edition, NVIDIA là CUDA edition.
- Workflow không còn build hoặc upload dòng gói nhỏ không kèm KataGo runtime.
- Windows Standard / NVIDIA packaged smoke vẫn chạy trước khi upload.
