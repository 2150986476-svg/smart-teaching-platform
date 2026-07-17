const http = require('http')
function api(m, p, t, d) {
  return new Promise((resolve) => {
    const b = d ? JSON.stringify(d) : null
    const h = { 'Content-Type': 'application/json' }
    if (t) h['Authorization'] = 'Bearer ' + t
    const req = http.request({ hostname: 'localhost', port: 3000, path: p, method: m, headers: h }, res => {
      let b = ''
      res.on('data', c => b += c)
      res.on('end', () => { try { resolve({ status: res.statusCode, ...JSON.parse(b) }) } catch (e) { resolve({ status: res.statusCode, raw: b.substring(0, 300) }) } })
    })
    req.on('error', e => resolve({ error: e.message }))
    if (b) req.write(b)
    req.end()
  })
}

;(async () => {
  const s = await api('POST', '/api/auth/student/login', null, { username: '2024101047', password: 'HH050711a' })
  console.log('Login:', s.code)

  // Test 1: Question that should use course context
  const t1 = Date.now()
  const r1 = await api('POST', '/api/student/chat', s.data.token, { courseId: 1, question: '这门课学什么？' })
  console.log(`[${(Date.now() - t1) / 1000}s] Q1 课程类问题: ${r1.code}`)
  console.log('A1:', (r1.data?.answer || '').substring(0, 300))
  console.log('')

  // Test 2: Question that should use AI knowledge (no materials)
  const t2 = Date.now()
  const r2 = await api('POST', '/api/student/chat', s.data.token, { courseId: 1, question: '什么是深度学习？' })
  console.log(`[${(Date.now() - t2) / 1000}s] Q2 开放问题: ${r2.code}`)
  console.log('A2:', (r2.data?.answer || '').substring(0, 300))
})()
