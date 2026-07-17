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

  const conversationId = data.data?.conversation_id || ''
  const chatId = data.data?.id || ''

  // Coze v3: 如果状态是 "in_progress"，需要轮询等待完成再获取消息
  if (data.data?.status === 'in_progress' && conversationId && chatId) {
    const retrieveUrl = `${cozeConfig.baseUrl}/v3/chat/retrieve`
    const messagesUrl = `${cozeConfig.baseUrl}/v3/chat/message/list`
    const maxAttempts = 30   // 最多等待 30 秒（Coze 复杂 Bot 可能需要更久）
    const pollInterval = 1000

    // 等待 chat 完成
    let completed = false
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(resolve => setTimeout(resolve, pollInterval))
      try {
        const retrieveResp = await axios.get(retrieveUrl, {
          params: { conversation_id: conversationId, chat_id: chatId },
          headers: { 'Authorization': `Bearer ${cozeConfig.apiToken}` },
          timeout: 10000
        })
        const s = retrieveResp.data?.data?.status
        if (s === 'completed') { completed = true; break }
        if (s === 'failed') {
          throw new Error(`Coze Bot 处理失败：${retrieveResp.data?.data?.last_error?.msg || '未知错误'}`)
        }
      } catch (pollErr) {
        if (i >= maxAttempts - 1) throw new Error(`Coze 状态轮询失败：${pollErr.message}`)
      }
    }

    if (!completed) {
      throw new Error(`Coze AI 响应超时（等待了 ${(maxAttempts * pollInterval) / 1000} 秒）`)
    }

    // 获取消息列表
    const msgResp = await axios.get(messagesUrl, {
      params: { conversation_id: conversationId, chat_id: chatId },
      headers: { 'Authorization': `Bearer ${cozeConfig.apiToken}` },
      timeout: 15000
    })

    const allMessages = msgResp.data?.data || []
    const answerMessages = allMessages.filter(m => m.type === 'answer' && m.role === 'assistant')
    const answer = answerMessages.length > 0
      ? answerMessages.map(m => m.content).join('\n\n')
      : '（AI 助教未返回有效回答）'

    // 获取 token 用量
    const usageResp = await axios.get(retrieveUrl, {
      params: { conversation_id: conversationId, chat_id: chatId },
      headers: { 'Authorization': `Bearer ${cozeConfig.apiToken}` },
      timeout: 10000
    })
    const tokenUsage = usageResp.data?.data?.usage || {}
    const tokenCount = tokenUsage.token_count || tokenUsage.total_tokens || 0

    return { answer, conversationId, tokenCount }
  }

  // Fallback: 处理同步返回的情况（有 messages 的响应）
  const messages = data.data?.messages || []
  const assistantMessages = messages.filter(m => m.role === 'assistant')
  const answer = assistantMessages.length > 0
    ? assistantMessages[assistantMessages.length - 1].content
    : '（AI 助教未返回有效回答）'

  const tokenUsage = data.data?.usage || {}
  const tokenCount = tokenUsage.token_count || tokenUsage.total_tokens || 0

  return { answer, conversationId, tokenCount }
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
