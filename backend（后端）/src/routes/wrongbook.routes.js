const express = require('express')
const router = express.Router()
const ctrl = require('../controllers/wrongbook.controller')
const { authenticate, authorize } = require('../middleware/auth')

const studentAuth = [authenticate, authorize('student')]

router.get('/student/wrong-questions',            ...studentAuth, ctrl.getWrongQuestions)
router.post('/student/wrong-questions/:id/master', ...studentAuth, ctrl.markMastered)
router.post('/student/wrong-questions/practice',   ...studentAuth, ctrl.practiceWrongQuestions)

module.exports = router
