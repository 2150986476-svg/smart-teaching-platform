const express = require('express')
const router = express.Router()
const ctrl = require('../controllers/classAnalytics.controller')
const { authenticate, authorize } = require('../middleware/auth')

const teacherAuth = [authenticate, authorize('teacher', 'admin')]

// 教师查看班级成绩总览
router.get('/teacher/class-analytics', ...teacherAuth, ctrl.getClassAnalytics)

module.exports = router
