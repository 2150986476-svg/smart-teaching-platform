import request from './request'

export const generateQuiz = (data) => request.post('/student/quiz/generate', data)
export const submitQuiz = (data) => request.post('/student/quiz/submit', data)
export const getQuizBatches = (params) => request.get('/student/quiz/batches', { params })
export const getQuizBatchDetail = (batchId) => request.get(`/student/quiz/batches/${batchId}`)

export const getWrongQuestions = (params) => request.get('/student/wrong-questions', { params })
export const markWrongMastered = (id) => request.post(`/student/wrong-questions/${id}/master`)
export const practiceWrongQuestions = (data) => request.post('/student/wrong-questions/practice', data)
export const getLeaderboard = (params) => request.get('/student/leaderboard', { params })
export const getClassAnalytics = (params) => request.get('/teacher/class-analytics', { params })
export const getAchievements = (params) => request.get('/student/achievements', { params })
