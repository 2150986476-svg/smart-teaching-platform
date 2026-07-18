const express = require('express')
const router = express.Router()
const ctrl = require('../controllers/leaderboard.controller')
const { authenticate, authorize } = require('../middleware/auth')

// 学生查看课程排行榜（需要登录，任何角色均可）
router.get('/student/leaderboard', authenticate, ctrl.getLeaderboard)

module.exports = router
