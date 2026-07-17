const pool = require('../config/db')

/**
 * 获取课程列表（分页）
 * GET /api/courses
 * 教师：只看自己创建的课程
 * 管理员：可查看所有
 */
const getCourses = async (req, res, next) => {
  try {
    const { page = 1, pageSize = 20, status, semester, keyword } = req.query
    const offset = (parseInt(page) - 1) * parseInt(pageSize)
    const limit = Math.min(parseInt(pageSize), 100)

    let whereClause = 'WHERE c.is_deleted = 0'
    const params = []

    // 教师只能看自己的课程
    if (req.user.role === 'teacher') {
      whereClause += ' AND c.teacher_id = ?'
      params.push(req.user.id)
    }

    // 状态筛选
    if (status !== undefined && status !== '') {
      whereClause += ' AND c.status = ?'
      params.push(parseInt(status))
    }

    // 学期筛选
    if (semester) {
      whereClause += ' AND c.semester = ?'
      params.push(semester)
    }

    // 课程名称搜索
    if (keyword) {
      whereClause += ' AND c.name LIKE ?'
      params.push(`%${keyword}%`)
    }

    // 查询总数
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM course c ${whereClause}`,
      params
    )
    const total = countResult[0].total

    // 查询列表
    const [records] = await pool.query(
      `SELECT
        c.id, c.name, c.teacher_id, c.description, c.cover_image,
        c.semester, c.status, c.class_info,
        c.created_at AS createdAt, c.updated_at AS updatedAt,
        u.real_name AS teacherName,
        u.department AS teacherDepartment,
        (SELECT COUNT(*) FROM course_enrollment ce WHERE ce.course_id = c.id AND ce.is_active = 1) AS studentCount,
        (SELECT COUNT(*) FROM course_file cf WHERE cf.course_id = c.id) AS materialCount,
        aab.assistant_name AS assistantName,
        aab.coze_bot_id AS cozeBotId,
        aab.is_active AS assistantActive
      FROM course c
      LEFT JOIN sys_user u ON c.teacher_id = u.id
      LEFT JOIN ai_assistant_bind aab ON c.id = aab.course_id
      ${whereClause}
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    )

    res.json({
      code: 200,
      data: {
        records,
        total,
        page: parseInt(page),
        pageSize: parseInt(pageSize)
      }
    })
  } catch (err) {
    next(err)
  }
}

/**
 * 获取课程详情
 * GET /api/courses/:id
 */
const getCourseById = async (req, res, next) => {
  try {
    const { id } = req.params

    // 课程基本信息 + 教师信息
    const [courseRows] = await pool.query(
      `SELECT
        c.id, c.name, c.teacher_id, c.description, c.cover_image,
        c.semester, c.status, c.class_info,
        c.created_at AS createdAt, c.updated_at AS updatedAt,
        u.real_name AS teacherName,
        u.department AS teacherDepartment,
        (SELECT COUNT(*) FROM course_enrollment ce WHERE ce.course_id = c.id AND ce.is_active = 1) AS studentCount,
        (SELECT COUNT(*) FROM course_file cf WHERE cf.course_id = c.id) AS materialCount
      FROM course c
      LEFT JOIN sys_user u ON c.teacher_id = u.id
      WHERE c.id = ? AND c.is_deleted = 0`,
      [id]
    )

    if (courseRows.length === 0) {
      return res.status(404).json({ code: 2001, message: '课程不存在' })
    }

    const course = courseRows[0]

    // 权限校验：教师只能看自己的课程
    if (req.user.role === 'teacher' && course.teacher_id !== req.user.id) {
      return res.status(403).json({ code: 2002, message: '无权操作该课程' })
    }

    // 查询 AI 助教绑定信息
    const [assistantRows] = await pool.query(
      `SELECT
        id, coze_bot_id AS cozeBotId, workflow_id AS workflowId,
        assistant_name AS assistantName,
        assistant_avatar AS assistantAvatar, welcome_message AS welcomeMessage,
        system_prompt AS systemPrompt, temperature, max_tokens AS maxTokens,
        is_active AS isActive, created_at AS createdAt, updated_at AS updatedAt
      FROM ai_assistant_bind
      WHERE course_id = ?`,
      [id]
    )

    course.aiAssistant = assistantRows.length > 0 ? assistantRows[0] : null

    res.json({
      code: 200,
      data: course
    })
  } catch (err) {
    next(err)
  }
}

/**
 * 创建课程（含 AI 助教绑定）
 * POST /api/courses
 */
const createCourse = async (req, res, next) => {
  const connection = await pool.getConnection()
  try {
    const { name, description, coverImage, semester, classInfo, aiAssistant } = req.body

    // 参数校验
    if (!name || !semester) {
      return res.status(400).json({ code: 400, message: '课程名称和学期为必填项' })
    }
    if (name.length < 2 || name.length > 50) {
      return res.status(400).json({ code: 400, message: '课程名称需为2-50字' })
    }

    // 仅教师可创建
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
      return res.status(403).json({ code: 403, message: '无权创建课程（非教师角色）' })
    }

    await connection.beginTransaction()

    // 插入课程
    const [courseResult] = await connection.query(
      `INSERT INTO course (teacher_id, name, description, cover_image, semester, status, class_info)
       VALUES (?, ?, ?, ?, ?, 0, ?)`,
      [req.user.id, name, description || null, coverImage || null, semester, classInfo || null]
    )
    const courseId = courseResult.insertId

    // 自动绑定默认 AI 助教（使用通用 Course Bot）
    const DEFAULT_BOT_ID = '7658283131791294516' // 课程智能学习助教
    const systemPrompt = `你是课程「${name}」的AI学习助教。你的职责是帮助学生理解和掌握本课程的知识。

回答规则：
1. **资料优先**：如果学生的问题可以通过本课程上传的资料（课件、笔记、教材等）解答，请优先引用资料内容，并在回答末尾标注引用来源（如：【引自《XXX课件》第X章】）。
2. **AI补充**：如果资料中没有相关内容，你可以根据自身知识进行回答，但需说明"以下回答基于AI自身知识，仅供参考"。
3. **格式要求**：回答应结构清晰，适当使用标题、列表、代码块等格式；涉及专业术语时给出解释。
4. **提问引导**：如果学生的问题比较宽泛，可以引导他们提出更具体的问题。

${description ? `课程简介：${description}` : ''}`

    await connection.query(
      `INSERT INTO ai_assistant_bind
       (course_id, coze_bot_id, workflow_id, assistant_name, welcome_message, system_prompt, temperature, max_tokens, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE coze_bot_id=VALUES(coze_bot_id), system_prompt=VALUES(system_prompt), is_active=1`,
      [courseId, DEFAULT_BOT_ID, null, `${name}助教`,
       `你好！我是「${name}」课程的AI助教，我可以根据课程资料解答你的问题，有什么想了解的吗？`,
       systemPrompt, 0.70, 2048]
    )

    await connection.commit()

    res.json({
      code: 200,
      data: { id: courseId },
      message: '课程创建成功'
    })
  } catch (err) {
    await connection.rollback()
    next(err)
  } finally {
    connection.release()
  }
}

/**
 * 更新课程（含 AI 助教绑定更新）
 * PUT /api/courses/:id
 */
const updateCourse = async (req, res, next) => {
  const connection = await pool.getConnection()
  try {
    const { id } = req.params
    const { name, description, coverImage, semester, classInfo, status, aiAssistant } = req.body

    // 查询课程是否存在
    const [courseRows] = await connection.query(
      'SELECT * FROM course WHERE id = ? AND is_deleted = 0',
      [id]
    )
    if (courseRows.length === 0) {
      return res.status(404).json({ code: 2001, message: '课程不存在' })
    }

    const course = courseRows[0]

    // 权限校验：仅课程创建者或管理员可修改
    if (req.user.role !== 'admin' && course.teacher_id !== req.user.id) {
      return res.status(403).json({ code: 2002, message: '无权操作此课程' })
    }

    await connection.beginTransaction()

    // 构建动态更新字段
    const updates = []
    const params = []

    if (name !== undefined) {
      if (name.length < 2 || name.length > 50) {
        await connection.rollback()
        return res.status(400).json({ code: 400, message: '课程名称需为2-50字' })
      }
      updates.push('name = ?')
      params.push(name)
    }
    if (description !== undefined) {
      updates.push('description = ?')
      params.push(description)
    }
    if (coverImage !== undefined) {
      updates.push('cover_image = ?')
      params.push(coverImage)
    }
    if (semester !== undefined) {
      updates.push('semester = ?')
      params.push(semester)
    }
    if (classInfo !== undefined) {
      updates.push('class_info = ?')
      params.push(classInfo)
    }
    if (status !== undefined) {
      if (![0, 1, 2].includes(status)) {
        await connection.rollback()
        return res.status(400).json({ code: 400, message: '课程状态值无效' })
      }
      updates.push('status = ?')
      params.push(status)
    }

    if (updates.length > 0) {
      params.push(id)
      await connection.query(
        `UPDATE course SET ${updates.join(', ')} WHERE id = ?`,
        params
      )
    }

    // 更新 AI 助教绑定
    if (aiAssistant) {
      const [existingBind] = await connection.query(
        'SELECT id FROM ai_assistant_bind WHERE course_id = ?',
        [id]
      )

      if (existingBind.length > 0) {
        // 更新已有绑定
        const bindUpdates = []
        const bindParams = []

        if (aiAssistant.cozeBotId !== undefined) {
          bindUpdates.push('coze_bot_id = ?')
          bindParams.push(aiAssistant.cozeBotId)
        }
        if (aiAssistant.assistantName !== undefined) {
          bindUpdates.push('assistant_name = ?')
          bindParams.push(aiAssistant.assistantName)
        }
        if (aiAssistant.assistantAvatar !== undefined) {
          bindUpdates.push('assistant_avatar = ?')
          bindParams.push(aiAssistant.assistantAvatar)
        }
        if (aiAssistant.welcomeMessage !== undefined) {
          bindUpdates.push('welcome_message = ?')
          bindParams.push(aiAssistant.welcomeMessage)
        }
        if (aiAssistant.systemPrompt !== undefined) {
          bindUpdates.push('system_prompt = ?')
          bindParams.push(aiAssistant.systemPrompt)
        }
        if (aiAssistant.temperature !== undefined) {
          bindUpdates.push('temperature = ?')
          bindParams.push(aiAssistant.temperature)
        }
        if (aiAssistant.maxTokens !== undefined) {
          bindUpdates.push('max_tokens = ?')
          bindParams.push(aiAssistant.maxTokens)
        }
        if (aiAssistant.isActive !== undefined) {
          bindUpdates.push('is_active = ?')
          bindParams.push(aiAssistant.isActive ? 1 : 0)
        }
        if (aiAssistant.workflowId !== undefined) {
          bindUpdates.push('workflow_id = ?')
          bindParams.push(aiAssistant.workflowId || null)
        }

        if (bindUpdates.length > 0) {
          bindParams.push(id)
          await connection.query(
            `UPDATE ai_assistant_bind SET ${bindUpdates.join(', ')} WHERE course_id = ?`,
            bindParams
          )
        }
      } else if (aiAssistant.cozeBotId) {
        // 创建新绑定
        await connection.query(
          `INSERT INTO ai_assistant_bind
           (course_id, coze_bot_id, workflow_id, assistant_name, assistant_avatar, welcome_message, system_prompt, temperature, max_tokens, is_active)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
          [
            id,
            aiAssistant.cozeBotId,
            aiAssistant.workflowId || null,
            aiAssistant.assistantName || 'AI助教',
            aiAssistant.assistantAvatar || null,
            aiAssistant.welcomeMessage || '您好，我是本课程的AI助教，有什么可以帮助您的？',
            aiAssistant.systemPrompt || null,
            aiAssistant.temperature ?? 0.70,
            aiAssistant.maxTokens ?? 2048
          ]
        )
      }
    }

    await connection.commit()

    res.json({ code: 200, message: '更新成功' })
  } catch (err) {
    await connection.rollback()
    next(err)
  } finally {
    connection.release()
  }
}

/**
 * 删除课程（软删除）
 * DELETE /api/courses/:id
 */
const deleteCourse = async (req, res, next) => {
  try {
    const { id } = req.params

    // 查询课程
    const [courseRows] = await pool.query(
      'SELECT * FROM course WHERE id = ? AND is_deleted = 0',
      [id]
    )
    if (courseRows.length === 0) {
      return res.status(404).json({ code: 2001, message: '课程不存在' })
    }

    const course = courseRows[0]

    // 权限校验
    if (req.user.role !== 'admin' && course.teacher_id !== req.user.id) {
      return res.status(403).json({ code: 2002, message: '无权删除此课程' })
    }

    // 软删除
    await pool.query(
      'UPDATE course SET is_deleted = 1, deleted_at = NOW() WHERE id = ?',
      [id]
    )

    res.json({ code: 200, message: '删除成功' })
  } catch (err) {
    next(err)
  }
}

module.exports = { getCourses, getCourseById, createCourse, updateCourse, deleteCourse }
