const express = require('express')
const router = express.Router()
const chatController = require('../controllers/chat.controller')
const { authenticate, authorize } = require('../middleware/auth')

// === 独立聊天接口（不依赖 JWT，接收 student_id + course_id + message） ===
router.post('/chat', chatController.standaloneChat)

// === 学生 JWT 路由 ===
// 以下路由需要学生认证
router.use(authenticate)
router.use(authorize('student'))

// AI 问答 — 学生提问
router.post('/student/chat', chatController.sendMessage)

// 获取会话列表
router.get('/student/chat/sessions', chatController.getSessions)

// 获取会话消息列表
router.get('/student/chat/sessions/:sessionId', chatController.getSessionMessages)

// 删除会话
router.delete('/student/chat/sessions/:sessionId', chatController.deleteSession)

module.exports = router
