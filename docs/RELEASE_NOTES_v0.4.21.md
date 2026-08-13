# GoAgent v0.4.21

GoAgent v0.4.21 fixes the settings page style misalignment reported in issue #31: toggle and checkbox labels could shrink to one-character columns and render their text vertically on the right edge of the settings card. The checkbox is now auto-sized, the label text wraps normally, and settings action buttons no longer wrap vertically.

QQ群：1030632742，欢迎交流、反馈问题并一起完善 GoAgent。

## v0.4 系列延续能力

This release keeps the broader v0.4 foundation: local analysis on KataGo 1.17.1 with the official Transformer 10B Balanced model family across macOS Metal, Windows OpenCL, and Windows NVIDIA CUDA/CUDNN engines, checksummed (SHA-256) verified engine and model downloads, local KataGo remains the default compute, the official Zhizi API account and remote-analysis workflow, the stable multilingual download center on goagent.top, and KataGo 1.17.2 reserved for the separately labelled TensorRT edition.

## 中文

### 下载

| 平台 / 场景 | 下载 |
| --- | --- |
| macOS Apple Silicon（M 系列） | [GoAgent-0.4.21-mac-arm64.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.21/GoAgent-0.4.21-mac-arm64.dmg) |
| macOS Intel | [GoAgent-0.4.21-mac-x64.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.21/GoAgent-0.4.21-mac-x64.dmg) |
| Windows x64 标准版（OpenCL）免安装 ZIP，推荐大多数用户 | [GoAgent-0.4.21-win-x64-portable.zip](https://github.com/wimi321/GoAgent/releases/download/v0.4.21/GoAgent-0.4.21-win-x64-portable.zip) |
| Windows x64 标准版（OpenCL）安装版 | [GoAgent-0.4.21-win-x64.exe](https://github.com/wimi321/GoAgent/releases/download/v0.4.21/GoAgent-0.4.21-win-x64.exe) |
| Windows x64 NVIDIA 专版（CUDA/CUDNN）免安装 7z | [GoAgent-0.4.21-win-x64-nvidia-portable.7z](https://github.com/wimi321/GoAgent/releases/download/v0.4.21/GoAgent-0.4.21-win-x64-nvidia-portable.7z) |
| Windows x64 NVIDIA 专版（CUDA/CUDNN）安装版 | [GoAgent-0.4.21-win-x64-nvidia.exe](https://github.com/wimi321/GoAgent/releases/download/v0.4.21/GoAgent-0.4.21-win-x64-nvidia.exe) |

### 本版重点

- 修复设置页样式错位（issue #31）：切换“围棋分析”选项卡后，部分开关与复选框的文字曾缩成一列、在卡片右缘竖排显示。
- 根因是全局 input 宽度规则把复选框撑满整行，把文字容器挤到最小宽度；现在复选框自动适配尺寸，说明文字恢复横排。
- 设置页的按钮文字不再竖排换行；智子云付费确认复选框同款问题一并修复。
- 本机 KataGo 仍是默认算力，远程分析只在明确启用后使用。

## 繁體中文

### 下載

| 平台 / 情境 | 下載 |
| --- | --- |
| macOS Apple Silicon（M 系列） | [GoAgent-0.4.21-mac-arm64.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.21/GoAgent-0.4.21-mac-arm64.dmg) |
| macOS Intel | [GoAgent-0.4.21-mac-x64.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.21/GoAgent-0.4.21-mac-x64.dmg) |
| Windows x64 標準版（OpenCL）免安裝 ZIP，建議多數使用者 | [GoAgent-0.4.21-win-x64-portable.zip](https://github.com/wimi321/GoAgent/releases/download/v0.4.21/GoAgent-0.4.21-win-x64-portable.zip) |
| Windows x64 標準版（OpenCL）安裝版 | [GoAgent-0.4.21-win-x64.exe](https://github.com/wimi321/GoAgent/releases/download/v0.4.21/GoAgent-0.4.21-win-x64.exe) |
| Windows x64 NVIDIA（CUDA/CUDNN）免安裝 7z | [GoAgent-0.4.21-win-x64-nvidia-portable.7z](https://github.com/wimi321/GoAgent/releases/download/v0.4.21/GoAgent-0.4.21-win-x64-nvidia-portable.7z) |
| Windows x64 NVIDIA（CUDA/CUDNN）安裝版 | [GoAgent-0.4.21-win-x64-nvidia.exe](https://github.com/wimi321/GoAgent/releases/download/v0.4.21/GoAgent-0.4.21-win-x64-nvidia.exe) |

### 本版重點

- 修復設定頁樣式錯位（issue #31）：切換「圍棋分析」頁籤後，部分開關與複選框的文字曾縮成一列、在卡片右緣直排顯示。
- 根因是全域 input 寬度規則把複選框撐滿整行，把文字容器擠到最小寬度；現在複選框自動調整尺寸，說明文字恢復橫排。
- 設定頁按鈕文字不再直排換行；智子雲付費確認複選框同類問題一併修復。
- 本機 KataGo 仍是預設算力，遠端分析只在明確啟用後使用。

## English

### Downloads

| Platform / use case | Download |
| --- | --- |
| macOS Apple Silicon | [GoAgent-0.4.21-mac-arm64.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.21/GoAgent-0.4.21-mac-arm64.dmg) |
| macOS Intel | [GoAgent-0.4.21-mac-x64.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.21/GoAgent-0.4.21-mac-x64.dmg) |
| Windows x64 Standard (OpenCL) portable ZIP, recommended for most users | [GoAgent-0.4.21-win-x64-portable.zip](https://github.com/wimi321/GoAgent/releases/download/v0.4.21/GoAgent-0.4.21-win-x64-portable.zip) |
| Windows x64 Standard (OpenCL) installer | [GoAgent-0.4.21-win-x64.exe](https://github.com/wimi321/GoAgent/releases/download/v0.4.21/GoAgent-0.4.21-win-x64.exe) |
| Windows x64 NVIDIA (CUDA/CUDNN) portable 7z | [GoAgent-0.4.21-win-x64-nvidia-portable.7z](https://github.com/wimi321/GoAgent/releases/download/v0.4.21/GoAgent-0.4.21-win-x64-nvidia-portable.7z) |
| Windows x64 NVIDIA (CUDA/CUDNN) installer | [GoAgent-0.4.21-win-x64-nvidia.exe](https://github.com/wimi321/GoAgent/releases/download/v0.4.21/GoAgent-0.4.21-win-x64-nvidia.exe) |

### Highlights

- Fixed the settings page style misalignment (issue #31): after switching to the Go analysis tab, some toggle and checkbox labels could collapse to a single-character column and render vertically on the right edge of the card.
- Root cause: a global input width rule stretched checkboxes across the whole row and squeezed the label container to its minimum width. Checkboxes are now auto-sized and label text wraps normally.
- Settings action buttons no longer wrap vertically; the Zhizi paid-confirm checkbox received the same fix.
- Local KataGo remains the default; remote analysis is used only after the user explicitly enables it.

## 日本語

### ダウンロード

| プラットフォーム / 用途 | ダウンロード |
| --- | --- |
| macOS Apple Silicon（M シリーズ） | [GoAgent-0.4.21-mac-arm64.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.21/GoAgent-0.4.21-mac-arm64.dmg) |
| macOS Intel | [GoAgent-0.4.21-mac-x64.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.21/GoAgent-0.4.21-mac-x64.dmg) |
| Windows x64 標準版（OpenCL）ポータブル ZIP、多くのユーザーに推奨 | [GoAgent-0.4.21-win-x64-portable.zip](https://github.com/wimi321/GoAgent/releases/download/v0.4.21/GoAgent-0.4.21-win-x64-portable.zip) |
| Windows x64 標準版（OpenCL）インストーラー | [GoAgent-0.4.21-win-x64.exe](https://github.com/wimi321/GoAgent/releases/download/v0.4.21/GoAgent-0.4.21-win-x64.exe) |
| Windows x64 NVIDIA 版（CUDA/CUDNN）ポータブル 7z | [GoAgent-0.4.21-win-x64-nvidia-portable.7z](https://github.com/wimi321/GoAgent/releases/download/v0.4.21/GoAgent-0.4.21-win-x64-nvidia-portable.7z) |
| Windows x64 NVIDIA 版（CUDA/CUDNN）インストーラー | [GoAgent-0.4.21-win-x64-nvidia.exe](https://github.com/wimi321/GoAgent/releases/download/v0.4.21/GoAgent-0.4.21-win-x64-nvidia.exe) |

### 本バージョンのポイント

- 設定ページのレイアウト崩れ（issue #31）を修正：囲碁解析タブに切り替えると、一部のトグル・チェックボックスのラベルが一文字ずつ縦に並び、カード右端で縦書き表示されていました。
- 原因はグローバルな input 幅指定によりチェックボックスが行全体を占め、ラベル部分が最小幅まで圧縮されていたことです。チェックボックスは自動サイズに戻り、ラベルは通常の横書きになります。
- 設定ページのボタン文字が縦に折り返されなくなりました。智子雲の支払い確認チェックボックスも同様に修正しました。
- ローカル KataGo が引き続き既定です。リモート解析は明示的に有効化した場合のみ使用されます。

## 한국어

### 다운로드

| 플랫폼 / 용도 | 다운로드 |
| --- | --- |
| macOS Apple Silicon（M 시리즈） | [GoAgent-0.4.21-mac-arm64.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.21/GoAgent-0.4.21-mac-arm64.dmg) |
| macOS Intel | [GoAgent-0.4.21-mac-x64.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.21/GoAgent-0.4.21-mac-x64.dmg) |
| Windows x64 표준판（OpenCL）포터블 ZIP，대부분 사용자 권장 | [GoAgent-0.4.21-win-x64-portable.zip](https://github.com/wimi321/GoAgent/releases/download/v0.4.21/GoAgent-0.4.21-win-x64-portable.zip) |
| Windows x64 표준판（OpenCL）설치판 | [GoAgent-0.4.21-win-x64.exe](https://github.com/wimi321/GoAgent/releases/download/v0.4.21/GoAgent-0.4.21-win-x64.exe) |
| Windows x64 NVIDIA 전용（CUDA/CUDNN）포터블 7z | [GoAgent-0.4.21-win-x64-nvidia-portable.7z](https://github.com/wimi321/GoAgent/releases/download/v0.4.21/GoAgent-0.4.21-win-x64-nvidia-portable.7z) |
| Windows x64 NVIDIA 전용（CUDA/CUDNN）설치판 | [GoAgent-0.4.21-win-x64-nvidia.exe](https://github.com/wimi321/GoAgent/releases/download/v0.4.21/GoAgent-0.4.21-win-x64-nvidia.exe) |

### 이번 버전의 핵심

- 설정 페이지 스타일 어긋남(issue #31) 수정: ‘바둑 분석’ 탭으로 전환하면 일부 토글·체크박스 라벨이 한 글자씩 세로로 쌓여 카드 오른쪽 가장자리에 세로로 표시되던 문제를 해결했습니다.
- 원인은 전역 input 너비 규칙이 체크박스를 행 전체로 늘리고 라벨 컨테이너를 최소 너비로 압축한 것이었습니다. 체크박스는 자동 크기로 돌아가고 라벨은 가로로 정상 표시됩니다.
- 설정 페이지 버튼 문자가 더 이상 세로로 줄바꿈되지 않습니다. 즈지 클라우드 결제 확인 체크박스도 같은 방식으로 수정했습니다.
- 로컬 KataGo가 계속 기본입니다. 원격 분석은 사용자가 명시적으로 활성화한 경우에만 사용됩니다.

## ภาษาไทย

### ดาวน์โหลด

| แพลตฟอร์ม / กรณีใช้งาน | ดาวน์โหลด |
| --- | --- |
| macOS Apple Silicon (M series) | [GoAgent-0.4.21-mac-arm64.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.21/GoAgent-0.4.21-mac-arm64.dmg) |
| macOS Intel | [GoAgent-0.4.21-mac-x64.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.21/GoAgent-0.4.21-mac-x64.dmg) |
| Windows x64 รุ่นมาตรฐาน (OpenCL) ZIP พกพา แนะนำสำหรับผู้ใช้ส่วนใหญ่ | [GoAgent-0.4.21-win-x64-portable.zip](https://github.com/wimi321/GoAgent/releases/download/v0.4.21/GoAgent-0.4.21-win-x64-portable.zip) |
| Windows x64 รุ่นมาตรฐาน (OpenCL) ตัวติดตั้ง | [GoAgent-0.4.21-win-x64.exe](https://github.com/wimi321/GoAgent/releases/download/v0.4.21/GoAgent-0.4.21-win-x64.exe) |
| Windows x64 รุ่น NVIDIA (CUDA/CUDNN) 7z พกพา | [GoAgent-0.4.21-win-x64-nvidia-portable.7z](https://github.com/wimi321/GoAgent/releases/download/v0.4.21/GoAgent-0.4.21-win-x64-nvidia-portable.7z) |
| Windows x64 รุ่น NVIDIA (CUDA/CUDNN) ตัวติดตั้ง | [GoAgent-0.4.21-win-x64-nvidia.exe](https://github.com/wimi321/GoAgent/releases/download/v0.4.21/GoAgent-0.4.21-win-x64-nvidia.exe) |

### จุดเด่นของรุ่นนี้

- แก้ไขหน้าตั้งค่าที่เพี้ยน (issue #31): หลังสลับไปแท็บ “วิเคราะห์หมาก” ป้ายของสวิตช์และช่องทำเครื่องหมายบางรายการถูกบีบให้เรียงเป็นแนวตั้งทีละตัวอักษรที่ขอบขวาของการ์ด
- สาเหตุมาจากกฎความกว้าง input ระดับโลกทำให้ช่องทำเครื่องหมายขยายเต็มแถวและบีบป้ายให้แคบสุด ตอนนี้ช่องทำเครื่องหมายปรับขนาดอัตโนมัติและป้ายกลับมาแสดงแนวนอนปกติ
- ปุ่มบนหน้าตั้งค่าไม่ถูกตัดเป็นแนวตั้งอีกต่อไป ช่องยืนยันการชำระเงิน Zhizi Cloud ก็แก้ไขในลักษณะเดียวกัน
- KataGo ในเครื่องยังคงเป็นค่าเริ่มต้น ใช้การวิเคราะห์ระยะไกลเฉพาะเมื่อเปิดใช้งานอย่างชัดเจนเท่านั้น

## Tiếng Việt

### Tải về

| Nền tảng / trường hợp | Tải về |
| --- | --- |
| macOS Apple Silicon (dòng M) | [GoAgent-0.4.21-mac-arm64.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.21/GoAgent-0.4.21-mac-arm64.dmg) |
| macOS Intel | [GoAgent-0.4.21-mac-x64.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.21/GoAgent-0.4.21-mac-x64.dmg) |
| Windows x64 bản chuẩn (OpenCL) ZIP di động, khuyến nghị cho đa số người dùng | [GoAgent-0.4.21-win-x64-portable.zip](https://github.com/wimi321/GoAgent/releases/download/v0.4.21/GoAgent-0.4.21-win-x64-portable.zip) |
| Windows x64 bản chuẩn (OpenCL) trình cài đặt | [GoAgent-0.4.21-win-x64.exe](https://github.com/wimi321/GoAgent/releases/download/v0.4.21/GoAgent-0.4.21-win-x64.exe) |
| Windows x64 bản NVIDIA (CUDA/CUDNN) 7z di động | [GoAgent-0.4.21-win-x64-nvidia-portable.7z](https://github.com/wimi321/GoAgent/releases/download/v0.4.21/GoAgent-0.4.21-win-x64-nvidia-portable.7z) |
| Windows x64 bản NVIDIA (CUDA/CUDNN) trình cài đặt | [GoAgent-0.4.21-win-x64-nvidia.exe](https://github.com/wimi321/GoAgent/releases/download/v0.4.21/GoAgent-0.4.21-win-x64-nvidia.exe) |

### Điểm chính của bản này

- Sửa lỗi lệch bố cục trang cài đặt (issue #31): sau khi chuyển sang tab “Phân tích cờ vây”, nhãn của một số công tắc và hộp kiểm bị co lại thành từng cột một ký tự và hiển thị theo chiều dọc ở mép phải của thẻ.
- Nguyên nhân: quy tắc width toàn cục của input kéo giãn hộp kiểm ra cả hàng và ép vùng nhãn xuống chiều rộng tối thiểu. Hộp kiểm giờ tự điều chỉnh kích thước và nhãn hiển thị ngang bình thường.
- Nút trên trang cài đặt không còn bị xuống dòng theo chiều dọc; hộp xác nhận thanh toán Zhizi Cloud cũng được sửa tương tự.
- KataGo cục bộ vẫn là mặc định; chỉ dùng phân tích từ xa khi người dùng bật tường minh.
