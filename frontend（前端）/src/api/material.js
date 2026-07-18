import request from './request'

/**
 * 获取课程资料列表
 * @param {number} courseId 课程ID
 * @param {Object} params - { page?, pageSize? }
 */
export function getMaterials(courseId, params) {
  return request.get(`/courses/${courseId}/materials`, { params })
}

/**
 * 上传课程资料
 * @param {number} courseId 课程ID
 * @param {FormData} formData - 包含 file 字段
 */
export function uploadMaterial(courseId, formData) {
  return request.post(`/courses/${courseId}/materials`, formData, {
    timeout: 120000
  })
}

/**
 * 删除课程资料
 * @param {number} courseId 课程ID
 * @param {number} materialId 资料ID
 */
export function deleteMaterial(courseId, materialId) {
  return request.delete(`/courses/${courseId}/materials/${materialId}`)
}

/**
 * 下载课程资料
 * @param {number} courseId 课程ID
 * @param {number} materialId 资料ID
 * @param {string} fileName 文件名（用于浏览器下载命名）
 */
export function downloadMaterial(courseId, materialId, fileName) {
  return request.get(`/courses/${courseId}/materials/${materialId}/download`, {
    responseType: 'blob'
  }).then(res => {
    const url = window.URL.createObjectURL(new Blob([res]))
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  })
}
