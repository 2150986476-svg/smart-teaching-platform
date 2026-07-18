<template>
  <div class="forgot-password-container">
    <div class="forgot-password-card">
      <div class="card-header">
        <h2>忘记密码</h2>
        <p class="subtitle">验证身份后即可设置新密码</p>
      </div>

      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="top"
        size="large"
        @submit.prevent="handleSubmit"
      >
        <el-form-item label="学号" prop="username">
          <el-input
            v-model="form.username"
            placeholder="请输入学号"
            :prefix-icon="User"
            maxlength="50"
          />
        </el-form-item>

        <el-form-item label="真实姓名（身份验证）" prop="realName">
          <el-input
            v-model="form.realName"
            placeholder="请输入入学时登记的姓名"
            :prefix-icon="UserFilled"
            maxlength="50"
          />
        </el-form-item>

        <el-form-item label="新密码" prop="newPassword">
          <el-input
            v-model="form.newPassword"
            type="password"
            placeholder="6-32位，需包含字母和数字"
            :prefix-icon="Lock"
            show-password
          />
        </el-form-item>

        <el-form-item label="确认新密码" prop="confirmPassword">
          <el-input
            v-model="form.confirmPassword"
            type="password"
            placeholder="请再次输入新密码"
            :prefix-icon="Lock"
            show-password
          />
        </el-form-item>

        <el-form-item>
          <el-button
            type="primary"
            :loading="loading"
            class="submit-btn"
            @click="handleSubmit"
          >
            重置密码
          </el-button>
        </el-form-item>
      </el-form>

      <div class="footer-link">
        <router-link to="/login/student">返回学生登录</router-link>
        &nbsp;|&nbsp;
        <router-link to="/">返回首页</router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { User, UserFilled, Lock } from '@element-plus/icons-vue'
import request from '@/api/request'

const router = useRouter()
const formRef = ref(null)
const loading = ref(false)

const form = reactive({
  username: '',
  realName: '',
  newPassword: '',
  confirmPassword: ''
})

const validateConfirm = (rule, value, callback) => {
  if (value !== form.newPassword) {
    callback(new Error('两次输入的密码不一致'))
  } else {
    callback()
  }
}

const rules = {
  username: [
    { required: true, message: '请输入学号', trigger: 'blur' }
  ],
  realName: [
    { required: true, message: '请输入姓名', trigger: 'blur' }
  ],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, max: 32, message: '密码长度需为6-32位', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请确认新密码', trigger: 'blur' },
    { validator: validateConfirm, trigger: 'blur' }
  ]
}

const handleSubmit = async () => {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  loading.value = true
  try {
    await request.post('/auth/student/forgot-password', {
      username: form.username,
      realName: form.realName,
      newPassword: form.newPassword
    })
    ElMessage.success('密码重置成功，请使用新密码登录')
    router.push('/login/student')
  } catch (err) {
    const msg = err.response?.data?.message || '重置失败，请稍后重试'
    ElMessage.error(msg)
  } finally {
    loading.value = false
  }
}
</script>

<style lang="scss" scoped>
.forgot-password-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #1A5F7A 0%, #22A699 100%);
}

.forgot-password-card {
  width: 420px;
  padding: 40px 36px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);

  .card-header {
    text-align: center;
    margin-bottom: 28px;

    h2 {
      font-size: 24px;
      color: #1A5F7A;
      margin: 0 0 4px 0;
    }

    .subtitle {
      color: #999;
      font-size: 13px;
      margin: 0;
    }
  }
}

.submit-btn {
  width: 100%;
}

.footer-link {
  text-align: center;
  margin-top: 12px;

  a {
    color: #1A5F7A;
    font-size: 14px;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }
}
</style>
