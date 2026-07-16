const pool = require('../config/db')

// ============================================================
// 5维能力评分规则引擎（基于分析 workflow 中的规则）
// ============================================================
function computeScores(stats) {
  const {
    knowledgeMastery,       // [{name,total,correct,rate}]
    difficultyBreakdown,    // {easy:{total,correct}, medium:{total,correct}, hard:{total,correct}}
    correctRate,            // 总正确率
    avgTimePerQuestion,     // 平均每题用时（秒）
    totalQuestions,         // 总答题数
    studyFrequency,         // 学习频率 %
    totalDaysActive,        // 活跃天数
    dataSufficient
  } = stats

  // 数据不足 → 保守评估向50靠拢
  if (!dataSufficient) {
    const base = correctRate > 0 ? correctRate * 0.5 + 25 : 50
    const fq = studyFrequency > 0 ? Math.min(studyFrequency, 100) : 50
    return {
      knowledge_breadth:   round(base),
      depth:               round(base * 0.8),
      application:         round(base * 0.7),
      analysis:            round(base * 0.7),
      continuous_learning: round(fq)
    }
  }

  // 知识广度：覆盖>60%的知识点且有正确率≥50%的知识点比例
  const kpCount = knowledgeMastery.length
  let breadth
  if (kpCount > 0) {
    const masteredCount = knowledgeMastery.filter(k => k.rate >= 50).length
    breadth = Math.min((masteredCount / kpCount) * 100, 95)
  } else {
    breadth = 50
  }

  // 理解深度：中等+困难题加权正确率
  const mTotal = difficultyBreakdown.medium?.total || 0
  const mCorrect = difficultyBreakdown.medium?.correct || 0
  const hTotal = difficultyBreakdown.hard?.total || 0
  const hCorrect = difficultyBreakdown.hard?.correct || 0
  let depth
  if (mTotal + hTotal > 0) {
    depth = ((mCorrect + hCorrect) / (mTotal + hTotal)) * 100
  } else {
    depth = correctRate
  }

  // 应用能力：基于整体正确率（保守估算）
  const application = Math.min(correctRate * 0.85 + 10, 90)

  // 问题分析：困难题正确率 + 用时奖励
  let analysis
  if (hTotal > 0) {
    const hardRate = (hCorrect / hTotal) * 100
    const timeBonus = avgTimePerQuestion > 30 ? 10 : 5
    analysis = Math.min(hardRate * 0.75 + timeBonus, 95)
  } else {
    analysis = Math.min(correctRate * 0.7 + 10, 85)
  }

  // 持续学习：基于学习频率
  const continuous = Math.min(studyFrequency || 50, 100)

  return {
    knowledge_breadth:   round(breadth),
    depth:               round(depth),
    application:         round(application),
    analysis:            round(analysis),
    continuous_learning: round(continuous)
  }
}

function round(v) { return parseFloat(v.toFixed(2)) }

function getLevel(score) {
  if (score >= 90) return '优秀'
  if (score >= 75) return '良好'
  if (score >= 60) return '中等'
  if (score >= 40) return '待提高'
  return '需关注'
}

/**
 * 获取学生能力分析（学生自查看）
 * GET /api/student/analysis?courseId=1
 */
const getStudentAnalysis = async (req, res, next) => {
  try {
    const studentId = req.user.id
    const { courseId } = req.query

    if (!courseId) {
      return res.status(400).json({ code: 400, message: '课程ID不能为空' })
    }

    // 校验选课
    const [enr] = await pool.query(
      `SELECT ce.id FROM course_enrollment ce
       JOIN course c ON ce.course_id = c.id
       WHERE ce.course_id = ? AND ce.student_id = ? AND ce.is_active = 1 AND c.is_deleted = 0`,
      [courseId, studentId]
    )
    if (enr.length === 0) {
      return res.status(403).json({ code: 403, message: '学生未选课' })
    }

    // 委托给核心分析函数
    await getStudentAnalysisCore(req, res, next)
  } catch (err) {
    next(err)
  }
}

/**
 * 教师/管理员查看指定学生的能力分析
 * GET /api/teacher/student-analysis?courseId=1&studentId=10
 */
const getStudentAnalysisForTeacher = async (req, res, next) => {
  try {
    const { courseId, studentId } = req.query

    if (!courseId || !studentId) {
      return res.status(400).json({ code: 400, message: '课程ID和学生ID不能为空' })
    }

    // 校验课程权限
    const [courseRows] = await pool.query(
      'SELECT id, teacher_id FROM course WHERE id = ? AND is_deleted = 0',
      [courseId]
    )
    if (courseRows.length === 0) {
      return res.status(404).json({ code: 2001, message: '课程不存在' })
    }
    if (req.user.role === 'teacher' && courseRows[0].teacher_id !== req.user.id) {
      return res.status(403).json({ code: 403, message: '无权查看此课程的学生数据' })
    }

    // 校验学生已选课
    const [enr] = await pool.query(
      `SELECT ce.id FROM course_enrollment ce
       WHERE ce.course_id = ? AND ce.student_id = ? AND ce.is_active = 1`,
      [courseId, studentId]
    )
    if (enr.length === 0) {
      return res.status(404).json({ code: 404, message: '该学生未选修此课程' })
    }

    // 委托给核心分析函数
    req.user.id = parseInt(studentId)
    await getStudentAnalysisCore(req, res, next)
  } catch (err) {
    next(err)
  }
}

/**
 * 核心分析计算（供学生自查看和教师查看复用）
 */
async function getStudentAnalysisCore(req, res, next) {
  try {
    const studentId = req.user.id
    const { courseId } = req.query

    // === 聚合答题数据 === (same as getStudentAnalysis)
    const [quizStats] = await pool.query(
      `SELECT
        COUNT(*) AS totalRecords,
        SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) AS correctCount,
        COUNT(DISTINCT batch_id) AS totalBatches
       FROM quiz_record
       WHERE course_id = ? AND student_id = ? AND is_correct IS NOT NULL`,
      [courseId, studentId]
    )

    const [difficultyStats] = await pool.query(
      `SELECT
        difficulty,
        COUNT(*) AS total,
        SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) AS correct
       FROM quiz_record
       WHERE course_id = ? AND student_id = ? AND is_correct IS NOT NULL AND difficulty IS NOT NULL
       GROUP BY difficulty`,
      [courseId, studentId]
    )

    const [kpRows] = await pool.query(
      `SELECT
        knowledge_points AS knowledgePoints
       FROM quiz_record
       WHERE course_id = ? AND student_id = ? AND is_correct IS NOT NULL AND knowledge_points IS NOT NULL`,
      [courseId, studentId]
    )

    const [timeStats] = await pool.query(
      `SELECT AVG(time_spent) AS avgTime, COUNT(*) AS cnt
       FROM quiz_record
       WHERE course_id = ? AND student_id = ? AND time_spent IS NOT NULL AND time_spent > 0`,
      [courseId, studentId]
    )

    const [timeDist] = await pool.query(
      `SELECT
        SUM(CASE WHEN time_spent <= 30 THEN 1 ELSE 0 END) AS under30s,
        SUM(CASE WHEN time_spent > 30 AND time_spent <= 60 THEN 1 ELSE 0 END) AS from30to60,
        SUM(CASE WHEN time_spent > 60 THEN 1 ELSE 0 END) AS over60s
       FROM quiz_record
       WHERE course_id = ? AND student_id = ? AND time_spent IS NOT NULL AND time_spent > 0`,
      [courseId, studentId]
    )

    const [chatStats] = await pool.query(
      `SELECT
        COUNT(DISTINCT session_id) AS totalSessions,
        COUNT(*) AS totalMessages,
        COUNT(DISTINCT DATE(created_at)) AS totalDaysActive,
        MIN(DATE(created_at)) AS firstDate,
        MAX(DATE(created_at)) AS lastDate
       FROM chat_record
       WHERE course_id = ? AND student_id = ?`,
      [courseId, studentId]
    )

    const quizTotal = quizStats[0].totalRecords || 0
    const quizCorrect = quizStats[0].correctCount || 0
    const totalBatches = quizStats[0].totalBatches || 0
    const correctRate = quizTotal > 0 ? round((quizCorrect / quizTotal) * 100) : 0

    const db = { easy: {}, medium: {}, hard: {} }
    difficultyStats.forEach(r => {
      if (db[r.difficulty]) db[r.difficulty] = { total: r.total, correct: r.correct }
    })

    const kpMap = {}
    kpRows.forEach(r => {
      let points = r.knowledgePoints
      if (typeof points === 'string') {
        try { points = JSON.parse(points) } catch { points = [] }
      }
      if (!Array.isArray(points)) return
      points.forEach(kp => {
        if (!kpMap[kp]) kpMap[kp] = { name: kp, total: 0, correct: 0 }
        kpMap[kp].total++
      })
    })
    if (Object.keys(kpMap).length > 0) {
      const [kpMarked] = await pool.query(
        `SELECT knowledge_points AS kp, is_correct AS correct
         FROM quiz_record
         WHERE course_id = ? AND student_id = ? AND is_correct IS NOT NULL AND knowledge_points IS NOT NULL`,
        [courseId, studentId]
      )
      kpMarked.forEach(r => {
        let points = r.kp
        if (typeof points === 'string') {
          try { points = JSON.parse(points) } catch { points = [] }
        }
        if (!Array.isArray(points)) return
        points.forEach(kp => {
          if (kpMap[kp]) {
            if (r.correct === 1) kpMap[kp].correct++
          }
        })
      })
    }
    const knowledgeMastery = Object.values(kpMap).map(k => ({
      name: k.name,
      total: k.total,
      correct: k.correct,
      rate: k.total > 0 ? round((k.correct / k.total) * 100) : 0
    })).sort((a, b) => b.total - a.total)

    const avgTime = timeStats[0].avgTime ? Math.round(timeStats[0].avgTime) : 0
    const td = timeDist[0] || {}
    const timeDistribution = {
      under30s: td.under30s || 0,
      from30to60: td.from30to60 || 0,
      over60s: td.over60s || 0
    }

    const cs = chatStats[0] || {}
    const totalSessions = cs.totalSessions || 0
    const totalMessages = cs.totalMessages || 0
    const totalDaysActive = cs.totalDaysActive || 0
    const firstDate = cs.firstDate
    const lastDate = cs.lastDate
    const avgMsgPerSession = totalSessions > 0 ? round(totalMessages / totalSessions) : 0

    let studySpanDays = 0
    let studyFrequency = 0
    if (firstDate && lastDate) {
      const msDiff = new Date(lastDate) - new Date(firstDate)
      studySpanDays = Math.ceil(msDiff / (1000 * 60 * 60 * 24)) + 1
      studyFrequency = studySpanDays > 0 ? round((totalDaysActive / studySpanDays) * 100) : 0
    }

    const dataSufficient = quizTotal >= 5 || totalMessages >= 10

    const scores = computeScores({
      knowledgeMastery,
      difficultyBreakdown: db,
      correctRate,
      avgTimePerQuestion: avgTime,
      totalQuestions: quizTotal,
      studyFrequency,
      totalDaysActive,
      dataSufficient
    })

    const overallScore = round(
      scores.knowledge_breadth * 0.20 +
      scores.depth * 0.25 +
      scores.application * 0.20 +
      scores.analysis * 0.20 +
      scores.continuous_learning * 0.15
    )

    const overallLevel = getLevel(overallScore)
    const strengths = knowledgeMastery.filter(k => k.rate >= 80 && k.total >= 3).map(k => k.name)
    const weaknesses = knowledgeMastery.filter(k => k.rate < 60 && k.total >= 2).map(k => k.name)

    const dimensions = [
      { code: 'knowledge_breadth',  name: '知识广度',     score: scores.knowledge_breadth,  maxScore: 100 },
      { code: 'depth',              name: '理解深度',     score: scores.depth,              maxScore: 100 },
      { code: 'application',        name: '应用能力',     score: scores.application,        maxScore: 100 },
      { code: 'analysis',           name: '问题分析',     score: scores.analysis,           maxScore: 100 },
      { code: 'continuous_learning',name: '持续学习',     score: scores.continuous_learning,maxScore: 100 }
    ]

    const [classAvg] = await pool.query(
      `SELECT
        SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) AS totalCorrect,
        COUNT(*) AS totalQuestions
       FROM quiz_record qr
       JOIN course_enrollment ce ON qr.student_id = ce.student_id AND qr.course_id = ce.course_id
       WHERE qr.course_id = ? AND ce.is_active = 1 AND qr.is_correct IS NOT NULL
       GROUP BY qr.course_id`,
      [courseId]
    )

    const classCorrectRate = classAvg.length > 0
      ? round((classAvg[0].totalCorrect / classAvg[0].totalQuestions) * 100) : null

    const [chatTrend] = await pool.query(
      `SELECT
        DATE(created_at) AS date,
        COUNT(*) AS chatCount
       FROM chat_record
       WHERE course_id = ? AND student_id = ? AND created_at >= DATE_SUB(CURDATE(), INTERVAL 14 DAY)
       GROUP BY DATE(created_at)
       ORDER BY date ASC`,
      [courseId, studentId]
    )

    const [quizTrend] = await pool.query(
      `SELECT
        DATE(created_at) AS date,
        COUNT(*) AS quizCount
       FROM quiz_record
       WHERE course_id = ? AND student_id = ? AND created_at >= DATE_SUB(CURDATE(), INTERVAL 14 DAY)
       GROUP BY DATE(created_at)
       ORDER BY date ASC`,
      [courseId, studentId]
    )

    const trendMap = {}
    const today = new Date()
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const key = d.toISOString().split('T')[0]
      trendMap[key] = { date: key, chatCount: 0, quizCount: 0 }
    }
    chatTrend.forEach(r => {
      const key = new Date(r.date).toISOString().split('T')[0]
      if (trendMap[key]) trendMap[key].chatCount = r.chatCount
    })
    quizTrend.forEach(r => {
      const key = new Date(r.date).toISOString().split('T')[0]
      if (trendMap[key]) trendMap[key].quizCount = r.quizCount
    })
    const activityTrend = Object.values(trendMap)

    const assessDate = new Date().toISOString().split('T')[0]
    const dimCodes = ['knowledge_breadth', 'depth', 'application', 'analysis', 'continuous_learning']
    const dimScores = {
      knowledge_breadth: scores.knowledge_breadth,
      depth: scores.depth,
      application: scores.application,
      analysis: scores.analysis,
      continuous_learning: scores.continuous_learning
    }

    for (const code of dimCodes) {
      await pool.query(
        `INSERT INTO ability_assessment
         (student_id, course_id, dimension_code, score, assess_date, source)
         VALUES (?, ?, ?, ?, ?, 'auto')
         ON DUPLICATE KEY UPDATE score = VALUES(score), source = 'auto'`,
        [studentId, courseId, code, dimScores[code], assessDate]
      )
    }

    res.json({
      code: 200,
      data: {
        courseId: parseInt(courseId),
        studentId,
        assessDate,
        dataSufficient,
        overview: {
          totalQuizzes: totalBatches,
          totalQuestions: quizTotal,
          correctCount: quizCorrect,
          correctRate,
          totalChatSessions: totalSessions,
          totalMessages,
          totalDaysActive,
          avgTimePerQuestion: avgTime,
          studyFrequency
        },
        dimensions,
        classAvgCorrectRate: classCorrectRate,
        overallScore,
        overallLevel,
        knowledgeMastery,
        strengths,
        weaknesses,
        activityTrend
      }
    })
  } catch (err) {
    next(err)
  }
}

module.exports = { getStudentAnalysis, getStudentAnalysisForTeacher }
