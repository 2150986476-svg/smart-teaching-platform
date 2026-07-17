const express = require('express')
const router = express.Router()
const logController = require('../controllers/log.controller')
const { authenticate, authorize } = require('../middleware/auth')

// 所有日志路由都需要 teacher/admin 权限
// 注意：不使用 router.use() 全局中间件，避免拦截其他路由器的请求
const teacherAuth = [authenticate, authorize('teacher', 'admin')]

// 获取操作日志列表
router.get('/logs', ...teacherAuth, logController.getLogs)

// 获取操作类型枚举
router.get('/logs/actions', ...teacherAuth, logController.getActionTypes)

module.exports = router
