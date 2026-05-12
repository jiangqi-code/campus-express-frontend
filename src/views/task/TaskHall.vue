<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'

import { http } from '@/api/request'
import { listTasks, type TaskListItem } from '@/api/task'
import { useAuthStore } from '@/stores/auth'

type SortOption = 'time_desc' | 'time_asc' | 'price_desc' | 'price_asc'

const auth = useAuthStore()

const filters = reactive({
  keyword: '',
  sort: 'time_desc' as SortOption,
})

const loading = ref(false)
const errorMessage = ref('')
const rows = ref<TaskListItem[]>([])
const total = ref(0)

const pagination = reactive({
  page: 1,
  pageSize: 10,
})

const busyAcceptTaskId = ref<string | number | null>(null)

const location = reactive<{ lat?: number; lng?: number }>({})

const simulatedDistanceCache = new Map<string, number>()

const totalPages = computed(() => {
  const t = Math.max(0, Number(total.value) || 0)
  const ps = Math.max(1, Number(pagination.pageSize) || 10)
  return Math.max(1, Math.ceil(t / ps))
})

const canPrev = computed(() => pagination.page > 1 && !loading.value)
const canNext = computed(() => pagination.page < totalPages.value && !loading.value)
const isRunner = computed(() => auth.role === 'runner')

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

function toTotalPrice(task: TaskListItem) {
  const fee = Number((task as any).fee_total ?? (task as any).fee ?? 0)
  const tip = Number((task as any).tip ?? 0)
  const totalPrice = (Number.isFinite(fee) ? fee : 0) + (Number.isFinite(tip) ? tip : 0)
  return totalPrice
}

function getTaskDistance(task: TaskListItem): number | null {
  const direct = Number((task as any).distance)
  if (Number.isFinite(direct) && direct >= 0) {
    const normalizedMeters = direct < 100 ? direct * 1000 : direct
    return normalizedMeters
  }

  const lat = Number(
    (task as any).lat ??
      (task as any).pickup_lat ??
      (task as any).pickupLat ??
      (task as any).pickupLatitude ??
      (task as any).latitude,
  )
  const lng = Number(
    (task as any).lng ??
      (task as any).pickup_lng ??
      (task as any).pickupLng ??
      (task as any).pickupLongitude ??
      (task as any).longitude,
  )

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (!Number.isFinite(Number(location.lat)) || !Number.isFinite(Number(location.lng))) return null
  const aLat = Number(location.lat)
  const aLng = Number(location.lng)
  const bLat = lat
  const bLng = lng

  const rad = (deg: number) => (deg * Math.PI) / 180
  const R = 6371000
  const dLat = rad(bLat - aLat)
  const dLng = rad(bLng - aLng)
  const s1 = Math.sin(dLat / 2)
  const s2 = Math.sin(dLng / 2)
  const c = s1 * s1 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * s2 * s2
  const dist = 2 * R * Math.asin(Math.min(1, Math.sqrt(c)))
  return Number.isFinite(dist) ? dist : null
}

function hashStringToUint32(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function pseudoRandom01(seed: number) {
  let t = seed + 0x6d2b79f5
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

function getSimulatedDistanceMeters(task: TaskListItem) {
  const dist = getTaskDistance(task)
  if (Number.isFinite(Number(dist)) && (dist as number) >= 0) return Number(dist)

  const key = taskKeyOf(task) || taskIdOf(task) || 'task'
  const cached = simulatedDistanceCache.get(key)
  if (cached !== undefined) return cached

  const r = pseudoRandom01(hashStringToUint32(key))
  const km = 1 + r * 4
  const meters = Math.round(km * 1000)
  simulatedDistanceCache.set(key, meters)
  return meters
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
  return toEtaMinutesByMeters(getSimulatedDistanceMeters(task))
}

function sortKeyForApi(sort: SortOption) {
  if (sort === 'time_desc') return 'created_at_desc'
  if (sort === 'time_asc') return 'created_at_asc'
  if (sort === 'price_desc') return 'fee_total_desc'
  return 'fee_total_asc'
}

const displayRows = computed(() => {
  const keyword = filters.keyword.trim().toLowerCase()
  const filtered = keyword
    ? rows.value.filter((t) => {
        const pickup = normalizeText((t as any).pickup_address ?? (t as any).pickupAddress).toLowerCase()
        const delivery = normalizeText((t as any).delivery_address ?? (t as any).deliveryAddress).toLowerCase()
        const remark = normalizeText((t as any).remark ?? (t as any).note).toLowerCase()
        return pickup.includes(keyword) || delivery.includes(keyword) || remark.includes(keyword)
      })
    : rows.value.slice()

  const sorted = filtered.slice().sort((a, b) => {
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

async function ensureGeolocation() {
  if (!('geolocation' in navigator)) return
  if (Number.isFinite(Number(location.lat)) && Number.isFinite(Number(location.lng))) return

  await new Promise<void>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        location.lat = pos.coords.latitude
        location.lng = pos.coords.longitude
        resolve()
      },
      () => resolve(),
      { timeout: 6000, maximumAge: 60_000, enableHighAccuracy: false },
    )
  })
}

async function fetchList() {
  if (loading.value) return
  loading.value = true
  errorMessage.value = ''

  try {
    await ensureGeolocation()

    const query: Record<string, any> = {
      page: pagination.page,
      pageSize: pagination.pageSize,
      status: 'PENDING',
      keyword: filters.keyword.trim() || undefined,
      sort: sortKeyForApi(filters.sort),
    }

    if (Number.isFinite(Number(location.lat)) && Number.isFinite(Number(location.lng))) {
      query.lat = Number(location.lat)
      query.lng = Number(location.lng)
    }

    const res = await listTasks(query as any)
    const list = res.list || []
    const hasStatusField = list.some((t) => String((t as any)?.status ?? '').trim().length > 0)
    const hasNonPending = hasStatusField && list.some((t) => !isPendingTask(t))
    const finalList = hasNonPending ? list.filter(isPendingTask) : list
    rows.value = finalList
    total.value = hasNonPending ? finalList.length : Number(res.total ?? finalList.length) || 0
  } catch (err: any) {
    errorMessage.value = getErrorMessage(err)
  } finally {
    loading.value = false
  }
}

function onSearch() {
  pagination.page = 1
  fetchList()
}

function resetFilters() {
  filters.keyword = ''
  filters.sort = 'time_desc'
  pagination.page = 1
  fetchList()
}

async function accept(id: string | number) {
  if (!isRunner.value) return
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
    await fetchList()
  } catch (err: any) {
    ElMessage.error(getErrorMessage(err))
  } finally {
    busyAcceptTaskId.value = null
  }
}

function prevPage() {
  if (!canPrev.value) return
  pagination.page -= 1
  fetchList()
}

function nextPage() {
  if (!canNext.value) return
  pagination.page += 1
  fetchList()
}

onMounted(() => {
  fetchList()
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
        <button class="btn btn-outline-primary" type="button" :disabled="loading" @click="fetchList">刷新</button>
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

          <div class="col-12 d-flex gap-2">
            <button class="btn btn-outline-primary" type="button" :disabled="loading" @click="resetFilters">重置</button>
            <button class="btn btn-primary" type="button" :disabled="loading" @click="onSearch">搜索</button>
          </div>
        </div>

        <div class="d-flex flex-wrap justify-content-between align-items-center mt-3 gap-2">
          <div class="text-muted small">共 {{ total }} 条 · 第 {{ pagination.page }} / {{ totalPages }} 页</div>
          <div v-if="loading" class="text-muted small">加载中…</div>
        </div>

        <div v-if="loading && displayRows.length === 0" class="placeholder-glow mt-3">
          <div class="placeholder col-12 mb-2" />
          <div class="placeholder col-10 mb-2" />
          <div class="placeholder col-11" />
        </div>

        <div v-else class="mt-3 vstack gap-2">
          <div v-if="displayRows.length === 0" class="text-muted">暂无任务</div>

          <div v-for="t in displayRows" :key="taskKeyOf(t)" class="card border-0 shadow-sm">
            <div class="card-body">
              <div class="d-flex flex-wrap align-items-start justify-content-between gap-2">
                <div class="vstack gap-1">
                  <div class="fw-semibold">
                    <span class="text-muted">取件：</span>
                    <span>{{ (t as any).pickup_address || (t as any).pickupAddress || '—' }}</span>
                  </div>
                  <div class="fw-semibold">
                    <span class="text-muted">送达：</span>
                    <span>{{ (t as any).delivery_address || (t as any).deliveryAddress || '—' }}</span>
                  </div>
                  <div v-if="(t as any).remark" class="text-muted small">备注：{{ (t as any).remark }}</div>
                  <div class="text-muted small">发布时间：{{ formatTime((t as any).created_at || (t as any).createdAt) }}</div>
                </div>

                <div class="text-end">
                  <div class="fw-semibold fs-5">¥{{ formatMoney(toTotalPrice(t)) }}</div>
                  <div class="text-muted small">距离：{{ formatDistanceMeters(getSimulatedDistanceMeters(t)) }}</div>
                  <div class="text-muted small">预计送达：{{ formatEtaMinutes(getTaskEtaMinutes(t)) }}</div>
                  <button
                    v-if="isRunner"
                    class="btn btn-primary btn-sm mt-2"
                    type="button"
                    :disabled="loading || busyAcceptTaskId !== null"
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

          <div class="d-flex justify-content-between mt-2">
            <button class="btn btn-outline-secondary" type="button" :disabled="!canPrev" @click="prevPage">上一页</button>
            <button class="btn btn-outline-secondary" type="button" :disabled="!canNext" @click="nextPage">下一页</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
