# GoAgent v0.4.10

GoAgent v0.4.10 productizes the Zhizi Cloud direct remote-compute path, polishes the settings experience, and adds a real connection test so users can tell the difference between login/configuration problems and server-side compute quota problems. It keeps the adaptive analysis runtime, move classification 2.0, PV confidence, evidence bundles, Tool-first teacher agent, iKataGo compatibility path and local KataGo fallback paths introduced in the v0.4 line.

QQ 群：1030632742，欢迎一起交流、提建议、完善 GoAgent。

> v0.4.10 provides the Windows NVIDIA edition as both [GoAgent-0.4.10-win-x64-nvidia.exe](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-win-x64-nvidia.exe) and [Part 1](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-win-x64-nvidia-portable.7z.001) · [Part 2](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-win-x64-nvidia-portable.7z.002) · [Part 3](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-win-x64-nvidia-portable.7z.003). The portable package is published as split 7z volumes so every GitHub asset stays below the 2 GiB upload limit. Download all parts and open the .001 file with 7-Zip.

> macOS packages are signed with an Apple Developer ID certificate. This local release did not complete Apple notarization because notarize credentials were not available to electron-builder, so first launch may still show a Gatekeeper warning.

## 中文

### 下载前先选版本

| 平台 / 场景 | 推荐下载 |
| --- | --- |
| macOS Apple Silicon（M1/M2/M3/M4） | [GoAgent-0.4.10-mac-arm64.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-mac-arm64.dmg) |
| macOS Intel | [GoAgent-0.4.10-mac-x64.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-mac-x64.dmg) |
| macOS Apple Silicon Lite 轻量版 | [GoAgent-0.4.10-mac-arm64-lite.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-mac-arm64-lite.dmg) |
| macOS Intel Lite 轻量版 | [GoAgent-0.4.10-mac-x64-lite.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-mac-x64-lite.dmg) |
| Windows x64 安装版，普通用户推荐 | [GoAgent-0.4.10-win-x64.exe](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-win-x64.exe) |
| Windows x64 免安装版 | [GoAgent-0.4.10-win-x64-portable.zip](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-win-x64-portable.zip) |
| Windows x64 Lite 轻量安装版 | [GoAgent-0.4.10-win-x64-lite.exe](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-win-x64-lite.exe) |
| Windows x64 Lite 轻量免安装版 | [GoAgent-0.4.10-win-x64-lite-portable.zip](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-win-x64-lite-portable.zip) |
| Windows x64 NVIDIA 专版安装版 | [GoAgent-0.4.10-win-x64-nvidia.exe](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-win-x64-nvidia.exe) |
| Windows x64 NVIDIA 专版免安装 7z | [Part 1](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-win-x64-nvidia-portable.7z.001) · [Part 2](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-win-x64-nvidia-portable.7z.002) · [Part 3](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-win-x64-nvidia-portable.7z.003) |
| 校验文件 | [SHA256SUMS.txt](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/SHA256SUMS.txt) |

macOS 安装包已使用 Apple Developer ID 签名；本机打包时 electron-builder 没有拿到 Apple 公证参数，因此本版未完成 notarization，首次打开仍可能出现 Gatekeeper 提示。

### 本版重点

- 智子云远程算力改为更清晰的“直连”产品入口：设置页只保留用户真正需要的登录、启用、检测连接和回到本地分析。
- 新增智子云真实连接检测：会验证本地 token、Socket.IO 授权和远程 worker 分配，能明确提示“额度/算力不足”等服务器侧问题。
- 智子云连接错误文案更友好：登录失败、token 失效、网络错误、worker 分配失败、余额不足会显示不同提示，减少用户盲试。
- 远程算力 UI 不再暴露半成品原创算力/客户端路径主流程，保留 iKataGo 兼容能力但不打扰普通用户。
- 设置页远程算力区域重新整理为更紧凑的三步流程，并和 GoAgent 现有浅色/专业风格对齐。
- 新增 iKataGo 远程算力引擎：可以在设置中填写本地 `ikatago-client`、platform、用户名、密码和附加参数，连接自己的远程 GPU 服务。
- iKataGo 只在用户选择远程模式，或在自动模式下明确开启“本机慢时使用 iKataGo”时发送局面；默认不会自动上传棋谱。
- iKataGo 密码保存在 GoAgent 本机加密存储中，不使用系统钥匙串；文档明确说明运行中的客户端参数可见边界。
- 新增自适应分析运行时：当前局面、流式局面和快速整盘分析会统一接入缓存、分析档位、证据包和教学就绪判断。
- 问题手分类升级到 Move Classification 2.0，不再只看单一胜率损失，而是综合胜率差、目差损失、阶段、访问量、候选点分布、实战手证据和分析质量。
- 新增 PV confidence / evidence bundle / runtimeEvidence，让老师知道哪些变化可以强讲，哪些只能说“参考变化”，哪些需要继续加深。
- 新增 timeline review、PV playback 和 evidence panel 的稳定模型，为下一步更专业的关键手导航和变化图交互打基础。
- 老师改成 Tool-first 围棋 Agent：截图、KataGo 当前局面、整盘/区间分析、Trace Packet、候选点比较、本地知识库、定式、死活、手筋、学生画像都作为 LLM 可自主调用的工具。
- 当前手、整盘、区间和自由提问入口不再硬编码完整固定流程；按钮只发起任务，老师根据任务自己拿证据。
- 棋盘截图成为真实工具调用结果，会以高细节图片回填给多模态 LLM，并纳入 Vision Evidence Chain，避免老师误说“没有棋盘图”。
- 老师任务启动时会暂停后台 quick/live KataGo 工作，减少手动讲解时的引擎抢资源和超时。
- 当前手已有缓存分析时会复用缓存，避免重复跑 KataGo。
- API Key / TTS Key 不再使用系统钥匙串或 Electron safeStorage，改为 GoAgent 本机 secret store，避免 macOS 频繁弹授权密码。
- 文档同步说明新的本机密钥存储策略；旧钥匙串加密记录不会自动读取，重新粘贴保存一次后就会写入新本机存储。

## 繁體中文

### 下載前先選版本

| 平台 / 使用情境 | 建議下載 |
| --- | --- |
| macOS Apple Silicon（M1/M2/M3/M4） | [GoAgent-0.4.10-mac-arm64.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-mac-arm64.dmg) |
| macOS Intel | [GoAgent-0.4.10-mac-x64.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-mac-x64.dmg) |
| macOS Apple Silicon Lite 輕量版 | [GoAgent-0.4.10-mac-arm64-lite.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-mac-arm64-lite.dmg) |
| macOS Intel Lite 輕量版 | [GoAgent-0.4.10-mac-x64-lite.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-mac-x64-lite.dmg) |
| Windows x64 安裝版，一般用戶推薦 | [GoAgent-0.4.10-win-x64.exe](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-win-x64.exe) |
| Windows x64 免安裝版 | [GoAgent-0.4.10-win-x64-portable.zip](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-win-x64-portable.zip) |
| Windows x64 Lite 輕量安裝版 | [GoAgent-0.4.10-win-x64-lite.exe](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-win-x64-lite.exe) |
| Windows x64 Lite 輕量免安裝版 | [GoAgent-0.4.10-win-x64-lite-portable.zip](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-win-x64-lite-portable.zip) |
| Windows x64 NVIDIA 專版安裝版 | [GoAgent-0.4.10-win-x64-nvidia.exe](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-win-x64-nvidia.exe) |
| Windows x64 NVIDIA 專版免安裝包 | [Part 1](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-win-x64-nvidia-portable.7z.001) · [Part 2](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-win-x64-nvidia-portable.7z.002) · [Part 3](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-win-x64-nvidia-portable.7z.003) |
| 校驗檔 | [SHA256SUMS.txt](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/SHA256SUMS.txt) |

### 本版重點

- 新增 iKataGo 遠端算力引擎，可連接使用者自己的遠端 GPU 服務。
- 只有明確選擇 iKataGo，或在自動模式中開啟本機過慢時使用 iKataGo，才會送出局面。
- 新增自適應分析執行層：局面分析會帶上快取狀態、分析檔位、證據包與教學就緒判斷。
- 問題手分類升級為 Move Classification 2.0，會綜合勝率損失、目差損失、階段、訪問量、候選點分布與分析品質。
- 新增 PV confidence / evidence bundle / runtimeEvidence，讓老師能區分強證據、參考變化與需要加深的局面。
- 新增 timeline review、PV playback 與 evidence panel 模型，為後續關鍵手導航與變化圖互動打底。
- 老師升級為 Tool-first 圍棋 Agent，可自主調用棋盤截圖、KataGo、Trace Packet、候選點比較、本地知識庫、定式、死活、手筋與學生畫像。
- 棋盤截圖會作為高細節多模態證據回填給 LLM，避免缺圖誤判。
- 老師講解時會暫停後台 KataGo 任務，並優先復用已有分析快取。
- API Key / TTS Key 改用 GoAgent 本機 secret store，不再觸發 macOS 鑰匙圈授權彈窗。

## English

### Pick the right package before downloading

| Platform / use case | Recommended download |
| --- | --- |
| macOS Apple Silicon | [GoAgent-0.4.10-mac-arm64.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-mac-arm64.dmg) |
| macOS Intel | [GoAgent-0.4.10-mac-x64.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-mac-x64.dmg) |
| macOS Apple Silicon Lite | [GoAgent-0.4.10-mac-arm64-lite.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-mac-arm64-lite.dmg) |
| macOS Intel Lite | [GoAgent-0.4.10-mac-x64-lite.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-mac-x64-lite.dmg) |
| Windows x64 installer, recommended for most users | [GoAgent-0.4.10-win-x64.exe](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-win-x64.exe) |
| Windows x64 portable ZIP | [GoAgent-0.4.10-win-x64-portable.zip](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-win-x64-portable.zip) |
| Windows x64 Lite installer | [GoAgent-0.4.10-win-x64-lite.exe](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-win-x64-lite.exe) |
| Windows x64 Lite portable ZIP | [GoAgent-0.4.10-win-x64-lite-portable.zip](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-win-x64-lite-portable.zip) |
| Windows x64 NVIDIA installer | [GoAgent-0.4.10-win-x64-nvidia.exe](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-win-x64-nvidia.exe) |
| Windows x64 NVIDIA portable 7z | [Part 1](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-win-x64-nvidia-portable.7z.001) · [Part 2](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-win-x64-nvidia-portable.7z.002) · [Part 3](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-win-x64-nvidia-portable.7z.003) |
| Checksums | [SHA256SUMS.txt](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/SHA256SUMS.txt) |

### Why update

- Productizes the Zhizi Cloud direct remote-compute path with a cleaner settings flow: login, enable, test connection and return to local analysis.
- Adds a real Zhizi connection test that validates the saved token, Socket.IO authorization and remote worker allocation, with clear messaging for account quota / compute entitlement failures.
- Improves remote-compute error attribution so login, expired token, network failure, worker allocation failure and insufficient credit no longer look like the same generic KataGo error.
- Keeps the iKataGo compatibility path while making Zhizi Cloud the only user-facing direct remote-compute product surface in settings.
- Adds an iKataGo remote analysis engine path for users who own or rent remote GPU compute.
- Positions are sent to iKataGo only when the user explicitly chooses the remote mode, or enables the auto-mode slow-local threshold.
- The new adaptive analysis runtime attaches cache status, adaptive profile, teaching readiness and evidence-bundle metadata to KataGo results.
- Move Classification 2.0 combines winrate loss, score loss, phase, visits, candidate spread, actual-move evidence and analysis quality instead of relying on one threshold.
- PV confidence now marks variations as strong, medium, weak or unstable, so the teacher can use safer wording when the search evidence is not ready.
- Timeline review, PV playback and evidence-panel models prepare the next UI layer for key-move navigation and variation inspection.
- The teacher runtime is now tool-first: board screenshots, KataGo position/game/range analysis, trace packets, move comparison, local knowledge, joseki, life-and-death, tesuji and student profile data are exposed as LLM-callable tools.
- Board screenshots are real tool results and are injected back into the multimodal conversation with high-detail image evidence.
- Teacher runs pause background quick/live KataGo work and reuse current-move cache when available, reducing resource contention.
- API keys no longer use the OS keychain / Electron safeStorage. GoAgent stores them in its own local secret store to avoid repeated macOS authorization prompts.

## 日本語

### ダウンロード前に選ぶもの

| 環境 | 推奨ファイル |
| --- | --- |
| macOS Apple Silicon | [GoAgent-0.4.10-mac-arm64.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-mac-arm64.dmg) |
| macOS Intel | [GoAgent-0.4.10-mac-x64.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-mac-x64.dmg) |
| macOS Apple Silicon Lite | [GoAgent-0.4.10-mac-arm64-lite.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-mac-arm64-lite.dmg) |
| macOS Intel Lite | [GoAgent-0.4.10-mac-x64-lite.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-mac-x64-lite.dmg) |
| Windows x64 インストーラー | [GoAgent-0.4.10-win-x64.exe](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-win-x64.exe) |
| Windows x64 ポータブル ZIP | [GoAgent-0.4.10-win-x64-portable.zip](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-win-x64-portable.zip) |
| Windows x64 Lite インストーラー | [GoAgent-0.4.10-win-x64-lite.exe](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-win-x64-lite.exe) |
| Windows x64 Lite ポータブル ZIP | [GoAgent-0.4.10-win-x64-lite-portable.zip](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-win-x64-lite-portable.zip) |
| Windows x64 NVIDIA インストーラー | [GoAgent-0.4.10-win-x64-nvidia.exe](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-win-x64-nvidia.exe) |
| Windows x64 NVIDIA ポータブル 7z | [Part 1](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-win-x64-nvidia-portable.7z.001) · [Part 2](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-win-x64-nvidia-portable.7z.002) · [Part 3](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-win-x64-nvidia-portable.7z.003) |
| チェックサム | [SHA256SUMS.txt](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/SHA256SUMS.txt) |

### 主な変更

- iKataGo リモート分析エンジンを追加し、ユーザー自身のリモート GPU に接続できるようにしました。
- 明示的にリモートモードを選んだ場合、または自動モードで低速時の利用を有効にした場合だけ局面を送信します。
- 適応型分析ランタイムにより、KataGo 結果にキャッシュ状態、分析プロファイル、証拠バンドル、教師向け準備状態が付くようになりました。
- Move Classification 2.0 と PV confidence により、証拠が弱い変化を断定せず、必要なら深い分析を促せます。
- timeline review、PV playback、evidence panel のモデルを追加し、次のレビュー UI 強化に備えました。
- AI 教師が盤面画像、KataGo、候補手比較、知識ベース、定石、死活、手筋をツールとして自律的に呼び出せるようになりました。
- 盤面画像は高精細の視覚証拠として LLM に渡されます。
- API キー保存で macOS キーチェーンの確認ダイアログが出ないよう、GoAgent ローカル secret store に変更しました。

## 한국어

### 다운로드 전 선택

| 환경 | 권장 다운로드 |
| --- | --- |
| macOS Apple Silicon | [GoAgent-0.4.10-mac-arm64.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-mac-arm64.dmg) |
| macOS Intel | [GoAgent-0.4.10-mac-x64.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-mac-x64.dmg) |
| macOS Apple Silicon Lite | [GoAgent-0.4.10-mac-arm64-lite.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-mac-arm64-lite.dmg) |
| macOS Intel Lite | [GoAgent-0.4.10-mac-x64-lite.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-mac-x64-lite.dmg) |
| Windows x64 설치 프로그램 | [GoAgent-0.4.10-win-x64.exe](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-win-x64.exe) |
| Windows x64 포터블 ZIP | [GoAgent-0.4.10-win-x64-portable.zip](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-win-x64-portable.zip) |
| Windows x64 Lite 설치 프로그램 | [GoAgent-0.4.10-win-x64-lite.exe](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-win-x64-lite.exe) |
| Windows x64 Lite 포터블 ZIP | [GoAgent-0.4.10-win-x64-lite-portable.zip](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-win-x64-lite-portable.zip) |
| Windows x64 NVIDIA 설치 프로그램 | [GoAgent-0.4.10-win-x64-nvidia.exe](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-win-x64-nvidia.exe) |
| Windows x64 NVIDIA 포터블 7z | [Part 1](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-win-x64-nvidia-portable.7z.001) · [Part 2](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-win-x64-nvidia-portable.7z.002) · [Part 3](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-win-x64-nvidia-portable.7z.003) |
| 체크섬 | [SHA256SUMS.txt](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/SHA256SUMS.txt) |

### 이번 버전

- iKataGo 원격 분석 엔진을 추가해 사용자가 보유한 원격 GPU 계산 자원을 연결할 수 있습니다.
- 사용자가 명시적으로 iKataGo를 선택하거나 자동 모드의 저속 기준을 켠 경우에만 국면을 전송합니다.
- 적응형 분석 런타임이 KataGo 결과에 캐시 상태, 분석 프로필, 증거 번들, 교사용 준비 상태를 함께 제공합니다.
- Move Classification 2.0과 PV confidence로 근거가 약한 변화는 단정하지 않고, 필요하면 더 깊은 분석을 요구합니다.
- timeline review, PV playback, evidence panel 모델을 추가해 다음 단계의 핵심 수 탐색 UI 기반을 마련했습니다.
- AI 선생님이 보드 스크린샷, KataGo 분석, 후보수 비교, 로컬 지식베이스, 정석, 사활, 맥점을 직접 도구로 호출합니다.
- 보드 이미지는 고해상도 멀티모달 증거로 전달됩니다.
- API 키 저장에서 macOS 키체인 팝업을 제거하고 GoAgent 로컬 secret store를 사용합니다.

## ภาษาไทย

### เลือกไฟล์ก่อนดาวน์โหลด

| แพลตฟอร์ม | ไฟล์ที่แนะนำ |
| --- | --- |
| macOS Apple Silicon | [GoAgent-0.4.10-mac-arm64.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-mac-arm64.dmg) |
| macOS Intel | [GoAgent-0.4.10-mac-x64.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-mac-x64.dmg) |
| macOS Apple Silicon Lite | [GoAgent-0.4.10-mac-arm64-lite.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-mac-arm64-lite.dmg) |
| macOS Intel Lite | [GoAgent-0.4.10-mac-x64-lite.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-mac-x64-lite.dmg) |
| Windows x64 installer | [GoAgent-0.4.10-win-x64.exe](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-win-x64.exe) |
| Windows x64 portable ZIP | [GoAgent-0.4.10-win-x64-portable.zip](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-win-x64-portable.zip) |
| Windows x64 Lite installer | [GoAgent-0.4.10-win-x64-lite.exe](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-win-x64-lite.exe) |
| Windows x64 Lite portable ZIP | [GoAgent-0.4.10-win-x64-lite-portable.zip](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-win-x64-lite-portable.zip) |
| Windows x64 NVIDIA installer | [GoAgent-0.4.10-win-x64-nvidia.exe](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-win-x64-nvidia.exe) |
| Windows x64 NVIDIA portable 7z | [Part 1](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-win-x64-nvidia-portable.7z.001) · [Part 2](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-win-x64-nvidia-portable.7z.002) · [Part 3](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-win-x64-nvidia-portable.7z.003) |
| Checksums | [SHA256SUMS.txt](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/SHA256SUMS.txt) |

### จุดสำคัญของรุ่นนี้

- เพิ่ม iKataGo remote analysis engine สำหรับเชื่อมต่อ GPU ระยะไกลของผู้ใช้เอง
- จะส่งตำแหน่งไปยัง iKataGo เฉพาะเมื่อผู้ใช้เลือกโหมดนี้ หรือเปิดเงื่อนไขใช้เมื่อเครื่องช้าในโหมดอัตโนมัติ
- เพิ่ม adaptive analysis runtime พร้อมสถานะแคช โปรไฟล์การวิเคราะห์ evidence bundle และ teaching readiness ในผล KataGo
- Move Classification 2.0 และ PV confidence ช่วยไม่ให้ครูสรุปแรงเกินไปเมื่อหลักฐานยังอ่อน
- เพิ่มโมเดล timeline review, PV playback และ evidence panel เพื่อรองรับ UI วิเคราะห์หมากสำคัญในรุ่นถัดไป
- ครู AI เรียกใช้ภาพกระดาน, KataGo, การเปรียบเทียบตัวเลือก, ฐานความรู้, joseki, life-and-death และ tesuji เป็นเครื่องมือได้เอง
- ภาพกระดานถูกส่งกลับเป็นหลักฐานภาพความละเอียดสูงให้โมเดล multimodal
- การเก็บ API key ไม่ใช้ macOS Keychain แล้ว จึงไม่ขึ้นหน้าต่างขอรหัสผ่านซ้ำ

## Tiếng Việt

### Chọn gói tải xuống

| Nền tảng | Gói khuyến nghị |
| --- | --- |
| macOS Apple Silicon | [GoAgent-0.4.10-mac-arm64.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-mac-arm64.dmg) |
| macOS Intel | [GoAgent-0.4.10-mac-x64.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-mac-x64.dmg) |
| macOS Apple Silicon Lite | [GoAgent-0.4.10-mac-arm64-lite.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-mac-arm64-lite.dmg) |
| macOS Intel Lite | [GoAgent-0.4.10-mac-x64-lite.dmg](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-mac-x64-lite.dmg) |
| Windows x64 installer | [GoAgent-0.4.10-win-x64.exe](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-win-x64.exe) |
| Windows x64 portable ZIP | [GoAgent-0.4.10-win-x64-portable.zip](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-win-x64-portable.zip) |
| Windows x64 Lite installer | [GoAgent-0.4.10-win-x64-lite.exe](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-win-x64-lite.exe) |
| Windows x64 Lite portable ZIP | [GoAgent-0.4.10-win-x64-lite-portable.zip](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-win-x64-lite-portable.zip) |
| Windows x64 NVIDIA installer | [GoAgent-0.4.10-win-x64-nvidia.exe](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-win-x64-nvidia.exe) |
| Windows x64 NVIDIA portable 7z | [Part 1](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-win-x64-nvidia-portable.7z.001) · [Part 2](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-win-x64-nvidia-portable.7z.002) · [Part 3](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/GoAgent-0.4.10-win-x64-nvidia-portable.7z.003) |
| Checksums | [SHA256SUMS.txt](https://github.com/wimi321/GoAgent/releases/download/v0.4.10/SHA256SUMS.txt) |

### Điểm mới

- Thêm iKataGo remote analysis engine để kết nối GPU từ xa do người dùng tự quản lý.
- Vị trí chỉ được gửi tới iKataGo khi người dùng chọn chế độ này, hoặc bật ngưỡng máy chậm trong chế độ tự động.
- Runtime phân tích thích ứng nay gắn trạng thái cache, hồ sơ phân tích, evidence bundle và teaching readiness vào kết quả KataGo.
- Move Classification 2.0 và PV confidence giúp giáo viên tránh kết luận quá chắc khi bằng chứng còn yếu.
- Thêm mô hình timeline review, PV playback và evidence panel để chuẩn bị cho UI xem lại nước quan trọng ở bước tiếp theo.
- Giáo viên AI có thể tự gọi công cụ: ảnh bàn cờ, KataGo, so sánh nước đi, knowledge base, joseki, sống-chết và tesuji.
- Ảnh bàn cờ được gửi như bằng chứng thị giác độ chi tiết cao cho LLM đa phương thức.
- API key không còn dùng macOS Keychain, tránh hộp thoại xin quyền lặp lại.

## Quality baseline

Validated locally with:

- `pnpm test`
- `pnpm typecheck`
- `pnpm build`
- `pnpm check:teacher-quality`

The release keeps the existing grounded-teaching quality gates: grounded shape recognition engine, local pattern matcher, knowledge source-policy gates, optimized move-range review, quality checks and eval gates, Real Eval / engine silver fixture gate, KataGo engine pool telemetry, Release artifact smoke, student level, student age, teacher persona style settings with evidence boundary, teacher sessions, selective PR #6 integration, Kokoro selected-provider TTS, offline synthesis, Vision Evidence Chain, KataGo Trace Translator, Volcengine / Doubao TTS, iKataGo remote analysis engine, Windows OpenCL runtime bundle, KataGo OpenCL adjacent runtime files, and explicit guidance that GPU vendor OpenCL drivers still come from the user's installed graphics driver.

Thanks to layiku and wimi321.
