const axios = require('axios')
const cozeConfig = require('../config/coze')

/**
 * Coze Workflow API 服务
 *
 * API：POST /v1/workflow/run
 * 文档：https://www.coze.cn/docs/developer_guides/workflow_run
 *
 * 用于触发课程出题工作流：
 *   输入 → course_name, difficulty, question_num, knowledge
 *   输出 → [{ question, options, answer, difficulty, knowledge_point }, ...]
 */

const request = axios.create({
  baseURL: cozeConfig.baseUrl,
  headers: {
    'Authorization': `Bearer ${cozeConfig.apiToken}`,
    'Content-Type': 'application/json'
  },
  timeout: 120000 // Workflow 执行可能较慢，2 分钟超时
})

/**
 * 调用 Coze Workflow 生成习题
 *
 * @param {Object} params
 * @param {string} params.workflowId   - Coze Workflow ID
 * @param {string} params.courseName   - 课程名称
 * @param {string} params.difficulty   - 难度：easy / medium / hard / mixed
 * @param {number} params.questionNum  - 题目数量
 * @param {string} params.knowledge    - 课程资料知识摘要
 * @returns {Promise<Array>}           - 题目列表
 */
async function generateQuiz({ workflowId, courseName, difficulty = 'mixed', questionNum = 10, knowledge = '' }) {
  ensureConfigured()

  if (!workflowId) {
    throw new Error('workflowId 不能为空：课程未配置出题 Workflow')
  }

  const parameters = {
    course_name: String(courseName || '未命名课程'),
    difficulty: String(difficulty),
    question_num: String(questionNum),
    knowledge: String(knowledge || '暂无课程资料')
  }

  let response
  try {
    response = await request.post('/v1/workflow/run', {
      workflow_id: workflowId,
      parameters
    })
  } catch (err) {
    throw new CozeWorkflowError('调用 Workflow', err)
  }

  const data = response.data

  if (data.code !== 0) {
    throw new CozeWorkflowError(
      `Workflow 返回错误`,
      new Error(`${data.msg || data.message || `错误码 ${data.code}`}`)
    )
  }

  // 解析 Workflow 输出
  const rawOutput = data.data?.output || data.data?.data || ''
  let questions

  if (typeof rawOutput === 'string') {
    try {
      // 尝试清理 markdown 代码块标记
      let cleaned = rawOutput.trim()
      if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7)
      if (cleaned.startsWith('```')) cleaned = cleaned.slice(3)
      if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3)
      cleaned = cleaned.trim()

      questions = JSON.parse(cleaned)
    } catch {
      throw new CozeWorkflowError(
        '解析 Workflow 输出',
        new Error(`Workflow 返回内容不是合法 JSON：${rawOutput.substring(0, 200)}`)
      )
    }
  } else if (Array.isArray(rawOutput)) {
    questions = rawOutput
  } else if (rawOutput && typeof rawOutput === 'object') {
    // 可能被包在 data 或 questions 字段里
    questions = rawOutput.questions || rawOutput.data || rawOutput
  } else {
    throw new CozeWorkflowError(
      '解析 Workflow 输出',
      new Error('Workflow 返回了无法识别的数据格式')
    )
  }

  // 标准化每一题
  const normalized = normalizeQuestions(questions, difficulty)
  if (normalized.length === 0) {
    throw new CozeWorkflowError(
      '解析 Workflow 输出',
      new Error('Workflow 未返回有效题目')
    )
  }

  return normalized
}

/**
 * 标准化题目格式
 */
function normalizeQuestions(questions, fallbackDifficulty) {
  if (!Array.isArray(questions)) return []

  return questions.map((q, idx) => ({
    question: q.question || q.stem || q.title || q.content || `题目 ${idx + 1}`,
    options: normalizeOptions(q.options),
    answer: q.answer || q.correct_answer || q.correctAnswer || q.key || '',
    difficulty: q.difficulty || fallbackDifficulty || 'medium',
    knowledge_point: q.knowledge_point || q.knowledgePoint || (Array.isArray(q.knowledgePoints) ? q.knowledgePoints.join('、') : '') || '',
    explanation: q.explanation || q.analysis || q.answer_explanation || ''
  }))
}

function normalizeOptions(options) {
  if (!options) return []
  if (Array.isArray(options)) return options
  if (typeof options === 'object') {
    return ['A', 'B', 'C', 'D', 'E', 'F']
      .map(k => options[k])
      .filter(v => v != null)
  }
  return []
}

// ========== 工具 ==========

function ensureConfigured() {
  if (!cozeConfig.isConfigured()) {
    throw new Error('COZE_API_TOKEN 未配置：请在 .env 中设置 COZE_API_TOKEN')
  }
}

class CozeWorkflowError extends Error {
  constructor(operation, originalError) {
    let msg = `Coze Workflow ${operation}失败：`
    if (originalError.response) {
      const status = originalError.response.status
      const cozeMsg = originalError.response.data?.msg
        || originalError.response.data?.message
        || '未知错误'
      if (status === 401) msg += '认证失败，请检查 COZE_API_TOKEN'
      else if (status === 429) msg += '请求频率过高，请稍后重试'
      else msg += `HTTP ${status} - ${cozeMsg}`
    } else if (originalError.code === 'ECONNABORTED') {
      msg += '请求超时，请稍后重试'
    } else {
      msg += originalError.message
    }
    super(msg)
    this.name = 'CozeWorkflowError'
    this.operation = operation
    this.originalError = originalError
  }
}

module.exports = { generateQuiz }
