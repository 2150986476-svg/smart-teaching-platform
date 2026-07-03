const express = require('express')
const router = express.Router()
const analysisController = require('../controllers/analysis.controller')
const { authenticate, authorize } = require('../middleware/auth')

// 所有分析接口需要认证 + 学生角色
router.use(authenticate)
router.use(authorize('student'))

// 获取学生能力分析（雷达图 + 概览 + 知识点 + 活跃趋势）
router.get('/student/analysis', analysisController.getStudentAnalysis)

module.exports = router
