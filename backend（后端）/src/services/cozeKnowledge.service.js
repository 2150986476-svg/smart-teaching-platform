const axios = require('axios')
const fs = require('fs')
const path = require('path')
const cozeConfig = require('../config/coze')

// ============================================================
// Coze Knowledge API 服务
//
// API 文档：https://www.coze.cn/docs/developer_guides/knowledge_overview
//
// 同步流程：
//   1. 创建/获取知识库 (knowledge)
//   2. 逐文件上传 → 添加到知识库
//   3. 知识库自动处理、分块、向量化
// ============================================================

const request = axios.create({
  baseURL: cozeConfig.baseUrl,
  headers: {
    'Authorization': `Bearer ${cozeConfig.apiToken}`,
    'Content-Type': 'application/json'
  },
  timeout: cozeConfig.timeout
})

/**
 * 创建知识库
 * POST /v1/knowledge
 * 
 * @param {string} name - 知识库名称（建议用课程名）
 * @returns {Promise<{knowledgeId: string}>}
 */
async function createKnowledge(name) {
  ensureConfigured()
  try {
    const res = await request.post('/v1/knowledge', {
      name: name || '课程知识库',
      description: `${name} 的教学资料知识库`
    })
    const data = res.data
    if (data.code !== 0) {
      throw new Error(`创建知识库失败：${data.msg || data.message || `错误码 ${data.code}`}`)
    }
    const knowledgeId = data.data?.knowledge_id || data.data?.id || ''
    if (!knowledgeId) {
      throw new Error('创建知识库成功但未返回 knowledge_id')
    }
    return { knowledgeId }
  } catch (err) {
    if (err.message?.includes('knowledge_id') || err.message?.includes('创建知识库')) {
      throw err
    }
    throw new CozeApiError('创建知识库', err)
  }
}

/**
 * 更新知识库名称
 * PUT /v1/knowledge/:knowledgeId
 */
async function updateKnowledge(knowledgeId, name) {
  ensureConfigured()
  try {
    const res = await request.put(`/v1/knowledge/${knowledgeId}`, {
      name: name || '课程知识库'
    })
    const data = res.data
    if (data.code !== 0) {
      throw new Error(`更新知识库失败：${data.msg || data.message || `错误码 ${data.code}`}`)
    }
    return { success: true }
  } catch (err) {
    if (err.message?.includes('更新知识库')) throw err
    throw new CozeApiError('更新知识库', err)
  }
}

/**
 * 上传文件到 Coze（返回 file_id）
 * POST /v1/files/upload
 * 
 * @param {string} filePath - 本地文件路径
 * @param {string} fileName - 文件名
 * @returns {Promise<{fileId: string}>}
 */
async function uploadFile(filePath, fileName) {
  ensureConfigured()

  if (!fs.existsSync(filePath)) {
    throw new Error(`文件不存在：${filePath}`)
  }

  const FormData = require('form-data')
  const form = new FormData()
  form.append('file', fs.createReadStream(filePath), fileName)

  try {
    const res = await axios.post(
      `${cozeConfig.baseUrl}/v1/files/upload`,
      form,
      {
        headers: {
          'Authorization': `Bearer ${cozeConfig.apiToken}`,
          ...form.getHeaders()
        },
        timeout: 120000 // 上传大文件，超时 2 分钟
      }
    )
    const data = res.data
    if (data.code !== 0) {
      throw new Error(`文件上传失败：${data.msg || data.message || `错误码 ${data.code}`}`)
    }
    const fileId = data.data?.file_id || data.data?.id || ''
    if (!fileId) {
      throw new Error('文件上传成功但未返回 file_id')
    }
    return { fileId }
  } catch (err) {
    if (err.message?.includes('file_id') || err.message?.includes('文件上传') || err.message?.includes('文件不存在')) {
      throw err
    }
    throw new CozeApiError('上传文件', err)
  }
}

/**
 * 给知识库添加文档
 * POST /v1/knowledge/:knowledgeId/document
 * 
 * @param {string} knowledgeId - 知识库ID
 * @param {string} fileId      - Coze 文件ID（uploadFile 返回）
 * @param {string} documentName - 文档名称
 * @returns {Promise<{documentId: string}>}
 */
async function addDocument(knowledgeId, fileId, documentName) {
  ensureConfigured()
  try {
    const res = await request.post(`/v1/knowledge/${knowledgeId}/document`, {
      file_id: fileId,
      document_name: documentName,
      chunk_strategy: {
        strategy_type: 'auto'
      }
    })
    const data = res.data
    if (data.code !== 0) {
      throw new Error(`添加文档失败：${data.msg || data.message || `错误码 ${data.code}`}`)
    }
    const documentId = data.data?.document_id || data.data?.id || ''
    return { documentId }
  } catch (err) {
    if (err.message?.includes('添加文档') || err.message?.includes('document_id')) {
      throw err
    }
    throw new CozeApiError('添加文档到知识库', err)
  }
}

/**
 * 给知识库添加文档（基于已上传文件的信息）
 * POST /v1/knowledge/:knowledgeId/document
 * 
 * @param {string} knowledgeId     - 知识库ID
 * @param {Object} documentInfo    - 文档信息对象
 * @param {string} documentInfo.fileId         - Coze 文件ID
 * @param {string} documentInfo.documentName   - 文档名称
 * @returns {Promise<{documentId: string}>}
 */
async function addDocumentToKnowledge(knowledgeId, { fileId, documentName }) {
  return addDocument(knowledgeId, fileId, documentName)
}

/**
 * 列出知识库中的文档
 * GET /v1/knowledge/:knowledgeId/document
 */
async function listDocuments(knowledgeId, page = 1, pageSize = 100) {
  ensureConfigured()
  try {
    const res = await request.get(`/v1/knowledge/${knowledgeId}/document`, {
      params: { page, page_size: pageSize }
    })
    const data = res.data
    if (data.code !== 0) {
      throw new Error(`获取文档列表失败：${data.msg || data.message || `错误码 ${data.code}`}`)
    }
    return {
      documents: data.data?.documents || data.data || [],
      total: data.data?.total || 0
    }
  } catch (err) {
    if (err.message?.includes('文档列表')) throw err
    throw new CozeApiError('获取文档列表', err)
  }
}

/**
 * 删除知识库中的文档
 * DELETE /v1/knowledge/:knowledgeId/document/:documentId
 */
async function deleteDocument(knowledgeId, documentId) {
  ensureConfigured()
  try {
    const res = await request.delete(`/v1/knowledge/${knowledgeId}/document/${documentId}`)
    const data = res.data
    if (data.code !== 0) {
      throw new Error(`删除文档失败：${data.msg || data.message || `错误码 ${data.code}`}`)
    }
    return { success: true }
  } catch (err) {
    if (err.message?.includes('删除文档')) throw err
    throw new CozeApiError('删除文档', err)
  }
}

/**
 * 查询知识库详情
 * GET /v1/knowledge/:knowledgeId
 */
async function getKnowledge(knowledgeId) {
  ensureConfigured()
  try {
    const res = await request.get(`/v1/knowledge/${knowledgeId}`)
    const data = res.data
    if (data.code !== 0) {
      throw new Error(`获取知识库详情失败：${data.msg || data.message || `错误码 ${data.code}`}`)
    }
    return data.data || {}
  } catch (err) {
    if (err.message?.includes('知识库详情')) throw err
    throw new CozeApiError('获取知识库详情', err)
  }
}

// ========== 内部工具 ==========

function ensureConfigured() {
  if (!cozeConfig.isConfigured()) {
    throw new Error('COZE_API_TOKEN 未配置：请在 .env 中设置 COZE_API_TOKEN')
  }
}

class CozeApiError extends Error {
  constructor(operation, originalError) {
    let msg = `Coze ${operation}失败：`
    if (originalError.response) {
      const status = originalError.response.status
      const cozeMsg = originalError.response.data?.msg
        || originalError.response.data?.message
        || '未知错误'
      if (status === 401) msg += '认证失败，请检查 COZE_API_TOKEN'
      else if (status === 429) msg += '请求频率过高，请稍后重试'
      else msg += `HTTP ${status} - ${cozeMsg}`
    } else if (originalError.code === 'ECONNABORTED') {
      msg += '请求超时，请稍后重试'
    } else {
      msg += originalError.message
    }
    super(msg)
    this.name = 'CozeApiError'
    this.operation = operation
    this.originalError = originalError
  }
}

module.exports = {
  createKnowledge,
  updateKnowledge,
  getKnowledge,
  uploadFile,
  addDocument,
  addDocumentToKnowledge,
  listDocuments,
  deleteDocument
}
