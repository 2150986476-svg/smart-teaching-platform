const express = require('express')
const router = express.Router()
const multer = require('multer')
const studentController = require('../controllers/student.controller')
const { authenticate, authorize } = require('../middleware/auth')

// === 学生端路由（无需 teacher/admin 角色）===

// 学生查看自己已绑定课程列表
router.get('/student/courses', authenticate, studentController.getStudentCourses)

// === 教师/管理员路由 ===
// 以下路由需要认证 + 教师/管理员权限
// 注意：使用路径前缀限制作用域，避免拦截其他路由器的 /student/* 请求
const teacherAuth = [authenticate, authorize('teacher', 'admin')]

// Multer 配置：内存存储，限制 20MB，仅允许 xlsx
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = file.originalname.split('.').pop().toLowerCase()
    if (ext === 'xlsx') {
      cb(null, true)
    } else {
      cb(new Error('仅支持 .xlsx 格式的 Excel 文件'))
    }
  }
})

// --- 导入模板下载（路由必须在动态路由前） ---
router.get('/courses/students/import-template', ...teacherAuth, studentController.downloadTemplate)

// --- 课程维度的学生操作 ---

// 获取课程学生列表
router.get('/courses/:courseId/students', ...teacherAuth, studentController.getStudentsByCourse)

// 添加学生到课程
router.post('/courses/:courseId/students', ...teacherAuth, studentController.addStudentsToCourse)

// Excel 批量导入学生到课程
router.post(
  '/courses/:courseId/students/import',
  ...teacherAuth,
  upload.single('file'),
  studentController.importStudents
)

// 从课程移除学生
router.delete('/courses/:courseId/students/:studentId', ...teacherAuth, studentController.removeStudentFromCourse)

// --- 学生个体操作 ---

// 重置学生密码
router.put('/students/:id/reset-password', ...teacherAuth, studentController.resetStudentPassword)

// 修改学生班级
router.put('/students/:id/class', ...teacherAuth, studentController.updateStudentClass)

module.exports = router
