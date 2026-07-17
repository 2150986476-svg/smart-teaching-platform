<template>
  <div class="class-analytics" v-loading="loading">
    <div class="ca-header">
      <h2>📊 {{ data.courseName || '班级成绩总览' }}</h2>
      <el-select v-model="courseId" placeholder="选择课程" @change="fetchData" style="width: 250px">
        <el-option v-for="c in courses" :key="c.id" :label="c.name" :value="c.id" />
      </el-select>
    </div>

    <template v-if="data.overview">
      <!-- 概览卡片 -->
      <div class="stat-cards">
        <div class="stat-card"><span class="sc-num">{{ data.overview.totalStudents }}</span><span class="sc-label">学生数</span></div>
        <div class="stat-card"><span class="sc-num">{{ data.overview.totalBatches }}</span><span class="sc-label">答题批次</span></div>
        <div class="stat-card"><span class="sc-num">{{ data.overview.totalQuestions }}</span><span class="sc-label">总题量</span></div>
        <div class="stat-card"><span class="sc-num" :class="scoreColor(data.overview.avgScore)">{{ data.overview.avgScore }}%</span><span class="sc-label">班级平均正确率</span></div>
      </div>

      <!-- 分数分布 -->
      <div class="section" v-if="data.scoreDistribution?.length">
        <h3>分数分布</h3>
        <div class="dist-bars">
          <div v-for="d in scoreDistDisplay" :key="d.range" class="dist-bar">
            <span class="db-label">{{ d.range }}</span>
            <div class="db-fill-wrap"><div class="db-fill" :style="{ width: d.pct + '%', background: d.color }"></div></div>
            <span class="db-count">{{ d.count }}人</span>
          </div>
        </div>
      </div>

      <!-- 薄弱知识点 -->
      <div class="section" v-if="data.weakPoints?.length">
        <h3>🔴 班级薄弱知识点 Top {{ data.weakPoints.length }}</h3>
        <div class="weak-list">
          <el-tag v-for="w in data.weakPoints" :key="w.name" type="danger" size="large" style="margin: 4px">
            {{ w.name }}（{{ w.wrongCount }}次错误 / {{ w.studentCount }}人）
          </el-tag>
        </div>
      </div>

      <!-- 学生列表 -->
      <div class="section">
        <h3>学生成绩</h3>
        <el-table :data="data.students" stripe empty-text="暂无学生">
          <el-table-column type="index" label="排名" width="60" />
          <el-table-column prop="studentName" label="姓名" width="100" />
          <el-table-column prop="className" label="班级" width="100" />
          <el-table-column prop="quizCount" label="答题次数" width="90" align="center" />
          <el-table-column label="答题量" width="100" align="center">
            <template #default="{ row }">{{ row.correctCount }}/{{ row.totalQuestions }}</template>
          </el-table-column>
          <el-table-column label="正确率" width="110" align="center">
            <template #default="{ row }">
              <span :class="scoreColor(row.avgScore)" style="font-weight: 600">{{ row.avgScore }}%</span>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </template>

    <el-empty v-else-if="!loading" description="请选择课程查看数据" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { getCourses } from '@/api/course'
import { getClassAnalytics } from '@/api/quiz'

const courses = ref([])
const courseId = ref(null)
const data = ref({})
const loading = ref(false)

const scoreDistDisplay = computed(() => {
  const dist = data.value.scoreDistribution || []
  const max = Math.max(...dist.map(d => d.count), 1)
  const colors = { '90-100': '#22A699', '75-89': '#1A5F7A', '60-74': '#e6a23c', '0-59': '#f56c6c' }
  return dist.map(d => ({ ...d, pct: (d.count / max * 100), color: colors[d.scoreRange] || '#909399' }))
})

const fetchCourses = async () => {
  try {
    const res = await getCourses({ pageSize: 100 })
    courses.value = res.data.records || []
    if (courses.value.length > 0) courseId.value = courses.value[0].id
    if (courseId.value) fetchData()
  } catch {}
}

const fetchData = async () => {
  if (!courseId.value) return
  loading.value = true
  try {
    const res = await getClassAnalytics({ courseId: courseId.value })
    data.value = res.data
  } catch {} finally { loading.value = false }
}

const scoreColor = (s) => {
  if (s >= 90) return 'score-great'
  if (s >= 70) return 'score-good'
  if (s >= 60) return 'score-pass'
  return 'score-fail'
}

onMounted(fetchCourses)
</script>

<style lang="scss" scoped>
.class-analytics { max-width: 960px; margin: 0 auto; }
.ca-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;
  h2 { margin: 0; font-size: 20px; color: #303133; }
}
.stat-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
.stat-card { background: #fff; border-radius: 8px; padding: 20px; text-align: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  .sc-num { display: block; font-size: 28px; font-weight: 700; color: #1A5F7A; }
  .sc-label { font-size: 13px; color: #909399; margin-top: 4px; display: block; }
}
.section { margin-bottom: 24px;
  h3 { margin: 0 0 12px; font-size: 16px; color: #303133; }
}
.dist-bars { display: flex; flex-direction: column; gap: 8px; }
.dist-bar { display: flex; align-items: center; gap: 12px;
  .db-label { width: 50px; font-size: 12px; color: #909399; text-align: right; }
  .db-fill-wrap { flex: 1; height: 24px; background: #f5f7fa; border-radius: 4px; overflow: hidden; }
  .db-fill { height: 100%; border-radius: 4px; transition: width 0.5s; min-width: 4px; }
  .db-count { width: 40px; font-size: 12px; color: #606266; }
}
.weak-list { display: flex; flex-wrap: wrap; }
.score-great { color: #22A699; }
.score-good  { color: #1A5F7A; }
.score-pass  { color: #e6a23c; }
.score-fail  { color: #f56c6c; }
</style>
