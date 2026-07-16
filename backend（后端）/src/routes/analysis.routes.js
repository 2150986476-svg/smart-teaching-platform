const express = require('express')
const router = express.Router()
const analysisController = require('../controllers/analysis.controller')
const { authenticate, authorize } = require('../middleware/auth')

// 所有分析接口需要认证
router.use(authenticate)

// 学生：获取自身能力分析
router.get('/student/analysis', authorize('student'), analysisController.getStudentAnalysis)

// 教师/管理员：查看指定学生的能力分析
router.get('/teacher/student-analysis', authorize('teacher', 'admin'), analysisController.getStudentAnalysisForTeacher)

module.exports = router
