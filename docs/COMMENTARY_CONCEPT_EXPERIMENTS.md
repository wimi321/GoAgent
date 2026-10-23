# 围棋解说机制与概念识别实验

本次改动将精确棋谱、可验证的棋形与棋块关系、同局面 KataGo 比较和简短输出策略接入实际老师流程。目标是减少错误的棋理断言，并让当前手讲解直接表达主要目的。

**为了获得最佳讲棋效果，建议使用支持图片输入的多模态模型。** 当前流程会核验棋盘图片，并将精确坐标和引擎证据交给模型。结构化证据本身不依赖视觉识别，但当前程序尚未提供经过验证的纯文本讲棋路径；本轮也未进行相同输入条件下有图与无图的隔离对照，因此这一建议不是多模态收益的定量结论。

## 讲棋机制

### 棋形、目的与结果分层

- 相对尖、跳、飞、直接接触、空走廊及阻挡属于可核对的棋盘事实；保留多个己棋锚点与真实颜色。
- 争头、限制出头、分割联系、己方出头及沿边展开属于带目标与反证的目的假设。
- 已经封锁、已经分断、死活、先手与强制应手需要独立证据；不能从几何、局部模式分数、气数或 ownership 自动推出。
- 本地知识检索移除全盘绝对坐标巧合及 PV 锚点加分。题型相似只提示应检查什么，不授权将题库答案当作当前局面的合法变化。

### 棋块关系与实际落子效果

`boardGroupRelations.ts` 提供完整黑白坐标、真实正交连通串、潜在联系及区域目的候选。潜在联系不等于已经连接，正交串不等于战略整龙。

`ownDevelopment.ts` 比较己方受压方向、开放走廊与前端锚点，帮助区分自身出头和攻击对方。同一己串有跳与背侧飞关系时，不能任选一个锚点给整手命名。自身发展候选也不证明棋块未活或已经安定。

`moveBoardEffects.ts` 模拟落子、提子、连接和气的变化。局部单子劫循环以结构证据描述；反事实回提只检验棋盘结构，不验证历史劫禁或超级劫。粘劫、收官和连接不能自动称作弱棋补强。

### 全局价值与具体着手评价

`globalPriorityEvidence.ts` 比较同一落子前局面的首选与实战，区分普通根候选和单独 forced 实战查询，按行棋方统一视角。不能用落子前后 root 估值相减替代同局面选择损失。

远处阈值随棋盘尺寸变化；明显差距采用至少3目或非饱和胜率区间内8个百分点，并核验根搜索深度、候选搜索次数与教学就绪状态。单独 forced 实战查询次数不能抬高普通根搜索质量。

本地存在接近首选的替代点时，不把具体实战点的损失归因于整个局部不重要。具体实战点有可靠显著损失时，即使首选不满足远处条件，也应简短指出更好的选择及已核验用途。

### 证据传递与简短输出

- 修复 KataGo 顶层 root ownership 读取，兼容旧 remote nested 输出并严格检查尺寸与数值范围。
- 核对棋局、手数、落子前时点和试下分支。根候选使用同一落子前棋盘，PV 后续必须另行重放。
- 显式要求加深时核对实际根搜索预算，防止浅层 prefetched 分析覆盖加深请求；试下使用实际试下分析入口。
- 完整坐标、全局比较、紧凑候选发展与关键落子效果优先序列化，减少工具消息18k字符预算截断导致的事实遗漏。
- 保留合法 assistant tool_calls、对应工具成功/失败结果和后续图片。Codex 自动工具当前手路径在首次模型请求前准备真实棋盘图，减少动态图片传递的不可靠情况。
- 默认当前手解说一句话、约20–60中文字，选择主要有据目的。小差距省略推荐比较，内部核验深度不要求最终长篇。明确详解或变化请求仍可展开。

## 实验路线与选择

| 路线 | 实际实验 | 结论 |
| --- | --- | --- |
| 相对几何、关系与 KataGo 证据 | 真实规则执行、棋盘模拟及老师工具集成 | 已接入本次候选实现，仍需围棋语义审阅 |
| 棋盘线性模型 / 小 CNN | 6000条评论局面，按完整棋谱组隔离训练、验证和测试 | 评论词语弱标签精确率不足，未接入产品 |
| 棋盘 + KataGo ownership/policy | 同600局面配对探索 | 增益不稳定，未接入产品 |
| 隐藏层 probe | 核验论文、原代码与普通 KataGo 接口 | 未训练；需要适配引擎和专家标签 |

数据准备默认固定源提交并下载1000盘 SGF，获得32,760个合法主线评论局面。评论关键词不是当前手意图金标，包含假设变化、否定与省略等噪声；实验输入也不等同于产品的落子前目的解释。

平衡 CNN 探索的宏精确率约0.0403、宏 F1 约0.0722，不能因能输出术语就用于产品命名。同600局面探索中，加入 KataGo 的 CNN F1 从0.0533到0.0633，但按棋谱组 bootstrap 的差异区间跨0，不能认定稳定胜出。完整数据、模型权重及原评论不随源码或发行包分发。

来源与许可：

- [ACL 2022论文](https://aclanthology.org/2022.acl-short.90/)、[原始数据代码](https://github.com/AndreHe02/go)、[原 probe 代码](https://github.com/AndreHe02/go-probe)。
- [GTL版权说明](https://gtl.xmp.net/about/site)：原评论属于评审者，本次仅作私人研究。
- [KataGo Analysis API](https://github.com/lightvector/KataGo/blob/master/docs/Analysis_Engine.md)、[模型许可](https://katagotraining.org/network_license/)。
- [MasterMind](https://github.com/opendilab/Mastermind) 的学术用途及书籍来源限制未澄清，本次未使用其数据训练。

## 验证与人工审阅

改动已通过392项项目测试、类型检查和生产构建。覆盖颜色/对称/阻挡反例、占据与缺盘弃权、坐标完整性、同根比较、当前方视角、浅搜索保护、试下加深、工具历史、初始图片和实际棋盘效果。工程测试通过不代表解说语义完全正确；打包发行尚未验证。

真实老师评测使用用户选择的 ChatGPT GPT-6 Luna，匿名 SGF 只包含尺寸、贴目、规则、初始棋子和完整真实落子历史；不传入源评论、专家术语或反馈。运行记录核验实际加载构建、模型/provider、棋谱、提示、设置、棋盘和图片身份，保存原文、失败及各次运行；provider temperature/effort 使用默认值。缺失棋谱规则时明确记录日本规则 fallback。

人工审阅发现并推动了全局重点、棋块目的、简短表达及己方出头等修正。新增随机样本先固定抽样再生成，不依据模型结果换样。反馈用于修改后，相应局面是开发回归样本，不能用于独立总体准确率统计。

最后三局回归原文已转为自身发展、粘劫及跳出，并能解释推荐连接点；用户认为可接受。仍有次要推断和泛化提醒可省略，尚未实现任意自然语言颜色/占据/战术断言的全面语义核验。三局运行流程完成不等于泛化准确率。

审阅工具显示完整实际原文与落子前后棋盘。填写反馈自动暂存在浏览器，点击“保存反馈到项目”才写入项目；浏览器保存网页或下载 JSON 备份不等于提交。工具默认只监听 loopback。源码不包含本机评测产物、用户原始反馈或认证数据。

## 复现入口

```sh
pnpm test
pnpm typecheck
pnpm build
python -m pip install -r scripts/experiments/requirements-comment-concepts.txt
python scripts/experiments/prepare_comment_concepts.py --games 1000
python scripts/experiments/train_comment_concepts.py --data .tmp/concept-data/comments.jsonl --out .tmp/concept-experiments/board6000 --max-samples 6000 --epochs 8
pnpm eval:move-concepts
python scripts/serve_concept_review.py --directory .tmp/concept-review --port 8847
```

引擎实验需要自行提供 KataGo binary、model 与配置路径，不下载或提交本机二进制。`collect_katago_concepts.py --help` 与 `collect_review_analysis.py --help` 列出参数。

真实老师、盲评与短句预览入口为 `eval_commentary_pipeline.mjs`、`build_commentary_blind_review.mjs` 和 `build_commentary_short_preview.mjs`。实际评测需要运行配置好模型、KataGo 与 remote debugging 的隔离 GoAgent 实例及匿名 fixtures；查看各脚本 `--help`。筛选参数为 `--onlyids`。生产程序不依赖这些评测脚本。
