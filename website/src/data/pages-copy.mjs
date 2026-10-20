// Copy for the guide, FAQ, privacy and changelog pages in seven languages.
// Button and menu names quote the application's own labels in that language (the app has no
// Vietnamese interface, so the Vietnamese pages quote the English labels). Privacy statements
// must match what the application does: local data, no telemetry, update checks off by default,
// diagnostics export only, credentials kept by the operating system.
export const pagesCopy = {
  'zh-CN': {
    docs: {
      title: '使用指南 - LizzieYzy Next',
      description: '下载、第一次打开、抓取野狐棋谱、一键分析整盘，再用问题手看懂关键失误。LizzieYzy Next 上手指南。',
      eyebrow: '使用指南',
      h1: '十分钟上手 LizzieYzy Next',
      lead: '不用研究术语。下载、打开棋谱、一键分析，再跟着问题手把关键处看懂。',
      start: { title: '开始使用', items: [
        ['下载并解压', '在官网下载中心按电脑选择版本：Windows 按显卡选，NVIDIA RTX 20 / 30 / 40 / 50 选 CUDA 版，AMD、Intel 或较旧的 NVIDIA 显卡选 OpenCL 版，没有独立显卡选 CPU 版；Mac 按芯片选择。Windows 免安装版解压即可，Mac 打开 DMG 后把程序拖进“应用程序”。'],
        ['第一次打开', '完整包自带 KataGo 引擎和默认权重，第一次打开会自动配置，不用另外下载。Mac 如果提示无法打开，到“系统设置 → 隐私与安全性”点“仍要打开”。'],
        ['打开棋谱', '点工具栏的“野狐棋谱”，输入野狐昵称，就能抓取最近的公开对局；也可以直接打开电脑里的 SGF 棋谱。'],
        ['一键分析整盘', '在“分析”菜单选择“整盘速览（闪电）”，很快就能看完全局走势；想算得更深，用“整盘精析”。']
      ] },
      read: { title: '看懂一盘棋', items: [
        ['先看胜率曲线', '曲线大幅下跌的地方，就是局势转折的地方。'],
        ['再看问题手', '“问题手”清单按胜率损失排好序。点一下跳到那一手，也可以用方向键切换、回车跳转。'],
        ['对照推荐点', '棋盘上的彩色圆圈是 KataGo 的推荐点，标着胜率和计算量。把推荐的变化摆一遍，和实战比一比。']
      ] },
      ai: { title: 'AI 陪练与 AI 解说', items: [
        ['AI 陪练', '点顶部的“AI 陪练”，选一个合适的棋力，和 AI 下一盘练习棋。'],
        ['AI 解说', '点顶部的“AI 解说”，用 ChatGPT 账号登录或填写自己的 API Key，就能请 AI 讲解当前局面。可用模型和额度由服务方决定。']
      ] },
      help: { title: '遇到问题', items: [
        ['下载慢或失败', '换个网络再试，或在下载页打开 GitHub 备用下载。'],
        ['Windows 提示“已保护你的电脑”', '确认文件来自官网或 GitHub 后，点“更多信息”，再点“仍要运行”。'],
        ['检查更新', '软件默认不自动检查更新。需要时在“帮助”菜单点“检查更新”；免安装版也可以在下载页只下载“小更新”。'],
        ['找不到功能或想反馈问题', '工具栏的“搜索功能”可以按名称找到菜单项。还解决不了，可以在“帮助 → 诊断与日志”导出诊断包，到 GitHub Issues 或 QQ 群 299419120 反馈。']
      ] }
    },
    faq: {
      title: '常见问题 - LizzieYzy Next',
      description: '下载哪个版本、要不要另装 KataGo、能不能分析野狐棋谱、会不会上传棋谱、AI 解说怎么用：LizzieYzy Next 常见问题。',
      eyebrow: '常见问题',
      h1: '常见问题',
      lead: '先回答大家最常问的：下载哪个版本、装完怎么开始、棋谱安不安全。',
      items: [
        ['软件收费吗？', '完全免费，并且开源（GPL-3.0）。AI 解说需要连接你自己的 AI 服务，用量和费用由服务方决定。'],
        ['我该下载哪个版本？', 'Windows 按显卡选：NVIDIA RTX 20 / 30 / 40 / 50 选 CUDA 版；AMD、Intel 或较旧的 NVIDIA 显卡选 OpenCL 版；没有独立显卡选 CPU 版。Mac 按芯片选择 Apple 芯片或 Intel 芯片。'],
        ['不知道自己的显卡型号怎么办？', '在 Windows 里按 Ctrl + Shift + Esc 打开任务管理器，在“性能”页点 GPU，右上角就是显卡型号。'],
        ['需要另外安装 KataGo 或下载权重吗？', '不需要。完整包已经带好 KataGo 引擎和默认权重，解压就能用，第一次打开会自动配置。'],
        ['可以分析野狐的棋谱吗？', '可以。点工具栏的“野狐棋谱”，输入野狐昵称，就能找到最近的公开对局。'],
        ['支持 Mac 和 Linux 吗？', '支持。Mac 有 Apple 芯片和 Intel 芯片两个版本，Linux 版本在 GitHub 发布。棋盘同步目前只支持 Windows。'],
        ['软件有哪些界面语言？', '简体中文、繁体中文、英语、日语、韩语和泰语。'],
        ['会上传我的棋谱吗？', '不会。棋谱和分析都在你的电脑上，软件也没有遥测。只有使用 AI 解说、远程算力这类联网功能时，必要的棋局内容才会发送给你选择的服务。'],
        ['AI 解说怎么用？', '点顶部的“AI 解说”，用 ChatGPT 账号登录，或者填写自己的 API Key。可用模型和额度由服务方决定。'],
        ['胜率、目差这些词我不懂怎么办？', '不用先懂。胜率是 KataGo 估计的获胜概率，目差是估计领先多少目。复盘时先看胜率掉得最多的几手就够了。'],
        ['GoAgent 是什么？要一起下载吗？', 'GoAgent 是另一个探索 AI 讲棋的实验项目。只想复盘不需要它，LizzieYzy Next 已经自带 AI 解说和 AI 陪练。'],
        ['怎么更新到新版本？', '软件默认不自动检查更新。需要时在“帮助”菜单点“检查更新”，或回到官网下载新版；已经在用免安装版的话，可以只下载“小更新”替换主程序。'],
        ['遇到问题怎么反馈？', '到 GitHub Issues 提交，或加入 QQ 群：LizzieYzy Next 299419120，GoAgent 1030632742。']
      ]
    },
    privacy: {
      title: '隐私说明 - LizzieYzy Next',
      description: 'LizzieYzy Next 的棋谱和设置保存在本地，没有遥测；只有使用联网功能时才会发送必要内容。也说明 GoAgent 和本网站如何处理数据。',
      eyebrow: '隐私说明',
      h1: '你的棋谱，留在你的电脑里',
      lead: '下面分别说明 LizzieYzy Next、实验项目 GoAgent 和本网站会处理哪些数据。',
      sections: [
        ['LizzieYzy Next', [
          '棋谱、分析结果和设置都保存在本地。免安装版的数据放在程序目录下的 user-data 文件夹里，升级时保留这个文件夹，棋谱和设置就都在。',
          '软件不收集使用统计，也没有遥测。',
          '自动检查更新和自动下载默认关闭；只有你在“帮助”菜单点“检查更新”时，才会联网查询新版本。',
          '诊断包只在你主动导出时生成，不会自动上传，要不要发给别人由你决定。',
          'AI 解说的登录状态和 API Key 交给系统保管：Windows 用 DPAPI 加密，macOS 存进钥匙串，Linux 使用 Secret Service。',
          '只有用到联网功能时才会联网：抓取野狐棋谱会访问野狐的公开接口；使用远程算力或 AI 解说时，必要的棋局内容会发送给你选择的服务。'
        ]],
        ['GoAgent（实验项目）', [
          '棋谱库、学生画像、老师会话、分析缓存和设置默认保存在本地。',
          '如果你配置了 LLM API，老师任务需要的棋盘截图、局面摘要、KataGo 分析和你的问题会发送给该服务。',
          '如果你配置了自定义 TTS API，朗读文本会发送给该服务；默认的 Kokoro TTS 在本地离线运行，不上传文本。'
        ]],
        ['本网站', [
          'goagent.top 是静态网站，没有数据库，不提供棋谱上传，也不使用广告追踪脚本。',
          '下载中心只读取公开的版本列表；安装包从 download.goagent.top 或 GitHub 下载。'
        ]]
      ]
    },
    changelog: {
      title: '更新日志 - LizzieYzy Next',
      description: 'LizzieYzy Next 正式版的主要更新，以及官网的近期变化。',
      eyebrow: '更新日志',
      h1: '更新日志',
      lead: '这里列出正式版的主要变化。每个版本的完整说明和所有下载文件都在 GitHub Releases。',
      releases: [
        { version: 'next-2026-10-17.1', date: '2026-10-17', label: '当前正式版', items: [
          '问题手列表可以按手数或损失排序，并支持方向键和回车快速跳转。',
          'AI 解说支持用 ChatGPT 账号登录，也可以填写自己的 API Key。',
          '规则窗口会提示当前贴目和该规则惯用值的差异，仅供参考，不会自动修改贴目。',
          '让子棋和非默认贴目的棋谱可以正常分析。',
          '导入棋谱遇到问题时会暂停并提示，不再一直等待。',
          '引擎对局落子时按声音设置播放音效。',
          '自动检查更新和自动下载默认关闭。'
        ] },
        { version: '官网改版', date: '2026-10', label: '网站', items: [
          '首页改用真实软件界面和 KataGo 的实际分析数据。',
          '下载中心按显卡和芯片直接列出版本，七种语言同步更新。',
          '使用指南、常见问题和隐私说明全部重写。'
        ] }
      ],
      more: '在 GitHub 查看全部版本'
    }
  },
  'zh-Hant': {
    docs: {
      title: '使用指南 - LizzieYzy Next',
      description: '下載、第一次開啟、抓取野狐棋譜、一鍵分析整盤，再用問題手看懂關鍵失誤。LizzieYzy Next 上手指南。',
      eyebrow: '使用指南',
      h1: '十分鐘上手 LizzieYzy Next',
      lead: '不用研究術語。下載、開啟棋譜、一鍵分析，再跟著問題手把關鍵處看懂。',
      start: { title: '開始使用', items: [
        ['下載並解壓', '在官網下載中心依電腦選擇版本：Windows 依顯示卡選，NVIDIA RTX 20 / 30 / 40 / 50 選 CUDA 版，AMD、Intel 或較舊的 NVIDIA 顯示卡選 OpenCL 版，沒有獨立顯示卡選 CPU 版；Mac 依晶片選擇。Windows 免安裝版解壓即可，Mac 開啟 DMG 後把程式拖進「應用程式」。'],
        ['第一次開啟', '完整包內建 KataGo 引擎與預設權重，第一次開啟會自動設定，不必另外下載。Mac 若提示無法開啟，請到「系統設定 → 隱私權與安全性」允許開啟這個 App。'],
        ['開啟棋譜', '點工具列的「野狐棋譜」，輸入野狐暱稱，就能抓取最近的公開對局；也可以直接開啟電腦裡的 SGF 棋譜。'],
        ['一鍵分析整盤', '在「分析」選單選擇「整盤速覽（閃電）」，很快就能看完全局走勢；想算得更深，用「整盤精析」。']
      ] },
      read: { title: '看懂一盤棋', items: [
        ['先看勝率曲線', '曲線大幅下跌的地方，就是局勢轉折的地方。'],
        ['再看問題手', '「問題手」清單依勝率損失排序。點一下跳到那一手，也可以用方向鍵切換、Enter 跳轉。'],
        ['對照推薦點', '棋盤上的彩色圓圈是 KataGo 的推薦點，標示勝率與計算量。把推薦的變化擺一遍，和實戰比一比。']
      ] },
      ai: { title: 'AI 陪練與 AI 解說', items: [
        ['AI 陪練', '點頂部的「AI 陪練」，選一個合適的棋力，和 AI 下一盤練習棋。'],
        ['AI 解說', '點頂部的「AI 解說」，用 ChatGPT 帳號登入或填寫自己的 API Key，就能請 AI 講解目前局面。可用模型與額度由服務方決定。']
      ] },
      help: { title: '遇到問題', items: [
        ['下載很慢或失敗', '換個網路再試，或在下載頁開啟 GitHub 備用下載。'],
        ['Windows 顯示「Windows 已保護您的電腦」', '確認檔案來自官網或 GitHub 後，點「其他資訊」，再點「仍要執行」。'],
        ['檢查更新', '軟體預設不會自動檢查更新。需要時在「幫助」選單點「檢查更新」；免安裝版也可以在下載頁只下載「小更新」。'],
        ['找不到功能或想回報問題', '工具列的「搜尋功能」可以依名稱找到選單項目。還是無法解決，可以在「幫助 → 診斷與日誌」匯出診斷包，到 GitHub Issues 或 QQ 群 299419120 回報。']
      ] }
    },
    faq: {
      title: '常見問題 - LizzieYzy Next',
      description: '下載哪個版本、要不要另裝 KataGo、能不能分析野狐棋譜、會不會上傳棋譜、AI 解說怎麼用：LizzieYzy Next 常見問題。',
      eyebrow: '常見問題',
      h1: '常見問題',
      lead: '先回答大家最常問的：下載哪個版本、裝好怎麼開始、棋譜安不安全。',
      items: [
        ['軟體要付費嗎？', '完全免費，而且開源（GPL-3.0）。AI 解說需要連接你自己的 AI 服務，用量與費用由服務方決定。'],
        ['我該下載哪個版本？', 'Windows 依顯示卡選：NVIDIA RTX 20 / 30 / 40 / 50 選 CUDA 版；AMD、Intel 或較舊的 NVIDIA 顯示卡選 OpenCL 版；沒有獨立顯示卡選 CPU 版。Mac 依晶片選擇 Apple 晶片或 Intel 晶片。'],
        ['不知道自己的顯示卡型號怎麼辦？', '在 Windows 按 Ctrl + Shift + Esc 開啟工作管理員，到「效能」頁點 GPU，右上角就是顯示卡型號。'],
        ['需要另外安裝 KataGo 或下載權重嗎？', '不需要。完整包已內建 KataGo 引擎與預設權重，解壓就能用，第一次開啟會自動設定。'],
        ['可以分析野狐的棋譜嗎？', '可以。點工具列的「野狐棋譜」，輸入野狐暱稱，就能找到最近的公開對局。'],
        ['支援 Mac 和 Linux 嗎？', '支援。Mac 有 Apple 晶片和 Intel 晶片兩個版本，Linux 版本在 GitHub 發布。棋盤同步目前只支援 Windows。'],
        ['軟體有哪些介面語言？', '簡體中文、繁體中文、英文、日文、韓文和泰文。'],
        ['會上傳我的棋譜嗎？', '不會。棋譜和分析都在你的電腦上，軟體也沒有遙測。只有使用 AI 解說、遠端計算這類連網功能時，必要的棋局內容才會傳送到你選擇的服務。'],
        ['AI 解說怎麼用？', '點頂部的「AI 解說」，用 ChatGPT 帳號登入，或填寫自己的 API Key。可用模型與額度由服務方決定。'],
        ['勝率、目差這些詞我看不懂怎麼辦？', '不用先懂。勝率是 KataGo 估計的獲勝機率，目差是估計領先多少目。復盤時先看勝率掉最多的幾手就夠了。'],
        ['GoAgent 是什麼？要一起下載嗎？', 'GoAgent 是另一個探索 AI 講棋的實驗專案。只想復盤不需要它，LizzieYzy Next 已內建 AI 解說與 AI 陪練。'],
        ['怎麼更新到新版本？', '軟體預設不會自動檢查更新。需要時在「幫助」選單點「檢查更新」，或回官網下載新版；已經在用免安裝版的話，可以只下載「小更新」替換主程式。'],
        ['遇到問題怎麼回報？', '到 GitHub Issues 提交，或加入 QQ 群：LizzieYzy Next 299419120，GoAgent 1030632742。']
      ]
    },
    privacy: {
      title: '隱私說明 - LizzieYzy Next',
      description: 'LizzieYzy Next 的棋譜與設定保存在本機，沒有遙測；只有使用連網功能時才會傳送必要內容。也說明 GoAgent 與本網站如何處理資料。',
      eyebrow: '隱私說明',
      h1: '你的棋譜，留在你的電腦裡',
      lead: '以下分別說明 LizzieYzy Next、實驗專案 GoAgent 和本網站會處理哪些資料。',
      sections: [
        ['LizzieYzy Next', [
          '棋譜、分析結果與設定都保存在本機。免安裝版的資料放在程式目錄下的 user-data 資料夾，升級時保留這個資料夾，棋譜和設定就都在。',
          '軟體不收集使用統計，也沒有遙測。',
          '自動檢查更新與自動下載預設關閉；只有你在「幫助」選單點「檢查更新」時，才會連網查詢新版本。',
          '診斷包只在你主動匯出時產生，不會自動上傳，要不要提供給別人由你決定。',
          'AI 解說的登入狀態與 API Key 交給系統保管：Windows 使用 DPAPI 加密，macOS 存入鑰匙圈，Linux 使用 Secret Service。',
          '只有用到連網功能時才會連網：抓取野狐棋譜會存取野狐的公開介面；使用遠端計算或 AI 解說時，必要的棋局內容會傳送到你選擇的服務。'
        ]],
        ['GoAgent（實驗專案）', [
          '棋譜庫、學生畫像、老師對話、分析快取和設定預設保存在本地。',
          '如果你設定了 LLM API，老師任務需要的棋盤截圖、局面摘要、KataGo 分析與你的問題會傳送到該服務。',
          '如果你設定了自訂 TTS API，朗讀文字會傳送到該服務；預設的 Kokoro TTS 在本地離線執行，不上傳文字。'
        ]],
        ['本網站', [
          'goagent.top 是靜態網站，沒有資料庫，不提供棋譜上傳，也不使用廣告追蹤腳本。',
          '下載中心只讀取公開的版本清單；安裝檔從 download.goagent.top 或 GitHub 下載。'
        ]]
      ]
    },
    changelog: {
      title: '更新日誌 - LizzieYzy Next',
      description: 'LizzieYzy Next 正式版的主要更新，以及官網的近期變化。',
      eyebrow: '更新日誌',
      h1: '更新日誌',
      lead: '這裡列出正式版的主要變化。每個版本的完整說明與所有下載檔案都在 GitHub Releases。',
      releases: [
        { version: 'next-2026-10-17.1', date: '2026-10-17', label: '目前正式版', items: [
          '問題手清單可依手數或損失排序，並支援方向鍵與 Enter 快速跳轉。',
          'AI 解說支援 ChatGPT 帳號登入，也可以填寫自己的 API Key。',
          '規則視窗會提示目前貼目與該規則慣用值的差異，僅供參考，不會自動修改貼目。',
          '讓子棋與非預設貼目的棋譜可以正常分析。',
          '匯入棋譜遇到問題時會暫停並提示，不再一直等待。',
          '引擎對局落子時依聲音設定播放音效。',
          '自動檢查更新與自動下載預設關閉。'
        ] },
        { version: '官網改版', date: '2026-10', label: '網站', items: [
          '首頁改用實際軟體介面與 KataGo 的真實分析資料。',
          '下載中心依顯示卡與晶片直接列出版本，七種語言同步更新。',
          '使用指南、常見問題與隱私說明全部重寫。'
        ] }
      ],
      more: '在 GitHub 查看全部版本'
    }
  },
  en: {
    docs: {
      title: 'Guide - LizzieYzy Next',
      description: 'Download, first launch, fetching Fox games, analyzing a whole game and reading the problem moves: a quick start for LizzieYzy Next.',
      eyebrow: 'Guide',
      h1: 'Get started with LizzieYzy Next',
      lead: 'No jargon needed. Download, open a game, analyze it in one click, then let the problem moves show you what mattered.',
      start: { title: 'Getting started', items: [
        ['Download and unzip', 'Pick the build for your computer in the official download center. On Windows, choose by graphics card: CUDA for NVIDIA RTX 20 / 30 / 40 / 50, OpenCL for AMD, Intel or older NVIDIA cards, and CPU if you have no dedicated graphics card. On a Mac, choose by chip. Unzip the Windows portable build and run it; on a Mac, open the DMG and drag the app to Applications.'],
        ['First launch', 'Complete packages include the KataGo engine and a default network, and the first launch sets everything up. There is nothing else to download. If macOS says the app cannot be opened, go to System Settings → Privacy & Security and click Open Anyway.'],
        ['Open a game', 'Click Fox Kifu in the toolbar and enter a Fox nickname to fetch recent public games, or open an SGF file from your computer.'],
        ['Analyze the whole game', 'In the Analyze menu, choose Whole-game lightning overview to see the shape of the game quickly. For a deeper look, use Whole-game deep analysis.']
      ] },
      read: { title: 'Reading a game', items: [
        ['Start with the win-rate graph', 'Where the graph drops sharply is where the game turned.'],
        ['Then the problem moves', 'The Problem moves list is sorted by how much each move cost. Click one to jump there, or use the arrow keys and Enter.'],
        ['Compare with the suggestions', 'The colored circles on the board are KataGo’s suggestions, with win rate and visits. Play out the suggested line and compare it with the game.']
      ] },
      ai: { title: 'AI Coach and AI Commentary', items: [
        ['AI Coach', 'Click AI Coach at the top, choose a strength, and play a practice game against AI.'],
        ['AI Commentary', 'Click AI Commentary at the top and sign in with ChatGPT or enter your own API key to have AI explain the position. Available models and limits depend on your provider.']
      ] },
      help: { title: 'Troubleshooting', items: [
        ['Slow or failed download', 'Try another network, or open the GitHub backup download on the download page.'],
        ['Windows says “Windows protected your PC”', 'Make sure the file came from this site or GitHub, then click More info and Run anyway.'],
        ['Checking for updates', 'Automatic update checks are off by default. Use Help → Check update when you want one; portable users can download just the small update from the download page.'],
        ['Can’t find a feature, or need help', 'Search features in the toolbar finds menu items by name. If you are still stuck, export a diagnostics bundle from Help → Diagnostics and Logs and report the problem on GitHub Issues.']
      ] }
    },
    faq: {
      title: 'FAQ - LizzieYzy Next',
      description: 'Which version to download, whether you need KataGo, Fox games, privacy and AI Commentary: frequently asked questions about LizzieYzy Next.',
      eyebrow: 'FAQ',
      h1: 'Frequently asked questions',
      lead: 'The questions we hear most: which version to download, how to get started, and whether your games stay private.',
      items: [
        ['Is it free?', 'Yes. It is free and open source (GPL-3.0). AI Commentary connects to an AI service of your choice, whose usage limits and fees apply.'],
        ['Which version should I download?', 'On Windows, choose by graphics card: CUDA for NVIDIA RTX 20 / 30 / 40 / 50, OpenCL for AMD, Intel or older NVIDIA cards, and CPU if you have no dedicated graphics card. On a Mac, choose Apple silicon or Intel.'],
        ['How do I find my graphics card?', 'On Windows, press Ctrl + Shift + Esc to open Task Manager, open the Performance tab and select GPU. The model is shown at the top right.'],
        ['Do I need to install KataGo or download a network?', 'No. Complete packages already include the KataGo engine and a default network. Unzip, open, and the first launch sets everything up.'],
        ['Can it analyze my Fox games?', 'Yes. Click Fox Kifu in the toolbar and enter a Fox nickname to find recent public games.'],
        ['Does it run on Mac and Linux?', 'Yes. There are builds for Apple silicon and Intel Macs, and Linux builds are published on GitHub. Board sync is Windows only for now.'],
        ['Which interface languages are available?', 'Simplified Chinese, Traditional Chinese, English, Japanese, Korean and Thai.'],
        ['Will my games be uploaded?', 'No. Your games and analysis stay on your computer, and the app has no telemetry. Only online features such as AI Commentary or Remote Compute send the necessary game data to the service you choose.'],
        ['How do I use AI Commentary?', 'Click AI Commentary at the top and sign in with ChatGPT, or enter your own API key. Available models and limits depend on your provider.'],
        ['I don’t know terms like win rate or score lead.', 'You don’t need to yet. Win rate is KataGo’s estimate of the chance to win, and score lead estimates how many points a side is ahead. Start with the moves where the win rate dropped the most.'],
        ['What is GoAgent? Do I need it?', 'GoAgent is a separate experimental project exploring AI Go teaching. You don’t need it to review games: LizzieYzy Next already includes AI Commentary and AI Coach.'],
        ['How do I update?', 'Automatic update checks are off by default. Use Help → Check update, or download the new version from this site. Portable users can download just the small update.'],
        ['Where can I report a problem?', 'Open an issue on GitHub, or join the QQ groups: LizzieYzy Next 299419120, GoAgent 1030632742.']
      ]
    },
    privacy: {
      title: 'Privacy - LizzieYzy Next',
      description: 'LizzieYzy Next keeps your games and settings on your computer and has no telemetry. Data leaves only when you use an online feature. Also covers GoAgent and this website.',
      eyebrow: 'Privacy',
      h1: 'Your games stay on your computer',
      lead: 'Here is what LizzieYzy Next, the experimental GoAgent project and this website do with your data.',
      sections: [
        ['LizzieYzy Next', [
          'Games, analysis and settings are stored locally. The portable edition keeps them in the user-data folder next to the app; keep that folder when you upgrade.',
          'The app collects no usage statistics and has no telemetry.',
          'Automatic update checks and downloads are off by default. The app looks for a new version only when you choose Help → Check update.',
          'A diagnostics bundle is created only when you export one. It is never uploaded automatically, and you decide whether to share it.',
          'AI Commentary sign-ins and API keys are kept by your system: encrypted with DPAPI on Windows, in the Keychain on macOS, and in Secret Service on Linux.',
          'The app goes online only for online features: fetching Fox games contacts Fox’s public service, and Remote Compute or AI Commentary send the necessary game data to the service you choose.'
        ]],
        ['GoAgent (experimental)', [
          'The game library, student profiles, teacher sessions, analysis cache and settings are stored locally by default.',
          'If you configure an LLM API, the board image, position summary, KataGo analysis and your question that a teacher task needs are sent to that service.',
          'If you configure a custom TTS API, the text to be read aloud is sent to that service. The default Kokoro TTS runs offline on your computer and uploads nothing.'
        ]],
        ['This website', [
          'goagent.top is a static website. It has no database, no game uploads and no ad-tracking scripts.',
          'The download center only reads the public list of releases; installers come from download.goagent.top or GitHub.'
        ]]
      ]
    },
    changelog: {
      title: 'Changelog - LizzieYzy Next',
      description: 'The main changes in each stable release of LizzieYzy Next, plus recent website updates.',
      eyebrow: 'Changelog',
      h1: 'Changelog',
      lead: 'The main changes in each stable release. Full notes and every download are on GitHub Releases.',
      releases: [
        { version: 'next-2026-10-17.1', date: '2026-10-17', label: 'Current stable', items: [
          'The problem-move list can be sorted by move number or loss, with arrow-key and Enter navigation.',
          'AI Commentary supports signing in with ChatGPT or using your own API key.',
          'The Rules window notes when komi differs from the usual value for the rules. It is a hint only and never changes komi.',
          'Handicap games and games with non-default komi are analyzed correctly.',
          'When importing a game runs into a problem, the app pauses and tells you instead of waiting indefinitely.',
          'Engine games play move sounds according to your sound settings.',
          'Automatic update checks and downloads are off by default.'
        ] },
        { version: 'Website redesign', date: '2026-10', label: 'Website', items: [
          'The homepage now shows the real app and real KataGo analysis.',
          'The download center lists builds by graphics card and chip, in all seven languages.',
          'The guide, FAQ and privacy pages were rewritten.'
        ] }
      ],
      more: 'See all releases on GitHub'
    }
  },
  ja: {
    docs: {
      title: 'ガイド - LizzieYzy Next',
      description: 'ダウンロード、初回起動、野狐の棋譜取得、一局まるごとの分析、問題手の見方まで。LizzieYzy Next のはじめ方。',
      eyebrow: 'ガイド',
      h1: 'LizzieYzy Next をはじめる',
      lead: '専門用語は不要です。ダウンロードして棋譜を開き、ワンクリックで分析。あとは問題手が大事な場面を教えてくれます。',
      start: { title: 'はじめに', items: [
        ['ダウンロードして展開', '公式ダウンロードセンターでパソコンに合う版を選びます。Windows は GPU で選び、NVIDIA RTX 20 / 30 / 40 / 50 は CUDA 版、AMD・Intel・旧型 NVIDIA は OpenCL 版、専用 GPU がなければ CPU 版です。Mac はチップで選びます。Windows のポータブル版は展開するだけ、Mac は DMG を開いてアプリを「アプリケーション」へドラッグします。'],
        ['初回起動', '完全版には KataGo エンジンと既定のネットワークが入っていて、初回起動時に自動で設定されます。追加のダウンロードは不要です。macOS で開けないと表示されたら、「システム設定 → プライバシーとセキュリティ」で「このまま開く」をクリックしてください。'],
        ['棋譜を開く', 'ツールバーの「野狐棋譜」で野狐のニックネームを入力すると、最近の公開対局を取得できます。パソコン内の SGF ファイルも開けます。'],
        ['一局まるごと分析', '「分析」メニューの「全局クイック概観」で、一局の流れをすばやくつかめます。もっと深く読ませたいときは「全局精密解析」を使います。']
      ] },
      read: { title: '一局の読み方', items: [
        ['まず勝率グラフ', 'グラフが大きく下がったところが、形勢の分かれ目です。'],
        ['次に問題手', '「問題手」の一覧は損失の大きい順に並びます。クリックでその手へ移動でき、矢印キーと Enter でも操作できます。'],
        ['候補手と比べる', '盤上の色付きの円が KataGo の候補手で、勝率と探索数が表示されます。推奨の変化を並べて、実戦と比べてみましょう。']
      ] },
      ai: { title: 'AI コーチと AI 解説', items: [
        ['AI コーチ', '上部の「AI コーチ」をクリックし、強さを選んで AI と練習対局を打ちます。'],
        ['AI 解説', '上部の「AI 解説」から ChatGPT でログインするか、自分の API キーを入力すると、AI が局面を解説します。使えるモデルと利用枠はサービス提供元によります。']
      ] },
      help: { title: '困ったとき', items: [
        ['ダウンロードが遅い・失敗する', '別のネットワークで試すか、ダウンロードページから GitHub の予備ダウンロードを開いてください。'],
        ['Windows で「PC が保護されました」と表示される', 'ファイルがこのサイトか GitHub から入手したものであることを確認し、「詳細情報」→「実行」をクリックします。'],
        ['更新の確認', '自動の更新確認は既定でオフです。必要なときに「ヘルプ」メニューの「更新の確認」を使ってください。ポータブル版はダウンロードページの小型更新だけでも更新できます。'],
        ['機能が見つからない・問題を報告したい', 'ツールバーの「機能を検索」で、メニュー項目を名前から探せます。それでも解決しないときは、「ヘルプ → 診断とログ」から診断パッケージを書き出し、GitHub Issues で報告してください。']
      ] }
    },
    faq: {
      title: 'よくある質問 - LizzieYzy Next',
      description: 'どの版を選ぶか、KataGo の導入、野狐の棋譜、プライバシー、AI 解説の使い方など、LizzieYzy Next のよくある質問。',
      eyebrow: 'よくある質問',
      h1: 'よくある質問',
      lead: 'どの版を選ぶか、どう始めるか、棋譜は安全か。よく聞かれる質問にまとめて答えます。',
      items: [
        ['無料ですか？', 'はい。無料のオープンソース（GPL-3.0）です。AI 解説は自分で選んだ AI サービスに接続するため、その利用枠と料金が適用されます。'],
        ['どの版をダウンロードすればいい？', 'Windows は GPU で選びます。NVIDIA RTX 20 / 30 / 40 / 50 は CUDA 版、AMD・Intel・旧型 NVIDIA は OpenCL 版、専用 GPU がなければ CPU 版です。Mac は Apple シリコンか Intel を選びます。'],
        ['GPU の型番が分からない', 'Windows で Ctrl + Shift + Esc を押してタスク マネージャーを開き、「パフォーマンス」タブで GPU を選ぶと、右上に型番が表示されます。'],
        ['KataGo のインストールやネットワークのダウンロードは必要？', '不要です。完全版には KataGo エンジンと既定のネットワークが入っていて、展開して開けば初回起動時に自動で設定されます。'],
        ['野狐の棋譜を分析できる？', 'できます。ツールバーの「野狐棋譜」で野狐のニックネームを入力すると、最近の公開対局が見つかります。'],
        ['Mac や Linux でも使える？', '使えます。Mac は Apple シリコン版と Intel 版があり、Linux 版は GitHub で公開しています。盤面同期は現在 Windows のみです。'],
        ['表示言語は？', '簡体字中国語、繁体字中国語、英語、日本語、韓国語、タイ語です。'],
        ['棋譜はアップロードされる？', 'されません。棋譜と分析はパソコンの中にあり、テレメトリーもありません。AI 解説やリモートコンピューティングなどのオンライン機能を使うときだけ、必要な棋譜情報が選んだサービスに送られます。'],
        ['AI 解説の使い方は？', '上部の「AI 解説」から ChatGPT でログインするか、自分の API キーを入力します。使えるモデルと利用枠はサービス提供元によります。'],
        ['勝率や目数差の意味が分からない', '最初は知らなくて大丈夫です。勝率は KataGo が見積もった勝つ確率、目数差は何目リードしているかの見積もりです。まずは勝率が大きく下がった手から見てみましょう。'],
        ['GoAgent とは？一緒に必要？', 'GoAgent は AI による囲碁の解説を探る別の実験プロジェクトです。復盤だけなら不要で、LizzieYzy Next には AI 解説と AI コーチが入っています。'],
        ['アップデートの方法は？', '自動の更新確認は既定でオフです。「ヘルプ」メニューの「更新の確認」を使うか、このサイトから新しい版をダウンロードしてください。ポータブル版は小型更新だけでも更新できます。'],
        ['問題を報告するには？', 'GitHub Issues で報告するか、QQ グループ（LizzieYzy Next 299419120、GoAgent 1030632742）に参加してください。']
      ]
    },
    privacy: {
      title: 'プライバシー - LizzieYzy Next',
      description: 'LizzieYzy Next は棋譜と設定をパソコン内に保存し、テレメトリーはありません。データが送られるのはオンライン機能を使うときだけです。GoAgent と本サイトについても説明します。',
      eyebrow: 'プライバシー',
      h1: '棋譜は、あなたのパソコンの中に',
      lead: 'LizzieYzy Next、実験プロジェクトの GoAgent、そして本サイトが扱うデータを説明します。',
      sections: [
        ['LizzieYzy Next', [
          '棋譜、分析結果、設定はローカルに保存されます。ポータブル版はアプリと同じ場所の user-data フォルダーに保存するので、アップデート時はこのフォルダーを残してください。',
          '利用統計の収集やテレメトリーはありません。',
          '自動の更新確認と自動ダウンロードは既定でオフです。新しい版を確認するのは「ヘルプ」→「更新の確認」を選んだときだけです。',
          '診断パッケージは書き出したときにだけ作られ、自動でアップロードされることはありません。共有するかどうかはあなたが決めます。',
          'AI 解説のログイン情報と API キーは OS が保管します。Windows は DPAPI で暗号化、macOS はキーチェーン、Linux は Secret Service を使います。',
          'オンライン機能を使うときだけ通信します。野狐の棋譜取得では野狐の公開サービスに接続し、リモートコンピューティングや AI 解説では必要な棋譜情報を選んだサービスに送ります。'
        ]],
        ['GoAgent（実験プロジェクト）', [
          '棋譜ライブラリ、学習者プロフィール、先生との会話、分析キャッシュ、設定は既定でローカルに保存されます。',
          'LLM API を設定すると、先生タスクに必要な盤面画像、局面の要約、KataGo の分析、あなたの質問がそのサービスに送られます。',
          'カスタム TTS API を設定すると、読み上げるテキストがそのサービスに送られます。既定の Kokoro TTS はローカルでオフライン動作し、テキストを送信しません。'
        ]],
        ['本サイト', [
          'goagent.top は静的サイトで、データベースも棋譜のアップロード機能も広告トラッキング用スクリプトもありません。',
          'ダウンロードセンターは公開されているリリース一覧だけを読み込みます。インストーラーは download.goagent.top または GitHub から配布されます。'
        ]]
      ]
    },
    changelog: {
      title: '更新履歴 - LizzieYzy Next',
      description: 'LizzieYzy Next の安定版ごとの主な変更と、公式サイトの最近の更新。',
      eyebrow: '更新履歴',
      h1: '更新履歴',
      lead: '安定版の主な変更点です。各版の詳しい説明とすべてのダウンロードは GitHub Releases にあります。',
      releases: [
        { version: 'next-2026-10-17.1', date: '2026-10-17', label: '現在の安定版', items: [
          '問題手の一覧を手数順・損失順に並べ替えられ、矢印キーと Enter で移動できるようになりました。',
          'AI 解説で ChatGPT ログインと自分の API キーが使えるようになりました。',
          '「ルール」ウィンドウで、コミがそのルールの通常値と違うときに知らせます。参考表示のみで、コミを自動で変えることはありません。',
          '置き碁や既定以外のコミの棋譜を正しく分析できるようになりました。',
          '棋譜の読み込みで問題が起きたとき、待ち続けずに一時停止して知らせるようになりました。',
          'エンジン対局で、サウンド設定に従って着手音が鳴ります。',
          '自動の更新確認と自動ダウンロードは既定でオフになりました。'
        ] },
        { version: '公式サイトのリニューアル', date: '2026-10', label: 'サイト', items: [
          'トップページで実際のアプリ画面と KataGo の実際の分析を紹介するようにしました。',
          'ダウンロードセンターで GPU とチップ別に版を並べ、7 言語すべてを更新しました。',
          'ガイド、よくある質問、プライバシーのページを書き直しました。'
        ] }
      ],
      more: 'GitHub ですべての版を見る'
    }
  },
  ko: {
    docs: {
      title: '가이드 - LizzieYzy Next',
      description: '다운로드, 첫 실행, Fox 기보 받기, 전체 대국 분석, 문제 수 보는 법까지. LizzieYzy Next 시작 가이드.',
      eyebrow: '가이드',
      h1: 'LizzieYzy Next 시작하기',
      lead: '어려운 용어는 몰라도 됩니다. 다운로드하고 기보를 연 뒤 클릭 한 번으로 분석하면, 문제 수가 중요한 장면을 알려 줍니다.',
      start: { title: '시작하기', items: [
        ['다운로드하고 압축 풀기', '공식 다운로드 센터에서 컴퓨터에 맞는 버전을 고르세요. Windows는 그래픽 카드에 따라 NVIDIA RTX 20 / 30 / 40 / 50은 CUDA 버전, AMD·Intel·구형 NVIDIA는 OpenCL 버전, 외장 그래픽 카드가 없으면 CPU 버전을 고릅니다. Mac은 칩에 따라 고릅니다. Windows 포터블 버전은 압축만 풀면 되고, Mac은 DMG를 열어 앱을 응용 프로그램 폴더로 드래그합니다.'],
        ['첫 실행', '전체 패키지에 KataGo 엔진과 기본 신경망이 들어 있어 첫 실행 때 자동으로 설정됩니다. 따로 내려받을 것은 없습니다. macOS에서 열 수 없다는 안내가 나오면 시스템 설정 → 개인정보 보호 및 보안에서 ‘그래도 열기’를 누르세요.'],
        ['기보 열기', '툴바의 ‘Fox 기보’에서 Fox 닉네임을 입력하면 최근 공개 대국을 가져옵니다. 컴퓨터에 있는 SGF 파일도 열 수 있습니다.'],
        ['전체 대국 분석', '‘분석’ 메뉴의 ‘전체 대국 번개 개요’로 대국 흐름을 빠르게 봅니다. 더 깊이 보려면 ‘전체 대국 정밀 분석’을 쓰세요.']
      ] },
      read: { title: '대국 읽는 법', items: [
        ['먼저 승률 그래프', '그래프가 크게 떨어지는 곳이 형세가 바뀐 곳입니다.'],
        ['다음은 문제 수', '‘문제 수’ 목록은 손실이 큰 순서로 정리됩니다. 클릭하면 그 수로 이동하고, 방향키와 Enter로도 이동할 수 있습니다.'],
        ['추천 수와 비교', '바둑판 위의 색깔 원이 KataGo 추천 수이며 승률과 탐색 수가 표시됩니다. 추천 변화를 놓아 보고 실전과 비교해 보세요.']
      ] },
      ai: { title: 'AI 코치와 AI 해설', items: [
        ['AI 코치', '위쪽의 ‘AI 코치’를 눌러 기력을 고르고 AI와 연습 대국을 둡니다.'],
        ['AI 해설', '위쪽의 ‘AI 해설’에서 ChatGPT로 로그인하거나 본인의 API 키를 입력하면 AI가 현재 국면을 해설합니다. 사용 가능한 모델과 한도는 서비스 제공업체에 따릅니다.']
      ] },
      help: { title: '문제 해결', items: [
        ['다운로드가 느리거나 실패할 때', '다른 네트워크로 시도하거나 다운로드 페이지에서 GitHub 예비 다운로드를 여세요.'],
        ['Windows에서 ‘PC 보호’ 안내가 나올 때', '파일을 이 사이트나 GitHub에서 받았는지 확인한 뒤 ‘추가 정보’ → ‘실행’을 누르세요.'],
        ['업데이트 확인', '자동 업데이트 확인은 기본적으로 꺼져 있습니다. 필요할 때 ‘도움말’ 메뉴의 ‘업데이트 확인’을 누르세요. 포터블 버전은 다운로드 페이지에서 작은 업데이트만 받아도 됩니다.'],
        ['기능을 찾을 수 없거나 문제를 신고하려면', '툴바의 ‘기능 검색’으로 메뉴 항목을 이름으로 찾을 수 있습니다. 그래도 해결되지 않으면 ‘도움말 → 진단 및 로그’에서 진단 패키지를 내보내 GitHub Issues에 신고하세요.']
      ] }
    },
    faq: {
      title: '자주 묻는 질문 - LizzieYzy Next',
      description: '어떤 버전을 받을지, KataGo 설치, Fox 기보, 개인정보, AI 해설 사용법 등 LizzieYzy Next 자주 묻는 질문.',
      eyebrow: '자주 묻는 질문',
      h1: '자주 묻는 질문',
      lead: '어떤 버전을 받을지, 어떻게 시작할지, 기보는 안전한지. 가장 많이 묻는 질문부터 답합니다.',
      items: [
        ['무료인가요?', '네. 무료 오픈소스(GPL-3.0)입니다. AI 해설은 직접 선택한 AI 서비스에 연결하므로 해당 서비스의 한도와 요금이 적용됩니다.'],
        ['어떤 버전을 받아야 하나요?', 'Windows는 그래픽 카드에 따라 고릅니다. NVIDIA RTX 20 / 30 / 40 / 50은 CUDA 버전, AMD·Intel·구형 NVIDIA는 OpenCL 버전, 외장 그래픽 카드가 없으면 CPU 버전입니다. Mac은 Apple 실리콘 또는 Intel을 고르세요.'],
        ['그래픽 카드 모델을 모르겠어요', 'Windows에서 Ctrl + Shift + Esc로 작업 관리자를 열고 ‘성능’ 탭에서 GPU를 선택하면 오른쪽 위에 모델명이 나옵니다.'],
        ['KataGo를 설치하거나 신경망을 따로 받아야 하나요?', '아니요. 전체 패키지에 KataGo 엔진과 기본 신경망이 들어 있어, 압축을 풀고 실행하면 첫 실행 때 자동으로 설정됩니다.'],
        ['Fox 기보도 분석할 수 있나요?', '네. 툴바의 ‘Fox 기보’에서 Fox 닉네임을 입력하면 최근 공개 대국을 찾을 수 있습니다.'],
        ['Mac과 Linux에서도 되나요?', '네. Mac은 Apple 실리콘과 Intel 버전이 있고, Linux 버전은 GitHub에 공개됩니다. 바둑판 동기화는 현재 Windows만 지원합니다.'],
        ['어떤 언어로 쓸 수 있나요?', '중국어 간체, 중국어 번체, 영어, 일본어, 한국어, 태국어를 지원합니다.'],
        ['기보가 업로드되나요?', '아니요. 기보와 분석은 내 컴퓨터에 있고, 원격 측정(텔레메트리)도 없습니다. AI 해설이나 원격 컴퓨팅 같은 온라인 기능을 쓸 때만 필요한 기보 정보가 선택한 서비스로 전송됩니다.'],
        ['AI 해설은 어떻게 쓰나요?', '위쪽의 ‘AI 해설’에서 ChatGPT로 로그인하거나 본인의 API 키를 입력하세요. 사용 가능한 모델과 한도는 서비스 제공업체에 따릅니다.'],
        ['승률, 집 차이 같은 말을 모르겠어요', '몰라도 괜찮습니다. 승률은 KataGo가 추정한 이길 확률이고, 집 차이는 몇 집 앞서는지에 대한 추정입니다. 먼저 승률이 가장 크게 떨어진 수부터 보세요.'],
        ['GoAgent는 무엇인가요? 같이 받아야 하나요?', 'GoAgent는 AI 바둑 해설을 탐구하는 별도의 실험 프로젝트입니다. 복기만 한다면 필요 없습니다. LizzieYzy Next에 AI 해설과 AI 코치가 들어 있습니다.'],
        ['업데이트는 어떻게 하나요?', '자동 업데이트 확인은 기본적으로 꺼져 있습니다. ‘도움말’ 메뉴의 ‘업데이트 확인’을 쓰거나 이 사이트에서 새 버전을 받으세요. 포터블 버전은 작은 업데이트만 받아도 됩니다.'],
        ['문제는 어디에 신고하나요?', 'GitHub Issues에 올리거나 QQ 그룹(LizzieYzy Next 299419120, GoAgent 1030632742)에 참여하세요.']
      ]
    },
    privacy: {
      title: '개인정보 - LizzieYzy Next',
      description: 'LizzieYzy Next는 기보와 설정을 내 컴퓨터에 저장하며 원격 측정이 없습니다. 온라인 기능을 쓸 때만 데이터가 전송됩니다. GoAgent와 이 웹사이트도 함께 설명합니다.',
      eyebrow: '개인정보',
      h1: '기보는 내 컴퓨터에 그대로',
      lead: 'LizzieYzy Next, 실험 프로젝트 GoAgent, 그리고 이 웹사이트가 어떤 데이터를 다루는지 설명합니다.',
      sections: [
        ['LizzieYzy Next', [
          '기보, 분석 결과, 설정은 로컬에 저장됩니다. 포터블 버전은 프로그램 폴더의 user-data 폴더에 저장하므로 업데이트할 때 이 폴더를 그대로 두세요.',
          '사용 통계를 수집하지 않으며 원격 측정도 없습니다.',
          '자동 업데이트 확인과 자동 다운로드는 기본적으로 꺼져 있습니다. ‘도움말’ → ‘업데이트 확인’을 누를 때만 새 버전을 확인합니다.',
          '진단 패키지는 직접 내보낼 때만 만들어지고 자동으로 업로드되지 않습니다. 공유 여부는 사용자가 정합니다.',
          'AI 해설의 로그인 정보와 API 키는 운영체제가 보관합니다. Windows는 DPAPI로 암호화하고, macOS는 키체인, Linux는 Secret Service를 사용합니다.',
          '온라인 기능을 쓸 때만 네트워크에 연결합니다. Fox 기보를 받을 때는 Fox의 공개 서비스에 접속하고, 원격 컴퓨팅이나 AI 해설을 쓸 때는 필요한 기보 정보를 선택한 서비스로 보냅니다.'
        ]],
        ['GoAgent(실험 프로젝트)', [
          '기보 라이브러리, 학습자 프로필, 선생님 대화, 분석 캐시, 설정은 기본적으로 로컬에 저장됩니다.',
          'LLM API를 설정하면 선생님 작업에 필요한 바둑판 이미지, 국면 요약, KataGo 분석, 사용자의 질문이 해당 서비스로 전송됩니다.',
          '사용자 지정 TTS API를 설정하면 읽어 줄 텍스트가 해당 서비스로 전송됩니다. 기본 Kokoro TTS는 로컬에서 오프라인으로 동작하며 텍스트를 보내지 않습니다.'
        ]],
        ['이 웹사이트', [
          'goagent.top은 정적 웹사이트로, 데이터베이스와 기보 업로드 기능, 광고 추적 스크립트가 없습니다.',
          '다운로드 센터는 공개된 릴리스 목록만 읽습니다. 설치 파일은 download.goagent.top 또는 GitHub에서 받습니다.'
        ]]
      ]
    },
    changelog: {
      title: '변경 기록 - LizzieYzy Next',
      description: 'LizzieYzy Next 안정판의 주요 변경 사항과 공식 사이트의 최근 업데이트.',
      eyebrow: '변경 기록',
      h1: '변경 기록',
      lead: '안정판의 주요 변경 사항입니다. 버전별 전체 설명과 모든 다운로드는 GitHub Releases에 있습니다.',
      releases: [
        { version: 'next-2026-10-17.1', date: '2026-10-17', label: '현재 안정판', items: [
          '문제 수 목록을 수순이나 손실 순으로 정렬하고, 방향키와 Enter로 이동할 수 있습니다.',
          'AI 해설에서 ChatGPT 로그인과 본인의 API 키를 사용할 수 있습니다.',
          '‘규칙’ 창에서 덤이 해당 규칙의 일반적인 값과 다르면 알려 줍니다. 참고용이며 덤을 자동으로 바꾸지 않습니다.',
          '접바둑과 기본값이 아닌 덤의 기보를 올바르게 분석합니다.',
          '기보를 가져오다 문제가 생기면 계속 기다리지 않고 일시 정지한 뒤 알려 줍니다.',
          '엔진 대국에서 소리 설정에 따라 착수음이 납니다.',
          '자동 업데이트 확인과 자동 다운로드가 기본적으로 꺼져 있습니다.'
        ] },
        { version: '공식 사이트 개편', date: '2026-10', label: '웹사이트', items: [
          '홈페이지에서 실제 프로그램 화면과 KataGo의 실제 분석을 보여 줍니다.',
          '다운로드 센터에서 그래픽 카드와 칩별로 버전을 정리하고 7개 언어를 모두 업데이트했습니다.',
          '가이드, 자주 묻는 질문, 개인정보 페이지를 새로 썼습니다.'
        ] }
      ],
      more: 'GitHub에서 모든 버전 보기'
    }
  },
  th: {
    docs: {
      title: 'คู่มือ - LizzieYzy Next',
      description: 'ดาวน์โหลด เปิดครั้งแรก ดึงเกม Fox วิเคราะห์ทั้งเกม และดูตาที่มีปัญหา คู่มือเริ่มต้นใช้ LizzieYzy Next',
      eyebrow: 'คู่มือ',
      h1: 'เริ่มต้นใช้ LizzieYzy Next',
      lead: 'ไม่ต้องรู้ศัพท์เทคนิค ดาวน์โหลด เปิดบันทึกเกม วิเคราะห์ด้วยคลิกเดียว แล้วให้รายการตาที่มีปัญหาบอกว่าตรงไหนสำคัญ',
      start: { title: 'เริ่มต้นใช้งาน', items: [
        ['ดาวน์โหลดและแตกไฟล์', 'เลือกเวอร์ชันที่ตรงกับคอมพิวเตอร์จากศูนย์ดาวน์โหลดทางการ Windows เลือกตามการ์ดจอ: NVIDIA RTX 20 / 30 / 40 / 50 ใช้รุ่น CUDA, AMD, Intel หรือ NVIDIA รุ่นเก่าใช้รุ่น OpenCL และถ้าไม่มีการ์ดจอแยกให้ใช้รุ่น CPU ส่วน Mac เลือกตามชิป รุ่นพกพาของ Windows แค่แตกไฟล์ ส่วน Mac ให้เปิด DMG แล้วลากแอปไปที่ Applications'],
        ['เปิดครั้งแรก', 'แพ็กเกจเต็มมีเอนจิน KataGo และโมเดลเริ่มต้นอยู่แล้ว และจะตั้งค่าให้อัตโนมัติเมื่อเปิดครั้งแรก ไม่ต้องดาวน์โหลดอะไรเพิ่ม ถ้า macOS แจ้งว่าเปิดแอปไม่ได้ ให้ไปที่การตั้งค่าระบบ → ความเป็นส่วนตัวและความปลอดภัย แล้วอนุญาตให้เปิดแอป'],
        ['เปิดบันทึกเกม', 'กด “Fox” บนแถบเครื่องมือ แล้วใส่ชื่อเล่น Fox เพื่อดึงเกมสาธารณะล่าสุด หรือเปิดไฟล์ SGF ในเครื่องก็ได้'],
        ['วิเคราะห์ทั้งเกม', 'ในเมนู “วิเคราะห์” เลือก “ภาพรวมทั้งเกมแบบสายฟ้า” เพื่อดูภาพรวมอย่างรวดเร็ว ถ้าต้องการวิเคราะห์ลึกขึ้น ใช้ “วิเคราะห์ทั้งเกมแบบละเอียด”']
      ] },
      read: { title: 'อ่านเกมอย่างไร', items: [
        ['ดูกราฟโอกาสชนะก่อน', 'จุดที่กราฟตกลงมาก คือจุดที่เกมพลิก'],
        ['แล้วดูตาที่มีปัญหา', 'รายการ “ตาที่มีปัญหา” เรียงตามความเสียหาย คลิกเพื่อไปยังตานั้น หรือใช้ปุ่มลูกศรกับ Enter ก็ได้'],
        ['เทียบกับจุดแนะนำ', 'วงกลมสีบนกระดานคือจุดที่ KataGo แนะนำ พร้อมโอกาสชนะและจำนวนการค้นหา ลองวางแนวเดินที่แนะนำแล้วเทียบกับเกมจริง']
      ] },
      ai: { title: 'โค้ช AI และคำอธิบาย AI', items: [
        ['โค้ช AI', 'กด “โค้ช AI” ด้านบน เลือกระดับฝีมือ แล้วเล่นเกมฝึกกับ AI'],
        ['คำอธิบาย AI', 'กด “คำอธิบาย AI” ด้านบน แล้วลงชื่อเข้าใช้ด้วย ChatGPT หรือใส่ API key ของคุณเอง เพื่อให้ AI อธิบายตำแหน่งปัจจุบัน รุ่นที่ใช้ได้และโควตาขึ้นอยู่กับผู้ให้บริการ']
      ] },
      help: { title: 'เมื่อมีปัญหา', items: [
        ['ดาวน์โหลดช้าหรือไม่สำเร็จ', 'ลองใช้เครือข่ายอื่น หรือเปิดดาวน์โหลดสำรองบน GitHub จากหน้าดาวน์โหลด'],
        ['Windows แจ้งว่าได้ปกป้องพีซีของคุณ', 'ตรวจสอบว่าไฟล์มาจากเว็บไซต์นี้หรือ GitHub แล้วกดดูข้อมูลเพิ่มเติม จากนั้นเลือกเรียกใช้ต่อ'],
        ['ตรวจสอบการอัปเดต', 'การตรวจสอบการอัปเดตอัตโนมัติปิดอยู่ตามค่าเริ่มต้น เมื่อต้องการให้กด “ตรวจสอบการอัปเดต” ในเมนู “ช่วยด้วย” ส่วนรุ่นพกพาดาวน์โหลดเฉพาะอัปเดตขนาดเล็กจากหน้าดาวน์โหลดได้'],
        ['หาฟังก์ชันไม่เจอหรืออยากแจ้งปัญหา', '“ค้นหาฟังก์ชัน” บนแถบเครื่องมือช่วยหาเมนูจากชื่อได้ ถ้ายังแก้ไม่ได้ ให้ส่งออกแพ็กเกจวินิจฉัยจาก “ช่วยด้วย → การวินิจฉัยและบันทึก” แล้วแจ้งใน GitHub Issues']
      ] }
    },
    faq: {
      title: 'คำถามที่พบบ่อย - LizzieYzy Next',
      description: 'ควรดาวน์โหลดเวอร์ชันไหน ต้องติดตั้ง KataGo ไหม ใช้กับเกม Fox ได้ไหม ความเป็นส่วนตัว และวิธีใช้คำอธิบาย AI',
      eyebrow: 'คำถามที่พบบ่อย',
      h1: 'คำถามที่พบบ่อย',
      lead: 'ควรดาวน์โหลดเวอร์ชันไหน เริ่มต้นอย่างไร และบันทึกเกมปลอดภัยไหม เราตอบคำถามที่ถูกถามบ่อยที่สุดไว้ที่นี่',
      items: [
        ['ใช้ฟรีไหม?', 'ฟรีและเป็นโอเพนซอร์ส (GPL-3.0) ส่วนคำอธิบาย AI จะเชื่อมต่อบริการ AI ที่คุณเลือก ซึ่งมีโควตาและค่าบริการของผู้ให้บริการนั้น'],
        ['ควรดาวน์โหลดเวอร์ชันไหน?', 'Windows เลือกตามการ์ดจอ: NVIDIA RTX 20 / 30 / 40 / 50 ใช้รุ่น CUDA, AMD, Intel หรือ NVIDIA รุ่นเก่าใช้รุ่น OpenCL และถ้าไม่มีการ์ดจอแยกให้ใช้รุ่น CPU ส่วน Mac เลือกชิป Apple หรือ Intel'],
        ['ไม่รู้ว่าการ์ดจอรุ่นอะไร', 'บน Windows กด Ctrl + Shift + Esc เพื่อเปิดตัวจัดการงาน ไปที่แท็บประสิทธิภาพแล้วเลือก GPU ชื่อรุ่นจะแสดงที่มุมขวาบน'],
        ['ต้องติดตั้ง KataGo หรือดาวน์โหลดโมเดลเพิ่มไหม?', 'ไม่ต้อง แพ็กเกจเต็มมีเอนจิน KataGo และโมเดลเริ่มต้นอยู่แล้ว แตกไฟล์ เปิดใช้ แล้วโปรแกรมจะตั้งค่าให้เองเมื่อเปิดครั้งแรก'],
        ['วิเคราะห์เกมจาก Fox ได้ไหม?', 'ได้ กด “Fox” บนแถบเครื่องมือ แล้วใส่ชื่อเล่น Fox เพื่อหาเกมสาธารณะล่าสุด'],
        ['ใช้บน Mac และ Linux ได้ไหม?', 'ได้ Mac มีรุ่นสำหรับชิป Apple และ Intel ส่วนรุ่น Linux เผยแพร่บน GitHub ฟังก์ชันซิงค์กระดานตอนนี้รองรับเฉพาะ Windows'],
        ['มีภาษาอะไรบ้าง?', 'จีนตัวย่อ จีนตัวเต็ม อังกฤษ ญี่ปุ่น เกาหลี และไทย'],
        ['บันทึกเกมจะถูกอัปโหลดไหม?', 'ไม่ บันทึกเกมและผลวิเคราะห์อยู่ในคอมพิวเตอร์ของคุณ และไม่มีเทเลเมทรี ข้อมูลเกมที่จำเป็นจะถูกส่งไปยังบริการที่คุณเลือกเฉพาะเมื่อใช้ฟังก์ชันออนไลน์ เช่น คำอธิบาย AI หรือคอมพิวเตอร์ระยะไกล'],
        ['ใช้คำอธิบาย AI อย่างไร?', 'กด “คำอธิบาย AI” ด้านบน แล้วลงชื่อเข้าใช้ด้วย ChatGPT หรือใส่ API key ของคุณเอง รุ่นที่ใช้ได้และโควตาขึ้นอยู่กับผู้ให้บริการ'],
        ['ไม่เข้าใจคำว่าโอกาสชนะหรือคะแนนนำ', 'ไม่ต้องรู้ก่อนก็ได้ โอกาสชนะคือความน่าจะเป็นที่จะชนะตามการประเมินของ KataGo ส่วนคะแนนนำคือการประเมินว่านำอยู่กี่แต้ม เริ่มจากตาที่โอกาสชนะลดลงมากที่สุดก่อน'],
        ['GoAgent คืออะไร ต้องใช้ด้วยไหม?', 'GoAgent เป็นโครงการทดลองแยกต่างหากที่สำรวจการสอนหมากล้อมด้วย AI ถ้าแค่ทบทวนเกมไม่จำเป็นต้องใช้ เพราะ LizzieYzy Next มีคำอธิบาย AI และโค้ช AI อยู่แล้ว'],
        ['อัปเดตอย่างไร?', 'การตรวจสอบการอัปเดตอัตโนมัติปิดอยู่ตามค่าเริ่มต้น กด “ตรวจสอบการอัปเดต” ในเมนู “ช่วยด้วย” หรือดาวน์โหลดเวอร์ชันใหม่จากเว็บไซต์นี้ รุ่นพกพาดาวน์โหลดเฉพาะอัปเดตขนาดเล็กได้'],
        ['แจ้งปัญหาได้ที่ไหน?', 'แจ้งใน GitHub Issues หรือเข้ากลุ่ม QQ: LizzieYzy Next 299419120, GoAgent 1030632742']
      ]
    },
    privacy: {
      title: 'ความเป็นส่วนตัว - LizzieYzy Next',
      description: 'LizzieYzy Next เก็บบันทึกเกมและการตั้งค่าไว้ในคอมพิวเตอร์ของคุณ และไม่มีเทเลเมทรี ข้อมูลจะถูกส่งออกเฉพาะเมื่อคุณใช้ฟังก์ชันออนไลน์ รวมถึงข้อมูลของ GoAgent และเว็บไซต์นี้',
      eyebrow: 'ความเป็นส่วนตัว',
      h1: 'บันทึกเกมของคุณ อยู่ในคอมพิวเตอร์ของคุณ',
      lead: 'อธิบายว่า LizzieYzy Next โครงการทดลอง GoAgent และเว็บไซต์นี้จัดการข้อมูลอะไรบ้าง',
      sections: [
        ['LizzieYzy Next', [
          'บันทึกเกม ผลวิเคราะห์ และการตั้งค่าเก็บไว้ในเครื่อง รุ่นพกพาจะเก็บไว้ในโฟลเดอร์ user-data ข้างโปรแกรม เมื่ออัปเดตให้เก็บโฟลเดอร์นี้ไว้',
          'โปรแกรมไม่เก็บสถิติการใช้งานและไม่มีเทเลเมทรี',
          'การตรวจสอบและดาวน์โหลดอัปเดตอัตโนมัติปิดอยู่ตามค่าเริ่มต้น โปรแกรมจะตรวจหาเวอร์ชันใหม่เฉพาะเมื่อคุณกด “ช่วยด้วย” → “ตรวจสอบการอัปเดต”',
          'แพ็กเกจวินิจฉัยถูกสร้างเฉพาะเมื่อคุณส่งออกเอง ไม่มีการอัปโหลดอัตโนมัติ และคุณเป็นผู้ตัดสินใจว่าจะแชร์หรือไม่',
          'ข้อมูลเข้าสู่ระบบและ API key ของคำอธิบาย AI เก็บโดยระบบปฏิบัติการ: เข้ารหัสด้วย DPAPI บน Windows เก็บใน Keychain บน macOS และใช้ Secret Service บน Linux',
          'โปรแกรมเชื่อมต่ออินเทอร์เน็ตเฉพาะเมื่อใช้ฟังก์ชันออนไลน์: การดึงเกม Fox จะเชื่อมต่อบริการสาธารณะของ Fox ส่วนคอมพิวเตอร์ระยะไกลและคำอธิบาย AI จะส่งข้อมูลเกมที่จำเป็นไปยังบริการที่คุณเลือก'
        ]],
        ['GoAgent (โครงการทดลอง)', [
          'คลังเกม โปรไฟล์ผู้เรียน บทสนทนากับครู แคชการวิเคราะห์ และการตั้งค่า เก็บไว้ในเครื่องเป็นค่าเริ่มต้น',
          'ถ้าคุณตั้งค่า LLM API ภาพกระดาน สรุปตำแหน่ง ผลวิเคราะห์ KataGo และคำถามของคุณที่จำเป็นต่องานของครู จะถูกส่งไปยังบริการนั้น',
          'ถ้าคุณตั้งค่า TTS API แบบกำหนดเอง ข้อความที่จะอ่านออกเสียงจะถูกส่งไปยังบริการนั้น ส่วน Kokoro TTS ค่าเริ่มต้นทำงานแบบออฟไลน์ในเครื่องและไม่อัปโหลดข้อความ'
        ]],
        ['เว็บไซต์นี้', [
          'goagent.top เป็นเว็บไซต์แบบสถิต ไม่มีฐานข้อมูล ไม่มีการอัปโหลดบันทึกเกม และไม่ใช้สคริปต์ติดตามโฆษณา',
          'ศูนย์ดาวน์โหลดอ่านเฉพาะรายการรุ่นที่เผยแพร่สาธารณะ ไฟล์ติดตั้งดาวน์โหลดจาก download.goagent.top หรือ GitHub'
        ]]
      ]
    },
    changelog: {
      title: 'บันทึกอัปเดต - LizzieYzy Next',
      description: 'การเปลี่ยนแปลงหลักในแต่ละรุ่นเสถียรของ LizzieYzy Next และการอัปเดตล่าสุดของเว็บไซต์',
      eyebrow: 'บันทึกอัปเดต',
      h1: 'บันทึกอัปเดต',
      lead: 'การเปลี่ยนแปลงหลักของรุ่นเสถียร รายละเอียดเต็มและไฟล์ดาวน์โหลดทั้งหมดอยู่ใน GitHub Releases',
      releases: [
        { version: 'next-2026-10-17.1', date: '2026-10-17', label: 'รุ่นเสถียรปัจจุบัน', items: [
          'รายการตาที่มีปัญหาเรียงตามลำดับตาหรือความเสียหายได้ และเลื่อนด้วยปุ่มลูกศรกับ Enter ได้',
          'คำอธิบาย AI รองรับการลงชื่อเข้าใช้ด้วย ChatGPT หรือใช้ API key ของคุณเอง',
          'หน้าต่าง “กฎเกณฑ์” จะแจ้งเมื่อโคมิต่างจากค่าปกติของกฎนั้น เป็นเพียงคำแนะนำและไม่เปลี่ยนโคมิให้เอง',
          'วิเคราะห์เกมหมากต่อและเกมที่ใช้โคมิไม่ใช่ค่าเริ่มต้นได้ถูกต้อง',
          'เมื่อการนำเข้าบันทึกเกมมีปัญหา โปรแกรมจะหยุดชั่วคราวและแจ้งให้ทราบ แทนการรอไปเรื่อย ๆ',
          'เกมกับเอนจินเล่นเสียงวางหมากตามการตั้งค่าเสียง',
          'การตรวจสอบและดาวน์โหลดอัปเดตอัตโนมัติปิดอยู่ตามค่าเริ่มต้น'
        ] },
        { version: 'ปรับโฉมเว็บไซต์', date: '2026-10', label: 'เว็บไซต์', items: [
          'หน้าแรกแสดงหน้าจอจริงของโปรแกรมและผลวิเคราะห์จริงจาก KataGo',
          'ศูนย์ดาวน์โหลดจัดเรียงรุ่นตามการ์ดจอและชิป และอัปเดตครบทั้ง 7 ภาษา',
          'เขียนหน้าคู่มือ คำถามที่พบบ่อย และความเป็นส่วนตัวใหม่ทั้งหมด'
        ] }
      ],
      more: 'ดูทุกเวอร์ชันบน GitHub'
    }
  },
  vi: {
    docs: {
      title: 'Hướng dẫn - LizzieYzy Next',
      description: 'Tải xuống, mở lần đầu, lấy ván Fox, phân tích cả ván và xem các nước có vấn đề. Hướng dẫn bắt đầu với LizzieYzy Next.',
      eyebrow: 'Hướng dẫn',
      h1: 'Bắt đầu với LizzieYzy Next',
      lead: 'Không cần thuật ngữ. Tải về, mở kỳ phổ, phân tích bằng một lần bấm, rồi để danh sách nước có vấn đề chỉ ra chỗ quan trọng. Phần mềm chưa có giao diện tiếng Việt, nên hướng dẫn dùng tên nút tiếng Anh.',
      start: { title: 'Bắt đầu', items: [
        ['Tải về và giải nén', 'Chọn bản phù hợp trong trung tâm tải xuống chính thức. Trên Windows, chọn theo card đồ họa: NVIDIA RTX 20 / 30 / 40 / 50 dùng bản CUDA; AMD, Intel hoặc NVIDIA đời cũ dùng bản OpenCL; không có card rời thì dùng bản CPU. Trên Mac, chọn theo chip. Bản portable của Windows chỉ cần giải nén; trên Mac, mở tệp DMG và kéo ứng dụng vào Applications.'],
        ['Mở lần đầu', 'Gói đầy đủ có sẵn engine KataGo và mạng mặc định, lần đầu mở sẽ tự cấu hình, không cần tải thêm gì. Nếu macOS báo không mở được ứng dụng, vào System Settings → Privacy & Security và bấm Open Anyway.'],
        ['Mở kỳ phổ', 'Bấm “Fox Kifu” trên thanh công cụ và nhập biệt danh Fox để lấy các ván công khai gần đây, hoặc mở tệp SGF trên máy.'],
        ['Phân tích cả ván', 'Trong menu “Analyze”, chọn “Whole-game lightning overview” để nắm nhanh diễn biến ván cờ. Muốn phân tích sâu hơn, dùng “Whole-game deep analysis”.']
      ] },
      read: { title: 'Cách đọc một ván cờ', items: [
        ['Xem đồ thị tỷ lệ thắng trước', 'Chỗ đồ thị tụt mạnh là chỗ ván cờ đổi chiều.'],
        ['Rồi xem các nước có vấn đề', 'Danh sách “Problem moves” được sắp theo mức thiệt hại. Bấm để tới nước đó, hoặc dùng phím mũi tên và Enter.'],
        ['So với gợi ý', 'Các vòng tròn màu trên bàn cờ là gợi ý của KataGo, kèm tỷ lệ thắng và số lượt tìm. Bày lại biến thể được gợi ý và so với ván thật.']
      ] },
      ai: { title: 'AI Coach và AI Commentary', items: [
        ['AI Coach', 'Bấm “AI Coach” ở phía trên, chọn sức cờ và chơi một ván luyện tập với AI.'],
        ['AI Commentary', 'Bấm “AI Commentary” ở phía trên, đăng nhập bằng ChatGPT hoặc nhập API key của bạn để AI giải thích thế cờ hiện tại. Mô hình và hạn mức tùy nhà cung cấp dịch vụ.']
      ] },
      help: { title: 'Khi gặp sự cố', items: [
        ['Tải chậm hoặc thất bại', 'Thử mạng khác, hoặc mở bản tải dự phòng trên GitHub từ trang tải xuống.'],
        ['Windows báo đã bảo vệ PC của bạn', 'Hãy chắc chắn tệp được tải từ trang này hoặc GitHub, rồi mở phần thông tin bổ sung và chọn vẫn chạy.'],
        ['Kiểm tra cập nhật', 'Tính năng tự kiểm tra cập nhật mặc định tắt. Khi cần, chọn Help → Check update; người dùng bản portable có thể chỉ tải bản cập nhật nhỏ từ trang tải xuống.'],
        ['Không tìm thấy tính năng hoặc cần trợ giúp', '“Search features” trên thanh công cụ giúp tìm mục menu theo tên. Nếu vẫn chưa giải quyết được, hãy xuất gói chẩn đoán từ Help → Diagnostics and Logs và báo lỗi trên GitHub Issues.']
      ] }
    },
    faq: {
      title: 'Hỏi đáp - LizzieYzy Next',
      description: 'Nên tải bản nào, có cần cài KataGo không, ván Fox, quyền riêng tư và cách dùng AI Commentary: những câu hỏi thường gặp về LizzieYzy Next.',
      eyebrow: 'Hỏi đáp',
      h1: 'Câu hỏi thường gặp',
      lead: 'Nên tải bản nào, bắt đầu thế nào, kỳ phổ có an toàn không. Đây là những câu hỏi chúng tôi nhận được nhiều nhất.',
      items: [
        ['Phần mềm có miễn phí không?', 'Có. Miễn phí và mã nguồn mở (GPL-3.0). AI Commentary kết nối với dịch vụ AI bạn chọn, nên áp dụng hạn mức và phí của dịch vụ đó.'],
        ['Nên tải bản nào?', 'Trên Windows, chọn theo card đồ họa: NVIDIA RTX 20 / 30 / 40 / 50 dùng bản CUDA; AMD, Intel hoặc NVIDIA đời cũ dùng bản OpenCL; không có card rời thì dùng bản CPU. Trên Mac, chọn chip Apple hoặc Intel.'],
        ['Không biết card đồ họa của mình là gì?', 'Trên Windows, nhấn Ctrl + Shift + Esc để mở Task Manager, vào tab Performance và chọn GPU. Tên card hiện ở góc trên bên phải.'],
        ['Có cần cài KataGo hoặc tải mạng neural không?', 'Không. Gói đầy đủ đã có engine KataGo và mạng mặc định. Giải nén, mở lên, lần đầu chạy sẽ tự cấu hình.'],
        ['Có phân tích được ván trên Fox không?', 'Được. Bấm “Fox Kifu” trên thanh công cụ và nhập biệt danh Fox để tìm các ván công khai gần đây.'],
        ['Có chạy trên Mac và Linux không?', 'Có. Mac có bản cho chip Apple và Intel; bản Linux được phát hành trên GitHub. Đồng bộ bàn cờ hiện chỉ hỗ trợ Windows.'],
        ['Giao diện có những ngôn ngữ nào?', 'Tiếng Trung giản thể, Trung phồn thể, Anh, Nhật, Hàn và Thái. Hiện chưa có tiếng Việt.'],
        ['Kỳ phổ có bị tải lên không?', 'Không. Kỳ phổ và kết quả phân tích ở trên máy của bạn, và phần mềm không có telemetry. Chỉ khi dùng tính năng trực tuyến như AI Commentary hoặc Remote Compute, dữ liệu ván cờ cần thiết mới được gửi tới dịch vụ bạn chọn.'],
        ['Dùng AI Commentary thế nào?', 'Bấm “AI Commentary” ở phía trên, đăng nhập bằng ChatGPT hoặc nhập API key của bạn. Mô hình và hạn mức tùy nhà cung cấp dịch vụ.'],
        ['Tôi không hiểu tỷ lệ thắng hay chênh lệch điểm', 'Không cần hiểu trước. Tỷ lệ thắng là xác suất thắng do KataGo ước tính, còn chênh lệch điểm là ước tính đang dẫn bao nhiêu điểm. Hãy bắt đầu từ những nước làm tỷ lệ thắng giảm nhiều nhất.'],
        ['GoAgent là gì? Có cần tải không?', 'GoAgent là một dự án thử nghiệm riêng, tìm hiểu cách AI giảng cờ. Chỉ để xem lại ván thì không cần: LizzieYzy Next đã có AI Commentary và AI Coach.'],
        ['Cập nhật thế nào?', 'Tính năng tự kiểm tra cập nhật mặc định tắt. Chọn Help → Check update, hoặc tải bản mới từ trang này. Người dùng bản portable có thể chỉ tải bản cập nhật nhỏ.'],
        ['Báo lỗi ở đâu?', 'Báo trên GitHub Issues hoặc tham gia nhóm QQ: LizzieYzy Next 299419120, GoAgent 1030632742.']
      ]
    },
    privacy: {
      title: 'Quyền riêng tư - LizzieYzy Next',
      description: 'LizzieYzy Next lưu kỳ phổ và cài đặt trên máy của bạn, không có telemetry. Dữ liệu chỉ được gửi đi khi bạn dùng tính năng trực tuyến. Kèm thông tin về GoAgent và trang web này.',
      eyebrow: 'Quyền riêng tư',
      h1: 'Kỳ phổ của bạn ở lại trên máy của bạn',
      lead: 'Dưới đây là cách LizzieYzy Next, dự án thử nghiệm GoAgent và trang web này xử lý dữ liệu.',
      sections: [
        ['LizzieYzy Next', [
          'Kỳ phổ, kết quả phân tích và cài đặt được lưu cục bộ. Bản portable lưu chúng trong thư mục user-data cạnh chương trình; hãy giữ thư mục này khi cập nhật.',
          'Phần mềm không thu thập thống kê sử dụng và không có telemetry.',
          'Tự kiểm tra và tự tải cập nhật mặc định tắt. Phần mềm chỉ kiểm tra phiên bản mới khi bạn chọn Help → Check update.',
          'Gói chẩn đoán chỉ được tạo khi bạn tự xuất, không bao giờ tự tải lên, và bạn quyết định có chia sẻ hay không.',
          'Thông tin đăng nhập và API key của AI Commentary do hệ điều hành lưu giữ: mã hóa bằng DPAPI trên Windows, lưu trong Keychain trên macOS và dùng Secret Service trên Linux.',
          'Phần mềm chỉ kết nối mạng khi bạn dùng tính năng trực tuyến: lấy ván Fox sẽ truy cập dịch vụ công khai của Fox, còn Remote Compute và AI Commentary gửi dữ liệu ván cờ cần thiết tới dịch vụ bạn chọn.'
        ]],
        ['GoAgent (thử nghiệm)', [
          'Thư viện ván cờ, hồ sơ học viên, hội thoại với giáo viên, bộ nhớ đệm phân tích và cài đặt được lưu cục bộ theo mặc định.',
          'Nếu bạn cấu hình LLM API, hình bàn cờ, tóm tắt thế cờ, phân tích KataGo và câu hỏi của bạn mà tác vụ giáo viên cần sẽ được gửi tới dịch vụ đó.',
          'Nếu bạn cấu hình TTS API tùy chỉnh, văn bản cần đọc sẽ được gửi tới dịch vụ đó. Kokoro TTS mặc định chạy ngoại tuyến trên máy và không tải văn bản lên.'
        ]],
        ['Trang web này', [
          'goagent.top là trang web tĩnh: không có cơ sở dữ liệu, không nhận tải kỳ phổ lên và không dùng script theo dõi quảng cáo.',
          'Trung tâm tải xuống chỉ đọc danh sách phiên bản công khai; bộ cài được tải từ download.goagent.top hoặc GitHub.'
        ]]
      ]
    },
    changelog: {
      title: 'Nhật ký cập nhật - LizzieYzy Next',
      description: 'Những thay đổi chính trong mỗi bản ổn định của LizzieYzy Next và các cập nhật gần đây của trang web.',
      eyebrow: 'Nhật ký',
      h1: 'Nhật ký cập nhật',
      lead: 'Những thay đổi chính của các bản ổn định. Ghi chú đầy đủ và mọi tệp tải xuống có trên GitHub Releases.',
      releases: [
        { version: 'next-2026-10-17.1', date: '2026-10-17', label: 'Bản ổn định hiện tại', items: [
          'Danh sách nước có vấn đề có thể sắp xếp theo số nước hoặc mức thiệt hại, và di chuyển bằng phím mũi tên và Enter.',
          'AI Commentary hỗ trợ đăng nhập bằng ChatGPT hoặc dùng API key của bạn.',
          'Cửa sổ Rules báo khi komi khác giá trị thường dùng của luật đó. Đây chỉ là gợi ý, không tự đổi komi.',
          'Phân tích đúng các ván chấp quân và ván có komi khác mặc định.',
          'Khi nhập kỳ phổ gặp lỗi, phần mềm tạm dừng và báo cho bạn thay vì chờ mãi.',
          'Ván đấu với engine phát tiếng đặt quân theo cài đặt âm thanh.',
          'Tự kiểm tra và tự tải cập nhật mặc định tắt.'
        ] },
        { version: 'Làm mới trang web', date: '2026-10', label: 'Trang web', items: [
          'Trang chủ giới thiệu giao diện thật của phần mềm và phân tích thật của KataGo.',
          'Trung tâm tải xuống sắp xếp phiên bản theo card đồ họa và chip, cập nhật đủ 7 ngôn ngữ.',
          'Viết lại trang hướng dẫn, hỏi đáp và quyền riêng tư.'
        ] }
      ],
      more: 'Xem mọi phiên bản trên GitHub'
    }
  }
}
