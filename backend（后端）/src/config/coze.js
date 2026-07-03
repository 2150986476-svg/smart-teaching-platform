/**
 * Coze API 配置
 * 
 * 配置项说明：
 * - COZE_API_TOKEN：  从环境变量读取，是调用 Coze API 的认证令牌
 * - COZE_API_BASE_URL：Coze API 基础地址（国内 cn / 国际 com）
 * - COZE_API_TIMEOUT： 请求超时时间
 * 
 * 每门课程的 Bot ID 从 ai_assistant_bind 表动态获取，不在此处硬编码
 */

const cozeConfig = {
  apiToken: process.env.COZE_API_TOKEN || '',
  baseUrl: process.env.COZE_API_BASE_URL || 'https://api.coze.cn',
  timeout: parseInt(process.env.COZE_API_TIMEOUT) || 30000,

  /**
   * 验证配置是否已就绪
   */
  isConfigured() {
    return !!this.apiToken && this.apiToken !== 'your_coze_api_token_here'
  }
}

module.exports = cozeConfig
