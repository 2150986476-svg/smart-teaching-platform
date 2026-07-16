const express = require('express')
const router = express.Router()
const logController = require('../controllers/log.controller')
const { authenticate, authorize } = require('../middleware/auth')

// 所有日志路由都需要 teacher/admin 权限
router.use(authenticate)
router.use(authorize('teacher', 'admin'))

// 获取操作日志列表
router.get('/logs', logController.getLogs)

// 获取操作类型枚举
router.get('/logs/actions', logController.getActionTypes)

module.exports = router
