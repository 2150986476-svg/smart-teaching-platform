import request from './request'

/**
 * 学生获取自己已选课程列表
 * @returns {Promise}
 */
export function getMyCourses() {
  return request.get('/student/courses')
}

/**
 * 获取课程学生列表（分页）
 * @param {number} courseId 课程ID
 * @param {Object} params - { page, pageSize, keyword }
 */
export function getStudentsByCourse(courseId, params) {
  return request.get(`/courses/${courseId}/students`, { params })
}

/**
 * 添加学生到课程
 * @param {number} courseId 课程ID
 * @param {number[]} studentIds 学生ID数组
 */
export function addStudentsToCourse(courseId, studentIds) {
  return request.post(`/courses/${courseId}/students`, { studentIds })
}

/**
 * 从课程移除学生
 * @param {number} courseId 课程ID
 * @param {number} studentId 学生ID
 */
export function removeStudentFromCourse(courseId, studentId) {
  return request.delete(`/courses/${courseId}/students/${studentId}`)
}

/**
 * Excel 批量导入学生
 * @param {number} courseId 课程ID
 * @param {FormData} formData - 包含 file 字段
 */
export function importStudents(courseId, formData) {
  return request.post(`/courses/${courseId}/students/import`, formData, {
    timeout: 60000
  })
}

/**
 * 下载导入模板
 */
export function downloadImportTemplate() {
  return request.get('/courses/students/import-template', {
    responseType: 'blob'
  })
}

/**
 * 重置学生密码
 * @param {number} studentId 学生ID
 */
export function resetStudentPassword(studentId) {
  return request.put(`/students/${studentId}/reset-password`)
}

/**
 * 修改学生班级
 * @param {number} studentId 学生ID
 * @param {string} className 班级名称
 */
export function updateStudentClass(studentId, className) {
  return request.put(`/students/${studentId}/class`, { className })
}
