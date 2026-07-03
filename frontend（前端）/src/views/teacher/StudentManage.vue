<template>
  <div class="student-manage">
    <!-- 顶部：课程选择 + 操作栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <el-select
          v-model="selectedCourseId"
          placeholder="请选择课程"
          style="width: 280px"
          filterable
          @change="onCourseChange"
        >
          <el-option
            v-for="c in courseOptions"
            :key="c.id"
            :label="`${c.name}（${c.semester ?? ''}）`"
            :value="c.id"
          />
        </el-select>
      </div>
      <div class="toolbar-right" v-if="selectedCourseId">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索学号/姓名"
          :prefix-icon="Search"
          clearable
          style="width: 200px"
          @keyup.enter="handleSearch"
        />
        <el-button type="primary" @click="handleSearch">查询</el-button>
        <el-button @click="handleDownloadTemplate">
          <el-icon style="margin-right:4px"><Download /></el-icon>下载模板
        </el-button>
        <el-button type="success" @click="openImportDialog">
          <el-icon style="margin-right:4px"><Upload /></el-icon>Excel导入
        </el-button>
      </div>
    </div>

    <!-- 学生表格 -->
    <el-table
      v-loading="loading"
      :data="studentList"
      stripe
      border
      style="width: 100%"
      empty-text="请选择课程查看学生列表"
    >
      <el-table-column prop="username" label="学号" width="140" />
      <el-table-column prop="realName" label="姓名" width="100" />
      <el-table-column prop="className" label="班级" min-width="160">
        <template #default="{ row }">
          <span>{{ row.className || '-' }}</span>
          <el-button
            link type="primary" size="small"
            style="margin-left:6px"
            @click="openEditClass(row)"
          >
            修改
          </el-button>
        </template>
      </el-table-column>
      <el-table-column prop="department" label="院系" width="140" show-overflow-tooltip />
      <el-table-column label="状态" width="80" align="center">
        <template #default="{ row }">
          <el-tag :type="row.status === 1 ? 'success' : 'danger'" size="small">
            {{ row.status === 1 ? '正常' : '禁用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="答题次数" width="90" align="center">
        <template #default="{ row }">{{ row.quizCount ?? 0 }}</template>
      </el-table-column>
      <el-table-column label="正确率" width="90" align="center">
        <template #default="{ row }">
          <span :class="rateClass(row.correctRate)">{{ row.correctRate ?? 0 }}%</span>
        </template>
      </el-table-column>
      <el-table-column label="提问次数" width="90" align="center">
        <template #default="{ row }">{{ row.chatCount ?? 0 }}</template>
      </el-table-column>
      <el-table-column prop="lastLoginAt" label="最后活跃" width="160" />
      <el-table-column prop="enrolledAt" label="加入时间" width="160" />
      <el-table-column label="操作" width="180" align="center" fixed="right">
        <template #default="{ row }">
          <el-button link type="warning" size="small" @click="handleResetPwd(row)">
            重置密码
          </el-button>
          <el-button link type="danger" size="small" @click="handleDelete(row)">
            移除
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 分页 -->
    <div class="pagination-wrapper" v-if="selectedCourseId">
      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :page-sizes="[10, 20, 50]"
        :total="pagination.total"
        layout="total, sizes, prev, pager, next"
        @change="fetchStudentList"
      />
    </div>

    <!-- Excel 导入对话框 -->
    <el-dialog
      v-model="importDialogVisible"
      title="Excel 批量导入学生"
      width="580px"
      :close-on-click-modal="false"
      destroy-on-close
      @closed="resetImportState"
    >
      <!-- 上传步骤 -->
      <div v-if="!importResult">
        <el-alert
          title="提示"
          type="info"
          :closable="false"
          show-icon
          style="margin-bottom:16px"
        >
          请使用标准模板，包含「学号」「姓名」「班级」三列。未创建的学生账号将自动创建，初始密码为系统默认密码。
        </el-alert>
        <el-upload
          ref="uploadRef"
          drag
          :auto-upload="false"
          :limit="1"
          accept=".xlsx"
          :on-change="handleFileChange"
          :on-remove="handleFileRemove"
          :file-list="fileList"
        >
          <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
          <div class="el-upload__text">
            将 Excel 文件拖到此处，或<em>点击上传</em>
          </div>
          <template #tip>
            <div class="el-upload__tip">
              仅支持 .xlsx 格式，文件大小不超过 20MB，最多 5000 行
            </div>
          </template>
        </el-upload>
      </div>

      <!-- 导入结果 -->
      <div v-else>
        <el-result
          :icon="importResult.failCount === 0 ? 'success' : 'warning'"
          :title="`导入完成`"
        >
          <template #sub-title>
            <div class="import-summary">
              <p>总行数：{{ importResult.totalRows }}，成功：{{ importResult.successCount }}，新增账号：{{ importResult.newAccounts }}</p>
              <p v-if="importResult.failCount > 0" style="color:#e6a23c">
                失败：{{ importResult.failCount }} 条
              </p>
            </div>

            <!-- 失败明细 -->
            <el-table
              v-if="importResult.failDetails && importResult.failDetails.length > 0"
              :data="importResult.failDetails"
              border
              size="small"
              max-height="200"
              style="margin-top:12px"
            >
              <el-table-column prop="row" label="行号" width="60" align="center" />
              <el-table-column prop="username" label="学号" width="140" />
              <el-table-column prop="reason" label="失败原因" show-overflow-tooltip />
            </el-table>
          </template>
        </el-result>
      </div>

      <template #footer>
        <div v-if="!importResult">
          <el-button @click="importDialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="importLoading" @click="handleImport">
            开始导入
          </el-button>
        </div>
        <div v-else>
          <el-button type="primary" @click="onImportDone">完成</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 修改班级对话框 -->
    <el-dialog
      v-model="classDialogVisible"
      title="修改班级"
      width="400px"
      :close-on-click-modal="false"
    >
      <el-form :model="classForm" label-width="80px">
        <el-form-item label="学号">
          <span>{{ currentStudent?.username }}</span>
        </el-form-item>
        <el-form-item label="姓名">
          <span>{{ currentStudent?.realName }}</span>
        </el-form-item>
        <el-form-item label="班级" prop="className">
          <el-input
            v-model="classForm.className"
            placeholder="请输入班级名称"
            maxlength="100"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="classDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="classLoading" @click="handleUpdateClass">
          保存
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Download, Upload, UploadFilled } from '@element-plus/icons-vue'
import { getCourses } from '@/api/course'
import {
  getStudentsByCourse,
  removeStudentFromCourse,
  importStudents,
  downloadImportTemplate,
  resetStudentPassword,
  updateStudentClass
} from '@/api/student'

// --- 课程选择 ---
const selectedCourseId = ref(null)
const courseOptions = ref([])

const fetchCourses = async () => {
  try {
    const res = await getCourses({ pageSize: 100 })
    courseOptions.value = res.data.records
  } catch {}
}

// --- 学生列表 ---
const loading = ref(false)
const studentList = ref([])
const searchKeyword = ref('')

const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0
})

const rateClass = (rate) => {
  const r = parseFloat(rate)
  if (r >= 80) return 'rate-high'
  if (r >= 60) return 'rate-mid'
  return 'rate-low'
}

const fetchStudentList = async () => {
  if (!selectedCourseId.value) return
  loading.value = true
  try {
    const params = {
      page: pagination.page,
      pageSize: pagination.pageSize
    }
    if (searchKeyword.value) params.keyword = searchKeyword.value

    const res = await getStudentsByCourse(selectedCourseId.value, params)
    studentList.value = res.data.records
    pagination.total = res.data.total
  } catch {
  } finally {
    loading.value = false
  }
}

const onCourseChange = () => {
  pagination.page = 1
  searchKeyword.value = ''
  fetchStudentList()
}

const handleSearch = () => {
  pagination.page = 1
  fetchStudentList()
}

// --- 移除学生 ---
const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm(
      `确定要将「${row.realName}（${row.username}）」从课程中移除吗？学生的历史学习数据将保留。`,
      '确认移除',
      { type: 'warning', confirmButtonText: '确定移除', cancelButtonText: '取消' }
    )
    await removeStudentFromCourse(selectedCourseId.value, row.id)
    ElMessage.success('已从课程移除')
    fetchStudentList()
  } catch {}
}

// --- 重置密码 ---
const handleResetPwd = async (row) => {
  try {
    await ElMessageBox.confirm(
      `确定要重置「${row.realName}（${row.username}）」的密码吗？密码将重置为系统默认初始密码。`,
      '确认重置密码',
      { type: 'warning', confirmButtonText: '确定', cancelButtonText: '取消' }
    )
    const res = await resetStudentPassword(row.id)
    ElMessage.success(`密码已重置为：${res.data.defaultPassword}，请告知学生登录后修改`)
    fetchStudentList()
  } catch {}
}

// --- 下载模板 ---
const handleDownloadTemplate = async () => {
  try {
    const res = await downloadImportTemplate()
    // blob 下载
    const url = window.URL.createObjectURL(new Blob([res]))
    const link = document.createElement('a')
    link.href = url
    link.download = 'student_import_template.xlsx'
    link.click()
    window.URL.revokeObjectURL(url)
    ElMessage.success('模板下载成功')
  } catch {}
}

// --- Excel 导入 ---
const importDialogVisible = ref(false)
const importLoading = ref(false)
const fileList = ref([])
const importResult = ref(null)
const uploadRef = ref(null)

const openImportDialog = () => {
  if (!selectedCourseId.value) {
    ElMessage.warning('请先选择课程')
    return
  }
  importDialogVisible.value = true
}

const handleFileChange = (file) => {
  fileList.value = [file]
}

const handleFileRemove = () => {
  fileList.value = []
}

const resetImportState = () => {
  importResult.value = null
  fileList.value = []
}

const handleImport = async () => {
  if (fileList.value.length === 0) {
    ElMessage.warning('请选择要上传的 Excel 文件')
    return
  }

  const formData = new FormData()
  formData.append('file', fileList.value[0].raw)

  importLoading.value = true
  try {
    const res = await importStudents(selectedCourseId.value, formData)
    importResult.value = res.data
    if (res.data.failCount === 0) {
      ElMessage.success(`全部导入成功！共 ${res.data.successCount} 条`)
    }
  } catch {
    importResult.value = null
  } finally {
    importLoading.value = false
  }
}

const onImportDone = () => {
  importDialogVisible.value = false
  fetchStudentList()
}

// --- 修改班级 ---
const classDialogVisible = ref(false)
const classLoading = ref(false)
const currentStudent = ref(null)
const classForm = reactive({ className: '' })

const openEditClass = (row) => {
  currentStudent.value = row
  classForm.className = row.className || ''
  classDialogVisible.value = true
}

const handleUpdateClass = async () => {
  if (!currentStudent.value) return
  classLoading.value = true
  try {
    await updateStudentClass(currentStudent.value.id, classForm.className)
    ElMessage.success('班级信息更新成功')
    classDialogVisible.value = false
    fetchStudentList()
  } catch {} finally {
    classLoading.value = false
  }
}

// --- 初始化 ---
onMounted(() => {
  fetchCourses()
})
</script>

<style lang="scss" scoped>
.student-manage {
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

.rate-high {
  color: #22A699;
  font-weight: 600;
}
.rate-mid {
  color: #e6a23c;
  font-weight: 600;
}
.rate-low {
  color: #f56c6c;
  font-weight: 600;
}

.pagination-wrapper {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

.import-summary {
  text-align: center;
  p {
    margin: 4px 0;
    font-size: 14px;
  }
}
</style>
