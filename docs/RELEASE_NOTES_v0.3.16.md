# GoAgent v0.3.16

GoAgent v0.3.16 adds strict offline Kokoro Chinese TTS for AI teacher answers. The default speech provider is bundled Kokoro zh-CN local synthesis, with no system voice, no Web Speech, no fallback chain, and no automatic provider switching. If users select a custom TTS provider, GoAgent uses only that selected provider and reports a clear error if it fails.

QQ群：1030632742，欢迎一起交流、提建议、完善 GoAgent。

## 中文

### 下载前先选版本

| 平台 / 场景 | 推荐下载 |
| --- | --- |
| macOS Apple Silicon | `GoAgent-0.3.16-mac-arm64.dmg` |
| macOS Intel | `GoAgent-0.3.16-mac-x64.dmg` |
| Windows 普通版，OpenCL 推荐包 | `GoAgent-0.3.16-win-x64.exe` 或 `GoAgent-0.3.16-win-x64-portable.zip` |
| Windows NVIDIA 专版，适合 NVIDIA 显卡和 CUDA 环境 | `GoAgent-0.3.16-win-x64-nvidia.exe` 或 `GoAgent-0.3.16-win-x64-nvidia-portable.zip` |
| 校验文件 | `SHA256SUMS.txt` |

### 本版重点

- 新增默认打包的 Kokoro 中文离线神经 TTS，老师回答可以直接本机朗读。
- 新增语音朗读控制和设置面板，支持播放、暂停、继续、停止。
- 新增严格 selected-provider TTS 策略：选哪个 provider 就只用哪个 provider。
- 自定义 OpenAI-compatible / HTTP JSON / 本地 TTS 服务只在用户显式选择时调用。
- Release workflow 会在打包前准备 Kokoro ONNX 资源，并运行真实 offline synthesis smoke。

## 繁體中文

### 下載前先選版本

| 平台 / 使用情境 | 建議下載 |
| --- | --- |
| macOS Apple Silicon | `GoAgent-0.3.16-mac-arm64.dmg` |
| macOS Intel | `GoAgent-0.3.16-mac-x64.dmg` |
| Windows 一般版，OpenCL 推薦包 | `GoAgent-0.3.16-win-x64.exe` 或 `GoAgent-0.3.16-win-x64-portable.zip` |
| Windows NVIDIA 專版 | `GoAgent-0.3.16-win-x64-nvidia.exe` 或 `GoAgent-0.3.16-win-x64-nvidia-portable.zip` |
| 校驗檔 | `SHA256SUMS.txt` |

### 本版重點

- 新增預設打包的 Kokoro 中文離線神經 TTS，老師回答可在本機朗讀。
- 新增語音播放控制與設定面板。
- 採用嚴格 selected-provider TTS：目前選擇哪個 provider，就只使用該 provider。
- 自訂 API provider 只有使用者明確選擇時才會呼叫。
- Release workflow 會在打包前準備 Kokoro ONNX 資源並執行真實 offline synthesis smoke。

## English

### Pick the right package before downloading

| Platform / use case | Recommended download |
| --- | --- |
| macOS Apple Silicon | `GoAgent-0.3.16-mac-arm64.dmg` |
| macOS Intel | `GoAgent-0.3.16-mac-x64.dmg` |
| Standard Windows x64, OpenCL recommended | `GoAgent-0.3.16-win-x64.exe` or `GoAgent-0.3.16-win-x64-portable.zip` |
| Windows NVIDIA edition for NVIDIA GPUs and CUDA runtimes | `GoAgent-0.3.16-win-x64-nvidia.exe` or `GoAgent-0.3.16-win-x64-nvidia-portable.zip` |
| Checksums | `SHA256SUMS.txt` |

### Why update

- Adds bundled Kokoro zh-CN offline neural TTS for AI teacher answers.
- Adds teacher speech controls and a TTS settings panel.
- Enforces strict selected-provider TTS: the selected provider is the only provider used.
- Custom OpenAI-compatible, HTTP JSON, and local-service TTS providers are called only after explicit user selection.
- Release packaging now prepares Kokoro ONNX assets and runs a real offline synthesis smoke before installers are built.

## 日本語

### ダウンロード前に選ぶもの

| 環境 | 推奨ファイル |
| --- | --- |
| macOS Apple Silicon | `GoAgent-0.3.16-mac-arm64.dmg` |
| macOS Intel | `GoAgent-0.3.16-mac-x64.dmg` |
| Windows 標準版、OpenCL 推奨 | `GoAgent-0.3.16-win-x64.exe` または `GoAgent-0.3.16-win-x64-portable.zip` |
| NVIDIA GPU / CUDA 向け Windows NVIDIA 版 | `GoAgent-0.3.16-win-x64-nvidia.exe` または `GoAgent-0.3.16-win-x64-nvidia-portable.zip` |
| チェックサム | `SHA256SUMS.txt` |

### 主な変更

- Kokoro 中国語オフライン神経 TTS を同梱し、先生の回答をローカルで読み上げられるようにしました。
- 読み上げの再生、停止、一時停止、再開と設定画面を追加しました。
- strict selected-provider TTS により、選択中の provider だけを使用します。
- カスタム TTS API はユーザーが明示的に選んだ場合だけ呼び出されます。
- Release workflow はパッケージ前に Kokoro ONNX を準備し、offline synthesis smoke を実行します。

## 한국어

### 다운로드 전 선택

| 환경 | 권장 다운로드 |
| --- | --- |
| macOS Apple Silicon | `GoAgent-0.3.16-mac-arm64.dmg` |
| macOS Intel | `GoAgent-0.3.16-mac-x64.dmg` |
| Windows 표준 x64, OpenCL 권장 | `GoAgent-0.3.16-win-x64.exe` 또는 `GoAgent-0.3.16-win-x64-portable.zip` |
| NVIDIA GPU / CUDA용 Windows NVIDIA 에디션 | `GoAgent-0.3.16-win-x64-nvidia.exe` 또는 `GoAgent-0.3.16-win-x64-nvidia-portable.zip` |
| 체크섬 | `SHA256SUMS.txt` |

### 이번 버전

- Kokoro 중국어 오프라인 신경망 TTS를 기본 포함해 AI 선생님 답변을 로컬에서 읽어 줍니다.
- 재생, 일시정지, 계속, 정지 컨트롤과 TTS 설정 패널을 추가했습니다.
- strict selected-provider TTS 정책으로 선택한 provider만 사용합니다.
- 사용자 지정 API는 사용자가 명시적으로 선택한 경우에만 호출됩니다.
- Release workflow가 패키징 전에 Kokoro ONNX 자산을 준비하고 offline synthesis smoke를 실행합니다.

## ภาษาไทย

### เลือกไฟล์ก่อนดาวน์โหลด

| แพลตฟอร์ม | ไฟล์ที่แนะนำ |
| --- | --- |
| macOS Apple Silicon | `GoAgent-0.3.16-mac-arm64.dmg` |
| macOS Intel | `GoAgent-0.3.16-mac-x64.dmg` |
| Windows x64 มาตรฐาน แนะนำ OpenCL | `GoAgent-0.3.16-win-x64.exe` หรือ `GoAgent-0.3.16-win-x64-portable.zip` |
| Windows NVIDIA edition สำหรับ NVIDIA GPU และ CUDA | `GoAgent-0.3.16-win-x64-nvidia.exe` หรือ `GoAgent-0.3.16-win-x64-nvidia-portable.zip` |
| Checksums | `SHA256SUMS.txt` |

### จุดสำคัญของรุ่นนี้

- เพิ่ม Kokoro ภาษาจีนแบบ offline neural TTS สำหรับอ่านข้อความคำสอนของ AI teacher ในเครื่อง
- เพิ่มปุ่มเล่น หยุดชั่วคราว เล่นต่อ และหยุด พร้อมแผงตั้งค่า TTS
- ใช้นโยบาย strict selected-provider TTS: เลือก provider ใดก็ใช้เฉพาะ provider นั้น
- custom API จะถูกเรียกใช้เฉพาะเมื่อผู้ใช้เลือกเองอย่างชัดเจน
- Release workflow เตรียม Kokoro ONNX และรัน offline synthesis smoke ก่อนสร้าง installer

## Tiếng Việt

### Chọn gói tải xuống

| Nền tảng | Gói khuyến nghị |
| --- | --- |
| macOS Apple Silicon | `GoAgent-0.3.16-mac-arm64.dmg` |
| macOS Intel | `GoAgent-0.3.16-mac-x64.dmg` |
| Windows x64 tiêu chuẩn, khuyến nghị OpenCL | `GoAgent-0.3.16-win-x64.exe` hoặc `GoAgent-0.3.16-win-x64-portable.zip` |
| Windows NVIDIA edition cho GPU NVIDIA và CUDA | `GoAgent-0.3.16-win-x64-nvidia.exe` hoặc `GoAgent-0.3.16-win-x64-nvidia-portable.zip` |
| Checksums | `SHA256SUMS.txt` |

### Điểm mới

- Thêm Kokoro zh-CN offline neural TTS để đọc câu trả lời của AI teacher ngay trên máy.
- Thêm điều khiển phát, tạm dừng, tiếp tục, dừng và bảng cài đặt TTS.
- Áp dụng strict selected-provider TTS: provider được chọn là provider duy nhất được dùng.
- Custom API chỉ được gọi khi người dùng chọn rõ ràng.
- Release workflow chuẩn bị Kokoro ONNX và chạy offline synthesis smoke trước khi đóng gói.

## Quality baseline

This release keeps the existing top-quality baseline: grounded shape recognition engine, local pattern matcher, knowledge source-policy gates, optimized move-range review, quality checks and eval gates, Real Eval / engine silver fixture gate, KataGo engine pool telemetry, Release artifact smoke, student level, student age, teacher persona style settings with evidence boundary, teacher sessions, and selective PR #6 integration.

It also adds Kokoro selected-provider TTS, strict offline synthesis validation, and release packaging checks for bundled zh-CN speech assets. Windows packages continue to follow the OpenCL and NVIDIA split. The standard Windows package includes the Windows OpenCL runtime bundle and KataGo OpenCL adjacent runtime files; GPU vendor OpenCL drivers still come from the user's NVIDIA / AMD / Intel graphics driver.

Thanks to layiku and wimi321.
