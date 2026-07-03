const express = require('express')
const router = express.Router()
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const materialController = require('../controllers/material.controller')
const { authenticate, authorize } = require('../middleware/auth')

// 资料管理需教师/管理员权限
router.use(authenticate)
router.use(authorize('teacher', 'admin'))

// multer 磁盘存储配置 — 临时目录，上传成功后移动到课程目录
const uploadTmpDir = path.resolve(__dirname, '../../uploads/tmp')
if (!fs.existsSync(uploadTmpDir)) {
  fs.mkdirSync(uploadTmpDir, { recursive: true })
}

const ALLOWED_EXTS = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.md', '.txt']
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadTmpDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname)
      const unique = Date.now() + '-' + Math.round(Math.random() * 1e9)
      cb(null, unique + ext)
    }
  }),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    if (ALLOWED_EXTS.includes(ext)) {
      cb(null, true)
    } else {
      cb(new Error(`不支持的文件类型：${ext}。支持：pdf/doc/docx/ppt/pptx/md/txt`))
    }
  }
})

// 上传资料
router.post(
  '/courses/:courseId/materials',
  upload.single('file'),
  materialController.uploadMaterial
)

// 获取资料列表
router.get('/courses/:courseId/materials', materialController.getMaterials)

// 删除资料
router.delete('/courses/:courseId/materials/:materialId', materialController.deleteMaterial)

// 下载资料
router.get('/courses/:courseId/materials/:materialId/download', materialController.downloadMaterial)

module.exports = router
