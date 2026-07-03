import request from './request'

/**
 * 获取课程列表（分页）
 * @param {Object} params - { page, pageSize, status, semester, keyword }
 */
export function getCourses(params) {
  return request.get('/courses', { params })
}

/**
 * 获取课程详情
 * @param {number} id 课程ID
 */
export function getCourseById(id) {
  return request.get(`/courses/${id}`)
}

/**
 * 创建课程（含 AI 助教绑定）
 * @param {Object} data - { name, description, coverImage, semester, classInfo, aiAssistant? }
 */
export function createCourse(data) {
  return request.post('/courses', data)
}

/**
 * 更新课程（含 AI 助教绑定更新）
 * @param {number} id 课程ID
 * @param {Object} data - 要更新的字段 + aiAssistant
 */
export function updateCourse(id, data) {
  return request.put(`/courses/${id}`, data)
}

/**
 * 删除课程（软删除）
 * @param {number} id 课程ID
 */
export function deleteCourse(id) {
  return request.delete(`/courses/${id}`)
}
