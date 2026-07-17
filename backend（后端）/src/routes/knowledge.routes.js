const express = require('express')
const router = express.Router()
const knowledgeController = require('../controllers/knowledge.controller')
const { authenticate, authorize } = require('../middleware/auth')

// 知识库同步需教师/管理员权限
// 注意：不使用 router.use() 全局中间件，避免拦截其他路由器的请求
const teacherAuth = [authenticate, authorize('teacher', 'admin')]

// 同步知识库（触发同步流程）
router.post('/courses/:courseId/knowledge/sync', ...teacherAuth, knowledgeController.syncKnowledge)

// 查询同步状态
router.get('/courses/:courseId/knowledge/status', ...teacherAuth, knowledgeController.getKnowledgeStatus)

module.exports = router
