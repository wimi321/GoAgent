# GoMentor v0.3.13

GoMentor v0.3.13 is a correctness and AI teacher control release. It fixes board reconstruction after captures, aligns all teacher-facing winrate evidence with the board display perspective, adds a real Stop action for running AI teacher sessions, refreshes manual current-move analysis more reliably, and strengthens actual-move KataGo evidence visits so the teacher has better data when explaining the move actually played. This release keeps the existing top-quality baseline: grounded shape recognition engine, local pattern matcher, knowledge source-policy gates, optimized move-range review, quality checks and eval gates, Real Eval / engine silver fixture gate, KataGo engine pool telemetry, Release artifact smoke, student level, student age, teacher persona style settings with evidence boundary, teacher sessions, and selective PR #6 integration. Windows packages continue to follow the OpenCL and NVIDIA packaging split. Thanks to layiku and wimi321.

QQ群：1030632742，欢迎一起交流、提建议、完善 GoMentor。

## 中文

### 下载前先选版本

| 平台 / 场景 | 推荐下载 |
| --- | --- |
| macOS Apple Silicon | `GoMentor-0.3.13-mac-arm64.dmg` |
| macOS Intel | `GoMentor-0.3.13-mac-x64.dmg` |
| Windows 普通版，OpenCL 推荐包 | `GoMentor-0.3.13-win-x64.exe` 或 `GoMentor-0.3.13-win-x64-portable.zip` |
| Windows NVIDIA 专版，适合 NVIDIA 显卡和 CUDA 环境 | `GoMentor-0.3.13-win-x64-nvidia.exe` 或 `GoMentor-0.3.13-win-x64-nvidia-portable.zip` |
| 校验文件 | `SHA256SUMS.txt` |

### 本版重点

- 修复棋盘吃子后的重建逻辑，避免已经被提掉的棋子仍显示在棋盘上，或重复占在禁着点附近造成错觉。
- 修复 AI 老师证据链里的胜率视角：老师默认拿到的 `winrate` / `scoreLead` 现在和棋盘候选点显示一致，同时保留 `blackWinrate` / `blackScoreLead` 作为黑棋原始视角。
- AI 老师发送后按钮会变成“停止”，可停止当前讲解、取消对应 KataGo 任务，并忽略迟到的流式输出。
- 手动分析当前手会强制刷新当前手数据，不再被旧缓存遮住。
- 实战手证据搜索更充分，减少“实战点搜索太低，证据不够稳”的情况。
- 普通 Windows 包继续包含 Windows OpenCL runtime bundle 和 KataGo OpenCL adjacent runtime files；GPU vendor OpenCL drivers 仍由用户显卡驱动提供。

## 繁體中文

### 下載前先選版本

| 平台 / 使用情境 | 建議下載 |
| --- | --- |
| macOS Apple Silicon | `GoMentor-0.3.13-mac-arm64.dmg` |
| macOS Intel | `GoMentor-0.3.13-mac-x64.dmg` |
| Windows 一般版，OpenCL 推薦包 | `GoMentor-0.3.13-win-x64.exe` 或 `GoMentor-0.3.13-win-x64-portable.zip` |
| Windows NVIDIA 專版 | `GoMentor-0.3.13-win-x64-nvidia.exe` 或 `GoMentor-0.3.13-win-x64-nvidia-portable.zip` |
| 校驗檔 | `SHA256SUMS.txt` |

### 本版重點

- 修正棋盤提子後的局面重建，避免已被提掉的棋子仍留在棋盤上。
- 修正 AI 老師證據鏈的勝率視角：老師看到的 `winrate` / `scoreLead` 會和棋盤候選點一致，並保留 `blackWinrate` / `blackScoreLead` 供黑棋原始視角查核。
- AI 老師輸出中可以按「停止」，停止目前講解、取消對應 KataGo 工作並忽略延遲回來的流式輸出。
- 手動分析目前手會強制刷新，不再被舊快取覆蓋。
- 實戰手搜尋數更充分，讓老師講解時的證據更穩。
- Windows 一般版持續包含 Windows OpenCL runtime bundle 與 KataGo OpenCL adjacent runtime files；GPU vendor OpenCL drivers 仍由使用者顯示卡驅動提供。

## English

### Pick the right package before downloading

| Platform / use case | Recommended download |
| --- | --- |
| macOS Apple Silicon | `GoMentor-0.3.13-mac-arm64.dmg` |
| macOS Intel | `GoMentor-0.3.13-mac-x64.dmg` |
| Standard Windows x64, OpenCL recommended | `GoMentor-0.3.13-win-x64.exe` or `GoMentor-0.3.13-win-x64-portable.zip` |
| Windows NVIDIA edition for NVIDIA GPUs and CUDA runtimes | `GoMentor-0.3.13-win-x64-nvidia.exe` or `GoMentor-0.3.13-win-x64-nvidia-portable.zip` |
| Checksums | `SHA256SUMS.txt` |

### Why update

- Fixes board reconstruction after captures, so captured stones no longer remain visually on the board.
- Aligns AI teacher winrate evidence with the board display perspective. Teacher-visible `winrate` / `scoreLead` now match board overlays, while `blackWinrate` / `blackScoreLead` preserve the raw black perspective.
- Adds a real Stop button while the AI teacher is running. It cancels the teacher run, cancels matching KataGo work, and ignores late streaming output.
- Manual current-move analysis now refreshes the current move instead of being hidden by stale cache.
- Strengthens actual-move evidence visits, making explanations of the played move more reliable.
- Standard Windows still includes the Windows OpenCL runtime bundle and KataGo OpenCL adjacent runtime files; GPU vendor OpenCL drivers still come from the user's NVIDIA, AMD, or Intel driver.

## 日本語

### ダウンロード前に選ぶもの

| 環境 | 推奨ファイル |
| --- | --- |
| macOS Apple Silicon | `GoMentor-0.3.13-mac-arm64.dmg` |
| macOS Intel | `GoMentor-0.3.13-mac-x64.dmg` |
| Windows 標準版、OpenCL 推奨 | `GoMentor-0.3.13-win-x64.exe` または `GoMentor-0.3.13-win-x64-portable.zip` |
| NVIDIA GPU / CUDA 向け Windows NVIDIA 版 | `GoMentor-0.3.13-win-x64-nvidia.exe` または `GoMentor-0.3.13-win-x64-nvidia-portable.zip` |
| チェックサム | `SHA256SUMS.txt` |

### 主な修正

- 石を取った後の盤面再構築を修正し、取られた石が盤上に残って見える問題を防ぎます。
- AI teacher の勝率証拠を盤面表示の視点に統一しました。`winrate` / `scoreLead` は盤面候補手と一致し、`blackWinrate` / `blackScoreLead` は黒視点の監査用として残します。
- AI teacher の実行中に「停止」ボタンを表示し、講解・KataGo 作業・遅延ストリーム出力を止められます。
- 現在手の手動分析は古いキャッシュに隠れず、現在手を更新します。
- 実戦手の探索証拠を強化し、講解の安定性を上げました。
- Windows 標準版は Windows OpenCL runtime bundle と KataGo OpenCL adjacent runtime files を引き続き同梱します。GPU vendor OpenCL drivers は NVIDIA / AMD / Intel のドライバーから提供されます。

## 한국어

### 다운로드 전 선택 가이드

| 환경 | 권장 다운로드 |
| --- | --- |
| macOS Apple Silicon | `GoMentor-0.3.13-mac-arm64.dmg` |
| macOS Intel | `GoMentor-0.3.13-mac-x64.dmg` |
| Windows 표준 x64, OpenCL 권장 | `GoMentor-0.3.13-win-x64.exe` 또는 `GoMentor-0.3.13-win-x64-portable.zip` |
| NVIDIA GPU / CUDA용 Windows NVIDIA 에디션 | `GoMentor-0.3.13-win-x64-nvidia.exe` 또는 `GoMentor-0.3.13-win-x64-nvidia-portable.zip` |
| 체크섬 | `SHA256SUMS.txt` |

### 핵심 수정

- 잡힌 돌이 보드에 계속 남아 보이지 않도록 착수와 포획 후 보드 재구성 로직을 수정했습니다.
- AI teacher가 받는 승률 증거를 보드 표시 관점과 맞췄습니다. `winrate` / `scoreLead`는 보드 오버레이와 일치하고, `blackWinrate` / `blackScoreLead`는 흑 관점 원본 값으로 보존합니다.
- AI teacher 실행 중에는 “중지” 버튼이 표시되어 현재 설명, 연결된 KataGo 작업, 늦게 도착하는 스트리밍 출력을 멈출 수 있습니다.
- 현재 수동 분석은 오래된 캐시에 가려지지 않고 현재 수를 새로 분석합니다.
- 실전 수에 대한 탐색 증거를 강화해 설명 안정성을 높였습니다.
- Windows 표준 패키지는 Windows OpenCL runtime bundle과 KataGo OpenCL adjacent runtime files를 계속 포함합니다. GPU vendor OpenCL drivers는 사용자의 NVIDIA / AMD / Intel 그래픽 드라이버에서 제공됩니다.

## ภาษาไทย

### เลือกไฟล์ก่อนดาวน์โหลด

| ระบบ / การใช้งาน | ไฟล์ที่แนะนำ |
| --- | --- |
| macOS Apple Silicon | `GoMentor-0.3.13-mac-arm64.dmg` |
| macOS Intel | `GoMentor-0.3.13-mac-x64.dmg` |
| Windows x64 รุ่นมาตรฐาน แนะนำ OpenCL | `GoMentor-0.3.13-win-x64.exe` หรือ `GoMentor-0.3.13-win-x64-portable.zip` |
| Windows NVIDIA edition สำหรับ NVIDIA GPU และ CUDA | `GoMentor-0.3.13-win-x64-nvidia.exe` หรือ `GoMentor-0.3.13-win-x64-nvidia-portable.zip` |
| Checksums | `SHA256SUMS.txt` |

### สิ่งที่แก้ไข

- แก้การสร้างกระดานหลังการจับหมาก เพื่อไม่ให้หมากที่ถูกจับแล้วยังคงแสดงอยู่บนกระดาน
- ปรับหลักฐาน winrate ที่ AI teacher ใช้ให้ตรงกับมุมมองบนกระดาน ค่า `winrate` / `scoreLead` จะตรงกับ overlay ส่วน `blackWinrate` / `blackScoreLead` เก็บค่าเดิมจากมุมมองดำไว้ตรวจสอบ
- เพิ่มปุ่ม Stop ระหว่าง AI teacher กำลังทำงาน เพื่อหยุดคำอธิบาย ยกเลิกงาน KataGo และละทิ้งข้อความ stream ที่มาช้า
- การวิเคราะห์มือปัจจุบันแบบ manual จะ refresh มือปัจจุบัน ไม่ถูก cache เก่าบัง
- เพิ่ม visits สำหรับหลักฐานของมือที่เล่นจริง เพื่อให้คำอธิบายมั่นคงขึ้น
- แพ็กเกจ Windows มาตรฐานยังรวม Windows OpenCL runtime bundle และ KataGo OpenCL adjacent runtime files ส่วน GPU vendor OpenCL drivers ยังมาจากไดรเวอร์ NVIDIA / AMD / Intel ของผู้ใช้

## Tiếng Việt

### Chọn đúng gói trước khi tải

| Nền tảng / nhu cầu | Tệp nên tải |
| --- | --- |
| macOS Apple Silicon | `GoMentor-0.3.13-mac-arm64.dmg` |
| macOS Intel | `GoMentor-0.3.13-mac-x64.dmg` |
| Windows x64 tiêu chuẩn, khuyến nghị OpenCL | `GoMentor-0.3.13-win-x64.exe` hoặc `GoMentor-0.3.13-win-x64-portable.zip` |
| Windows NVIDIA edition cho GPU NVIDIA và CUDA | `GoMentor-0.3.13-win-x64-nvidia.exe` hoặc `GoMentor-0.3.13-win-x64-nvidia-portable.zip` |
| Checksums | `SHA256SUMS.txt` |

### Bản sửa lỗi

- Sửa logic dựng lại bàn cờ sau khi bắt quân, tránh việc quân đã bị bắt vẫn còn hiển thị.
- Đồng bộ góc nhìn winrate trong bằng chứng của AI teacher với hiển thị trên bàn cờ. `winrate` / `scoreLead` khớp overlay, còn `blackWinrate` / `blackScoreLead` giữ giá trị gốc theo góc nhìn Đen.
- Thêm nút Stop khi AI teacher đang chạy để dừng lượt giải thích, hủy tác vụ KataGo liên quan và bỏ qua output stream đến muộn.
- Phân tích thủ công nước hiện tại sẽ refresh nước đó thay vì bị cache cũ che mất.
- Tăng visits cho bằng chứng của nước thực chiến để phần giải thích ổn định hơn.
- Gói Windows tiêu chuẩn vẫn đi kèm Windows OpenCL runtime bundle và KataGo OpenCL adjacent runtime files. GPU vendor OpenCL drivers vẫn đến từ driver NVIDIA / AMD / Intel trên máy người dùng.

## Verification

- `corepack pnpm test`：107/107 passed.
- `corepack pnpm typecheck`：passed.
- `corepack pnpm build`：passed.
- `git diff --check`：passed.
- Manual Electron restart for local user testing.

## Known Notes

- Standard Windows is the OpenCL-recommended package. If OpenCL behaves badly on a user's PC, use the Windows NVIDIA edition for NVIDIA/CUDA machines or configure a custom engine.
- Windows NVIDIA edition is intended for Windows x64 machines with NVIDIA GPUs and compatible CUDA drivers.
- Windows packages may trigger SmartScreen until the project has stronger signing reputation.
