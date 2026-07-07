# GoAgent v0.4.18

GoAgent v0.4.18 adds a cleaner territory judgement experience: one-click ownership heat, a compact board-level summary, and subtle center marks for stones that are clearly inside opposing territory. This release also keeps the v0.4.17 download policy: full Standard packages plus the Windows NVIDIA edition only.

QQ 群：1030632742，欢迎一起交流、提建议、完善 GoAgent。

## v0.4 系列延续能力

This release keeps the broader v0.4 foundation: grounded shape recognition engine, local pattern matcher, knowledge source-policy gates, optimized move-range review, quality checks and eval gates, Real Eval / engine silver fixture gate, KataGo engine pool telemetry, Release artifact smoke, student level, student age, teacher persona style settings with evidence boundary, teacher sessions, selective PR #6 integration, Tool-first Agent runtime, Kokoro selected-provider TTS with offline synthesis, Windows OpenCL runtime bundle, KataGo OpenCL adjacent runtime files, GPU vendor OpenCL drivers, and the community contribution path from layiku and wimi321.

## 中文

### 下载前先选版本

| 平台 / 场景 | 推荐下载 |
| --- | --- |
| macOS Apple Silicon（M 系列） | [GoAgent-0.4.18-mac-arm64.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.18/GoAgent-0.4.18-mac-arm64.dmg) |
| macOS Intel | [GoAgent-0.4.18-mac-x64.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.18/GoAgent-0.4.18-mac-x64.dmg) |
| Windows x64 标准版（OpenCL）免安装版，普通用户推荐 | [GoAgent-0.4.18-win-x64-portable.zip](https://github.com/wimi321/GoAgent/releases/download/v0.4.18/GoAgent-0.4.18-win-x64-portable.zip) |
| Windows x64 NVIDIA 专版（CUDA）免安装包，NVIDIA 显卡用户推荐 | [GoAgent-0.4.18-win-x64-nvidia-portable.7z](https://github.com/wimi321/GoAgent/releases/download/v0.4.18/GoAgent-0.4.18-win-x64-nvidia-portable.7z) |

### 本版重点

- 新增一键形势判断：点击后直接显示 KataGo ownership 热力，不再需要切换“热力/方块/标记”或手动加深。
- 形势判断会自动校准 ownership 黑白方向，避免因引擎输出视角差异导致黑白地盘全反。
- 对明显落在对方强势区域里的棋子，在棋子中心显示克制的小菱形提示；异常数据导致标记过多时会自动隐藏，避免把棋盘画花。
- 棋盘顶部信息更紧凑，去掉重复搜索统计和不必要按钮，保留开始/暂停分析、试下和形势判断等核心操作。
- 鼠标滚轮打谱继续可用，不会劫持设置输入框或其它表单控件。

## 繁體中文

### 下載前先選版本

| 平台 / 使用情境 | 建議下載 |
| --- | --- |
| macOS Apple Silicon | [GoAgent-0.4.18-mac-arm64.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.18/GoAgent-0.4.18-mac-arm64.dmg) |
| macOS Intel | [GoAgent-0.4.18-mac-x64.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.18/GoAgent-0.4.18-mac-x64.dmg) |
| Windows x64 Standard（OpenCL）免安裝版，一般使用者推薦 | [GoAgent-0.4.18-win-x64-portable.zip](https://github.com/wimi321/GoAgent/releases/download/v0.4.18/GoAgent-0.4.18-win-x64-portable.zip) |
| Windows x64 NVIDIA（CUDA）免安裝包，NVIDIA 顯卡使用者推薦 | [GoAgent-0.4.18-win-x64-nvidia-portable.7z](https://github.com/wimi321/GoAgent/releases/download/v0.4.18/GoAgent-0.4.18-win-x64-nvidia-portable.7z) |

### 本版重點

- 新增一鍵形勢判斷，點擊後直接顯示 KataGo ownership 熱力圖。
- 自動校準 ownership 黑白方向，降低黑白地盤顯示反向的風險。
- 對明顯落在對方強勢範圍內的棋子，在棋子中心用小菱形提示，不再使用干擾棋面的外圈標記。
- 棋盤頂部更緊湊，保留開始/暫停分析、試下與形勢判斷等核心操作。

## English

### Pick the right package before downloading

| Platform / use case | Recommended download |
| --- | --- |
| macOS Apple Silicon | [GoAgent-0.4.18-mac-arm64.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.18/GoAgent-0.4.18-mac-arm64.dmg) |
| macOS Intel | [GoAgent-0.4.18-mac-x64.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.18/GoAgent-0.4.18-mac-x64.dmg) |
| Windows x64 Standard (OpenCL) portable ZIP, recommended for most users | [GoAgent-0.4.18-win-x64-portable.zip](https://github.com/wimi321/GoAgent/releases/download/v0.4.18/GoAgent-0.4.18-win-x64-portable.zip) |
| Windows x64 NVIDIA (CUDA) portable package, recommended for NVIDIA GPUs | [GoAgent-0.4.18-win-x64-nvidia-portable.7z](https://github.com/wimi321/GoAgent/releases/download/v0.4.18/GoAgent-0.4.18-win-x64-nvidia-portable.7z) |

### Highlights

- Adds one-click territory judgement with a direct KataGo ownership heat view.
- Calibrates ownership sign against stones on the current board, reducing reversed black/white ownership displays.
- Marks stones clearly inside opposing strong territory with a small center diamond instead of a heavy ring.
- Keeps the board header compact and focused on analysis, trial play, and territory judgement.
- Mouse-wheel replay remains available without hijacking settings fields or form controls.

## 日本語

### ダウンロード前に選ぶもの

| 環境 | 推奨ファイル |
| --- | --- |
| macOS Apple Silicon | [GoAgent-0.4.18-mac-arm64.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.18/GoAgent-0.4.18-mac-arm64.dmg) |
| macOS Intel | [GoAgent-0.4.18-mac-x64.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.18/GoAgent-0.4.18-mac-x64.dmg) |
| Windows x64 Standard（OpenCL）ポータブル ZIP、通常はこちら | [GoAgent-0.4.18-win-x64-portable.zip](https://github.com/wimi321/GoAgent/releases/download/v0.4.18/GoAgent-0.4.18-win-x64-portable.zip) |
| Windows x64 NVIDIA（CUDA）ポータブル、NVIDIA GPU 向け | [GoAgent-0.4.18-win-x64-nvidia-portable.7z](https://github.com/wimi321/GoAgent/releases/download/v0.4.18/GoAgent-0.4.18-win-x64-nvidia-portable.7z) |

### 主な変更

- KataGo ownership を使ったワンクリックの形勢判断を追加しました。
- 盤上の石を基準に ownership の向きを補正し、黒白の表示反転を抑えます。
- 相手の強い勢力圏にある石は、石の中央に小さな菱形で控えめに表示します。
- 盤面上部を整理し、分析、試し打ち、形勢判断に集中できるようにしました。

## 한국어

### 다운로드 전 선택

| 환경 | 권장 다운로드 |
| --- | --- |
| macOS Apple Silicon | [GoAgent-0.4.18-mac-arm64.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.18/GoAgent-0.4.18-mac-arm64.dmg) |
| macOS Intel | [GoAgent-0.4.18-mac-x64.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.18/GoAgent-0.4.18-mac-x64.dmg) |
| Windows x64 Standard (OpenCL) 포터블 ZIP, 일반 사용자 권장 | [GoAgent-0.4.18-win-x64-portable.zip](https://github.com/wimi321/GoAgent/releases/download/v0.4.18/GoAgent-0.4.18-win-x64-portable.zip) |
| Windows x64 NVIDIA (CUDA) 포터블, NVIDIA GPU 권장 | [GoAgent-0.4.18-win-x64-nvidia-portable.7z](https://github.com/wimi321/GoAgent/releases/download/v0.4.18/GoAgent-0.4.18-win-x64-nvidia-portable.7z) |

### 이번 버전

- KataGo ownership 기반의 원클릭 형세 판단을 추가했습니다.
- 현재 보드의 돌을 기준으로 ownership 방향을 보정해 흑백 표시가 뒤집히는 문제를 줄였습니다.
- 상대의 강한 영역 안에 있는 돌은 중앙의 작은 마름모 표시로 보여 줍니다.
- 보드 상단 정보를 정리해 분석, 시험 수순, 형세 판단에 집중할 수 있게 했습니다.

## ภาษาไทย

### เลือกไฟล์ก่อนดาวน์โหลด

| แพลตฟอร์ม | ไฟล์ที่แนะนำ |
| --- | --- |
| macOS Apple Silicon | [GoAgent-0.4.18-mac-arm64.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.18/GoAgent-0.4.18-mac-arm64.dmg) |
| macOS Intel | [GoAgent-0.4.18-mac-x64.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.18/GoAgent-0.4.18-mac-x64.dmg) |
| Windows x64 Standard (OpenCL) portable ZIP, recommended for most users | [GoAgent-0.4.18-win-x64-portable.zip](https://github.com/wimi321/GoAgent/releases/download/v0.4.18/GoAgent-0.4.18-win-x64-portable.zip) |
| Windows x64 NVIDIA (CUDA) portable, recommended for NVIDIA GPUs | [GoAgent-0.4.18-win-x64-nvidia-portable.7z](https://github.com/wimi321/GoAgent/releases/download/v0.4.18/GoAgent-0.4.18-win-x64-nvidia-portable.7z) |

### จุดสำคัญของรุ่นนี้

- เพิ่มการประเมินพื้นที่ด้วยคลิกเดียวจาก KataGo ownership heat view
- ปรับทิศทาง ownership จากหมากที่อยู่บนกระดาน เพื่อลดปัญหาสีดำ/ขาวสลับกัน
- หมากที่อยู่ในพื้นที่แข็งแรงของฝ่ายตรงข้ามจะแสดงสัญลักษณ์เล็กตรงกลางเม็ดหมาก
- จัดแถบด้านบนของกระดานให้เรียบง่ายขึ้นสำหรับการวิเคราะห์ การทดลองเดิน และการประเมินพื้นที่

## Tiếng Việt

### Chọn gói tải xuống

| Nền tảng | Gói khuyến nghị |
| --- | --- |
| macOS Apple Silicon | [GoAgent-0.4.18-mac-arm64.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.18/GoAgent-0.4.18-mac-arm64.dmg) |
| macOS Intel | [GoAgent-0.4.18-mac-x64.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.18/GoAgent-0.4.18-mac-x64.dmg) |
| Windows x64 Standard (OpenCL) portable ZIP, khuyến nghị cho đa số người dùng | [GoAgent-0.4.18-win-x64-portable.zip](https://github.com/wimi321/GoAgent/releases/download/v0.4.18/GoAgent-0.4.18-win-x64-portable.zip) |
| Windows x64 NVIDIA (CUDA) portable, khuyến nghị cho GPU NVIDIA | [GoAgent-0.4.18-win-x64-nvidia-portable.7z](https://github.com/wimi321/GoAgent/releases/download/v0.4.18/GoAgent-0.4.18-win-x64-nvidia-portable.7z) |

### Điểm mới

- Thêm đánh giá lãnh thổ một lần bấm bằng KataGo ownership heat view.
- Tự hiệu chỉnh hướng ownership dựa trên quân đang có trên bàn để giảm lỗi đảo màu đen/trắng.
- Quân nằm rõ trong vùng mạnh của đối thủ được đánh dấu bằng hình thoi nhỏ ở giữa quân.
- Thanh thông tin phía trên bàn cờ gọn hơn, tập trung vào phân tích, thử nước và đánh giá lãnh thổ.
