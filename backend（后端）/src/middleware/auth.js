const jwt = require('jsonwebtoken')

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key'

/**
 * JWT 认证中间件 - 验证 Bearer Token
 * 解析后将用户信息挂载到 req.user
 */
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      code: 401,
      message: '未提供认证Token'
    })
  }

  const token = authHeader.split(' ')[1]

  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    req.user = decoded
    next()
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        code: 401,
        message: 'Token已过期，请重新登录'
      })
    }
    return res.status(401).json({
      code: 401,
      message: 'Token无效'
    })
  }
}

/**
 * 角色校验中间件 - 校验用户角色是否在允许列表中
 * @param  {...string} roles 允许的角色列表，如 'teacher', 'admin'
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        code: 401,
        message: '请先登录'
      })
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        code: 403,
        message: '权限不足，当前角色无权执行此操作'
      })
    }

    next()
  }
}

module.exports = { authenticate, authorize, JWT_SECRET }
