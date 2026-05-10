# GoAgent v0.3.19

GoAgent v0.3.19 focuses on more grounded teaching evidence and a more reliable voice experience. It adds the KataGo Trace Translator so the teacher can explain policy, search, PV support, ownership and human-policy signals in a compact teaching packet instead of dumping raw engine fields. It also adds the Volcengine / Doubao TTS provider and fixes cloud TTS text cleanup, coordinate reading, playback controls and grouped evidence playback.

QQ 群：1030632742，欢迎一起交流、提建议、完善 GoAgent。

## 中文

### 下载前先选版本

| 平台 / 场景 | 推荐下载 |
| --- | --- |
| macOS Apple Silicon | `GoAgent-0.3.19-mac-arm64.dmg` |
| macOS Intel | `GoAgent-0.3.19-mac-x64.dmg` |
| Windows 普通版，OpenCL 推荐包 | `GoAgent-0.3.19-win-x64.exe` 或 `GoAgent-0.3.19-win-x64-portable.zip` |
| Windows NVIDIA 专版，适合 NVIDIA 显卡和 CUDA 环境 | `GoAgent-0.3.19-win-x64-nvidia.exe` 或 `GoAgent-0.3.19-win-x64-nvidia-portable.zip` |
| 校验文件 | `SHA256SUMS.txt` |

### 本版重点

- 新增 KataGo Trace Translator，把搜索摘要、候选点对比、policy-vs-search 差异、PV 访问置信度、ownership 摘要和 humanPolicy 信号整理成老师可讲、可验证的证据包。
- 老师讲棋会优先使用 tracePacket 解释“为什么”，弱 PV 会用“参考变化”措辞，不会讲成必然。
- 新增火山引擎 / 豆包 TTS provider，支持 APP ID、Access Token、Secret Key 等鉴权信息，并提供密钥显示按钮方便核对。
- 语音设置继续保持严格 selected-provider TTS：选哪个 provider 就只用哪个 provider，不自动切换、不兜底。
- 修复云端 TTS 中英文与围棋坐标清洗：保留 `AI`、`KataGo`、`strong`、`visit` 等英文词，不再把 `#` 号读出来。
- 修复证据列表朗读：像“实战、AI 首选、胜率损失、目差损失”这类段落会作为一组发送，避免火山引擎偶发返回空音频。
- 播放按钮状态更清楚：没有语音任务时停止按钮不再像可点击主操作。

## 繁體中文

### 下載前先選版本

| 平台 / 使用情境 | 建議下載 |
| --- | --- |
| macOS Apple Silicon | `GoAgent-0.3.19-mac-arm64.dmg` |
| macOS Intel | `GoAgent-0.3.19-mac-x64.dmg` |
| Windows 一般版，OpenCL 推薦包 | `GoAgent-0.3.19-win-x64.exe` 或 `GoAgent-0.3.19-win-x64-portable.zip` |
| Windows NVIDIA 專版 | `GoAgent-0.3.19-win-x64-nvidia.exe` 或 `GoAgent-0.3.19-win-x64-nvidia-portable.zip` |
| 校驗檔 | `SHA256SUMS.txt` |

### 本版重點

- 新增 KataGo Trace Translator，將 policy、search、PV、ownership 與 humanPolicy 訊號整理為可教學的證據包。
- 老師會根據 tracePacket 解釋候選點為什麼成立；PV 支持弱時會降低語氣。
- 新增火山引擎 / 豆包 TTS provider，支援 APP ID、Access Token、Secret Key。
- 保持嚴格 selected-provider TTS，不自動切換 provider，也不做兜底語音。
- 改善雲端 TTS 的文字清理、英文詞與座標朗讀，並修正 Markdown `#` 被讀出的問題。
- 證據列表會合併為一組請求，降低雲端 TTS 回傳空音訊的機率。

## English

### Pick the right package before downloading

| Platform / use case | Recommended download |
| --- | --- |
| macOS Apple Silicon | `GoAgent-0.3.19-mac-arm64.dmg` |
| macOS Intel | `GoAgent-0.3.19-mac-x64.dmg` |
| Standard Windows x64, OpenCL recommended | `GoAgent-0.3.19-win-x64.exe` or `GoAgent-0.3.19-win-x64-portable.zip` |
| Windows NVIDIA edition for NVIDIA GPUs and CUDA runtimes | `GoAgent-0.3.19-win-x64-nvidia.exe` or `GoAgent-0.3.19-win-x64-nvidia-portable.zip` |
| Checksums | `SHA256SUMS.txt` |

### Why update

- Adds the KataGo Trace Translator: a compact teaching evidence packet with searchSummary, candidateComparison, policySearchDelta, pvSupport, ownershipSummary, humanPolicySignals and a shallow search tree.
- The teacher can explain policy-vs-search differences such as natural-but-refuted, low-policy-but-strong-search and policy-and-search-agree without exposing raw engine dumps.
- Adds Volcengine / Doubao TTS with explicit user-selected provider behavior.
- Keeps strict selected-provider TTS: no system voice, no Web Speech, no provider chain, and no fallback switching.
- Improves TTS speech text cleanup for English words, Go coordinates, Markdown headings and grouped evidence lists.
- Fixes playback control states so stop is not highlighted when there is no active speech task.

## 日本語

### ダウンロード前に選ぶもの

| 環境 | 推奨ファイル |
| --- | --- |
| macOS Apple Silicon | `GoAgent-0.3.19-mac-arm64.dmg` |
| macOS Intel | `GoAgent-0.3.19-mac-x64.dmg` |
| Windows 標準版、OpenCL 推奨 | `GoAgent-0.3.19-win-x64.exe` または `GoAgent-0.3.19-win-x64-portable.zip` |
| NVIDIA GPU / CUDA 向け Windows NVIDIA 版 | `GoAgent-0.3.19-win-x64-nvidia.exe` または `GoAgent-0.3.19-win-x64-nvidia-portable.zip` |
| チェックサム | `SHA256SUMS.txt` |

### 主な変更

- KataGo Trace Translator を追加し、policy、search、PV、ownership、humanPolicy を説明しやすい証拠パケットにまとめます。
- PV の根拠が弱い場合、先生は断定せず参考変化として説明します。
- Volcengine / Doubao TTS provider を追加しました。
- selected-provider TTS の方針を維持し、自動フォールバックや provider の自動切り替えは行いません。
- 英単語、碁盤座標、Markdown 見出し、証拠リストの読み上げを改善しました。

## 한국어

### 다운로드 전 선택

| 환경 | 권장 다운로드 |
| --- | --- |
| macOS Apple Silicon | `GoAgent-0.3.19-mac-arm64.dmg` |
| macOS Intel | `GoAgent-0.3.19-mac-x64.dmg` |
| Windows 표준 x64, OpenCL 권장 | `GoAgent-0.3.19-win-x64.exe` 또는 `GoAgent-0.3.19-win-x64-portable.zip` |
| NVIDIA GPU / CUDA용 Windows NVIDIA 에디션 | `GoAgent-0.3.19-win-x64-nvidia.exe` 또는 `GoAgent-0.3.19-win-x64-nvidia-portable.zip` |
| 체크섬 | `SHA256SUMS.txt` |

### 이번 버전

- KataGo Trace Translator를 추가해 policy, search, PV, ownership, humanPolicy 신호를 교사용 증거 패킷으로 압축합니다.
- PV 근거가 약한 경우 선생님은 확정 표현 대신 참고 변화로 설명합니다.
- Volcengine / Doubao TTS provider를 추가했습니다.
- selected-provider TTS 정책을 유지하며 자동 fallback이나 provider chain을 사용하지 않습니다.
- 영어 단어, 바둑 좌표, Markdown 제목, 증거 리스트 읽기를 개선했습니다.

## ภาษาไทย

### เลือกไฟล์ก่อนดาวน์โหลด

| แพลตฟอร์ม | ไฟล์ที่แนะนำ |
| --- | --- |
| macOS Apple Silicon | `GoAgent-0.3.19-mac-arm64.dmg` |
| macOS Intel | `GoAgent-0.3.19-mac-x64.dmg` |
| Windows x64 มาตรฐาน แนะนำ OpenCL | `GoAgent-0.3.19-win-x64.exe` หรือ `GoAgent-0.3.19-win-x64-portable.zip` |
| Windows NVIDIA edition สำหรับ NVIDIA GPU และ CUDA | `GoAgent-0.3.19-win-x64-nvidia.exe` หรือ `GoAgent-0.3.19-win-x64-nvidia-portable.zip` |
| Checksums | `SHA256SUMS.txt` |

### จุดสำคัญของรุ่นนี้

- เพิ่ม KataGo Trace Translator เพื่อย่อสัญญาณ policy, search, PV, ownership และ humanPolicy เป็นหลักฐานสำหรับการสอน
- เมื่อ PV support อ่อน ระบบจะอธิบายเป็น variation อ้างอิง ไม่ใช่ผลลัพธ์ที่แน่นอน
- เพิ่ม Volcengine / Doubao TTS provider
- ยังคงนโยบาย selected-provider TTS แบบเข้มงวด ไม่มี Web Speech ไม่มี system voice และไม่มี fallback provider
- ปรับปรุงการอ่านคำอังกฤษ พิกัดโกะ หัวข้อ Markdown และรายการหลักฐาน

## Tiếng Việt

### Chọn gói tải xuống

| Nền tảng | Gói khuyến nghị |
| --- | --- |
| macOS Apple Silicon | `GoAgent-0.3.19-mac-arm64.dmg` |
| macOS Intel | `GoAgent-0.3.19-mac-x64.dmg` |
| Windows x64 tiêu chuẩn, khuyến nghị OpenCL | `GoAgent-0.3.19-win-x64.exe` hoặc `GoAgent-0.3.19-win-x64-portable.zip` |
| Windows NVIDIA edition cho GPU NVIDIA và CUDA | `GoAgent-0.3.19-win-x64-nvidia.exe` hoặc `GoAgent-0.3.19-win-x64-nvidia-portable.zip` |
| Checksums | `SHA256SUMS.txt` |

### Điểm mới

- Thêm KataGo Trace Translator để nén policy, search, PV, ownership và humanPolicy thành gói bằng chứng dễ giảng.
- Khi pvSupport yếu, giáo viên sẽ nói là biến tham khảo thay vì khẳng định chắc chắn.
- Thêm Volcengine / Doubao TTS provider.
- Giữ selected-provider TTS nghiêm ngặt: không system voice, không Web Speech, không provider chain và không tự động fallback.
- Cải thiện cách đọc từ tiếng Anh, tọa độ cờ vây, heading Markdown và danh sách bằng chứng.

## Quality baseline

This release keeps the existing top-quality baseline: grounded shape recognition engine, local pattern matcher, knowledge source-policy gates, optimized move-range review, quality checks and eval gates, Real Eval / engine silver fixture gate, KataGo engine pool telemetry, Release artifact smoke, student level, student age, teacher persona style settings with evidence boundary, teacher sessions, selective PR #6 integration, strict selected-provider TTS, offline synthesis validation for Kokoro, Vision Evidence Chain, KataGo Trace Translator, Volcengine / Doubao TTS, and multilingual release guidance.

Windows packages continue to follow the OpenCL and NVIDIA split. The standard Windows package includes the Windows OpenCL runtime bundle and KataGo OpenCL adjacent runtime files; GPU vendor OpenCL drivers still come from the user's NVIDIA / AMD / Intel graphics driver.

Thanks to layiku and wimi321.
