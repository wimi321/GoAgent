# GoAgent v0.4.19

GoAgent v0.4.19 makes the first run easier and Zhizi Cloud analysis more reliable. The one-time guide follows the system language, AI teacher verification checks text, image, and tool calling separately, background optimization can be cancelled, and model downloads can resume. Local KataGo remains the default; persistent Zhizi Cloud analysis is enabled only after the user explicitly tests and selects it.

QQ群：1030632742，欢迎交流、反馈问题并一起完善 GoAgent。

## 中文

### 下载

| 平台 / 场景 | 下载 |
| --- | --- |
| macOS Apple Silicon（M 系列） | [GoAgent-0.4.19-mac-arm64.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.19/GoAgent-0.4.19-mac-arm64.dmg) |
| macOS Intel | [GoAgent-0.4.19-mac-x64.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.19/GoAgent-0.4.19-mac-x64.dmg) |
| Windows x64 标准版（OpenCL）免安装 ZIP，推荐大多数用户 | [GoAgent-0.4.19-win-x64-portable.zip](https://github.com/wimi321/GoAgent/releases/download/v0.4.19/GoAgent-0.4.19-win-x64-portable.zip) |
| Windows x64 标准版（OpenCL）安装版 | [GoAgent-0.4.19-win-x64.exe](https://github.com/wimi321/GoAgent/releases/download/v0.4.19/GoAgent-0.4.19-win-x64.exe) |
| Windows x64 NVIDIA 专版（CUDA）免安装 7z | [GoAgent-0.4.19-win-x64-nvidia-portable.7z](https://github.com/wimi321/GoAgent/releases/download/v0.4.19/GoAgent-0.4.19-win-x64-nvidia-portable.7z) |
| Windows x64 NVIDIA 专版（CUDA）安装版 | [GoAgent-0.4.19-win-x64-nvidia.exe](https://github.com/wimi321/GoAgent/releases/download/v0.4.19/GoAgent-0.4.19-win-x64-nvidia.exe) |

### 本版重点

- 首次打开会出现一次性引导，并自动跟随系统语言；AI 老师可以当场配置，也可以稍后处理。
- AI 服务会分别验证文字回复、图片理解和工具调用；服务不支持模型列表时，仍可手动填写模型。
- KataGo 自动测速在后台进行，最长 30 秒，可取消或永久关闭；用户开始分析棋局时，棋局任务优先。
- 官方权重支持断点续传、暂停、继续、校验和应用，不会因一次网络中断从头开始。
- 智子云使用持久 Socket.IO/GTP 会话，支持实时搜索速度、取消、有限重连和空闲释放。
- 本机 KataGo 仍是默认算力。登录智子云不会自动切换，只有“检测并启用”成功后才使用远程算力。
- 支持 VIP 共享引擎 `vip-share` 以及独享档位；设置中新增智子官方 App 入口，便于管理账号和订阅。

## 繁體中文

### 下載

| 平台 / 情境 | 下載 |
| --- | --- |
| macOS Apple Silicon（M 系列） | [GoAgent-0.4.19-mac-arm64.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.19/GoAgent-0.4.19-mac-arm64.dmg) |
| macOS Intel | [GoAgent-0.4.19-mac-x64.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.19/GoAgent-0.4.19-mac-x64.dmg) |
| Windows x64 標準版（OpenCL）免安裝 ZIP，建議多數使用者 | [GoAgent-0.4.19-win-x64-portable.zip](https://github.com/wimi321/GoAgent/releases/download/v0.4.19/GoAgent-0.4.19-win-x64-portable.zip) |
| Windows x64 標準版（OpenCL）安裝版 | [GoAgent-0.4.19-win-x64.exe](https://github.com/wimi321/GoAgent/releases/download/v0.4.19/GoAgent-0.4.19-win-x64.exe) |
| Windows x64 NVIDIA（CUDA）免安裝 7z | [GoAgent-0.4.19-win-x64-nvidia-portable.7z](https://github.com/wimi321/GoAgent/releases/download/v0.4.19/GoAgent-0.4.19-win-x64-nvidia-portable.7z) |
| Windows x64 NVIDIA（CUDA）安裝版 | [GoAgent-0.4.19-win-x64-nvidia.exe](https://github.com/wimi321/GoAgent/releases/download/v0.4.19/GoAgent-0.4.19-win-x64-nvidia.exe) |

### 本版重點

- 首次啟動引導會跟隨系統語言；AI 老師可立即設定，也可稍後處理。
- AI 服務分別驗證文字、圖片與工具呼叫；無模型清單時仍可手動輸入模型。
- KataGo 背景測速最長 30 秒，可取消或永久關閉，棋局分析永遠優先。
- 官方權重支援續傳、暫停、繼續、校驗與套用。
- 智子雲使用持久連線，提供即時速度、取消、有限重連與閒置釋放。
- 本機 KataGo 維持預設；只有使用者明確檢測並啟用後才切換智子雲。
- 支援 VIP 共享引擎 `vip-share`，並提供智子官方 App 入口。

## English

### Downloads

| Platform / use case | Download |
| --- | --- |
| macOS Apple Silicon | [GoAgent-0.4.19-mac-arm64.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.19/GoAgent-0.4.19-mac-arm64.dmg) |
| macOS Intel | [GoAgent-0.4.19-mac-x64.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.19/GoAgent-0.4.19-mac-x64.dmg) |
| Windows x64 Standard (OpenCL) portable ZIP, recommended for most users | [GoAgent-0.4.19-win-x64-portable.zip](https://github.com/wimi321/GoAgent/releases/download/v0.4.19/GoAgent-0.4.19-win-x64-portable.zip) |
| Windows x64 Standard (OpenCL) installer | [GoAgent-0.4.19-win-x64.exe](https://github.com/wimi321/GoAgent/releases/download/v0.4.19/GoAgent-0.4.19-win-x64.exe) |
| Windows x64 NVIDIA (CUDA) portable 7z | [GoAgent-0.4.19-win-x64-nvidia-portable.7z](https://github.com/wimi321/GoAgent/releases/download/v0.4.19/GoAgent-0.4.19-win-x64-nvidia-portable.7z) |
| Windows x64 NVIDIA (CUDA) installer | [GoAgent-0.4.19-win-x64-nvidia.exe](https://github.com/wimi321/GoAgent/releases/download/v0.4.19/GoAgent-0.4.19-win-x64-nvidia.exe) |

### Highlights

- The one-time first-run guide follows the system language. AI teacher setup is guided but can be deferred.
- Provider verification tests text, image, and tool calling separately. Manual model entry remains available when `/models` is unsupported.
- Background KataGo optimization has a 30-second cap, can be cancelled or disabled, and always yields to active game analysis.
- Official model downloads are resumable and support pause, resume, validation, and explicit application.
- Persistent Zhizi Cloud analysis adds live visits-per-second, cancellation, bounded reconnect, and idle session release.
- Local KataGo remains the default. Zhizi Cloud is used only after an explicit connection test and enable action.
- VIP shared engine `vip-share` and dedicated tiers are supported, with a link to the official Zhizi app for account management.

## 日本語

### ダウンロード

| 環境 | ダウンロード |
| --- | --- |
| macOS Apple Silicon | [GoAgent-0.4.19-mac-arm64.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.19/GoAgent-0.4.19-mac-arm64.dmg) |
| macOS Intel | [GoAgent-0.4.19-mac-x64.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.19/GoAgent-0.4.19-mac-x64.dmg) |
| Windows x64 Standard（OpenCL）ポータブル ZIP | [GoAgent-0.4.19-win-x64-portable.zip](https://github.com/wimi321/GoAgent/releases/download/v0.4.19/GoAgent-0.4.19-win-x64-portable.zip) |
| Windows x64 Standard（OpenCL）インストーラー | [GoAgent-0.4.19-win-x64.exe](https://github.com/wimi321/GoAgent/releases/download/v0.4.19/GoAgent-0.4.19-win-x64.exe) |
| Windows x64 NVIDIA（CUDA）ポータブル 7z | [GoAgent-0.4.19-win-x64-nvidia-portable.7z](https://github.com/wimi321/GoAgent/releases/download/v0.4.19/GoAgent-0.4.19-win-x64-nvidia-portable.7z) |
| Windows x64 NVIDIA（CUDA）インストーラー | [GoAgent-0.4.19-win-x64-nvidia.exe](https://github.com/wimi321/GoAgent/releases/download/v0.4.19/GoAgent-0.4.19-win-x64-nvidia.exe) |

### 主な変更

- 初回ガイドはシステム言語に従い、AI 教師の設定は後から行うこともできます。
- 文字、画像、ツール呼び出しを個別に確認し、モデル一覧がない場合も手動入力できます。
- KataGo のバックグラウンド測定は 30 秒以内で、停止や無効化が可能です。対局分析を常に優先します。
- 公式モデルのダウンロードは再開、停止、検証、適用に対応しました。
- 智子クラウドは持続接続、リアルタイム速度、キャンセル、限定再接続に対応しました。
- 既定はローカル KataGo のままで、明示的な接続確認後にのみクラウドへ切り替えます。
- VIP 共有エンジン `vip-share` と智子公式 App へのリンクを追加しました。

## 한국어

### 다운로드

| 환경 | 다운로드 |
| --- | --- |
| macOS Apple Silicon | [GoAgent-0.4.19-mac-arm64.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.19/GoAgent-0.4.19-mac-arm64.dmg) |
| macOS Intel | [GoAgent-0.4.19-mac-x64.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.19/GoAgent-0.4.19-mac-x64.dmg) |
| Windows x64 Standard (OpenCL) 포터블 ZIP | [GoAgent-0.4.19-win-x64-portable.zip](https://github.com/wimi321/GoAgent/releases/download/v0.4.19/GoAgent-0.4.19-win-x64-portable.zip) |
| Windows x64 Standard (OpenCL) 설치 프로그램 | [GoAgent-0.4.19-win-x64.exe](https://github.com/wimi321/GoAgent/releases/download/v0.4.19/GoAgent-0.4.19-win-x64.exe) |
| Windows x64 NVIDIA (CUDA) 포터블 7z | [GoAgent-0.4.19-win-x64-nvidia-portable.7z](https://github.com/wimi321/GoAgent/releases/download/v0.4.19/GoAgent-0.4.19-win-x64-nvidia-portable.7z) |
| Windows x64 NVIDIA (CUDA) 설치 프로그램 | [GoAgent-0.4.19-win-x64-nvidia.exe](https://github.com/wimi321/GoAgent/releases/download/v0.4.19/GoAgent-0.4.19-win-x64-nvidia.exe) |

### 주요 변경

- 최초 실행 안내가 시스템 언어를 따르며 AI 교사 설정은 나중에 진행할 수 있습니다.
- 텍스트, 이미지, 도구 호출을 각각 확인하고 모델 목록이 없어도 직접 입력할 수 있습니다.
- KataGo 백그라운드 측정은 30초 이내이며 취소하거나 끌 수 있고 실제 대국 분석을 우선합니다.
- 공식 모델 다운로드는 이어받기, 일시정지, 검증, 적용을 지원합니다.
- Zhizi Cloud는 지속 연결, 실시간 속도, 취소, 제한된 재연결을 지원합니다.
- 기본값은 로컬 KataGo이며 명시적인 연결 검사 후에만 원격 분석을 사용합니다.
- VIP 공유 엔진 `vip-share`와 공식 Zhizi 앱 링크를 제공합니다.

## ภาษาไทย

### ดาวน์โหลด

| แพลตฟอร์ม | ดาวน์โหลด |
| --- | --- |
| macOS Apple Silicon | [GoAgent-0.4.19-mac-arm64.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.19/GoAgent-0.4.19-mac-arm64.dmg) |
| macOS Intel | [GoAgent-0.4.19-mac-x64.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.19/GoAgent-0.4.19-mac-x64.dmg) |
| Windows x64 Standard (OpenCL) portable ZIP | [GoAgent-0.4.19-win-x64-portable.zip](https://github.com/wimi321/GoAgent/releases/download/v0.4.19/GoAgent-0.4.19-win-x64-portable.zip) |
| Windows x64 Standard (OpenCL) installer | [GoAgent-0.4.19-win-x64.exe](https://github.com/wimi321/GoAgent/releases/download/v0.4.19/GoAgent-0.4.19-win-x64.exe) |
| Windows x64 NVIDIA (CUDA) portable 7z | [GoAgent-0.4.19-win-x64-nvidia-portable.7z](https://github.com/wimi321/GoAgent/releases/download/v0.4.19/GoAgent-0.4.19-win-x64-nvidia-portable.7z) |
| Windows x64 NVIDIA (CUDA) installer | [GoAgent-0.4.19-win-x64-nvidia.exe](https://github.com/wimi321/GoAgent/releases/download/v0.4.19/GoAgent-0.4.19-win-x64-nvidia.exe) |

### จุดสำคัญ

- คู่มือเริ่มต้นครั้งเดียวใช้ภาษาของระบบ และสามารถตั้งค่า AI teacher ภายหลังได้
- ตรวจสอบข้อความ รูปภาพ และการเรียกใช้เครื่องมือแยกกัน พร้อมกรอกชื่อโมเดลเองได้
- การวัดความเร็ว KataGo เบื้องหลังจำกัด 30 วินาที ยกเลิกหรือปิดได้ และให้ความสำคัญกับการวิเคราะห์เกม
- ดาวน์โหลดโมเดลอย่างเป็นทางการต่อได้ พร้อมหยุดชั่วคราว ตรวจสอบ และนำไปใช้
- Zhizi Cloud ใช้การเชื่อมต่อแบบถาวร แสดงความเร็วสด ยกเลิกและเชื่อมต่อใหม่แบบจำกัดได้
- Local KataGo remains the default และจะใช้คลาวด์หลังผู้ใช้ตรวจสอบและเปิดใช้อย่างชัดเจนเท่านั้น
- รองรับ VIP shared engine `vip-share` และลิงก์ไปยัง official Zhizi app

## Tiếng Việt

### Tải xuống

| Nền tảng | Tải xuống |
| --- | --- |
| macOS Apple Silicon | [GoAgent-0.4.19-mac-arm64.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.19/GoAgent-0.4.19-mac-arm64.dmg) |
| macOS Intel | [GoAgent-0.4.19-mac-x64.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.19/GoAgent-0.4.19-mac-x64.dmg) |
| Windows x64 Standard (OpenCL) portable ZIP | [GoAgent-0.4.19-win-x64-portable.zip](https://github.com/wimi321/GoAgent/releases/download/v0.4.19/GoAgent-0.4.19-win-x64-portable.zip) |
| Windows x64 Standard (OpenCL) installer | [GoAgent-0.4.19-win-x64.exe](https://github.com/wimi321/GoAgent/releases/download/v0.4.19/GoAgent-0.4.19-win-x64.exe) |
| Windows x64 NVIDIA (CUDA) portable 7z | [GoAgent-0.4.19-win-x64-nvidia-portable.7z](https://github.com/wimi321/GoAgent/releases/download/v0.4.19/GoAgent-0.4.19-win-x64-nvidia-portable.7z) |
| Windows x64 NVIDIA (CUDA) installer | [GoAgent-0.4.19-win-x64-nvidia.exe](https://github.com/wimi321/GoAgent/releases/download/v0.4.19/GoAgent-0.4.19-win-x64-nvidia.exe) |

### Điểm mới

- Hướng dẫn lần đầu tự theo ngôn ngữ hệ thống; người dùng có thể cấu hình AI teacher ngay hoặc để sau.
- Kiểm tra riêng văn bản, hình ảnh và tool call; vẫn cho phép nhập model thủ công khi không có `/models`.
- Đo tốc độ KataGo nền giới hạn 30 giây, có thể hủy hoặc tắt và luôn nhường tài nguyên cho phân tích ván cờ.
- Tải model chính thức hỗ trợ tiếp tục, tạm dừng, kiểm tra và áp dụng.
- Zhizi Cloud dùng kết nối lâu dài, hiển thị tốc độ trực tiếp, hỗ trợ hủy và kết nối lại có giới hạn.
- Local KataGo remains the default; chỉ dùng đám mây sau khi người dùng chủ động kiểm tra và bật.
- Hỗ trợ VIP shared engine `vip-share` và liên kết tới official Zhizi app.
