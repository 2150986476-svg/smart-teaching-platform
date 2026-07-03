import request from './request'

/**
 * 修改密码
 * @param {number} userId 用户ID
 * @param {object} data { oldPassword, newPassword }
 */
export function changePassword(userId, data) {
  return request.put(`/users/${userId}/password`, data)
}
