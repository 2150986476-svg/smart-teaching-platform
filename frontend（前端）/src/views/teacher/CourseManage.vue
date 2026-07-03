<template>
  <div class="course-manage">
    <!-- 顶部操作栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <el-button type="primary" :icon="Plus" @click="openCreateDialog">
          新增课程
        </el-button>
      </div>
      <div class="toolbar-right">
        <el-input
          v-model="searchForm.keyword"
          placeholder="搜索课程名称"
          :prefix-icon="Search"
          clearable
          style="width: 220px"
          @keyup.enter="handleSearch"
        />
        <el-select
          v-model="searchForm.semester"
          placeholder="选择学期"
          clearable
          style="width: 180px"
        >
          <el-option
            v-for="s in semesterOptions"
            :key="s"
            :label="s"
            :value="s"
          />
        </el-select>
        <el-select
          v-model="searchForm.status"
          placeholder="课程状态"
          clearable
          style="width: 140px"
        >
          <el-option label="待发布" :value="0" />
          <el-option label="已发布" :value="1" />
          <el-option label="已结束" :value="2" />
        </el-select>
        <el-button type="primary" @click="handleSearch">查询</el-button>
        <el-button @click="handleReset">重置</el-button>
      </div>
    </div>

    <!-- 课程列表 -->
    <el-table
      v-loading="loading"
      :data="courseList"
      stripe
      border
      style="width: 100%"
      empty-text="暂无课程数据"
    >
      <el-table-column prop="id" label="ID" width="70" align="center" />
      <el-table-column prop="name" label="课程名称" min-width="180">
        <template #default="{ row }">
          <div class="course-name-cell">
            <el-avatar
              v-if="row.coverImage"
              :src="row.coverImage"
              shape="square"
              size="small"
            />
            <span>{{ row.name }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="teacherName" label="授课教师" width="120" />
      <el-table-column prop="semester" label="开课学期" width="130" />
      <el-table-column prop="classInfo" label="班级" width="160" show-overflow-tooltip />
      <el-table-column label="状态" width="90" align="center">
        <template #default="{ row }">
          <el-tag :type="statusTagType(row.status)" size="small">
            {{ statusLabel(row.status) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="学生数" width="80" align="center">
        <template #default="{ row }">
          {{ row.studentCount ?? 0 }}
        </template>
      </el-table-column>
      <el-table-column label="资料数" width="80" align="center">
        <template #default="{ row }">
          {{ row.materialCount ?? 0 }}
        </template>
      </el-table-column>
      <el-table-column label="AI助教" width="140" show-overflow-tooltip>
        <template #default="{ row }">
          <span v-if="row.assistantName && row.assistantActive === 1" class="assistant-on">
            {{ row.assistantName }}
          </span>
          <span v-else class="assistant-off">未绑定</span>
        </template>
      </el-table-column>
      <el-table-column prop="createdAt" label="创建时间" width="170" />
      <el-table-column label="操作" width="290" align="center" fixed="right">
        <template #default="{ row }">
          <el-button link type="warning" size="small" @click="openSyncDialog(row)">
            同步AI
          </el-button>
          <el-button link type="primary" size="small" @click="openEditDialog(row)">
            编辑
          </el-button>
          <el-button
            v-if="row.status === 0"
            link type="success" size="small" @click="publishCourse(row)"
          >
            发布
          </el-button>
          <el-button
            v-if="row.status === 1"
            link type="warning" size="small" @click="finishCourse(row)"
          >
            结束
          </el-button>
          <el-button link type="danger" size="small" @click="handleDelete(row)">
            删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 分页 -->
    <div class="pagination-wrapper">
      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :page-sizes="[10, 20, 50]"
        :total="pagination.total"
        layout="total, sizes, prev, pager, next"
        @change="fetchCourseList"
      />
    </div>

    <!-- 新建/编辑课程对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="680px"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="100px"
        label-position="right"
      >
        <el-tabs v-model="activeTab">
          <!-- 基本信息 -->
          <el-tab-pane label="基本信息" name="basic">
            <el-form-item label="课程名称" prop="name">
              <el-input v-model="form.name" placeholder="请输入课程名称（2-50字）" maxlength="50" />
            </el-form-item>
            <el-form-item label="开课学期" prop="semester">
              <el-input v-model="form.semester" placeholder='如 "2026-2027-1"' maxlength="50" />
            </el-form-item>
            <el-form-item label="班级信息" prop="classInfo">
              <el-input v-model="form.classInfo" placeholder='如 "计算机学院2024级1班"' maxlength="200" />
            </el-form-item>
            <el-form-item label="课程状态" prop="status" v-if="isEdit">
              <el-radio-group v-model="form.status">
                <el-radio :value="0">待发布</el-radio>
                <el-radio :value="1">已发布</el-radio>
                <el-radio :value="2">已结束</el-radio>
              </el-radio-group>
            </el-form-item>
            <el-form-item label="课程描述" prop="description">
              <el-input
                v-model="form.description"
                type="textarea"
                :rows="4"
                placeholder="请输入课程描述（支持后续富文本）"
                maxlength="2000"
                show-word-limit
              />
            </el-form-item>
          </el-tab-pane>

          <!-- AI 助教配置 -->
          <el-tab-pane label="AI 助教配置" name="assistant">
            <el-form-item label="Coze Bot ID" prop="aiAssistant.cozeBotId">
              <el-input
                v-model="form.aiAssistant.cozeBotId"
                placeholder="请输入 Coze Bot ID"
                clearable
              />
            </el-form-item>
            <el-form-item label="助教名称">
              <el-input
                v-model="form.aiAssistant.assistantName"
                placeholder="默认：AI助教"
                maxlength="50"
              />
            </el-form-item>
            <el-form-item label="欢迎语">
              <el-input
                v-model="form.aiAssistant.welcomeMessage"
                type="textarea"
                :rows="2"
                placeholder="请输入欢迎语"
                maxlength="500"
                show-word-limit
              />
            </el-form-item>
            <el-form-item label="系统 Prompt">
              <el-input
                v-model="form.aiAssistant.systemPrompt"
                type="textarea"
                :rows="3"
                placeholder="自定义系统提示词（可选）"
                maxlength="2000"
                show-word-limit
              />
            </el-form-item>
            <el-row :gutter="20">
              <el-col :span="12">
                <el-form-item label="回答温度">
                  <el-slider
                    v-model="form.aiAssistant.temperature"
                    :min="0"
                    :max="1"
                    :step="0.1"
                    show-input
                    :format-tooltip="(v) => v.toFixed(1)"
                  />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="最大Token">
                  <el-input-number
                    v-model="form.aiAssistant.maxTokens"
                    :min="256"
                    :max="8192"
                    :step="256"
                    controls-position="right"
                  />
                </el-form-item>
              </el-col>
            </el-row>
            <el-form-item label="启用状态" v-if="isEdit">
              <el-switch
                v-model="form.aiAssistant.isActive"
                active-text="启用"
                inactive-text="禁用"
              />
            </el-form-item>
          </el-tab-pane>
        </el-tabs>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="handleSubmit">
          {{ isEdit ? '保存修改' : '创建课程' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 同步AI对话框 -->
    <el-dialog
      v-model="syncDialogVisible"
      title="同步AI知识库"
      width="560px"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <div v-if="syncStep === 'confirm'" class="sync-confirm">
        <el-alert
          title="即将同步课程资料到 Coze 知识库"
          type="info"
          :closable="false"
          show-icon
          style="margin-bottom: 16px"
        >
          <template #default>
            <p style="margin: 4px 0; line-height: 1.8">
              课程：<strong>{{ syncingCourse?.name }}</strong>
            </p>
            <p style="margin: 4px 0; line-height: 1.8">
              资料数：<strong>{{ syncingCourse?.materialCount ?? 0 }}</strong> 个文件
            </p>
            <p style="margin: 4px 0; line-height: 1.8">
              操作内容：将课程下所有 PDF / Word / PPT / Markdown 资料上传至 Coze，建立AI知识库
            </p>
          </template>
        </el-alert>
        <el-text type="warning" size="small">
          同步过程可能需要数分钟，请耐心等待。已有知识库将会更新覆盖。
        </el-text>
      </div>

      <div v-else-if="syncStep === 'syncing'" class="sync-progress">
        <div class="sync-spinner">
          <el-icon class="is-loading" :size="48"><Loading /></el-icon>
        </div>
        <p class="sync-text">正在同步课程资料到 Coze 知识库...</p>
        <el-text type="info" size="small">请勿关闭此窗口</el-text>
      </div>

      <div v-else-if="syncStep === 'done'" class="sync-result">
        <div class="result-icon" :class="syncResult.failed === 0 ? 'success' : 'partial'">
          {{ syncResult.failed === 0 ? '✅' : '⚠️' }}
        </div>
        <div class="result-stats">
          <div class="stat-item">
            <span class="stat-num">{{ syncResult.total }}</span>
            <span class="stat-label">总文件数</span>
          </div>
          <div class="stat-item success">
            <span class="stat-num">{{ syncResult.success }}</span>
            <span class="stat-label">成功</span>
          </div>
          <div class="stat-item" :class="{ danger: syncResult.failed > 0 }">
            <span class="stat-num">{{ syncResult.failed }}</span>
            <span class="stat-label">失败</span>
          </div>
        </div>
        <div class="knowledge-id" v-if="syncResult.knowledgeId">
          <el-text type="info" size="small">知识库ID：{{ syncResult.knowledgeId }}</el-text>
        </div>
        <div v-if="syncResult.errors && syncResult.errors.length > 0" class="error-list">
          <p style="font-weight: 600; margin-bottom: 8px; color: #E65B3D;">失败详情：</p>
          <div
            v-for="(err, idx) in syncResult.errors"
            :key="idx"
            class="error-item"
          >
            <span class="error-file">{{ err.fileName }}</span>
            <span class="error-msg">{{ err.error }}</span>
          </div>
        </div>
      </div>

      <template #footer>
        <template v-if="syncStep === 'confirm'">
          <el-button @click="syncDialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="syncing" @click="startSync">开始同步</el-button>
        </template>
        <template v-else-if="syncStep === 'syncing'">
          <el-button disabled>同步中...</el-button>
        </template>
        <template v-else-if="syncStep === 'done'">
          <el-button type="primary" @click="closeSyncDialog">完成</el-button>
        </template>
      </template>
    </el-dialog>

  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search, Loading } from '@element-plus/icons-vue'
import { getCourses, getCourseById, createCourse, updateCourse, deleteCourse } from '@/api/course'
import { syncKnowledge } from '@/api/knowledge'

// --- 列表相关 ---
const loading = ref(false)
const courseList = ref([])

const searchForm = reactive({
  keyword: '',
  semester: '',
  status: ''
})

const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0
})

const semesterOptions = computed(() => {
  // 生成近几年的学期列表
  const options = []
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const startYear = year - 2
  for (let y = startYear; y <= year + 1; y++) {
    options.push(`${y}-${y + 1}-1`)
    options.push(`${y}-${y + 1}-2`)
  }
  return [...new Set(options)]
})

const statusLabel = (val) => {
  const map = { 0: '待发布', 1: '已发布', 2: '已结束' }
  return map[val] ?? '未知'
}
const statusTagType = (val) => {
  const map = { 0: 'info', 1: 'success', 2: 'warning' }
  return map[val] ?? 'info'
}

const fetchCourseList = async () => {
  loading.value = true
  try {
    const params = {
      page: pagination.page,
      pageSize: pagination.pageSize
    }
    if (searchForm.keyword) params.keyword = searchForm.keyword
    if (searchForm.semester) params.semester = searchForm.semester
    if (searchForm.status !== '' && searchForm.status !== undefined) {
      params.status = searchForm.status
    }

    const res = await getCourses(params)
    courseList.value = res.data.records
    pagination.total = res.data.total
  } catch {
    // 错误由拦截器处理
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  pagination.page = 1
  fetchCourseList()
}

const handleReset = () => {
  searchForm.keyword = ''
  searchForm.semester = ''
  searchForm.status = ''
  pagination.page = 1
  fetchCourseList()
}

// --- 快捷操作：发布 / 结束 ---
const publishCourse = async (row) => {
  try {
    await updateCourse(row.id, { status: 1 })
    ElMessage.success('课程已发布')
    fetchCourseList()
  } catch {}
}

const finishCourse = async (row) => {
  try {
    await updateCourse(row.id, { status: 2 })
    ElMessage.success('课程已结束')
    fetchCourseList()
  } catch {}
}

// --- 删除 ---
const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除课程「${row.name}」吗？删除后数据保留但不再展示。`,
      '确认删除',
      { type: 'warning', confirmButtonText: '确定删除', cancelButtonText: '取消' }
    )
    await deleteCourse(row.id)
    ElMessage.success('删除成功')
    fetchCourseList()
  } catch {
    // 取消删除
  }
}

// --- 同步AI相关 ---
const syncDialogVisible = ref(false)
const syncing = ref(false)
const syncingCourse = ref(null)
const syncStep = ref('confirm')  // confirm | syncing | done
const syncResult = ref({ total: 0, success: 0, failed: 0, errors: [], knowledgeId: '' })

const openSyncDialog = (row) => {
  syncingCourse.value = row
  syncStep.value = 'confirm'
  syncResult.value = { total: 0, success: 0, failed: 0, errors: [], knowledgeId: '' }
  syncDialogVisible.value = true
}

const startSync = async () => {
  syncing.value = true
  syncStep.value = 'syncing'
  try {
    const res = await syncKnowledge(syncingCourse.value.id)
    syncResult.value = {
      total: res.data.total || 0,
      success: res.data.success || 0,
      failed: res.data.failed || 0,
      errors: res.data.errors || [],
      knowledgeId: res.data.knowledgeId || ''
    }
    syncStep.value = 'done'
    ElMessage.success(res.message || '同步完成')
    fetchCourseList()
  } catch (err) {
    syncStep.value = 'done'
    const msg = err?.response?.data?.message || err?.message || '同步失败'
    syncResult.value = { total: 0, success: 0, failed: 1, errors: [{ fileName: '', error: msg }], knowledgeId: '' }
    ElMessage.error(msg)
  } finally {
    syncing.value = false
  }
}

const closeSyncDialog = () => {
  syncDialogVisible.value = false
  syncingCourse.value = null
}

// --- 对话框相关 ---
const dialogVisible = ref(false)
const isEdit = ref(false)
const submitLoading = ref(false)
const activeTab = ref('basic')
const formRef = ref(null)
const editingId = ref(null)

const dialogTitle = computed(() => (isEdit.value ? '编辑课程' : '新增课程'))

const getDefaultForm = () => ({
  name: '',
  description: '',
  semester: '',
  classInfo: '',
  status: 0,
  aiAssistant: {
    cozeBotId: '',
    assistantName: 'AI助教',
    welcomeMessage: '您好，我是本课程的AI助教，有什么可以帮助您的？',
    systemPrompt: '',
    temperature: 0.7,
    maxTokens: 2048,
    isActive: true
  }
})

const form = reactive(getDefaultForm())

// 粘贴 plain obj 到 reactive 的结构中
const patchForm = (data) => {
  form.name = data.name || ''
  form.description = data.description || ''
  form.semester = data.semester || ''
  form.classInfo = data.classInfo || ''
  form.status = data.status ?? 0

  if (data.aiAssistant) {
    form.aiAssistant.cozeBotId = data.aiAssistant.cozeBotId || ''
    form.aiAssistant.assistantName = data.aiAssistant.assistantName || 'AI助教'
    form.aiAssistant.welcomeMessage =
      data.aiAssistant.welcomeMessage || '您好，我是本课程的AI助教，有什么可以帮助您的？'
    form.aiAssistant.systemPrompt = data.aiAssistant.systemPrompt || ''
    form.aiAssistant.temperature = data.aiAssistant.temperature ?? 0.7
    form.aiAssistant.maxTokens = data.aiAssistant.maxTokens ?? 2048
    form.aiAssistant.isActive = data.aiAssistant.isActive !== 0
  } else {
    // 没有助教绑定时重置
    form.aiAssistant.cozeBotId = ''
    form.aiAssistant.assistantName = 'AI助教'
    form.aiAssistant.welcomeMessage = '您好，我是本课程的AI助教，有什么可以帮助您的？'
    form.aiAssistant.systemPrompt = ''
    form.aiAssistant.temperature = 0.7
    form.aiAssistant.maxTokens = 2048
    form.aiAssistant.isActive = true
  }
}

const rules = {
  name: [
    { required: true, message: '请输入课程名称', trigger: 'blur' },
    { min: 2, max: 50, message: '课程名称需为2-50字', trigger: 'blur' }
  ],
  semester: [
    { required: true, message: '请输入开课学期', trigger: 'blur' }
  ]
}

const openCreateDialog = () => {
  isEdit.value = false
  editingId.value = null
  activeTab.value = 'basic'

  // 重置表单
  Object.assign(form, getDefaultForm())
  formRef.value?.clearValidate()

  dialogVisible.value = true
}

const openEditDialog = async (row) => {
  isEdit.value = true
  editingId.value = row.id
  activeTab.value = 'basic'

  // 先填充基本信息
  patchForm(row)

  dialogVisible.value = true

  // 异步拉取详情（含 AI 助教绑定）
  try {
    const res = await getCourseById(row.id)
    patchForm(res.data)
  } catch {}
}

const handleSubmit = async () => {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) {
    activeTab.value = 'basic'
    return
  }

  submitLoading.value = true
  try {
    const payload = {
      name: form.name,
      description: form.description || null,
      semester: form.semester,
      classInfo: form.classInfo || null,
      status: isEdit.value ? form.status : undefined
    }

    // 如果填写了 Coze Bot ID，附带 AI 助教配置
    if (form.aiAssistant.cozeBotId) {
      payload.aiAssistant = {
        cozeBotId: form.aiAssistant.cozeBotId,
        assistantName: form.aiAssistant.assistantName,
        welcomeMessage: form.aiAssistant.welcomeMessage,
        systemPrompt: form.aiAssistant.systemPrompt || null,
        temperature: form.aiAssistant.temperature,
        maxTokens: form.aiAssistant.maxTokens,
        isActive: form.aiAssistant.isActive
      }
    }

    if (isEdit.value) {
      await updateCourse(editingId.value, payload)
      ElMessage.success('课程更新成功')
    } else {
      await createCourse(payload)
      ElMessage.success('课程创建成功')
    }

    dialogVisible.value = false
    fetchCourseList()
  } catch {
    // 错误由拦截器处理
  } finally {
    submitLoading.value = false
  }
}

// --- 初始化 ---
onMounted(() => {
  fetchCourseList()
})
</script>

<style lang="scss" scoped>
.course-manage {
  padding: 20px;
  background: #fff;
  border-radius: 8px;
  min-height: calc(100vh - 40px);
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;

  .toolbar-right {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
}

.course-name-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.assistant-on {
  color: #22A699;
  font-weight: 500;
}

.assistant-off {
  color: #c0c4cc;
  font-size: 13px;
}

.pagination-wrapper {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

// ========== 同步AI对话框样式 ==========
.sync-confirm {
  .el-alert p {
    margin: 2px 0;
    font-size: 14px;
  }
}

.sync-progress {
  text-align: center;
  padding: 40px 0 20px;

  .sync-spinner {
    margin-bottom: 20px;
    color: #1A5F7A;
  }

  .sync-text {
    font-size: 16px;
    color: #303133;
    margin-bottom: 8px;
  }
}

.sync-result {
  text-align: center;
  padding: 10px 0;

  .result-icon {
    font-size: 48px;
    margin-bottom: 16px;
  }

  .result-stats {
    display: flex;
    justify-content: center;
    gap: 32px;
    margin-bottom: 12px;

    .stat-item {
      text-align: center;

      .stat-num {
        display: block;
        font-size: 28px;
        font-weight: 700;
        color: #303133;
      }

      .stat-label {
        font-size: 13px;
        color: #909399;
      }

      &.success .stat-num { color: #22A699; }
      &.danger .stat-num { color: #E65B3D; }
    }
  }

  .knowledge-id {
    margin-bottom: 12px;
  }

  .error-list {
    text-align: left;
    max-height: 160px;
    overflow-y: auto;
    background: #FFF6F5;
    border-radius: 6px;
    padding: 12px;

    .error-item {
      display: flex;
      gap: 8px;
      padding: 4px 0;
      font-size: 13px;

      &:not(:last-child) {
        border-bottom: 1px dashed #fde2e0;
        margin-bottom: 4px;
        padding-bottom: 8px;
      }

      .error-file {
        color: #E65B3D;
        font-weight: 500;
        white-space: nowrap;
        flex-shrink: 0;
      }

      .error-msg {
        color: #666;
        word-break: break-all;
      }
    }
  }
}
</style>
