export type GoAgentErrorCode =
  | 'APP_HOME_NOT_WRITABLE'
  | 'KATAGO_BINARY_MISSING'
  | 'KATAGO_BINARY_NOT_EXECUTABLE'
  | 'KATAGO_MODEL_MISSING'
  | 'KATAGO_CONFIG_FAILED'
  | 'KATAGO_PROCESS_FAILED'
  | 'LLM_PROXY_NOT_CONFIGURED'
  | 'LLM_PROXY_UNREACHABLE'
  | 'LLM_IMAGE_UNSUPPORTED'
  | 'LLM_EMPTY_RESPONSE'
  | 'FOX_SYNC_FAILED'
  | 'SGF_PARSE_FAILED'
  | 'PROFILE_WRITE_FAILED'
  | 'KNOWLEDGE_LOAD_FAILED'
  | 'UNKNOWN_ERROR'

export interface UserFacingError {
  code: GoAgentErrorCode
  title: string
  message: string
  action?: string
  technicalDetail?: string
}

export function toUserFacingError(error: unknown, fallbackCode: GoAgentErrorCode = 'UNKNOWN_ERROR'): UserFacingError {
  const text = error instanceof Error ? error.message : String(error)
  if (/katago/i.test(text) && /model|network|bin\.gz/i.test(text)) {
    return {
      code: 'KATAGO_MODEL_MISSING',
      title: 'KataGo 模型缺失',
      message: '应用没有找到默认 KataGo 模型，无法进行围棋局面分析。',
      action: '请重新安装完整安装包，或在设置中选择可用模型文件。',
      technicalDetail: text
    }
  }
  if (/katago/i.test(text) && /binary|executable|spawn|ENOENT/i.test(text)) {
    return {
      code: 'KATAGO_BINARY_MISSING',
      title: 'KataGo 引擎缺失',
      message: '应用没有找到内置 KataGo 二进制，无法运行引擎分析。',
      action: '请重新安装完整安装包，或检查安装包资源是否被杀毒软件隔离。',
      technicalDetail: text
    }
  }
  if (/LLM|proxy|chat\/completions|api key|Authorization/i.test(text)) {
    return {
      code: 'LLM_PROXY_UNREACHABLE',
      title: 'Claude 兼容代理不可用',
      message: '老师讲解需要连接到你配置的 Claude 兼容代理。',
      action: '请在设置里检查 Base URL、API Key 和模型名，并运行图片测试。',
      technicalDetail: text
    }
  }
  return {
    code: fallbackCode,
    title: '发生未知错误',
    message: '当前任务没有完成。你可以展开技术详情定位问题。',
    action: '建议先运行诊断，确认 KataGo、模型和 Claude 兼容代理均可用。',
    technicalDetail: text
  }
}
