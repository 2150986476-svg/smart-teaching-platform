const pool = require('../config/db')

/**
 * 错题本 - 学生查看自己的错题列表
 * GET /api/student/wrong-questions?courseId=1&page=1&pageSize=20
 */
const getWrongQuestions = async (req, res, next) => {
  try {
    const studentId = req.user.id
    const { courseId, page = 1, pageSize = 20 } = req.query
    const offset = (parseInt(page) - 1) * parseInt(pageSize)
    const limit = Math.min(parseInt(pageSize), 50)

    let whereClause = 'WHERE wq.student_id = ? AND wq.mastered = 0'
    const params = [studentId]

    if (courseId) {
      whereClause += ' AND wq.course_id = ?'
      params.push(parseInt(courseId))
    }

    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM wrong_question_book wq ${whereClause}`,
      params
    )
    const total = countResult[0].total

    const [records] = await pool.query(
      `SELECT
        wq.id, wq.course_id AS courseId, c.name AS courseName,
        wq.question_content AS questionContent,
        wq.correct_answer AS correctAnswer,
        wq.student_answer AS studentAnswer,
        wq.difficulty, wq.knowledge_points AS knowledgePoints,
        wq.wrong_count AS wrongCount,
        wq.last_wrong_at AS lastWrongAt,
        wq.mastered, wq.created_at AS createdAt
      FROM wrong_question_book wq
      LEFT JOIN course c ON wq.course_id = c.id
      ${whereClause}
      ORDER BY wq.last_wrong_at DESC
      LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    )

    const parsed = records.map(r => ({
      ...r,
      questionContent: typeof r.questionContent === 'string'
        ? JSON.parse(r.questionContent) : r.questionContent,
      knowledgePoints: r.knowledgePoints
        ? (typeof r.knowledgePoints === 'string' ? JSON.parse(r.knowledgePoints) : r.knowledgePoints)
        : []
    }))

    res.json({
      code: 200,
      data: { records: parsed, total, page: parseInt(page), pageSize: parseInt(pageSize) }
    })
  } catch (err) {
    next(err)
  }
}

/**
 * 标记错题已掌握
 * POST /api/student/wrong-questions/:id/master
 */
const markMastered = async (req, res, next) => {
  try {
    const { id } = req.params
    const studentId = req.user.id

    const [rows] = await pool.query('SELECT id FROM wrong_question_book WHERE id = ? AND student_id = ?', [id, studentId])
    if (rows.length === 0) {
      return res.status(404).json({ code: 404, message: '错题记录不存在' })
    }

    await pool.query(
      'UPDATE wrong_question_book SET mastered = 1, mastered_at = NOW() WHERE id = ?',
      [id]
    )

    res.json({ code: 200, message: '已标记为掌握' })
  } catch (err) {
    next(err)
  }
}

/**
 * 从错题本生成练习题
 * POST /api/student/wrong-questions/practice
 * Body: { courseId, count }
 */
const practiceWrongQuestions = async (req, res, next) => {
  try {
    const studentId = req.user.id
    const { courseId, count = 10 } = req.body

    if (!courseId) {
      return res.status(400).json({ code: 400, message: '课程ID不能为空' })
    }

    const [rows] = await pool.query(
      `SELECT question_content AS questionContent,
              correct_answer AS correctAnswer,
              difficulty, knowledge_points AS knowledgePoints
       FROM wrong_question_book
       WHERE student_id = ? AND course_id = ? AND mastered = 0
       ORDER BY RAND()
       LIMIT ?`,
      [studentId, courseId, Math.min(parseInt(count), 20)]
    )

    if (rows.length === 0) {
      return res.json({ code: 200, data: { questions: [], message: '没有未掌握的错题' } })
    }

    const questions = rows.map((r, i) => ({
      index: i + 1,
      stem: (typeof r.questionContent === 'string' ? JSON.parse(r.questionContent) : r.questionContent)?.stem || '',
      options: (typeof r.questionContent === 'string' ? JSON.parse(r.questionContent) : r.questionContent)?.options || {},
      correctAnswer: r.correctAnswer,
      difficulty: r.difficulty,
      knowledgePoints: r.knowledgePoints
        ? (typeof r.knowledgePoints === 'string' ? JSON.parse(r.knowledgePoints) : r.knowledgePoints)
        : []
    }))

    res.json({ code: 200, data: { questions, count: questions.length } })
  } catch (err) {
    next(err)
  }
}

module.exports = { getWrongQuestions, markMastered, practiceWrongQuestions }
