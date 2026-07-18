const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const pool = require('../config/db')
const { JWT_SECRET } = require('../middleware/auth')

/**
 * 教师/管理员/助教登录
 * POST /api/auth/login
 */
const teacherLogin = async (req, res, next) => {
  try {
    const { username, password, remember } = req.body

    if (!username || !password) {
      return res.status(400).json({
        code: 400,
        message: '用户名或密码不能为空'
      })
    }

    // 查询用户（教师、管理员、助教）
    const [rows] = await pool.query(
      'SELECT * FROM sys_user WHERE username = ? AND role IN ("teacher", "admin", "assistant")',
      [username]
    )

    if (rows.length === 0) {
      return res.status(401).json({
        code: 1001,
        message: '用户名或密码错误'
      })
    }

    const user = rows[0]

    // 检查账号状态
    if (user.status === 0) {
      return res.status(403).json({
        code: 1002,
        message: '账号已被禁用，请联系管理员'
      })
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.password)
    if (!isPasswordValid) {
      return res.status(401).json({
        code: 1001,
        message: '用户名或密码错误'
      })
    }

    // 生成 JWT Token
    const expiresIn = remember ? '7d' : '24h'
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        realName: user.real_name
      },
      JWT_SECRET,
      { expiresIn }
    )

    // 更新最后登录信息
    const loginIp = req.ip || req.connection.remoteAddress
    await pool.query(
      'UPDATE sys_user SET last_login_at = NOW(), last_login_ip = ?, first_login = 0 WHERE id = ?',
      [loginIp, user.id]
    )

    res.json({
      code: 200,
      message: '登录成功',
      data: {
        token,
        expiresIn: remember ? 604800 : 86400,
        user: {
          id: user.id,
          username: user.username,
          realName: user.real_name,
          role: user.role,
          avatar: user.avatar,
          department: user.department
        }
      }
    })
  } catch (err) {
    next(err)
  }
}

/**
 * 学生登录
 * POST /api/auth/student/login
 */
const studentLogin = async (req, res, next) => {
  try {
    const { username, password, captcha } = req.body

    if (!username || !password) {
      return res.status(400).json({
        code: 400,
        message: '学号或密码不能为空'
      })
    }

    // 查询学生用户
    const [rows] = await pool.query(
      'SELECT * FROM sys_user WHERE username = ? AND role = "student"',
      [username]
    )

    if (rows.length === 0) {
      return res.status(401).json({
        code: 1001,
        message: '学号或密码错误'
      })
    }

    const user = rows[0]

    // 检查账号状态
    if (user.status === 0) {
      return res.status(403).json({
        code: 1002,
        message: '账号已被禁用，请联系教师'
      })
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.password)
    if (!isPasswordValid) {
      return res.status(401).json({
        code: 1001,
        message: '学号或密码错误'
      })
    }

    // 生成 JWT Token
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        realName: user.real_name
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    )

    // 更新最后登录信息
    const loginIp = req.ip || req.connection.remoteAddress
    await pool.query(
      'UPDATE sys_user SET last_login_at = NOW(), last_login_ip = ? WHERE id = ?',
      [loginIp, user.id]
    )

    // 首次登录标记
    const firstLogin = user.first_login === 1

    res.json({
      code: 200,
      message: '登录成功',
      data: {
        token,
        expiresIn: 86400,
        firstLogin,
        user: {
          id: user.id,
          username: user.username,
          realName: user.real_name,
          role: user.role,
          avatar: user.avatar,
          department: user.department,
          className: user.class_name
        }
      }
    })
  } catch (err) {
    next(err)
  }
}

/**
 * 退出登录
 * POST /api/auth/logout
 */
const logout = async (req, res, next) => {
  try {
    // 实际生产环境应将 Token 加入 Redis 黑名单
    // 这里简单返回成功
    res.json({
      code: 200,
      message: '退出成功'
    })
  } catch (err) {
    next(err)
  }
}

/**
 * 学生忘记密码 — 验证身份后重置密码
 * POST /api/auth/student/forgot-password
 * Body: { username, realName, newPassword }
 */
const studentForgotPassword = async (req, res, next) => {
  try {
    const { username, realName, newPassword } = req.body

    if (!username || !realName || !newPassword) {
      return res.status(400).json({ code: 400, message: '学号、姓名和新密码不能为空' })
    }

    if (newPassword.length < 6 || newPassword.length > 32) {
      return res.status(400).json({ code: 400, message: '密码长度需为6-32位' })
    }

    // 查询学生
    const [rows] = await pool.query(
      'SELECT * FROM sys_user WHERE username = ? AND role = "student"',
      [username]
    )

    if (rows.length === 0) {
      return res.status(404).json({ code: 404, message: '学号不存在' })
    }

    const user = rows[0]

    // 验证姓名是否匹配
    if (user.real_name !== realName) {
      return res.status(401).json({ code: 401, message: '身份验证失败：姓名不匹配' })
    }

    // 加密新密码
    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(newPassword, salt)

    // 重置密码，标记为首次登录
    await pool.query(
      'UPDATE sys_user SET password = ?, first_login = 1 WHERE id = ?',
      [hashedPassword, user.id]
    )

    res.json({
      code: 200,
      message: '密码重置成功，请使用新密码登录'
    })
  } catch (err) {
    next(err)
  }
}

module.exports = { teacherLogin, studentLogin, logout, studentForgotPassword }
