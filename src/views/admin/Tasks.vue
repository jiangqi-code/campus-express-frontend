<template>
  <div class="p-4">
    <div class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
      <div>
        <h2 class="h4 mb-1">任务治理</h2>
        <p class="text-muted small mb-0">查看、搜索、下架/删除违规任务</p>
      </div>
      <div class="d-flex gap-2 flex-wrap">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索标题/地址/发布者"
          clearable
          style="width: 220px"
          @clear="handleSearch"
          @keyup.enter="handleSearch"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
        <el-select v-model="statusFilter" placeholder="状态筛选" clearable style="width: 120px" @change="handleSearch">
          <el-option label="全部" value="" />
          <el-option label="待接单" value="PENDING" />
          <el-option label="已接单" value="ACCEPTED" />
          <el-option label="已完成" value="COMPLETED" />
          <el-option label="已取消" value="CANCELLED" />
        </el-select>
        <el-button @click="fetchTasks" :icon="RefreshRight">刷新</el-button>
      </div>
    </div>

    <el-card shadow="never" class="border">
      <el-table :data="tasks" v-loading="loading" stripe style="width: 100%">
        <el-table-column prop="id" label="任务ID" width="80" align="center" />
        
        <el-table-column prop="type" label="类型" width="80" align="center">
          <template #default="{ row }">
            <el-tag size="small">{{ getTypeLabel(row.type) }}</el-tag>
          </template>
        </el-table-column>
        
        <el-table-column prop="pickup_address" label="取件地址" min-width="180" show-overflow-tooltip />
        
        <el-table-column prop="delivery_address" label="送达地址" min-width="180" show-overflow-tooltip />
        
        <el-table-column prop="publisher" label="发布者" width="120">
          <template #default="{ row }">
            <span>{{ row.publisher?.nickname || row.publisher?.student_id || '-' }}</span>
          </template>
        </el-table-column>
        
        <el-table-column prop="fee_total" label="费用" width="100" align="center">
          <template #default="{ row }">
            <span class="fw-semibold">¥ {{ formatMoney(row.fee_total) }}</span>
            <span v-if="row.tip" class="text-muted small">+{{ row.tip }}</span>
          </template>
        </el-table-column>
        
        <el-table-column prop="status" label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        
        <el-table-column prop="created_at" label="发布时间" width="160">
          <template #default="{ row }">
            <span class="text-muted small">{{ formatTime(row.created_at) }}</span>
          </template>
        </el-table-column>
        
        <el-table-column label="操作" width="120" align="center" fixed="right">
          <template #default="{ row }">
            <el-button
              type="danger"
              size="small"
              plain
              @click="handleDelete(row)"
            >
              下架
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
          @current-change="fetchTasks"
          @size-change="handleSizeChange"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, RefreshRight } from '@element-plus/icons-vue'
import { http } from '@/api/request'

interface Task {
  id: number
  type: string
  pickup_address: string
  delivery_address: string
  fee_total: number
  tip: number
  status: string
  created_at: string
  publisher: {
    id: number
    nickname: string
    student_id: string
    phone: string
  }
  _count?: {
    orders: number
  }
}

const loading = ref(false)
const tasks = ref<Task[]>([])
const searchKeyword = ref('')
const statusFilter = ref('')

const pagination = ref({
  page: 1,
  pageSize: 20,
  total: 0,
})

function formatTime(time: string) {
  if (!time) return '-'
  const date = new Date(time)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatMoney(amount: number) {
  if (amount === undefined || amount === null) return '0'
  return Number(amount).toFixed(2)
}

function getTypeLabel(type: string) {
  const map: Record<string, string> = {
    '快递': '快递',
    '餐饮': '餐饮',
    '文件': '文件',
    '药品': '药品',
    '其他': '其他'
  }
  return map[type] || type || '其他'
}

function getStatusType(status: string) {
  const map: Record<string, string> = {
    'PENDING': 'warning',
    'ACCEPTED': 'primary',
    'COMPLETED': 'success',
    'CANCELLED': 'danger'
  }
  return map[status] || 'info'
}

function getStatusText(status: string) {
  const map: Record<string, string> = {
    'PENDING': '待接单',
    'ACCEPTED': '已接单',
    'COMPLETED': '已完成',
    'CANCELLED': '已取消'
  }
  return map[status] || status
}

async function fetchTasks() {
  loading.value = true
  try {
    const params: any = {
      page: pagination.value.page,
      pageSize: pagination.value.pageSize,
    }
    if (searchKeyword.value) {
      params.keyword = searchKeyword.value
    }
    if (statusFilter.value) {
      params.status = statusFilter.value
    }
    
    const res = await http.get('/admin/tasks', { params })
    const data = res.data
    
    tasks.value = data.items || data.list || []
    pagination.value.total = data.total || 0
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.message || '加载任务列表失败')
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  pagination.value.page = 1
  fetchTasks()
}

function handleSizeChange() {
  pagination.value.page = 1
  fetchTasks()
}

async function handleDelete(task: Task) {
  try {
    await ElMessageBox.confirm(
      `确定要下架任务「${task.id}」吗？下架后该任务将无法被接单。`,
      '提示',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )
    
    await http.delete(`/admin/tasks/${task.id}`)
    ElMessage.success('下架成功')
    fetchTasks()
  } catch (err: any) {
    if (err !== 'cancel') {
      ElMessage.error(err?.response?.data?.message || '下架失败')
    }
  }
}

onMounted(() => {
  fetchTasks()
})
</script>

<style scoped>
:deep(.el-table th) {
  background-color: #f8fafc;
  font-weight: 600;
  color: #1e293b;
}
</style>