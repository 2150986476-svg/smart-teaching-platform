import request from './request'

/**
 * 获取学生能力分析
 * @param {Object} params - { courseId }
 * @returns {Promise} { overview, dimensions, classAvgCorrectRate, overallScore, overallLevel,
 *                      knowledgeMastery, strengths, weaknesses, activityTrend }
 */
export function getStudentAnalysis(params) {
  return request.get('/student/analysis', { params })
}
