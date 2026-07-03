import request from './request'

/**
 * 生成习题（从 JSON 题库）
 * @param {Object} data - { courseId, difficulty?, count? }
 * @returns {Promise} { batchId, questions, difficulty, createdAt }
 */
export function generateQuiz(data) {
  return request.post('/student/quiz/generate', data)
}

/**
 * 提交答案并批改
 * @param {Object} data - { batchId, answers: [{index, answer, timeSpent}] }
 * @returns {Promise} { batchId, score, correctCount, totalCount, totalTimeSpent, results, completedAt }
 */
export function submitQuiz(data) {
  return request.post('/student/quiz/submit', data)
}

/**
 * 获取历史答题批次列表
 * @param {Object} params - { courseId?, page?, pageSize? }
 */
export function getQuizBatches(params) {
  return request.get('/student/quiz/batches', { params })
}

/**
 * 获取某批次答题详情
 * @param {string} batchId
 */
export function getQuizBatchDetail(batchId) {
  return request.get(`/student/quiz/batches/${batchId}`)
}
