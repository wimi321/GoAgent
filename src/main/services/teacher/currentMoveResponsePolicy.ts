interface CurrentMoveResponsePolicyInput {
  intent: string
  prompt?: string
  explanationPace?: string
}

export interface CurrentMoveResponsePolicy {
  mode: 'concise' | 'detailed'
  instruction: string
}

const SHORT_REQUEST = /一句话|一两句话|简短|简洁|简要|不用展开|不必展开|不要展开|不需要展开|(?:不用|不必|不要|无需|不需要).{0,8}(?:详细|详解|细讲|展开|深挖|逐步|列变化)|no need\s*(?:详细|详解|展开)|\b(?:brief(?:ly)?|concise(?:ly)?|one sentence|no need(?: to)?(?: explain)?(?: in)? detail|(?:do not|don't) explain in detail|(?:do not|don't|no need to) (?:elaborate|expand))\b/i
const DETAIL_REQUEST = /详细|详解|细讲|展开|深挖|逐步|列(?:出)?变化|后续变化|后续怎么下|对方(?:怎么|如何)(?:应|下)|对方应手|应对变化|explain in detail|show (?:the )?variations|(?:opponent|opponent's) (?:reply|response)|what (?:happens|comes) next/i

/** Evidence depth and teacher style do not determine the length of a move comment. */
export function buildCurrentMoveResponsePolicy(input: CurrentMoveResponsePolicyInput): CurrentMoveResponsePolicy | undefined {
  if (input.intent !== 'current-move') return undefined
  const prompt = input.prompt ?? ''
  const concise = SHORT_REQUEST.test(prompt)
  const detailed = !concise && (DETAIL_REQUEST.test(prompt) || input.explanationPace === 'detailed')
  const grounding = '内部仍须完整核对棋盘、KataGo、全局重点和棋块关系。先判断本手主要服务于哪片棋：己方出头、防被封锁、沿边展开与对敌攻击是竞争目的，不能因为落点在敌棋上方就默认讲限制对方出头。同一真实己串同时存在跳和飞关系时，应检查发展方向的前端锚点，不能按锚点名字或任选背侧棋子给整手命名。粘劫、连接和收官不自动等于弱棋补强；没有来源明确的未安定评估，不把气少、提单子或附近有敌棋当成弱龙证据。把“目的是封锁/试图分割”与“已经封锁成功/已经分断”分清；只有证据支持整片敌棋时才称“大龙”，不能凭局部串或棋形自动命名。若确需指出远处推荐，应尽量用已核验的棋盘效果或同一分支参考变化简短解释其用途，而不只报坐标；参考线不是强制应手，也不能把全局目差全算在一颗棋子的价值上。'
  return {
    mode: detailed ? 'detailed' : 'concise',
    instruction: detailed
      ? `【当前手讲解详略：按需详解】用户要求详细讲解或具体应手、后续变化时，围绕所问问题展开；先给本手的主要目的，再补必要的依据或已核验变化，不固定追加训练建议和无关栏目。${grounding}`
      : `【当前手讲解详略：一句话】普通手严格只写一句，中文约20–60字；以“这手……”直接说棋形与主要目的，例如在证据支持时说“这手飞目的是封锁对方大龙”。内部比较多个目的后，输出只选证据最充分的主目的，不罗列次要棋形、空路线潜力或“尚未分断”等无关保留判断。AI推荐不同但差距不大时，省略推荐点和选择评价，不要先报AI推荐再讲目的。同一落子前比较若 significantGap 与 reliableSearch 均为 true，应在本句简短指出具体本手不佳、首选及已核验用途；这一点不要求首选距离远，也不等于整个局部不重要。只有全局证据显示远处首选明显更好、且没有接近首选的局部替代时，才最多补第二句关键提醒；仅距离远不能触发第二句。不要固定展开棋盘描述、坐标清单、胜率目差、PV、对方应手、训练建议或免责声明；不确定意图可在本句用“意在/可能”，无需追加一段保留判断。用户明确追问时再展开。teachingDensity、严谨风格和中盘复杂度只影响内部核验，不得覆盖这条篇幅约束。“为什么这手”只问目的时也保持简短。${grounding}`
  }
}
