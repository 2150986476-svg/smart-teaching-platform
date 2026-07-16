<template>
  <div class="quiz-page">
    <!-- ===== 阶段一：选题配置 ===== -->
    <div v-if="stage === 'config'" class="quiz-config">
      <div class="config-card">
        <h2>📝 开始练习</h2>
        <el-form label-width="80px">
          <el-form-item label="选择课程">
            <el-select
              v-model="selectedCourseId"
              placeholder="请选择课程"
              style="width: 100%"
              filterable
            >
              <el-option
                v-for="c in courseOptions"
                :key="c.id"
                :label="c.name"
                :value="c.id"
              />
            </el-select>
          </el-form-item>

          <el-form-item label="题目难度">
            <el-radio-group v-model="difficulty">
              <el-radio-button value="easy">简单</el-radio-button>
              <el-radio-button value="medium">中等</el-radio-button>
              <el-radio-button value="hard">困难</el-radio-button>
              <el-radio-button value="mixed">混合</el-radio-button>
            </el-radio-group>
          </el-form-item>

          <el-form-item label="题目数量">
            <el-slider
              v-model="questionCount"
              :min="5"
              :max="20"
              :step="5"
              show-stops
              show-input
              style="width: 300px"
            />
          </el-form-item>

          <el-form-item>
            <el-button
              type="primary"
              :loading="generating"
              :disabled="!selectedCourseId"
              @click="startQuiz"
            >
              开始答题
            </el-button>
          </el-form-item>
        </el-form>
      </div>

      <!-- 历史批次 -->
      <div class="history-card" v-if="!selectedCourseId">
        <h3>📊 历史练习</h3>
        <HistoryTable />
      </div>
    </div>

    <!-- ===== 阶段二：答题中 ===== -->
    <div v-if="stage === 'answering'" class="quiz-answering">
      <!-- 顶部进度栏 -->
      <div class="answer-top-bar">
        <h3>第 {{ currentQuestionIndex }} / {{ questions.length }} 题</h3>
        <div class="top-meta">
          <el-tag :type="difficultyTag">{{ difficultyLabel }}</el-tag>
          <span class="progress-percent">
            {{ answeredCount }}/{{ questions.length }} 已答
          </span>
          <span class="timer">⏱ {{ formatTime(questionTimeSpent) }}</span>
        </div>
      </div>

      <!-- 答题区 -->
      <div class="answer-area">
        <!-- 题号导航 -->
        <div class="question-nav">
          <span
            v-for="q in questions"
            :key="q.index"
            class="nav-dot"
            :class="{
              active: currentQuestionIndex === q.index,
              answered: quizAnswers[q.index],
              correct: quizResults[q.index]?.isCorrect === true,
              wrong: quizResults[q.index]?.isCorrect === false
            }"
            @click="switchQuestion(q.index)"
          >
            {{ q.index }}
          </span>
        </div>

        <!-- 题目卡片 -->
        <div class="question-card" v-if="currentQuestion">
          <div class="question-stem">
            <span class="q-tag">{{ difficultyTagFor(currentQuestion.difficulty) }}</span>
            {{ currentQuestion.index }}. {{ currentQuestion.stem }}
          </div>

          <div class="options-list">
            <div
              v-for="(optText, optKey) in currentQuestion.options"
              :key="optKey"
              class="option-item"
              :class="{
                selected: quizAnswers[currentQuestion.index] === optKey,
                'show-correct': showResult && optKey === currentResult?.correctAnswer,
                'show-wrong': showResult && quizAnswers[currentQuestion.index] === optKey && !currentResult?.isCorrect,
              }"
              @click="selectOption(optKey)"
            >
              <span class="option-key">{{ optKey }}</span>
              <span class="option-text">{{ optText }}</span>
              <el-icon v-if="showResult && optKey === currentResult?.correctAnswer" class="opt-icon correct">
                <CircleCheck />
              </el-icon>
              <el-icon
                v-if="showResult && quizAnswers[currentQuestion.index] === optKey && !currentResult?.isCorrect"
                class="opt-icon wrong"
              >
                <CircleClose />
              </el-icon>
            </div>
          </div>

          <!-- 解析区（提交后显示） -->
          <div v-if="showResult && currentResult" class="explanation-area">
            <div class="explanation-result" :class="{ correct: currentResult.isCorrect, wrong: !currentResult.isCorrect }">
              {{ currentResult.isCorrect ? '✅ 回答正确' : '❌ 回答错误' }}
            </div>
            <div class="explanation-text" v-if="currentResult.explanation">
              <strong>解析：</strong>{{ currentResult.explanation }}
            </div>
            <div class="knowledge-tags" v-if="currentResult.knowledgePoints?.length">
              <el-tag
                v-for="kp in currentResult.knowledgePoints"
                :key="kp"
                size="small"
                type="info"
              >
                {{ kp }}
              </el-tag>
            </div>
          </div>
        </div>

        <!-- 底部操作 -->
        <div class="answer-actions">
          <div>
            <el-button
              :disabled="currentQuestionIndex <= 1"
              @click="switchQuestion(currentQuestionIndex - 1)"
            >
              上一题
            </el-button>
            <el-button
              :disabled="currentQuestionIndex >= questions.length"
              @click="switchQuestion(currentQuestionIndex + 1)"
            >
              下一题
            </el-button>
          </div>
          <div>
            <el-button
              type="warning"
              :disabled="answeredCount < questions.length"
              :loading="submitting"
              @click="showSubmitDialog = true"
            >
              提交答案
            </el-button>
          </div>
        </div>
      </div>
    </div>

    <!-- ===== 阶段三：成绩页 ===== -->
    <div v-if="stage === 'result'" class="quiz-result">
      <div class="result-card">
        <!-- 成绩环 -->
        <div class="score-section">
          <div class="score-circle" :class="scoreLevelClass">
            <span class="score-number">{{ quizResult.score }}</span>
            <span class="score-unit">分</span>
          </div>
          <div class="score-detail">
            <p>正确 <strong>{{ quizResult.correctCount }}</strong> / {{ quizResult.totalCount }} 题</p>
            <p>耗时 {{ formatTime(quizResult.totalTimeSpent) }}</p>
            <el-tag :type="difficultyTag">{{ difficultyLabel }}</el-tag>
          </div>
        </div>

        <!-- 每道题结果 -->
        <div class="result-list">
          <h3>答题详情</h3>
          <div
            v-for="(r, idx) in quizResult.results"
            :key="idx"
            class="result-item"
            :class="{ correct: r.isCorrect, wrong: !r.isCorrect }"
          >
            <div class="result-header">
              <span class="result-icon">{{ r.isCorrect ? '✅' : '❌' }}</span>
              <span class="result-index">第 {{ r.index }} 题</span>
              <span v-if="!r.isCorrect" class="result-answer">
                正确答案：{{ r.correctAnswer }}
              </span>
            </div>
            <div class="result-kp" v-if="r.knowledgePoints?.length">
              <el-tag v-for="kp in r.knowledgePoints" :key="kp" size="small">{{ kp }}</el-tag>
            </div>
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="result-actions">
          <el-button @click="resetQuiz">返回选题</el-button>
          <el-button type="primary" @click="retryQuiz">再练一次</el-button>
        </div>
      </div>
    </div>

    <!-- 提交确认弹窗 -->
    <el-dialog v-model="showSubmitDialog" title="确认提交" width="380px">
      <p>您已作答 {{ answeredCount }} / {{ questions.length }} 题。</p>
      <p v-if="unansweredCount > 0" style="color: #e6a23c">
        ⚠️ 还有 {{ unansweredCount }} 题未作答，将视为错误。
      </p>
      <template #footer>
        <el-button @click="showSubmitDialog = false">继续答题</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">确认提交</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import { CircleCheck, CircleClose } from '@element-plus/icons-vue'
import { getCourses } from '@/api/course'
import { generateQuiz, submitQuiz } from '@/api/quiz'
import HistoryTable from './QuizHistoryTable.vue'

// ===== 配置参数 =====
const selectedCourseId = ref(null)
const difficulty = ref('mixed')
const questionCount = ref(10)
const courseOptions = ref([])
const generating = ref(false)

const fetchCourses = async () => {
  try {
    const res = await getCourses({ pageSize: 100, status: 1 })
    courseOptions.value = res.data.records
  } catch {}
}

// ===== 阶段控制 =====
const stage = ref('config') // config | answering | result

// ===== 答题数据 =====
const batchId = ref('')
const questions = ref([])
const quizAnswers = reactive({})      // { questionIndex: 'A' }
const questionTimes = reactive({})    // { questionIndex: seconds }
const quizResults = reactive({})      // { questionIndex: { isCorrect, correctAnswer, explanation, knowledgePoints } }
const quizResult = reactive({
  score: 0, correctCount: 0, totalCount: 0, totalTimeSpent: 0, results: []
})

const currentQuestionIndex = ref(1)
const questionTimeSpent = ref(0)
let timerInterval = null

const showSubmitDialog = ref(false)
const submitting = ref(false)

// 结果模式（是否在答题页展示批改结果）
const showResult = ref(false)

// ===== 计算属性 =====
const currentQuestion = computed(() =>
  questions.value.find(q => q.index === currentQuestionIndex.value)
)

const currentResult = computed(() =>
  quizResults[currentQuestionIndex.value]
)

const answeredCount = computed(() =>
  Object.keys(quizAnswers).length
)

const unansweredCount = computed(() =>
  questions.value.length - answeredCount.value
)

const difficultyLabel = computed(() => {
  const map = { easy: '简单', medium: '中等', hard: '困难', mixed: '混合' }
  return map[difficulty.value] || '混合'
})

const difficultyTag = computed(() => {
  const map = { easy: 'success', medium: 'warning', hard: 'danger', mixed: 'info' }
  return map[difficulty.value] || 'info'
})

const scoreLevelClass = computed(() => {
  const s = quizResult.score
  if (s >= 90) return 'level-great'
  if (s >= 70) return 'level-good'
  if (s >= 60) return 'level-pass'
  return 'level-fail'
})

function difficultyTagFor(d) {
  const map = { easy: 'success', medium: 'warning', hard: 'danger' }
  return map[d] || 'info'
}

// ===== 计时 =====
function startTimer() {
  stopTimer()
  questionTimeSpent.value = questionTimes[currentQuestionIndex.value] || 0
  timerInterval = setInterval(() => {
    questionTimeSpent.value++
  }, 1000)
}

function stopTimer() {
  if (timerInterval) {
    questionTimes[currentQuestionIndex.value] = questionTimeSpent.value
    clearInterval(timerInterval)
    timerInterval = null
  }
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// ===== 开始答题 =====
async function startQuiz() {
  generating.value = true
  try {
    const res = await generateQuiz({
      courseId: selectedCourseId.value,
      difficulty: difficulty.value,
      count: questionCount.value
    })
    batchId.value = res.data.batchId
    questions.value = res.data.questions

    // 清空已选
    Object.keys(quizAnswers).forEach(k => delete quizAnswers[k])
    Object.keys(questionTimes).forEach(k => delete questionTimes[k])
    Object.keys(quizResults).forEach(k => delete quizResults[k])

    currentQuestionIndex.value = 1
    showResult.value = false
    stage.value = 'answering'
    startTimer()
    ElMessage.success('题目已生成，开始答题！')
  } catch {} finally {
    generating.value = false
  }
}

// ===== 选题 =====
function selectOption(key) {
  if (showResult.value) return // 已批改不能再选
  quizAnswers[currentQuestionIndex.value] = key
}

function switchQuestion(idx) {
  if (idx < 1 || idx > questions.value.length) return
  stopTimer()
  currentQuestionIndex.value = idx
  startTimer()
}

// ===== 提交 =====
async function handleSubmit() {
  submitting.value = true
  stopTimer()
  showSubmitDialog.value = false

  try {
    const answers = questions.value.map(q => ({
      index: q.index,
      answer: quizAnswers[q.index] || '',
      timeSpent: questionTimes[q.index] || 0
    }))

    const res = await submitQuiz({ batchId: batchId.value, answers })

    // 填充结果
    res.data.results.forEach(r => {
      quizResults[r.index] = r
    })

    Object.assign(quizResult, {
      score: res.data.score,
      correctCount: res.data.correctCount,
      totalCount: res.data.totalCount,
      totalTimeSpent: res.data.totalTimeSpent,
      results: res.data.results
    })

    showResult.value = true
    stage.value = 'result'
  } catch {} finally {
    submitting.value = false
  }
}

// ===== 重置/重试 =====
function resetQuiz() {
  stage.value = 'config'
  showResult.value = false
}

function retryQuiz() {
  startQuiz()
}

// ===== 生命周期 =====
onMounted(() => {
  fetchCourses()
})

onUnmounted(() => {
  stopTimer()
})

// 切题时自动滚动到顶部
watch(currentQuestionIndex, () => {
  window.scrollTo({ top: 0, behavior: 'smooth' })
})
</script>

<style lang="scss" scoped>
.quiz-page {
  max-width: 800px;
  margin: 0 auto;
}

// ===== 配置页面 =====
.quiz-config {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.config-card {
  background: #fff;
  border-radius: 8px;
  padding: 24px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06);

  h2 { margin: 0 0 20px; font-size: 20px; color: #303133; }
}

.history-card {
  background: #fff;
  border-radius: 8px;
  padding: 24px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06);
  h3 { margin: 0 0 16px; font-size: 17px; color: #303133; }
}

// ===== 答题页面 =====
.quiz-answering {
  .answer-top-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #fff;
    border-radius: 8px;
    padding: 12px 20px;
    margin-bottom: 12px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.04);
    flex-wrap: wrap;
    gap: 8px;

    h3 { margin: 0; font-size: 16px; color: #303133; white-space: nowrap; }
    .top-meta { display: flex; align-items: center; gap: 12px; font-size: 13px; color: #606266; }
    .timer { font-variant-numeric: tabular-nums; font-weight: 500; }
  }

  .answer-area {
    background: #fff;
    border-radius: 8px;
    padding: 20px;
    box-shadow: 0 2px 12px rgba(0,0,0,0.06);
    min-height: 400px;
  }
}

// 题号导航
.question-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid #ebeef5;

  .nav-dot {
    width: 34px;
    height: 34px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    font-size: 13px;
    cursor: pointer;
    background: #f5f7fa;
    color: #606266;
    border: 2px solid transparent;
    transition: all 0.15s;
    user-select: none;

    &.active {
      border-color: #1A5F7A;
      color: #1A5F7A;
      font-weight: 600;
      background: #e8f0fe;
      transform: scale(1.1);
    }
    &.answered {
      background: #d4e5fd;
      color: #1A5F7A;
    }
    &.correct {
      background: #e8f5e9;
      color: #2e7d32;
    }
    &.wrong {
      background: #ffebee;
      color: #c62828;
    }
    &:hover { background: #e8f0fe; }
  }
}

// 题目卡片
.question-card {
  .question-stem {
    font-size: 16px;
    line-height: 1.7;
    color: #303133;
    margin-bottom: 20px;

    .q-tag {
      display: inline-block;
      padding: 0 6px;
      border-radius: 4px;
      font-size: 11px;
      margin-right: 6px;
      vertical-align: middle;
      color: #fff;
      background: #909399;
    }
  }
}

// 选项
.options-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.option-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border: 2px solid #e4e7ed;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
  user-select: none;

  &:hover { border-color: #1A5F7A; background: #f8fbff; }

  &.selected {
    border-color: #1A5F7A;
    background: #e8f0fe;
    .option-key { background: #1A5F7A; color: #fff; }
  }

  &.show-correct {
    border-color: #22A699;
    background: #e8f5e9;
    .option-key { background: #22A699; color: #fff; }
  }

  &.show-wrong {
    border-color: #f56c6c;
    background: #ffebee;
    .option-key { background: #f56c6c; color: #fff; }
  }
}

.option-key {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 14px;
  background: #f5f7fa;
  color: #606266;
  flex-shrink: 0;
  transition: all 0.15s;
}

.option-text { flex: 1; font-size: 14px; color: #303133; }

.opt-icon {
  font-size: 18px;
  &.correct { color: #22A699; }
  &.wrong { color: #f56c6c; }
}

// 解析区
.explanation-area {
  margin-top: 20px;
  padding: 16px;
  border-radius: 8px;
  background: #fafbfc;
  border: 1px solid #ebeef5;
}

.explanation-result {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 8px;
  &.correct { color: #22A699; }
  &.wrong { color: #f56c6c; }
}

.explanation-text {
  font-size: 13px;
  color: #606266;
  line-height: 1.6;
  margin-bottom: 8px;
}

.knowledge-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

// 底部操作
.answer-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid #ebeef5;
}

// ===== 成绩页 =====
.quiz-result {
  .result-card {
    background: #fff;
    border-radius: 8px;
    padding: 32px 24px;
    box-shadow: 0 2px 12px rgba(0,0,0,0.06);
  }
}

.score-section {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 32px;
  margin-bottom: 32px;
}

.score-circle {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 6px solid;
  flex-shrink: 0;

  &.level-great { border-color: #22A699; color: #22A699; }
  &.level-good  { border-color: #1A5F7A; color: #1A5F7A; }
  &.level-pass  { border-color: #e6a23c; color: #e6a23c; }
  &.level-fail  { border-color: #f56c6c; color: #f56c6c; }
}

.score-number {
  font-size: 38px;
  font-weight: 700;
  line-height: 1;
}

.score-unit {
  font-size: 14px;
  margin-top: 2px;
}

.score-detail {
  font-size: 14px;
  color: #606266;
  p { margin: 4px 0; }
  strong { color: #303133; }
}

.result-list {
  h3 { margin: 0 0 12px; font-size: 16px; color: #303133; }
}

.result-item {
  padding: 10px 12px;
  border-radius: 6px;
  margin-bottom: 8px;
  border: 1px solid #ebeef5;
  &.correct { background: #e8f5e9; }
  &.wrong   { background: #ffebee; }
}

.result-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;

  .result-index { font-weight: 500; color: #303133; }
  .result-answer { color: #c62828; font-size: 13px; }
}

.result-kp {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  margin-top: 6px;
}

.result-actions {
  display: flex;
  justify-content: center;
  gap: 16px;
  margin-top: 24px;
}

// 进度文字
.progress-percent {
  font-variant-numeric: tabular-nums;
}
</style>
