# GoMentor v0.3.14

GoMentor v0.3.14 turns the AI teacher answer into an interactive review surface. When the teacher mentions a move number, such as “第 128 手” or “Move 128”, the text can jump the game record to that move. When the teacher mentions a board coordinate, such as `D4` or `Q16`, the board flashes that point with a polished visual marker so users can immediately see what the explanation refers to.

QQ群：1030632742，欢迎一起交流、提建议、完善 GoMentor。

## 中文

### 下载前先选版本

| 平台 / 场景 | 推荐下载 |
| --- | --- |
| macOS Apple Silicon | `GoMentor-0.3.14-mac-arm64.dmg` |
| macOS Intel | `GoMentor-0.3.14-mac-x64.dmg` |
| Windows 普通版，OpenCL 推荐包 | `GoMentor-0.3.14-win-x64.exe` 或 `GoMentor-0.3.14-win-x64-portable.zip` |
| Windows NVIDIA 专版，适合 NVIDIA 显卡和 CUDA 环境 | `GoMentor-0.3.14-win-x64-nvidia.exe` 或 `GoMentor-0.3.14-win-x64-nvidia-portable.zip` |
| 校验文件 | `SHA256SUMS.txt` |

### 本版重点

- 老师回复里的“第 N 手 / N 手 / Move N”可以点击，棋谱会快速跳到对应手数。
- 老师回复里的棋盘坐标可以点击，棋盘会用轻量闪烁标记提示对应位置。
- 坐标点击不会打断当前分析，也不会把棋盘变成调试覆盖层。
- 保留多语言 UI、官方 KataGo 权重选择、AI 老师会话、真实评测和持久 KataGo engine pool 能力。

## 繁體中文

### 下載前先選版本

| 平台 / 使用情境 | 建議下載 |
| --- | --- |
| macOS Apple Silicon | `GoMentor-0.3.14-mac-arm64.dmg` |
| macOS Intel | `GoMentor-0.3.14-mac-x64.dmg` |
| Windows 一般版，OpenCL 推薦包 | `GoMentor-0.3.14-win-x64.exe` 或 `GoMentor-0.3.14-win-x64-portable.zip` |
| Windows NVIDIA 專版 | `GoMentor-0.3.14-win-x64-nvidia.exe` 或 `GoMentor-0.3.14-win-x64-nvidia-portable.zip` |
| 校驗檔 | `SHA256SUMS.txt` |

### 本版重點

- 老師回覆中的「第 N 手 / N 手 / Move N」可以點擊，棋譜會快速跳到對應手數。
- 老師回覆中的棋盤座標可以點擊，棋盤會以輕量閃爍標記提示位置。
- 座標提示不會中斷目前分析，也不會讓棋盤變成除錯覆蓋層。
- 保留多語 UI、官方 KataGo 權重選擇、AI 老師會話、真實評測與持久 KataGo engine pool 能力。

## English

### Pick the right package before downloading

| Platform / use case | Recommended download |
| --- | --- |
| macOS Apple Silicon | `GoMentor-0.3.14-mac-arm64.dmg` |
| macOS Intel | `GoMentor-0.3.14-mac-x64.dmg` |
| Standard Windows x64, OpenCL recommended | `GoMentor-0.3.14-win-x64.exe` or `GoMentor-0.3.14-win-x64-portable.zip` |
| Windows NVIDIA edition for NVIDIA GPUs and CUDA runtimes | `GoMentor-0.3.14-win-x64-nvidia.exe` or `GoMentor-0.3.14-win-x64-nvidia-portable.zip` |
| Checksums | `SHA256SUMS.txt` |

### Why update

- Teacher replies now make move references clickable. “Move 128” jumps the game record to that move.
- Coordinate references such as `D4` or `Q16` are clickable and flash the matching point on the board.
- The marker is designed as a subtle review aid, not a debug overlay, and does not interrupt analysis.
- Keeps full multilingual UI, official KataGo model selection, teacher sessions, real eval, and the persistent KataGo engine pool path.

## 日本語

### ダウンロード前に選ぶもの

| 環境 | 推奨ファイル |
| --- | --- |
| macOS Apple Silicon | `GoMentor-0.3.14-mac-arm64.dmg` |
| macOS Intel | `GoMentor-0.3.14-mac-x64.dmg` |
| Windows 標準版、OpenCL 推奨 | `GoMentor-0.3.14-win-x64.exe` または `GoMentor-0.3.14-win-x64-portable.zip` |
| NVIDIA GPU / CUDA 向け Windows NVIDIA 版 | `GoMentor-0.3.14-win-x64-nvidia.exe` または `GoMentor-0.3.14-win-x64-nvidia-portable.zip` |
| チェックサム | `SHA256SUMS.txt` |

### 主な変更

- 先生の回答にある「128手目」や “Move 128” をクリックすると、その手に移動できます。
- `D4` や `Q16` のような座標をクリックすると、盤上でその点が自然に点滅します。
- 座標マーカーは控えめな検討補助で、解析を中断しません。

## 한국어

### 다운로드 전 선택

| 환경 | 권장 다운로드 |
| --- | --- |
| macOS Apple Silicon | `GoMentor-0.3.14-mac-arm64.dmg` |
| macOS Intel | `GoMentor-0.3.14-mac-x64.dmg` |
| Windows 표준 x64, OpenCL 권장 | `GoMentor-0.3.14-win-x64.exe` 또는 `GoMentor-0.3.14-win-x64-portable.zip` |
| NVIDIA GPU / CUDA용 Windows NVIDIA 에디션 | `GoMentor-0.3.14-win-x64-nvidia.exe` 또는 `GoMentor-0.3.14-win-x64-nvidia-portable.zip` |
| 체크섬 | `SHA256SUMS.txt` |

### 이번 버전

- 선생님 답변의 “Move 128” 같은 수순 표현을 클릭하면 해당 수로 이동합니다.
- `D4`, `Q16` 같은 좌표를 클릭하면 보드에서 해당 지점을 깔끔하게 강조합니다.
- 좌표 강조는 분석을 방해하지 않는 가벼운 리뷰 보조 기능입니다.

## ภาษาไทย

### เลือกไฟล์ก่อนดาวน์โหลด

| แพลตฟอร์ม | ไฟล์ที่แนะนำ |
| --- | --- |
| macOS Apple Silicon | `GoMentor-0.3.14-mac-arm64.dmg` |
| macOS Intel | `GoMentor-0.3.14-mac-x64.dmg` |
| Windows x64 มาตรฐาน แนะนำ OpenCL | `GoMentor-0.3.14-win-x64.exe` หรือ `GoMentor-0.3.14-win-x64-portable.zip` |
| Windows NVIDIA edition สำหรับ NVIDIA GPU และ CUDA | `GoMentor-0.3.14-win-x64-nvidia.exe` หรือ `GoMentor-0.3.14-win-x64-nvidia-portable.zip` |
| Checksums | `SHA256SUMS.txt` |

### จุดสำคัญของรุ่นนี้

- ข้อความของ AI ครูที่พูดถึงหมายเลขมือ เช่น “Move 128” สามารถคลิกเพื่อไปยังมือนั้นได้
- พิกัดเช่น `D4` หรือ `Q16` สามารถคลิกเพื่อให้กระดานไฮไลต์ตำแหน่งนั้น
- เอฟเฟกต์ถูกออกแบบให้สุภาพ ไม่รบกวนการวิเคราะห์

## Tiếng Việt

### Chọn gói tải xuống

| Nền tảng | Gói khuyến nghị |
| --- | --- |
| macOS Apple Silicon | `GoMentor-0.3.14-mac-arm64.dmg` |
| macOS Intel | `GoMentor-0.3.14-mac-x64.dmg` |
| Windows x64 tiêu chuẩn, khuyến nghị OpenCL | `GoMentor-0.3.14-win-x64.exe` hoặc `GoMentor-0.3.14-win-x64-portable.zip` |
| Windows NVIDIA edition cho GPU NVIDIA và CUDA | `GoMentor-0.3.14-win-x64-nvidia.exe` hoặc `GoMentor-0.3.14-win-x64-nvidia-portable.zip` |
| Checksums | `SHA256SUMS.txt` |

### Điểm mới

- Câu trả lời của AI teacher có thể nhảy tới nước được nhắc tới, ví dụ “Move 128”.
- Tọa độ như `D4` hoặc `Q16` có thể bấm để nhấp nháy vị trí đó trên bàn cờ.
- Hiệu ứng nhẹ, dùng để tra cứu nhanh khi đọc bài giảng và không làm gián đoạn phân tích.

## Quality baseline

This release keeps the existing top-quality baseline: grounded shape recognition engine, local pattern matcher, knowledge source-policy gates, optimized move-range review, quality checks and eval gates, Real Eval / engine silver fixture gate, KataGo engine pool telemetry, Release artifact smoke, student level, student age, teacher persona style settings with evidence boundary, teacher sessions, and selective PR #6 integration.

Windows packages continue to follow the OpenCL and NVIDIA split. The standard Windows package includes the Windows OpenCL runtime bundle and KataGo OpenCL adjacent runtime files; GPU vendor OpenCL drivers still come from the user's NVIDIA / AMD / Intel graphics driver.

Thanks to layiku and wimi321.
