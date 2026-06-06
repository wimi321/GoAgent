# GoAgent v0.4.11

GoAgent v0.4.11 adds the first version of the “try move” experience: you can temporarily place stones on the board, explore a branch without changing the original SGF, let KataGo analyze that branch, and ask the AI teacher about the trial position.

QQ 群：1030632742，欢迎一起交流、提建议、完善 GoAgent。

## v0.4 系列延续能力

This release keeps the broader v0.4 foundation: grounded shape recognition engine, local pattern matcher, knowledge source-policy gates, optimized move-range review, quality checks and eval gates, Real Eval / engine silver fixture gate, KataGo engine pool telemetry, Release artifact smoke, student level, student age, teacher persona style settings with evidence boundary, teacher sessions, selective PR #6 integration, Kokoro selected-provider TTS with offline synthesis, Windows OpenCL runtime bundle, KataGo OpenCL adjacent runtime files, GPU vendor OpenCL drivers, and the community contribution path from layiku and wimi321.

## 中文

### 下载前先选版本

| 平台 / 场景 | 推荐下载 |
| --- | --- |
| macOS Apple Silicon（M 系列） | GoAgent-0.4.11-mac-arm64.dmg |
| macOS Intel | GoAgent-0.4.11-mac-x64.dmg |
| Windows x64 安装版，普通用户推荐 | GoAgent-0.4.11-win-x64.exe |
| Windows x64 免安装版 | GoAgent-0.4.11-win-x64-portable.zip |
| Windows x64 NVIDIA 专版安装版 | GoAgent-0.4.11-win-x64-nvidia.exe |
| Windows x64 NVIDIA 专版免安装包 | GoAgent-0.4.11-win-x64-nvidia-portable.7z.001 and all following split parts |
| 校验文件 | SHA256SUMS.txt |

### 本版重点

- 新增“试下”模式：在棋盘任意空点临时落子，形成不污染原棋谱的变化分支。
- 试下分支支持撤销、清空、退出；退出后会恢复原主线局面和主线分析。
- 试下棋子会用克制的描边和序号标记，和实战主线区分开。
- KataGo 会跟随试下分支分析候选点、胜率、目差和 PV，不会污染主线胜率图。
- 老师讲解会明确区分“实战主线”和“试下分支”，避免把试下变化说成棋谱事实。
- 当前手讲解、自由提问和棋盘截图工具在试下模式下会使用试下局面。

### 使用方式

- 点击棋盘上方的“试下”进入试下模式。
- 在棋盘空交叉点点击即可临时落子。
- 右键、Backspace 或“撤销”可以退回一步。
- “清空”会保留试下模式但清除临时手顺。
- Esc 或“恢复”会退出试下并回到实战主线。

## 繁體中文

### 下載前先選版本

| 平台 / 使用情境 | 建議下載 |
| --- | --- |
| macOS Apple Silicon | GoAgent-0.4.11-mac-arm64.dmg |
| macOS Intel | GoAgent-0.4.11-mac-x64.dmg |
| Windows x64 安裝版 | GoAgent-0.4.11-win-x64.exe |
| Windows x64 免安裝版 | GoAgent-0.4.11-win-x64-portable.zip |
| Windows x64 NVIDIA 專版 | GoAgent-0.4.11-win-x64-nvidia.exe |
| Windows x64 NVIDIA 免安裝包 | GoAgent-0.4.11-win-x64-nvidia-portable.7z.001 and all following split parts |
| 校驗檔 | SHA256SUMS.txt |

### 本版重點

- 新增「試下」模式，可在棋盤任意空點臨時落子，探索不污染原棋譜的變化分支。
- 試下分支支援撤銷、清空與退出，退出後回到實戰主線。
- KataGo 會跟隨試下分支分析候選點、勝率、目差與 PV，主線勝率圖不受影響。
- 老師講解會明確區分「實戰主線」與「試下分支」。

## English

### Pick the right package before downloading

| Platform / use case | Recommended download |
| --- | --- |
| macOS Apple Silicon | GoAgent-0.4.11-mac-arm64.dmg |
| macOS Intel | GoAgent-0.4.11-mac-x64.dmg |
| Windows x64 installer | GoAgent-0.4.11-win-x64.exe |
| Windows x64 portable ZIP | GoAgent-0.4.11-win-x64-portable.zip |
| Windows x64 NVIDIA installer | GoAgent-0.4.11-win-x64-nvidia.exe |
| Windows x64 NVIDIA portable package | GoAgent-0.4.11-win-x64-nvidia-portable.7z.001 and all following split parts |
| Checksums | SHA256SUMS.txt |

### Highlights

- Adds a temporary try-move mode for exploring variations without modifying the original SGF.
- Trial branches support undo, clear and exit.
- Trial stones are visually separated from mainline stones with subtle outlines and move badges.
- KataGo analysis follows the trial branch while keeping mainline winrate data untouched.
- The AI teacher now receives explicit trial-branch context and explains it as “if you play here” instead of treating it as the real game.
- Current-move teaching, freeform questions and board screenshots can use the trial position while the mode is active.

### How to use

- Click “试下” above the board.
- Click an empty intersection to place a temporary stone.
- Right-click, press Backspace, or click “撤销” to undo.
- Click “清空” to clear temporary moves while staying in trial mode.
- Press Esc or click “恢复” to exit trial mode.

## 日本語

### ダウンロード前に選ぶもの

| 環境 | 推奨ファイル |
| --- | --- |
| macOS Apple Silicon | GoAgent-0.4.11-mac-arm64.dmg |
| macOS Intel | GoAgent-0.4.11-mac-x64.dmg |
| Windows x64 インストーラー | GoAgent-0.4.11-win-x64.exe |
| Windows x64 ポータブル ZIP | GoAgent-0.4.11-win-x64-portable.zip |
| Windows x64 NVIDIA 版 | GoAgent-0.4.11-win-x64-nvidia.exe |
| Windows x64 NVIDIA ポータブル | GoAgent-0.4.11-win-x64-nvidia-portable.7z.001 and all following split parts |
| チェックサム | SHA256SUMS.txt |

### 主な変更

- 元の SGF を変更せずに変化を試せる「試下」モードを追加しました。
- 試下分岐は取り消し、クリア、終了に対応します。
- KataGo 分析と AI 教師の説明は試下局面を明示的に扱います。

## 한국어

### 다운로드 전 선택

| 환경 | 권장 다운로드 |
| --- | --- |
| macOS Apple Silicon | GoAgent-0.4.11-mac-arm64.dmg |
| macOS Intel | GoAgent-0.4.11-mac-x64.dmg |
| Windows x64 설치 프로그램 | GoAgent-0.4.11-win-x64.exe |
| Windows x64 포터블 ZIP | GoAgent-0.4.11-win-x64-portable.zip |
| Windows x64 NVIDIA 설치 프로그램 | GoAgent-0.4.11-win-x64-nvidia.exe |
| Windows x64 NVIDIA 포터블 | GoAgent-0.4.11-win-x64-nvidia-portable.7z.001 and all following split parts |
| 체크섬 | SHA256SUMS.txt |

### 이번 버전

- 원본 SGF를 바꾸지 않고 변화를 둘 수 있는 try-move 모드를 추가했습니다.
- 임시 분기는 되돌리기, 비우기, 종료를 지원합니다.
- KataGo 분석과 AI 선생님의 설명은 실전 주선과 시험 변화를 명확히 구분합니다.

## ภาษาไทย

### เลือกไฟล์ก่อนดาวน์โหลด

| แพลตฟอร์ม | ไฟล์ที่แนะนำ |
| --- | --- |
| macOS Apple Silicon | GoAgent-0.4.11-mac-arm64.dmg |
| macOS Intel | GoAgent-0.4.11-mac-x64.dmg |
| Windows x64 installer | GoAgent-0.4.11-win-x64.exe |
| Windows x64 portable ZIP | GoAgent-0.4.11-win-x64-portable.zip |
| Windows x64 NVIDIA installer | GoAgent-0.4.11-win-x64-nvidia.exe |
| Windows x64 NVIDIA portable | GoAgent-0.4.11-win-x64-nvidia-portable.7z.001 and all following split parts |
| Checksums | SHA256SUMS.txt |

### จุดสำคัญของรุ่นนี้

- เพิ่มโหมดทดลองเดิน เพื่อวางหมากชั่วคราวโดยไม่แก้ SGF เดิม
- รองรับ undo, clear และ exit สำหรับกิ่งทดลอง
- KataGo และครู AI จะแยกกิ่งทดลองออกจากเกมจริงอย่างชัดเจน

## Tiếng Việt

### Chọn gói tải xuống

| Nền tảng | Gói khuyến nghị |
| --- | --- |
| macOS Apple Silicon | GoAgent-0.4.11-mac-arm64.dmg |
| macOS Intel | GoAgent-0.4.11-mac-x64.dmg |
| Windows x64 installer | GoAgent-0.4.11-win-x64.exe |
| Windows x64 portable ZIP | GoAgent-0.4.11-win-x64-portable.zip |
| Windows x64 NVIDIA installer | GoAgent-0.4.11-win-x64-nvidia.exe |
| Windows x64 NVIDIA portable | GoAgent-0.4.11-win-x64-nvidia-portable.7z.001 and all following split parts |
| Checksums | SHA256SUMS.txt |

### Điểm mới

- Thêm chế độ thử nước đi để đặt quân tạm thời mà không sửa SGF gốc.
- Nhánh thử hỗ trợ hoàn tác, xoá và thoát.
- KataGo và giáo viên AI phân biệt rõ nhánh thử với ván chính.
