<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'

import { http } from '@/api/request'

type WalletLogRaw = Record<string, any>

type WalletLogVM = {
  id: string | number
  type: string
  title: string
  amount: number
  balanceBefore?: number
  balanceAfter?: number
  orderNo?: string
  createdAt?: string | number
  raw: WalletLogRaw
}

const loading = ref(false)
const errorMessage = ref('')
const rows = ref<WalletLogVM[]>([])
const total = ref(0)

const filters = reactive<{
  type: '' | 'recharge' | 'pay' | 'income' | 'withdraw' | 'refund'
  startDate: string
  endDate: string
}>({
  type: '',
  startDate: '',
  endDate: '',
})

const pagination = reactive({
  page: 1,
  pageSize: 10,
})

const pageSizeOptions = [10, 20, 50]

const typeOptions: Array<{ value: '' | WalletLogVM['type']; label: string }> = [
  { value: '', label: '全部类型' },
  { value: 'recharge', label: '充值' },
  { value: 'pay', label: '支付' },
  { value: 'income', label: '收入' },
  { value: 'withdraw', label: '提现' },
  { value: 'refund', label: '退款' },
]

function getErrorMessage(err: any) {
  return (
    err?.response?.data?.message ||
    err?.response?.data?.msg ||
    err?.response?.data?.error ||
    err?.message ||
    '操作失败'
  )
}

function normalizeNumber(v: unknown, fallback = NaN) {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').trim())
  return Number.isFinite(n) ? n : fallback
}

function normalizeId(r: WalletLogRaw, idx: number) {
  const id =
    r?.id ??
    r?.log_id ??
    r?.logId ??
    r?.wallet_log_id ??
    r?.walletLogId ??
    r?.uuid ??
    r?.no ??
    r?.sn ??
    `${idx + 1}`
  return typeof id === 'string' || typeof id === 'number' ? id : String(id)
}

function normalizeType(rawType: unknown): string {
  const t = String(rawType ?? '').trim()
  if (!t) return ''

  const lower = t.toLowerCase()
  if (t.includes('充值') || t.includes('入金') || t.includes('加款')) return 'recharge'
  if (t.includes('支付') || t.includes('扣款') || t.includes('支出') || t.includes('消费')) return 'pay'
  if (t.includes('收入') || t.includes('收益') || t.includes('入账') || t.includes('到账')) return 'income'
  if (t.includes('提现') || t.includes('出金') || t.includes('取现')) return 'withdraw'
  if (t.includes('退款')) return 'refund'

  if (lower === 'recharge' || lower === 'topup' || lower === 'deposit') return 'recharge'
  if (lower === 'pay' || lower === 'payment' || lower === 'consume' || lower === 'expense') return 'pay'
  if (lower === 'income' || lower === 'earn' || lower === 'earning') return 'income'
  if (lower === 'withdraw' || lower === 'withdrawal' || lower === 'cashout') return 'withdraw'
  if (lower === 'refund') return 'refund'

  const num = normalizeNumber(rawType, NaN)
  if (Number.isFinite(num)) {
    if (num === 1) return 'recharge'
    if (num === 2) return 'pay'
    if (num === 3) return 'income'
    if (num === 4) return 'withdraw'
    if (num === 5) return 'refund'
  }

  return t
}

function typeLabel(type: string) {
  if (type === 'recharge') return '充值'
  if (type === 'pay') return '支付'
  if (type === 'income') return '收入'
  if (type === 'withdraw') return '提现'
  if (type === 'refund') return '退款'
  return type || '-'
}

function typeBadgeClass(type: string) {
  if (type === 'recharge') return 'badge text-bg-primary'
  if (type === 'income') return 'badge text-bg-success'
  if (type === 'refund') return 'badge text-bg-info'
  if (type === 'pay') return 'badge text-bg-danger'
  if (type === 'withdraw') return 'badge text-bg-warning'
  return 'badge text-bg-secondary'
}

function normalizeText(v: unknown) {
  const s = String(v ?? '').trim()
  return s ? s : ''
}

function deriveTitle(type: string, r: WalletLogRaw) {
  const explicit =
    normalizeText(r?.title) ||
    normalizeText(r?.remark) ||
    normalizeText(r?.note) ||
    normalizeText(r?.desc) ||
    normalizeText(r?.description) ||
    normalizeText(r?.reason) ||
    normalizeText(r?.memo)
  if (explicit) return explicit

  if (type === 'pay') return '发布任务扣款'
  if (type === 'income') return '完成任务获得收益'
  if (type === 'refund') return '取消订单退款'
  if (type === 'recharge') return '充值'
  if (type === 'withdraw') return '提现'
  return '-'
}

function formatMoney(v: unknown) {
  const n = normalizeNumber(v, NaN)
  if (!Number.isFinite(n)) return '-'
  return n.toFixed(2)
}

function formatAmount(n: number) {
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(2)}`
}

function formatTime(v: unknown) {
  if (v === null || v === undefined || v === '') return '-'
  if (typeof v === 'string' && v.trim().length > 0) {
    const s = v.trim()
    const maybeNum = normalizeNumber(s, NaN)
    if (Number.isFinite(maybeNum)) return formatTime(maybeNum)
    const d = new Date(s)
    if (!Number.isNaN(d.getTime())) return d.toLocaleString()
    return s
  }

  if (typeof v === 'number') {
    const ms = v < 1e12 ? v * 1000 : v
    const d = new Date(ms)
    if (!Number.isNaN(d.getTime())) return d.toLocaleString()
    return String(v)
  }

  return String(v)
}

function normalizeListResponse(data: any): { list: WalletLogRaw[]; total: number } {
  if (Array.isArray(data)) return { list: data, total: data.length }

  const root = data?.data ?? data
  const list: WalletLogRaw[] =
    root?.list ?? root?.rows ?? root?.items ?? root?.records ?? root?.result ?? root?.logs ?? root?.data ?? []
  const totalNum = Number(root?.total ?? root?.count ?? root?.pagination?.total ?? (Array.isArray(list) ? list.length : 0))
  const total = Number.isFinite(totalNum) ? totalNum : Array.isArray(list) ? list.length : 0
  return { list: Array.isArray(list) ? list : [], total }
}

function toVM(r: WalletLogRaw, idx: number): WalletLogVM {
  const type = normalizeType(r?.type ?? r?.log_type ?? r?.logType ?? r?.biz_type ?? r?.bizType ?? r?.action)

  const beforeRaw =
    r?.balance_before ?? r?.before_balance ?? r?.prev_balance ?? r?.balanceBefore ?? r?.beforeBalance ?? r?.before
  const afterRaw =
    r?.balance_after ?? r?.after_balance ?? r?.new_balance ?? r?.balanceAfter ?? r?.afterBalance ?? r?.after ?? r?.balance

  const deltaRaw = r?.amount ?? r?.delta ?? r?.change_amount ?? r?.changeAmount ?? r?.money ?? r?.fee

  let balanceBefore = normalizeNumber(beforeRaw, NaN)
  let balanceAfter = normalizeNumber(afterRaw, NaN)
  let amount = normalizeNumber(deltaRaw, NaN)

  const hasBalancePair = Number.isFinite(balanceBefore) && Number.isFinite(balanceAfter)

  if (hasBalancePair) {
    amount = balanceAfter - balanceBefore
  }
  if (!Number.isFinite(balanceBefore) && Number.isFinite(balanceAfter) && Number.isFinite(amount)) {
    balanceBefore = balanceAfter - amount
  }
  if (!Number.isFinite(balanceAfter) && Number.isFinite(balanceBefore) && Number.isFinite(amount)) {
    balanceAfter = balanceBefore + amount
  }

  if (Number.isFinite(amount) && !hasBalancePair) {
    if (type === 'pay' || type === 'withdraw') amount = -Math.abs(amount)
    if (type === 'recharge' || type === 'income' || type === 'refund') amount = Math.abs(amount)
  }

  const orderNoRaw = r?.order_no ?? r?.orderNo ?? r?.order_sn ?? r?.orderSn ?? r?.order_id ?? r?.orderId
  const orderNo = typeof orderNoRaw === 'string' || typeof orderNoRaw === 'number' ? String(orderNoRaw) : undefined

  const createdAt = r?.created_at ?? r?.createdAt ?? r?.time ?? r?.created_time ?? r?.createdTime ?? r?.timestamp

  return {
    id: normalizeId(r, idx),
    type,
    title: deriveTitle(type, r),
    amount: Number.isFinite(amount) ? amount : 0,
    balanceBefore: Number.isFinite(balanceBefore) ? balanceBefore : undefined,
    balanceAfter: Number.isFinite(balanceAfter) ? balanceAfter : undefined,
    orderNo,
    createdAt,
    raw: r,
  }
}

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pagination.pageSize)))

const pageItems = computed<(number | '...')[]>(() => {
  const tp = totalPages.value
  const cur = pagination.page
  if (tp <= 7) return Array.from({ length: tp }, (_, i) => i + 1)

  const items: (number | '...')[] = [1]

  if (cur <= 4) {
    items.push(2, 3, 4, 5, '...', tp)
    return items
  }

  if (cur >= tp - 3) {
    items.push('...', tp - 4, tp - 3, tp - 2, tp - 1, tp)
    return items
  }

  items.push('...', cur - 1, cur, cur + 1, '...', tp)
  return items
})

async function requestLogs(params: Record<string, any>) {
  const endpoints = ['/wallet/log', '/wallet/logs', '/wallet/log/list', '/wallet/logs/list']
  let lastErr: any
  for (const url of endpoints) {
    try {
      return await http.get(url, { params })
    } catch (err: any) {
      const status = err?.response?.status
      if (status === 404 || status === 405) {
        lastErr = err
        continue
      }
      throw err
    }
  }
  throw lastErr
}

async function fetchLogs() {
  loading.value = true
  errorMessage.value = ''
  try {
    const params: Record<string, any> = {
      page: pagination.page,
      pageSize: pagination.pageSize,
      page_size: pagination.pageSize,
    }

    if (filters.type) {
      params.type = filters.type
      params.logType = filters.type
      params.log_type = filters.type
    }

    const start = filters.startDate.trim()
    const end = filters.endDate.trim()
    if (start) {
      params.startDate = start
      params.start_date = start
      params.start_time = start
    }
    if (end) {
      params.endDate = end
      params.end_date = end
      params.end_time = end
    }

    const res = await requestLogs(params)
    const normalized = normalizeListResponse(res.data)
    rows.value = normalized.list.map(toVM)
    total.value = normalized.total

    const tp = Math.max(1, Math.ceil(normalized.total / pagination.pageSize))
    if (pagination.page > tp) {
      pagination.page = tp
      const res2 = await requestLogs({ ...params, page: pagination.page })
      const normalized2 = normalizeListResponse(res2.data)
      rows.value = normalized2.list.map(toVM)
      total.value = normalized2.total
    }
  } catch (err: any) {
    errorMessage.value = getErrorMessage(err)
    rows.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

function onSearch() {
  pagination.page = 1
  fetchLogs()
}

function resetFilters() {
  filters.type = ''
  filters.startDate = ''
  filters.endDate = ''
  pagination.page = 1
  fetchLogs()
}

function onChangePageSize(next: number) {
  pagination.pageSize = next
  pagination.page = 1
  fetchLogs()
}

function goPage(p: number) {
  if (p < 1 || p > totalPages.value || p === pagination.page) return
  pagination.page = p
  fetchLogs()
}

onMounted(() => {
  fetchLogs()
})
</script>

<template>
  <div class="vstack gap-3">
    <div class="d-flex flex-wrap align-items-end justify-content-between gap-2">
      <div>
        <h1 class="h4 mb-1">钱包流水</h1>
        <div class="text-muted">按类型、时间范围筛选查看资金变动</div>
      </div>
      <div class="d-flex gap-2">
        <button class="btn btn-outline-primary" type="button" :disabled="loading" @click="fetchLogs">刷新</button>
      </div>
    </div>

    <div v-if="errorMessage" class="alert alert-danger mb-0" role="alert">{{ errorMessage }}</div>

    <div class="card border-0 shadow-sm">
      <div class="card-body">
        <div class="row g-3">
          <div class="col-12 col-md-4 col-lg-3">
            <label class="form-label text-muted small mb-1">类型</label>
            <select v-model="filters.type" class="form-select" :disabled="loading">
              <option v-for="it in typeOptions" :key="it.value || 'all'" :value="it.value">{{ it.label }}</option>
            </select>
          </div>

          <div class="col-12 col-md-4 col-lg-3">
            <label class="form-label text-muted small mb-1">开始日期</label>
            <input v-model="filters.startDate" class="form-control" type="date" :disabled="loading" />
          </div>

          <div class="col-12 col-md-4 col-lg-3">
            <label class="form-label text-muted small mb-1">结束日期</label>
            <input v-model="filters.endDate" class="form-control" type="date" :disabled="loading" />
          </div>

          <div class="col-12 col-lg-3">
            <label class="form-label text-muted small mb-1">每页</label>
            <select
              class="form-select"
              :value="pagination.pageSize"
              :disabled="loading"
              @change="onChangePageSize(Number(($event.target as HTMLSelectElement).value))"
            >
              <option v-for="s in pageSizeOptions" :key="s" :value="s">{{ s }}</option>
            </select>
          </div>

          <div class="col-12 d-flex gap-2">
            <button class="btn btn-outline-primary" type="button" :disabled="loading" @click="resetFilters">重置</button>
            <button class="btn btn-primary" type="button" :disabled="loading" @click="onSearch">筛选</button>
          </div>
        </div>

        <div class="d-flex flex-wrap justify-content-between align-items-center mt-3 gap-2">
          <div class="text-muted small">共 {{ total }} 条 · 第 {{ pagination.page }} / {{ totalPages }} 页</div>
          <div v-if="loading" class="text-muted small">加载中…</div>
        </div>

        <div v-if="loading && rows.length === 0" class="placeholder-glow mt-3">
          <div class="placeholder col-12 mb-2" />
          <div class="placeholder col-10 mb-2" />
          <div class="placeholder col-11" />
        </div>

        <div v-else class="table-responsive mt-3">
          <table class="table table-hover align-middle">
            <thead>
              <tr>
                <th class="text-nowrap">类型</th>
                <th class="text-nowrap">说明</th>
                <th class="text-nowrap">金额</th>
                <th class="text-nowrap">余额变化</th>
                <th class="text-nowrap">关联订单</th>
                <th class="text-nowrap">时间</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="rows.length === 0">
                <td colspan="6" class="text-muted text-center py-4">暂无数据</td>
              </tr>
              <tr v-for="r in rows" :key="r.id">
                <td class="text-nowrap"><span :class="typeBadgeClass(r.type)">{{ typeLabel(r.type) }}</span></td>
                <td class="text-nowrap">{{ r.title }}</td>
                <td class="text-nowrap" :class="r.amount >= 0 ? 'text-success' : 'text-danger'">
                  {{ formatAmount(r.amount) }}
                </td>
                <td class="text-nowrap text-muted">
                  <span v-if="r.balanceBefore !== undefined && r.balanceAfter !== undefined">
                    {{ formatMoney(r.balanceBefore) }} → {{ formatMoney(r.balanceAfter) }}
                  </span>
                  <span v-else>-</span>
                </td>
                <td class="text-nowrap">
                  <span v-if="r.orderNo" class="font-monospace">{{ r.orderNo }}</span>
                  <span v-else class="text-muted">-</span>
                </td>
                <td class="text-nowrap text-muted">{{ formatTime(r.createdAt) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mt-3">
          <div class="text-muted small">显示 {{ rows.length }} 条</div>
          <nav aria-label="Pagination">
            <ul class="pagination mb-0">
              <li class="page-item" :class="{ disabled: pagination.page <= 1 || loading }">
                <button class="page-link" type="button" @click="goPage(pagination.page - 1)">上一页</button>
              </li>
              <li
                v-for="it in pageItems"
                :key="String(it)"
                class="page-item"
                :class="{ active: it === pagination.page, disabled: it === '...' || loading }"
              >
                <button v-if="it !== '...'" class="page-link" type="button" @click="goPage(it as number)">{{ it }}</button>
                <span v-else class="page-link">…</span>
              </li>
              <li class="page-item" :class="{ disabled: pagination.page >= totalPages || loading }">
                <button class="page-link" type="button" @click="goPage(pagination.page + 1)">下一页</button>
              </li>
            </ul>
          </nav>
        </div>
      </div>
    </div>
  </div>
</template>
