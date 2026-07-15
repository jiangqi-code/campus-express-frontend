<template>
  <div class="p-4">
    <div class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
      <div>
        <h2 class="h4 mb-1">提现审核</h2>
        <p class="text-muted small mb-0">查看、审核跑腿员的提现申请</p>
      </div>
      <div class="d-flex gap-2 flex-wrap">
        <el-select v-model="statusFilter" placeholder="状态筛选" clearable style="width: 120px" @change="handleSearch">
          <el-option label="全部" value="" />
          <el-option label="待审核" value="PENDING" />
          <el-option label="已通过" value="APPROVED" />
          <el-option label="已拒绝" value="REJECTED" />
        </el-select>
        <el-button @click="fetchWithdrawals" :icon="RefreshRight">刷新</el-button>
      </div>
    </div>

    <el-card shadow="never" class="border">
      <el-table :data="withdrawals" v-loading="loading" stripe style="width: 100%">
        <el-table-column prop="id" label="ID" width="80" align="center" />
        
        <el-table-column label="申请人" width="120">
          <template #default="{ row }">
            <div>
              <div class="fw-semibold">{{ row.user?.nickname || '-' }}</div>
              <div class="text-muted small">{{ row.user?.student_id || '' }}</div>
            </div>
          </template>
        </el-table-column>
        
        <el-table-column prop="user.phone" label="手机号" width="120" />
        
        <el-table-column prop="amount" label="提现金额" width="120" align="center">
          <template #default="{ row }">
            <span class="fw-semibold text-success">¥ {{ formatMoney(row.amount) }}</span>
          </template>
        </el-table-column>
        
        <el-table-column prop="status" label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        
        <el-table-column prop="apply_time" label="申请时间" width="160">
          <template #default="{ row }">
            <span class="text-muted small">{{ formatTime(row.apply_time || row.created_at) }}</span>
          </template>
        </el-table-column>
        
        <el-table-column prop="audit_time" label="审核时间" width="160">
          <template #default="{ row }">
            <span class="text-muted small">{{ row.audit_time ? formatTime(row.audit_time) : '-' }}</span>
          </template>
        </el-table-column>
        
        <el-table-column label="审核人" width="100">
          <template #default="{ row }">
            <span>{{ row.audit_admin?.nickname || '-' }}</span>
          </template>
        </el-table-column>
        
        <el-table-column label="操作" width="160" align="center" fixed="right">
          <template #default="{ row }">
            <template v-if="row.status === 'PENDING'">
              <el-button type="success" size="small" @click="handleApprove(row)">通过</el-button>
              <el-button type="danger" size="small" @click="handleReject(row)">拒绝</el-button>
            </template>
            <span v-else class="text-muted">已处理</span>
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
          @current-change="fetchWithdrawals"
          @size-change="handleSizeChange"
        />
      </div>
    </el-card>

    <!-- 拒绝原因弹窗 -->
    <el-dialog v-model="rejectDialogVisible" title="拒绝提现" width="500px">
      <el-input
        v-model="rejectReason"
        type="textarea"
        rows="3"
        placeholder="请填写拒绝原因"
      />
      <template #footer>
        <el-button @click="rejectDialogVisible = false">取消</el-button>
        <el-button type="danger" :loading="submitting" @click="confirmReject">确认拒绝</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { RefreshRight } from '@element-plus/icons-vue'
import { http } from '@/api/request'

interface Withdrawal {
  id: number
  amount: number
  status: string
  apply_time: string
  created_at: string
  audit_time: string
  user: {
    id: number
    nickname: string
    student_id: string
    phone: string
  }
  audit_admin: {
    id: number
    nickname: string
  } | null
}

const loading = ref(false)
const withdrawals = ref<Withdrawal[]>([])
const statusFilter = ref('')
const submitting = ref(false)
const rejectDialogVisible = ref(false)
const rejectReason = ref('')
const currentWithdrawal = ref<Withdrawal | null>(null)

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
    'PENDING': 'warning',
    'APPROVED': 'success',
    'REJECTED': 'danger'
  }
  return map[status] || 'info'
}

function getStatusText(status: string) {
  const map: Record<string, string> = {
    'PENDING': '待审核',
    'APPROVED': '已通过',
    'REJECTED': '已拒绝'
  }
  return map[status] || status
}

async function fetchWithdrawals() {
  loading.value = true
  try {
    const params: any = {
      page: pagination.value.page,
      pageSize: pagination.value.pageSize,
    }
    if (statusFilter.value) {
      params.status = statusFilter.value
    }
    
    const res = await http.get('/admin/withdraw/list', { params })
    const data = res.data
    
    withdrawals.value = data.items || data.list || []
    pagination.value.total = data.total || 0
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.message || '加载提现申请失败')
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  pagination.value.page = 1
  fetchWithdrawals()
}

function handleSizeChange() {
  pagination.value.page = 1
  fetchWithdrawals()
}

async function handleApprove(row: Withdrawal) {
  try {
    await ElMessageBox.confirm(
      `确定通过 ${row.user?.nickname} 的提现申请（¥${formatMoney(row.amount)}）吗？`,
      '提示',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )
    
    await http.post(`/admin/withdraw/${row.id}/audit`, {
      decision: 'APPROVE'
    })
    ElMessage.success('提现申请已通过')
    fetchWithdrawals()
  } catch (err: any) {
    if (err !== 'cancel') {
      ElMessage.error(err?.response?.data?.message || '操作失败')
    }
  }
}

function handleReject(row: Withdrawal) {
  currentWithdrawal.value = row
  rejectReason.value = ''
  rejectDialogVisible.value = true
}

async function confirmReject() {
  if (!currentWithdrawal.value) return
  if (!rejectReason.value.trim()) {
    ElMessage.warning('请填写拒绝原因')
    return
  }
  
  submitting.value = true
  try {
    await http.post(`/admin/withdraw/${currentWithdrawal.value.id}/audit`, {
      decision: 'REJECT',
      reason: rejectReason.value
    })
    ElMessage.success('已拒绝提现申请')
    rejectDialogVisible.value = false
    fetchWithdrawals()
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.message || '操作失败')
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  fetchWithdrawals()
})
</script>

<style scoped>
:deep(.el-table th) {
  background-color: #f8fafc;
  font-weight: 600;
  color: #1e293b;
}
</style>