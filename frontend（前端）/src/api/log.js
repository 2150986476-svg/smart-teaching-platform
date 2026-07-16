import request from './request'

/**
 * 获取操作日志列表（分页）
 */
export function getOperationLogs(params) {
  return request.get('/logs', { params })
}

/**
 * 获取操作类型枚举
 */
export function getActionTypes() {
  return request.get('/logs/actions')
}
