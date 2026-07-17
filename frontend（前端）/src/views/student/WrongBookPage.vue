<template>
  <div class="wrongbook-page">
    <div class="page-header">
      <h2>📕 错题本</h2>
      <el-select v-model="filterCourseId" placeholder="筛选课程" clearable @change="fetchData" style="width: 220px">
        <el-option v-for="c in courses" :key="c.id" :label="c.name" :value="c.id" />
      </el-select>
    </div>

    <div class="stats-bar" v-if="total > 0">
      <span>共 <strong>{{ total }}</strong> 道未掌握错题</span>
      <el-button type="primary" size="small" :disabled="!filterCourseId || total === 0" @click="startPractice">
        🔄 针对性练习
      </el-button>
    </div>

    <el-empty v-if="total === 0 && !loading" description="暂无错题，继续加油！" />

    <div class="question-list" v-loading="loading">
      <div v-for="q in records" :key="q.id" class="wrong-item" :class="{ mastered: q.mastered }">
        <div class="wi-header">
          <el-tag :type="diffTag(q.difficulty)" size="small">{{ q.difficulty || 'medium' }}</el-tag>
          <span class="wi-course">{{ q.courseName }}</span>
          <span class="wi-count">错误 {{ q.wrongCount }} 次</span>
          <el-button link type="success" size="small" @click="markMastered(q.id)">✅ 已掌握</el-button>
        </div>
        <div class="wi-stem">{{ q.questionContent?.stem }}</div>
        <div class="wi-answer">
          你的答案：<span class="wrong-answer">{{ q.studentAnswer }}</span>
          → 正确答案：<span class="correct-answer">{{ q.correctAnswer }}</span>
        </div>
        <div class="wi-kp" v-if="q.knowledgePoints?.length">
          <el-tag v-for="kp in q.knowledgePoints" :key="kp" size="small" type="info">{{ kp }}</el-tag>
        </div>
      </div>
    </div>

    <el-pagination
      v-if="total > pageSize"
      small background layout="prev, pager, next"
      :total="total" :page-size="pageSize" v-model:current-page="page"
      @current-change="fetchData" style="margin-top: 16px; justify-content: center"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { getCourses } from '@/api/course'
import { getWrongQuestions, markWrongMastered, practiceWrongQuestions } from '@/api/quiz'
import { useRouter } from 'vue-router'

const router = useRouter()
const courses = ref([])
const records = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const filterCourseId = ref(null)
const loading = ref(false)

const fetchCourses = async () => {
  try {
    const res = await getCourses({ pageSize: 100, status: 1 })
    courses.value = res.data.records
    if (courses.value.length > 0 && !filterCourseId.value) {
      filterCourseId.value = courses.value[0].id
    }
  } catch {}
}

const fetchData = async () => {
  loading.value = true
  try {
    const res = await getWrongQuestions({
      courseId: filterCourseId.value || undefined,
      page: page.value,
      pageSize: pageSize.value
    })
    records.value = res.data.records
    total.value = res.data.total
  } catch {} finally {
    loading.value = false
  }
}

const markMastered = async (id) => {
  try {
    await markWrongMastered(id)
    ElMessage.success('已标记为掌握')
    fetchData()
  } catch {}
}

const startPractice = async () => {
  if (!filterCourseId.value) return
  try {
    const res = await practiceWrongQuestions({ courseId: filterCourseId.value, count: 10 })
    if (res.data.count === 0) {
      ElMessage.info('没有未掌握的错题')
      return
    }
    // 把错题数据存到 sessionStorage，跳转到答题页
    sessionStorage.setItem('wrongPractice', JSON.stringify({
      courseId: filterCourseId.value,
      questions: res.data.questions
    }))
    router.push('/student/quiz?mode=practice')
  } catch {}
}

const diffTag = (d) => {
  const map = { easy: 'success', medium: 'warning', hard: 'danger' }
  return map[d] || 'info'
}

onMounted(async () => {
  await fetchCourses()
  if (filterCourseId.value) fetchData()
})
</script>

<style lang="scss" scoped>
.wrongbook-page { max-width: 800px; margin: 0 auto; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;
  h2 { margin: 0; font-size: 20px; color: #303133; }
}
.stats-bar { display: flex; align-items: center; gap: 16px; margin-bottom: 16px; padding: 10px 16px;
  background: #f0f9ff; border-radius: 6px; font-size: 14px; color: #606266; }
.question-list { display: flex; flex-direction: column; gap: 12px; }
.wrong-item {
  padding: 16px; border-radius: 8px; background: #fff; border: 1px solid #ebeef5;
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
  &.mastered { opacity: 0.5; }
}
.wi-header { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; font-size: 13px;
  .wi-course { color: #909399; }
  .wi-count { color: #f56c6c; font-weight: 500; }
}
.wi-stem { font-size: 15px; color: #303133; line-height: 1.6; margin-bottom: 8px; }
.wi-answer { font-size: 13px; color: #606266;
  .wrong-answer { color: #f56c6c; font-weight: 600; text-decoration: line-through; }
  .correct-answer { color: #22A699; font-weight: 600; }
}
.wi-kp { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
</style>
