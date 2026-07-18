/**
 * Coze API 配置
 * 
 * 配置项说明：
 * - COZE_API_TOKEN：  从环境变量读取，是调用 Coze API 的认证令牌
 * - COZE_API_BASE_URL：Coze API 基础地址（国内 cn / 国际 com）
 * - COZE_API_TIMEOUT： 请求超时时间
 * 
 * 每门课程的 Bot ID 从 ai_assistant_bind 表动态获取，不在此处硬编码
 * 
 * Token 自动续期机制：
 * - 优先读取 .token-cache 缓存文件（由 renew-coze-token.js 自动更新）
 * - 缓存文件更新后 25 天内有效，超过则回退到环境变量
 */

const fs = require('fs');
const path = require('path');

/**
 * 从缓存文件读取 Token
 */
function loadTokenFromCache() {
  try {
    const cachePath = path.join(__dirname, '..', '..', '.token-cache');
    if (fs.existsSync(cachePath)) {
      const cacheData = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
      const renewedAt = new Date(cacheData.renewedAt);
      const ageDays = (Date.now() - renewedAt.getTime()) / (1000 * 60 * 60 * 24);
      
      // 缓存 25 天内有效
      if (ageDays < 25 && cacheData.token) {
        console.log(`[Coze] Using cached token (renewed ${ageDays.toFixed(1)} days ago)`);
        return cacheData.token;
      } else {
        console.log(`[Coze] Cache expired (${ageDays.toFixed(1)} days old), using env token`);
      }
    }
  } catch (e) {
    console.warn('[Coze] Failed to read token cache:', e.message);
  }
  return null;
}

const cozeConfig = {
  apiToken: loadTokenFromCache() || process.env.COZE_API_TOKEN || '',
  baseUrl: process.env.COZE_API_BASE_URL || 'https://api.coze.cn',
  timeout: parseInt(process.env.COZE_API_TIMEOUT) || 30000,

  /**
   * 验证配置是否已就绪
   */
  isConfigured() {
    return !!this.apiToken && this.apiToken !== 'your_coze_api_token_here'
  },

  /**
   * 重新加载 Token（续期后调用）
   */
  reloadToken() {
    const cached = loadTokenFromCache();
    if (cached) {
      this.apiToken = cached;
      console.log('[Coze] Token reloaded from cache');
    }
  }
}

module.exports = cozeConfig
