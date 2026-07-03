import { createRouter, createWebHistory } from 'vue-router'
import { getToken, getUser } from '@/utils/auth'

const routes = [
  // 教师登录（首页入口）
  {
    path: '/login',
    name: 'TeacherLogin',
    component: () => import('@/views/login/TeacherLogin.vue'),
    meta: { guest: true }
  },
  // 学生登录
  {
    path: '/login/student',
    name: 'StudentLogin',
    component: () => import('@/views/login/StudentLogin.vue'),
    meta: { guest: true }
  },
  // 修改密码（需登录）
  {
    path: '/change-password',
    name: 'ChangePassword',
    component: () => import('@/views/ChangePassword.vue'),
    meta: { requiresAuth: true }
  },
  // 教师后台 - 课程管理
  {
    path: '/dashboard',
    name: 'Dashboard',
    redirect: '/dashboard/courses'
  },
  {
    path: '/dashboard/courses',
    name: 'CourseManage',
    component: () => import('@/views/teacher/CourseManage.vue'),
    meta: { requiresAuth: true, roles: ['teacher', 'admin'] }
  },
  {
    path: '/dashboard/students',
    name: 'StudentManage',
    component: () => import('@/views/teacher/StudentManage.vue'),
    meta: { requiresAuth: true, roles: ['teacher', 'admin'] }
  },
  {
    path: '/dashboard/materials',
    name: 'MaterialManage',
    component: () => import('@/views/teacher/MaterialManage.vue'),
    meta: { requiresAuth: true, roles: ['teacher', 'admin'] }
  },
  // 学生端
  {
    path: '/student',
    redirect: '/student/courses'
  },
  {
    path: '/student/chat',
    name: 'ChatPage',
    component: () => import('@/views/student/ChatPage.vue'),
    meta: { requiresAuth: true, roles: ['student'] }
  },
  {
    path: '/student/quiz',
    name: 'QuizPage',
    component: () => import('@/views/student/QuizPage.vue'),
    meta: { requiresAuth: true, roles: ['student'] }
  },
  {
    path: '/student/analysis',
    name: 'AnalysisPage',
    component: () => import('@/views/student/AnalysisPage.vue'),
    meta: { requiresAuth: true, roles: ['student'] }
  },
  // 默认重定向到登录页
  {
    path: '/',
    redirect: '/login'
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 全局路由守卫 - 认证与权限校验
router.beforeEach((to, from, next) => {
  const token = getToken()
  const user = getUser()

  // 需要登录的页面
  if (to.meta.requiresAuth) {
    if (!token) {
      next('/login')
      return
    }
    // 角色校验
    if (to.meta.roles && Array.isArray(to.meta.roles)) {
      if (!user || !to.meta.roles.includes(user.role)) {
        next('/login')
        return
      }
    }
    next()
  }
  // 游客页面（登录页），已登录直接进后台
  else if (to.meta.guest) {
    if (token && user) {
      if (user.role === 'student') {
        next('/student/chat')
      } else {
        next('/dashboard/courses')
      }
    } else {
      next()
    }
  }
  else {
    next()
  }
})

export default router
