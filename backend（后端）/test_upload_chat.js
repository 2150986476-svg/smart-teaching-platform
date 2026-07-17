const http = require('http')
const fs = require('fs')
const path = require('path')

function api(m, p, t, d) {
  return new Promise((resolve) => {
    const b = d ? JSON.stringify(d) : null
    const h = { 'Content-Type': 'application/json' }
    if (t) h['Authorization'] = 'Bearer ' + t
    const req = http.request({ hostname: 'localhost', port: 3000, path: p, method: m, headers: h }, res => {
      let b = ''; res.on('data', c => b += c)
      res.on('end', () => { try { resolve({ status: res.statusCode, ...JSON.parse(b) }) } catch (e) { resolve({ status: res.statusCode, raw: b.substring(0, 200) }) } })
    })
    req.on('error', e => resolve({ error: e.message }))
    if (b) req.write(b)
    req.end()
  })
}

;(async () => {
  // Login as teacher
  const t = await api('POST', '/api/auth/login', null, { username: 'admin', password: 'admin123' })
  console.log('Teacher login:', t.code)
  const tToken = t.data.token

  // Upload a sample course material (a .txt file with course info)
  const tmpFile = path.resolve(__dirname, '_test_material.txt')
  fs.writeFileSync(tmpFile, `人工智能导论 - 课程大纲

第一章：人工智能概述
- 人工智能的定义与发展历史
- 图灵测试与中文房间
- 强AI与弱AI的区别

第二章：机器学习基础
- 监督学习：线性回归、决策树、SVM
- 无监督学习：K-Means聚类、PCA降维
- 强化学习：Q-Learning、策略梯度

第三章：深度学习
- 神经网络基础：感知机、激活函数
- CNN卷积神经网络
- RNN/LSTM循环神经网络
- Transformer与注意力机制

第四章：AI应用与伦理
- 计算机视觉
- 自然语言处理
- AI伦理与社会影响`)

  // Upload via multipart
  const boundary = '----TestBoundary' + Date.now()
  const fileContent = fs.readFileSync(tmpFile)
  let body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="人工智能导论大纲.txt"\r\nContent-Type: text/plain\r\n\r\n`),
    fileContent,
    Buffer.from(`\r\n--${boundary}--\r\n`)
  ])

  const uploadResult = await new Promise((resolve) => {
    const h = { 'Authorization': 'Bearer ' + tToken, 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Content-Length': body.length }
    const req = http.request({ hostname: 'localhost', port: 3000, path: '/api/courses/1/materials', method: 'POST', headers: h }, res => {
      let b = ''; res.on('data', c => b += c)
      res.on('end', () => { try { resolve({ status: res.statusCode, ...JSON.parse(b) }) } catch (e) { resolve({ status: res.statusCode, raw: b }) } })
    })
    req.on('error', e => resolve({ error: e.message }))
    req.write(body)
    req.end()
  })
  console.log('Upload material:', uploadResult.code, uploadResult.message || uploadResult.data?.id || '')

  fs.unlinkSync(tmpFile)

  // Now login as student and ask about the course content
  const s = await api('POST', '/api/auth/student/login', null, { username: '2024101047', password: 'HH050711a' })
  
  console.log('\n=== Testing AI Q&A with material context ===')
  const t1 = Date.now()
  const r = await api('POST', '/api/student/chat', s.data.token, { courseId: 1, question: '这门课有哪些章节？每章讲什么？' })
  console.log(`[${(Date.now() - t1) / 1000}s] Q: ${r.code}`)
  console.log('A:', (r.data?.answer || '').substring(0, 500))
})()
