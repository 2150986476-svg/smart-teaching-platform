const pool = require('../config/db')

/**
 * 教师查看班级成绩总览
 * GET /api/teacher/analytics?courseId=1
 */
const getClassAnalytics = async (req, res, next) => {
  try {
    const { courseId } = req.query
    const teacherId = req.user.id

    if (!courseId) {
      return res.status(400).json({ code: 400, message: '课程ID不能为空' })
    }

    // 校验课程权限
    const [courseRows] = await pool.query(
      'SELECT id, teacher_id, name FROM course WHERE id = ? AND is_deleted = 0',
      [courseId]
    )
    if (courseRows.length === 0) {
      return res.status(404).json({ code: 2001, message: '课程不存在' })
    }
    if (req.user.role === 'teacher' && courseRows[0].teacher_id !== req.user.id) {
      return res.status(403).json({ code: 403, message: '无权查看此课程数据' })
    }

    // 班级整体统计
    const [classStats] = await pool.query(
      `SELECT
        COUNT(DISTINCT ce.student_id) AS totalStudents,
        COUNT(DISTINCT qr.batch_id) AS totalBatches,
        COUNT(qr.id) AS totalQuestions,
        COALESCE(SUM(CASE WHEN qr.is_correct = 1 THEN 1 ELSE 0 END), 0) AS totalCorrect,
        ROUND(COALESCE(AVG(CASE WHEN qr.is_correct = 1 THEN 100 ELSE 0 END), 0), 1) AS avgScore
      FROM course_enrollment ce
      LEFT JOIN quiz_record qr ON qr.student_id = ce.student_id AND qr.course_id = ce.course_id
      WHERE ce.course_id = ? AND ce.is_active = 1`,
      [courseId]
    )

    // 分数分布
    const [scoreDist] = await pool.query(
      `SELECT
        CASE
          WHEN s.avgScore >= 90 THEN '90-100'
          WHEN s.avgScore >= 75 THEN '75-89'
          WHEN s.avgScore >= 60 THEN '60-74'
          WHEN s.avgScore >= 0  THEN '0-59'
        END AS scoreRange,
        COUNT(*) AS count
      FROM (
        SELECT
          u.id,
          ROUND(COALESCE(AVG(CASE WHEN qr.is_correct = 1 THEN 100 ELSE 0 END), 0), 1) AS avgScore
        FROM course_enrollment ce
        JOIN sys_user u ON ce.student_id = u.id
        LEFT JOIN quiz_record qr ON qr.student_id = u.id AND qr.course_id = ce.course_id
        WHERE ce.course_id = ? AND ce.is_active = 1 AND u.role = 'student'
        GROUP BY u.id
      ) s
      GROUP BY scoreRange
      ORDER BY scoreRange`,
      [courseId]
    )

    // 薄弱知识点（班级错误率高的知识点 Top 10）
    const [weakPoints] = await pool.query(
      `SELECT
        kp,
        COUNT(*) AS wrongCount,
        COUNT(DISTINCT qr.student_id) AS studentCount
      FROM quiz_record qr,
      JSON_TABLE(
        qr.knowledge_points, '$[*]' COLUMNS (kp VARCHAR(100) PATH '$')
      ) AS jt
      WHERE qr.course_id = ? AND qr.is_correct = 0 AND qr.knowledge_points IS NOT NULL
      GROUP BY kp
      ORDER BY wrongCount DESC
      LIMIT 10`,
      [courseId]
    )

    // 学生列表（每人成绩）
    const [students] = await pool.query(
      `SELECT
        u.id AS studentId, u.real_name AS studentName,
        u.class_name AS className,
        COUNT(DISTINCT qr.batch_id) AS quizCount,
        COUNT(qr.id) AS totalQuestions,
        COALESCE(SUM(CASE WHEN qr.is_correct = 1 THEN 1 ELSE 0 END), 0) AS correctCount,
        ROUND(COALESCE(AVG(CASE WHEN qr.is_correct = 1 THEN 100 ELSE 0 END), 0), 1) AS avgScore
      FROM course_enrollment ce
      JOIN sys_user u ON ce.student_id = u.id
      LEFT JOIN quiz_record qr ON qr.student_id = u.id AND qr.course_id = ce.course_id
      WHERE ce.course_id = ? AND ce.is_active = 1 AND u.role = 'student'
      GROUP BY u.id, u.real_name, u.class_name
      ORDER BY avgScore DESC`,
      [courseId]
    )

    res.json({
      code: 200,
      data: {
        courseName: courseRows[0].name,
        overview: classStats[0],
        scoreDistribution: scoreDist,
        weakPoints: weakPoints.map(w => ({
          name: w.kp,
          wrongCount: w.wrongCount,
          studentCount: w.studentCount
        })),
        students
      }
    })
  } catch (err) {
    next(err)
  }
}

module.exports = { getClassAnalytics }
