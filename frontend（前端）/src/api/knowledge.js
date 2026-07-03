import request from './request'

/**
 * 触发知识库同步
 * POST /api/courses/:courseId/knowledge/sync
 * @param {number} courseId
 * @returns {Promise<{data: {total, success, failed, errors, knowledgeId, syncTime}}>}
 */
export function syncKnowledge(courseId) {
  return request.post(`/courses/${courseId}/knowledge/sync`, null, {
    timeout: 600000 // 同步可能耗时较长，超时 10 分钟
  })
}

/**
 * 查询知识库同步状态
 * GET /api/courses/:courseId/knowledge/status
 * @param {number} courseId
 */
export function getKnowledgeStatus(courseId) {
  return request.get(`/courses/${courseId}/knowledge/status`)
}
