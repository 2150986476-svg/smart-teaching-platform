<template>
  <div class="teacher-layout">
    <!-- 侧边栏 -->
    <aside class="sidebar">
      <div class="sidebar-brand">
        <span class="brand-icon">🏫</span>
        <span class="brand-text">智慧教学</span>
        <span class="brand-sub">教师后台</span>
      </div>

      <nav class="sidebar-nav">
        <router-link to="/dashboard/courses" class="nav-item" :class="{ active: isActive('/dashboard/courses') }">
          <span class="nav-icon">📖</span>
          <span>课程管理</span>
        </router-link>
        <router-link to="/dashboard/students" class="nav-item" :class="{ active: isActive('/dashboard/students') }">
          <span class="nav-icon">👥</span>
          <span>学生管理</span>
        </router-link>
        <router-link to="/dashboard/materials" class="nav-item" :class="{ active: isActive('/dashboard/materials') }">
          <span class="nav-icon">📁</span>
          <span>资料管理</span>
        </router-link>
        <router-link to="/dashboard/analysis" class="nav-item" :class="{ active: isActive('/dashboard/analysis') }">
          <span class="nav-icon">📊</span>
          <span>学情分析</span>
        </router-link>
        <router-link to="/dashboard/logs" class="nav-item" :class="{ active: isActive('/dashboard/logs') }">
          <span class="nav-icon">📋</span>
          <span>操作日志</span>
        </router-link>
        <router-link to="/dashboard/class-analytics" class="nav-item" :class="{ active: isActive('/dashboard/class-analytics') }">
          <span class="nav-icon">📈</span>
          <span>班级总览</span>
        </router-link>
      </nav>

      <div class="sidebar-footer">
        <router-link to="/change-password" class="nav-item">
          <span class="nav-icon">🔑</span>
          <span>修改密码</span>
        </router-link>
        <a class="nav-item logout" @click="handleLogout">
          <span class="nav-icon">🚪</span>
          <span>退出登录</span>
        </a>
        <div class="user-info">
          <el-avatar :icon="UserFilled" size="small" />
          <div class="user-detail">
            <span class="user-name">{{ userInfo?.realName || '' }}</span>
            <span class="user-role">{{ roleLabel }}</span>
          </div>
        </div>
      </div>
    </aside>

    <!-- 主内容区 -->
    <main class="main-content">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { UserFilled } from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const userInfo = computed(() => userStore.userInfo)

const isActive = (path) => {
  return route.path.startsWith(path)
}

const roleLabel = computed(() => {
  const map = { teacher: '教师', admin: '管理员', assistant: '助教' }
  return map[userStore.role] || ''
})

const handleLogout = () => {
  userStore.logout()
  router.push('/login')
}
</script>

<style lang="scss" scoped>
.teacher-layout {
  display: flex;
  min-height: 100vh;
  background: #f0f2f5;
}

// ======== 侧边栏 ========
.sidebar {
  width: 220px;
  min-width: 220px;
  background: linear-gradient(180deg, #1A5F7A 0%, #14455A 100%);
  display: flex;
  flex-direction: column;
  color: #fff;
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  z-index: 100;
  overflow-y: auto;
}

.sidebar-brand {
  padding: 20px 16px 28px;
  text-align: center;

  .brand-icon { font-size: 32px; display: block; margin-bottom: 4px; }
  .brand-text { font-size: 16px; font-weight: 600; letter-spacing: 1px; }
  .brand-sub { font-size: 11px; color: rgba(255,255,255,0.6); display: block; margin-top: 2px; }
}

.sidebar-nav {
  flex: 1;
  padding: 0 8px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 8px;
  margin-bottom: 4px;
  color: rgba(255,255,255,0.75);
  text-decoration: none;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.15s;
  user-select: none;

  .nav-icon { font-size: 18px; width: 22px; text-align: center; }

  &:hover {
    background: rgba(255,255,255,0.12);
    color: #fff;
  }

  &.active {
    background: rgba(255,255,255,0.18);
    color: #fff;
    font-weight: 600;
  }

  &.logout:hover {
    background: rgba(245,108,108,0.25);
  }
}

.sidebar-footer {
  padding: 12px 8px;
  border-top: 1px solid rgba(255,255,255,0.15);
  margin-top: auto;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  margin-top: 8px;
}

.user-detail {
  display: flex;
  flex-direction: column;

  .user-name {
    font-size: 13px;
    color: rgba(255,255,255,0.9);
  }

  .user-role {
    font-size: 11px;
    color: rgba(255,255,255,0.55);
  }
}

// ======== 主内容 ========
.main-content {
  flex: 1;
  margin-left: 220px;
  padding: 20px;
  min-height: 100vh;
}
</style>
