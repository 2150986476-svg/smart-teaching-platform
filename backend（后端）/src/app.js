require('dotenv').config()

const express = require('express')
const cors = require('cors')
const morgan = require('morgan')
const path = require('path')
const compression = require('compression')
const cron = require('node-cron')

const app = express()
const PORT = process.env.PORT || 3000
const runMigration = require('./config/migrate')

// 中间件
app.use(compression())  // gzip/brotli 压缩，大幅减少响应体积
app.use(cors())
app.use(morgan('dev'))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// 健康检查端点（Railway 用）
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

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

  // 生产环境：启动 Token 自动续期任务（每 25 天执行一次）
  // 支持两种认证方式：Cookie 模式 (COZE_COOKIES) 或 密码模式 (COZE_EMAIL + COZE_PASSWORD)
  const hasCookieAuth = process.env.COZE_COOKIES
  const hasPasswordAuth = process.env.COZE_EMAIL && process.env.COZE_PASSWORD
  
  if (process.env.NODE_ENV === 'production' && (hasCookieAuth || hasPasswordAuth)) {
    const authMode = hasCookieAuth ? 'cookie' : 'password'
    console.log(`[Cron] Token auto-renewal enabled (every 25 days, mode: ${authMode})`)
    // 启动时先检查是否需要立即续期
    try {
      const { renewToken } = require('../scripts/renew-coze-token')
      const cachePath = path.join(__dirname, '..', '.token-cache')
      let needsImmediateRenew = true
      
      if (require('fs').existsSync(cachePath)) {
        try {
          const cacheData = JSON.parse(require('fs').readFileSync(cachePath, 'utf8'))
          const ageDays = (Date.now() - new Date(cacheData.renewedAt).getTime()) / (1000 * 60 * 60 * 24)
          if (ageDays < 20) {
            needsImmediateRenew = false
            console.log(`[Cron] Token cache is fresh (${ageDays.toFixed(1)} days old), skip immediate renewal`)
          }
        } catch (e) {}
      }
      
      if (needsImmediateRenew) {
        console.log('[Cron] Running initial token renewal...')
        renewToken().then(result => {
          if (result.success) {
            require('./config/coze').reloadToken()
          }
        })
      }
    } catch (e) {
      console.warn('[Cron] Could not run initial renewal:', e.message)
    }
    
    // 每 25 天执行一次：0 0 */25 * *
    cron.schedule('0 0 */25 * *', async () => {
      console.log('[Cron] Scheduled token renewal triggered')
      try {
        const { renewToken } = require('../scripts/renew-coze-token')
        const result = await renewToken()
        if (result.success) {
          require('./config/coze').reloadToken()
        }
      } catch (e) {
        console.error('[Cron] Token renewal failed:', e.message)
      }
    })
  }

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
