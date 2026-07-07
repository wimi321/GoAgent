# GoAgent v0.4.15

GoAgent v0.4.15 is a Windows download-and-run hardening release. It fixes packaged startup paths that could make Windows builds crash before the first window, makes Lite packages report missing KataGo as a setup warning instead of a blocked app, and adds packaged-app smoke checks for Standard, Lite, and NVIDIA Windows artifacts before release upload.

QQ 群：1030632742，欢迎一起交流、提建议、完善 GoAgent。

## v0.4 系列延续能力

This release keeps the broader v0.4 foundation: grounded shape recognition engine, local pattern matcher, knowledge source-policy gates, optimized move-range review, quality checks and eval gates, Real Eval / engine silver fixture gate, KataGo engine pool telemetry, Release artifact smoke, student level, student age, teacher persona style settings with evidence boundary, teacher sessions, selective PR #6 integration, Tool-first Agent runtime, Kokoro selected-provider TTS with offline synthesis, Windows OpenCL runtime bundle, KataGo OpenCL adjacent runtime files, GPU vendor OpenCL drivers, and the community contribution path from layiku and wimi321.

## 中文

### 下载前先选版本

| 平台 / 场景 | 推荐下载 |
| --- | --- |
| macOS Apple Silicon（M 系列） | GoAgent-0.4.15-mac-arm64.dmg |
| macOS Intel | GoAgent-0.4.15-mac-x64.dmg |
| Windows x64 安装版，普通用户推荐 | GoAgent-0.4.15-win-x64.exe |
| Windows x64 免安装版 | GoAgent-0.4.15-win-x64-portable.zip |
| Windows x64 NVIDIA 专版安装版 | GoAgent-0.4.15-win-x64-nvidia.exe |
| Windows x64 NVIDIA 专版免安装包 | GoAgent-0.4.15-win-x64-nvidia-portable.7z.001 and all following split parts |
| 校验文件 | SHA256SUMS.txt |

### 本版重点

- 修复 Windows 上 Electron 旧缓存 / Code Cache 异常导致应用未出窗口就退出的问题。
- Windows 默认关闭 Electron UI GPU 渲染路径；这不影响 KataGo 使用 NVIDIA / OpenCL 做分析。
- Lite 包不再因为没有内置 KataGo 引擎和模型而显示阻断诊断，改为提示用户安装或配置引擎。
- 打包后的发布状态检查会读取 `resources/app.asar` 和 `resources/data/katago`，不再误查源码目录或旧版本号。
- Release workflow 会在上传前分别启动 Standard、Lite、NVIDIA Windows 包，并检查诊断、KataGo 资源和发布状态。

## 繁體中文

### 下載前先選版本

| 平台 / 使用情境 | 建議下載 |
| --- | --- |
| macOS Apple Silicon | GoAgent-0.4.15-mac-arm64.dmg |
| macOS Intel | GoAgent-0.4.15-mac-x64.dmg |
| Windows x64 安裝版 | GoAgent-0.4.15-win-x64.exe |
| Windows x64 免安裝版 | GoAgent-0.4.15-win-x64-portable.zip |
| Windows x64 NVIDIA 專版 | GoAgent-0.4.15-win-x64-nvidia.exe |
| Windows x64 NVIDIA 免安裝包 | GoAgent-0.4.15-win-x64-nvidia-portable.7z.001 and all following split parts |
| 校驗檔 | SHA256SUMS.txt |

### 本版重點

- 修復 Windows 舊 Electron 快取或 Code Cache 讓應用啟動前崩潰的問題。
- Windows 預設關閉 Electron UI GPU 路徑；KataGo 仍可使用 NVIDIA / OpenCL。
- Lite 包缺少內建 KataGo 時會顯示設定提醒，不再阻擋應用啟動。
- 打包後的 readiness 會檢查真正的 `app.asar` 與 `resources/data/katago`。
- 發布流程會在上傳前啟動 Standard、Lite、NVIDIA Windows 包做 smoke。

## English

### Pick the right package before downloading

| Platform / use case | Recommended download |
| --- | --- |
| macOS Apple Silicon | GoAgent-0.4.15-mac-arm64.dmg |
| macOS Intel | GoAgent-0.4.15-mac-x64.dmg |
| Windows x64 installer | GoAgent-0.4.15-win-x64.exe |
| Windows x64 portable ZIP | GoAgent-0.4.15-win-x64-portable.zip |
| Windows x64 NVIDIA installer | GoAgent-0.4.15-win-x64-nvidia.exe |
| Windows x64 NVIDIA portable package | GoAgent-0.4.15-win-x64-nvidia-portable.7z.001 and all following split parts |
| Checksums | SHA256SUMS.txt |

### Highlights

- Fixes Windows startup crashes caused by stale or locked Electron Cache / Code Cache state.
- Disables the Electron UI GPU path on Windows by default; KataGo NVIDIA / OpenCL analysis is unaffected.
- Lite packages now treat missing bundled KataGo as setup guidance instead of a blocking diagnostic failure.
- Packaged release readiness now checks `resources/app.asar` and `resources/data/katago`, not the source tree or an old hardcoded version.
- Release CI now smoke-starts Standard, Lite, and NVIDIA Windows packages before artifact upload.

## 日本語

### ダウンロード前に選ぶもの

| 環境 | 推奨ファイル |
| --- | --- |
| macOS Apple Silicon | GoAgent-0.4.15-mac-arm64.dmg |
| macOS Intel | GoAgent-0.4.15-mac-x64.dmg |
| Windows x64 インストーラー | GoAgent-0.4.15-win-x64.exe |
| Windows x64 ポータブル ZIP | GoAgent-0.4.15-win-x64-portable.zip |
| Windows x64 NVIDIA 版 | GoAgent-0.4.15-win-x64-nvidia.exe |
| Windows x64 NVIDIA ポータブル | GoAgent-0.4.15-win-x64-nvidia-portable.7z.001 and all following split parts |
| チェックサム | SHA256SUMS.txt |

### 主な変更

- Windows の Electron Cache / Code Cache が原因で起動前に落ちる問題を修正しました。
- Windows では Electron UI の GPU 経路を既定で無効化します。KataGo の NVIDIA / OpenCL 解析には影響しません。
- Lite 版は内蔵 KataGo がない場合でも起動をブロックせず、設定案内を表示します。
- パッケージ後の readiness は実際の `app.asar` と `resources/data/katago` を確認します。

## 한국어

### 다운로드 전 선택

| 환경 | 권장 다운로드 |
| --- | --- |
| macOS Apple Silicon | GoAgent-0.4.15-mac-arm64.dmg |
| macOS Intel | GoAgent-0.4.15-mac-x64.dmg |
| Windows x64 설치 프로그램 | GoAgent-0.4.15-win-x64.exe |
| Windows x64 포터블 ZIP | GoAgent-0.4.15-win-x64-portable.zip |
| Windows x64 NVIDIA 설치 프로그램 | GoAgent-0.4.15-win-x64-nvidia.exe |
| Windows x64 NVIDIA 포터블 | GoAgent-0.4.15-win-x64-nvidia-portable.7z.001 and all following split parts |
| 체크섬 | SHA256SUMS.txt |

### 이번 버전

- Windows에서 Electron Cache / Code Cache 문제로 창이 뜨기 전에 종료되는 문제를 수정했습니다.
- Windows에서는 Electron UI GPU 경로를 기본 비활성화합니다. KataGo NVIDIA / OpenCL 분석에는 영향이 없습니다.
- Lite 패키지는 내장 KataGo가 없어도 앱을 차단하지 않고 설정 안내를 보여줍니다.
- 패키지 readiness는 실제 `app.asar` 및 `resources/data/katago`를 검사합니다.

## ภาษาไทย

### เลือกไฟล์ก่อนดาวน์โหลด

| แพลตฟอร์ม | ไฟล์ที่แนะนำ |
| --- | --- |
| macOS Apple Silicon | GoAgent-0.4.15-mac-arm64.dmg |
| macOS Intel | GoAgent-0.4.15-mac-x64.dmg |
| Windows x64 installer | GoAgent-0.4.15-win-x64.exe |
| Windows x64 portable ZIP | GoAgent-0.4.15-win-x64-portable.zip |
| Windows x64 NVIDIA installer | GoAgent-0.4.15-win-x64-nvidia.exe |
| Windows x64 NVIDIA portable | GoAgent-0.4.15-win-x64-nvidia-portable.7z.001 and all following split parts |
| Checksums | SHA256SUMS.txt |

### จุดสำคัญของรุ่นนี้

- แก้ปัญหา Windows ที่ Electron Cache / Code Cache ทำให้แอปปิดก่อนหน้าต่างเปิด
- ปิดเส้นทาง GPU ของ Electron UI เป็นค่าเริ่มต้นบน Windows โดยไม่กระทบ KataGo NVIDIA / OpenCL
- Lite package จะไม่บล็อกแอปเมื่อไม่มี KataGo ในตัว แต่จะแนะนำการตั้งค่าแทน
- readiness ของแพ็กเกจจะตรวจ `app.asar` และ `resources/data/katago` จริง

## Tiếng Việt

### Chọn gói tải xuống

| Nền tảng | Gói khuyến nghị |
| --- | --- |
| macOS Apple Silicon | GoAgent-0.4.15-mac-arm64.dmg |
| macOS Intel | GoAgent-0.4.15-mac-x64.dmg |
| Windows x64 installer | GoAgent-0.4.15-win-x64.exe |
| Windows x64 portable ZIP | GoAgent-0.4.15-win-x64-portable.zip |
| Windows x64 NVIDIA installer | GoAgent-0.4.15-win-x64-nvidia.exe |
| Windows x64 NVIDIA portable | GoAgent-0.4.15-win-x64-nvidia-portable.7z.001 and all following split parts |
| Checksums | SHA256SUMS.txt |

### Điểm mới

- Sửa lỗi Windows trong đó Electron Cache / Code Cache có thể làm ứng dụng thoát trước khi mở cửa sổ.
- Mặc định tắt đường GPU của Electron UI trên Windows; phân tích KataGo NVIDIA / OpenCL không bị ảnh hưởng.
- Lite package không còn chặn khởi động khi thiếu KataGo tích hợp, mà hiển thị hướng dẫn cấu hình.
- Packaged readiness kiểm tra `app.asar` và `resources/data/katago` thực tế.
