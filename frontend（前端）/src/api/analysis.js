import request from './request'

/**
 * 获取学生能力分析（学生自查看）
 * @param {Object} params - { courseId }
 * @returns {Promise} { overview, dimensions, classAvgCorrectRate, overallScore, overallLevel,
 *                      knowledgeMastery, strengths, weaknesses, activityTrend }
 */
export function getStudentAnalysis(params) {
  return request.get('/student/analysis', { params })
}

/**
 * 教师/管理员查看指定学生的能力分析
 * @param {Object} params - { courseId, studentId }
 * @returns {Promise}
 */
export function getStudentAnalysisByTeacher(params) {
  return request.get('/teacher/student-analysis', { params })
}
