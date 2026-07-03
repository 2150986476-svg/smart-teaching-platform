import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { setToken, removeToken, getToken, setUser as setLocalUser, getUser as getLocalUser } from '@/utils/auth'
import { login as teacherLoginApi, studentLogin as studentLoginApi } from '@/api/auth'
import { changePassword as changePasswordApi } from '@/api/user'

export const useUserStore = defineStore('user', () => {
  // --- 状态 ---
  const token = ref(getToken() || '')
  const userInfo = ref(getLocalUser() || null)

  // --- 计算属性 ---
  const isLoggedIn = computed(() => !!token.value)
  const role = computed(() => userInfo.value?.role || '')
  const isTeacher = computed(() => role.value === 'teacher')
  const isStudent = computed(() => role.value === 'student')
  const isAdmin = computed(() => role.value === 'admin')
  const userId = computed(() => userInfo.value?.id || null)

  // --- 操作 ---

  /** 教师登录 */
  async function teacherLogin({ username, password, remember = false }) {
    const res = await teacherLoginApi({ username, password, remember })
    const { token: newToken, user } = res.data
    token.value = newToken
    userInfo.value = user
    setToken(newToken)
    setLocalUser(user)
    return res
  }

  /** 学生登录 */
  async function studentLogin({ username, password }) {
    const res = await studentLoginApi({ username, password })
    const { token: newToken, user, firstLogin } = res.data
    token.value = newToken
    userInfo.value = { ...user, firstLogin }
    setToken(newToken)
    setLocalUser({ ...user, firstLogin })
    return res
  }

  /** 修改密码 */
  async function changePassword(userId, { oldPassword, newPassword }) {
    await changePasswordApi(userId, { oldPassword, newPassword })
  }

  /** 退出登录 */
  function logout() {
    token.value = ''
    userInfo.value = null
    removeToken()
  }

  return {
    token,
    userInfo,
    isLoggedIn,
    role,
    isTeacher,
    isStudent,
    isAdmin,
    userId,
    teacherLogin,
    studentLogin,
    changePassword,
    logout
  }
})
