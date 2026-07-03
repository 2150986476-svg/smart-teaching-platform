const express = require('express')
const router = express.Router()
const userController = require('../controllers/user.controller')
const { authenticate } = require('../middleware/auth')

// 修改密码（需认证：用户本人或管理员）
router.put('/users/:id/password', authenticate, userController.changePassword)

module.exports = router
