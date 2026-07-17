require('dotenv').config()

const express = require('express')
const cors = require('cors')
const morgan = require('morgan')
const path = require('path')
const compression = require('compression')

const app = express()
const PORT = process.env.PORT || 3000
const runMigration = require('./config/migrate')

// 中间件
app.use(compression())  // gzip/brotli 压缩，大幅减少响应体积
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

app.listen(PORT, async () => {
  // 自动建表迁移
  try {
    await runMigration()
  } catch (e) {
    console.error('Migration error (server still running):', e.message)
  }
  console.log(`服务已启动: http://localhost:${PORT}`)

  // 本地开发时启动 localtunnel 公网隧道
  if (process.env.NODE_ENV !== 'production') {
    let tunnelUrl = null
    let keepaliveTimer = null

    async function startTunnel() {
      try {
        const localtunnel = require('localtunnel')
        const tunnel = await localtunnel({ port: PORT })
        tunnelUrl = tunnel.url
        console.log(`公网访问: ${tunnelUrl}`)

        if (keepaliveTimer) clearInterval(keepaliveTimer)
        keepaliveTimer = setInterval(() => {
          require('http').get(`http://localhost:${PORT}/api/health`, (r) => r.resume()).on('error', () => {})
        }, 30000)

        let reconnectTimer = null
        tunnel.on('close', () => {
          console.warn('隧道断开，5秒后重连...')
          if (keepaliveTimer) clearInterval(keepaliveTimer)
          if (reconnectTimer) clearTimeout(reconnectTimer)
          reconnectTimer = setTimeout(startTunnel, 5000)
        })
        tunnel.on('error', (err) => {
          console.warn('隧道异常:', err.message)
          if (keepaliveTimer) clearInterval(keepaliveTimer)
          if (reconnectTimer) clearTimeout(reconnectTimer)
          reconnectTimer = setTimeout(startTunnel, 5000)
        })
      } catch (e) {
        console.warn('隧道启动失败，10秒后重试:', e.message)
        setTimeout(startTunnel, 10000)
      }
    }

    startTunnel()
  }
})
