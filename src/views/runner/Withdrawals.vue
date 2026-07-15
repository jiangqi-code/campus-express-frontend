<template>
  <div class="p-4">
    <div class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
      <div>
        <h2 class="h4 mb-1">提现记录</h2>
        <p class="text-muted small mb-0">查看提现记录、申请提现</p>
      </div>
      <div class="d-flex gap-2">
        <el-button @click="fetchWithdrawals" :icon="RefreshRight">刷新</el-button>
        <el-button type="primary" :disabled="!canWithdraw" @click="openWithdrawDialog">
          申请提现
        </el-button>
      </div>
    </div>

    <!-- 可提现金额卡片 -->
    <el-card shadow="never" class="border mb-4">
      <div class="d-flex justify-content-between align-items-center">
        <div>
          <div class="text-muted small">当前可提现余额</div>
          <div class="h2 mb-0 text-primary">¥ {{ formatMoney(withdrawableBalance) }}</div>
        </div>
        <div class="text-muted small">
          提现后将在1-3个工作日内到账
        </div>
      </div>
    </el-card>

    <!-- 提现记录表格 -->
    <el-card shadow="never" class="border">
      <el-table :data="withdrawals" v-loading="loading" stripe style="width: 100%">
        <el-table-column prop="id" label="ID" width="80" align="center" />
        
        <el-table-column prop="amount" label="提现金额" width="120" align="center">
          <template #default="{ row }">
            <span class="fw-semibold">¥ {{ formatMoney(row.amount) }}</span>
          </template>
        </el-table-column>
        
        <el-table-column prop="status" label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        
        <el-table-column prop="apply_time" label="申请时间" width="180">
          <template #default="{ row }">
            <span class="text-muted small">{{ formatTime(row.apply_time || row.created_at) }}</span>
          </template>
        </el-table-column>
        
        <el-table-column prop="audit_time" label="审核时间" width="180">
          <template #default="{ row }">
            <span class="text-muted small">{{ row.audit_time ? formatTime(row.audit_time) : '-' }}</span>
          </template>
        </el-table-column>
        
        <el-table-column prop="remark" label="备注" min-width="150">
          <template #default="{ row }">
            <span class="text-muted small">{{ row.remark || '-' }}</span>
          </template>
        </el-table-column>
      </el-table>

      <div class="d-flex justify-content-end mt-4">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :total="pagination.total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next, jumper"
          @current-change="fetchWithdrawals"
          @size-change="handleSizeChange"
        />
      </div>
    </el-card>

    <!-- 申请提现弹窗 -->
    <el-dialog v-model="withdrawDialogVisible" title="申请提现" width="400px">
      <el-form>
        <el-form-item label="提现金额">
          <el-input
            v-model="withdrawAmount"
            type="number"
            placeholder="请输入提现金额"
            :min="1"
            :max="withdrawableBalance"
          >
            <template #prefix>¥</template>
          </el-input>
        </el-form-item>
        <el-form-item label="备注（选填）">
          <el-input
            v-model="withdrawRemark"
            type="textarea"
            rows="2"
            placeholder="请输入备注信息"
          />
        </el-form-item>
        <div class="text-muted small">
          <div>• 可提现余额：¥{{ formatMoney(withdrawableBalance) }}</div>
          <div>• 最低提现金额：¥1.00</div>
          <div>• 提现后将在1-3个工作日内到账</div>
        </div>
      </el-form>
      <template #footer>
        <el-button @click="withdrawDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitWithdraw">确认提现</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { RefreshRight } from '@element-plus/icons-vue'
import { http } from '@/api/request'

interface Withdrawal {
  id: number
  amount: number
  status: string
  apply_time: string
  created_at: string
  audit_time: string
  remark: string
  audit_admin: {
    id: number
    nickname: string
  } | null
}

const loading = ref(false)
const withdrawals = ref<Withdrawal[]>([])
const submitting = ref(false)
const withdrawDialogVisible = ref(false)
const withdrawAmount = ref('')
const withdrawRemark = ref('')
const withdrawableBalance = ref(0)

const pagination = ref({
  page: 1,
  pageSize: 20,
  total: 0,
})

const canWithdraw = computed(() => withdrawableBalance.value >= 1)

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
    const res = await http.get('/withdraw/list', {
      params: {
        page: pagination.value.page,
        pageSize: pagination.value.pageSize,
      }
    })
    const data = res.data
    
    withdrawals.value = data.items || data.list || []
    pagination.value.total = data.total || 0
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.message || '加载提现记录失败')
  } finally {
    loading.value = false
  }
}

// 修改这里：从钱包接口获取余额
async function fetchWithdrawableBalance() {
  try {
    const res = await http.get('/wallet/info')
    const data = res.data
    // 余额就是可提现金额
    withdrawableBalance.value = data.balance || 0
  } catch (err: any) {
    console.error('获取余额失败', err)
    withdrawableBalance.value = 0
  }
}

function handleSizeChange() {
  pagination.value.page = 1
  fetchWithdrawals()
}

function openWithdrawDialog() {
  if (!canWithdraw.value) {
    ElMessage.warning('可提现余额不足，无法申请提现')
    return
  }
  withdrawAmount.value = ''
  withdrawRemark.value = ''
  withdrawDialogVisible.value = true
}

async function submitWithdraw() {
  const amount = parseFloat(withdrawAmount.value)
  if (isNaN(amount) || amount <= 0) {
    ElMessage.warning('请输入正确的提现金额')
    return
  }
  if (amount < 1) {
    ElMessage.warning('最低提现金额为1元')
    return
  }
  if (amount > withdrawableBalance.value) {
    ElMessage.warning(`提现金额不能超过可提现余额（${formatMoney(withdrawableBalance.value)}元）`)
    return
  }
  
  submitting.value = true
  try {
    await http.post('/withdraw/apply', {
      amount: amount,
      remark: withdrawRemark.value
    })
    ElMessage.success('提现申请已提交，请等待管理员审核')
    withdrawDialogVisible.value = false
    // 刷新数据
    await fetchWithdrawals()
    await fetchWithdrawableBalance()
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.message || '申请失败')
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  fetchWithdrawals()
  fetchWithdrawableBalance()
})
</script>

<style scoped>
:deep(.el-table th) {
  background-color: #f8fafc;
  font-weight: 600;
  color: #1e293b;
}
</style>
