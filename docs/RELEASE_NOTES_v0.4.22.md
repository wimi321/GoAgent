# GoAgent v0.4.22

Windows compatibility and release validation update. This release also includes the startup, analysis rendering, retry handling, and NVIDIA NVRTC fixes merged since v0.4.21.

The bundled engines remain KataGo 1.17.1 with the official Transformer 10B Balanced model: Metal on macOS, OpenCL on standard Windows, and CUDA/CUDNN in the NVIDIA edition. SHA-256 verification, the official Zhizi API, and the multilingual download center remain available; local KataGo remains the default. KataGo 1.17.2 is reserved for upstream TensorRT-specific fixes.

## 中文

- 回移打包工具的临时钥匙串密码修复，恢复 macOS 正式签名流程，保留签名和公证校验。
- 修复 Windows 开发启动和老师冒烟测试中的盘符、文件 URL 与 `.cmd` 启动问题，支持带空格、中文的路径。
- 修复 iKataGo 参数中的 Windows 反斜杠被吞掉的问题；老师的本机命令工具使用 Windows PowerShell，并正确报告进程启动失败。
- 将 Python 复盘脚本和依赖清单从 `app.asar` 提取到应用运行目录，修复打包应用无法执行复盘脚本及依赖启动目录的问题。
- 强制 Python 语音子进程使用 UTF-8，修复中文 Windows 系统上的离线语音编码错误。
- 将显卡驱动提供的 `OpenCL.dll` 正确识别为 Windows 系统依赖，同时保留其他计算运行库的随包完整性检查。
- 修复窄窗口下分析按钮被老师面板遮挡的问题；标题栏可换行，棋盘按剩余可用空间缩放。
- 发布前强制运行测试、类型检查、教学质量与发布文档检查，验证标签和应用版本一致；任一步失败都会阻止发布。
- 增加 Windows 实际安装验证：逐文件比对安装目录与打包产物的 SHA-256，并检查卸载完成情况；校验失败会阻止发布。
- 包含此前合入的 NVIDIA NVRTC 运行库修复、启动超时限制、分析界面性能和重试改进。

### 下载 / Downloads

| 平台 / 场景 | 下载 |
| --- | --- |
| macOS Apple Silicon | [GoAgent-0.4.22-mac-arm64.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.22/GoAgent-0.4.22-mac-arm64.dmg) |
| macOS Intel | [GoAgent-0.4.22-mac-x64.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.22/GoAgent-0.4.22-mac-x64.dmg) |
| Windows 标准版 OpenCL 免安装 portable ZIP | [GoAgent-0.4.22-win-x64-portable.zip](https://github.com/wimi321/GoAgent/releases/download/v0.4.22/GoAgent-0.4.22-win-x64-portable.zip) |
| Windows 标准版 OpenCL 安装版 installer | [GoAgent-0.4.22-win-x64.exe](https://github.com/wimi321/GoAgent/releases/download/v0.4.22/GoAgent-0.4.22-win-x64.exe) |
| Windows NVIDIA CUDA/CUDNN 免安装 portable 7z | [GoAgent-0.4.22-win-x64-nvidia-portable.7z](https://github.com/wimi321/GoAgent/releases/download/v0.4.22/GoAgent-0.4.22-win-x64-nvidia-portable.7z) |
| Windows NVIDIA CUDA/CUDNN 安装版 installer | [GoAgent-0.4.22-win-x64-nvidia.exe](https://github.com/wimi321/GoAgent/releases/download/v0.4.22/GoAgent-0.4.22-win-x64-nvidia.exe) |

## 繁體中文

- 回移打包工具的暫存鑰匙圈密碼修正，恢復 macOS 正式簽署流程，保留簽署與公證驗證。
- 修正 Windows 開發啟動、老師測試與包含空格或中文的路徑處理。
- 保留 iKataGo 參數中的 Windows 反斜線；本機命令工具使用 PowerShell 並正確回報啟動錯誤。
- 將 Python 複盤腳本與相依套件清單從 `app.asar` 提取至應用程式執行目錄，修正打包應用程式無法執行複盤腳本及依賴啟動目錄的問題。
- 強制 Python 語音子程序使用 UTF-8，修正中文 Windows 系統上的離線語音編碼錯誤。
- 將顯示卡驅動程式提供的 `OpenCL.dll` 正確識別為 Windows 系統相依項目，同時保留其他計算執行庫的隨包完整性檢查。
- 修正窄視窗下分析按鈕被老師面板遮擋的問題；標題列可換行，棋盤會依剩餘可用空間縮放。
- 發布前強制檢查測試、型別、教學品質、發布文件及版本標籤；包含 NVIDIA NVRTC 與分析效能修正。
- 新增 Windows 實際安裝驗證：逐檔比對安裝目錄與打包產物的 SHA-256，並檢查解除安裝是否完成；驗證失敗會阻止發布。

## English

- Backports the packaging tool's temporary keychain password fix so macOS signing works while preserving signing and notarization checks.
- Fixes Windows development and teacher smoke startup, including file URLs and paths containing spaces or Chinese characters.
- Preserves backslashes in iKataGo arguments and uses PowerShell for Windows teacher commands, with explicit process startup failure reporting.
- Extracts the Python review script and requirements from `app.asar` into the app's runtime directory so packaged reviews can run independently of the launch directory.
- Forces Python speech subprocesses to use UTF-8, fixing offline speech encoding errors on Chinese Windows systems.
- Recognizes driver-provided `OpenCL.dll` as a Windows system dependency while retaining checks for bundled compute libraries.
- Prevents analysis buttons from being covered by the teacher panel in narrow windows. The header wraps and the board scales to the remaining available space.
- Gates releases on tests, typechecking, teaching quality, release documentation, and matching tag/package versions. Includes the previously merged NVIDIA NVRTC, startup, analysis performance, and retry fixes.
- Adds real Windows installer validation: compares every installed file with the packaged payload using SHA-256 and checks uninstall completion. A failed check blocks publication.

## 日本語

- パッケージツールの一時キーチェーンのパスワード修正を適用し、署名と公証の検証を維持したまま macOS の正式な署名処理を修復しました。
- Windows の開発起動と先生機能のテストを修正し、空白や中国語を含むパスに対応しました。
- iKataGo の引数内のバックスラッシュを保持し、Windows のローカルコマンドには PowerShell を使用して起動エラーを報告します。
- Python の棋譜検討スクリプトと依存関係リストを `app.asar` からアプリの実行用ディレクトリへ展開し、パッケージ版でも起動ディレクトリに依存せず検討を実行できるようにしました。
- Python の音声処理サブプロセスで UTF-8 を使用し、中国語環境の Windows で発生するオフライン音声の文字コードエラーを修正します。
- GPU ドライバーが提供する `OpenCL.dll` を Windows のシステム依存ライブラリとして認識し、その他の計算用ライブラリの同梱チェックは維持します。
- 狭いウィンドウで分析ボタンが先生パネルに隠れる問題を修正しました。ヘッダーは折り返され、盤面は残りの表示領域に合わせて拡縮されます。
- テスト、型検査、教材品質、リリース文書とバージョン一致を公開前に検証します。NVIDIA NVRTC と分析性能の修正も含みます。
- Windows で実際にインストールし、各ファイルの SHA-256 をパッケージ内容と照合して、アンインストールの完了も検査します。検査に失敗した場合は公開を停止します。

## 한국어

- 패키징 도구의 임시 키체인 암호 수정을 적용하여 서명 및 공증 검증을 유지하면서 macOS 서명 절차를 복구합니다.
- Windows 개발 실행과 교사 기능 테스트를 수정하고 공백이나 중국어가 포함된 경로를 처리합니다.
- iKataGo 인수의 역슬래시를 보존하고 Windows 명령에 PowerShell을 사용하며 실행 오류를 보고합니다.
- Python 복기 스크립트와 의존성 목록을 `app.asar`에서 앱의 런타임 디렉터리로 추출하여 패키지 앱에서도 시작 디렉터리와 관계없이 복기를 실행할 수 있도록 수정했습니다.
- Python 음성 하위 프로세스가 UTF-8을 사용하도록 하여 중국어 Windows 환경의 오프라인 음성 인코딩 오류를 수정합니다.
- 그래픽 드라이버가 제공하는 `OpenCL.dll`을 Windows 시스템 의존성으로 인식하며, 다른 연산 라이브러리의 패키지 포함 여부 검사는 유지합니다.
- 좁은 창에서 분석 버튼이 교사 패널에 가려지는 문제를 수정했습니다. 헤더는 줄바꿈되고 바둑판은 남은 공간에 맞게 크기가 조정됩니다.
- 배포 전에 테스트, 타입 검사, 교육 품질, 배포 문서와 버전 일치를 확인합니다. NVIDIA NVRTC 및 분석 성능 수정도 포함합니다.
- Windows에서 실제 설치를 수행하고 설치된 각 파일의 SHA-256을 패키지 내용과 비교하며 제거 완료 여부도 확인합니다. 검사에 실패하면 배포를 차단합니다.

## ภาษาไทย

- นำการแก้ไขรหัสผ่านพวงกุญแจชั่วคราวของเครื่องมือแพ็กเกจมาใช้ เพื่อแก้ไขการลงนาม macOS โดยคงการตรวจสอบลายเซ็นและการรับรองไว้
- แก้ไขการเริ่มแอปและการทดสอบครูบน Windows รวมถึงพาธที่มีช่องว่างหรืออักษรจีน
- รักษาเครื่องหมายแบ็กสแลชในอาร์กิวเมนต์ iKataGo ใช้ PowerShell สำหรับคำสั่งบน Windows และรายงานข้อผิดพลาดในการเริ่มโปรเซส
- แยกสคริปต์ทบทวนเกม Python และรายการไลบรารีที่จำเป็นออกจาก `app.asar` ไปยังไดเรกทอรีรันไทม์ของแอป เพื่อให้แอปที่แพ็กแล้วทบทวนเกมได้โดยไม่ขึ้นกับไดเรกทอรีที่ใช้เริ่มแอป
- กำหนดให้โปรเซสย่อย Python สำหรับเสียงใช้ UTF-8 เพื่อแก้ไขข้อผิดพลาดด้านการเข้ารหัสเสียงออฟไลน์บน Windows ภาษาจีน
- ระบุ `OpenCL.dll` ที่ไดรเวอร์การ์ดจอจัดเตรียมไว้เป็นส่วนประกอบของระบบ Windows อย่างถูกต้อง และยังคงตรวจสอบว่าไลบรารีประมวลผลอื่น ๆ รวมอยู่ในแพ็กเกจ
- แก้ไขปุ่มวิเคราะห์ที่ถูกแผงครูบังเมื่อหน้าต่างแคบ โดยให้ส่วนหัวขึ้นบรรทัดใหม่ได้และปรับขนาดกระดานตามพื้นที่ที่เหลือ
- ตรวจสอบการทดสอบ ชนิดข้อมูล คุณภาพการสอน เอกสาร และหมายเลขรุ่นก่อนเผยแพร่ พร้อมการแก้ไข NVIDIA NVRTC และประสิทธิภาพการวิเคราะห์
- เพิ่มการทดสอบติดตั้งจริงบน Windows โดยเปรียบเทียบ SHA-256 ของไฟล์ที่ติดตั้งทุกไฟล์กับแพ็กเกจและตรวจสอบว่าถอนการติดตั้งเสร็จสมบูรณ์ หากตรวจสอบไม่ผ่านจะไม่เผยแพร่

## Tiếng Việt

- Áp dụng bản sửa mật khẩu chuỗi khóa tạm thời của công cụ đóng gói để khôi phục ký macOS, đồng thời giữ nguyên kiểm tra chữ ký và công chứng.
- Sửa khởi chạy môi trường phát triển và kiểm thử giáo viên trên Windows, gồm đường dẫn có dấu cách hoặc chữ Trung Quốc.
- Giữ dấu gạch chéo ngược trong tham số iKataGo, dùng PowerShell cho lệnh Windows và báo lỗi khởi chạy tiến trình.
- Trích xuất tập lệnh phân tích ván đấu bằng Python và danh sách thư viện phụ thuộc từ `app.asar` vào thư mục chạy của ứng dụng, giúp bản đóng gói thực hiện phân tích mà không phụ thuộc vào thư mục khởi chạy.
- Buộc các tiến trình con Python xử lý giọng nói sử dụng UTF-8, khắc phục lỗi mã hóa giọng nói ngoại tuyến trên Windows tiếng Trung.
- Nhận diện đúng `OpenCL.dll` do trình điều khiển đồ họa cung cấp là thư viện hệ thống Windows, đồng thời tiếp tục kiểm tra các thư viện tính toán khác được đóng gói kèm ứng dụng.
- Sửa lỗi bảng giáo viên che nút phân tích khi cửa sổ hẹp. Phần tiêu đề có thể xuống dòng và bàn cờ được điều chỉnh theo không gian còn lại.
- Kiểm tra bài thử, kiểu dữ liệu, chất lượng giảng dạy, tài liệu phát hành và phiên bản trước khi công bố. Bao gồm các bản sửa NVIDIA NVRTC và hiệu năng phân tích.
- Bổ sung kiểm tra cài đặt thực tế trên Windows: đối chiếu SHA-256 của từng tệp đã cài với nội dung gói và xác nhận quá trình gỡ cài đặt hoàn tất. Kiểm tra thất bại sẽ chặn phát hành.
