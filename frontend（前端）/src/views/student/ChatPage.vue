<template>
  <div class="chat-page">
    <!-- 左侧栏：课程选择 + 会话列表 -->
    <div class="chat-sidebar">
      <!-- 课程选择 -->
      <div class="sidebar-course">
        <el-select
          v-model="selectedCourseId"
          placeholder="选择课程"
          style="width: 100%"
          filterable
          @change="onCourseChange"
        >
          <el-option
            v-for="c in courseOptions"
            :key="c.id"
            :label="c.name"
            :value="c.id"
          />
        </el-select>
      </div>

      <!-- 新建对话按钮 -->
      <div class="sidebar-new-chat">
        <el-button
          type="primary"
          :icon="Plus"
          style="width: 100%"
          :disabled="!selectedCourseId"
          @click="startNewChat"
        >
          新建对话
        </el-button>
      </div>

      <!-- 会话列表 -->
      <div class="sidebar-sessions" v-loading="sessionLoading">
        <div
          v-for="s in sessions"
          :key="s.sessionId"
          class="session-item"
          :class="{ active: currentSessionId === s.sessionId }"
          @click="switchSession(s)"
        >
          <div class="session-title">{{ s.title || '新对话' }}</div>
          <div class="session-meta">
            <span>{{ s.messageCount }} 条消息</span>
            <el-popconfirm
              title="确定删除该对话？"
              width="200"
              @confirm="handleDeleteSession(s.sessionId, $event)"
            >
              <template #reference>
                <el-button
                  link
                  class="session-delete"
                  @click.stop
                >
                  <el-icon><Delete /></el-icon>
                </el-button>
              </template>
            </el-popconfirm>
          </div>
        </div>

        <!-- 分页 -->
        <div class="session-pagination" v-if="sessionTotal > sessionPageSize">
          <el-pagination
            small
            layout="prev, next"
            :page-size="sessionPageSize"
            :total="sessionTotal"
            :current-page="sessionPage"
            @current-change="onSessionPageChange"
          />
        </div>

        <el-empty
          v-if="!sessionLoading && sessions.length === 0 && selectedCourseId"
          description="暂无对话记录"
          :image-size="60"
        />
      </div>
    </div>

    <!-- 右侧：聊天主区域 -->
    <div class="chat-main">
      <!-- 无选中会话时的占位 -->
      <div v-if="!currentSessionId" class="chat-empty">
        <el-empty
          :description="selectedCourseId ? '请选择或创建一个对话' : '请先选择课程'"
          :image-size="80"
        />
      </div>

      <!-- 消息区域 -->
      <template v-else>
        <!-- 会话标题栏 -->
        <div class="chat-header">
          <span class="chat-title">{{ currentSession?.title || '对话' }}</span>
        </div>

        <!-- 消息列表 -->
        <div class="chat-messages" ref="messagesContainer">
          <div
            v-for="(msg, idx) in messages"
            :key="idx"
            class="message-item"
            :class="msg.role"
          >
            <div class="message-avatar">
              <el-avatar
                v-if="msg.role === 'user'"
                :icon="UserFilled"
                size="small"
              />
              <el-avatar
                v-else
                :icon="Service"
                size="small"
                style="background:#22A699"
              />
            </div>
            <div class="message-body">
              <div class="message-header">
                <span class="message-role">{{ msg.role === 'user' ? '我' : 'AI助教' }}</span>
                <span class="message-time">{{ formatTime(msg.createdAt) }}</span>
              </div>
              <div class="message-content" v-html="renderContent(msg.content)" />
              <!-- 引用来源 -->
              <div v-if="msg.metadata?.references?.length" class="message-references">
                <div class="ref-title">📚 参考资料：</div>
                <div
                  v-for="(ref, ri) in msg.metadata.references"
                  :key="ri"
                  class="ref-item"
                >
                  {{ ref.fileName || ref }}
                </div>
              </div>
            </div>
          </div>

          <!-- AI 思考中 -->
          <div v-if="aiThinking" class="message-item assistant">
            <div class="message-avatar">
              <el-avatar :icon="Service" size="small" style="background:#22A699" />
            </div>
            <div class="message-body">
              <div class="message-content thinking">
                <span class="dot-pulse"></span> AI助教思考中...
              </div>
            </div>
          </div>
        </div>

        <!-- 输入区域 -->
        <div class="chat-input-area">
          <el-input
            v-model="inputText"
            type="textarea"
            :rows="3"
            :maxlength="2000"
            show-word-limit
            placeholder="输入您的问题... (Enter 发送，Shift+Enter 换行)"
            @keydown.enter.exact="handleSend"
            :disabled="aiThinking"
          />
          <div class="input-actions">
            <span class="char-count">{{ inputText.length }}/2000</span>
            <el-button
              type="primary"
              :icon="Promotion"
              :loading="aiThinking"
              :disabled="!inputText.trim()"
              @click="handleSend"
            >
              发送
            </el-button>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus, Delete, UserFilled, Service, Promotion } from '@element-plus/icons-vue'
import { getCourses } from '@/api/course'
import { sendMessage, getSessions, getSessionMessages, deleteSession } from '@/api/chat'

// --- 课程选择 ---
const selectedCourseId = ref(null)
const courseOptions = ref([])

const fetchCourses = async () => {
  try {
    const res = await getCourses({ pageSize: 100, status: 1 })
    courseOptions.value = res.data.records
  } catch {}
}

// --- 会话列表 ---
const sessions = ref([])
const sessionLoading = ref(false)
const sessionPage = ref(1)
const sessionPageSize = ref(20)
const sessionTotal = ref(0)
const currentSessionId = ref(null)
const currentSession = ref(null)

const fetchSessions = async () => {
  if (!selectedCourseId.value) {
    sessions.value = []
    return
  }
  sessionLoading.value = true
  try {
    const res = await getSessions({
      courseId: selectedCourseId.value,
      page: sessionPage.value,
      pageSize: sessionPageSize.value
    })
    sessions.value = res.data.records
    sessionTotal.value = res.data.total
  } catch {} finally {
    sessionLoading.value = false
  }
}

const onSessionPageChange = (page) => {
  sessionPage.value = page
  fetchSessions()
}

const onCourseChange = () => {
  currentSessionId.value = null
  currentSession.value = null
  messages.value = []
  sessionPage.value = 1
  fetchSessions()
}

// --- 消息 ---
const messages = ref([])
const inputText = ref('')
const aiThinking = ref(false)
const messagesContainer = ref(null)

const scrollToBottom = async () => {
  await nextTick()
  const el = messagesContainer.value
  if (el) {
    el.scrollTop = el.scrollHeight
  }
}

// 切换会话
const switchSession = async (session) => {
  currentSessionId.value = session.sessionId
  currentSession.value = session
  messages.value = []
  try {
    const res = await getSessionMessages(session.sessionId)
    messages.value = res.data.messages || []
    await scrollToBottom()
  } catch {}
}

// 新建对话
const startNewChat = () => {
  currentSessionId.value = null
  currentSession.value = null
  messages.value = []
  inputText.value = ''
}

// 发送消息
const handleSend = async () => {
  const text = inputText.value.trim()
  if (!text || !selectedCourseId.value || aiThinking.value) return

  // 立即显示用户消息
  const userMsg = {
    role: 'user',
    content: text,
    createdAt: new Date().toISOString()
  }
  messages.value.push(userMsg)
  inputText.value = ''

  aiThinking.value = true
  await scrollToBottom()

  try {
    const res = await sendMessage({
      courseId: selectedCourseId.value,
      question: text,
      sessionId: currentSessionId.value || undefined
    })

    // 如果是新会话，更新 sessionId
    if (!currentSessionId.value) {
      currentSessionId.value = res.data.sessionId
    }

    // 添加 AI 回复
    const aiMsg = {
      role: 'assistant',
      content: res.data.answer,
      metadata: { references: res.data.references || [] },
      createdAt: res.data.createdAt || new Date().toISOString()
    }
    messages.value.push(aiMsg)
    await scrollToBottom()

    // 刷新会话列表（标题可能更新）
    fetchSessions()
  } catch {} finally {
    aiThinking.value = false
  }
}

// 删除会话
const handleDeleteSession = async (sessionId) => {
  try {
    await deleteSession(sessionId)
    ElMessage.success('已删除')
    if (currentSessionId.value === sessionId) {
      startNewChat()
    }
    fetchSessions()
  } catch {}
}

// 格式化时间
const formatTime = (dateStr) => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// 简单 Markdown 渲染（换行 → <br>）
const renderContent = (content) => {
  if (!content) return ''
  return content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')
}

// --- 初始化 ---
onMounted(() => {
  fetchCourses()
})
</script>

<style lang="scss" scoped>
.chat-page {
  display: flex;
  height: calc(100vh - 40px);
  margin: 20px;
  background: #fff;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

// ======== 左侧栏 ========
.chat-sidebar {
  width: 280px;
  min-width: 280px;
  border-right: 1px solid #ebeef5;
  display: flex;
  flex-direction: column;
  background: #fafbfc;
}

.sidebar-course {
  padding: 16px 12px 8px;
}

.sidebar-new-chat {
  padding: 0 12px 8px;
}

.sidebar-sessions {
  flex: 1;
  overflow-y: auto;
  padding: 0 8px;
}

.session-item {
  padding: 10px 8px;
  border-radius: 6px;
  cursor: pointer;
  margin-bottom: 4px;
  transition: background 0.15s;

  &:hover {
    background: #e8f0fe;
  }
  &.active {
    background: #d4e5fd;
  }
}

.session-title {
  font-size: 14px;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 4px;
}

.session-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: #909399;

  .session-delete {
    padding: 0;
    color: #c0c4cc;
    &:hover { color: #f56c6c; }
  }
}

.session-pagination {
  padding: 8px 0;
  display: flex;
  justify-content: center;
}

// ======== 右侧主区域 ========
.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.chat-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.chat-header {
  padding: 12px 20px;
  border-bottom: 1px solid #ebeef5;
  background: #fff;
  .chat-title {
    font-size: 15px;
    font-weight: 500;
    color: #303133;
  }
}

// 消息区域
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
  background: #f5f7fa;
}

.message-item {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;

  &.user {
    flex-direction: row-reverse;
    .message-body {
      align-items: flex-end;
      .message-content {
        background: #1A5F7A;
        color: #fff;
      }
    }
    .message-header {
      flex-direction: row-reverse;
    }
  }

  &.assistant {
    .message-content {
      background: #fff;
      color: #303133;
      border: 1px solid #e4e7ed;
    }
  }
}

.message-avatar {
  flex-shrink: 0;
  padding-top: 2px;
}

.message-body {
  display: flex;
  flex-direction: column;
  max-width: 75%;
}

.message-header {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 4px;
  font-size: 12px;

  .message-role {
    color: #606266;
    font-weight: 500;
  }
  .message-time {
    color: #c0c4cc;
  }
}

.message-content {
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.7;
  word-break: break-word;

  &.thinking {
    background: #fff;
    color: #909399;
    font-style: italic;
  }
}

// 参考资料
.message-references {
  margin-top: 8px;
  padding: 8px 10px;
  background: #fafbfc;
  border-radius: 6px;
  font-size: 12px;

  .ref-title {
    color: #909399;
    margin-bottom: 4px;
  }
  .ref-item {
    color: #22A699;
    padding: 2px 0;
    &::before { content: '• '; }
  }
}

// 输入区域
.chat-input-area {
  padding: 12px 20px;
  border-top: 1px solid #ebeef5;
  background: #fff;

  :deep(.el-textarea__inner) {
    resize: none;
  }
}

.input-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;

  .char-count {
    font-size: 12px;
    color: #c0c4cc;
  }
}

// 思考动画
.dot-pulse {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #909399;
  margin-right: 6px;
  animation: pulse 1.2s infinite ease-in-out;
}
@keyframes pulse {
  0%, 100% { opacity: 0.3; transform: scale(0.8); }
  50% { opacity: 1; transform: scale(1.1); }
}
</style>
