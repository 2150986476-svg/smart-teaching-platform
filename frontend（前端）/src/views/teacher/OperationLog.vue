<template>
  <div class="operation-log">
    <div class="page-header">
      <h2>📋 操作日志</h2>
      <p>查看所有教师和管理员的操作记录</p>
    </div>

    <!-- 筛选栏 -->
    <div class="filter-bar">
      <el-select
        v-model="filterAction"
        placeholder="操作类型"
        clearable
        style="width: 180px"
        @change="handleSearch"
      >
        <el-option
          v-for="a in actionTypes"
          :key="a"
          :label="actionLabel(a)"
          :value="a"
        />
      </el-select>

      <el-date-picker
        v-model="filterDateRange"
        type="daterange"
        range-separator="至"
        start-placeholder="开始日期"
        end-placeholder="结束日期"
        value-format="YYYY-MM-DD"
        style="width: 280px"
        @change="handleSearch"
      />

      <el-input
        v-model="filterKeyword"
        placeholder="搜索操作人/目标/详情"
        :prefix-icon="Search"
        clearable
        style="width: 240px"
        @keyup.enter="handleSearch"
        @clear="handleSearch"
      />

      <el-button type="primary" @click="handleSearch">查询</el-button>
      <el-button @click="handleReset">重置</el-button>
    </div>

    <!-- 日志表格 -->
    <div class="table-card">
      <el-table
        v-loading="loading"
        :data="logList"
        stripe
        border
        style="width: 100%"
      >
        <el-table-column prop="id" label="ID" width="70" align="center" />
        <el-table-column prop="operator_name" label="操作人" width="120" />
        <el-table-column label="角色" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="roleTag(row.operator_role)" size="small">
              {{ roleLabel(row.operator_role) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作类型" width="140">
          <template #default="{ row }">
            <el-tag type="info" size="small">{{ actionLabel(row.action) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作目标" min-width="180">
          <template #default="{ row }">
            <span>{{ targetLabel(row) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="detail" label="详情" min-width="200" show-overflow-tooltip />
        <el-table-column prop="ip_address" label="IP地址" width="140" />
        <el-table-column label="操作时间" width="170">
          <template #default="{ row }">
            {{ formatTime(row.created_at) }}
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrapper">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next"
          @change="fetchLogs"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { Search } from '@element-plus/icons-vue'
import { getOperationLogs, getActionTypes } from '@/api/log'

const loading = ref(false)
const logList = ref([])
const actionTypes = ref([])

const filterAction = ref('')
const filterKeyword = ref('')
const filterDateRange = ref(null)

const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0
})

const actionLabelMap = {
  import_students: '批量导入学生',
  reset_password: '重置密码',
  update_class: '修改班级',
  change_password: '修改密码'
}

const actionLabel = (action) => actionLabelMap[action] || action

const roleLabel = (role) => {
  const map = { teacher: '教师', admin: '管理员', assistant: '助教' }
  return map[role] || role
}

const roleTag = (role) => {
  const map = { admin: 'danger', teacher: 'primary', assistant: 'warning' }
  return map[role] || 'info'
}

const targetLabel = (row) => {
  const map = {
    course: '课程',
    student: '学生'
  }
  const type = map[row.target_type] || row.target_type || ''
  const name = row.target_name || ''
  return type ? `${type}: ${name}` : name
}

const formatTime = (t) => {
  if (!t) return '-'
  return new Date(t).toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  })
}

const fetchActionTypes = async () => {
  try {
    const res = await getActionTypes()
    actionTypes.value = res.data || []
  } catch {}
}

const buildParams = () => {
  const params = {
    page: pagination.page,
    pageSize: pagination.pageSize
  }
  if (filterAction.value) params.action = filterAction.value
  if (filterKeyword.value) params.keyword = filterKeyword.value
  if (filterDateRange.value && filterDateRange.value.length === 2) {
    params.startDate = filterDateRange.value[0]
    params.endDate = filterDateRange.value[1]
  }
  return params
}

const fetchLogs = async () => {
  loading.value = true
  try {
    const res = await getOperationLogs(buildParams())
    logList.value = res.data.records
    pagination.total = res.data.total
  } catch {} finally {
    loading.value = false
  }
}

const handleSearch = () => {
  pagination.page = 1
  fetchLogs()
}

const handleReset = () => {
  filterAction.value = ''
  filterKeyword.value = ''
  filterDateRange.value = null
  pagination.page = 1
  fetchLogs()
}

onMounted(() => {
  fetchActionTypes()
  fetchLogs()
})
</script>

<style lang="scss" scoped>
.operation-log {
  padding: 24px 20px;
}

.page-header {
  margin-bottom: 20px;
  h2 { margin: 0 0 6px; font-size: 22px; color: #303133; }
  p { margin: 0; color: #909399; font-size: 14px; }
}

.filter-bar {
  background: #fff;
  border-radius: 8px;
  padding: 16px 20px;
  margin-bottom: 16px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06);
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.table-card {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06);
}

.pagination-wrapper {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
