const express = require('express')
const router = express.Router()
const quizController = require('../controllers/quiz.controller')
const { authenticate, authorize } = require('../middleware/auth')

// === 独立出题接口（不依赖 JWT，接收 course_id 等参数） ===
router.post('/quiz/generate', quizController.generateQuiz)

// === 学生 JWT 路由 ===
// 以下路由需要学生认证
router.use(authenticate)
router.use(authorize('student'))

// 生成习题
router.post('/student/quiz/generate', quizController.generateQuiz)

// 提交答案
router.post('/student/quiz/submit', quizController.submitQuiz)

// 获取历史答题批次列表
router.get('/student/quiz/batches', quizController.getQuizBatches)

// 获取某批次答题详情
router.get('/student/quiz/batches/:batchId', quizController.getQuizBatchDetail)

module.exports = router
