const express = require('express')
const router = express.Router()
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const courseController = require('../controllers/course.controller')
const materialController = require('../controllers/material.controller')
const { authenticate, authorize } = require('../middleware/auth')

// 所有课程接口需要认证
router.use(authenticate)

// 获取课程列表（教师看自己，管理员看全部）
router.get('/courses', courseController.getCourses)

// 获取课程详情
router.get('/courses/:id', courseController.getCourseById)

// 创建课程（教师/管理员）
router.post('/courses', authorize('teacher', 'admin'), courseController.createCourse)

// 更新课程（课程创建者/管理员）
router.put('/courses/:id', courseController.updateCourse)

// 删除课程-软删除（课程创建者/管理员）
router.delete('/courses/:id', courseController.deleteCourse)

// ===== 课程资料上传 =====
const uploadTmpDir = path.resolve(__dirname, '../../uploads/tmp')
if (!fs.existsSync(uploadTmpDir)) {
  fs.mkdirSync(uploadTmpDir, { recursive: true })
}
const courseUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadTmpDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname)
      const unique = Date.now() + '-' + Math.round(Math.random() * 1e9)
      cb(null, unique + ext)
    }
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.md', '.txt']
    const ext = path.extname(file.originalname).toLowerCase()
    if (allowed.includes(ext)) {
      cb(null, true)
    } else {
      cb(new Error(`不支持的文件类型：${ext}`))
    }
  }
})

// 上传课程资料（接收 course_id 在 body 中）
router.post(
  '/course/upload',
  authorize('teacher', 'admin'),
  courseUpload.single('file'),
  (req, res, next) => {
    // 将 course_id 从 body 注入到 params
    if (req.body.course_id) {
      req.params.courseId = req.body.course_id
    }
    materialController.uploadMaterial(req, res, next)
  }
)

module.exports = router
