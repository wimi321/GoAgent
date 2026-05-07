# GoAgent v0.3.14-dev.3

GoAgent v0.3.14-dev.3 is a development hotfix for full-game KataGo analysis reliability. It changes the teacher's full-game review path to use a faster whole-game sweep, refine only the strongest suspected mistake points, pause competing quick graph analysis, and return usable partial KataGo batches instead of waiting until timeout when a few positions are slow. This release keeps the v0.3.14-dev.2 development baseline: real local KataGo + LLM teaching evaluation, opt-in persistent KataGo analysis engine, spawn fallback, grounded shape recognition engine, local pattern matcher, knowledge source-policy gates, optimized move-range review, quality checks and eval gates, Real Eval / engine silver fixture gate, KataGo engine pool telemetry, Release artifact smoke, student level, student age, teacher persona style settings with evidence boundary, teacher sessions, and selective PR #6 integration. Windows packages continue to include the Windows OpenCL runtime bundle and KataGo OpenCL adjacent runtime files; GPU vendor OpenCL drivers still come from the user's GPU driver. Thanks to layiku and wimi321.

QQ群：1030632742，欢迎一起交流、提建议、完善 GoAgent。

## 中文

### 下载前先选版本

| 平台 / 场景 | 推荐下载 |
| --- | --- |
| macOS Apple Silicon | `GoAgent-0.3.14-dev.3-mac-arm64.dmg` |
| macOS Intel | `GoAgent-0.3.14-dev.3-mac-x64.dmg` |
| Windows 普通版，OpenCL 推荐包 | `GoAgent-0.3.14-dev.3-win-x64.exe` 或 `GoAgent-0.3.14-dev.3-win-x64-portable.zip` |
| Windows NVIDIA 专版，适合 NVIDIA 显卡和 CUDA 环境 | `GoAgent-0.3.14-dev.3-win-x64-nvidia.exe` 或 `GoAgent-0.3.14-dev.3-win-x64-nvidia-portable.zip` |
| 校验文件 | `SHA256SUMS.txt` |

### 本版重点

- 修复老师侧 `KataGo 整盘分析` 容易超时的问题。
- 整盘复盘改为轻量快扫全盘，再精读少数关键问题手，避免每手都走高成本 forced 查询。
- 老师整盘任务会暂停后台快速胜率图，减少 KataGo 任务互相抢算力。
- 批量分析遇到少数慢响应时会返回已完成结果，避免一直等到失败。

## 繁體中文

### 下載前先選版本

| 平台 / 使用情境 | 建議下載 |
| --- | --- |
| macOS Apple Silicon | `GoAgent-0.3.14-dev.3-mac-arm64.dmg` |
| macOS Intel | `GoAgent-0.3.14-dev.3-mac-x64.dmg` |
| Windows 一般版，OpenCL 推薦包 | `GoAgent-0.3.14-dev.3-win-x64.exe` 或 `GoAgent-0.3.14-dev.3-win-x64-portable.zip` |
| Windows NVIDIA 專版 | `GoAgent-0.3.14-dev.3-win-x64-nvidia.exe` 或 `GoAgent-0.3.14-dev.3-win-x64-nvidia-portable.zip` |
| 校驗檔 | `SHA256SUMS.txt` |

### 本版重點

- 修正老師側 `KataGo 整盤分析` 容易逾時的問題。
- 整盤復盤改為先快速掃全局，再精讀少數關鍵問題手。
- 老師整盤任務會暫停背景快速勝率圖，避免 KataGo 任務互相搶資源。
- 批次分析遇到少數慢回應時會返回已完成結果，不再等到整體失敗。

## English

### Pick the right package before downloading

| Platform / use case | Recommended download |
| --- | --- |
| macOS Apple Silicon | `GoAgent-0.3.14-dev.3-mac-arm64.dmg` |
| macOS Intel | `GoAgent-0.3.14-dev.3-mac-x64.dmg` |
| Standard Windows x64, OpenCL recommended | `GoAgent-0.3.14-dev.3-win-x64.exe` or `GoAgent-0.3.14-dev.3-win-x64-portable.zip` |
| Windows NVIDIA edition for NVIDIA GPUs and CUDA runtimes | `GoAgent-0.3.14-dev.3-win-x64-nvidia.exe` or `GoAgent-0.3.14-dev.3-win-x64-nvidia-portable.zip` |
| Checksums | `SHA256SUMS.txt` |

### Why update

- Fixes full-game `KataGo analysis` timeouts in the AI teacher tool path.
- Full-game review now does a light whole-game sweep first, then refines only the strongest suspected mistakes.
- Teacher full-game tasks pause the background quick winrate graph so KataGo capacity goes to the review.
- Batch analysis can return usable completed positions when a few KataGo responses are slow, instead of failing the whole tool call.

## 日本語

### ダウンロード前に選ぶもの

| 環境 | 推奨ファイル |
| --- | --- |
| macOS Apple Silicon | `GoAgent-0.3.14-dev.3-mac-arm64.dmg` |
| macOS Intel | `GoAgent-0.3.14-dev.3-mac-x64.dmg` |
| Windows 標準版、OpenCL 推奨 | `GoAgent-0.3.14-dev.3-win-x64.exe` または `GoAgent-0.3.14-dev.3-win-x64-portable.zip` |
| NVIDIA GPU / CUDA 向け Windows NVIDIA 版 | `GoAgent-0.3.14-dev.3-win-x64-nvidia.exe` または `GoAgent-0.3.14-dev.3-win-x64-nvidia-portable.zip` |
| チェックサム | `SHA256SUMS.txt` |

### 主な変更

- AI 教師の全局 `KataGo analysis` がタイムアウトしやすい問題を修正しました。
- 全局レビューは軽量な全局スイープを先に行い、重要な疑問手だけを精読します。
- 全局レビュー中は背景の高速勝率グラフ解析を止め、KataGo の計算資源をレビューに回します。
- 一部の応答が遅い場合も、取得済みの解析結果を使って処理を継続します。

## 한국어

### 다운로드 전 선택

| 환경 | 권장 다운로드 |
| --- | --- |
| macOS Apple Silicon | `GoAgent-0.3.14-dev.3-mac-arm64.dmg` |
| macOS Intel | `GoAgent-0.3.14-dev.3-mac-x64.dmg` |
| Windows 표준 x64, OpenCL 권장 | `GoAgent-0.3.14-dev.3-win-x64.exe` 또는 `GoAgent-0.3.14-dev.3-win-x64-portable.zip` |
| NVIDIA GPU / CUDA용 Windows NVIDIA 에디션 | `GoAgent-0.3.14-dev.3-win-x64-nvidia.exe` 또는 `GoAgent-0.3.14-dev.3-win-x64-nvidia-portable.zip` |
| 체크섬 | `SHA256SUMS.txt` |

### 이번 버전

- AI 교사의 전체 대국 `KataGo analysis`가 시간 초과되기 쉬운 문제를 수정했습니다.
- 전체 복기는 먼저 가벼운 전역 스윕을 실행하고, 중요한 문제 수만 정밀 분석합니다.
- 전체 복기 중에는 배경 빠른 승률 그래프 분석을 멈춰 KataGo 자원을 복기에 집중합니다.
- 일부 응답이 느려도 이미 완료된 분석 결과를 사용해 전체 도구 호출 실패를 줄입니다.

## ภาษาไทย

### เลือกไฟล์ก่อนดาวน์โหลด

| แพลตฟอร์ม | ไฟล์ที่แนะนำ |
| --- | --- |
| macOS Apple Silicon | `GoAgent-0.3.14-dev.3-mac-arm64.dmg` |
| macOS Intel | `GoAgent-0.3.14-dev.3-mac-x64.dmg` |
| Windows x64 มาตรฐาน แนะนำ OpenCL | `GoAgent-0.3.14-dev.3-win-x64.exe` หรือ `GoAgent-0.3.14-dev.3-win-x64-portable.zip` |
| Windows NVIDIA edition สำหรับ NVIDIA GPU และ CUDA | `GoAgent-0.3.14-dev.3-win-x64-nvidia.exe` หรือ `GoAgent-0.3.14-dev.3-win-x64-nvidia-portable.zip` |
| Checksums | `SHA256SUMS.txt` |

### จุดสำคัญของรุ่นนี้

- แก้ปัญหาเครื่องมือครู AI `KataGo analysis` แบบทั้งเกมที่หมดเวลาได้ง่าย
- รีวิวทั้งเกมจะสแกนทั้งกระดานแบบเบาก่อน แล้วจึงวิเคราะห์ลึกเฉพาะจุดที่น่าสงสัยที่สุด
- ขณะรีวิวทั้งเกม ระบบจะพักกราฟ winrate แบบเร็วด้านหลัง เพื่อลดการแย่งทรัพยากร KataGo
- หากบางตำแหน่งตอบช้า ระบบจะใช้ผลที่เสร็จแล้วต่อ แทนที่จะรอจนล้มเหลวทั้งหมด

## Tiếng Việt

### Chọn gói tải xuống

| Nền tảng | Gói khuyến nghị |
| --- | --- |
| macOS Apple Silicon | `GoAgent-0.3.14-dev.3-mac-arm64.dmg` |
| macOS Intel | `GoAgent-0.3.14-dev.3-mac-x64.dmg` |
| Windows x64 tiêu chuẩn, khuyến nghị OpenCL | `GoAgent-0.3.14-dev.3-win-x64.exe` hoặc `GoAgent-0.3.14-dev.3-win-x64-portable.zip` |
| Windows NVIDIA edition cho GPU NVIDIA và CUDA | `GoAgent-0.3.14-dev.3-win-x64-nvidia.exe` hoặc `GoAgent-0.3.14-dev.3-win-x64-nvidia-portable.zip` |
| Checksums | `SHA256SUMS.txt` |

### Điểm mới

- Sửa lỗi công cụ giáo viên AI `KataGo analysis` khi phân tích toàn ván dễ bị timeout.
- Review toàn ván giờ quét nhanh toàn bộ trước, sau đó chỉ phân tích sâu vài nước nghi vấn quan trọng nhất.
- Khi chạy review toàn ván, GoAgent tạm dừng quick winrate graph nền để tránh tranh tài nguyên KataGo.
- Nếu một vài vị trí phản hồi chậm, hệ thống dùng các kết quả đã hoàn tất thay vì chờ đến khi toàn bộ tool call thất bại.
