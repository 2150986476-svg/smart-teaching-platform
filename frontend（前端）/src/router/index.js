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
  // 修改密码（独立页面，全屏居中，首次登录强制跳转此页）
  {
    path: '/change-password',
    name: 'ChangePassword',
    component: () => import('@/views/ChangePassword.vue'),
    meta: { requiresAuth: true, allowFirstLogin: true }
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
      }
    ]
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

    // 首次登录强制改密（学生角色，且 firstLogin 为 true）
    const isStudent = user?.role === 'student'
    if (isStudent && user?.firstLogin && !to.meta.allowFirstLogin) {
      next('/change-password')
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
        // 首次登录强制改密
        if (user.firstLogin) {
          next('/change-password')
          return
        }
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
