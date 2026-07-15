<template>
  <div class="p-4">
    <div class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
      <div>
        <h2 class="h4 mb-1">错误日志</h2>
        <p class="text-muted small mb-0">查看系统错误记录，便于排查问题</p>
      </div>
      <div class="d-flex gap-2">
        <el-select v-model="level" placeholder="错误级别" clearable style="width: 120px" @change="handleSearch">
          <el-option label="全部" value="" />
          <el-option label="错误" value="error" />
          <el-option label="警告" value="warn" />
          <el-option label="信息" value="info" />
        </el-select>
        <el-input
          v-model="searchKeyword"
          placeholder="搜索错误信息/URL"
          clearable
          style="width: 220px"
          @clear="handleSearch"
          @keyup.enter="handleSearch"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
        <el-button @click="fetchLogs" :icon="RefreshRight">刷新</el-button>
      </div>
    </div>

    <el-card shadow="never" class="border">
      <el-table :data="logs" v-loading="loading" stripe style="width: 100%">
        <el-table-column prop="id" label="ID" width="70" align="center" />
        
        <el-table-column prop="level" label="级别" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="getLevelType(row.level)" size="small">
              {{ row.level || 'ERROR' }}
            </el-tag>
          </template>
        </el-table-column>
        
        <el-table-column prop="error_message" label="错误信息" min-width="250">
          <template #default="{ row }">
            <el-tooltip :content="row.error_message" placement="top" :show-after="300">
              <span class="error-message">{{ truncateText(row.error_message, 60) }}</span>
            </el-tooltip>
          </template>
        </el-table-column>
        
        <el-table-column prop="url" label="URL" width="200">
          <template #default="{ row }">
            <el-tooltip :content="row.url" placement="top">
              <span class="text-muted small">{{ truncateText(row.url, 40) }}</span>
            </el-tooltip>
          </template>
        </el-table-column>
        
        <el-table-column prop="method" label="方法" width="70" align="center">
          <template #default="{ row }">
            <el-tag :type="getMethodType(row.method)" size="small" effect="plain">
              {{ row.method || '-' }}
            </el-tag>
          </template>
        </el-table-column>
        
        <el-table-column prop="ip" label="IP" width="120">
          <template #default="{ row }">
            <code class="ip-cell">{{ formatIp(row.ip) }}</code>
          </template>
        </el-table-column>
        
        <el-table-column prop="user_id" label="用户ID" width="80" align="center">
          <template #default="{ row }">
            <span class="text-muted">{{ row.user_id || '-' }}</span>
          </template>
        </el-table-column>
        
        <el-table-column prop="created_at" label="时间" width="160">
          <template #default="{ row }">
            <span class="text-muted small">{{ formatDateTime(row.created_at) }}</span>
          </template>
        </el-table-column>
        
        <el-table-column label="操作" width="80" align="center" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="showDetail(row)">
              详情
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="d-flex justify-content-end mt-4">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :total="pagination.total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          @current-change="fetchLogs"
          @size-change="handleSizeChange"
        />
      </div>
    </el-card>

    <!-- 错误详情弹窗 -->
    <el-dialog v-model="detailVisible" title="错误详情" width="700px">
      <div class="vstack gap-3">
        <div>
          <div class="fw-semibold mb-1">错误信息</div>
          <div class="bg-light p-3 rounded small">{{ currentError?.error_message }}</div>
        </div>
        <div v-if="currentError?.stack">
          <div class="fw-semibold mb-1">堆栈信息</div>
          <pre class="bg-light p-3 rounded small overflow-auto" style="max-height: 300px">{{ currentError?.stack }}</pre>
        </div>
        <div class="row g-2">
          <div class="col-6">
            <div class="fw-semibold mb-1">URL</div>
            <div class="text-muted small">{{ currentError?.url }}</div>
          </div>
          <div class="col-3">
            <div class="fw-semibold mb-1">方法</div>
            <div class="text-muted small">{{ currentError?.method }}</div>
          </div>
          <div class="col-3">
            <div class="fw-semibold mb-1">IP</div>
            <div class="text-muted small">{{ formatIp(currentError?.ip || '') }}</div>
          </div>
        </div>
        <div>
          <div class="fw-semibold mb-1">时间</div>
          <div class="text-muted small">{{ formatDateTime(currentError?.created_at || '') }}</div>
        </div>
      </div>
      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Search, RefreshRight } from '@element-plus/icons-vue'
import { http } from '@/api/request'

interface ErrorLog {
  id: number
  level: string
  error_message: string
  stack: string
  url: string
  method: string
  ip: string
  user_id: number
  created_at: string
}

const loading = ref(false)
const logs = ref<ErrorLog[]>([])
const searchKeyword = ref('')
const level = ref('')
const detailVisible = ref(false)
const currentError = ref<ErrorLog | null>(null)

const pagination = ref({
  page: 1,
  pageSize: 20,
  total: 0,
})

function formatDateTime(dateStr: string) {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatIp(ip: string) {
  if (!ip) return '-'
  if (ip.startsWith('::ffff:')) {
    return ip.replace('::ffff:', '')
  }
  return ip
}

function truncateText(text: string, maxLen: number) {
  if (!text) return '-'
  if (text.length <= maxLen) return text
  return text.substring(0, maxLen) + '...'
}

function getLevelType(level: string) {
  const lvl = (level || '').toLowerCase()
  if (lvl === 'error') return 'danger'
  if (lvl === 'warn' || lvl === 'warning') return 'warning'
  return 'info'
}

function getMethodType(method: string) {
  const m = (method || '').toUpperCase()
  if (m === 'GET') return 'success'
  if (m === 'POST') return 'primary'
  if (m === 'PUT') return 'warning'
  if (m === 'DELETE') return 'danger'
  return 'info'
}

async function fetchLogs() {
  loading.value = true
  try {
    const params: any = {
      page: pagination.value.page,
      pageSize: pagination.value.pageSize,
    }
    if (searchKeyword.value) {
      params.keyword = searchKeyword.value
    }
    if (level.value) {
      params.level = level.value
    }
    
    const res = await http.get('/admin/logs/error', { params })
    const data = res.data
    
    logs.value = data.items || data.list || []
    pagination.value.total = data.total || 0
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.message || '加载错误日志失败')
  } finally {
    loading.value = false
  }
}

function showDetail(row: ErrorLog) {
  currentError.value = row
  detailVisible.value = true
}

function handleSearch() {
  pagination.value.page = 1
  fetchLogs()
}

function handleSizeChange() {
  pagination.value.page = 1
  fetchLogs()
}

onMounted(() => {
  fetchLogs()
})
</script>

<style scoped>
:deep(.el-table th) {
  background-color: #f8fafc;
  font-weight: 600;
  color: #1e293b;
}

.error-message {
  color: #dc2626;
  font-size: 13px;
  cursor: pointer;
}

.ip-cell {
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 12px;
  background-color: #f1f5f9;
  padding: 2px 8px;
  border-radius: 6px;
  display: inline-block;
  white-space: nowrap;
}

pre {
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
