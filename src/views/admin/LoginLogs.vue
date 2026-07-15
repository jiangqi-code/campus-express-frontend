<template>
  <div class="p-4">
    <div class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
      <div>
        <h2 class="h4 mb-1">登录日志</h2>
        <p class="text-muted small mb-0">查看所有用户的登录记录</p>
      </div>
      <div class="d-flex gap-2">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索用户名/用户ID"
          clearable
          style="width: 200px"
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
      <el-table 
        :data="logs" 
        v-loading="loading" 
        stripe 
        style="width: 100%"
        :row-style="{ height: '48px' }"
      >
        <el-table-column prop="id" label="ID" width="70" align="center" />
        
        <el-table-column prop="user_id" label="用户ID" width="80" align="center">
          <template #default="{ row }">
            <span class="text-muted">{{ row.user_id || '-' }}</span>
          </template>
        </el-table-column>
        
        <el-table-column prop="user_name" label="用户名" width="120">
          <template #default="{ row }">
            <span class="fw-semibold">{{ row.user_name || row.user?.nickname || '-' }}</span>
          </template>
        </el-table-column>
        
        <el-table-column prop="login_time" label="登录时间" width="160">
          <template #default="{ row }">
            <span class="text-muted small">{{ formatDateTime(row.login_time) }}</span>
          </template>
        </el-table-column>
        
        <el-table-column prop="ip" label="IP地址" width="140">
          <template #default="{ row }">
            <el-tooltip :content="row.ip" placement="top">
              <code class="ip-cell">{{ formatIp(row.ip) }}</code>
            </el-tooltip>
          </template>
        </el-table-column>
        
        <el-table-column prop="user_agent" label="设备信息" min-width="200">
          <template #default="{ row }">
            <el-tooltip :content="row.user_agent" placement="top" :show-after="500">
              <span class="ua-text">{{ formatUserAgent(row.user_agent) }}</span>
            </el-tooltip>
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
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Search, RefreshRight } from '@element-plus/icons-vue'
import { http } from '@/api/request'

interface LoginLog {
  id: number
  user_id: number
  user_name: string
  user?: { nickname: string }
  login_time: string
  ip: string
  user_agent: string
}

const loading = ref(false)
const logs = ref<LoginLog[]>([])
const searchKeyword = ref('')

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
  // 简化 IPv6 映射地址显示
  if (ip.startsWith('::ffff:')) {
    return ip.replace('::ffff:', '')
  }
  return ip
}

function formatUserAgent(ua: string) {
  if (!ua) return '-'
  // 提取浏览器和操作系统关键信息
  let result = ua
  
  // 提取浏览器
  if (ua.includes('Chrome/') && !ua.includes('Edg/')) {
    const match = ua.match(/Chrome\/(\d+)/)
    if (match) result = `Chrome ${match[1]}`
  } else if (ua.includes('Edg/')) {
    const match = ua.match(/Edg\/(\d+)/)
    if (match) result = `Edge ${match[1]}`
  } else if (ua.includes('Firefox/')) {
    const match = ua.match(/Firefox\/(\d+)/)
    if (match) result = `Firefox ${match[1]}`
  } else if (ua.includes('Safari/') && !ua.includes('Chrome/')) {
    result = 'Safari'
  }
  
  // 提取操作系统
  if (ua.includes('Windows NT 10.0')) result += ' / Windows 10'
  else if (ua.includes('Windows NT 11.0')) result += ' / Windows 11'
  else if (ua.includes('Mac OS X')) result += ' / macOS'
  else if (ua.includes('Linux')) result += ' / Linux'
  else if (ua.includes('iPhone')) result += ' / iOS'
  else if (ua.includes('Android')) result += ' / Android'
  
  return result
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
    
    const res = await http.get('/admin/logs/login', { params })
    const data = res.data
    
    logs.value = data.items || data.list || []
    pagination.value.total = data.total || 0
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.message || '加载登录日志失败')
  } finally {
    loading.value = false
  }
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

:deep(.el-table .cell) {
  white-space: nowrap;
}

.ip-cell {
  font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
  font-size: 12px;
  background-color: #f1f5f9;
  padding: 2px 8px;
  border-radius: 6px;
  display: inline-block;
  white-space: nowrap;
}

.ua-text {
  font-size: 12px;
  color: #475569;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: inline-block;
  max-width: 100%;
  cursor: pointer;
}

:deep(.el-table .cell) {
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>