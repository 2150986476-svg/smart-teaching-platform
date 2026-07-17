const pool = require('../config/db')
const { v4: uuidv4 } = require('uuid')
const cozeService = require('../services/coze.service')

/**
 * 生成会话标题（取首条消息前30字）
 */
const generateTitle = (question) => {
  if (!question) return '新对话'
  const cleaned = question.replace(/\s+/g, ' ').trim()
  return cleaned.length > 30 ? cleaned.slice(0, 30) + '...' : cleaned
}

/**
 * AI 问答 — 学生提问
 * POST /api/student/chat
 */
const sendMessage = async (req, res, next) => {
  const connection = await pool.getConnection()
  try {
    const { courseId, question, sessionId: existingSessionId } = req.body
    const studentId = req.user.id

    // 参数校验
    if (!courseId || !question) {
      return res.status(400).json({ code: 400, message: '课程ID和问题不能为空' })
    }
    if (question.length > 2000) {
      return res.status(400).json({ code: 400, message: '问题内容不能超过2000字' })
    }

    // 校验选课关系和课程状态
    const [enrollmentRows] = await connection.query(
      `SELECT ce.id FROM course_enrollment ce
       JOIN course c ON ce.course_id = c.id
       WHERE ce.course_id = ? AND ce.student_id = ? AND ce.is_active = 1 AND c.is_deleted = 0`,
      [courseId, studentId]
    )
    if (enrollmentRows.length === 0) {
      return res.status(403).json({ code: 403, message: '无权向此课程AI助教提问（未选课）' })
    }

    // 查询 AI 助教绑定（可选，未绑定时仍可记录对话）
    const [assistantRows] = await connection.query(
      'SELECT coze_bot_id, is_active FROM ai_assistant_bind WHERE course_id = ?',
      [courseId]
    )
    // AI 绑定可选：无绑定时 botId 为 null，跳过 Coze 调用显示友好提示
    const botId = (assistantRows.length > 0 && assistantRows[0].is_active)
      ? assistantRows[0].coze_bot_id
      : null

    // 查询知识库（用于 Coze Bot 关联知识库）
    const [kbRows] = await connection.query(
      `SELECT knowledge_id, coze_dataset_id, sync_status
       FROM coze_knowledge_base
       WHERE course_id = ? AND status = 'ready'`,
      [courseId]
    )
    const knowledgeId = kbRows.length > 0
      ? (kbRows[0].knowledge_id || kbRows[0].coze_dataset_id)
      : null

    await connection.beginTransaction()

    let sessionId = existingSessionId
    let sessionRow = null

    // 处理会话：复用已有或创建新会话
    if (sessionId) {
      const [sRows] = await connection.query(
        `SELECT id, session_id, title, message_count
         FROM chat_session
         WHERE session_id = ? AND student_id = ? AND course_id = ? AND is_deleted = 0`,
        [sessionId, studentId, courseId]
      )
      if (sRows.length === 0) {
        // 传入的 sessionId 无效，创建新会话
        sessionId = uuidv4()
      } else {
        sessionRow = sRows[0]
      }
    } else {
      sessionId = uuidv4()
    }

    // 如果没有有效会话，创建新会话
    if (!sessionRow) {
      await connection.query(
        `INSERT INTO chat_session (session_id, course_id, student_id, title, message_count)
         VALUES (?, ?, ?, ?, 0)`,
        [sessionId, courseId, studentId, generateTitle(question)]
      )
    }

    // 保存学生消息
    await connection.query(
      `INSERT INTO chat_record (session_id, course_id, student_id, role, content, token_count)
       VALUES (?, ?, ?, 'user', ?, 0)`,
      [sessionId, courseId, studentId, question]
    )

    // 获取历史消息（最近 20 条，用于上下文）
    const [historyRows] = await connection.query(
      `SELECT role, content FROM chat_record
       WHERE session_id = ?
       ORDER BY created_at ASC
       LIMIT 20`,
      [sessionId]
    )
    const history = historyRows.map(r => ({ role: r.role, content: r.content }))

    // 查询课程信息 + 资料列表，作为 Coze 上下文
    const [[courseInfo]] = await connection.query(
      'SELECT name, description FROM course WHERE id = ? AND is_deleted = 0',
      [courseId]
    )
    const [courseFiles] = await connection.query(
      'SELECT file_name, file_type FROM course_file WHERE course_id = ? ORDER BY id',
      [courseId]
    )

    // 构建资料上下文（拼接在用户问题前面）
    let materialContext = ''
    if (courseInfo) {
      materialContext += `【当前课程】${courseInfo.name}\n`
      if (courseInfo.description) materialContext += `【课程简介】${courseInfo.description}\n`
    }
    if (courseFiles.length > 0) {
      materialContext += `【课程资料列表】\n`
      courseFiles.forEach(f => {
        materialContext += `- ${f.file_name} (${f.file_type})\n`
      })
      materialContext += `\n`
    }
    const contextualQuestion = materialContext
      ? `${materialContext}【学生提问】${question}`
      : question

    // ============================================================
    // 2. 调用 Coze Chat API（仅当 botId 存在时）
    // ============================================================
    let aiResult
    if (botId) {
      try {
        aiResult = await cozeService.sendMessageToCoze({
          agent_id: botId,
          user_id: studentId,
          message: contextualQuestion,
          history
        })
      } catch (cozeErr) {
        aiResult = {
          answer: 'AI服务暂不可用，请稍后重试。',
          conversationId: '',
          tokenCount: 0,
          references: []
        }
        console.warn(`[Chat] Coze API 调用失败，使用 mock 回复：${cozeErr.message}`)
      }
    } else {
      // 无 AI 绑定，返回友好提示
      aiResult = {
        answer: 'AI助教暂未配置，请联系教师绑定Coze AI服务。\n\n您仍可以在此记录问题和笔记，待AI助教配置完成后即可正常使用。',
        conversationId: '',
        tokenCount: 0,
        references: []
      }
    }

    // 保存 AI 回复（metadata 包含 knowledgeId 用于追踪）
    const metadataObj = { knowledgeId }
    if (aiResult.conversationId) metadataObj.conversationId = aiResult.conversationId
    const metadataJson = JSON.stringify(metadataObj)

    await connection.query(
      `INSERT INTO chat_record
       (session_id, course_id, student_id, role, content, metadata, token_count)
       VALUES (?, ?, ?, 'assistant', ?, ?, ?)`,
      [sessionId, courseId, studentId, aiResult.answer, metadataJson, aiResult.tokenCount]
    )

    // 更新会话信息
    const [countResult] = await connection.query(
      'SELECT COUNT(*) as cnt FROM chat_record WHERE session_id = ?',
      [sessionId]
    )
    const messageCount = countResult[0].cnt

    await connection.query(
      `UPDATE chat_session
       SET message_count = ?, updated_at = NOW(),
           title = IF(message_count <= 2, ?, title)
       WHERE session_id = ?`,
      [messageCount, generateTitle(question), sessionId]
    )

    await connection.commit()

    res.json({
      code: 200,
      data: {
        sessionId,
        answer: aiResult.answer,
        references: aiResult.references || [],
        tokenConsumed: aiResult.tokenCount,
        createdAt: new Date().toISOString()
      }
    })
  } catch (err) {
    await connection.rollback()
    next(err)
  } finally {
    connection.release()
  }
}

/**
 * 获取会话列表
 * GET /api/student/chat/sessions
 */
const getSessions = async (req, res, next) => {
  try {
    const studentId = req.user.id
    const { courseId, page = 1, pageSize = 20 } = req.query
    const offset = (parseInt(page) - 1) * parseInt(pageSize)
    const limit = Math.min(parseInt(pageSize), 50)

    let whereClause = 'WHERE cs.student_id = ? AND cs.is_deleted = 0'
    const params = [studentId]

    if (courseId) {
      whereClause += ' AND cs.course_id = ?'
      params.push(parseInt(courseId))
    }

    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM chat_session cs ${whereClause}`,
      params
    )
    const total = countResult[0].total

    const [records] = await pool.query(
      `SELECT
        cs.session_id AS sessionId,
        cs.course_id AS courseId,
        c.name AS courseName,
        cs.title,
        cs.message_count AS messageCount,
        cs.created_at AS createdAt,
        cs.updated_at AS lastMessageAt
      FROM chat_session cs
      LEFT JOIN course c ON cs.course_id = c.id
      ${whereClause}
      ORDER BY cs.updated_at DESC, cs.created_at DESC
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
 * 获取会话消息列表
 * GET /api/student/chat/sessions/:sessionId
 */
const getSessionMessages = async (req, res, next) => {
  try {
    const { sessionId } = req.params
    const studentId = req.user.id

    // 查询会话
    const [sessionRows] = await pool.query(
      `SELECT session_id, course_id, student_id, title, message_count
       FROM chat_session
       WHERE session_id = ? AND is_deleted = 0`,
      [sessionId]
    )
    if (sessionRows.length === 0) {
      return res.status(404).json({ code: 404, message: '会话不存在' })
    }

    const session = sessionRows[0]

    // 权限校验
    if (session.student_id !== studentId) {
      return res.status(403).json({ code: 403, message: '无权查看该会话' })
    }

    // 查询消息
    const [messages] = await pool.query(
      `SELECT
        role, content, metadata, token_count AS tokenCount,
        rating, created_at AS createdAt
      FROM chat_record
      WHERE session_id = ?
      ORDER BY created_at ASC`,
      [sessionId]
    )

    // 解析 metadata JSON
    const parsedMessages = messages.map(m => ({
      ...m,
      metadata: m.metadata ? (typeof m.metadata === 'string' ? JSON.parse(m.metadata) : m.metadata) : null
    }))

    res.json({
      code: 200,
      data: {
        sessionId: session.session_id,
        title: session.title,
        courseId: session.course_id,
        messages: parsedMessages
      }
    })
  } catch (err) {
    next(err)
  }
}

/**
 * 删除会话（软删除）
 * DELETE /api/student/chat/sessions/:sessionId
 */
const deleteSession = async (req, res, next) => {
  try {
    const { sessionId } = req.params
    const studentId = req.user.id

    const [sessionRows] = await pool.query(
      'SELECT id, student_id FROM chat_session WHERE session_id = ? AND is_deleted = 0',
      [sessionId]
    )
    if (sessionRows.length === 0) {
      return res.status(404).json({ code: 404, message: '会话不存在' })
    }

    if (sessionRows[0].student_id !== studentId) {
      return res.status(403).json({ code: 403, message: '无权删除该会话' })
    }

    await pool.query(
      'UPDATE chat_session SET is_deleted = 1 WHERE session_id = ?',
      [sessionId]
    )

    res.json({ code: 200, message: '删除成功' })
  } catch (err) {
    next(err)
  }
}

/**
 * 独立聊天接口（非 JWT 模式）
 * POST /api/chat
 * 接收 student_id + course_id + message
 * 用于后端数据闭环，不依赖前端 JWT
 */
const standaloneChat = async (req, res, next) => {
  const connection = await pool.getConnection()
  try {
    const { student_id, course_id, message } = req.body

    if (!student_id || !course_id || !message) {
      return res.status(400).json({ code: 400, message: 'student_id、course_id 和 message 不能为空' })
    }
    if (message.length > 2000) {
      return res.status(400).json({ code: 400, message: '问题内容不能超过2000字' })
    }

    // 校验选课关系
    const [enrollmentRows] = await connection.query(
      `SELECT ce.id FROM course_enrollment ce
       JOIN course c ON ce.course_id = c.id
       WHERE ce.course_id = ? AND ce.student_id = ? AND ce.is_active = 1 AND c.is_deleted = 0`,
      [course_id, student_id]
    )
    if (enrollmentRows.length === 0) {
      return res.status(403).json({ code: 403, message: '学生未选课' })
    }

    // 查询 AI 助教绑定（可选）
    const [assistantRows] = await connection.query(
      'SELECT coze_bot_id, is_active FROM ai_assistant_bind WHERE course_id = ?',
      [course_id]
    )
    const botId = (assistantRows.length > 0 && assistantRows[0].is_active)
      ? assistantRows[0].coze_bot_id
      : null

    await connection.beginTransaction()

    const sessionId = uuidv4()

    // 创建会话
    await connection.query(
      `INSERT INTO chat_session (session_id, course_id, student_id, title, message_count)
       VALUES (?, ?, ?, ?, 0)`,
      [sessionId, course_id, student_id, generateTitle(message)]
    )

    // 保存学生消息到 chat_record
    await connection.query(
      `INSERT INTO chat_record (session_id, course_id, student_id, role, content, token_count)
       VALUES (?, ?, ?, 'user', ?, 0)`,
      [sessionId, course_id, student_id, message]
    )

    // 2. 调用 Coze Chat API（仅当 botId 存在时）
    let aiAnswer, tokenCount
    if (botId) {
      try {
        const result = await cozeService.sendMessageToCoze({
          agent_id: botId,
          user_id: student_id,
          message: message,
          history: []
        })
        aiAnswer = result.answer
        tokenCount = result.tokenCount
      } catch (cozeErr) {
        aiAnswer = 'AI服务暂不可用，请稍后重试。'
        tokenCount = 0
        console.warn(`[Chat/Standalone] Coze API 调用失败：${cozeErr.message}`)
      }
    } else {
      aiAnswer = 'AI助教暂未配置，请联系教师绑定Coze AI服务。'
      tokenCount = 0
    }

    // 4. 保存 AI 回复到 chat_record
    await connection.query(
      `INSERT INTO chat_record
       (session_id, course_id, student_id, role, content, token_count)
       VALUES (?, ?, ?, 'assistant', ?, ?)`,
      [sessionId, course_id, student_id, aiAnswer, tokenCount]
    )

    // 更新会话信息
    await connection.query(
      'UPDATE chat_session SET message_count = 2, updated_at = NOW() WHERE session_id = ?',
      [sessionId]
    )

    await connection.commit()

    // 5. 返回给前端
    res.json({
      code: 200,
      data: {
        sessionId,
        answer: aiAnswer,
        tokenConsumed: tokenCount,
        createdAt: new Date().toISOString()
      }
    })
  } catch (err) {
    await connection.rollback()
    next(err)
  } finally {
    connection.release()
  }
}

module.exports = { sendMessage, standaloneChat, getSessions, getSessionMessages, deleteSession }
