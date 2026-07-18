const express = require('express')
const router = express.Router()
const authController = require('../controllers/auth.controller')
const { authenticate } = require('../middleware/auth')

// 教师/管理员/助教登录（无需认证）
router.post('/auth/login', authController.teacherLogin)

// 学生登录（无需认证）
router.post('/auth/student/login', authController.studentLogin)

// 学生忘记密码（无需认证，验证身份后重置）
router.post('/auth/student/forgot-password', authController.studentForgotPassword)

// 退出登录（需认证）
router.post('/auth/logout', authenticate, authController.logout)

module.exports = router
