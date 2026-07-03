<template>
  <div class="history-table" v-loading="loading">
    <el-table :data="records" stripe style="width: 100%" empty-text="暂无练习记录">
      <el-table-column prop="batchId" label="批次号" width="100">
        <template #default="{ row }">
          <el-tooltip :content="row.batchId" placement="top">
            <span class="batch-id">{{ row.batchId?.slice(0, 8) }}...</span>
          </el-tooltip>
        </template>
      </el-table-column>
      <el-table-column prop="courseName" label="课程" min-width="120" show-overflow-tooltip />
      <el-table-column prop="difficulty" label="难度" width="80" align="center">
        <template #default="{ row }">
          <el-tag :type="difficultyTag(row.difficulty)" size="small">
            {{ difficultyLabel(row.difficulty) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="score" label="正确率" width="120" align="center">
        <template #default="{ row }">
          <span v-if="row.status === 'completed'" class="score-value" :class="scoreClass(row.score)">
            {{ row.correctCount }}/{{ row.questionCount }}
            <span class="score-pct">({{ row.score }}%)</span>
          </span>
          <el-tag v-else type="info" size="small">进行中</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="totalTimeSpent" label="耗时" width="90" align="center">
        <template #default="{ row }">
          {{ formatTime(row.totalTimeSpent) }}
        </template>
      </el-table-column>
      <el-table-column prop="createdAt" label="创建时间" width="160">
        <template #default="{ row }">
          {{ row.createdAt ? new Date(row.createdAt).toLocaleString('zh-CN') : '' }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="100" align="center" fixed="right">
        <template #default="{ row }">
          <el-button
            v-if="row.status === 'completed'"
            link
            type="primary"
            size="small"
            @click="viewDetail(row)"
          >
            查看详情
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="history-pagination" v-if="total > pageSize">
      <el-pagination
        small
        layout="prev, pager, next"
        :page-size="pageSize"
        :total="total"
        v-model:current-page="page"
        @current-change="fetchData"
      />
    </div>

    <!-- 详情弹窗 -->
    <el-dialog v-model="detailVisible" title="答题详情" width="700px">
      <template v-if="detailBatch">
        <div class="detail-summary">
          <span>难度：<el-tag :type="difficultyTag(detailBatch.difficulty)" size="small">{{ difficultyLabel(detailBatch.difficulty) }}</el-tag></span>
          <span>正确率：<strong :class="scoreClass(detailBatch.score)">{{ detailBatch.correctCount }}/{{ detailBatch.questionCount }} ({{ detailBatch.score }}%)</strong></span>
          <span>耗时：{{ formatTime(detailBatch.totalTimeSpent) }}</span>
        </div>
        <div
          v-for="(q, idx) in detailQuestions"
          :key="idx"
          class="detail-question"
          :class="{ correct: q.isCorrect, wrong: !q.isCorrect }"
        >
          <div class="dq-header">
            <span class="dq-icon">{{ q.isCorrect ? '✅' : '❌' }}</span>
            <span class="dq-index">第 {{ q.questionIndex }} 题</span>
            <span v-if="!q.isCorrect" class="dq-answer">
              你的答案：{{ q.studentAnswer || '未作答' }} → 正确答案：{{ q.correctAnswer }}
            </span>
          </div>
          <div class="dq-stem">{{ q.questionContent?.stem }}</div>
          <div v-if="q.explanation" class="dq-explain">
            <strong>解析：</strong>{{ q.explanation }}
          </div>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getQuizBatches, getQuizBatchDetail } from '@/api/quiz'

const records = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)
const loading = ref(false)

const detailVisible = ref(false)
const detailBatch = ref(null)
const detailQuestions = ref([])

const fetchData = async () => {
  loading.value = true
  try {
    const res = await getQuizBatches({ page: page.value, pageSize: pageSize.value })
    records.value = res.data.records
    total.value = res.data.total
  } catch {} finally {
    loading.value = false
  }
}

const viewDetail = async (row) => {
  try {
    const res = await getQuizBatchDetail(row.batchId)
    detailBatch.value = res.data
    detailQuestions.value = res.data.questions || []
    detailVisible.value = true
  } catch {}
}

const difficultyLabel = (d) => {
  const map = { easy: '简单', medium: '中等', hard: '困难', mixed: '混合' }
  return map[d] || d
}

const difficultyTag = (d) => {
  const map = { easy: 'success', medium: 'warning', hard: 'danger', mixed: 'info' }
  return map[d] || 'info'
}

const scoreClass = (s) => {
  if (s >= 90) return 'score-great'
  if (s >= 70) return 'score-good'
  if (s >= 60) return 'score-pass'
  return 'score-fail'
}

const formatTime = (sec) => {
  const s = sec || 0
  const m = Math.floor(s / 60)
  const rs = s % 60
  return `${String(m).padStart(2, '0')}:${String(rs).padStart(2, '0')}`
}

onMounted(fetchData)
</script>

<style lang="scss" scoped>
.history-table { }

.batch-id {
  font-family: monospace;
  font-size: 12px;
  color: #909399;
}

.score-value {
  font-weight: 600;
  font-size: 14px;
  &.score-great { color: #22A699; }
  &.score-good  { color: #1A5F7A; }
  &.score-pass  { color: #e6a23c; }
  &.score-fail  { color: #f56c6c; }
}

.score-pct { font-size: 12px; color: #909399; }

.history-pagination {
  margin-top: 12px;
  display: flex;
  justify-content: flex-end;
}

.detail-summary {
  display: flex;
  gap: 24px;
  align-items: center;
  margin-bottom: 16px;
  padding: 12px;
  background: #fafbfc;
  border-radius: 6px;
  font-size: 13px;
  color: #606266;
}

.detail-question {
  padding: 12px;
  border-radius: 6px;
  margin-bottom: 10px;
  border: 1px solid #ebeef5;
  &.correct { background: #e8f5e9; border-color: #c8e6c9; }
  &.wrong   { background: #ffebee; border-color: #ffcdd2; }
}

.dq-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  font-size: 13px;

  .dq-index { font-weight: 500; color: #303133; }
  .dq-answer { color: #c62828; }
}

.dq-stem {
  font-size: 13px;
  color: #606266;
  margin-bottom: 4px;
}

.dq-explain {
  font-size: 12px;
  color: #909399;
  line-height: 1.5;
  margin-top: 6px;
}
</style>
