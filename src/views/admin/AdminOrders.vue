<template>
  <div class="p-4">
    <div class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
      <div>
        <h2 class="h4 mb-1">订单治理</h2>
        <p class="text-muted small mb-0">查看、搜索、强制取消/修改订单状态</p>
      </div>
      <div class="d-flex gap-2 flex-wrap">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索订单ID/地址"
          clearable
          style="width: 200px"
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
          <el-option label="已取件" value="PICKED" />
          <el-option label="配送中" value="DELIVERING" />
          <el-option label="已完成" value="COMPLETED" />
          <el-option label="已取消" value="CANCELLED" />
        </el-select>
        <el-button @click="fetchOrders" :icon="RefreshRight">刷新</el-button>
      </div>
    </div>

    <el-card shadow="never" class="border">
      <el-table :data="orders" v-loading="loading" stripe style="width: 100%">
        <el-table-column prop="id" label="订单ID" width="90" align="center" />
        
        <el-table-column prop="task_id" label="任务ID" width="90" align="center" />
        
        <el-table-column prop="task.pickup_address" label="取件地址" min-width="180" show-overflow-tooltip />
        
        <el-table-column prop="task.delivery_address" label="送达地址" min-width="180" show-overflow-tooltip />
        
        <el-table-column label="发布者" width="120">
          <template #default="{ row }">
            <span>{{ row.task?.publisher?.nickname || '-' }}</span>
          </template>
        </el-table-column>
        
        <el-table-column label="跑腿员" width="120">
          <template #default="{ row }">
            <span>{{ row.taker?.nickname || '未接单' }}</span>
          </template>
        </el-table-column>
        
        <el-table-column prop="final_price" label="金额" width="100" align="center">
          <template #default="{ row }">
            <span class="fw-semibold">¥ {{ formatMoney(row.final_price || row.task?.fee_total) }}</span>
          </template>
        </el-table-column>
        
        <el-table-column prop="status" label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        
        <el-table-column prop="created_at" label="创建时间" width="160">
          <template #default="{ row }">
            <span class="text-muted small">{{ formatTime(row.created_at) }}</span>
          </template>
        </el-table-column>
        
        <el-table-column label="操作" width="180" align="center" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="row.status !== 'COMPLETED' && row.status !== 'CANCELLED'"
              type="danger"
              size="small"
              plain
              @click="handleCancel(row)"
            >
              强制取消
            </el-button>
            <el-dropdown @command="(cmd: string) => handleStatusChange(row, cmd)">
              <el-button type="primary" size="small" plain>
                修改状态 <el-icon class="el-icon--right"><ArrowDown /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="ACCEPTED">已接单</el-dropdown-item>
                  <el-dropdown-item command="PICKED">已取件</el-dropdown-item>
                  <el-dropdown-item command="DELIVERING">配送中</el-dropdown-item>
                  <el-dropdown-item command="COMPLETED">已完成</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
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
          @current-change="fetchOrders"
          @size-change="handleSizeChange"
        />
      </div>
    </el-card>

    <!-- 强制取消原因弹窗 -->
    <el-dialog v-model="cancelDialogVisible" title="强制取消订单" width="500px">
      <el-input
        v-model="cancelReason"
        type="textarea"
        rows="3"
        placeholder="请输入取消原因（选填）"
      />
      <template #footer>
        <el-button @click="cancelDialogVisible = false">取消</el-button>
        <el-button type="danger" :loading="submitting" @click="confirmCancel">确认取消</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, RefreshRight, ArrowDown } from '@element-plus/icons-vue'
import { http } from '@/api/request'

interface Order {
  id: number
  task_id: number
  status: string
  final_price: number
  created_at: string
  task: {
    pickup_address: string
    delivery_address: string
    fee_total: number
    tip: number
    publisher: {
      id: number
      nickname: string
    }
  }
  taker: {
    id: number
    nickname: string
  } | null
}

const loading = ref(false)
const orders = ref<Order[]>([])
const searchKeyword = ref('')
const statusFilter = ref('')
const submitting = ref(false)
const cancelDialogVisible = ref(false)
const cancelReason = ref('')
const currentOrder = ref<Order | null>(null)

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

function getStatusType(status: string) {
  const map: Record<string, string> = {
    'PENDING': 'info',
    'ACCEPTED': 'primary',
    'PICKED': 'warning',
    'DELIVERING': 'warning',
    'COMPLETED': 'success',
    'CANCELLED': 'danger'
  }
  return map[status] || 'info'
}

function getStatusText(status: string) {
  const map: Record<string, string> = {
    'PENDING': '待接单',
    'ACCEPTED': '已接单',
    'PICKED': '已取件',
    'DELIVERING': '配送中',
    'COMPLETED': '已完成',
    'CANCELLED': '已取消'
  }
  return map[status] || status
}

async function fetchOrders() {
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
    
    const res = await http.get('/admin/orders', { params })
    const data = res.data
    
    orders.value = data.items || data.list || []
    pagination.value.total = data.total || 0
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.message || '加载订单列表失败')
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  pagination.value.page = 1
  fetchOrders()
}

function handleSizeChange() {
  pagination.value.page = 1
  fetchOrders()
}

function handleCancel(order: Order) {
  currentOrder.value = order
  cancelReason.value = ''
  cancelDialogVisible.value = true
}

async function confirmCancel() {
  if (!currentOrder.value) return
  submitting.value = true
  try {
    await http.put(`/admin/order/${currentOrder.value.id}/cancel`, {
      reason: cancelReason.value
    })
    ElMessage.success('订单已取消')
    cancelDialogVisible.value = false
    fetchOrders()
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.message || '取消失败')
  } finally {
    submitting.value = false
  }
}

async function handleStatusChange(order: Order, newStatus: string) {
  try {
    await ElMessageBox.confirm(
      `确定将订单 ${order.id} 的状态修改为「${getStatusText(newStatus)}」吗？`,
      '提示',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )
    
    await http.put(`/admin/order/${order.id}/status`, {
      status: newStatus
    })
    ElMessage.success('状态修改成功')
    fetchOrders()
  } catch (err: any) {
    if (err !== 'cancel') {
      ElMessage.error(err?.response?.data?.message || '修改失败')
    }
  }
}

onMounted(() => {
  fetchOrders()
})
</script>

<style scoped>
:deep(.el-table th) {
  background-color: #f8fafc;
  font-weight: 600;
  color: #1e293b;
}
</style>