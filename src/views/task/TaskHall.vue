<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'

import { http } from '@/api/request'
import { listTasks, type TaskListItem } from '@/api/task'
import { useAuthStore } from '@/stores/auth'

type SortOption = 'time_desc' | 'time_asc' | 'price_desc' | 'price_asc'

const auth = useAuthStore()

const filters = reactive({
  keyword: '',
  sort: 'time_desc' as SortOption,
  urgency: 'all' as 'all' | 'urgent' | 'normal',
  price: 'all' as 'all' | 'under10' | '10to20' | 'over20',
  distance: 'all' as 'all' | 'under1' | '1to3' | 'over3',
})

const loading = ref(false)
const errorMessage = ref('')
const rows = ref<TaskListItem[]>([])
const total = ref(0)
const autoCancelTimeoutMinutes = ref(0)
const countdownNow = ref(Date.now())
const autoCancelDeadlineMap = ref<Record<string, number | null>>({})

let countdownTimer: number | null = null
let searchTimer: number | null = null
let loadMoreObserver: IntersectionObserver | null = null
let lastExpiredRefreshAt = 0
const loadMoreSentinel = ref<HTMLElement | null>(null)

const pagination = reactive({
  page: 1,
  pageSize: 10,
})

const busyAcceptTaskId = ref<string | number | null>(null)

const totalPages = computed(() => {
  const t = Math.max(0, Number(total.value) || 0)
  const ps = Math.max(1, Number(pagination.pageSize) || 10)
  return Math.max(1, Math.ceil(t / ps))
})

const hasMore = computed(() => pagination.page < totalPages.value)
const isRunner = computed(() => auth.role === 'runner')
const isFrozen = computed(() => Boolean(auth.isFrozen))

function isPendingTask(task: TaskListItem) {
  const status = String((task as any)?.status ?? '').trim()
  return status === 'PENDING'
}

function taskIdOf(task: TaskListItem): string {
  const raw =
    (task as any)?.id ??
    (task as any)?.task_id ??
    (task as any)?.taskId ??
    (task as any)?._id ??
    (task as any)?.uid ??
    (task as any)?.task_no ??
    (task as any)?.taskNo

  const s = String(raw ?? '').trim()
  return s
}

function taskKeyOf(task: TaskListItem): string {
  const id = taskIdOf(task)
  if (id) return id

  const pickup = normalizeText((task as any)?.pickup_address ?? (task as any)?.pickupAddress)
  const delivery = normalizeText((task as any)?.delivery_address ?? (task as any)?.deliveryAddress)
  const createdAt = normalizeText((task as any)?.created_at ?? (task as any)?.createdAt)
  const price = String(toTotalPrice(task))
  return `${createdAt}|${pickup}|${delivery}|${price}`.trim() || 'task'
}

function getErrorMessage(err: any) {
  const data = err?.response?.data
  if (typeof data === 'string' && data.trim()) return data.trim()
  const msg =
    data?.message ||
    data?.msg ||
    data?.error ||
    data?.data?.message ||
    data?.data?.msg ||
    data?.data?.error ||
    err?.message

  const base = String(msg ?? '操作失败')
  const status = Number(err?.response?.status)
  if (status === 404) {
    return `${base}（接口 404，请检查 vite.config.ts：/api 代理到 http://localhost:3000）`
  }
  return base
}

function normalizeText(v: unknown) {
  return String(v ?? '').trim()
}

function formatMoney(v: unknown) {
  const n = Number(v)
  return (Number.isFinite(n) ? n : 0).toFixed(2)
}

function toIsoString(v: unknown) {
  const s = normalizeText(v)
  return s
}

function formatTime(v: unknown) {
  const raw = toIsoString(v)
  if (!raw) return '—'
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`
}

function normalizeNumber(v: unknown) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const s = normalizeText(v)
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

function toTimestampMs(v: unknown) {
  if (v instanceof Date) {
    const time = v.getTime()
    return Number.isFinite(time) ? time : null
  }

  const n = normalizeNumber(v)
  if (n !== null) {
    if (n <= 0) return null
    return n >= 1e12 ? Math.round(n) : Math.round(n * 1000)
  }

  const raw = normalizeText(v)
  if (!raw) return null
  const d = new Date(raw)
  const time = d.getTime()
  return Number.isFinite(time) ? time : null
}

function normalizeConfigPayload(data: any): Record<string, any> {
  const root = data?.data ?? data
  if (Array.isArray(root?.items)) {
    const map: Record<string, any> = {}
    root.items.forEach((item: any) => {
      const key = String(item?.key ?? item?.name ?? '').trim()
      if (key) map[key] = item?.value
    })
    return map
  }
  if (root && typeof root === 'object' && !Array.isArray(root)) return root
  return {}
}

function flattenObject(input: any, prefix = '', out: Record<string, any> = {}) {
  if (!input || typeof input !== 'object') return out
  const entries = Array.isArray(input) ? input.entries() : Object.entries(input)
  for (const e of entries as any) {
    const key = Array.isArray(input) ? String(e[0]) : String(e[0])
    const value = Array.isArray(input) ? e[1] : e[1]
    const nextKey = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      flattenObject(value, nextKey, out)
    } else {
      out[nextKey] = value
    }
  }
  return out
}

function pickConfigNumber(flat: Record<string, any>, candidates: string[], fallback = 0) {
  for (const key of candidates) {
    if (Object.prototype.hasOwnProperty.call(flat, key)) {
      const n = normalizeNumber(flat[key])
      return n === null ? fallback : n
    }
  }
  return fallback
}

async function loadTimeoutConfig() {
  try {
    const response = await http.get('/config/public')
    const configMap = normalizeConfigPayload(response.data)
    const flat = flattenObject(configMap)
    autoCancelTimeoutMinutes.value = pickConfigNumber(
      flat,
      ['pending_accept_minutes', 'pendingAcceptMinutes', 'timeout.pending_accept_minutes'],
      0,
    )
    syncAutoCancelDeadlines(rows.value)
  } catch {
    autoCancelTimeoutMinutes.value = 0
  }
}

function toTotalPrice(task: TaskListItem) {
  const fee = Number((task as any).fee_total ?? (task as any).fee ?? 0)
  const tip = Number((task as any).tip ?? 0)
  const totalPrice = (Number.isFinite(fee) ? fee : 0) + (Number.isFinite(tip) ? tip : 0)
  return totalPrice
}

// 计算取件点到送达点的距离（Haversine 公式）
function getTaskDistance(task: TaskListItem): number | null {
  const pickupLat = Number((task as any).pickup_lat ?? (task as any).pickupLat)
  const pickupLng = Number((task as any).pickup_lng ?? (task as any).pickupLng)
  const deliveryLat = Number((task as any).delivery_lat ?? (task as any).deliveryLat)
  const deliveryLng = Number((task as any).delivery_lng ?? (task as any).deliveryLng)

  if (!Number.isFinite(pickupLat) || !Number.isFinite(pickupLng) ||
      !Number.isFinite(deliveryLat) || !Number.isFinite(deliveryLng)) {
    return null
  }

  const rad = (deg: number) => (deg * Math.PI) / 180
  const R = 6371000 // 地球半径（米）
  const dLat = rad(deliveryLat - pickupLat)
  const dLng = rad(deliveryLng - pickupLng)
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(rad(pickupLat)) * Math.cos(rad(deliveryLat)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const dist = R * c
  return Number.isFinite(dist) ? dist : null
}

function formatDistanceMeters(v: number | null) {
  if (!Number.isFinite(Number(v)) || (v as number) < 0) return '—'
  const meters = Number(v)
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters / 1000).toFixed(2)} km`
}

function toEtaMinutesByMeters(meters: number | null) {
  if (!Number.isFinite(Number(meters)) || (meters as number) < 0) return null
  const km = Number(meters) / 1000
  const minutes = Math.ceil(km * 2 + 10)
  return Number.isFinite(minutes) ? minutes : null
}

function formatEtaMinutes(v: number | null) {
  if (!Number.isFinite(Number(v)) || (v as number) <= 0) return '—'
  const minutes = Math.round(Number(v))
  if (minutes < 60) return `${minutes} 分钟`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h} 小时 ${m} 分钟` : `${h} 小时`
}

function getTaskEtaMinutes(task: TaskListItem) {
  const dist = getTaskDistance(task)
  return toEtaMinutesByMeters(dist)
}

function sortKeyForApi(sort: SortOption) {
  if (sort === 'time_desc') return 'created_at_desc'
  if (sort === 'time_asc') return 'created_at_asc'
  if (sort === 'price_desc') return 'fee_total_desc'
  return 'fee_total_asc'
}

function resolveAutoCancelDeadlineMs(task: TaskListItem, nowMs = Date.now()) {
  const absoluteCandidates = [
    (task as any)?.auto_cancel_at,
    (task as any)?.autoCancelAt,
    (task as any)?.cancel_at,
    (task as any)?.cancelAt,
    (task as any)?.expire_at,
    (task as any)?.expireAt,
    (task as any)?.expires_at,
    (task as any)?.expiresAt,
    (task as any)?.deadline_at,
    (task as any)?.deadlineAt,
    (task as any)?.pending_expire_at,
    (task as any)?.pendingExpireAt,
  ]

  for (const candidate of absoluteCandidates) {
    const ts = toTimestampMs(candidate)
    if (ts !== null) return ts
  }

  const remainingSecondsCandidates = [
    (task as any)?.auto_cancel_remaining_seconds,
    (task as any)?.autoCancelRemainingSeconds,
    (task as any)?.remaining_seconds,
    (task as any)?.remainingSeconds,
    (task as any)?.remain_seconds,
    (task as any)?.remainSeconds,
  ]

  for (const candidate of remainingSecondsCandidates) {
    const seconds = normalizeNumber(candidate)
    if (seconds !== null && seconds >= 0) return nowMs + seconds * 1000
  }

  const remainingMinutesCandidates = [
    (task as any)?.auto_cancel_remaining_minutes,
    (task as any)?.autoCancelRemainingMinutes,
    (task as any)?.remaining_minutes,
    (task as any)?.remainingMinutes,
    (task as any)?.remain_minutes,
    (task as any)?.remainMinutes,
  ]

  for (const candidate of remainingMinutesCandidates) {
    const minutes = normalizeNumber(candidate)
    if (minutes !== null && minutes >= 0) return nowMs + minutes * 60 * 1000
  }

  const createdAtMs = toTimestampMs((task as any)?.created_at ?? (task as any)?.createdAt)
  if (createdAtMs !== null && autoCancelTimeoutMinutes.value > 0) {
    return createdAtMs + autoCancelTimeoutMinutes.value * 60 * 1000
  }

  return null
}

function syncAutoCancelDeadlines(list: TaskListItem[]) {
  const nowMs = Date.now()
  const next: Record<string, number | null> = {}
  list.forEach((task) => {
    next[taskKeyOf(task)] = resolveAutoCancelDeadlineMs(task, nowMs)
  })
  autoCancelDeadlineMap.value = next
}

function getTaskAutoCancelDeadlineMs(task: TaskListItem) {
  const key = taskKeyOf(task)
  const deadline = autoCancelDeadlineMap.value[key]
  return typeof deadline === 'number' && Number.isFinite(deadline) ? deadline : null
}

function getTaskAutoCancelRemainingMs(task: TaskListItem) {
  const deadline = getTaskAutoCancelDeadlineMs(task)
  if (deadline === null) return null
  return Math.max(0, deadline - countdownNow.value)
}

function isTaskAutoExpired(task: TaskListItem) {
  const deadline = getTaskAutoCancelDeadlineMs(task)
  return deadline !== null && deadline <= countdownNow.value
}

function formatAutoCancelCountdown(task: TaskListItem) {
  const remainingMs = getTaskAutoCancelRemainingMs(task)
  if (remainingMs === null) return '—'
  if (remainingMs <= 0) return '0小时0分钟'

  const totalMinutes = Math.ceil(remainingMs / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${hours}小时${minutes}分钟`
}

function refreshExpiredTasksIfNeeded() {
  if (loading.value) return
  if (!rows.value.some(isTaskAutoExpired)) return

  const nowMs = Date.now()
  if (nowMs - lastExpiredRefreshAt < 5000) return
  lastExpiredRefreshAt = nowMs

  fetchList()
}

function startCountdownTimer() {
  if (countdownTimer !== null) return
  countdownTimer = window.setInterval(() => {
    countdownNow.value = Date.now()
    refreshExpiredTasksIfNeeded()
  }, 1000)
}

function stopCountdownTimer() {
  if (countdownTimer === null) return
  window.clearInterval(countdownTimer)
  countdownTimer = null
}

const displayRows = computed(() => {
  const activeRows = rows.value.filter((t) => !isTaskAutoExpired(t))
  const keyword = filters.keyword.trim().toLowerCase()
  const filtered = keyword
    ? activeRows.filter((t) => {
        const pickup = normalizeText((t as any).pickup_address ?? (t as any).pickupAddress).toLowerCase()
        const delivery = normalizeText((t as any).delivery_address ?? (t as any).deliveryAddress).toLowerCase()
        const remark = normalizeText((t as any).remark ?? (t as any).note).toLowerCase()
        return pickup.includes(keyword) || delivery.includes(keyword) || remark.includes(keyword)
      })
    : activeRows.slice()

  const ranged = filtered.filter((task) => {
    const remainingMs = getTaskAutoCancelRemainingMs(task) ?? Number.POSITIVE_INFINITY
    const price = toTotalPrice(task)
    const distanceKm = (getTaskDistance(task) ?? 0) / 1000
    if (filters.urgency === 'urgent' && remainingMs > 10 * 60_000) return false
    if (filters.urgency === 'normal' && remainingMs <= 10 * 60_000) return false
    if (filters.price === 'under10' && price >= 10) return false
    if (filters.price === '10to20' && (price < 10 || price > 20)) return false
    if (filters.price === 'over20' && price < 20) return false
    if (filters.distance === 'under1' && distanceKm >= 1) return false
    if (filters.distance === '1to3' && (distanceKm < 1 || distanceKm > 3)) return false
    if (filters.distance === 'over3' && distanceKm < 3) return false
    return true
  })

  const sorted = ranged.slice().sort((a, b) => {
    if (filters.sort === 'time_desc' || filters.sort === 'time_asc') {
      const ta = new Date(String((a as any).created_at ?? (a as any).createdAt ?? '')).getTime()
      const tb = new Date(String((b as any).created_at ?? (b as any).createdAt ?? '')).getTime()
      const va = Number.isFinite(ta) ? ta : 0
      const vb = Number.isFinite(tb) ? tb : 0
      return filters.sort === 'time_desc' ? vb - va : va - vb
    }

    const pa = toTotalPrice(a)
    const pb = toTotalPrice(b)
    return filters.sort === 'price_desc' ? pb - pa : pa - pb
  })

  return sorted
})

async function fetchList(append = false) {
  if (loading.value) return
  loading.value = true
  errorMessage.value = ''

  try {
    const query: Record<string, any> = {
      page: pagination.page,
      pageSize: pagination.pageSize,
      status: 'PENDING',
      keyword: filters.keyword.trim() || undefined,
      sort: sortKeyForApi(filters.sort),
    }

    const res = await listTasks(query as any)
    const list = res.list || []
    const hasStatusField = list.some((t) => String((t as any)?.status ?? '').trim().length > 0)
    const hasNonPending = hasStatusField && list.some((t) => !isPendingTask(t))
    const finalList = hasNonPending ? list.filter(isPendingTask) : list
    if (append) {
      const merged = [...rows.value, ...finalList]
      rows.value = Array.from(new Map(merged.map((task) => [taskKeyOf(task), task])).values())
    } else {
      rows.value = finalList
    }
    syncAutoCancelDeadlines(rows.value)
    total.value = hasNonPending ? finalList.length : Number(res.total ?? finalList.length) || 0
  } catch (err: any) {
    errorMessage.value = getErrorMessage(err)
  } finally {
    loading.value = false
  }
}

function onSearch() {
  pagination.page = 1
  fetchList(false)
}

watch(
  () => filters.keyword,
  () => {
    if (searchTimer !== null) window.clearTimeout(searchTimer)
    searchTimer = window.setTimeout(onSearch, 500)
  },
)

function resetFilters() {
  filters.keyword = ''
  filters.sort = 'time_desc'
  filters.urgency = 'all'
  filters.price = 'all'
  filters.distance = 'all'
  pagination.page = 1
  fetchList()
}

async function accept(id: string | number) {
  if (!isRunner.value) return
  if (isFrozen.value) {
    ElMessage.warning('账号已冻结，无法抢单')
    return
  }
  if (busyAcceptTaskId.value !== null) return

  const token = String(auth.token || localStorage.getItem('ce_token') || '').trim()
  if (!token) {
    ElMessage.error('未登录或登录已过期')
    return
  }

  const rawId = String(id ?? '').trim()
  if (!rawId) {
    ElMessage.error('任务ID缺失，无法抢单')
    return
  }

  busyAcceptTaskId.value = rawId
  try {
    const taskId = encodeURIComponent(rawId)
    await http.post(`/order/accept/${taskId}`, undefined, {
      headers: { Authorization: `Bearer ${token}` },
    })
    ElMessage.success('抢单成功')
    if (rows.value.length === 1 && pagination.page > 1) pagination.page -= 1
    pagination.page = 1
    await fetchList(false)
  } catch (err: any) {
    ElMessage.error(getErrorMessage(err))
  } finally {
    busyAcceptTaskId.value = null
  }
}

function loadMore() {
  if (!hasMore.value || loading.value) return
  pagination.page += 1
  fetchList(true)
}

function setupLoadMoreObserver() {
  loadMoreObserver?.disconnect()
  if (!loadMoreSentinel.value) return
  loadMoreObserver = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) loadMore()
    },
    { rootMargin: '240px 0px' },
  )
  loadMoreObserver.observe(loadMoreSentinel.value)
}

onMounted(() => {
  startCountdownTimer()
  void Promise.allSettled([loadTimeoutConfig(), fetchList(false)]).finally(() => nextTick(setupLoadMoreObserver))
})

onBeforeUnmount(() => {
  stopCountdownTimer()
  if (searchTimer !== null) window.clearTimeout(searchTimer)
  loadMoreObserver?.disconnect()
})
</script>

<template>
  <div class="vstack gap-3">
    <div class="d-flex flex-wrap align-items-end justify-content-between gap-2">
      <div>
        <h1 class="h4 mb-1">任务大厅</h1>
        <div class="text-muted">待接单任务（PENDING）</div>
      </div>
      <div class="d-flex gap-2">
        <button class="btn btn-outline-primary" type="button" :disabled="loading" @click="fetchList(false)">刷新</button>
      </div>
    </div>

    <div v-if="errorMessage" class="alert alert-danger mb-0" role="alert">{{ errorMessage }}</div>

    <div class="card border-0 shadow-sm">
      <div class="card-body">
        <div class="row g-3 align-items-end">
          <div class="col-12 col-md-7 col-lg-8">
            <label class="form-label text-muted small mb-1">关键词</label>
            <input
              v-model="filters.keyword"
              class="form-control"
              placeholder="搜索取件/送达地址、备注"
              :disabled="loading"
              @keyup.enter="onSearch"
            />
          </div>
          <div class="col-12 col-md-5 col-lg-4">
            <label class="form-label text-muted small mb-1">排序</label>
            <select v-model="filters.sort" class="form-select" :disabled="loading" @change="onSearch">
              <option value="time_desc">时间：最新</option>
              <option value="time_asc">时间：最早</option>
              <option value="price_desc">价格：从高到低</option>
              <option value="price_asc">价格：从低到高</option>
            </select>
          </div>

          <div class="col-12">
            <div class="filter-toolbar">
              <div class="filter-block">
                <span class="filter-label">时效</span>
                <button v-for="option in [{ label: '全部', value: 'all' }, { label: '10分钟内', value: 'urgent' }, { label: '较宽松', value: 'normal' }]" :key="option.value" class="filter-chip" :class="{ active: filters.urgency === option.value }" type="button" @click="filters.urgency = option.value as any">{{ option.label }}</button>
              </div>
              <div class="filter-block">
                <span class="filter-label">价格</span>
                <button v-for="option in [{ label: '全部', value: 'all' }, { label: '¥10内', value: 'under10' }, { label: '¥10-20', value: '10to20' }, { label: '¥20+', value: 'over20' }]" :key="option.value" class="filter-chip" :class="{ active: filters.price === option.value }" type="button" @click="filters.price = option.value as any">{{ option.label }}</button>
              </div>
              <div class="filter-block">
                <span class="filter-label">距离</span>
                <button v-for="option in [{ label: '全部', value: 'all' }, { label: '1km内', value: 'under1' }, { label: '1-3km', value: '1to3' }, { label: '3km+', value: 'over3' }]" :key="option.value" class="filter-chip" :class="{ active: filters.distance === option.value }" type="button" @click="filters.distance = option.value as any">{{ option.label }}</button>
              </div>
            </div>
          </div>

          <div class="col-12 d-flex gap-2">
            <button class="btn btn-outline-primary" type="button" :disabled="loading" @click="resetFilters">重置</button>
            <span class="text-muted small align-self-center">输入后 500ms 自动搜索</span>
          </div>
        </div>

        <div class="d-flex flex-wrap justify-content-between align-items-center mt-3 gap-2">
          <div class="text-muted small">共 {{ total }} 条 · 已加载 {{ rows.length }} 条</div>
          <div v-if="loading" class="text-muted small">加载中…</div>
        </div>

        <div v-if="loading && displayRows.length === 0" class="placeholder-glow mt-3">
          <div class="placeholder col-12 mb-2" />
          <div class="placeholder col-10 mb-2" />
          <div class="placeholder col-11" />
        </div>

        <div v-else class="mt-3 vstack gap-2">
          <div v-if="displayRows.length === 0" class="task-empty">
            <svg class="empty-illustration" viewBox="0 0 240 180" aria-hidden="true"><rect x="34" y="34" width="172" height="112" rx="28" fill="#eef3ff"/><path d="m78 78 42-22 42 22-42 22-42-22Z" fill="#fff" stroke="#3b82f6" stroke-width="5"/><path d="M78 78v45l42 22 42-22V78m-42 22v45" fill="#fff" stroke="#3b82f6" stroke-width="5" stroke-linejoin="round"/><circle cx="187" cy="48" r="11" fill="#f59e0b"/></svg>
            <div class="fw-semibold">暂时没有匹配的任务</div>
            <div class="text-muted small">调整筛选条件，或发布一个新的跑腿需求</div>
            <div class="d-flex gap-2 mt-2">
              <button class="btn btn-outline-primary" type="button" @click="resetFilters">重置筛选</button>
              <RouterLink class="btn btn-primary" to="/task/publish">发布任务</RouterLink>
            </div>
          </div>

          <div v-for="t in displayRows" :key="taskKeyOf(t)" class="task-card card shadow-sm">
            <div class="card-body">
              <div class="d-flex flex-wrap align-items-start justify-content-between gap-2">
                <div class="task-route vstack gap-2">
                  <div class="route-line-item"><span class="route-dot pickup"/><span class="route-label">取</span><strong>{{ (t as any).pickup_address || (t as any).pickupAddress || '—' }}</strong></div>
                  <div class="route-line-item"><span class="route-dot delivery"/><span class="route-label">送</span><strong>{{ (t as any).delivery_address || (t as any).deliveryAddress || '—' }}</strong></div>
                  <div v-if="(t as any).remark" class="task-remark text-muted small">{{ (t as any).remark }}</div>
                  <div class="task-meta text-muted small">
                    <span>{{ formatTime((t as any).created_at || (t as any).createdAt) }}</span>
                    <span>自动取消 {{ formatAutoCancelCountdown(t) }}</span>
                    <span>{{ formatDistanceMeters(getTaskDistance(t)) }}</span>
                    <span>预计 {{ formatEtaMinutes(getTaskEtaMinutes(t)) }}</span>
                  </div>
                </div>

                <div class="text-end">
                  <div class="task-price">¥{{ formatMoney(toTotalPrice(t)) }}</div>
                  <button
                    v-if="isRunner"
                    class="btn btn-primary btn-sm mt-2"
                    type="button"
                    :disabled="loading || busyAcceptTaskId !== null || isFrozen"
                    @click="accept(taskIdOf(t))"
                  >
                    <span
                      v-if="busyAcceptTaskId === taskIdOf(t)"
                      class="spinner-border spinner-border-sm me-2"
                      aria-hidden="true"
                    />
                    抢单
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div ref="loadMoreSentinel" class="load-more-state">
            <span v-if="loading">正在加载更多…</span>
            <span v-else-if="hasMore">继续下滑加载更多</span>
            <span v-else-if="rows.length > 0">已加载全部 {{ rows.length }} 条任务</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.filter-toolbar { display: grid; gap: 10px; padding: 14px; border-radius: 12px; background: var(--color-fill); }
.filter-block { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.filter-label { width: 44px; color: var(--color-text-muted); font-size: 0.8rem; }
.filter-chip {
  border: 1px solid transparent;
  border-radius: var(--radius-pill);
  padding: 5px 11px;
  background: var(--color-surface);
  color: var(--color-text-secondary);
  font-size: 0.8rem;
}
.filter-chip.active { border-color: #bfdbfe; background: var(--color-primary-soft); color: var(--color-primary); font-weight: 600; }
.task-card { border-color: #eef0f3; transition: transform var(--transition-fast), box-shadow var(--transition-fast); }
.task-card:hover { transform: translateY(-1px); box-shadow: var(--shadow-md) !important; }
.task-route { min-width: min(540px, 100%); }
.route-line-item { display: grid; grid-template-columns: 10px 24px minmax(0, 1fr); align-items: center; gap: 8px; }
.route-dot { width: 9px; height: 9px; border-radius: 50%; }
.route-dot.pickup { background: var(--color-success); }
.route-dot.delivery { background: var(--color-danger); }
.route-label { color: var(--color-text-muted); font-size: 0.75rem; }
.task-remark { border-left: 3px solid #bfdbfe; border-radius: 4px; padding: 7px 10px; background: #f8fafc; }
.task-meta { display: flex; flex-wrap: wrap; gap: 6px 16px; }
.task-meta span:not(:last-child)::after { content: '·'; margin-left: 16px; color: var(--color-border-strong); }
.task-price { color: var(--color-danger); font-size: 1.45rem; font-weight: 750; white-space: nowrap; }
.task-empty { display: flex; min-height: 320px; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
.empty-illustration { width: 220px; max-width: 80%; height: auto; }
.load-more-state { min-height: 48px; padding: 14px; color: var(--color-text-muted); text-align: center; }
@media (max-width: 575.98px) {
  .filter-label { width: 100%; }
  .task-route { min-width: 100%; }
  .task-meta span::after { display: none; }
}
</style>
