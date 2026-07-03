const axios = require('axios')
const cozeConfig = require('../config/coze')

/**
 * Coze Chat API 服务
 * 
 * API 文档：https://www.coze.cn/docs/developer_guides/chat_v3
 * 
 * 使用 Coze v3 Chat API，支持多轮对话。
 * 每门课程的 Bot ID 从 ai_assistant_bind 表获取。
 */

/**
 * 调用 Coze Bot 进行对话（主入口）
 * 
 * @param {Object} params
 * @param {string} params.agent_id    - Coze Bot ID（agent_id，即 bot_id）
 * @param {string} params.user_id     - 用户标识（student_id，用于 Coze 侧区分不同用户的对话上下文）
 * @param {string} params.message     - 用户消息
 * @param {Array}  params.history     - 历史消息 [{role: 'user'|'assistant', content: '...'}, ...]
 * @returns {Promise<{answer: string, conversationId: string, tokenCount: number}>}
 */
async function sendMessageToCoze({ agent_id, user_id, message, history = [] }) {
  // agent_id 和 botId 等价
  const botId = agent_id
  const userId = user_id
  const question = message

  if (!cozeConfig.isConfigured()) {
    throw new Error('COZE_API_TOKEN 未配置：请在 .env 中设置 COZE_API_TOKEN')
  }

  if (!botId) {
    throw new Error('botId 不能为空：课程未绑定 AI 助教 Bot')
  }

  // 构建消息列表：历史 + 当前问题
  const additionalMessages = []

  // 历史消息（最近 20 条）
  for (const msg of history) {
    if (msg.role === 'user' || msg.role === 'assistant') {
      additionalMessages.push({
        role: msg.role,
        content: msg.content,
        content_type: 'text'
      })
    }
  }

  // 当前问题
  additionalMessages.push({
    role: 'user',
    content: question,
    content_type: 'text'
  })

  const requestBody = {
    bot_id: botId,
    user_id: String(userId),
    stream: false,
    auto_save_history: true,
    additional_messages: additionalMessages
  }

  const url = `${cozeConfig.baseUrl}/v3/chat`

  let response
  try {
    response = await axios.post(url, requestBody, {
      headers: {
        'Authorization': `Bearer ${cozeConfig.apiToken}`,
        'Content-Type': 'application/json'
      },
      timeout: cozeConfig.timeout
    })
  } catch (err) {
    if (err.response) {
      const status = err.response.status
      const cozeMsg = err.response.data?.msg || err.response.data?.message || '未知错误'
      if (status === 401) {
        throw new Error(`Coze API 认证失败 (401)：请检查 COZE_API_TOKEN 是否正确`)
      }
      if (status === 429) {
        throw new Error(`Coze API 请求频率过高 (429)：请稍后重试`)
      }
      throw new Error(`Coze API 返回错误 (${status})：${cozeMsg}`)
    }
    if (err.code === 'ECONNABORTED') {
      throw new Error(`Coze API 请求超时 (${cozeConfig.timeout}ms)，请稍后重试`)
    }
    throw new Error(`Coze API 请求失败：${err.message}`)
  }

  const data = response.data

  if (data.code !== 0) {
    const errMsg = data.msg || data.message || `Coze API 返回错误码 ${data.code}`
    throw new Error(`Coze API 错误：${errMsg}`)
  }

  const messages = data.data?.messages || []
  const conversationId = data.data?.conversation_id || ''

  // 提取 assistant 角色的最后一条消息作为回答
  const assistantMessages = messages.filter(m => m.role === 'assistant')
  const answer = assistantMessages.length > 0
    ? assistantMessages[assistantMessages.length - 1].content
    : '（AI 助教未返回有效回答）'

  // 提取 token 用量
  const tokenUsage = data.data?.usage || {}
  const tokenCount = tokenUsage.token_count || tokenUsage.total_tokens || 0

  return {
    answer,
    conversationId,
    tokenCount
  }
}

// chat() 作为别名，保持向后兼容
// 参数：{ botId, userId, question, history }
async function chat({ botId, userId, question, history = [] }) {
  return sendMessageToCoze({
    agent_id: botId,
    user_id: userId,
    message: question,
    history
  })
}

module.exports = { sendMessageToCoze, chat }
