# GoAgent v0.3.11

GoAgent v0.3.11 focuses on day-to-day library control and AI teacher reliability. The SGF library now supports safe deletion with confirmation, cleanup of GoAgent-managed SGF files, student binding cleanup, selected-board reset, and local evaluation cache cleanup. The AI teacher side panel also keeps the recent interaction fixes for history, teaching settings, Enter-to-send, and analysis startup. This release keeps the existing quality baseline: grounded shape recognition engine, local pattern matcher, knowledge source-policy gates, optimized move-range review, quality checks and eval gates, Real Eval / engine silver fixture gate, KataGo engine pool telemetry, Release artifact smoke, student level, student age, teacher persona style settings with evidence boundary, teacher sessions, and selective PR #6 integration. Windows packages continue to follow the OpenCL and NVIDIA packaging split: the standard Windows build includes the Windows OpenCL runtime bundle and KataGo OpenCL adjacent runtime files, while GPU vendor OpenCL drivers still come from the user's NVIDIA / AMD / Intel graphics driver. Thanks to layiku and wimi321.

QQ群：1030632742，欢迎一起交流、提建议、完善 GoAgent。

## 中文

### 下载前先选版本

| 平台 / 场景 | 推荐下载 |
| --- | --- |
| macOS Apple Silicon | `GoAgent-0.3.11-mac-arm64.dmg` |
| macOS Intel | `GoAgent-0.3.11-mac-x64.dmg` |
| Windows 普通版，OpenCL 推荐包 | `GoAgent-0.3.11-win-x64.exe` 或 `GoAgent-0.3.11-win-x64-portable.zip` |
| Windows NVIDIA 专版，适合 NVIDIA 显卡和 CUDA 环境 | `GoAgent-0.3.11-win-x64-nvidia.exe` 或 `GoAgent-0.3.11-win-x64-nvidia-portable.zip` |
| 校验文件 | `SHA256SUMS.txt` |

### 本版重点

- 棋谱库新增删除棋谱：删除前确认，删除 GoAgent 管理目录中的缓存 SGF，并同步清理学生绑定和本地胜率分析缓存。
- 删除当前棋谱后会自动回到下一盘可打开棋谱，棋盘和 AI 老师上下文不会停在已不存在的记录上。
- 保留 AI 老师交互修复：历史会话、教学设定、回车发送、开始分析入口均按用户流程复测。
- 普通 Windows 包继续包含 Windows OpenCL runtime bundle 和 KataGo OpenCL adjacent runtime files；GPU vendor OpenCL drivers 仍由用户显卡驱动提供。
- Windows NVIDIA 专版继续保留 CUDA runtime 整合包。

## 繁體中文

### 下載前先選版本

| 平台 / 使用情境 | 建議下載 |
| --- | --- |
| macOS Apple Silicon | `GoAgent-0.3.11-mac-arm64.dmg` |
| macOS Intel | `GoAgent-0.3.11-mac-x64.dmg` |
| Windows 一般版，OpenCL 推薦包 | `GoAgent-0.3.11-win-x64.exe` 或 `GoAgent-0.3.11-win-x64-portable.zip` |
| Windows NVIDIA 專版 | `GoAgent-0.3.11-win-x64-nvidia.exe` 或 `GoAgent-0.3.11-win-x64-nvidia-portable.zip` |
| 校驗檔 | `SHA256SUMS.txt` |

### 本版重點

- 棋譜庫新增刪除棋譜：刪除前確認，清理 GoAgent 管理目錄中的 SGF、學生綁定與本地勝率分析快取。
- 刪除目前棋譜後會自動切到下一盤可開啟棋譜，避免畫面停在已刪除記錄。
- 保留 AI 老師互動修正：歷史會話、教學設定、Enter 送出、開始分析入口均已依使用流程複測。
- Windows 一般版持續包含 Windows OpenCL runtime bundle 與 KataGo OpenCL adjacent runtime files；GPU vendor OpenCL drivers 仍由使用者顯示卡驅動提供。
- Windows NVIDIA 專版維持 CUDA runtime 整合包。

## English

### Pick the right package before downloading

| Platform / use case | Recommended download |
| --- | --- |
| macOS Apple Silicon | `GoAgent-0.3.11-mac-arm64.dmg` |
| macOS Intel | `GoAgent-0.3.11-mac-x64.dmg` |
| Standard Windows x64, OpenCL recommended | `GoAgent-0.3.11-win-x64.exe` or `GoAgent-0.3.11-win-x64-portable.zip` |
| Windows NVIDIA edition for NVIDIA GPUs and CUDA runtimes | `GoAgent-0.3.11-win-x64-nvidia.exe` or `GoAgent-0.3.11-win-x64-nvidia-portable.zip` |
| Checksums | `SHA256SUMS.txt` |

### Why update

- The library can now delete games safely: confirmation first, removal of GoAgent-managed SGF cache files, student binding cleanup, and local evaluation cache cleanup.
- Deleting the selected game now resets the board and moves to the next openable game instead of leaving stale state on screen.
- Keeps the AI teacher interaction fixes for history, teaching settings, Enter-to-send, and the start-analysis action.
- Standard Windows still includes the Windows OpenCL runtime bundle and KataGo OpenCL adjacent runtime files; GPU vendor OpenCL drivers still come from the user's NVIDIA, AMD, or Intel driver.
- The Windows NVIDIA edition remains the CUDA runtime package.

## 日本語

### ダウンロード前に選ぶもの

| 環境 | 推奨ファイル |
| --- | --- |
| macOS Apple Silicon | `GoAgent-0.3.11-mac-arm64.dmg` |
| macOS Intel | `GoAgent-0.3.11-mac-x64.dmg` |
| Windows 標準版、OpenCL 推奨 | `GoAgent-0.3.11-win-x64.exe` または `GoAgent-0.3.11-win-x64-portable.zip` |
| NVIDIA GPU / CUDA 向け Windows NVIDIA 版 | `GoAgent-0.3.11-win-x64-nvidia.exe` または `GoAgent-0.3.11-win-x64-nvidia-portable.zip` |
| チェックサム | `SHA256SUMS.txt` |

### 主な修正

- 棋譜ライブラリで安全に削除できるようになりました。確認後、GoAgent 管理下の SGF、学生紐付け、ローカル評価キャッシュを整理します。
- 選択中の棋譜を削除した場合、盤面は古い状態に残らず、次に開ける棋譜へ切り替わります。
- AI teacher の履歴、教学設定、Enter 送信、分析開始の修正を含みます。
- Windows 標準版は Windows OpenCL runtime bundle と KataGo OpenCL adjacent runtime files を引き続き同梱します。GPU vendor OpenCL drivers は NVIDIA / AMD / Intel のドライバーから提供されます。
- Windows NVIDIA 版は CUDA runtime 同梱版として継続します。

## 한국어

### 다운로드 전 선택 가이드

| 환경 | 권장 다운로드 |
| --- | --- |
| macOS Apple Silicon | `GoAgent-0.3.11-mac-arm64.dmg` |
| macOS Intel | `GoAgent-0.3.11-mac-x64.dmg` |
| Windows 표준 x64, OpenCL 권장 | `GoAgent-0.3.11-win-x64.exe` 또는 `GoAgent-0.3.11-win-x64-portable.zip` |
| NVIDIA GPU / CUDA용 Windows NVIDIA 에디션 | `GoAgent-0.3.11-win-x64-nvidia.exe` 또는 `GoAgent-0.3.11-win-x64-nvidia-portable.zip` |
| 체크섬 | `SHA256SUMS.txt` |

### 핵심 수정

- 기보 라이브러리에서 안전 삭제를 지원합니다. 확인 후 GoAgent가 관리하는 SGF, 학생 연결, 로컬 평가 캐시를 정리합니다.
- 현재 선택한 기보를 삭제하면 오래된 화면에 머물지 않고 다음으로 열 수 있는 기보로 이동합니다.
- AI teacher의 히스토리, 교육 설정, Enter 전송, 분석 시작 동작 수정이 포함됩니다.
- Windows 표준 패키지는 Windows OpenCL runtime bundle과 KataGo OpenCL adjacent runtime files를 계속 포함합니다. GPU vendor OpenCL drivers는 사용자의 NVIDIA / AMD / Intel 그래픽 드라이버에서 제공됩니다.
- Windows NVIDIA 에디션은 CUDA runtime 패키지로 유지됩니다.

## ภาษาไทย

### เลือกไฟล์ก่อนดาวน์โหลด

| ระบบ / การใช้งาน | ไฟล์ที่แนะนำ |
| --- | --- |
| macOS Apple Silicon | `GoAgent-0.3.11-mac-arm64.dmg` |
| macOS Intel | `GoAgent-0.3.11-mac-x64.dmg` |
| Windows x64 รุ่นมาตรฐาน แนะนำ OpenCL | `GoAgent-0.3.11-win-x64.exe` หรือ `GoAgent-0.3.11-win-x64-portable.zip` |
| Windows NVIDIA edition สำหรับ NVIDIA GPU และ CUDA | `GoAgent-0.3.11-win-x64-nvidia.exe` หรือ `GoAgent-0.3.11-win-x64-nvidia-portable.zip` |
| Checksums | `SHA256SUMS.txt` |

### สิ่งที่แก้ไข

- คลัง SGF สามารถลบเกมได้อย่างปลอดภัย โดยยืนยันก่อน แล้วล้างไฟล์ SGF ที่ GoAgent จัดการ ข้อมูลผู้เรียนที่ผูกไว้ และแคชการประเมินในเครื่อง
- เมื่อลบเกมที่เลือกอยู่ หน้าจอจะย้ายไปยังเกมถัดไปที่เปิดได้แทนการค้างอยู่กับข้อมูลเก่า
- รวมการแก้ไข AI teacher สำหรับประวัติ การตั้งค่าการสอน การส่งด้วย Enter และปุ่มเริ่มวิเคราะห์
- แพ็กเกจ Windows มาตรฐานยังรวม Windows OpenCL runtime bundle และ KataGo OpenCL adjacent runtime files ส่วน GPU vendor OpenCL drivers ยังมาจากไดรเวอร์ NVIDIA / AMD / Intel ของผู้ใช้
- Windows NVIDIA edition ยังคงเป็นแพ็กเกจ CUDA runtime

## Tiếng Việt

### Chọn đúng gói trước khi tải

| Nền tảng / nhu cầu | Tệp nên tải |
| --- | --- |
| macOS Apple Silicon | `GoAgent-0.3.11-mac-arm64.dmg` |
| macOS Intel | `GoAgent-0.3.11-mac-x64.dmg` |
| Windows x64 tiêu chuẩn, khuyến nghị OpenCL | `GoAgent-0.3.11-win-x64.exe` hoặc `GoAgent-0.3.11-win-x64-portable.zip` |
| Windows NVIDIA edition cho GPU NVIDIA và CUDA | `GoAgent-0.3.11-win-x64-nvidia.exe` hoặc `GoAgent-0.3.11-win-x64-nvidia-portable.zip` |
| Checksums | `SHA256SUMS.txt` |

### Bản sửa lỗi

- Thư viện SGF nay có thể xóa ván an toàn: xác nhận trước, dọn tệp SGF do GoAgent quản lý, liên kết học viên và bộ nhớ đệm đánh giá cục bộ.
- Khi xóa ván đang chọn, bàn cờ sẽ chuyển sang ván kế tiếp có thể mở thay vì giữ trạng thái cũ.
- Giữ các bản sửa AI teacher cho lịch sử, thiết lập dạy học, gửi bằng Enter và thao tác bắt đầu phân tích.
- Gói Windows tiêu chuẩn vẫn đi kèm Windows OpenCL runtime bundle và KataGo OpenCL adjacent runtime files. GPU vendor OpenCL drivers vẫn đến từ driver NVIDIA / AMD / Intel trên máy người dùng.
- Windows NVIDIA edition vẫn là gói CUDA runtime.

## Verification

- `pnpm test`
- `pnpm typecheck`
- `pnpm build`
- Isolated Electron user-flow smoke with a temporary `GOAGENT_APP_HOME`: delete cancel keeps the row, delete confirm removes the row and managed SGF file.
- `pnpm check:release-notes-i18n`

## Known Notes

- Delete only removes SGF files under GoAgent's managed app home. External source files imported by the user are not touched directly.
- Standard Windows is the OpenCL-recommended package. If OpenCL behaves badly on a user's PC, use a future CPU fallback package or configure a custom engine.
- Windows NVIDIA edition is intended for Windows x64 machines with NVIDIA GPUs and compatible CUDA drivers.
- Windows packages may trigger SmartScreen until the project has stronger signing reputation.
