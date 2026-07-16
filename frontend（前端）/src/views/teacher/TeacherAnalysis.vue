<template>
  <div class="teacher-analysis">
    <div class="page-header">
      <h2>📊 学情分析</h2>
      <p>选择课程和学生，查看详细的能力分析报告</p>
    </div>

    <!-- 选择器 -->
    <div class="selector-bar">
      <el-select
        v-model="selectedCourseId"
        placeholder="选择课程"
        style="width: 240px"
        filterable
        @change="onCourseChange"
      >
        <el-option
          v-for="c in courseOptions"
          :key="c.id"
          :label="c.name"
          :value="c.id"
        />
      </el-select>

      <el-select
        v-model="selectedStudentId"
        placeholder="选择学生"
        style="width: 240px"
        filterable
        :disabled="!selectedCourseId"
        :loading="studentLoading"
        @change="fetchAnalysis"
      >
        <el-option
          v-for="s in studentOptions"
          :key="s.id"
          :label="`${s.realName}（${s.username}）`"
          :value="s.id"
        />
      </el-select>
    </div>

    <!-- 加载中 -->
    <div v-if="analysisLoading" class="loading-box">
      <el-skeleton :rows="8" animated />
    </div>

    <!-- 空态 -->
    <div v-else-if="!analysisData" class="empty-box">
      <el-empty description="请选择课程和学生查看能力分析" :image-size="100" />
    </div>

    <!-- 分析数据 -->
    <template v-else>
      <el-alert
        v-if="!analysisData.dataSufficient"
        title="该学生学习数据较少，当前分析结果为保守估计"
        type="warning"
        :closable="false"
        show-icon
        style="margin-bottom: 16px"
      />

      <!-- 概览卡片 -->
      <div class="overview-cards">
        <div class="overview-card">
          <div class="ov-number">{{ overview.totalQuestions }}</div>
          <div class="ov-label">总答题数</div>
        </div>
        <div class="overview-card highlight">
          <div class="ov-number" :class="scoreClass(overview.correctRate)">
            {{ overview.correctRate }}%
          </div>
          <div class="ov-label">正确率</div>
        </div>
        <div class="overview-card">
          <div class="ov-number">{{ overview.totalMessages }}</div>
          <div class="ov-label">提问次数</div>
        </div>
        <div class="overview-card">
          <div class="ov-number">{{ overview.totalDaysActive }}</div>
          <div class="ov-label">活跃天数</div>
        </div>
        <div class="overview-card level-card" :class="levelClass(analysisData.overallLevel)">
          <div class="ov-number">{{ analysisData.overallLevel }}</div>
          <div class="ov-label">综合等级</div>
        </div>
      </div>

      <!-- 雷达图 + 评分明细 -->
      <div class="chart-row">
        <div class="chart-card radar-card">
          <h3>📡 能力雷达图</h3>
          <v-chart :option="radarOption" autoresize style="height: 380px" />
        </div>
        <div class="chart-card score-card">
          <h3>📊 维度评分明细</h3>
          <div class="dimension-list">
            <div
              v-for="d in analysisData.dimensions"
              :key="d.code"
              class="dim-item"
            >
              <div class="dim-header">
                <span class="dim-name">{{ d.name }}</span>
                <span class="dim-score" :class="scoreClass(d.score)">{{ d.score }}</span>
              </div>
              <el-progress
                :percentage="d.score"
                :color="progressColor(d.score)"
                :stroke-width="8"
              />
            </div>
          </div>
          <div class="overall-box">
            <span class="overall-label">综合评分</span>
            <span class="overall-value" :class="scoreClass(analysisData.overallScore)">
              {{ analysisData.overallScore }}
            </span>
          </div>
        </div>
      </div>

      <!-- 知识点掌握 -->
      <div class="chart-card full-width">
        <h3>🎯 知识点掌握度</h3>
        <v-chart v-if="analysisData.knowledgeMastery.length > 0"
          :option="knowledgeBarOption" autoresize style="height: 300px" />
        <el-empty v-else description="暂无知识点答题数据" :image-size="60" />
      </div>

      <!-- 活跃趋势 + 强弱项 -->
      <div class="chart-row">
        <div class="chart-card trend-card">
          <h3>📈 学习活跃趋势（近14天）</h3>
          <v-chart :option="trendOption" autoresize style="height: 280px" />
        </div>
        <div class="chart-card summary-card">
          <h3>💡 强弱项分析</h3>
          <div class="sw-section">
            <div class="sw-title strong">✅ 优势</div>
            <div v-if="analysisData.strengths.length > 0" class="sw-tags">
              <el-tag v-for="s in analysisData.strengths" :key="s" type="success" size="small">
                {{ s }}
              </el-tag>
            </div>
            <div v-else class="sw-empty">暂无明确的优势知识点</div>
          </div>
          <div class="sw-section">
            <div class="sw-title weak">⚠️ 薄弱</div>
            <div v-if="analysisData.weaknesses.length > 0" class="sw-tags">
              <el-tag v-for="w in analysisData.weaknesses" :key="w" type="danger" size="small">
                {{ w }}
              </el-tag>
            </div>
            <div v-else class="sw-empty">暂无薄弱的知识点</div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { use } from 'echarts/core'
import { RadarChart, BarChart, LineChart } from 'echarts/charts'
import { TitleComponent, TooltipComponent, LegendComponent, GridComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import VChart from 'vue-echarts'
import { getCourses } from '@/api/course'
import { getStudentsByCourse } from '@/api/student'
import { getStudentAnalysisByTeacher } from '@/api/analysis'

use([RadarChart, BarChart, LineChart, TitleComponent, TooltipComponent, LegendComponent, GridComponent, CanvasRenderer])

const selectedCourseId = ref(null)
const selectedStudentId = ref(null)
const courseOptions = ref([])
const studentOptions = ref([])
const studentLoading = ref(false)
const analysisLoading = ref(false)
const analysisData = ref(null)

const fetchCourses = async () => {
  try {
    const res = await getCourses({ pageSize: 100 })
    courseOptions.value = res.data.records
  } catch {}
}

const onCourseChange = async () => {
  selectedStudentId.value = null
  analysisData.value = null
  if (!selectedCourseId.value) {
    studentOptions.value = []
    return
  }
  studentLoading.value = true
  try {
    const res = await getStudentsByCourse(selectedCourseId.value, { pageSize: 500 })
    studentOptions.value = res.data.records
  } catch {} finally {
    studentLoading.value = false
  }
}

const fetchAnalysis = async () => {
  if (!selectedCourseId.value || !selectedStudentId.value) {
    analysisData.value = null
    return
  }
  analysisLoading.value = true
  try {
    const res = await getStudentAnalysisByTeacher({
      courseId: selectedCourseId.value,
      studentId: selectedStudentId.value
    })
    analysisData.value = res.data
  } catch {} finally {
    analysisLoading.value = false
  }
}

const overview = computed(() => analysisData.value?.overview || {})

const scoreClass = (s) => {
  if (s >= 90) return 'score-great'
  if (s >= 70) return 'score-good'
  if (s >= 60) return 'score-pass'
  return 'score-fail'
}

const levelClass = (level) => {
  const map = { '优秀': 'lv-great', '良好': 'lv-good', '中等': 'lv-pass', '待提高': 'lv-fail', '需关注': 'lv-fail' }
  return map[level] || ''
}

const progressColor = (s) => {
  if (s >= 80) return '#22A699'
  if (s >= 60) return '#1A5F7A'
  if (s >= 40) return '#e6a23c'
  return '#f56c6c'
}

const radarOption = computed(() => {
  const dims = analysisData.value?.dimensions || []
  const indicator = dims.map(d => ({ name: d.name, max: 100 }))
  const studentData = dims.map(d => d.score)
  const series = [{
    type: 'radar',
    data: [{ value: studentData, name: '学生能力', areaStyle: { color: 'rgba(26,95,122,0.2)' } }],
    symbol: 'circle',
    symbolSize: 6,
    lineStyle: { color: '#1A5F7A', width: 2 },
    itemStyle: { color: '#1A5F7A' }
  }]
  const classRate = analysisData.value?.classAvgCorrectRate
  if (classRate !== null && classRate !== undefined) {
    const classVal = Math.min(classRate, 95)
    series.push({
      type: 'radar',
      data: [{ value: [classVal, classVal, classVal, classVal, classVal], name: '班级平均' }],
      symbol: 'diamond',
      symbolSize: 4,
      lineStyle: { color: '#909399', width: 1.5, type: 'dashed' },
      itemStyle: { color: '#909399' },
      areaStyle: { color: 'rgba(144,147,153,0.08)' }
    })
  }
  return {
    tooltip: { trigger: 'item' },
    legend: { bottom: 0, data: ['学生能力', ...(classRate !== null ? ['班级平均'] : [])] },
    radar: {
      center: ['50%', '48%'],
      radius: '70%',
      indicator,
      axisName: { color: '#606266', fontSize: 12 }
    },
    series
  }
})

const knowledgeBarOption = computed(() => {
  const mastery = analysisData.value?.knowledgeMastery || []
  const names = mastery.map(m => m.name.length > 8 ? m.name.slice(0, 8) + '...' : m.name)
  const rates = mastery.map(m => m.rate)
  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params) => {
        const p = params[0]
        const m = mastery[p.dataIndex]
        return `${m.name}<br/>正确率：${m.rate}%（${m.correct}/${m.total}）`
      }
    },
    grid: { left: 12, right: 30, top: 12, bottom: 40 },
    xAxis: {
      type: 'category',
      data: names,
      axisLabel: { rotate: 30, fontSize: 11, color: '#606266' }
    },
    yAxis: {
      type: 'value',
      max: 100,
      axisLabel: { formatter: '{value}%' }
    },
    series: [{
      type: 'bar',
      data: rates.map(v => ({
        value: v,
        itemStyle: {
          color: v >= 80 ? '#22A699' : v >= 60 ? '#1A5F7A' : v >= 40 ? '#e6a23c' : '#f56c6c'
        }
      })),
      barMaxWidth: 40
    }]
  }
})

const trendOption = computed(() => {
  const trend = analysisData.value?.activityTrend || []
  const dates = trend.map(t => t.date.slice(5))
  const chatData = trend.map(t => t.chatCount)
  const quizData = trend.map(t => t.quizCount)
  return {
    tooltip: { trigger: 'axis' },
    legend: { bottom: 0, data: ['提问', '答题'] },
    grid: { left: 12, right: 20, top: 16, bottom: 36 },
    xAxis: {
      type: 'category',
      data: dates,
      boundaryGap: false,
      axisLabel: { fontSize: 10, color: '#909399' }
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      axisLabel: { fontSize: 11 }
    },
    series: [
      {
        name: '提问',
        type: 'line',
        data: chatData,
        smooth: true,
        lineStyle: { color: '#22A699', width: 2 },
        itemStyle: { color: '#22A699' },
        areaStyle: { color: 'rgba(34,166,153,0.1)' }
      },
      {
        name: '答题',
        type: 'line',
        data: quizData,
        smooth: true,
        lineStyle: { color: '#1A5F7A', width: 2 },
        itemStyle: { color: '#1A5F7A' },
        areaStyle: { color: 'rgba(26,95,122,0.1)' }
      }
    ]
  }
})

onMounted(fetchCourses)
</script>

<style lang="scss" scoped>
.teacher-analysis {
  padding: 24px 20px;
}

.page-header {
  margin-bottom: 20px;
  h2 { margin: 0 0 6px; font-size: 22px; color: #303133; }
  p { margin: 0; color: #909399; font-size: 14px; }
}

.selector-bar {
  background: #fff;
  border-radius: 8px;
  padding: 16px 20px;
  margin-bottom: 16px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06);
  display: flex;
  gap: 16px;
}

.loading-box, .empty-box {
  background: #fff;
  border-radius: 8px;
  padding: 32px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06);
}

.overview-cards {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}

.overview-card {
  background: #fff;
  border-radius: 8px;
  padding: 16px 12px;
  text-align: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  .ov-number { font-size: 28px; font-weight: 700; color: #303133; line-height: 1.2; }
  .ov-label { font-size: 12px; color: #909399; margin-top: 4px; }
  &.level-card {
    &.lv-great  { background: #e8f5e9; .ov-number { color: #22A699; } }
    &.lv-good   { background: #e8f0fe; .ov-number { color: #1A5F7A; } }
    &.lv-pass   { background: #fef3e2; .ov-number { color: #e6a23c; } }
    &.lv-fail   { background: #ffebee; .ov-number { color: #f56c6c; } }
  }
}

.chart-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 16px;
}

.chart-card {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06);
  h3 { margin: 0 0 12px; font-size: 15px; color: #303133; font-weight: 500; }
}

.full-width { margin-bottom: 16px; }

.dimension-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.dim-item {
  .dim-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 6px;
    font-size: 13px;
    .dim-name { color: #606266; }
    .dim-score { font-weight: 600; font-size: 15px; }
  }
}

.overall-box {
  display: flex;
  justify-content: center;
  align-items: baseline;
  gap: 8px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid #ebeef5;
  .overall-label { font-size: 14px; color: #909399; }
  .overall-value { font-size: 36px; font-weight: 700; }
}

.sw-section {
  margin-bottom: 16px;
  .sw-title { font-size: 14px; font-weight: 500; margin-bottom: 8px; &.strong { color: #22A699; } &.weak { color: #f56c6c; } }
  .sw-tags { display: flex; flex-wrap: wrap; gap: 6px; }
  .sw-empty { color: #c0c4cc; font-size: 13px; }
}

.score-great  { color: #22A699; }
.score-good   { color: #1A5F7A; }
.score-pass   { color: #e6a23c; }
.score-fail   { color: #f56c6c; }

@media (max-width: 768px) {
  .overview-cards { grid-template-columns: repeat(3, 1fr); }
  .chart-row { grid-template-columns: 1fr; }
}
</style>
