import request from './request'

/**
 * AI 问答 — 学生提问
 * @param {Object} data - { courseId, question, sessionId? }
 * @returns {Promise} { sessionId, answer, references, tokenConsumed, createdAt }
 */
export function sendMessage(data) {
  return request.post('/student/chat', data)
}

/**
 * 获取会话列表
 * @param {Object} params - { courseId?, page?, pageSize? }
 */
export function getSessions(params) {
  return request.get('/student/chat/sessions', { params })
}

/**
 * 获取会话消息列表
 * @param {string} sessionId 会话ID
 */
export function getSessionMessages(sessionId) {
  return request.get(`/student/chat/sessions/${sessionId}`)
}

/**
 * 删除会话
 * @param {string} sessionId 会话ID
 */
export function deleteSession(sessionId) {
  return request.delete(`/student/chat/sessions/${sessionId}`)
}
