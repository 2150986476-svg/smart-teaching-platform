const pool = require('../config/db')
const cozeKnowledge = require('../services/cozeKnowledge.service')

/**
 * 同步课程资料到 Coze 知识库
 * POST /api/courses/:courseId/knowledge/sync
 *
 * 执行流程：
 *   1. 读取课程所有资料文件
 *   2. 检查/创建 Coze 知识库
 *   3. 逐文件上传并添加到知识库
 *   4. 更新同步状态和时间
 */
const syncKnowledge = async (req, res, next) => {
  const { courseId } = req.params
  const teacherId = req.user.id
  const connection = await pool.getConnection()
  const syncLog = { total: 0, success: 0, failed: 0, errors: [] }

  try {
    // ====== 1. 校验课程归属 ======
    const [courseRows] = await connection.query(
      'SELECT id, name, teacher_id FROM course WHERE id = ? AND is_deleted = 0',
      [courseId]
    )
    if (courseRows.length === 0) {
      return res.status(404).json({ code: 404, message: '课程不存在' })
    }
    if (courseRows[0].teacher_id !== teacherId) {
      return res.status(403).json({ code: 403, message: '无权操作该课程' })
    }
    const courseName = courseRows[0].name

    // ====== 2. 读取课程所有资料 ======
    const [fileRecords] = await connection.query(
      `SELECT id, file_name, file_path, file_type, file_size
       FROM course_file
       WHERE course_id = ?
       ORDER BY id ASC`,
      [courseId]
    )
    syncLog.total = fileRecords.length

    if (fileRecords.length === 0) {
      return res.status(400).json({
        code: 400,
        message: '该课程暂无资料文件，请先上传教学资料后再同步'
      })
    }

    // ====== 3. 检查/创建 Coze 知识库 ======
    let [kbRows] = await connection.query(
      `SELECT id, knowledge_id, coze_dataset_id, status
       FROM coze_knowledge_base
       WHERE course_id = ?`,
      [courseId]
    )

    let knowledgeId = null

    if (kbRows.length === 0) {
      // 新建知识库绑定记录
      const createRes = await cozeKnowledge.createKnowledge(`${courseName}知识库`)
      knowledgeId = createRes.knowledgeId
      await connection.query(
        `INSERT INTO coze_knowledge_base
           (course_id, coze_dataset_id, coze_dataset_name, knowledge_id, status, sync_status)
         VALUES (?, ?, ?, ?, 'ready', 'syncing')`,
        [courseId, knowledgeId, `${courseName}知识库`, knowledgeId]
      )
    } else {
      // 已存在，检查状态
      knowledgeId = kbRows[0].knowledge_id || kbRows[0].coze_dataset_id
      if (!knowledgeId) {
        return res.status(400).json({
          code: 400,
          message: '知识库记录存在但 knowledge_id 为空，请先完成知识库初始化'
        })
      }
      // 更新状态为同步中
      await connection.query(
        `UPDATE coze_knowledge_base
         SET sync_status = 'syncing', status = 'syncing'
         WHERE course_id = ?`,
        [courseId]
      )
    }

    // ====== 4. 逐文件上传并添加到知识库 ======
    for (const file of fileRecords) {
      try {
        // 4a. 上传文件到 Coze
        const { fileId } = await cozeKnowledge.uploadFile(file.file_path, file.file_name)

        // 4b. 添加文档到知识库
        await cozeKnowledge.addDocument(knowledgeId, fileId, file.file_name)

        syncLog.success++
      } catch (fileErr) {
        syncLog.failed++
        syncLog.errors.push({
          fileName: file.file_name,
          error: fileErr.message
        })
      }
    }

    // ====== 5. 更新同步状态 ======
    const now = new Date()
    const finalStatus = syncLog.failed === 0 ? 'success' : 'success' // 部分失败也算成功，有错误详情
    await connection.query(
      `UPDATE coze_knowledge_base
       SET last_sync_time = ?, sync_status = ?, status = 'ready'
       WHERE course_id = ?`,
      [now, finalStatus, courseId]
    )

    // ====== 6. 返回同步结果 ======
    res.json({
      code: 200,
      data: {
        ...syncLog,
        knowledgeId,
        syncTime: now.toISOString()
      },
      message: syncLog.failed === 0
        ? `同步完成，共 ${syncLog.total} 个文件全部成功`
        : `同步完成，成功 ${syncLog.success}/${syncLog.total}，失败 ${syncLog.failed} 个`
    })
  } catch (err) {
    // 出错时更新状态
    try {
      await connection.query(
        `UPDATE coze_knowledge_base
         SET sync_status = 'failed', status = 'failed'
         WHERE course_id = ?`,
        [courseId]
      )
    } catch {}

    if (err.message?.includes('COZE_API_TOKEN') || err.name === 'CozeApiError') {
      return res.status(502).json({ code: 502, message: err.message })
    }
    next(err)
  } finally {
    connection.release()
  }
}

/**
 * 获取课程知识库同步状态
 * GET /api/courses/:courseId/knowledge/status
 */
const getKnowledgeStatus = async (req, res, next) => {
  try {
    const { courseId } = req.params
    const teacherId = req.user.id

    const [courseRows] = await pool.query(
      'SELECT id, teacher_id FROM course WHERE id = ? AND is_deleted = 0',
      [courseId]
    )
    if (courseRows.length === 0) {
      return res.status(404).json({ code: 404, message: '课程不存在' })
    }
    if (courseRows[0].teacher_id !== teacherId) {
      return res.status(403).json({ code: 403, message: '无权查看' })
    }

    const [kbRows] = await pool.query(
      `SELECT
         kb.knowledge_id AS knowledgeId,
         kb.coze_dataset_id AS cozeDatasetId,
         kb.coze_dataset_name AS knowledgeName,
         kb.status,
         kb.sync_status AS syncStatus,
         kb.last_sync_time AS lastSyncTime,
         kb.fail_reason AS failReason,
         (SELECT COUNT(*) FROM course_file WHERE course_id = ?) AS fileCount
       FROM coze_knowledge_base kb
       WHERE kb.course_id = ?`,
      [courseId, courseId]
    )

    if (kbRows.length === 0) {
      return res.json({
        code: 200,
        data: { exists: false, fileCount: 0 }
      })
    }

    res.json({
      code: 200,
      data: { exists: true, ...kbRows[0] }
    })
  } catch (err) {
    next(err)
  }
}

module.exports = { syncKnowledge, getKnowledgeStatus }
