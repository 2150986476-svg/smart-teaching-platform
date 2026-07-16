<template>
  <div class="student-dashboard">
    <div class="page-header">
      <h2>👋 欢迎，{{ userInfo?.realName || '同学' }}</h2>
      <p>选择一个课程开始学习</p>
    </div>

    <div class="course-grid" v-loading="loading">
      <div
        v-for="c in courses"
        :key="c.id"
        class="course-card"
      >
        <div class="card-top">
          <div class="card-icon" :style="{ background: gradientColor(c.id) }">
            📚
          </div>
          <div class="card-info">
            <h3>{{ c.name }}</h3>
            <p class="teacher">授课：{{ c.teacherName || '未知' }}</p>
            <p class="semester">{{ c.semester || '' }}</p>
          </div>
        </div>
        <div class="card-body">
          <div class="card-desc" v-if="c.description">
            {{ c.description?.replace(/<[^>]*>/g, '').slice(0, 80) || '暂无简介' }}
          </div>
          <div class="card-actions">
            <el-button type="primary" size="default" @click="goChat(c.id)">
              💬 AI问答
            </el-button>
            <el-button type="success" size="default" @click="goQuiz(c.id)">
              📝 在线练习
            </el-button>
            <el-button type="warning" size="default" @click="goAnalysis(c.id)">
              📊 能力分析
            </el-button>
          </div>
        </div>
      </div>

      <el-empty
        v-if="!loading && courses.length === 0"
        description="暂无已选课程，请联系教师将您加入课程"
        :image-size="120"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getUser } from '@/utils/auth'
import { getMyCourses } from '@/api/student'

const router = useRouter()
const userInfo = ref(getUser())
const courses = ref([])
const loading = ref(false)

const fetchCourses = async () => {
  loading.value = true
  try {
    const res = await getMyCourses()
    courses.value = res.data.records
  } catch {} finally {
    loading.value = false
  }
}

const goChat = (courseId) => {
  router.push({ path: '/student/chat', query: { courseId } })
}

const goQuiz = (courseId) => {
  router.push({ path: '/student/quiz', query: { courseId } })
}

const goAnalysis = (courseId) => {
  router.push({ path: '/student/analysis', query: { courseId } })
}

const colors = ['#1A5F7A', '#22A699', '#e6a23c', '#409EFF', '#67C23A', '#f56c6c']
const gradientColor = (id) => {
  return colors[(id - 1) % colors.length]
}

onMounted(fetchCourses)
</script>

<style lang="scss" scoped>
.student-dashboard {
  max-width: 1100px;
  margin: 0 auto;
  padding: 24px 20px;
}

.page-header {
  margin-bottom: 24px;
  h2 {
    margin: 0 0 6px;
    font-size: 24px;
    color: #303133;
  }
  p {
    margin: 0;
    color: #909399;
    font-size: 14px;
  }
}

.course-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 20px;
}

.course-card {
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06);
  transition: transform 0.2s, box-shadow 0.2s;
  display: flex;
  flex-direction: column;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 24px rgba(0,0,0,0.1);
  }
}

.card-top {
  display: flex;
  gap: 16px;
  padding: 20px 20px 12px;
}

.card-icon {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  flex-shrink: 0;
  color: #fff;
  background: #1A5F7A;
}

.card-info {
  flex: 1;
  min-width: 0;

  h3 {
    margin: 0 0 4px;
    font-size: 17px;
    color: #303133;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .teacher {
    margin: 0;
    font-size: 13px;
    color: #606266;
  }

  .semester {
    margin: 2px 0 0;
    font-size: 12px;
    color: #c0c4cc;
  }
}

.card-body {
  padding: 0 20px 20px;
}

.card-desc {
  font-size: 13px;
  color: #909399;
  min-height: 36px;
  margin-bottom: 12px;
  line-height: 1.5;
}

.card-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;

  .el-button {
    flex: 1;
    min-width: 100px;
    font-size: 13px;
  }
}
</style>
