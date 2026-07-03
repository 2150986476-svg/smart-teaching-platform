const path = require('path')
const fs = require('fs')
const pool = require('../config/db')

// 上传根目录（相对于项目根目录）
const UPLOAD_ROOT = path.resolve(__dirname, '../../uploads')
if (!fs.existsSync(UPLOAD_ROOT)) {
  fs.mkdirSync(UPLOAD_ROOT, { recursive: true })
}

/**
 * 上传课程资料
 * POST /api/courses/:courseId/materials
 */
const uploadMaterial = async (req, res, next) => {
  try {
    const { courseId } = req.params
    const teacherId = req.user.id

    // 校验课程归属
    const [courseRows] = await pool.query(
      'SELECT id, teacher_id FROM course WHERE id = ? AND is_deleted = 0',
      [courseId]
    )
    if (courseRows.length === 0) {
      cleanUploadedFile(req.file)
      return res.status(404).json({ code: 404, message: '课程不存在' })
    }
    if (courseRows[0].teacher_id !== teacherId) {
      cleanUploadedFile(req.file)
      return res.status(403).json({ code: 403, message: '无权上传资料到该课程' })
    }

    const file = req.file
    if (!file) {
      return res.status(400).json({ code: 400, message: '请选择要上传的文件' })
    }

    const ext = path.extname(file.originalname).replace('.', '').toLowerCase()
    const allowedTypes = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'md', 'txt']
    if (!allowedTypes.includes(ext)) {
      cleanUploadedFile(file)
      return res.status(400).json({ code: 400, message: `不支持的文件格式：.${ext}，支持：pdf/doc/docx/ppt/pptx/md/txt` })
    }

    // 类型标准化：doc→docx, ppt→pptx
    let fileType = ext
    if (fileType === 'doc') fileType = 'docx'
    if (fileType === 'ppt') fileType = 'pptx'

    // 获取课程下的文件数作为序号
    const [countResult] = await pool.query(
      'SELECT COUNT(*) as cnt FROM course_file WHERE course_id = ?',
      [courseId]
    )
    const seq = countResult[0].cnt + 1

    // 存储文件名：{courseId}_{seq}_{timestamp}.{ext}
    const timestamp = Date.now()
    const storedName = `${courseId}_${seq}_${timestamp}.${ext}`
    const courseDir = path.join(UPLOAD_ROOT, String(courseId))
    if (!fs.existsSync(courseDir)) {
      fs.mkdirSync(courseDir, { recursive: true })
    }
    const destPath = path.join(courseDir, storedName)

    // 移动 Multer 临时文件 → 目标路径
    fs.renameSync(file.path, destPath)

    // 写入数据库
    const [result] = await pool.query(
      `INSERT INTO course_file (course_id, file_name, file_path, file_size, file_type, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [courseId, file.originalname, destPath, file.size, fileType, teacherId]
    )

    res.json({
      code: 200,
      data: {
        id: result.insertId,
        fileName: file.originalname,
        fileType,
        fileSize: file.size,
        uploadTime: new Date().toISOString()
      },
      message: '上传成功'
    })
  } catch (err) {
    cleanUploadedFile(req.file)
    next(err)
  }
}

/**
 * 获取课程资料列表
 * GET /api/courses/:courseId/materials
 */
const getMaterials = async (req, res, next) => {
  try {
    const { courseId } = req.params
    const teacherId = req.user.id

    // 校验课程归属
    const [courseRows] = await pool.query(
      'SELECT id, teacher_id FROM course WHERE id = ? AND is_deleted = 0',
      [courseId]
    )
    if (courseRows.length === 0) {
      return res.status(404).json({ code: 404, message: '课程不存在' })
    }
    if (courseRows[0].teacher_id !== teacherId) {
      return res.status(403).json({ code: 403, message: '无权查看该课程资料' })
    }

    const { page = 1, pageSize = 50 } = req.query
    const offset = (parseInt(page) - 1) * parseInt(pageSize)
    const limit = Math.min(parseInt(pageSize), 100)

    const [countResult] = await pool.query(
      'SELECT COUNT(*) as total FROM course_file WHERE course_id = ?',
      [courseId]
    )
    const total = countResult[0].total

    const [records] = await pool.query(
      `SELECT
        id, course_id AS courseId, file_name AS fileName, file_size AS fileSize,
        file_type AS fileType, upload_time AS uploadTime, created_by AS createdBy
      FROM course_file
      WHERE course_id = ?
      ORDER BY upload_time DESC
      LIMIT ? OFFSET ?`,
      [courseId, limit, offset]
    )

    // 按上传者关联用户名
    if (records.length > 0) {
      const userIds = [...new Set(records.map(r => r.createdBy))]
      const [users] = await pool.query(
        'SELECT id, real_name AS realName FROM sys_user WHERE id IN (?)',
        [userIds]
      )
      const userMap = {}
      users.forEach(u => { userMap[u.id] = u.realName })
      records.forEach(r => {
        r.uploaderName = userMap[r.createdBy] || '未知'
        r.fileSizeFormatted = formatFileSize(r.fileSize)
      })
    }

    res.json({
      code: 200,
      data: { records, total, page: parseInt(page), pageSize: parseInt(pageSize) }
    })
  } catch (err) {
    next(err)
  }
}

/**
 * 删除课程资料
 * DELETE /api/courses/:courseId/materials/:materialId
 */
const deleteMaterial = async (req, res, next) => {
  try {
    const { courseId, materialId } = req.params
    const teacherId = req.user.id

    // 校验课程
    const [courseRows] = await pool.query(
      'SELECT id, teacher_id FROM course WHERE id = ? AND is_deleted = 0',
      [courseId]
    )
    if (courseRows.length === 0) {
      return res.status(404).json({ code: 404, message: '课程不存在' })
    }
    if (courseRows[0].teacher_id !== teacherId) {
      return res.status(403).json({ code: 403, message: '无权操作' })
    }

    // 查文件记录
    const [fileRows] = await pool.query(
      'SELECT id, file_path FROM course_file WHERE id = ? AND course_id = ?',
      [materialId, courseId]
    )
    if (fileRows.length === 0) {
      return res.status(404).json({ code: 404, message: '资料不存在' })
    }

    // 删除物理文件
    const filePath = fileRows[0].file_path
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }

    // 删除数据库记录
    await pool.query('DELETE FROM course_file WHERE id = ?', [materialId])

    res.json({ code: 200, message: '删除成功' })
  } catch (err) {
    next(err)
  }
}

/**
 * 下载课程资料
 * GET /api/courses/:courseId/materials/:materialId/download
 */
const downloadMaterial = async (req, res, next) => {
  try {
    const { courseId, materialId } = req.params
    const teacherId = req.user.id

    // 校验课程
    const [courseRows] = await pool.query(
      'SELECT id, teacher_id FROM course WHERE id = ? AND is_deleted = 0',
      [courseId]
    )
    if (courseRows.length === 0) {
      return res.status(404).json({ code: 404, message: '课程不存在' })
    }
    if (courseRows[0].teacher_id !== teacherId) {
      return res.status(403).json({ code: 403, message: '无权下载' })
    }

    const [fileRows] = await pool.query(
      'SELECT file_name, file_path, file_type FROM course_file WHERE id = ? AND course_id = ?',
      [materialId, courseId]
    )
    if (fileRows.length === 0) {
      return res.status(404).json({ code: 404, message: '资料不存在' })
    }

    const { file_name, file_path } = fileRows[0]
    if (!file_path || !fs.existsSync(file_path)) {
      return res.status(404).json({ code: 404, message: '文件已被删除或不存在' })
    }

    // 设置 Content-Type
    const mimeMap = {
      pdf: 'application/pdf',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      md: 'text/markdown; charset=utf-8',
      txt: 'text/plain; charset=utf-8'
    }
    const ext = path.extname(file_name).replace('.', '').toLowerCase()
    const contentType = mimeMap[ext] || 'application/octet-stream'

    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file_name)}"`)
    res.setHeader('Content-Length', fs.statSync(file_path).size)

    const readStream = fs.createReadStream(file_path)
    readStream.pipe(res)
  } catch (err) {
    next(err)
  }
}

// ========== 工具函数 ==========

function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function cleanUploadedFile(file) {
  if (file && file.path && fs.existsSync(file.path)) {
    try { fs.unlinkSync(file.path) } catch {}
  }
}

module.exports = { uploadMaterial, getMaterials, deleteMaterial, downloadMaterial }
