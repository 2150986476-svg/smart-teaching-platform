import request from './request'

/**
 * 教师/管理员/助教登录
 */
export function login(data) {
  return request.post('/auth/login', data)
}

/**
 * 学生登录
 */
export function studentLogin(data) {
  return request.post('/auth/student/login', data)
}

/**
 * 退出登录
 */
export function logout() {
  return request.post('/auth/logout')
}
