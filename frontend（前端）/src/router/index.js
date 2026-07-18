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
  // 修改密码（教师/管理员使用旧密码修改）
  {
    path: '/change-password',
    name: 'ChangePassword',
    component: () => import('@/views/ChangePassword.vue'),
    meta: { requiresAuth: true, roles: ['teacher', 'admin', 'assistant'] }
  },
  // 学生忘记密码（无需登录，验证身份后重置）
  {
    path: '/forgot-password',
    name: 'StudentForgotPassword',
    component: () => import('@/views/StudentForgotPassword.vue'),
    meta: { guest: true }
  },

  // ======================== 学生端布局 ========================
  {
    path: '/student',
    component: () => import('@/views/student/StudentLayout.vue'),
    meta: { requiresAuth: true, roles: ['student'] },
    children: [
      {
        path: '',
        redirect: '/student/courses'
      },
      {
        path: 'courses',
        name: 'StudentDashboard',
        component: () => import('@/views/student/StudentDashboard.vue')
      },
      {
        path: 'chat',
        name: 'ChatPage',
        component: () => import('@/views/student/ChatPage.vue')
      },
      {
        path: 'quiz',
        name: 'QuizPage',
        component: () => import('@/views/student/QuizPage.vue')
      },
      {
        path: 'analysis',
        name: 'AnalysisPage',
        component: () => import('@/views/student/AnalysisPage.vue')
      },
      {
        path: 'wrong-questions',
        name: 'WrongBookPage',
        component: () => import('@/views/student/WrongBookPage.vue')
      },
      {
        path: 'leaderboard',
        name: 'LeaderboardPage',
        component: () => import('@/views/student/LeaderboardPage.vue')
      }
    ]
  },

  // ======================== 教师端布局 ========================
  {
    path: '/dashboard',
    component: () => import('@/views/teacher/TeacherLayout.vue'),
    meta: { requiresAuth: true, roles: ['teacher', 'admin'] },
    children: [
      {
        path: '',
        redirect: '/dashboard/courses'
      },
      {
        path: 'courses',
        name: 'CourseManage',
        component: () => import('@/views/teacher/CourseManage.vue')
      },
      {
        path: 'students',
        name: 'StudentManage',
        component: () => import('@/views/teacher/StudentManage.vue')
      },
      {
        path: 'materials',
        name: 'MaterialManage',
        component: () => import('@/views/teacher/MaterialManage.vue')
      },
      {
        path: 'analysis',
        name: 'TeacherAnalysis',
        component: () => import('@/views/teacher/TeacherAnalysis.vue')
      },
      {
        path: 'logs',
        name: 'OperationLog',
        component: () => import('@/views/teacher/OperationLog.vue')
      },
      {
        path: 'class-analytics',
        name: 'ClassAnalytics',
        component: () => import('@/views/teacher/ClassAnalytics.vue')
      }
    ]
  },

  // 首页 — 统一入口，展示教师/学生登录入口
  {
    path: '/',
    name: 'Home',
    component: () => import('@/views/HomePage.vue'),
    meta: { guest: true }
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
        next('/student/courses')
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
