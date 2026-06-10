# GoAgent v0.4.12

GoAgent v0.4.12 is a hotfix release that makes local KataGo analysis the default again. Remote compute remains available, but GoAgent will not silently switch to Zhizi cloud unless the user explicitly enables it.

QQ 群：1030632742，欢迎一起交流、提建议、完善 GoAgent。

## v0.4 系列延续能力

This release keeps the broader v0.4 foundation: grounded shape recognition engine, local pattern matcher, knowledge source-policy gates, optimized move-range review, quality checks and eval gates, Real Eval / engine silver fixture gate, KataGo engine pool telemetry, Release artifact smoke, student level, student age, teacher persona style settings with evidence boundary, teacher sessions, selective PR #6 integration, Kokoro selected-provider TTS with offline synthesis, Windows OpenCL runtime bundle, KataGo OpenCL adjacent runtime files, GPU vendor OpenCL drivers, and the community contribution path from layiku and wimi321.

## 中文

### 下载前先选版本

| 平台 / 场景 | 推荐下载 |
| --- | --- |
| macOS Apple Silicon（M 系列） | GoAgent-0.4.12-mac-arm64.dmg |
| macOS Intel | GoAgent-0.4.12-mac-x64.dmg |
| Windows x64 安装版，普通用户推荐 | GoAgent-0.4.12-win-x64.exe |
| Windows x64 免安装版 | GoAgent-0.4.12-win-x64-portable.zip |
| Windows x64 NVIDIA 专版安装版 | GoAgent-0.4.12-win-x64-nvidia.exe |
| Windows x64 NVIDIA 专版免安装包 | GoAgent-0.4.12-win-x64-nvidia-portable.7z.001 and all following split parts |
| 校验文件 | SHA256SUMS.txt |

### 本版重点

- 默认回到本机 KataGo 分析：旧版本保存过智子云或 iKataGo 远程模式的用户，升级后会一次性迁移到本机 `auto` 模式。
- `auto` 模式不再因为本机 KataGo 缺失、启动失败或超时而静默切到智子云。
- 智子云仍保留为手动远程算力入口；只有用户明确启用直连时才会上传当前局面。
- 设置页文案调整为“默认本机、远程手动启用”，减少误操作和错误连接。

## 繁體中文

### 下載前先選版本

| 平台 / 使用情境 | 建議下載 |
| --- | --- |
| macOS Apple Silicon | GoAgent-0.4.12-mac-arm64.dmg |
| macOS Intel | GoAgent-0.4.12-mac-x64.dmg |
| Windows x64 安裝版 | GoAgent-0.4.12-win-x64.exe |
| Windows x64 免安裝版 | GoAgent-0.4.12-win-x64-portable.zip |
| Windows x64 NVIDIA 專版 | GoAgent-0.4.12-win-x64-nvidia.exe |
| Windows x64 NVIDIA 免安裝包 | GoAgent-0.4.12-win-x64-nvidia-portable.7z.001 and all following split parts |
| 校驗檔 | SHA256SUMS.txt |

### 本版重點

- 預設回到本機 KataGo 分析；舊版保存過遠端模式的使用者會一次性遷移回本機 `auto` 模式。
- `auto` 模式不再因本機 KataGo 失敗而靜默切到智子雲。
- 智子雲仍可手動啟用，只有明確選擇遠端直連時才會上傳局面。

## English

### Pick the right package before downloading

| Platform / use case | Recommended download |
| --- | --- |
| macOS Apple Silicon | GoAgent-0.4.12-mac-arm64.dmg |
| macOS Intel | GoAgent-0.4.12-mac-x64.dmg |
| Windows x64 installer | GoAgent-0.4.12-win-x64.exe |
| Windows x64 portable ZIP | GoAgent-0.4.12-win-x64-portable.zip |
| Windows x64 NVIDIA installer | GoAgent-0.4.12-win-x64-nvidia.exe |
| Windows x64 NVIDIA portable package | GoAgent-0.4.12-win-x64-nvidia-portable.7z.001 and all following split parts |
| Checksums | SHA256SUMS.txt |

### Highlights

- Local KataGo is the default again. Existing users with a saved remote mode are migrated once back to local `auto` mode.
- `auto` mode no longer silently falls back to Zhizi cloud when local KataGo is missing, fails to start, or times out.
- Zhizi cloud remains available as an explicit manual remote-compute option.
- Settings copy now makes the local-vs-remote boundary clearer.

## 日本語

### ダウンロード前に選ぶもの

| 環境 | 推奨ファイル |
| --- | --- |
| macOS Apple Silicon | GoAgent-0.4.12-mac-arm64.dmg |
| macOS Intel | GoAgent-0.4.12-mac-x64.dmg |
| Windows x64 インストーラー | GoAgent-0.4.12-win-x64.exe |
| Windows x64 ポータブル ZIP | GoAgent-0.4.12-win-x64-portable.zip |
| Windows x64 NVIDIA 版 | GoAgent-0.4.12-win-x64-nvidia.exe |
| Windows x64 NVIDIA ポータブル | GoAgent-0.4.12-win-x64-nvidia-portable.7z.001 and all following split parts |
| チェックサム | SHA256SUMS.txt |

### 主な変更

- ローカル KataGo 解析を再び標準にしました。
- `auto` モードがローカル失敗時に智子クラウドへ黙って切り替わらないようにしました。
- 智子クラウドは明示的に有効化した場合だけ使用されます。

## 한국어

### 다운로드 전 선택

| 환경 | 권장 다운로드 |
| --- | --- |
| macOS Apple Silicon | GoAgent-0.4.12-mac-arm64.dmg |
| macOS Intel | GoAgent-0.4.12-mac-x64.dmg |
| Windows x64 설치 프로그램 | GoAgent-0.4.12-win-x64.exe |
| Windows x64 포터블 ZIP | GoAgent-0.4.12-win-x64-portable.zip |
| Windows x64 NVIDIA 설치 프로그램 | GoAgent-0.4.12-win-x64-nvidia.exe |
| Windows x64 NVIDIA 포터블 | GoAgent-0.4.12-win-x64-nvidia-portable.7z.001 and all following split parts |
| 체크섬 | SHA256SUMS.txt |

### 이번 버전

- 로컬 KataGo 분석을 다시 기본값으로 설정했습니다.
- `auto` 모드가 로컬 실패 시 Zhizi 클라우드로 조용히 전환되지 않습니다.
- 원격 분석은 사용자가 직접 Zhizi 직결을 켰을 때만 사용됩니다.

## ภาษาไทย

### เลือกไฟล์ก่อนดาวน์โหลด

| แพลตฟอร์ม | ไฟล์ที่แนะนำ |
| --- | --- |
| macOS Apple Silicon | GoAgent-0.4.12-mac-arm64.dmg |
| macOS Intel | GoAgent-0.4.12-mac-x64.dmg |
| Windows x64 installer | GoAgent-0.4.12-win-x64.exe |
| Windows x64 portable ZIP | GoAgent-0.4.12-win-x64-portable.zip |
| Windows x64 NVIDIA installer | GoAgent-0.4.12-win-x64-nvidia.exe |
| Windows x64 NVIDIA portable | GoAgent-0.4.12-win-x64-nvidia-portable.7z.001 and all following split parts |
| Checksums | SHA256SUMS.txt |

### จุดสำคัญของรุ่นนี้

- ตั้งค่าให้วิเคราะห์ด้วย KataGo บนเครื่องเป็นค่าเริ่มต้นอีกครั้ง
- โหมด `auto` จะไม่สลับไป Zhizi cloud เองเมื่อ KataGo ในเครื่องล้มเหลว
- การใช้ remote compute ต้องเปิด Zhizi direct ด้วยตัวเองเท่านั้น

## Tiếng Việt

### Chọn gói tải xuống

| Nền tảng | Gói khuyến nghị |
| --- | --- |
| macOS Apple Silicon | GoAgent-0.4.12-mac-arm64.dmg |
| macOS Intel | GoAgent-0.4.12-mac-x64.dmg |
| Windows x64 installer | GoAgent-0.4.12-win-x64.exe |
| Windows x64 portable ZIP | GoAgent-0.4.12-win-x64-portable.zip |
| Windows x64 NVIDIA installer | GoAgent-0.4.12-win-x64-nvidia.exe |
| Windows x64 NVIDIA portable | GoAgent-0.4.12-win-x64-nvidia-portable.7z.001 and all following split parts |
| Checksums | SHA256SUMS.txt |

### Điểm mới

- Phân tích KataGo cục bộ trở lại làm mặc định.
- Chế độ `auto` không tự chuyển sang Zhizi cloud khi KataGo cục bộ lỗi.
- Tính toán từ xa chỉ chạy khi người dùng bật Zhizi direct một cách rõ ràng.
