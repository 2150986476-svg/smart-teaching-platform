<template>
  <div class="home-page">
    <div class="home-card">
      <div class="home-header">
        <h1>📚 智慧教学平台</h1>
        <p class="home-subtitle">AI 驱动的智能教学辅助系统</p>
      </div>

      <div class="login-options">
        <div class="login-card teacher" @click="$router.push('/login')">
          <div class="login-icon">👨‍🏫</div>
          <h2>教师端</h2>
          <p>课程管理 · 学生管理 · 资料上传 · 学情分析</p>
          <el-button type="primary" size="large" round>教师登录</el-button>
        </div>

        <div class="login-card student" @click="$router.push('/login/student')">
          <div class="login-icon">🎓</div>
          <h2>学生端</h2>
          <p>AI 问答 · 在线练习 · 能力分析 · 智能学习</p>
          <el-button type="success" size="large" round>学生登录</el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
</script>

<style scoped lang="scss">
.home-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.home-card {
  background: #fff;
  border-radius: 20px;
  padding: 48px 40px;
  max-width: 720px;
  width: 100%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
}

.home-header {
  text-align: center;
  margin-bottom: 40px;

  h1 {
    font-size: 32px;
    color: #303133;
    margin: 0 0 8px;
  }

  .home-subtitle {
    font-size: 15px;
    color: #909399;
    margin: 0;
  }
}

.login-options {
  display: flex;
  gap: 24px;
  justify-content: center;
}

.login-card {
  flex: 1;
  max-width: 280px;
  text-align: center;
  padding: 32px 24px 28px;
  border-radius: 16px;
  border: 2px solid #ebeef5;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
  }

  &.teacher:hover {
    border-color: #409eff;
    background: #f0f7ff;
  }

  &.student:hover {
    border-color: #67c23a;
    background: #f0f9eb;
  }

  .login-icon {
    font-size: 48px;
    margin-bottom: 12px;
  }

  h2 {
    font-size: 20px;
    color: #303133;
    margin: 0 0 8px;
  }

  p {
    font-size: 13px;
    color: #909399;
    line-height: 1.5;
    margin: 0 0 20px;
  }
}

@media (max-width: 600px) {
  .login-options {
    flex-direction: column;
    align-items: center;
  }

  .login-card {
    max-width: 100%;
    width: 100%;
  }

  .home-card {
    padding: 32px 24px;
  }

  .home-header h1 {
    font-size: 24px;
  }
}
</style>
