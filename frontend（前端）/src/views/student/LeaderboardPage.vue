<template>
  <div class="leaderboard-page">
    <h2>🏆 排行榜</h2>

    <div class="lb-filter">
      <el-select v-model="courseId" placeholder="选择课程" @change="fetchData" style="width: 250px">
        <el-option v-for="c in courses" :key="c.id" :label="c.name" :value="c.id" />
      </el-select>
    </div>

    <el-empty v-if="!courseId" description="请先选择课程" />

    <div v-else v-loading="loading">
      <div class="top-three" v-if="records.length >= 3">
        <div class="top-card rank-2" v-if="records[1]">
          <span class="medal">🥈</span>
          <span class="name">{{ records[1].studentName }}</span>
          <span class="score">{{ records[1].avgScore }}分</span>
        </div>
        <div class="top-card rank-1" v-if="records[0]">
          <span class="medal">🥇</span>
          <span class="name">{{ records[0].studentName }}</span>
          <span class="score">{{ records[0].avgScore }}分</span>
        </div>
        <div class="top-card rank-3" v-if="records[2]">
          <span class="medal">🥉</span>
          <span class="name">{{ records[2].studentName }}</span>
          <span class="score">{{ records[2].avgScore }}分</span>
        </div>
      </div>

      <el-table :data="records" stripe style="margin-top: 16px" empty-text="暂无数据">
        <el-table-column type="index" label="排名" width="70" align="center">
          <template #default="{ $index }">
            <span v-if="$index < 3" class="rank-badge">{{ ['🥇','🥈','🥉'][$index] }}</span>
            <span v-else>{{ $index + 1 }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="studentName" label="姓名" min-width="100" />
        <el-table-column prop="className" label="班级" width="100" />
        <el-table-column prop="quizCount" label="答题次数" width="100" align="center" />
        <el-table-column label="正确率" width="120" align="center">
          <template #default="{ row }">
            <span :class="scoreClass(row.avgScore)" style="font-weight: 600">
              {{ row.correctCount }}/{{ row.totalQuestions }}
              <small>({{ row.avgScore }}%)</small>
            </span>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getCourses } from '@/api/course'
import { getLeaderboard } from '@/api/quiz'

const courses = ref([])
const courseId = ref(null)
const records = ref([])
const loading = ref(false)

const fetchCourses = async () => {
  try {
    const res = await getCourses({ pageSize: 100, status: 1 })
    courses.value = res.data.records
    if (courses.value.length > 0) courseId.value = courses.value[0].id
    if (courseId.value) fetchData()
  } catch {}
}

const fetchData = async () => {
  if (!courseId.value) return
  loading.value = true
  try {
    const res = await getLeaderboard({ courseId: courseId.value })
    records.value = res.data.records
  } catch {} finally { loading.value = false }
}

const scoreClass = (s) => {
  if (s >= 90) return 'score-great'
  if (s >= 70) return 'score-good'
  if (s >= 60) return 'score-pass'
  return 'score-fail'
}

onMounted(fetchCourses)
</script>

<style lang="scss" scoped>
.leaderboard-page { max-width: 800px; margin: 0 auto;
  h2 { margin: 0 0 16px; font-size: 20px; color: #303133; }
}
.lb-filter { margin-bottom: 16px; }
.top-three { display: flex; justify-content: center; gap: 24px; align-items: flex-end; margin: 24px 0; }
.top-card {
  display: flex; flex-direction: column; align-items: center; padding: 20px 28px;
  border-radius: 12px; background: #fff; box-shadow: 0 2px 12px rgba(0,0,0,0.08);
  &.rank-1 { transform: scale(1.15); border: 2px solid #f2be22; }
  &.rank-2 { border: 2px solid #c0c4cc; }
  &.rank-3 { border: 2px solid #e6a23c; }
  .medal { font-size: 32px; }
  .name { font-size: 15px; font-weight: 600; color: #303133; margin-top: 4px; }
  .score { font-size: 20px; font-weight: 700; color: #1A5F7A; margin-top: 4px; }
}
.rank-badge { font-size: 18px; }
.score-great { color: #22A699; }
.score-good  { color: #1A5F7A; }
.score-pass  { color: #e6a23c; }
.score-fail  { color: #f56c6c; }
</style>
