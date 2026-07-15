<template>
  <div class="p-4">
    <div class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
      <div>
        <h2 class="h4 mb-1">钱包流水</h2>
        <p class="text-muted small mb-0">按类型、时间范围筛选查看资金变动</p>
      </div>
      <div class="d-flex gap-2 flex-wrap">
        <!-- 类型筛选 -->
        <el-select v-model="filters.type" placeholder="类型" clearable style="width: 120px" @change="handleSearch">
          <el-option label="全部类型" value="" />
          <el-option label="充值" value="recharge" />
          <el-option label="订单支付" value="ORDER_PAY" />
          <el-option label="订单收入" value="ORDER_INCOME" />
          <el-option label="退款" value="ORDER_CANCEL_REFUND" />
          <el-option label="提现" value="WITHDRAW_APPROVE_OUT" />
          <el-option label="超时退款" value="TASK_TIMEOUT_CANCEL_REFUND" />
        </el-select>

        <!-- 模糊查询：订单号/备注 -->
        <el-input 
          v-model="filters.keyword" 
          placeholder="订单号/备注" 
          clearable 
          style="width: 180px"
          @clear="handleSearch"
          @keyup.enter="handleSearch"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>

        <!-- 金额范围查询 -->
        <el-input 
          v-model="filters.minAmount" 
          placeholder="最小金额" 
          type="number"
          clearable 
          style="width: 110px"
          @clear="handleSearch"
        />
        <span class="align-self-center">-</span>
        <el-input 
          v-model="filters.maxAmount" 
          placeholder="最大金额" 
          type="number"
          clearable 
          style="width: 110px"
          @clear="handleSearch"
        />

        <!-- 日期范围 -->
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          format="YYYY/MM/DD"
          value-format="YYYY-MM-DD"
          style="width: 260px"
          @change="handleSearch"
        />

        <el-button @click="resetFilters" :icon="RefreshRight">重置</el-button>
        <el-button type="primary" @click="fetchLogs" :icon="Search">查询</el-button>
      </div>
    </div>

    <!-- 表格内容保持不变 -->
    <el-card shadow="never" class="border">
      <el-table :data="logs" v-loading="loading" stripe style="width: 100%">
        <el-table-column prop="type_name" label="类型" width="140">
          <template #default="{ row }">
            <el-tag :type="getTypeTagType(row.type)" size="small">
              {{ getTypeName(row.type) }}
            </el-tag>
          </template>
        </el-table-column>
        
        <el-table-column prop="remark" label="说明" min-width="150">
          <template #default="{ row }">
            <span>{{ getRemark(row) }}</span>
          </template>
        </el-table-column>
        
        <el-table-column prop="amount" label="金额" width="120" align="center">
          <template #default="{ row }">
            <span :class="getAmountClass(row.amount, row.type)">
              {{ formatAmount(row.amount) }}
            </span>
          </template>
        </el-table-column>
        
        <el-table-column label="余额变化" width="180" align="center">
          <template #default="{ row }">
            <span class="text-muted small">
              {{ formatMoney(row.before_balance) }} → {{ formatMoney(row.after_balance) }}
            </span>
          </template>
        </el-table-column>
        
        <el-table-column prop="ref_order_id" label="关联订单" width="120" align="center">
          <template #default="{ row }">
            <el-link v-if="row.ref_order_id" type="primary" :underline="false" @click="goToOrderDetail(row.ref_order_id)">
              {{ row.ref_order_id }}
            </el-link>
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>
        
        <el-table-column prop="created_at" label="时间" width="170">
          <template #default="{ row }">
            <span class="text-muted small">{{ formatDateTime(row.created_at) }}</span>
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
import { useRouter } from 'vue-router'

const router = useRouter()
const loading = ref(false)
const logs = ref<WalletLog[]>([])
const dateRange = ref<[string, string] | null>(null)

// 扩展 filters，增加 keyword, minAmount, maxAmount
const filters = ref({
  type: '',
  keyword: '',      // 模糊查询关键词（订单号/备注）
  minAmount: '',    // 最小金额
  maxAmount: '',    // 最大金额
  startDate: '',
  endDate: ''
})

const pagination = ref({
  page: 1,
  pageSize: 20,
  total: 0,
})

interface WalletLog {
  id: number
  type: string
  amount: number
  before_balance: number
  after_balance: number
  ref_order_id: number | null
  created_at: string
  remark?: string
}

// 跳转到订单详情
function goToOrderDetail(orderId: number) {
  router.push(`/order/detail/${orderId}`)
}

// 获取说明文字（简化，因为后端会返回remark）
function getRemark(row: WalletLog): string {
  const map: Record<string, string> = {
    'recharge': '充值',
    'RECHARGE': '充值',  // 添加这一行
    'ORDER_PAY': '发布任务支付',
    'ORDER_INCOME': '完成任务收入',
    'ORDER_EARN': '完成任务收入',
    'ORDER_CANCEL_REFUND': '订单取消退款',
    'ORDER_CANCEL_COMPENSATE': '取消订单补偿',
    'WITHDRAW_APPLY': '提现申请',
    'WITHDRAW_APPROVE_OUT': '提现',
    'WITHDRAW_REJECT_RETURN': '提现退回',
    'REFUND': '退款申请通过',
    'TASK_TIMEOUT_CANCEL_REFUND': '任务超时自动退款',
    'ORDER_TIMEOUT_NO_PICKUP_REFUND': '超时未取件退款',
    'COMPLAINT_COMPENSATION_OUT': '投诉赔付支出',
    'COMPLAINT_COMPENSATION_IN': '投诉赔付收入'
  }
  return map[row.type] || row.remark || '-'
}

// 类型名称映射
function getTypeName(type: string): string {
  const map: Record<string, string> = {
    'recharge': '充值',
    'RECHARGE': '充值',  // 添加这一行
    'ORDER_PAY': '订单支付',
    'ORDER_INCOME': '订单收入',
    'ORDER_EARN': '订单收入',
    'ORDER_CANCEL_REFUND': '订单取消退款',
    'ORDER_CANCEL_COMPENSATE': '取消订单补偿',
    'WITHDRAW_APPLY': '提现申请',
    'WITHDRAW_APPROVE_OUT': '提现',
    'WITHDRAW_REJECT_RETURN': '提现退回',
    'TASK_TIMEOUT_CANCEL_REFUND': '超时自动退款',
    'ORDER_TIMEOUT_NO_PICKUP_REFUND': '超时未取件退款',
    'REFUND': '退款',
    'COMPLAINT_COMPENSATION_OUT': '投诉赔付支出',
    'COMPLAINT_COMPENSATION_IN': '投诉赔付收入'
  }
  return map[type] || type || '其他'
}

// 类型标签样式
function getTypeTagType(type: string): string {
  if (type === 'recharge' || type === 'RECHARGE' || type === 'ORDER_INCOME') return 'success'
  if (type === 'ORDER_PAY') return 'danger'
  if (type.includes('REFUND')) return 'warning'
  if (type.includes('WITHDRAW')) return 'info'
  return 'info'
}

// 金额样式
function getAmountClass(amount: number, type: string): string {
  if (amount === 0) return 'text-muted'
  // 支出类
  if (type === 'ORDER_PAY' || type === 'WITHDRAW_APPROVE_OUT') return 'text-danger'
  return 'text-success'
}

function formatAmount(amount: number): string {
  if (amount === undefined || amount === null) return '0.00'
  const num = Number(amount)
  if (isNaN(num)) return '0.00'
  const prefix = num > 0 ? '+' : ''
  return `${prefix}${num.toFixed(2)}`
}

function formatMoney(amount: number): string {
  if (amount === undefined || amount === null) return '0.00'
  return Number(amount).toFixed(2)
}

function formatDateTime(dateStr: string): string {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

async function fetchLogs() {
  loading.value = true
  try {
    const params: any = {
      page: pagination.value.page,
      pageSize: pagination.value.pageSize,
    }
    
    // 类型筛选
    if (filters.value.type) {
      params.type = filters.value.type
    }
    
    // 模糊查询（订单号/备注）
    if (filters.value.keyword) {
      params.keyword = filters.value.keyword.trim()
    }
    
    // 金额范围查询
    if (filters.value.minAmount) {
      params.min_amount = Number(filters.value.minAmount)
    }
    if (filters.value.maxAmount) {
      params.max_amount = Number(filters.value.maxAmount)
    }
    
    // 日期范围
    if (dateRange.value && dateRange.value[0] && dateRange.value[1]) {
      params.start_date = dateRange.value[0]
      params.end_date = dateRange.value[1]
    }
    
    const res = await http.get('/wallet/logs', { params })
    const data = res.data
    
    logs.value = data.items || data.list || []
    pagination.value.total = data.total || 0
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.message || '加载流水失败')
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

function resetFilters() {
  filters.value.type = ''
  filters.value.keyword = ''
  filters.value.minAmount = ''
  filters.value.maxAmount = ''
  dateRange.value = null
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

.text-success {
  color: #67c23a;
  font-weight: 500;
}

.text-danger {
  color: #f56c6c;
  font-weight: 500;
}

.text-muted {
  color: #909399;
}
</style>