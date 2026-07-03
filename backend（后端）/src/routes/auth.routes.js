const express = require('express')
const router = express.Router()
const authController = require('../controllers/auth.controller')
const { authenticate } = require('../middleware/auth')

// 教师/管理员/助教登录（无需认证）
router.post('/auth/login', authController.teacherLogin)

// 学生登录（无需认证）
router.post('/auth/student/login', authController.studentLogin)

// 退出登录（需认证）
router.post('/auth/logout', authenticate, authController.logout)

module.exports = router
