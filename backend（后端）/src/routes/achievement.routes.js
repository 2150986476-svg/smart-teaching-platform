const express = require('express')
const router = express.Router()
const ctrl = require('../controllers/achievement.controller')
const { authenticate, authorize } = require('../middleware/auth')

const studentAuth = [authenticate, authorize('student')]

// 学生查看自己的成就
router.get('/student/achievements', ...studentAuth, ctrl.getAchievements)

module.exports = router
