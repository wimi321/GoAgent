# GoAgent v0.4.20

GoAgent v0.4.20 upgrades local Go analysis to KataGo 1.17.1 and the official Transformer model family. It also includes the official Zhizi API workflow and the stable multilingual download center delivered since v0.4.19. Local KataGo remains the default; remote analysis is used only after the user explicitly enables it.

QQ群：1030632742，欢迎交流、反馈问题并一起完善 GoAgent。

## 中文

### 下载

| 平台 / 场景 | 下载 |
| --- | --- |
| macOS Apple Silicon（M 系列） | [GoAgent-0.4.20-mac-arm64.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.20/GoAgent-0.4.20-mac-arm64.dmg) |
| macOS Intel | [GoAgent-0.4.20-mac-x64.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.20/GoAgent-0.4.20-mac-x64.dmg) |
| Windows x64 标准版（OpenCL）免安装 ZIP，推荐大多数用户 | [GoAgent-0.4.20-win-x64-portable.zip](https://github.com/wimi321/GoAgent/releases/download/v0.4.20/GoAgent-0.4.20-win-x64-portable.zip) |
| Windows x64 标准版（OpenCL）安装版 | [GoAgent-0.4.20-win-x64.exe](https://github.com/wimi321/GoAgent/releases/download/v0.4.20/GoAgent-0.4.20-win-x64.exe) |
| Windows x64 NVIDIA 专版（CUDA/CUDNN）免安装 7z | [GoAgent-0.4.20-win-x64-nvidia-portable.7z](https://github.com/wimi321/GoAgent/releases/download/v0.4.20/GoAgent-0.4.20-win-x64-nvidia-portable.7z) |
| Windows x64 NVIDIA 专版（CUDA/CUDNN）安装版 | [GoAgent-0.4.20-win-x64-nvidia.exe](https://github.com/wimi321/GoAgent/releases/download/v0.4.20/GoAgent-0.4.20-win-x64-nvidia.exe) |

### 本版重点

- macOS Metal、Windows OpenCL 和 NVIDIA CUDA/CUDNN 引擎升级到 KataGo 1.17.1。
- 默认权重升级为官方 Transformer 10B Balanced，并提供轻量版和旗舰版供选择。
- 引擎与模型增加版本兼容、文件大小和 SHA-256 校验，下载支持断点续传，发布包会在打包前再次严格检查。
- 智子云改用官方 API，支持账户、套餐、余额、记录和远程分析；本机 KataGo 始终是默认选项。
- goagent.top 下载中心支持七种语言、自动重试和直接下载恢复。
- KataGo 1.17.2 仅发布 TensorRT 修复，本版非 TensorRT 安装包按官方建议使用 1.17.1。

## 繁體中文

### 下載

| 平台 / 情境 | 下載 |
| --- | --- |
| macOS Apple Silicon（M 系列） | [GoAgent-0.4.20-mac-arm64.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.20/GoAgent-0.4.20-mac-arm64.dmg) |
| macOS Intel | [GoAgent-0.4.20-mac-x64.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.20/GoAgent-0.4.20-mac-x64.dmg) |
| Windows x64 標準版（OpenCL）免安裝 ZIP，建議多數使用者 | [GoAgent-0.4.20-win-x64-portable.zip](https://github.com/wimi321/GoAgent/releases/download/v0.4.20/GoAgent-0.4.20-win-x64-portable.zip) |
| Windows x64 標準版（OpenCL）安裝版 | [GoAgent-0.4.20-win-x64.exe](https://github.com/wimi321/GoAgent/releases/download/v0.4.20/GoAgent-0.4.20-win-x64.exe) |
| Windows x64 NVIDIA（CUDA/CUDNN）免安裝 7z | [GoAgent-0.4.20-win-x64-nvidia-portable.7z](https://github.com/wimi321/GoAgent/releases/download/v0.4.20/GoAgent-0.4.20-win-x64-nvidia-portable.7z) |
| Windows x64 NVIDIA（CUDA/CUDNN）安裝版 | [GoAgent-0.4.20-win-x64-nvidia.exe](https://github.com/wimi321/GoAgent/releases/download/v0.4.20/GoAgent-0.4.20-win-x64-nvidia.exe) |

### 本版重點

- macOS Metal、Windows OpenCL 與 NVIDIA CUDA/CUDNN 引擎升級至 KataGo 1.17.1。
- 預設模型改為官方 Transformer 10B Balanced，並提供輕量與旗艦選項。
- 引擎與模型會檢查版本、大小及 SHA-256；下載可續傳，正式打包前會再次驗證。
- 智子雲改用官方 API，支援帳戶、方案、餘額、記錄與遠端分析；本機 KataGo 仍是預設值。
- goagent.top 下載中心支援七種語言、自動重試與直接下載恢復。
- KataGo 1.17.2 僅提供 TensorRT 修正，因此本版非 TensorRT 套件使用 1.17.1。

## English

### Downloads

| Platform / use case | Download |
| --- | --- |
| macOS Apple Silicon | [GoAgent-0.4.20-mac-arm64.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.20/GoAgent-0.4.20-mac-arm64.dmg) |
| macOS Intel | [GoAgent-0.4.20-mac-x64.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.20/GoAgent-0.4.20-mac-x64.dmg) |
| Windows x64 Standard (OpenCL) portable ZIP, recommended for most users | [GoAgent-0.4.20-win-x64-portable.zip](https://github.com/wimi321/GoAgent/releases/download/v0.4.20/GoAgent-0.4.20-win-x64-portable.zip) |
| Windows x64 Standard (OpenCL) installer | [GoAgent-0.4.20-win-x64.exe](https://github.com/wimi321/GoAgent/releases/download/v0.4.20/GoAgent-0.4.20-win-x64.exe) |
| Windows x64 NVIDIA (CUDA/CUDNN) portable 7z | [GoAgent-0.4.20-win-x64-nvidia-portable.7z](https://github.com/wimi321/GoAgent/releases/download/v0.4.20/GoAgent-0.4.20-win-x64-nvidia-portable.7z) |
| Windows x64 NVIDIA (CUDA/CUDNN) installer | [GoAgent-0.4.20-win-x64-nvidia.exe](https://github.com/wimi321/GoAgent/releases/download/v0.4.20/GoAgent-0.4.20-win-x64-nvidia.exe) |

### Highlights

- macOS Metal, Windows OpenCL, and NVIDIA CUDA/CUDNN runtimes now use KataGo 1.17.1.
- The official Transformer 10B Balanced model is the new recommended default, with lightweight and strong alternatives available.
- Engine and model versions, file sizes, and SHA-256 hashes are verified; downloads resume safely and final package assets are checked again before packaging.
- The official Zhizi API now powers account, membership, balance, usage, payment, and remote analysis while local KataGo remains the default.
- The goagent.top download center supports seven languages, bounded automatic retry, and direct-download recovery.
- KataGo 1.17.2 only ships TensorRT fixes, so this release correctly uses 1.17.1 for all non-TensorRT packages.

## 日本語

### ダウンロード

| 環境 | ダウンロード |
| --- | --- |
| macOS Apple Silicon | [GoAgent-0.4.20-mac-arm64.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.20/GoAgent-0.4.20-mac-arm64.dmg) |
| macOS Intel | [GoAgent-0.4.20-mac-x64.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.20/GoAgent-0.4.20-mac-x64.dmg) |
| Windows x64 Standard（OpenCL）ポータブル ZIP | [GoAgent-0.4.20-win-x64-portable.zip](https://github.com/wimi321/GoAgent/releases/download/v0.4.20/GoAgent-0.4.20-win-x64-portable.zip) |
| Windows x64 Standard（OpenCL）インストーラー | [GoAgent-0.4.20-win-x64.exe](https://github.com/wimi321/GoAgent/releases/download/v0.4.20/GoAgent-0.4.20-win-x64.exe) |
| Windows x64 NVIDIA（CUDA/CUDNN）ポータブル 7z | [GoAgent-0.4.20-win-x64-nvidia-portable.7z](https://github.com/wimi321/GoAgent/releases/download/v0.4.20/GoAgent-0.4.20-win-x64-nvidia-portable.7z) |
| Windows x64 NVIDIA（CUDA/CUDNN）インストーラー | [GoAgent-0.4.20-win-x64-nvidia.exe](https://github.com/wimi321/GoAgent/releases/download/v0.4.20/GoAgent-0.4.20-win-x64-nvidia.exe) |

### 主な変更

- macOS Metal、Windows OpenCL、NVIDIA CUDA/CUDNN を KataGo 1.17.1 に更新しました。
- 公式 Transformer 10B Balanced を推奨デフォルトにし、軽量版と高性能版も選択できます。
- バージョン、サイズ、SHA-256 を検証し、ダウンロード再開とパッケージ直前の再検証に対応しました。
- 智子クラウドは公式 API を使用し、アカウント、プラン、残高、履歴、リモート解析に対応します。ローカル KataGo が引き続き既定です。
- goagent.top のダウンロードセンターは 7 言語、自動再試行、直接ダウンロード復旧に対応しました。
- KataGo 1.17.2 は TensorRT 専用修正版のため、非 TensorRT 版では 1.17.1 を使用します。

## 한국어

### 다운로드

| 환경 | 다운로드 |
| --- | --- |
| macOS Apple Silicon | [GoAgent-0.4.20-mac-arm64.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.20/GoAgent-0.4.20-mac-arm64.dmg) |
| macOS Intel | [GoAgent-0.4.20-mac-x64.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.20/GoAgent-0.4.20-mac-x64.dmg) |
| Windows x64 Standard (OpenCL) 포터블 ZIP | [GoAgent-0.4.20-win-x64-portable.zip](https://github.com/wimi321/GoAgent/releases/download/v0.4.20/GoAgent-0.4.20-win-x64-portable.zip) |
| Windows x64 Standard (OpenCL) 설치 프로그램 | [GoAgent-0.4.20-win-x64.exe](https://github.com/wimi321/GoAgent/releases/download/v0.4.20/GoAgent-0.4.20-win-x64.exe) |
| Windows x64 NVIDIA (CUDA/CUDNN) 포터블 7z | [GoAgent-0.4.20-win-x64-nvidia-portable.7z](https://github.com/wimi321/GoAgent/releases/download/v0.4.20/GoAgent-0.4.20-win-x64-nvidia-portable.7z) |
| Windows x64 NVIDIA (CUDA/CUDNN) 설치 프로그램 | [GoAgent-0.4.20-win-x64-nvidia.exe](https://github.com/wimi321/GoAgent/releases/download/v0.4.20/GoAgent-0.4.20-win-x64-nvidia.exe) |

### 주요 변경

- macOS Metal, Windows OpenCL, NVIDIA CUDA/CUDNN 엔진을 KataGo 1.17.1로 업그레이드했습니다.
- 공식 Transformer 10B Balanced가 새로운 권장 기본 모델이며 경량 및 고성능 모델도 선택할 수 있습니다.
- 엔진과 모델의 버전, 크기, SHA-256을 검증하며 이어받기 다운로드와 패키징 직전 재검사를 지원합니다.
- Zhizi Cloud는 공식 API로 계정, 멤버십, 잔액, 기록 및 원격 분석을 제공하며 로컬 KataGo가 계속 기본값입니다.
- goagent.top 다운로드 센터는 7개 언어, 자동 재시도, 직접 다운로드 복구를 지원합니다.
- KataGo 1.17.2는 TensorRT 전용 수정 버전이므로 비 TensorRT 패키지는 1.17.1을 사용합니다.

## ภาษาไทย

### ดาวน์โหลด

| แพลตฟอร์ม | ดาวน์โหลด |
| --- | --- |
| macOS Apple Silicon | [GoAgent-0.4.20-mac-arm64.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.20/GoAgent-0.4.20-mac-arm64.dmg) |
| macOS Intel | [GoAgent-0.4.20-mac-x64.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.20/GoAgent-0.4.20-mac-x64.dmg) |
| Windows x64 Standard (OpenCL) portable ZIP | [GoAgent-0.4.20-win-x64-portable.zip](https://github.com/wimi321/GoAgent/releases/download/v0.4.20/GoAgent-0.4.20-win-x64-portable.zip) |
| Windows x64 Standard (OpenCL) installer | [GoAgent-0.4.20-win-x64.exe](https://github.com/wimi321/GoAgent/releases/download/v0.4.20/GoAgent-0.4.20-win-x64.exe) |
| Windows x64 NVIDIA (CUDA/CUDNN) portable 7z | [GoAgent-0.4.20-win-x64-nvidia-portable.7z](https://github.com/wimi321/GoAgent/releases/download/v0.4.20/GoAgent-0.4.20-win-x64-nvidia-portable.7z) |
| Windows x64 NVIDIA (CUDA/CUDNN) installer | [GoAgent-0.4.20-win-x64-nvidia.exe](https://github.com/wimi321/GoAgent/releases/download/v0.4.20/GoAgent-0.4.20-win-x64-nvidia.exe) |

### จุดสำคัญ

- อัปเกรด macOS Metal, Windows OpenCL และ NVIDIA CUDA/CUDNN เป็น KataGo 1.17.1
- ใช้ Transformer 10B Balanced ทางการเป็นโมเดลเริ่มต้นที่แนะนำ พร้อมตัวเลือกแบบเบาและแบบแรง
- ตรวจสอบเวอร์ชัน ขนาด และ SHA-256 รองรับดาวน์โหลดต่อ และตรวจทรัพยากรอีกครั้งก่อนแพ็กเกจ
- Zhizi Cloud ใช้ API ทางการสำหรับบัญชี สมาชิก ยอดคงเหลือ ประวัติ และการวิเคราะห์ระยะไกล โดย local KataGo remains the default
- ศูนย์ดาวน์โหลด goagent.top รองรับ 7 ภาษา การลองใหม่อัตโนมัติ และการกู้คืนดาวน์โหลดโดยตรง
- KataGo 1.17.2 แก้ไขเฉพาะ TensorRT ดังนั้นแพ็กเกจที่ไม่ใช่ TensorRT ใช้ 1.17.1

## Tiếng Việt

### Tải xuống

| Nền tảng | Tải xuống |
| --- | --- |
| macOS Apple Silicon | [GoAgent-0.4.20-mac-arm64.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.20/GoAgent-0.4.20-mac-arm64.dmg) |
| macOS Intel | [GoAgent-0.4.20-mac-x64.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.20/GoAgent-0.4.20-mac-x64.dmg) |
| Windows x64 Standard (OpenCL) portable ZIP | [GoAgent-0.4.20-win-x64-portable.zip](https://github.com/wimi321/GoAgent/releases/download/v0.4.20/GoAgent-0.4.20-win-x64-portable.zip) |
| Windows x64 Standard (OpenCL) installer | [GoAgent-0.4.20-win-x64.exe](https://github.com/wimi321/GoAgent/releases/download/v0.4.20/GoAgent-0.4.20-win-x64.exe) |
| Windows x64 NVIDIA (CUDA/CUDNN) portable 7z | [GoAgent-0.4.20-win-x64-nvidia-portable.7z](https://github.com/wimi321/GoAgent/releases/download/v0.4.20/GoAgent-0.4.20-win-x64-nvidia-portable.7z) |
| Windows x64 NVIDIA (CUDA/CUDNN) installer | [GoAgent-0.4.20-win-x64-nvidia.exe](https://github.com/wimi321/GoAgent/releases/download/v0.4.20/GoAgent-0.4.20-win-x64-nvidia.exe) |

### Điểm mới

- Nâng cấp macOS Metal, Windows OpenCL và NVIDIA CUDA/CUDNN lên KataGo 1.17.1.
- Transformer 10B Balanced chính thức là model mặc định được khuyên dùng, kèm lựa chọn nhẹ và mạnh.
- Kiểm tra phiên bản, kích thước và SHA-256; hỗ trợ tải tiếp và kiểm tra lại tài nguyên trước khi đóng gói.
- Zhizi Cloud dùng API chính thức cho tài khoản, gói thành viên, số dư, lịch sử và phân tích từ xa; KataGo cục bộ vẫn là mặc định.
- Trung tâm tải xuống goagent.top hỗ trợ 7 ngôn ngữ, tự thử lại và khôi phục tải trực tiếp.
- KataGo 1.17.2 chỉ sửa TensorRT, vì vậy các gói không dùng TensorRT sử dụng 1.17.1.
