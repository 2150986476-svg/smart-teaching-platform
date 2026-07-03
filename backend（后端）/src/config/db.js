const mysql = require('mysql2/promise')

// 兼容 Railway / 云平台的 DATABASE_URL 格式
// 格式：mysql://user:password@host:port/database
let dbConfig
if (process.env.DATABASE_URL) {
  const url = new URL(process.env.DATABASE_URL)
  dbConfig = {
    host: url.hostname,
    port: url.port || 3306,
    user: url.username,
    password: url.password,
    database: url.pathname.replace('/', '')
  }
} else {
  dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'ai_teaching_platform'
  }
}

const pool = mysql.createPool({
  ...dbConfig,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
})

module.exports = pool
