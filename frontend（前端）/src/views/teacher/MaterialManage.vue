<template>
  <div class="material-page">
    <!-- 课程选择 + 面包屑导航 -->
    <div class="page-top-bar">
      <el-select
        v-model="selectedCourseId"
        placeholder="选择课程管理资料"
        style="width: 300px"
        filterable
        @change="fetchMaterials"
      >
        <el-option
          v-for="c in courseOptions"
          :key="c.id"
          :label="c.name"
          :value="c.id"
        />
      </el-select>

      <el-button
        v-if="selectedCourseId"
        type="primary"
        :icon="Upload"
        @click="showUploadDialog = true"
      >
        上传资料
      </el-button>
    </div>

    <!-- 空态 -->
    <div v-if="!selectedCourseId" class="empty-box">
      <el-empty description="请选择课程，查看和管理该课程的教学资料" :image-size="80" />
    </div>

    <!-- 资料表格 -->
    <div v-else class="material-table-card">
      <div class="table-header">
        <h3>
          📁 课程资料
          <span class="course-name">{{ selectedCourse?.name || '' }}</span>
        </h3>
        <span class="table-count">共 {{ total }} 个文件</span>
      </div>

      <el-table
        :data="materials"
        stripe
        style="width: 100%"
        v-loading="loading"
        empty-text="暂无资料，请上传"
      >
        <!-- 文件图标 -->
        <el-table-column label="" width="50" align="center">
          <template #default="{ row }">
            <el-tag :type="fileTagType(row.fileType)" size="small">
              {{ row.fileType?.toUpperCase() }}
            </el-tag>
          </template>
        </el-table-column>

        <!-- 文件名 -->
        <el-table-column prop="fileName" label="文件名" min-width="240" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="file-name" :title="row.fileName">{{ row.fileName }}</span>
          </template>
        </el-table-column>

        <!-- 文件大小 -->
        <el-table-column prop="fileSizeFormatted" label="大小" width="100" align="center" />

        <!-- 上传者 -->
        <el-table-column prop="uploaderName" label="上传者" width="100" align="center" />

        <!-- 上传时间 -->
        <el-table-column label="上传时间" width="170" align="center">
          <template #default="{ row }">
            {{ row.uploadTime ? new Date(row.uploadTime).toLocaleString('zh-CN') : '' }}
          </template>
        </el-table-column>

        <!-- 操作 -->
        <el-table-column label="操作" width="220" align="center" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleDownload(row)">
              下载
            </el-button>
            <el-button link type="danger" size="small" @click="handleDelete(row)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="table-pagination" v-if="total > pageSize">
        <el-pagination
          small
          layout="prev, pager, next"
          :page-size="pageSize"
          :total="total"
          v-model:current-page="page"
          @current-change="fetchMaterials"
        />
      </div>
    </div>

    <!-- 上传弹窗 -->
    <el-dialog v-model="showUploadDialog" title="上传课程资料" width="520px" :close-on-click-modal="false">
      <el-upload
        ref="uploadRef"
        class="upload-area"
        drag
        :action="uploadUrl"
        :headers="uploadHeaders"
        :before-upload="beforeUpload"
        :on-success="onUploadSuccess"
        :on-error="onUploadError"
        :limit="5"
        multiple
        :auto-upload="false"
        accept=".pdf,.doc,.docx,.ppt,.pptx,.md,.txt"
      >
        <el-icon class="el-icon--upload"><upload-filled /></el-icon>
        <div class="el-upload__text">
          拖拽文件到此处 或 <em>点击选择</em>
        </div>
        <template #tip>
          <div class="el-upload__tip">
            支持 PDF、Word (.doc/.docx)、PPT (.ppt/.pptx)、Markdown (.md)、Txt (.txt)
            <br />单个文件最大 50MB
          </div>
        </template>
      </el-upload>

      <template #footer>
        <el-button @click="showUploadDialog = false">取消</el-button>
        <el-button type="primary" :loading="uploading" @click="submitUpload">
          开始上传
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Upload, UploadFilled } from '@element-plus/icons-vue'
import { getMaterials, uploadMaterial, deleteMaterial, downloadMaterial } from '@/api/material'
import { getCourses } from '@/api/course'
import { getToken } from '@/utils/auth'

// 课程选择
const selectedCourseId = ref(null)
const courseOptions = ref([])
const selectedCourse = computed(() =>
  courseOptions.value.find(c => c.id === selectedCourseId.value)
)

const fetchCourses = async () => {
  try {
    const res = await getCourses({ pageSize: 100 })
    courseOptions.value = res.data.records
  } catch {}
}

// 资料列表
const materials = ref([])
const loading = ref(false)
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)

const fetchMaterials = async () => {
  if (!selectedCourseId.value) { materials.value = []; return }
  loading.value = true
  try {
    const res = await getMaterials(selectedCourseId.value, {
      page: page.value,
      pageSize: pageSize.value
    })
    materials.value = res.data.records
    total.value = res.data.total
  } catch {} finally {
    loading.value = false
  }
}

// 文件类型标签颜色
const fileTagType = (type) => {
  const map = { pdf: 'danger', docx: 'primary', pptx: 'warning', md: 'success', txt: 'info' }
  return map[type] || 'info'
}

// 下载
const handleDownload = async (row) => {
  try {
    ElMessage.info('正在下载...')
    await downloadMaterial(selectedCourseId.value, row.id, row.fileName)
    ElMessage.success('下载成功')
  } catch {
    ElMessage.error('下载失败')
  }
}

// 删除
const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm(
      `确定删除资料「${row.fileName}」？删除后不可恢复。`,
      '删除确认',
      { type: 'warning' }
    )
    await deleteMaterial(selectedCourseId.value, row.id)
    ElMessage.success('已删除')
    fetchMaterials()
  } catch {}
}

// ========== 上传 ==========
const showUploadDialog = ref(false)
const uploadRef = ref(null)
const uploading = ref(false)

const uploadUrl = computed(() => {
  // 不走 axios，直接用 action 属性上传（因为需要 FormData + 手动触发）
  return ''
})

const uploadHeaders = computed(() => ({
  Authorization: `Bearer ${getToken()}`
}))

// 前端校验
const beforeUpload = (file) => {
  const ext = file.name.split('.').pop().toLowerCase()
  const allowedExts = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'md', 'txt']
  if (!allowedExts.includes(ext)) {
    ElMessage.error(`不支持的文件类型：.${ext}`)
    return false
  }
  const maxSize = 50 * 1024 * 1024
  if (file.size > maxSize) {
    ElMessage.error('文件大小超过 50MB 限制')
    return false
  }
  return true
}

// 手动上传（通过 axios 调用 API）
const submitUpload = async () => {
  const files = uploadRef.value?.uploadFiles || []
  if (files.length === 0) {
    ElMessage.warning('请选择文件')
    return
  }

  uploading.value = true
  let successCount = 0
  let failCount = 0

  for (const uploadFile of files) {
    if (uploadFile.status === 'success') continue
    try {
      const formData = new FormData()
      formData.append('file', uploadFile.raw)
      await uploadMaterial(selectedCourseId.value, formData)
      uploadFile.status = 'success'
      successCount++
    } catch {
      uploadFile.status = 'fail'
      failCount++
    }
  }

  uploading.value = false

  if (successCount > 0) {
    ElMessage.success(`成功上传 ${successCount} 个文件` + (failCount > 0 ? `，${failCount} 个失败` : ''))
    fetchMaterials()
  }
  if (successCount === files.length) {
    showUploadDialog.value = false
  }
}

const onUploadSuccess = () => {}
const onUploadError = () => {}

// 初始化
onMounted(fetchCourses)
</script>

<style lang="scss" scoped>
.material-page {
  padding: 20px;
}

.page-top-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  background: #fff;
  border-radius: 8px;
  padding: 16px 20px;
  margin-bottom: 16px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06);
}

.empty-box {
  background: #fff;
  border-radius: 8px;
  padding: 60px 20px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06);
}

.material-table-card {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06);
}

.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;

  h3 {
    margin: 0;
    font-size: 16px;
    color: #303133;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .course-name {
    font-size: 13px;
    color: #909399;
    font-weight: 400;
  }

  .table-count {
    font-size: 13px;
    color: #909399;
  }
}

.file-name {
  color: #1A5F7A;
  cursor: default;
}

.table-pagination {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}

.upload-area {
  :deep(.el-upload-dragger) {
    padding: 32px;
  }
}
</style>
