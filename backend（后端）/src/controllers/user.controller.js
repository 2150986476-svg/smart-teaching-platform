const bcrypt = require('bcryptjs')
const pool = require('../config/db')

/**
 * 修改密码（需旧密码验证）
 * PUT /api/users/:id/password
 */
const changePassword = async (req, res, next) => {
  try {
    const { id } = req.params
    const { oldPassword, newPassword } = req.body

    // 仅允许用户修改自己的密码，或管理员修改他人密码
    if (req.user.id !== parseInt(id) && req.user.role !== 'admin') {
      return res.status(403).json({
        code: 403,
        message: '无权修改此用户密码'
      })
    }

    // 参数校验
    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        code: 400,
        message: '旧密码和新密码不能为空'
      })
    }

    // 新密码复杂度校验（6-32位，需含字母和数字）
    if (newPassword.length < 6 || newPassword.length > 32) {
      return res.status(400).json({
        code: 400,
        message: '新密码长度需为6-32位'
      })
    }
    if (!/[a-zA-Z]/.test(newPassword) || !/\d/.test(newPassword)) {
      return res.status(400).json({
        code: 400,
        message: '新密码需包含字母和数字'
      })
    }

    // 查询用户
    const [rows] = await pool.query('SELECT * FROM sys_user WHERE id = ?', [id])
    if (rows.length === 0) {
      return res.status(404).json({
        code: 404,
        message: '用户不存在'
      })
    }

    const user = rows[0]

    // 验证旧密码
    const isPasswordValid = await bcrypt.compare(oldPassword, user.password)
    if (!isPasswordValid) {
      return res.status(401).json({
        code: 401,
        message: '旧密码错误'
      })
    }

    // 新旧密码不能相同
    const isSamePassword = await bcrypt.compare(newPassword, user.password)
    if (isSamePassword) {
      return res.status(400).json({
        code: 400,
        message: '新密码不能与旧密码相同'
      })
    }

    // 加密新密码
    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(newPassword, salt)

    // 更新密码并清除首次登录标记
    await pool.query(
      'UPDATE sys_user SET password = ?, first_login = 0 WHERE id = ?',
      [hashedPassword, id]
    )

    res.json({
      code: 200,
      message: '密码修改成功'
    })
  } catch (err) {
    next(err)
  }
}

module.exports = { changePassword }
