const pool = require('../config/db')
const { v4: uuidv4 } = require('uuid')
const cozeWorkflowService = require('../services/cozeWorkflowService')

// ============================================================
// JSON 题目库 — 后续可替换为 AI 生成
// ============================================================
const QUESTION_BANK = {
  easy: [
    {
      stem: '以下哪个是监督学习的典型算法？',
      options: { A: 'K-Means', B: '线性回归', C: 'PCA', D: 'Apriori' },
      correctAnswer: 'B',
      explanation: '线性回归是一种监督学习算法，通过已知输入输出数据学习映射关系。K-Means 和 PCA 是无监督学习，Apriori 是关联规则挖掘。',
      knowledgePoints: ['机器学习', '监督学习']
    },
    {
      stem: '在 Python 中，`print(2 ** 3)` 的输出是？',
      options: { A: '5', B: '6', C: '8', D: '9' },
      correctAnswer: 'C',
      explanation: '`**` 是幂运算符，2 ** 3 = 2³ = 8。',
      knowledgePoints: ['Python基础', '运算符']
    },
    {
      stem: '关系型数据库中，主键（Primary Key）的特点不包括？',
      options: { A: '不能为 NULL', B: '值必须唯一', C: '一张表可以有多个主键', D: '可以唯一标识一条记录' },
      correctAnswer: 'C',
      explanation: '一张表只能有一个主键，但主键可以由多个列组成（复合主键）。',
      knowledgePoints: ['数据库', '主键约束']
    },
    {
      stem: 'HTTP 状态码 404 表示什么？',
      options: { A: '服务器错误', B: '未授权', C: '资源未找到', D: '请求超时' },
      correctAnswer: 'C',
      explanation: '404 Not Found 表示服务器无法找到请求的资源。500 是服务器错误，401 是未授权，408 是请求超时。',
      knowledgePoints: ['HTTP协议', '状态码']
    },
    {
      stem: '以下哪个不是面向对象编程的基本特征？',
      options: { A: '封装', B: '继承', C: '多态', D: '递归' },
      correctAnswer: 'D',
      explanation: '面向对象三大特征：封装、继承、多态。递归是算法思想，不是 OOP 特征。',
      knowledgePoints: ['面向对象', 'OOP']
    }
  ],
  medium: [
    {
      stem: '在二叉搜索树中，删除有两个子节点的节点时，通常用什么节点替代？',
      options: { A: '左子树的最大节点', B: '右子树的最小节点', C: '前序遍历的前驱', D: '任选 A 或 B 均可' },
      correctAnswer: 'D',
      explanation: '删除有两个子节点的节点时，可以用左子树的最大节点（前驱）或右子树的最小节点（后继）来替代，两者都能保持 BST 性质。',
      knowledgePoints: ['数据结构', '二叉搜索树']
    },
    {
      stem: 'MySQL 中，`VARCHAR(100)` 与 `CHAR(100)` 的根本区别是？',
      options: { A: 'VARCHAR 更快', B: 'CHAR 会填充空格到指定长度', C: 'VARCHAR 不支持索引', D: 'CHAR 只能存储数字' },
      correctAnswer: 'B',
      explanation: 'CHAR 固定长度，不足会右补空格；VARCHAR 变长，按实际长度存储。两者都支持索引。',
      knowledgePoints: ['数据库', '字段类型']
    },
    {
      stem: 'TCP 三次握手中，第二次握手发送的报文标志位是？',
      options: { A: 'SYN', B: 'ACK', C: 'SYN+ACK', D: 'FIN+ACK' },
      correctAnswer: 'C',
      explanation: '第一次：客户端 SYN；第二次：服务端 SYN+ACK；第三次：客户端 ACK。',
      knowledgePoints: ['计算机网络', 'TCP协议']
    },
    {
      stem: '以下关于 Promise 的说法，哪个是错误的？',
      options: { A: 'Promise 可以链式调用', B: 'Promise.all 会等待所有 Promise 完成', C: 'Promise 的状态可以从 rejected 变为 fulfilled', D: 'async/await 是 Promise 的语法糖' },
      correctAnswer: 'C',
      explanation: 'Promise 的状态一旦改变就不可逆——从 pending 到 fulfilled 或 rejected 后，不会再变。',
      knowledgePoints: ['JavaScript', '异步编程']
    },
    {
      stem: '深度为 4 的满二叉树最多有多少个节点？',
      options: { A: '7', B: '8', C: '15', D: '16' },
      correctAnswer: 'C',
      explanation: '满二叉树节点数 = 2^(深度) - 1 = 2^4 - 1 = 15。注意：深度从 1 开始算。',
      knowledgePoints: ['数据结构', '二叉树']
    }
  ],
  hard: [
    {
      stem: '在分布式系统中，CAP 定理中的 P 指的是什么？',
      options: { A: '性能 (Performance)', B: '分区容错性 (Partition Tolerance)', C: '持久性 (Persistence)', D: '优先级 (Priority)' },
      correctAnswer: 'B',
      explanation: 'CAP = Consistency（一致性）+ Availability（可用性）+ Partition Tolerance（分区容错性）。P 是网络分区发生时系统仍能正常工作的能力。',
      knowledgePoints: ['分布式系统', 'CAP定理']
    },
    {
      stem: '以下哪种排序算法的时间复杂度在最好情况下是 O(n)？',
      options: { A: '快速排序', B: '归并排序', C: '插入排序', D: '堆排序' },
      correctAnswer: 'C',
      explanation: '插入排序在已有序的情况下只需遍历一次，时间复杂度 O(n)。快排最好 O(nlogn)，归并和堆排序始终 O(nlogn)。',
      knowledgePoints: ['算法', '排序']
    },
    {
      stem: 'React 中，`useMemo` 和 `useCallback` 的主要区别是？',
      options: { A: '没有区别，可以互换', B: 'useMemo 缓存计算结果，useCallback 缓存函数引用', C: 'useMemo 用于类组件', D: 'useCallback 只在 useEffect 中使用' },
      correctAnswer: 'B',
      explanation: 'useMemo 缓存表达式的计算结果，useCallback 缓存回调函数的引用，避免不必要的重新创建。',
      knowledgePoints: ['React', 'Hooks']
    },
    {
      stem: 'Linux 中，`chmod 755 file.txt` 设置的权限含义是？',
      options: { A: 'owner:rw-, group:r--, others:r--', B: 'owner:rwx, group:rx, others:rx', C: 'owner:rwx, group:r--, others:r--', D: 'owner:rwx, group:rw-, others:rw-' },
      correctAnswer: 'B',
      explanation: '755 = rwx(7) + r-x(5) + r-x(5)。owner 可读写执行，group 和 others 可读执行。',
      knowledgePoints: ['Linux', '文件权限']
    },
    {
      stem: 'HTTPS 握手过程中，客户端如何验证服务器的证书？',
      options: { A: '比较证书中的域名与 IP 是否一致', B: '用证书颁发机构（CA）的公钥验证数字签名', C: '直接读取证书中的明文信息', D: '通过 DNS 查询验证' },
      correctAnswer: 'B',
      explanation: '客户端用操作系统/浏览器内置的 CA 根证书中的公钥，验证服务器证书的数字签名，确认证书未被篡改且由可信 CA 签发。',
      knowledgePoints: ['网络安全', 'HTTPS']
    }
  ]
}

/**
 * 生成习题（从 JSON 题库读取，后续可替换为 Coze AI 生成）
 * POST /api/student/quiz/generate
 */
const generateQuiz = async (req, res, next) => {
  const connection = await pool.getConnection()
  try {
    // 输入：course_id + difficulty + question_num（或 count 兼容旧参数）
    const { courseId, course_id, difficulty = 'mixed', question_num, count, student_id } = req.body
    const resolvedCourseId = courseId || course_id
    const questionCount = Math.min(Math.max(parseInt(question_num || count || 10), 5), 20)
    // 优先从 JWT 获取 studentId，其次从请求体（独立接口）
    const studentId = (req.user && req.user.id) || student_id

    if (!resolvedCourseId) {
      return res.status(400).json({ code: 400, message: 'course_id 不能为空' })
    }
    if (!studentId) {
      return res.status(400).json({ code: 400, message: 'student_id 不能为空（JWT 或 body）' })
    }

    // 校验选课关系
    const [enrollmentRows] = await connection.query(
      `SELECT ce.id FROM course_enrollment ce
       JOIN course c ON ce.course_id = c.id
       WHERE ce.course_id = ? AND ce.student_id = ? AND ce.is_active = 1 AND c.is_deleted = 0`,
      [resolvedCourseId, studentId]
    )
    if (enrollmentRows.length === 0) {
      return res.status(403).json({ code: 403, message: '学生未选课' })
    }

    // 查询课程信息 + workflow_id
    const [[courseRow]] = await connection.query(
      `SELECT c.name AS courseName, c.description AS courseDescription,
              aab.workflow_id AS workflowId, aab.coze_bot_id AS cozeBotId
       FROM course c
       LEFT JOIN ai_assistant_bind aab ON c.id = aab.course_id
       WHERE c.id = ? AND c.is_deleted = 0`,
      [resolvedCourseId]
    )
    const courseName = courseRow?.courseName || ''
    const workflowId = courseRow?.workflowId || null

    // 收集课程资料作为 knowledge 上下文
    let knowledge = ''
    try {
      const [files] = await connection.query(
        `SELECT file_name FROM course_file WHERE course_id = ? ORDER BY id`,
        [resolvedCourseId]
      )
      knowledge = files.map(f => f.file_name).join('、') || courseRow?.courseDescription || ''
    } catch {}

    // ============================================================
    // 尝试 Workflow 生成（失败时自动 fallback 到题库）
    // ============================================================
    let questions
    let source = 'bank' // bank | workflow

    if (workflowId) {
      try {
        questions = await cozeWorkflowService.generateQuiz({
          workflowId,
          courseName,
          difficulty,
          questionNum: questionCount,
          knowledge
        })
        source = 'workflow'
      } catch (workflowErr) {
        console.warn(`[Quiz] Workflow 生成失败，降级到题库：${workflowErr.message}`)
        // 继续 fallback
      }
    }

    // Fallback：本地题库
    if (!questions) {
      questions = pickFromBank(difficulty, questionCount)
    }

    // ============================================================
    // 保存到数据库
    // ============================================================
    const batchId = uuidv4()

    await connection.query(
      `INSERT INTO quiz_batch
       (batch_id, course_id, student_id, difficulty, question_count, status)
       VALUES (?, ?, ?, ?, ?, 'generated')`,
      [batchId, resolvedCourseId, studentId, difficulty, questions.length]
    )

    const recordSql = `INSERT INTO quiz_record
      (batch_id, course_id, student_id, question_index, question_content, correct_answer, difficulty, knowledge_points, explanation)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]
      // 知识点可能是字符串（"A、B"）或数组（["A", "B"]）
      let kpArray = null
      if (q.knowledge_point) {
        if (Array.isArray(q.knowledge_point)) {
          kpArray = q.knowledge_point.filter(Boolean)
        } else if (typeof q.knowledge_point === 'string') {
          kpArray = q.knowledge_point.split(/[、,，]/).map(s => s.trim()).filter(Boolean)
        }
      }
      await connection.query(recordSql, [
        batchId, resolvedCourseId, studentId, i + 1,
        JSON.stringify({ stem: q.question, options: q.options }),
        q.answer || '',
        q.difficulty || difficulty,
        kpArray ? JSON.stringify(kpArray) : null,
        q.explanation || null
      ])
    }

    await connection.query(
      'UPDATE quiz_batch SET status = "in_progress" WHERE batch_id = ?',
      [batchId]
    )

    res.json({
      code: 200,
      data: {
        batchId,
        difficulty,
        source,
        questions: questions.map(q => ({
          question: q.question,
          options: Array.isArray(q.options) ? q.options : [],
          answer: q.answer || '',
          difficulty: q.difficulty || difficulty,
          knowledge_point: q.knowledge_point || '',
          explanation: q.explanation || ''
        })),
        createdAt: new Date().toISOString()
      }
    })
  } catch (err) {
    next(err)
  } finally {
    connection.release()
  }
}

/**
 * 提交答案并自动批改
 * POST /api/student/quiz/submit
 */
const submitQuiz = async (req, res, next) => {
  const connection = await pool.getConnection()
  try {
    const { batchId, answers } = req.body
    const studentId = req.user.id

    if (!batchId || !answers || !Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({ code: 400, message: '批次ID和答案列表不能为空' })
    }

    // 校验批次
    const [batchRows] = await connection.query(
      'SELECT * FROM quiz_batch WHERE batch_id = ? AND student_id = ?',
      [batchId, studentId]
    )
    if (batchRows.length === 0) {
      return res.status(404).json({ code: 404, message: '答题批次不存在' })
    }

    const batch = batchRows[0]

    if (batch.status === 'completed') {
      return res.status(422).json({ code: 6001, message: '该批次已提交过答案' })
    }

    // 获取预存的题目记录
    const [recordRows] = await connection.query(
      `SELECT id, question_index, correct_answer, difficulty, knowledge_points, explanation, question_content
       FROM quiz_record WHERE batch_id = ? ORDER BY question_index ASC`,
      [batchId]
    )

    if (recordRows.length !== answers.length) {
      return res.status(400).json({ code: 6002, message: '答案数量与题目数量不匹配' })
    }

    await connection.beginTransaction()

    let correctCount = 0
    let totalTimeSpent = 0
    const results = []

    for (let i = 0; i < recordRows.length; i++) {
      const record = recordRows[i]
      const answer = answers.find(a => a.index === record.question_index)

      if (!answer) {
        await connection.rollback()
        return res.status(400).json({
          code: 6002,
          message: `缺少第 ${record.question_index} 题的答案`
        })
      }

      const studentAnswer = (answer.answer || '').toUpperCase().trim()
      const isCorrect = studentAnswer === record.correct_answer
      if (isCorrect) correctCount++

      const timeSpent = answer.timeSpent || 0
      totalTimeSpent += timeSpent

      // 更新答题记录
      await connection.query(
        `UPDATE quiz_record
         SET student_answer = ?, is_correct = ?, time_spent = ?
         WHERE id = ?`,
        [studentAnswer, isCorrect ? 1 : 0, timeSpent, record.id]
      )

      // 加入错题本（首次错误）
      if (!isCorrect) {
        const [existingWrong] = await connection.query(
          'SELECT id, wrong_count FROM wrong_question_book WHERE student_id = ? AND course_id = ? AND quiz_record_id = ?',
          [studentId, batch.course_id, record.id]
        )
        if (existingWrong.length === 0) {
          await connection.query(
            `INSERT INTO wrong_question_book
             (student_id, course_id, quiz_record_id, question_content, correct_answer, student_answer, difficulty, knowledge_points, wrong_count, last_wrong_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, NOW())`,
            [
              studentId, batch.course_id, record.id,
              record.question_content,
              record.correct_answer, studentAnswer,
              batch.difficulty,
              record.knowledge_points
            ]
          )
        } else {
          await connection.query(
            `UPDATE wrong_question_book
             SET wrong_count = wrong_count + 1, student_answer = ?, last_wrong_at = NOW()
             WHERE id = ?`,
            [studentAnswer, existingWrong[0].id]
          )
        }
      }

      results.push({
        index: record.question_index,
        isCorrect,
        correctAnswer: record.correct_answer,
        explanation: record.explanation,
        knowledgePoints: record.knowledge_points
          ? (typeof record.knowledge_points === 'string'
            ? JSON.parse(record.knowledge_points)
            : record.knowledge_points)
          : []
      })
    }

    const score = recordRows.length > 0
      ? parseFloat(((correctCount / recordRows.length) * 100).toFixed(2))
      : 0

    // 更新批次
    await connection.query(
      `UPDATE quiz_batch
       SET correct_count = ?, total_time_spent = ?, score = ?, status = 'completed', completed_at = NOW()
       WHERE batch_id = ?`,
      [correctCount, totalTimeSpent, score, batchId]
    )

    await connection.commit()

    res.json({
      code: 200,
      data: {
        batchId,
        score,
        correctCount,
        totalCount: recordRows.length,
        totalTimeSpent,
        results,
        completedAt: new Date().toISOString()
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
 * 获取历史答题批次列表
 * GET /api/student/quiz/batches
 */
const getQuizBatches = async (req, res, next) => {
  try {
    const studentId = req.user.id
    const { courseId, page = 1, pageSize = 20 } = req.query
    const offset = (parseInt(page) - 1) * parseInt(pageSize)
    const limit = Math.min(parseInt(pageSize), 50)

    let whereClause = 'WHERE qb.student_id = ?'
    const params = [studentId]

    if (courseId) {
      whereClause += ' AND qb.course_id = ?'
      params.push(parseInt(courseId))
    }

    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM quiz_batch qb ${whereClause}`,
      params
    )
    const total = countResult[0].total

    const [records] = await pool.query(
      `SELECT
        qb.batch_id AS batchId,
        qb.course_id AS courseId,
        c.name AS courseName,
        qb.difficulty,
        qb.question_count AS questionCount,
        qb.correct_count AS correctCount,
        qb.total_time_spent AS totalTimeSpent,
        qb.score,
        qb.status,
        qb.created_at AS createdAt,
        qb.completed_at AS completedAt
      FROM quiz_batch qb
      LEFT JOIN course c ON qb.course_id = c.id
      ${whereClause}
      ORDER BY qb.created_at DESC
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
 * 获取某批次答题详情（含每道题结果）
 * GET /api/student/quiz/batches/:batchId
 */
const getQuizBatchDetail = async (req, res, next) => {
  try {
    const { batchId } = req.params
    const studentId = req.user.id

    const [batchRows] = await pool.query(
      `SELECT
        batch_id AS batchId, course_id AS courseId, difficulty, question_count AS questionCount,
        correct_count AS correctCount, total_time_spent AS totalTimeSpent, score, status,
        created_at AS createdAt, completed_at AS completedAt
      FROM quiz_batch WHERE batch_id = ? AND student_id = ?`,
      [batchId, studentId]
    )
    if (batchRows.length === 0) {
      return res.status(404).json({ code: 404, message: '答题批次不存在' })
    }

    const batch = batchRows[0]

    const [records] = await pool.query(
      `SELECT
        question_index AS questionIndex,
        question_content AS questionContent,
        student_answer AS studentAnswer,
        correct_answer AS correctAnswer,
        is_correct AS isCorrect,
        time_spent AS timeSpent,
        difficulty,
        knowledge_points AS knowledgePoints,
        explanation
      FROM quiz_record
      WHERE batch_id = ?
      ORDER BY question_index ASC`,
      [batchId]
    )

    const questions = records.map(r => ({
      ...r,
      questionContent: typeof r.questionContent === 'string'
        ? JSON.parse(r.questionContent) : r.questionContent,
      knowledgePoints: r.knowledgePoints
        ? (typeof r.knowledgePoints === 'string'
          ? JSON.parse(r.knowledgePoints) : r.knowledgePoints)
        : [],
      isCorrect: r.isCorrect === 1
    }))

    res.json({
      code: 200,
      data: { ...batch, questions }
    })
  } catch (err) {
    next(err)
  }
}

// ========== 工具函数 ==========

function pickRandom(arr, n) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, n)
}

function shuffleArray(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * 从本地题库选取题目（Workflow 不可用时的 fallback）
 * 返回格式：[{ question, options, answer, difficulty, knowledge_point, explanation }]
 */
function pickFromBank(difficulty, count) {
  let pool = []

  if (difficulty === 'mixed') {
    const easyNeeded = Math.round(count * 0.3)
    const mediumNeeded = Math.round(count * 0.4)
    const hardNeeded = count - easyNeeded - mediumNeeded

    // 标记每道题的真实难度
    const tagged = (arr, tag) => arr.map(q => ({ ...q, _difficulty: tag }))

    pool = [
      ...tagged(pickRandom(QUESTION_BANK.easy, easyNeeded), 'easy'),
      ...tagged(pickRandom(QUESTION_BANK.medium, mediumNeeded), 'medium'),
      ...tagged(pickRandom(QUESTION_BANK.hard, hardNeeded), 'hard')
    ]
    while (pool.length < count) {
      pool.push(...tagged(pickRandom(QUESTION_BANK.medium, 1), 'medium'))
    }
  } else if (QUESTION_BANK[difficulty]) {
    pool = pickRandom(QUESTION_BANK[difficulty], count).map(q => ({ ...q, _difficulty: difficulty }))
  } else {
    pool = pickRandom(QUESTION_BANK.medium, count).map(q => ({ ...q, _difficulty: 'medium' }))
  }

  pool = shuffleArray(pool).slice(0, count)

  return pool.map(q => ({
    question: q.stem,
    options: q.options ? Object.values(q.options) : [],
    answer: q.correctAnswer,
    difficulty: q._difficulty || difficulty,
    knowledge_point: q.knowledgePoints ? q.knowledgePoints.join('、') : '',
    explanation: q.explanation || null
  }))
}

module.exports = { generateQuiz, submitQuiz, getQuizBatches, getQuizBatchDetail }
