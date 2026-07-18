const express = require('express')
const router = express.Router()

// 健康检查
router.get('/health', (req, res) => {
  res.json({ code: 200, message: '服务运行正常' })
})

// 认证模块（教师/学生登录、退出）
router.use('/', require('./auth.routes'))

// 用户管理模块（修改密码等）
router.use('/', require('./user.routes'))

// 课程管理模块（CRUD + AI助教绑定）
router.use('/', require('./course.routes'))

// 学生管理模块（列表、导入、删除、重置密码、修改班级）
router.use('/', require('./student.routes'))

// 聊天/AI问答模块（学生提问、会话管理）
router.use('/', require('./chat.routes'))

// 答题模块（生成习题、提交批改、历史记录）
router.use('/', require('./quiz.routes'))

// 能力分析模块（雷达图、知识掌握、活跃趋势）
router.use('/', require('./analysis.routes'))

// 课程资料模块（上传、下载、删除）
router.use('/', require('./material.routes'))

// AI知识库同步模块（同步课程资料到Coze知识库）
router.use('/', require('./knowledge.routes'))

// 操作日志模块（教师查看修改记录）
router.use('/', require('./log.routes'))

// 错题本模块（学生查看、练习错题）
router.use('/', require('./wrongbook.routes'))

// 排行榜模块（学生查看课程排行榜）
router.use('/', require('./leaderboard.routes'))

// 成就模块（学生查看个人成就与徽章）
router.use('/', require('./achievement.routes'))

// 班级分析模块（教师查看班级成绩总览）
router.use('/', require('./classAnalytics.routes'))

module.exports = router
