# GoMentor v0.3.12

GoMentor v0.3.12 is an AI teacher reliability and interaction polish release. It fixes the right-side teacher history and teaching settings workflow, adds direct-send quick prompts, makes history sessions deletable, and removes a Windows Python runtime trap that could block `KataGo 整盘分析` with `python3 -m venv`. The AI teacher's full-game KataGo tool now uses GoMentor's native quick-analysis path instead of the Python report generator, so teacher answers are less likely to disappear behind Python or pip setup failures. This release keeps the existing quality baseline: grounded shape recognition engine, local pattern matcher, knowledge source-policy gates, optimized move-range review, quality checks and eval gates, Real Eval / engine silver fixture gate, KataGo engine pool telemetry, Release artifact smoke, student level, student age, teacher persona style settings with evidence boundary, teacher sessions, and selective PR #6 integration. Windows packages continue to follow the OpenCL and NVIDIA packaging split: the standard Windows build includes the Windows OpenCL runtime bundle and KataGo OpenCL adjacent runtime files, while GPU vendor OpenCL drivers still come from the user's NVIDIA / AMD / Intel graphics driver. Thanks to layiku and wimi321.

QQ群：1030632742，欢迎一起交流、提建议、完善 GoMentor。

## 中文

### 下载前先选版本

| 平台 / 场景 | 推荐下载 |
| --- | --- |
| macOS Apple Silicon | `GoMentor-0.3.12-mac-arm64.dmg` |
| macOS Intel | `GoMentor-0.3.12-mac-x64.dmg` |
| Windows 普通版，OpenCL 推荐包 | `GoMentor-0.3.12-win-x64.exe` 或 `GoMentor-0.3.12-win-x64-portable.zip` |
| Windows NVIDIA 专版，适合 NVIDIA 显卡和 CUDA 环境 | `GoMentor-0.3.12-win-x64-nvidia.exe` 或 `GoMentor-0.3.12-win-x64-nvidia-portable.zip` |
| 校验文件 | `SHA256SUMS.txt` |

### 本版重点

- AI 老师历史会话支持删除，教学设定保存后会立即同步到当前界面。
- 快捷问题会直接发送并开始分析，不需要再点输入框右侧发送按钮。
- 修复 Windows 上 `python3 -m venv` 失败导致整盘分析没有结果的问题，Python venv 改为自动选择可用的 `python` / `py -3`，并使用 `venv\Scripts\python.exe`。
- AI 老师的整盘 KataGo 工具改走原生快速分析，不再依赖 Python 报告链路。
- 普通 Windows 包继续包含 Windows OpenCL runtime bundle 和 KataGo OpenCL adjacent runtime files；GPU vendor OpenCL drivers 仍由用户显卡驱动提供。

## 繁體中文

### 下載前先選版本

| 平台 / 使用情境 | 建議下載 |
| --- | --- |
| macOS Apple Silicon | `GoMentor-0.3.12-mac-arm64.dmg` |
| macOS Intel | `GoMentor-0.3.12-mac-x64.dmg` |
| Windows 一般版，OpenCL 推薦包 | `GoMentor-0.3.12-win-x64.exe` 或 `GoMentor-0.3.12-win-x64-portable.zip` |
| Windows NVIDIA 專版 | `GoMentor-0.3.12-win-x64-nvidia.exe` 或 `GoMentor-0.3.12-win-x64-nvidia-portable.zip` |
| 校驗檔 | `SHA256SUMS.txt` |

### 本版重點

- AI 老師歷史會話支援刪除，教學設定儲存後會同步回目前畫面。
- 快捷問題會直接送出並開始分析，不需要再按輸入框送出。
- 修正 Windows `python3 -m venv` 失敗導致整盤分析沒有結果的問題，會自動選擇可用的 `python` / `py -3` 並使用 `venv\Scripts\python.exe`。
- AI 老師的整盤 KataGo 工具改用原生快速分析，不再依賴 Python 報告流程。
- Windows 一般版持續包含 Windows OpenCL runtime bundle 與 KataGo OpenCL adjacent runtime files；GPU vendor OpenCL drivers 仍由使用者顯示卡驅動提供。

## English

### Pick the right package before downloading

| Platform / use case | Recommended download |
| --- | --- |
| macOS Apple Silicon | `GoMentor-0.3.12-mac-arm64.dmg` |
| macOS Intel | `GoMentor-0.3.12-mac-x64.dmg` |
| Standard Windows x64, OpenCL recommended | `GoMentor-0.3.12-win-x64.exe` or `GoMentor-0.3.12-win-x64-portable.zip` |
| Windows NVIDIA edition for NVIDIA GPUs and CUDA runtimes | `GoMentor-0.3.12-win-x64-nvidia.exe` or `GoMentor-0.3.12-win-x64-nvidia-portable.zip` |
| Checksums | `SHA256SUMS.txt` |

### Why update

- AI teacher history sessions can be deleted, and teaching settings now persist back into the active UI state.
- Quick prompt chips send immediately and start analysis instead of only filling the composer.
- Fixes the Windows `python3 -m venv` failure that could prevent full-game analysis from producing an answer. The runtime now resolves a usable `python` / `py -3` and uses `venv\Scripts\python.exe`.
- The AI teacher full-game KataGo tool now uses GoMentor's native quick-analysis path instead of the Python report path.
- Standard Windows still includes the Windows OpenCL runtime bundle and KataGo OpenCL adjacent runtime files; GPU vendor OpenCL drivers still come from the user's NVIDIA, AMD, or Intel driver.

## 日本語

### ダウンロード前に選ぶもの

| 環境 | 推奨ファイル |
| --- | --- |
| macOS Apple Silicon | `GoMentor-0.3.12-mac-arm64.dmg` |
| macOS Intel | `GoMentor-0.3.12-mac-x64.dmg` |
| Windows 標準版、OpenCL 推奨 | `GoMentor-0.3.12-win-x64.exe` または `GoMentor-0.3.12-win-x64-portable.zip` |
| NVIDIA GPU / CUDA 向け Windows NVIDIA 版 | `GoMentor-0.3.12-win-x64-nvidia.exe` または `GoMentor-0.3.12-win-x64-nvidia-portable.zip` |
| チェックサム | `SHA256SUMS.txt` |

### 主な修正

- AI teacher の履歴セッションを削除できるようになり、教学設定の保存も現在の UI 状態に反映されます。
- クイック質問は入力欄に入れるだけでなく、そのまま送信して分析を開始します。
- Windows の `python3 -m venv` 失敗で全局分析が返らない問題を修正しました。使用可能な `python` / `py -3` を探し、`venv\Scripts\python.exe` を使います。
- AI teacher の全局 KataGo ツールは Python レポートではなく GoMentor のネイティブ高速分析を使います。
- Windows 標準版は Windows OpenCL runtime bundle と KataGo OpenCL adjacent runtime files を引き続き同梱します。GPU vendor OpenCL drivers は NVIDIA / AMD / Intel のドライバーから提供されます。

## 한국어

### 다운로드 전 선택 가이드

| 환경 | 권장 다운로드 |
| --- | --- |
| macOS Apple Silicon | `GoMentor-0.3.12-mac-arm64.dmg` |
| macOS Intel | `GoMentor-0.3.12-mac-x64.dmg` |
| Windows 표준 x64, OpenCL 권장 | `GoMentor-0.3.12-win-x64.exe` 또는 `GoMentor-0.3.12-win-x64-portable.zip` |
| NVIDIA GPU / CUDA용 Windows NVIDIA 에디션 | `GoMentor-0.3.12-win-x64-nvidia.exe` 또는 `GoMentor-0.3.12-win-x64-nvidia-portable.zip` |
| 체크섬 | `SHA256SUMS.txt` |

### 핵심 수정

- AI teacher 기록 세션을 삭제할 수 있고, 교육 설정 저장 결과가 현재 UI 상태에 바로 반영됩니다.
- 빠른 질문 버튼은 입력창에만 넣지 않고 즉시 전송해 분석을 시작합니다.
- Windows에서 `python3 -m venv` 실패로 전체 기보 분석 결과가 나오지 않던 문제를 수정했습니다. 사용 가능한 `python` / `py -3`를 찾고 `venv\Scripts\python.exe`를 사용합니다.
- AI teacher의 전체 기보 KataGo 도구는 Python 보고서 경로 대신 GoMentor 네이티브 빠른 분석을 사용합니다.
- Windows 표준 패키지는 Windows OpenCL runtime bundle과 KataGo OpenCL adjacent runtime files를 계속 포함합니다. GPU vendor OpenCL drivers는 사용자의 NVIDIA / AMD / Intel 그래픽 드라이버에서 제공됩니다.

## ภาษาไทย

### เลือกไฟล์ก่อนดาวน์โหลด

| ระบบ / การใช้งาน | ไฟล์ที่แนะนำ |
| --- | --- |
| macOS Apple Silicon | `GoMentor-0.3.12-mac-arm64.dmg` |
| macOS Intel | `GoMentor-0.3.12-mac-x64.dmg` |
| Windows x64 รุ่นมาตรฐาน แนะนำ OpenCL | `GoMentor-0.3.12-win-x64.exe` หรือ `GoMentor-0.3.12-win-x64-portable.zip` |
| Windows NVIDIA edition สำหรับ NVIDIA GPU และ CUDA | `GoMentor-0.3.12-win-x64-nvidia.exe` หรือ `GoMentor-0.3.12-win-x64-nvidia-portable.zip` |
| Checksums | `SHA256SUMS.txt` |

### สิ่งที่แก้ไข

- ประวัติของ AI teacher สามารถลบได้ และการตั้งค่าการสอนจะบันทึกกลับสู่ UI ปัจจุบันทันที
- ปุ่มคำถามด่วนจะส่งและเริ่มวิเคราะห์ทันที ไม่ใช่แค่เติมข้อความในช่องพิมพ์
- แก้ปัญหา Windows `python3 -m venv` ที่ทำให้การวิเคราะห์ทั้งเกมไม่มีผลลัพธ์ โดยเลือก `python` / `py -3` ที่ใช้งานได้และใช้ `venv\Scripts\python.exe`
- เครื่องมือ KataGo ทั้งเกมของ AI teacher ใช้เส้นทาง quick-analysis ของ GoMentor แทนรายงาน Python
- แพ็กเกจ Windows มาตรฐานยังรวม Windows OpenCL runtime bundle และ KataGo OpenCL adjacent runtime files ส่วน GPU vendor OpenCL drivers ยังมาจากไดรเวอร์ NVIDIA / AMD / Intel ของผู้ใช้

## Tiếng Việt

### Chọn đúng gói trước khi tải

| Nền tảng / nhu cầu | Tệp nên tải |
| --- | --- |
| macOS Apple Silicon | `GoMentor-0.3.12-mac-arm64.dmg` |
| macOS Intel | `GoMentor-0.3.12-mac-x64.dmg` |
| Windows x64 tiêu chuẩn, khuyến nghị OpenCL | `GoMentor-0.3.12-win-x64.exe` hoặc `GoMentor-0.3.12-win-x64-portable.zip` |
| Windows NVIDIA edition cho GPU NVIDIA và CUDA | `GoMentor-0.3.12-win-x64-nvidia.exe` hoặc `GoMentor-0.3.12-win-x64-nvidia-portable.zip` |
| Checksums | `SHA256SUMS.txt` |

### Bản sửa lỗi

- Có thể xóa phiên lịch sử của AI teacher, và thiết lập dạy học sau khi lưu sẽ cập nhật lại trạng thái UI hiện tại.
- Các nút hỏi nhanh sẽ gửi ngay và bắt đầu phân tích, không chỉ điền vào ô nhập.
- Sửa lỗi Windows `python3 -m venv` khiến phân tích toàn ván không có kết quả. Runtime nay tự chọn `python` / `py -3` khả dụng và dùng `venv\Scripts\python.exe`.
- Công cụ KataGo toàn ván của AI teacher dùng quick-analysis gốc của GoMentor thay vì đường dẫn báo cáo Python.
- Gói Windows tiêu chuẩn vẫn đi kèm Windows OpenCL runtime bundle và KataGo OpenCL adjacent runtime files. GPU vendor OpenCL drivers vẫn đến từ driver NVIDIA / AMD / Intel trên máy người dùng.

## Verification

- `pnpm test`
- `pnpm typecheck`
- `pnpm build`
- `node --test tests\teacher-agent-runtime-contract.test.mjs tests\teacher-persona-session-contract.test.mjs tests\sprint7-ui-polish-contract.test.mjs`
- Real Windows smoke: created `C:\Users\kk\.gomentor\runtime\venv`, installed `sgfmill==1.1.1`, and confirmed `sgfmill ok`.
- Manual Electron restart and user-flow retry for AI teacher analysis.

## Known Notes

- Standard Windows is the OpenCL-recommended package. If OpenCL behaves badly on a user's PC, use the Windows NVIDIA edition for NVIDIA/CUDA machines or configure a custom engine.
- Windows NVIDIA edition is intended for Windows x64 machines with NVIDIA GPUs and compatible CUDA drivers.
- Windows packages may trigger SmartScreen until the project has stronger signing reputation.
