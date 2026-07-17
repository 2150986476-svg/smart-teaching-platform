const pool = require('../config/db')

/**
 * 获取学生成就
 * GET /api/student/achievements
 */
const getAchievements = async (req, res, next) => {
  try {
    const studentId = req.user.id

    // 总答题统计
    const [stats] = await pool.query(
      `SELECT
        COUNT(DISTINCT qr.batch_id) AS totalBatches,
        COUNT(qr.id) AS totalQuestions,
        COALESCE(SUM(CASE WHEN qr.is_correct = 1 THEN 1 ELSE 0 END), 0) AS totalCorrect,
        ROUND(COALESCE(AVG(CASE WHEN qr.is_correct = 1 THEN 100 ELSE 0 END), 0), 1) AS avgScore,
        MAX(qr.created_at) AS lastActivity
      FROM quiz_record qr
      WHERE qr.student_id = ?`,
      [studentId]
    )

    // 连续答题天数
    const [days] = await pool.query(
      `SELECT DISTINCT DATE(qr.created_at) AS quizDate
       FROM quiz_record qr
       JOIN quiz_batch qb ON qr.batch_id = qb.batch_id
       WHERE qr.student_id = ? AND qb.status = 'completed'
       ORDER BY quizDate DESC`,
      [studentId]
    )

    let currentStreak = 0
    let longestStreak = 0
    let tempStreak = 0

    if (days.length > 0) {
      const today = new Date().toISOString().slice(0, 10)
      const dateSet = new Set(days.map(d => d.quizDate))
      let checkDate = new Date(today)

      // Current streak (checking backwards from today)
      while (dateSet.has(checkDate.toISOString().slice(0, 10))) {
        currentStreak++
        checkDate.setDate(checkDate.getDate() - 1)
      }

      // Longest streak
      const sortedDates = days.map(d => d.quizDate).sort()
      tempStreak = 1
      for (let i = 1; i < sortedDates.length; i++) {
        const prev = new Date(sortedDates[i - 1])
        const curr = new Date(sortedDates[i])
        const diff = (curr - prev) / (1000 * 60 * 60 * 24)
        if (diff === 1) {
          tempStreak++
        } else {
          longestStreak = Math.max(longestStreak, tempStreak)
          tempStreak = 1
        }
      }
      longestStreak = Math.max(longestStreak, tempStreak)
    }

    // Badge生成
    const badges = []
    const totalQuestions = stats[0].totalQuestions || 0
    const totalBatches = stats[0].totalBatches || 0
    const avgScore = stats[0].avgScore || 0

    if (totalQuestions >= 500) badges.push({ name: '题海无涯', icon: '🌊', desc: '累计答题500道' })
    else if (totalQuestions >= 200) badges.push({ name: '勤学苦练', icon: '📚', desc: '累计答题200道' })
    else if (totalQuestions >= 50) badges.push({ name: '初露锋芒', icon: '🌟', desc: '累计答题50道' })

    if (totalBatches >= 50) badges.push({ name: '持之以恒', icon: '🔥', desc: '完成50次练习' })
    else if (totalBatches >= 10) badges.push({ name: '学习达人', icon: '💪', desc: '完成10次练习' })

    if (avgScore >= 90) badges.push({ name: '学霸', icon: '🏅', desc: '平均正确率90%以上' })
    else if (avgScore >= 75) badges.push({ name: '优秀', icon: '🥇', desc: '平均正确率75%以上' })

    if (longestStreak >= 7) badges.push({ name: '周满贯', icon: '📅', desc: '连续7天答题' })
    else if (longestStreak >= 3) badges.push({ name: '三日坚持', icon: '🎯', desc: '连续3天答题' })

    if (currentStreak >= 7) badges.push({ name: '今日之星', icon: '✨', desc: '连续7天打卡中' })

    res.json({
      code: 200,
      data: {
        totalQuestions,
        totalBatches,
        totalCorrect: stats[0].totalCorrect || 0,
        avgScore,
        currentStreak,
        longestStreak,
        lastActivity: stats[0].lastActivity,
        badges
      }
    })
  } catch (err) {
    next(err)
  }
}

module.exports = { getAchievements }
