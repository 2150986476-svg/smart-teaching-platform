require('dotenv').config()

const express = require('express')
const cors = require('cors')
const morgan = require('morgan')
const path = require('path')

const app = express()
const PORT = process.env.PORT || 3000

// 中间件
app.use(cors())
app.use(morgan('dev'))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// 静态文件 — 生产中托管前端打包产物
const frontendDist = path.join(__dirname, '../../frontend（前端）/dist')
app.use(express.static(frontendDist))

// API 路由
app.use('/api', require('./routes'))

// SPA fallback — 非 /api 的请求返回 index.html（Vue Router history mode）
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(frontendDist, 'index.html'), (err) => {
      if (err) {
        // 前端还没构建时，友好提示
        res.status(404).json({ code: 404, message: '前端未构建，请先运行: cd frontend（前端） && npm run build' })
      }
    })
  }
})

// 错误处理中间件
app.use(require('./middleware/errorHandler'))

app.listen(PORT, () => {
  console.log(`服务已启动: http://localhost:${PORT}`)
})
