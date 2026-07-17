const pool = require('../config/db')

/**
 * 学生查看课程排行榜
 * GET /api/student/leaderboard?courseId=1
 */
const getLeaderboard = async (req, res, next) => {
  try {
    const { courseId } = req.query
    if (!courseId) {
      return res.status(400).json({ code: 400, message: '课程ID不能为空' })
    }

    const [rows] = await pool.query(
      `SELECT
        u.id AS studentId, u.real_name AS studentName,
        u.class_name AS className,
        COALESCE(SUM(CASE WHEN qr.is_correct = 1 THEN 1 ELSE 0 END), 0) AS correctCount,
        COUNT(qr.id) AS totalQuestions,
        ROUND(COALESCE(AVG(CASE WHEN qr.is_correct = 1 THEN 100 ELSE 0 END), 0), 1) AS avgScore,
        COUNT(DISTINCT qr.batch_id) AS quizCount
      FROM course_enrollment ce
      JOIN sys_user u ON ce.student_id = u.id
      LEFT JOIN quiz_record qr ON qr.student_id = u.id AND qr.course_id = ce.course_id
      WHERE ce.course_id = ? AND ce.is_active = 1 AND u.role = 'student'
      GROUP BY u.id, u.real_name, u.class_name
      ORDER BY avgScore DESC, correctCount DESC
      LIMIT 50`,
      [courseId]
    )

    res.json({ code: 200, data: { records: rows } })
  } catch (err) {
    next(err)
  }
}

module.exports = { getLeaderboard }
