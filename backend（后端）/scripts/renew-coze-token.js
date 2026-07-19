/**
 * Coze PAT Token Auto-Renewal Script
 * 
 * Runs every 25 days to create a fresh 30-day Coze Personal Access Token.
 * Uses Puppeteer to automate the Coze.cn login flow, then calls the PAT
 * management API to delete the old token and create a new one.
 * 
 * Usage:
 *   node scripts/renew-coze-token.js
 * 
 * Environment variables required:
 *   COZE_EMAIL    - Coze.cn login email/phone
 *   COZE_PASSWORD - Coze.cn login password
 *   COZE_API_TOKEN (optional) - current token to delete before creating new one
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Token cache file path (persists across Railway restarts via mounted volume)
const TOKEN_CACHE_FILE = path.join(__dirname, '..', '.token-cache');

// PAT API permission lists (captured from Coze.cn UI)
const ACCOUNT_PERMISSIONS = [
  "Account.listConversation", "Conversation.editConversation", "Account.createConversation",
  "Conversation.retrieveConversation", "Conversation.feedback", "ApiApp.deleteApiApp",
  "ApiApp.unsubscribeApiAppEvent", "Account.listApiApp", "ApiApp.subscribeApiAppEvent",
  "ApiApp.updateApiApp", "Account.createApiApp", "Account.createWorkspace",
  "Account.listWorkspace", "Conversation.cancelChat", "Conversation.getChat",
  "Conversation.submitToolChat", "File.retrieveFile", "Account.uploadFile",
  "Account.deleteVoiceprintFeature", "Account.updateVoiceprintFeature",
  "Account.createVoiceprintGroup", "Account.createVoiceprintFeature",
  "Account.listVoiceprintFeature", "Account.identifyInVoiceprintGroup",
  "Account.listVoiceprintGroup", "Account.createTranscription", "Account.createVoice",
  "Account.listVoice", "Account.updateVoiceprintGroup", "Account.createSpeech",
  "Account.deleteVoiceprintGroup", "Account.getBenefit", "Conversation.deleteMessage",
  "Conversation.createMessage", "Conversation.listMessage", "Conversation.modifyMessage",
  "Conversation.retrieveMessage", "Account.bindConnectorConfig", "Account.updateOrganization"
];

const WORKSPACE_PERMISSIONS = [
  "Bot.duplicate","Bot.switchDevelopMode","Bot.getBasicMetadata","Bot.updateBasicInfo",
  "Bot.publish","Bot.deleteBot","Bot.updateAdvancedSetting","Bot.getAdvancedSetting",
  "Bot.getPublishHistory","Bot.getPublishInfo","Bot.createEvaluation","Bot.getEvaluationList",
  "Bot.getEvaluationResult","Bot.createEvaluationTask","Bot.getEvaluationTaskList",
  "Bot.deleteEvaluation","Bot.getEvaluation","Bot.copyBot","Bot.createBot",
  "Bot.listBot","Bot.createKnowledge","Bot.updateKnowledge","Bot.deleteKnowledge",
  "Bot.listKnowledge","Bot.getKnowledge","Bot.createDocument","Bot.updateDocument",
  "Bot.deleteDocument","Bot.listDocument","Bot.getDocument","Bot.createWorkflow",
  "Bot.updateWorkflow","Bot.deleteWorkflow","Bot.listWorkflow","Bot.getWorkflow",
  "Bot.createPlugin","Bot.updatePlugin","Bot.deletePlugin","Bot.listPlugin",
  "Bot.getPlugin","Bot.createVariable","Bot.updateVariable","Bot.deleteVariable",
  "Bot.listVariable","Bot.createModelConfig","Bot.updateModelConfig","Bot.deleteModelConfig",
  "Bot.listModelConfig","Bot.importBot","Bot.exportBot","Bot.createChannel",
  "Bot.updateChannel","Bot.deleteChannel","Bot.listChannel","Bot.createApiKey",
  "Bot.updateApiKey","Bot.deleteApiKey","Bot.listApiKey","Bot.getStatistics",
  "Bot.getConversationList","Bot.getConversationDetail","Bot.deleteConversation",
  "Bot.createMessage","Bot.listMessage","Bot.deleteMessage","Bot.retrieveMessage",
  "Bot.modifyMessage","Bot.cancelChat","Bot.getChat","Bot.submitToolChat",
  "Bot.feedback","Bot.createSpeech","Bot.listVoice","Bot.createVoice",
  "Bot.createTranscription","Bot.listVoiceprintFeature","Bot.createVoiceprintFeature",
  "Bot.updateVoiceprintFeature","Bot.deleteVoiceprintFeature","Bot.createVoiceprintGroup",
  "Bot.updateVoiceprintGroup","Bot.deleteVoiceprintGroup","Bot.listVoiceprintGroup",
  "Bot.identifyInVoiceprintGroup","Bot.uploadFile","Bot.retrieveFile",
  "Bot.createWebhook","Bot.updateWebhook","Bot.deleteWebhook","Bot.listWebhook",
  "Bot.createSchedule","Bot.updateSchedule","Bot.deleteSchedule","Bot.listSchedule",
  "Bot.createApproval","Bot.updateApproval","Bot.deleteApproval","Bot.listApproval",
  "Bot.createTag","Bot.updateTag","Bot.deleteTag","Bot.listTag",
  "Bot.createCategory","Bot.updateCategory","Bot.deleteCategory","Bot.listCategory",
  "Bot.createTemplate","Bot.updateTemplate","Bot.deleteTemplate","Bot.listTemplate",
  "Bot.createSnapshot","Bot.updateSnapshot","Bot.deleteSnapshot","Bot.listSnapshot",
  "Bot.restoreSnapshot","Bot.createVersion","Bot.updateVersion","Bot.listVersion",
  "Bot.getVersion","Bot.rollbackVersion","Workspace.createBot","Workspace.listBot",
  "Workspace.createKnowledge","Workspace.listKnowledge","Workspace.createWorkflow",
  "Workspace.listWorkflow","Workspace.createPlugin","Workspace.listPlugin"
];

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Attempt to login to Coze.cn via Puppeteer.
 * Auth priority:
 *   1. Persisted cookies in userDataDir (survive across runs via Railway volume)
 *   2. COZE_COOKIES env var - seed cookies for initial setup (SMS-login users)
 *   3. COZE_EMAIL + COZE_PASSWORD env vars (password-login users)
 */
async function loginToCoze(browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  
  // Helper: check login status on current page (runs in browser context)
  const checkLogin = async () => {
    return await page.evaluate(() => {
      const hasCsrf = document.cookie.includes('passport_csrf_token');
      // Check for user avatar/menu elements (indicating logged-in state)
      const userEls = document.querySelectorAll('[class*="user"], [class*="avatar"], [class*="User"]');
      let hasUserEl = false;
      for (const el of userEls) {
        // Filter out non-user elements that happen to match
        if (el.textContent && !el.textContent.includes('登录') && !el.textContent.includes('Login')) {
          hasUserEl = true;
          break;
        }
      }
      // Check for explicit login buttons (indicating NOT logged in)
      const allBtns = document.querySelectorAll('button, a');
      let hasLoginBtn = false;
      for (const el of allBtns) {
        const text = (el.textContent || '').trim();
        if (text === '登录' || text === 'Login' || text === 'Sign in') {
          hasLoginBtn = true;
          break;
        }
      }
      return { loggedIn: hasCsrf && !hasLoginBtn, hasCsrf, hasUserEl };
    });
  };
  
  // --- Layer 1: Try persisted cookies (userDataDir) ---
  console.log('[Renewal] Layer 1: Checking persisted cookies...');
  await page.goto('https://www.coze.cn/', { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(2000);
  
  let status = await checkLogin();
  if (status.loggedIn) {
    console.log('[Renewal] ✓ Already logged in via persisted cookies!');
    return page;
  }
  console.log(`[Renewal] Not logged in (hasCsrf=${status.hasCsrf}, hasUserEl=${status.hasUserEl})`);
  
  // --- Layer 2: Try COZE_COOKIES env var (seed for initial setup) ---
  const cozeCookies = process.env.COZE_COOKIES;
  if (cozeCookies) {
    console.log('[Renewal] Layer 2: Seeding cookies from COZE_COOKIES env var...');
    
    const cookiePairs = cozeCookies.split(';').map(c => c.trim()).filter(Boolean);
    const cookieObjects = cookiePairs.map(pair => {
      const [name, ...valueParts] = pair.split('=');
      return {
        name: name.trim(),
        value: valueParts.join('='),
        domain: '.coze.cn',
        path: '/',
        httpOnly: false,
        secure: true,
        sameSite: 'Lax'
      };
    });
    
    await page.setCookie(...cookieObjects);
    console.log(`[Renewal] Set ${cookieObjects.length} seed cookies.`);
    
    // Re-navigate to let server set httpOnly session cookies
    await page.goto('https://www.coze.cn/', { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(2000);
    
    status = await checkLogin();
    if (status.loggedIn) {
      console.log('[Renewal] ✓ Cookie seeding successful! httpOnly cookies now in userDataDir.');
      return page;
    }
    console.log('[Renewal] Cookie seeding did not result in login. Trying next layer...');
  }
  
  // --- Layer 3: Password-based auth ---
  const email = process.env.COZE_EMAIL;
  const password = process.env.COZE_PASSWORD;
  
  if (!email || !password) {
    throw new Error(
      'All auth methods exhausted. Persisted cookies expired, COZE_COOKIES invalid, ' +
      'and no COZE_EMAIL/COZE_PASSWORD configured. ' +
      'Re-login to Coze.cn and update COZE_COOKIES env var.'
    );
  }
  
  console.log('[Renewal] Layer 3: Password-based auth...');
  
  // Check if already on a login page
  status = await checkLogin();
  if (status.loggedIn) {
    console.log('[Renewal] Already logged in!');
    return page;
  }
  
  // Click login button - try common selectors
  console.log('[Renewal] Looking for login button...');
  
  const loginSelectors = [
    'button:has-text("登录")',
    'a:has-text("登录")',
    '[class*="login"]',
    '[class*="Login"]',
    'text=登录',
    'text=Sign in',
  ];
  
  let clicked = false;
  for (const selector of loginSelectors) {
    try {
      await page.waitForSelector(selector, { timeout: 3000 });
      await page.click(selector);
      clicked = true;
      console.log(`[Renewal] Clicked login: ${selector}`);
      break;
    } catch (e) {}
  }
  
  if (!clicked) {
    console.log('[Renewal] Trying direct login redirect...');
    await page.goto('https://www.coze.cn/open/oauth/pats', { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(3000);
  } else {
    await sleep(2000);
  }
  
  console.log(`[Renewal] Current URL: ${page.url()}`);
  
  const phoneSelectors = [
    'input[type="text"]', 'input[type="email"]', 'input[type="tel"]',
    'input[name="email"]', 'input[name="phone"]', 'input[name="username"]',
    'input[name="account"]', 'input[placeholder*="手机"]', 'input[placeholder*="邮箱"]',
    'input[placeholder*="phone"]', 'input[placeholder*="email"]',
  ];
  
  let phoneInput = null;
  for (const selector of phoneSelectors) {
    try {
      phoneInput = await page.$(selector);
      if (phoneInput) { console.log(`[Renewal] Found input: ${selector}`); break; }
    } catch (e) {}
  }
  
  if (phoneInput) {
    console.log('[Renewal] Entering email/phone...');
    await phoneInput.click();
    await phoneInput.type(email, { delay: 100 });
    await sleep(1000);
    
    const nextSelectors = [
      'button:has-text("下一步")', 'button:has-text("继续")',
      'button:has-text("Next")', 'button:has-text("Continue")',
      'button[type="submit"]', 'input[type="submit"]',
    ];
    for (const selector of nextSelectors) {
      try {
        const btn = await page.$(selector);
        if (btn) { await btn.click(); console.log(`[Renewal] Clicked next: ${selector}`); break; }
      } catch (e) {}
    }
    await sleep(2000);
    
    const passSelectors = [
      'input[type="password"]', 'input[name="password"]',
      'input[placeholder*="密码"]', 'input[placeholder*="password"]',
    ];
    let passInput = null;
    for (const selector of passSelectors) {
      try {
        passInput = await page.$(selector);
        if (passInput) { console.log(`[Renewal] Found password: ${selector}`); break; }
      } catch (e) {}
    }
    
    if (passInput) {
      console.log('[Renewal] Entering password...');
      await passInput.click();
      await passInput.type(password, { delay: 100 });
      await sleep(500);
      
      const submitSelectors = [
        'button:has-text("登录")', 'button:has-text("登 录")',
        'button:has-text("Sign in")', 'button[type="submit"]', 'input[type="submit"]',
      ];
      for (const selector of submitSelectors) {
        try {
          const btn = await page.$(selector);
          if (btn) { await btn.click(); console.log(`[Renewal] Clicked submit: ${selector}`); break; }
        } catch (e) {}
      }
      await sleep(5000);
      await page.screenshot({ path: '/tmp/coze-after-login.png' });
    }
  }
  
  try {
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
  } catch (e) {}
  
  // Final check
  const finalStatus = await checkLogin();
  console.log(`[Renewal] Login flow complete. Logged in: ${finalStatus.loggedIn}`);
  
  if (!finalStatus.loggedIn) {
    throw new Error('All login methods failed. Please update COZE_COOKIES with fresh cookies.');
  }
  
  return page;
}

/**
 * Create a new PAT token via the Coze API
 */
async function createNewToken(page) {
  // Navigate to PAT page
  console.log('[Renewal] Navigating to PAT page...');
  await page.goto('https://www.coze.cn/open/oauth/pats', { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(3000);
  
  // First, list current tokens to find and delete the old one
  console.log('[Renewal] Listing current tokens...');
  const listResult = await page.evaluate(async () => {
    try {
      const resp = await fetch('https://www.coze.cn/api/permission_api/pat/list_personal_access_tokens?search_option=all', {
        credentials: 'include'
      });
      return await resp.json();
    } catch (e) {
      return { error: e.message };
    }
  });
  
  if (listResult.code !== 0) {
    console.error('[Renewal] Failed to list tokens:', JSON.stringify(listResult));
    throw new Error('Failed to list PAT tokens: ' + (listResult.msg || 'unknown error'));
  }
  
  const tokens = listResult.data?.personal_access_tokens || [];
  console.log(`[Renewal] Found ${tokens.length} existing tokens`);
  
  // Delete old "SmartTeaching" tokens
  for (const token of tokens) {
    if (token.name === 'SmartTeaching') {
      console.log(`[Renewal] Deleting old token: ${token.id}`);
      const deleteResult = await page.evaluate(async (tokenId) => {
        try {
          const resp = await fetch('https://www.coze.cn/api/permission_api/pat/delete_personal_access_token_and_permission', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: tokenId })
          });
          return await resp.json();
        } catch (e) {
          return { error: e.message };
        }
      }, token.id);
      
      if (deleteResult.code !== 0) {
        console.warn(`[Renewal] Failed to delete token ${token.id}:`, deleteResult.msg);
      } else {
        console.log(`[Renewal] Deleted old token: ${token.id}`);
      }
    }
  }
  
  // Create new token
  console.log('[Renewal] Creating new SmartTeaching token...');
  const createBody = {
    name: 'SmartTeaching',
    duration_day: '30',
    account_permission: {
      permission_list: ACCOUNT_PERMISSIONS
    },
    workspace_permission_v2: {
      option: 2,
      workspace_id_list: [],
      permission_list: WORKSPACE_PERMISSIONS
    }
  };
  
  const createResult = await page.evaluate(async (body) => {
    try {
      const resp = await fetch('https://www.coze.cn/api/permission_api/pat/create_personal_access_token_and_permission', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      return await resp.json();
    } catch (e) {
      return { error: e.message };
    }
  }, createBody);
  
  if (createResult.code !== 0) {
    console.error('[Renewal] Failed to create token:', JSON.stringify(createResult));
    throw new Error('Failed to create PAT token: ' + (createResult.msg || 'unknown error'));
  }
  
  const newToken = createResult.data?.token;
  if (!newToken) {
    // Try to get token from the get API
    console.log('[Renewal] Token not in create response, trying get API...');
    const tokenId = createResult.data?.id;
    if (tokenId) {
      const getResult = await page.evaluate(async (id) => {
        const resp = await fetch(`https://www.coze.cn/api/permission_api/pat/get_personal_access_token_and_permission?id=${id}`, {
          credentials: 'include'
        });
        return await resp.json();
      }, tokenId);
      
      if (getResult.code === 0 && getResult.data?.token) {
        console.log('[Renewal] Retrieved token via get API');
        return getResult.data.token;
      }
    }
    throw new Error('Could not retrieve new token value');
  }
  
  console.log('[Renewal] New token created successfully!');
  return newToken;
}

/**
 * Save the new token to cache file
 */
function saveToken(token) {
  const cacheData = JSON.stringify({
    token: token,
    renewedAt: new Date().toISOString(),
    expiresIn: '30 days'
  });
  
  fs.writeFileSync(TOKEN_CACHE_FILE, cacheData, 'utf8');
  console.log(`[Renewal] Token saved to cache: ${TOKEN_CACHE_FILE}`);
  
  // Also update the .env file if possible
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    let envContent = fs.readFileSync(envPath, 'utf8');
    envContent = envContent.replace(
      /COZE_API_TOKEN=.*/,
      `COZE_API_TOKEN=${token}`
    );
    fs.writeFileSync(envPath, envContent, 'utf8');
    console.log('[Renewal] Updated .env file with new token');
  }
}

/**
 * Main renewal function
 */
async function renewToken() {
  console.log('[Renewal] ========================================');
  console.log('[Renewal] Starting Coze PAT token renewal...');
  console.log(`[Renewal] Time: ${new Date().toISOString()}`);
  console.log('[Renewal] ========================================');
  
  let browser;
  try {
    // Persist Chrome profile for cookie survival across runs
    const PROFILE_DIR = '/data/chrome-profile';
    try {
      if (!fs.existsSync(PROFILE_DIR)) {
        fs.mkdirSync(PROFILE_DIR, { recursive: true });
        console.log(`[Renewal] Created profile dir: ${PROFILE_DIR}`);
      }
    } catch (e) {
      console.warn(`[Renewal] Cannot create ${PROFILE_DIR}, using temp dir. Cookies WON'T persist!`, e.message);
    }
    
    // Launch Puppeteer
    const launchOptions = {
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process',
      ],
      userDataDir: PROFILE_DIR
    };
    
    // On Railway/Nixpacks, chromium is at /usr/bin/chromium
    if (fs.existsSync('/usr/bin/chromium')) {
      launchOptions.executablePath = '/usr/bin/chromium';
    } else if (fs.existsSync('/usr/bin/chromium-browser')) {
      launchOptions.executablePath = '/usr/bin/chromium-browser';
    }
    
    console.log('[Renewal] Launching browser (userDataDir: ' + PROFILE_DIR + ')...');
    browser = await puppeteer.launch(launchOptions);
    
    // Login to Coze
    const page = await loginToCoze(browser);
    
    // Create new token
    const newToken = await createNewToken(page);
    
    // Save token
    saveToken(newToken);
    
    console.log('[Renewal] ========================================');
    console.log('[Renewal] Token renewal SUCCESS');
    console.log(`[Renewal] New token: ${newToken.substring(0, 20)}...`);
    console.log('[Renewal] ========================================');
    
    // Update runtime env var (so current process uses new token)
    process.env.COZE_API_TOKEN = newToken;
    
    return { success: true, token: newToken };
    
  } catch (error) {
    console.error('[Renewal] ========================================');
    console.error('[Renewal] Token renewal FAILED:', error.message);
    console.error('[Renewal] ========================================');
    return { success: false, error: error.message };
  } finally {
    if (browser) {
      await browser.close();
      console.log('[Renewal] Browser closed.');
    }
  }
}

// Run if called directly
if (require.main === module) {
  renewToken().then(result => {
    if (result.success) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  }).catch(err => {
    console.error('Unhandled error:', err);
    process.exit(1);
  });
}

module.exports = { renewToken };
