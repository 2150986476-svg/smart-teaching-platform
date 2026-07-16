const pool = require('../config/db')

/**
 * 写入操作日志（供其他控制器调用）
 */
async function writeLog({ operator_id, operator_name, operator_role, action, target_type, target_id, target_name, detail, ip_address }) {
  try {
    await pool.query(
      `INSERT INTO operation_log
       (operator_id, operator_name, operator_role, action, target_type, target_id, target_name, detail, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [operator_id, operator_name, operator_role, action, target_type || null, target_id || null, target_name || null, detail || null, ip_address || null]
    )
  } catch (err) {
    console.error('写入操作日志失败:', err.message)
  }
}

/**
 * 获取操作日志列表（分页）
 * GET /api/logs
 */
const getLogs = async (req, res, next) => {
  try {
    const { page = 1, pageSize = 20, action, keyword, startDate, endDate } = req.query
    const offset = (parseInt(page) - 1) * parseInt(pageSize)
    const limit = Math.min(parseInt(pageSize), 100)

    let whereClause = 'WHERE 1=1'
    const params = []

    if (action) {
      whereClause += ' AND action = ?'
      params.push(action)
    }
    if (keyword) {
      whereClause += ' AND (operator_name LIKE ? OR target_name LIKE ? OR detail LIKE ?)'
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`)
    }
    if (startDate) {
      whereClause += ' AND created_at >= ?'
      params.push(startDate)
    }
    if (endDate) {
      whereClause += ' AND created_at <= ?'
      params.push(endDate + ' 23:59:59')
    }

    const [countResult] = await pool.query(
      `SELECT COUNT(*) AS total FROM operation_log ${whereClause}`,
      params
    )
    const total = countResult[0].total

    const [records] = await pool.query(
      `SELECT * FROM operation_log ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    )

    res.json({
      code: 200,
      data: { records, total, page: parseInt(page), pageSize: parseInt(pageSize) }
    })
  } catch (err) {
    next(err)
  }
}

/**
 * 获取操作类型枚举
 * GET /api/logs/actions
 */
const getActionTypes = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT DISTINCT action FROM operation_log ORDER BY action'
    )
    res.json({
      code: 200,
      data: rows.map(r => r.action)
    })
  } catch (err) {
    next(err)
  }
}

module.exports = { getLogs, getActionTypes, writeLog }
