const bcrypt = require('bcryptjs')
const XLSX = require('xlsx')
const pool = require('../config/db')
const { writeLog } = require('./log.controller')

/**
 * 获取课程学生列表（分页）
 * GET /api/courses/:courseId/students
 */
const getStudentsByCourse = async (req, res, next) => {
  try {
    const { courseId } = req.params
    const { page = 1, pageSize = 20, keyword } = req.query
    const offset = (parseInt(page) - 1) * parseInt(pageSize)
    const limit = Math.min(parseInt(pageSize), 100)

    // 校验课程存在且教师权限
    const [courseRows] = await pool.query(
      'SELECT id, teacher_id FROM course WHERE id = ? AND is_deleted = 0',
      [courseId]
    )
    if (courseRows.length === 0) {
      return res.status(404).json({ code: 2001, message: '课程不存在' })
    }
    if (req.user.role === 'teacher' && courseRows[0].teacher_id !== req.user.id) {
      return res.status(403).json({ code: 403, message: '无权查看此课程学生' })
    }

    let whereClause = 'WHERE ce.course_id = ? AND ce.is_active = 1'
    const params = [courseId]

    if (keyword) {
      whereClause += ' AND (u.username LIKE ? OR u.real_name LIKE ?)'
      params.push(`%${keyword}%`, `%${keyword}%`)
    }

    // 总数
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total
       FROM course_enrollment ce
       JOIN sys_user u ON ce.student_id = u.id
       ${whereClause}`,
      params
    )
    const total = countResult[0].total

    // 列表（含学习统计）
    const [records] = await pool.query(
      `SELECT
        u.id, u.username, u.real_name AS realName, u.gender,
        u.department, u.class_name AS className,
        u.status, u.last_login_at AS lastLoginAt,
        ce.enrolled_at AS enrolledAt,
        (SELECT COUNT(*) FROM quiz_batch qb WHERE qb.student_id = u.id AND qb.course_id = ce.course_id AND qb.status = 'completed') AS quizCount,
        COALESCE(
          ROUND(
            (SELECT AVG(qb2.score) FROM quiz_batch qb2
             WHERE qb2.student_id = u.id AND qb2.course_id = ce.course_id AND qb2.status = 'completed') 
          , 2)
        , 0) AS correctRate,
        (SELECT COUNT(*) FROM chat_session cs WHERE cs.student_id = u.id AND cs.course_id = ce.course_id AND cs.is_deleted = 0) AS chatCount
      FROM course_enrollment ce
      JOIN sys_user u ON ce.student_id = u.id
      ${whereClause}
      ORDER BY u.username ASC
      LIMIT ? OFFSET ?`,
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
 * 添加学生到课程
 * POST /api/courses/:courseId/students
 */
const addStudentsToCourse = async (req, res, next) => {
  try {
    const { courseId } = req.params
    const { studentIds } = req.body

    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ code: 400, message: '请提供学生ID列表' })
    }

    // 校验课程及权限
    const [courseRows] = await pool.query(
      'SELECT id, teacher_id FROM course WHERE id = ? AND is_deleted = 0',
      [courseId]
    )
    if (courseRows.length === 0) {
      return res.status(404).json({ code: 2001, message: '课程不存在' })
    }
    if (req.user.role === 'teacher' && courseRows[0].teacher_id !== req.user.id) {
      return res.status(403).json({ code: 403, message: '无权操作此课程' })
    }

    let addedCount = 0
    let skipCount = 0
    const skipReasons = []

    for (const studentId of studentIds) {
      // 校验学生存在
      const [studentRows] = await pool.query(
        'SELECT id FROM sys_user WHERE id = ? AND role = "student"',
        [studentId]
      )
      if (studentRows.length === 0) {
        skipCount++
        skipReasons.push({ studentId, reason: '学生不存在或非学生角色' })
        continue
      }

      // 检查是否已在课程中
      const [enrollmentRows] = await pool.query(
        'SELECT id, is_active FROM course_enrollment WHERE course_id = ? AND student_id = ?',
        [courseId, studentId]
      )

      if (enrollmentRows.length > 0) {
        const enrollment = enrollmentRows[0]
        if (enrollment.is_active === 1) {
          skipCount++
          skipReasons.push({ studentId, reason: '已在课程中' })
          continue
        }
        // 之前退课了，重新激活
        await pool.query(
          'UPDATE course_enrollment SET is_active = 1, quit_at = NULL WHERE course_id = ? AND student_id = ?',
          [courseId, studentId]
        )
      } else {
        await pool.query(
          'INSERT INTO course_enrollment (course_id, student_id) VALUES (?, ?)',
          [courseId, studentId]
        )
      }
      addedCount++
    }

    res.json({
      code: 200,
      data: { addedCount, skipCount, skipReasons },
      message: `成功添加${addedCount}名学生`
    })
  } catch (err) {
    next(err)
  }
}

/**
 * 从课程移除学生（退课）
 * DELETE /api/courses/:courseId/students/:studentId
 */
const removeStudentFromCourse = async (req, res, next) => {
  try {
    const { courseId, studentId } = req.params

    const [courseRows] = await pool.query(
      'SELECT id, teacher_id FROM course WHERE id = ? AND is_deleted = 0',
      [courseId]
    )
    if (courseRows.length === 0) {
      return res.status(404).json({ code: 2001, message: '课程不存在' })
    }
    if (req.user.role === 'teacher' && courseRows[0].teacher_id !== req.user.id) {
      return res.status(403).json({ code: 403, message: '无权操作此课程' })
    }

    const [result] = await pool.query(
      'UPDATE course_enrollment SET is_active = 0, quit_at = NOW() WHERE course_id = ? AND student_id = ? AND is_active = 1',
      [courseId, studentId]
    )

    if (result.affectedRows === 0) {
      return res.status(404).json({ code: 404, message: '该学生不在课程中' })
    }

    res.json({ code: 200, message: '已从课程移除' })
  } catch (err) {
    next(err)
  }
}

/**
 * Excel 批量导入学生
 * POST /api/courses/:courseId/students/import
 */
const importStudents = async (req, res, next) => {
  const connection = await pool.getConnection()
  try {
    const { courseId } = req.params

    // 校验课程及权限
    const [courseRows] = await connection.query(
      'SELECT id, teacher_id FROM course WHERE id = ? AND is_deleted = 0',
      [courseId]
    )
    if (courseRows.length === 0) {
      return res.status(404).json({ code: 2001, message: '课程不存在' })
    }
    if (req.user.role === 'teacher' && courseRows[0].teacher_id !== req.user.id) {
      return res.status(403).json({ code: 403, message: '无权操作此课程' })
    }

    // 检查上传文件
    if (!req.file) {
      return res.status(400).json({ code: 400, message: '请上传 Excel 文件' })
    }

    // 解析 Excel
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    if (!sheetName) {
      return res.status(422).json({ code: 422, message: 'Excel 文件格式不正确' })
    }

    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 })

    if (rows.length < 2) {
      return res.status(422).json({ code: 422, message: 'Excel 文件为空或仅有表头' })
    }

    // 获取表头，识别列（学号、姓名、班级）
    const header = rows[0].map(h => (h !== undefined ? String(h).trim() : ''))
    const colUsername = header.findIndex(h => ['学号', '工号', 'username'].includes(h))
    const colRealName = header.findIndex(h => ['姓名', '真实姓名', 'realName', 'real_name'].includes(h))
    const colClassName = header.findIndex(h => ['班级', 'className', 'class_name'].includes(h))

    if (colUsername === -1) {
      return res.status(422).json({ code: 422, message: 'Excel 缺少"学号"列，请使用导入模板' })
    }
    if (colRealName === -1) {
      return res.status(422).json({ code: 422, message: 'Excel 缺少"姓名"列，请使用导入模板' })
    }

    // 获取默认密码
    const [configRows] = await connection.query(
      'SELECT config_value FROM system_config WHERE config_key = ?',
      ['default_password']
    )
    const defaultPassword = configRows.length > 0 ? configRows[0].config_value : '123456'
    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(defaultPassword, salt)

    await connection.beginTransaction()

    let totalRows = 0
    let successCount = 0
    let newAccounts = 0
    let failCount = 0
    const failDetails = []

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]
      // 跳过空行
      if (!row || row.length === 0 || (row.length === 1 && !row[0])) continue

      totalRows++

      const username = row[colUsername] !== undefined ? String(row[colUsername]).trim() : ''
      const realName = row[colRealName] !== undefined ? String(row[colRealName]).trim() : ''
      const className = colClassName !== -1 && row[colClassName] !== undefined
        ? String(row[colClassName]).trim()
        : null

      if (!username || !realName) {
        failCount++
        // 定位原始行号（Excel 第几行）
        const excelRow = i + 1
        failDetails.push({
          row: excelRow,
          username: username || '(空)',
          reason: '学号或姓名为空'
        })
        continue
      }

      try {
        // 查找或创建学生账号
        let studentId
        const [existingUsers] = await connection.query(
          'SELECT id, role FROM sys_user WHERE username = ?',
          [username]
        )

        if (existingUsers.length > 0) {
          const existing = existingUsers[0]
          if (existing.role !== 'student') {
            failCount++
            failDetails.push({
              row: i + 1,
              username,
              reason: `该用户名已被角色"${existing.role}"占用`
            })
            continue
          }
          studentId = existing.id

          // 如果传了班级信息，更新班级
          if (className) {
            await connection.query(
              'UPDATE sys_user SET class_name = ? WHERE id = ?',
              [className, studentId]
            )
          }
        } else {
          // 创建新学生账号
          const [insertResult] = await connection.query(
            `INSERT INTO sys_user (username, password, real_name, role, class_name, status, first_login)
             VALUES (?, ?, ?, 'student', ?, 1, 1)`,
            [username, hashedPassword, realName, className]
          )
          studentId = insertResult.insertId
          newAccounts++
        }

        // 加入课程
        const [enrollmentRows] = await connection.query(
          'SELECT id, is_active FROM course_enrollment WHERE course_id = ? AND student_id = ?',
          [courseId, studentId]
        )

        if (enrollmentRows.length > 0 && enrollmentRows[0].is_active === 1) {
          // 已在课程中，不算失败也不算新增
          successCount++
        } else {
          if (enrollmentRows.length > 0) {
            await connection.query(
              'UPDATE course_enrollment SET is_active = 1, quit_at = NULL WHERE course_id = ? AND student_id = ?',
              [courseId, studentId]
            )
          } else {
            await connection.query(
              'INSERT INTO course_enrollment (course_id, student_id) VALUES (?, ?)',
              [courseId, studentId]
            )
          }
          successCount++
        }
      } catch (err) {
        failCount++
        failDetails.push({
          row: i + 1,
          username,
          reason: err.message || '数据库操作失败'
        })
      }
    }

    await connection.commit()

    // 记录操作日志
    await writeLog({
      operator_id: req.user.id,
      operator_name: req.user.realName,
      operator_role: req.user.role,
      action: 'import_students',
      target_type: 'course',
      target_id: parseInt(courseId),
      target_name: `课程ID:${courseId}`,
      detail: `批量导入 ${successCount} 名学生（新增账号 ${newAccounts} 人，失败 ${failCount} 条）`,
      ip_address: req.ip
    })

    res.json({
      code: 200,
      data: { totalRows, successCount, newAccounts, failCount, failDetails }
    })
  } catch (err) {
    await connection.rollback()
    next(err)
  } finally {
    connection.release()
  }
}

/**
 * 下载导入模板
 * GET /api/courses/students/import-template
 */
const downloadTemplate = async (req, res, next) => {
  try {
    const wb = XLSX.utils.book_new()
    const wsData = [['学号', '姓名', '班级']]
    const ws = XLSX.utils.aoa_to_sheet(wsData)

    // 设置列宽
    ws['!cols'] = [
      { wch: 18 },  // 学号
      { wch: 12 },  // 姓名
      { wch: 20 }   // 班级
    ]

    XLSX.utils.book_append_sheet(wb, ws, '学生导入模板')
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    res.setHeader('Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition',
      'attachment; filename="student_import_template.xlsx"')
    res.send(buf)
  } catch (err) {
    next(err)
  }
}

/**
 * 重置学生密码（教师/管理员操作）
 * PUT /api/students/:id/reset-password
 */
const resetStudentPassword = async (req, res, next) => {
  try {
    const { id } = req.params

    // 查询学生
    const [userRows] = await pool.query(
      'SELECT id, username, role FROM sys_user WHERE id = ?',
      [id]
    )
    if (userRows.length === 0) {
      return res.status(404).json({ code: 404, message: '学生不存在' })
    }
    if (userRows[0].role !== 'student') {
      return res.status(400).json({ code: 400, message: '该用户非学生角色' })
    }

    // 获取默认密码
    const [configRows] = await pool.query(
      'SELECT config_value FROM system_config WHERE config_key = ?',
      ['default_password']
    )
    const defaultPassword = configRows.length > 0 ? configRows[0].config_value : '123456'

    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(defaultPassword, salt)

    await pool.query(
      'UPDATE sys_user SET password = ?, first_login = 1 WHERE id = ?',
      [hashedPassword, id]
    )

    // 记录操作日志
    await writeLog({
      operator_id: req.user.id,
      operator_name: req.user.realName,
      operator_role: req.user.role,
      action: 'reset_password',
      target_type: 'student',
      target_id: parseInt(id),
      target_name: userRows[0].username,
      detail: `重置学生密码为默认密码`,
      ip_address: req.ip
    })

    res.json({
      code: 200,
      data: { defaultPassword },
      message: '密码已重置为默认密码，请学生登录后修改'
    })
  } catch (err) {
    next(err)
  }
}

/**
 * 修改学生班级
 * PUT /api/students/:id/class
 */
const updateStudentClass = async (req, res, next) => {
  try {
    const { id } = req.params
    const { className } = req.body

    if (className === undefined || className === null) {
      return res.status(400).json({ code: 400, message: '班级信息不能为空' })
    }

    const [userRows] = await pool.query(
      'SELECT id, username, role FROM sys_user WHERE id = ?',
      [id]
    )
    if (userRows.length === 0) {
      return res.status(404).json({ code: 404, message: '学生不存在' })
    }
    if (userRows[0].role !== 'student') {
      return res.status(400).json({ code: 400, message: '该用户非学生角色' })
    }

    await pool.query(
      'UPDATE sys_user SET class_name = ? WHERE id = ?',
      [className, id]
    )

    // 记录操作日志
    await writeLog({
      operator_id: req.user.id,
      operator_name: req.user.realName,
      operator_role: req.user.role,
      action: 'update_class',
      target_type: 'student',
      target_id: parseInt(id),
      target_name: userRows[0].username,
      detail: `更新班级信息为: ${className || '(空)'}`,
      ip_address: req.ip
    })

    res.json({ code: 200, message: '班级信息更新成功' })
  } catch (err) {
    next(err)
  }
}

/**
 * 获取学生已绑定课程列表
 * GET /api/student/courses
 * 根据 JWT 中的 studentId 查询其选课记录
 */
const getStudentCourses = async (req, res, next) => {
  try {
    const studentId = req.user.id

    const [records] = await pool.query(
      `SELECT
        c.id,
        c.name,
        c.description,
        c.cover_image AS coverImage,
        c.semester,
        c.class_info AS classInfo,
        c.status,
        ce.enrolled_at AS enrolledAt,
        u.real_name AS teacherName,
        aab.assistant_name AS assistantName,
        aab.coze_bot_id AS cozeBotId,
        aab.is_active AS assistantActive,
        aab.welcome_message AS welcomeMessage
      FROM course_enrollment ce
      JOIN course c ON ce.course_id = c.id
      LEFT JOIN sys_user u ON c.teacher_id = u.id
      LEFT JOIN ai_assistant_bind aab ON c.id = aab.course_id
      WHERE ce.student_id = ?
        AND ce.is_active = 1
        AND c.is_deleted = 0
      ORDER BY ce.enrolled_at DESC`,
      [studentId]
    )

    res.json({
      code: 200,
      data: { records, total: records.length }
    })
  } catch (err) {
    next(err)
  }
}

module.exports = {
  getStudentsByCourse,
  getStudentCourses,
  addStudentsToCourse,
  removeStudentFromCourse,
  importStudents,
  downloadTemplate,
  resetStudentPassword,
  updateStudentClass
}
