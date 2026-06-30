# GoAgent v0.4.16

GoAgent v0.4.16 is a Windows NVIDIA portable size hotfix. It removes duplicated KataGo assets from packaged app internals, restores solid 7z compression for the NVIDIA portable package, and adds release gates so the NVIDIA portable archive cannot silently grow far beyond the source NVIDIA runtime again.

QQ 群：1030632742，欢迎一起交流、提建议、完善 GoAgent。

## v0.4 系列延续能力

This release keeps the broader v0.4 foundation: grounded shape recognition engine, local pattern matcher, knowledge source-policy gates, optimized move-range review, quality checks and eval gates, Real Eval / engine silver fixture gate, KataGo engine pool telemetry, Release artifact smoke, student level, student age, teacher persona style settings with evidence boundary, teacher sessions, selective PR #6 integration, Tool-first Agent runtime, Kokoro selected-provider TTS with offline synthesis, Windows OpenCL runtime bundle, KataGo OpenCL adjacent runtime files, GPU vendor OpenCL drivers, and the community contribution path from layiku and wimi321.

## 中文

### 下载前先选版本

| 平台 / 场景 | 推荐下载 |
| --- | --- |
| macOS Apple Silicon（M 系列） | GoAgent-0.4.16-mac-arm64.dmg |
| macOS Intel | GoAgent-0.4.16-mac-x64.dmg |
| Windows x64 安装版，普通用户推荐 | GoAgent-0.4.16-win-x64.exe |
| Windows x64 免安装版 | GoAgent-0.4.16-win-x64-portable.zip |
| Windows x64 NVIDIA 专版安装版 | GoAgent-0.4.16-win-x64-nvidia.exe |
| Windows x64 NVIDIA 专版免安装包 | GoAgent-0.4.16-win-x64-nvidia-portable.7z.001 and all following split parts |
| 校验文件 | SHA256SUMS.txt |

### 本版重点

- 修复 NVIDIA 免安装包把 KataGo runtime / 模型同时放进 `resources/data/katago` 和 `resources/app.asar.unpacked/data/katago` 的重复打包问题。
- NVIDIA 免安装包恢复 solid 7z 压缩，并提高压缩等级，避免重复大文件把分卷包撑到异常体积。
- Release workflow 增加 NVIDIA 体积预算，超过预算会直接失败，不再把异常大包发布给用户。
- Windows Standard / Lite / NVIDIA packaged smoke 继续在上传前执行。
- 安装版、Lite 包、标准包命名保持不变。

## 繁體中文

### 下載前先選版本

| 平台 / 使用情境 | 建議下載 |
| --- | --- |
| macOS Apple Silicon | GoAgent-0.4.16-mac-arm64.dmg |
| macOS Intel | GoAgent-0.4.16-mac-x64.dmg |
| Windows x64 安裝版 | GoAgent-0.4.16-win-x64.exe |
| Windows x64 免安裝版 | GoAgent-0.4.16-win-x64-portable.zip |
| Windows x64 NVIDIA 專版 | GoAgent-0.4.16-win-x64-nvidia.exe |
| Windows x64 NVIDIA 免安裝包 | GoAgent-0.4.16-win-x64-nvidia-portable.7z.001 and all following split parts |
| 校驗檔 | SHA256SUMS.txt |

### 本版重點

- 修復 NVIDIA 免安裝包重複放入 KataGo runtime / 模型的問題。
- NVIDIA portable 改回 solid 7z 壓縮，並加入體積預算 gate。
- Standard、Lite、NVIDIA Windows 包仍會在上傳前 smoke 啟動。

## English

### Pick the right package before downloading

| Platform / use case | Recommended download |
| --- | --- |
| macOS Apple Silicon | GoAgent-0.4.16-mac-arm64.dmg |
| macOS Intel | GoAgent-0.4.16-mac-x64.dmg |
| Windows x64 installer | GoAgent-0.4.16-win-x64.exe |
| Windows x64 portable ZIP | GoAgent-0.4.16-win-x64-portable.zip |
| Windows x64 NVIDIA installer | GoAgent-0.4.16-win-x64-nvidia.exe |
| Windows x64 NVIDIA portable package | GoAgent-0.4.16-win-x64-nvidia-portable.7z.001 and all following split parts |
| Checksums | SHA256SUMS.txt |

### Highlights

- Fixes NVIDIA portable packages duplicating KataGo runtime/model files under both `resources/data/katago` and `resources/app.asar.unpacked/data/katago`.
- Restores solid 7z compression for the NVIDIA portable archive and raises the compression level.
- Adds a release size budget so an oversized NVIDIA portable package fails CI before publication.
- Keeps Standard, Lite, and NVIDIA Windows packaged-app smoke checks before artifact upload.

## 日本語

### ダウンロード前に選ぶもの

| 環境 | 推奨ファイル |
| --- | --- |
| macOS Apple Silicon | GoAgent-0.4.16-mac-arm64.dmg |
| macOS Intel | GoAgent-0.4.16-mac-x64.dmg |
| Windows x64 インストーラー | GoAgent-0.4.16-win-x64.exe |
| Windows x64 ポータブル ZIP | GoAgent-0.4.16-win-x64-portable.zip |
| Windows x64 NVIDIA 版 | GoAgent-0.4.16-win-x64-nvidia.exe |
| Windows x64 NVIDIA ポータブル | GoAgent-0.4.16-win-x64-nvidia-portable.7z.001 and all following split parts |
| チェックサム | SHA256SUMS.txt |

### 主な変更

- NVIDIA ポータブル版で KataGo runtime / model が重複して入る問題を修正しました。
- NVIDIA portable は solid 7z 圧縮を使い、サイズ予算 gate で肥大化を防ぎます。
- Windows packaged smoke は Standard / Lite / NVIDIA のすべてで継続します。

## 한국어

### 다운로드 전 선택

| 환경 | 권장 다운로드 |
| --- | --- |
| macOS Apple Silicon | GoAgent-0.4.16-mac-arm64.dmg |
| macOS Intel | GoAgent-0.4.16-mac-x64.dmg |
| Windows x64 설치 프로그램 | GoAgent-0.4.16-win-x64.exe |
| Windows x64 포터블 ZIP | GoAgent-0.4.16-win-x64-portable.zip |
| Windows x64 NVIDIA 설치 프로그램 | GoAgent-0.4.16-win-x64-nvidia.exe |
| Windows x64 NVIDIA 포터블 | GoAgent-0.4.16-win-x64-nvidia-portable.7z.001 and all following split parts |
| 체크섬 | SHA256SUMS.txt |

### 이번 버전

- NVIDIA 포터블 패키지에 KataGo runtime / model이 중복 포함되던 문제를 수정했습니다.
- solid 7z 압축과 크기 예산 gate를 추가했습니다.
- Windows Standard / Lite / NVIDIA smoke 검사는 계속 실행됩니다.

## ภาษาไทย

### เลือกไฟล์ก่อนดาวน์โหลด

| แพลตฟอร์ม | ไฟล์ที่แนะนำ |
| --- | --- |
| macOS Apple Silicon | GoAgent-0.4.16-mac-arm64.dmg |
| macOS Intel | GoAgent-0.4.16-mac-x64.dmg |
| Windows x64 installer | GoAgent-0.4.16-win-x64.exe |
| Windows x64 portable ZIP | GoAgent-0.4.16-win-x64-portable.zip |
| Windows x64 NVIDIA installer | GoAgent-0.4.16-win-x64-nvidia.exe |
| Windows x64 NVIDIA portable | GoAgent-0.4.16-win-x64-nvidia-portable.7z.001 and all following split parts |
| Checksums | SHA256SUMS.txt |

### จุดสำคัญของรุ่นนี้

- แก้ปัญหา NVIDIA portable ใส่ KataGo runtime / model ซ้ำ
- เปิด solid 7z compression และเพิ่ม size budget gate
- ยัง smoke-start แพ็กเกจ Windows Standard / Lite / NVIDIA ก่อนอัปโหลด

## Tiếng Việt

### Chọn gói tải xuống

| Nền tảng | Gói khuyến nghị |
| --- | --- |
| macOS Apple Silicon | GoAgent-0.4.16-mac-arm64.dmg |
| macOS Intel | GoAgent-0.4.16-mac-x64.dmg |
| Windows x64 installer | GoAgent-0.4.16-win-x64.exe |
| Windows x64 portable ZIP | GoAgent-0.4.16-win-x64-portable.zip |
| Windows x64 NVIDIA installer | GoAgent-0.4.16-win-x64-nvidia.exe |
| Windows x64 NVIDIA portable | GoAgent-0.4.16-win-x64-nvidia-portable.7z.001 and all following split parts |
| Checksums | SHA256SUMS.txt |

### Điểm mới

- Sửa lỗi NVIDIA portable chứa trùng KataGo runtime / model.
- Bật solid 7z compression và thêm size budget gate.
- Tiếp tục smoke-start các gói Windows Standard / Lite / NVIDIA trước khi upload.
