# GoAgent v0.3.18

GoAgent v0.3.18 improves the teacher voice experience, cleans up the settings surface for normal users, and hardens the vision evidence chain so current-move and move-range reviews can no longer silently proceed without board images.

QQ 群：1030632742，欢迎一起交流、提建议、完善 GoAgent。

## 中文

### 下载前先选版本

| 平台 / 场景 | 推荐下载 |
| --- | --- |
| macOS Apple Silicon | `GoAgent-0.3.18-mac-arm64.dmg` |
| macOS Intel | `GoAgent-0.3.18-mac-x64.dmg` |
| Windows 普通版，OpenCL 推荐包 | `GoAgent-0.3.18-win-x64.exe` 或 `GoAgent-0.3.18-win-x64-portable.zip` |
| Windows NVIDIA 专版，适合 NVIDIA 显卡和 CUDA 环境 | `GoAgent-0.3.18-win-x64-nvidia.exe` 或 `GoAgent-0.3.18-win-x64-nvidia-portable.zip` |
| 校验文件 | `SHA256SUMS.txt` |

### 本版重点

- Kokoro 中文离线 TTS 改为后台 worker 生成，播放长讲解时界面不再被 ONNX 推理卡住。
- 老师语音支持分段生成、边生成边播放，并预取下一段，长回答不再需要整段等完。
- 中文坐标朗读更自然：`K5` 直接读作“凯五”，不再读“坐标凯五”。
- 设置页移除普通用户看不懂的 P0 Beta 验收面板。
- 语音设置重构为更清晰的产品化界面：语音开关、引擎选择、声音语言、播放偏好、自定义 API 高级区。
- Vision Evidence Chain 落地：当前手和区间复盘必须携带棋盘图证据；缺图时程序层报错，不让 LLM 硬猜。
- 已附图时，老师回答若声称“没有棋盘图 / 看不到图片”，会被本地 verifier 修正或阻断。

## 繁體中文

### 下載前先選版本

| 平台 / 使用情境 | 建議下載 |
| --- | --- |
| macOS Apple Silicon | `GoAgent-0.3.18-mac-arm64.dmg` |
| macOS Intel | `GoAgent-0.3.18-mac-x64.dmg` |
| Windows 一般版，OpenCL 推薦包 | `GoAgent-0.3.18-win-x64.exe` 或 `GoAgent-0.3.18-win-x64-portable.zip` |
| Windows NVIDIA 專版 | `GoAgent-0.3.18-win-x64-nvidia.exe` 或 `GoAgent-0.3.18-win-x64-nvidia-portable.zip` |
| 校驗檔 | `SHA256SUMS.txt` |

### 本版重點

- Kokoro 中文離線 TTS 改由背景 worker 生成，長講解播放時介面不再被推理卡住。
- 語音支援分段生成、邊生成邊播放，並預先生成下一段。
- 棋盤座標朗讀更自然：`K5` 會直接讀作「凱五」，不再加「座標」。
- 設定頁移除面向內部發布工程的 P0 Beta 驗收面板。
- 語音設定重新整理為更清楚的產品介面。
- Vision Evidence Chain 落地：目前手和區間復盤必須有棋盤圖證據；缺圖時由程式層阻止任務。

## English

### Pick the right package before downloading

| Platform / use case | Recommended download |
| --- | --- |
| macOS Apple Silicon | `GoAgent-0.3.18-mac-arm64.dmg` |
| macOS Intel | `GoAgent-0.3.18-mac-x64.dmg` |
| Standard Windows x64, OpenCL recommended | `GoAgent-0.3.18-win-x64.exe` or `GoAgent-0.3.18-win-x64-portable.zip` |
| Windows NVIDIA edition for NVIDIA GPUs and CUDA runtimes | `GoAgent-0.3.18-win-x64-nvidia.exe` or `GoAgent-0.3.18-win-x64-nvidia-portable.zip` |
| Checksums | `SHA256SUMS.txt` |

### Why update

- Moves bundled Kokoro zh-CN synthesis into a background worker so long teacher voice playback no longer blocks the desktop UI.
- Adds progressive chunk generation and playback with next-chunk prefetching.
- Reads Go coordinates naturally, for example `K5` is spoken as the coordinate itself without an extra “coordinate” prefix.
- Removes the internal P0 Beta acceptance panel from normal user settings.
- Redesigns the TTS settings UI around provider choice, voice/language, playback preferences, and advanced custom API configuration.
- Adds Vision Evidence Chain: current-move and move-range reviews require explicit board-image evidence.
- If images are attached, local verification prevents final answers that claim there is no board image.

## 日本語

### ダウンロード前に選ぶもの

| 環境 | 推奨ファイル |
| --- | --- |
| macOS Apple Silicon | `GoAgent-0.3.18-mac-arm64.dmg` |
| macOS Intel | `GoAgent-0.3.18-mac-x64.dmg` |
| Windows 標準版、OpenCL 推奨 | `GoAgent-0.3.18-win-x64.exe` または `GoAgent-0.3.18-win-x64-portable.zip` |
| NVIDIA GPU / CUDA 向け Windows NVIDIA 版 | `GoAgent-0.3.18-win-x64-nvidia.exe` または `GoAgent-0.3.18-win-x64-nvidia-portable.zip` |
| チェックサム | `SHA256SUMS.txt` |

### 主な変更

- Kokoro zh-CN の音声合成をバックグラウンド worker に移し、長い解説でも UI が固まりにくくなりました。
- 分割生成と再生、次チャンクの事前生成に対応しました。
- `K5` などの碁盤座標をより自然に読みます。
- 通常ユーザー向け設定から内部向けの P0 Beta 検収パネルを削除しました。
- TTS 設定 UI を整理しました。
- Vision Evidence Chain により、現在手と範囲レビューでは棋盤画像の証拠を必須にしました。

## 한국어

### 다운로드 전 선택

| 환경 | 권장 다운로드 |
| --- | --- |
| macOS Apple Silicon | `GoAgent-0.3.18-mac-arm64.dmg` |
| macOS Intel | `GoAgent-0.3.18-mac-x64.dmg` |
| Windows 표준 x64, OpenCL 권장 | `GoAgent-0.3.18-win-x64.exe` 또는 `GoAgent-0.3.18-win-x64-portable.zip` |
| NVIDIA GPU / CUDA용 Windows NVIDIA 에디션 | `GoAgent-0.3.18-win-x64-nvidia.exe` 또는 `GoAgent-0.3.18-win-x64-nvidia-portable.zip` |
| 체크섬 | `SHA256SUMS.txt` |

### 이번 버전

- Kokoro zh-CN 오프라인 TTS를 백그라운드 worker에서 생성해 긴 음성 재생 중 UI 멈춤을 줄였습니다.
- 긴 설명은 청크 단위로 생성하고 재생하며 다음 청크를 미리 준비합니다.
- `K5` 같은 바둑 좌표를 더 자연스럽게 읽습니다.
- 일반 사용자 설정에서 내부 P0 Beta 검수 패널을 제거했습니다.
- TTS 설정 UI를 더 명확하게 재구성했습니다.
- Vision Evidence Chain을 추가해 현재 수와 구간 복기에는 명시적인 보드 이미지 증거가 필요합니다.

## ภาษาไทย

### เลือกไฟล์ก่อนดาวน์โหลด

| แพลตฟอร์ม | ไฟล์ที่แนะนำ |
| --- | --- |
| macOS Apple Silicon | `GoAgent-0.3.18-mac-arm64.dmg` |
| macOS Intel | `GoAgent-0.3.18-mac-x64.dmg` |
| Windows x64 มาตรฐาน แนะนำ OpenCL | `GoAgent-0.3.18-win-x64.exe` หรือ `GoAgent-0.3.18-win-x64-portable.zip` |
| Windows NVIDIA edition สำหรับ NVIDIA GPU และ CUDA | `GoAgent-0.3.18-win-x64-nvidia.exe` หรือ `GoAgent-0.3.18-win-x64-nvidia-portable.zip` |
| Checksums | `SHA256SUMS.txt` |

### จุดสำคัญของรุ่นนี้

- ย้าย Kokoro zh-CN offline TTS ไปทำงานใน background worker เพื่อไม่ให้ UI ค้างระหว่างอ่านคำอธิบายยาว
- รองรับการสร้างเสียงเป็นช่วง ๆ และเล่นต่อเนื่อง
- อ่านพิกัดบนกระดาน เช่น `K5` ได้เป็นธรรมชาติมากขึ้น
- เอาแผง P0 Beta acceptance ภายในออกจากหน้าตั้งค่าของผู้ใช้ทั่วไป
- ปรับหน้า TTS settings ใหม่ให้ชัดเจนขึ้น
- เพิ่ม Vision Evidence Chain เพื่อบังคับให้ current-move และ move-range review มีหลักฐานภาพกระดาน

## Tiếng Việt

### Chọn gói tải xuống

| Nền tảng | Gói khuyến nghị |
| --- | --- |
| macOS Apple Silicon | `GoAgent-0.3.18-mac-arm64.dmg` |
| macOS Intel | `GoAgent-0.3.18-mac-x64.dmg` |
| Windows x64 tiêu chuẩn, khuyến nghị OpenCL | `GoAgent-0.3.18-win-x64.exe` hoặc `GoAgent-0.3.18-win-x64-portable.zip` |
| Windows NVIDIA edition cho GPU NVIDIA và CUDA | `GoAgent-0.3.18-win-x64-nvidia.exe` hoặc `GoAgent-0.3.18-win-x64-nvidia-portable.zip` |
| Checksums | `SHA256SUMS.txt` |

### Điểm mới

- Chuyển Kokoro zh-CN offline TTS sang background worker để giao diện không bị đơ khi đọc bài giảng dài.
- Hỗ trợ tạo và phát âm thanh theo từng đoạn, đồng thời chuẩn bị trước đoạn tiếp theo.
- Đọc tọa độ bàn cờ như `K5` tự nhiên hơn.
- Xóa bảng P0 Beta acceptance nội bộ khỏi phần cài đặt dành cho người dùng phổ thông.
- Thiết kế lại giao diện TTS settings.
- Bổ sung Vision Evidence Chain: phân tích nước hiện tại và đánh giá theo đoạn phải có bằng chứng ảnh bàn cờ.

## Quality baseline

This release keeps the existing top-quality baseline: grounded shape recognition engine, local pattern matcher, knowledge source-policy gates, optimized move-range review, quality checks and eval gates, Real Eval / engine silver fixture gate, KataGo engine pool telemetry, Release artifact smoke, student level, student age, teacher persona style settings with evidence boundary, teacher sessions, selective PR #6 integration, strict selected-provider TTS, offline synthesis validation for Kokoro, Vision Evidence Chain, and multilingual release guidance.

Windows packages continue to follow the OpenCL and NVIDIA split. The standard Windows package includes the Windows OpenCL runtime bundle and KataGo OpenCL adjacent runtime files; GPU vendor OpenCL drivers still come from the user's NVIDIA / AMD / Intel graphics driver.

Thanks to layiku and wimi321.
