<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { baseURL, http } from '@/api/request'
import { cancelTask, getTaskDetail, type TaskDetail } from '@/api/task'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const loading = ref(false)
const busyCancel = ref(false)
const errorMessage = ref('')
const task = ref<TaskDetail | null>(null)
const mapContainerRef = ref<HTMLDivElement | null>(null)
const routeDistanceMeters = ref(0)
const routeDurationSeconds = ref(0)
const runnerPosition = ref<{ lng: number; lat: number } | null>(null)
const mapError = ref('')
let detailMap: any
let runnerMarker: any
let runnerTimer: number | null = null
let simulationProgress = 0.15
const AMAP_KEY = '8476ce87e366c5936788fe2a47fc26ad'
const AMAP_SECURITY_JS_CODE = '63f89ed0a18fd8c4ec57d119ec552e14'

const taskId = computed(() => {
  const raw =
    (route.params as any)?.taskId ??
    (route.params as any)?.id ??
    (route.query as any)?.taskId ??
    (route.query as any)?.id
  return String(raw ?? '').trim()
})

function getErrorMessage(err: any) {
  const data = err?.response?.data
  if (typeof data === 'string' && data.trim()) return data.trim()
  const msg = data?.message || data?.msg || data?.error || data?.data?.message || data?.data?.msg || data?.data?.error || err?.message
  return String(msg ?? '操作失败')
}

function normalizeText(v: unknown) {
  return String(v ?? '').trim()
}

const status = computed(() => normalizeText((task.value as any)?.status))
const statusUpper = computed(() => status.value.toUpperCase())

const isPending = computed(() => statusUpper.value === 'PENDING')
const isCancelled = computed(() => ['CANCELLED', 'CANCELED', 'CANCEL'].includes(statusUpper.value))

const orderId = computed(() => normalizeText(
  (task.value as any)?.order_id ?? (task.value as any)?.orderId ?? (task.value as any)?.order?.id ?? (task.value as any)?.order?.order_id,
))

const isAccepted = computed(() => {
  if (!status.value) return false
  if (isPending.value || isCancelled.value) return false
  if (orderId.value) return true
  return ['ASSIGNED', 'ACCEPTED', 'TAKEN', 'IN_PROGRESS', 'DELIVERING', 'DONE', 'COMPLETED', 'FINISHED'].includes(
    statusUpper.value,
  )
})

const publisherId = computed(() =>
  normalizeText(
    (task.value as any)?.publisher_id ??
      (task.value as any)?.publisherId ??
      (task.value as any)?.user_id ??
      (task.value as any)?.userId ??
      (task.value as any)?.creator_id ??
      (task.value as any)?.creatorId,
  ),
)

const canCancel = computed(() => {
  if (!isPending.value) return false
  const me = normalizeText(auth.userId)
  if (!me || !publisherId.value) return false
  return me === publisherId.value
})

const pickupAddress = computed(
  () => normalizeText((task.value as any)?.pickup_address ?? (task.value as any)?.pickupAddress) || '—',
)
const deliveryAddress = computed(
  () => normalizeText((task.value as any)?.delivery_address ?? (task.value as any)?.deliveryAddress) || '—',
)
const pickupLat = computed(() => Number((task.value as any)?.pickup_lat ?? (task.value as any)?.pickupLat))
const pickupLng = computed(() => Number((task.value as any)?.pickup_lng ?? (task.value as any)?.pickupLng))
const deliveryLat = computed(() => Number((task.value as any)?.delivery_lat ?? (task.value as any)?.deliveryLat))
const deliveryLng = computed(() => Number((task.value as any)?.delivery_lng ?? (task.value as any)?.deliveryLng))
const hasRoutePoints = computed(() => [pickupLat.value, pickupLng.value, deliveryLat.value, deliveryLng.value].every(Number.isFinite))
const taskType = computed(() => normalizeText((task.value as any)?.task_type ?? (task.value as any)?.taskType) || '—')
const remark = computed(() => normalizeText((task.value as any)?.remark ?? (task.value as any)?.note) || '—')

function formatMoney(v: unknown) {
  const n = Number(v)
  return (Number.isFinite(n) ? n : 0).toFixed(2)
}

const feeTotalText = computed(() =>
  formatMoney((task.value as any)?.fee_total ?? (task.value as any)?.feeTotal ?? (task.value as any)?.fee),
)
const tipText = computed(() => formatMoney((task.value as any)?.tip))

const imageBase = baseURL.replace(/\/api\/?$/, '')
function toFullUrl(url: unknown) {
  const raw = String(url ?? '').trim()
  if (!raw) return ''
  if (/^https?:\/\//i.test(raw) || raw.startsWith('data:') || raw.startsWith('blob:')) return raw
  const path = raw.startsWith('/') ? raw : `/${raw}`
  return `${imageBase}${path}`
}

function formatDateTime(v: unknown) {
  const raw = String(v ?? '').trim()
  if (!raw) return '—'
  const d = new Date(raw)
  if (!Number.isFinite(d.getTime())) return raw
  try {
    return d.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return raw
  }
}

const createdAtText = computed(() =>
  formatDateTime(
    (task.value as any)?.created_at ??
      (task.value as any)?.createdAt ??
      (task.value as any)?.publish_time ??
      (task.value as any)?.publishTime,
  ),
)

const imageUrls = computed(() => {
  const rawImages = (task.value as any)?.images ?? (task.value as any)?.pics ?? (task.value as any)?.photos
  const list = Array.isArray(rawImages) ? rawImages : []
  const single =
    (task.value as any)?.item_image ??
    (task.value as any)?.itemImage ??
    (task.value as any)?.image ??
    (task.value as any)?.img
  const merged = [...list, single]
    .map((x) => String(x ?? '').trim())
    .filter(Boolean)
  const dedup = Array.from(new Set(merged))
  return dedup.map(toFullUrl).filter(Boolean)
})
const isPublisher = computed(() => Boolean(normalizeText(auth.userId) && normalizeText(auth.userId) === publisherId.value))

const runner = computed(() => (task.value as any)?.runner ?? (task.value as any)?.order?.runner ?? null)
const publisher = computed(() => (task.value as any)?.publisher ?? (task.value as any)?.creator ?? null)
const runnerId = computed(() => normalizeText(runner.value?.id ?? runner.value?.user_id ?? runner.value?.userId))
const isCurrentRunner = computed(() => Boolean(runnerId.value && runnerId.value === normalizeText(auth.userId)))
const canRevealContacts = computed(() => Boolean(orderId.value && (isPublisher.value || isCurrentRunner.value || auth.role === 'admin')))

function privacyPhone(raw: unknown) {
  const phone = normalizeText(raw).replace(/\s/g, '')
  if (!phone) return '未提供联系方式'
  if (!orderId.value) return '接单后可见'
  if (!canRevealContacts.value) return '仅交易双方可见'
  return /^1\d{10}$/.test(phone) ? phone : phone.replace(/(\d{3})\d+(\d{4})/, '$1****$2')
}

const routeDistanceText = computed(() => routeDistanceMeters.value > 0
  ? routeDistanceMeters.value < 1000 ? `${routeDistanceMeters.value} m` : `${(routeDistanceMeters.value / 1000).toFixed(2)} km`
  : '待计算')
const routeDurationText = computed(() => routeDurationSeconds.value > 0 ? `约 ${Math.ceil(routeDurationSeconds.value / 60)} 分钟` : '待计算')

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const rad = (value: number) => (value * Math.PI) / 180
  const dLat = rad(lat2 - lat1)
  const dLng = rad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2
  return Math.round(6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))
}

async function loadRouteMetrics() {
  if (!hasRoutePoints.value) return
  const fallback = haversineMeters(pickupLat.value, pickupLng.value, deliveryLat.value, deliveryLng.value)
  routeDistanceMeters.value = fallback
  routeDurationSeconds.value = Math.max(60, Math.round(fallback / 4.2))
  try {
    const response = await http.post('/map/distance', {
      origin_lat: pickupLat.value,
      origin_lng: pickupLng.value,
      destination_lat: deliveryLat.value,
      destination_lng: deliveryLng.value,
    })
    const data = response.data?.data ?? response.data
    routeDistanceMeters.value = Number(data?.distance_meters || fallback)
    routeDurationSeconds.value = Number(data?.duration_seconds || routeDurationSeconds.value)
  } catch {}
}

let amapPromise: Promise<any> | null = null
function loadAmap() {
  if ((window as any).AMap?.Map) return Promise.resolve((window as any).AMap)
  if (amapPromise) return amapPromise
  ;(window as any)._AMapSecurityConfig = { securityJsCode: AMAP_SECURITY_JS_CODE }
  amapPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${AMAP_KEY}&plugin=AMap.Driving,AMap.ToolBar`
    script.onload = () => (window as any).AMap?.Map ? resolve((window as any).AMap) : reject(new Error('地图加载失败'))
    script.onerror = () => reject(new Error('地图加载失败'))
    document.head.appendChild(script)
  })
  return amapPromise
}

function startRunnerSimulation(AMap: any) {
  if (runnerTimer !== null) window.clearInterval(runnerTimer)
  if (!runner.value || !hasRoutePoints.value || !detailMap) return
  const explicitLat = Number(runner.value?.latitude ?? runner.value?.lat)
  const explicitLng = Number(runner.value?.longitude ?? runner.value?.lng)
  runnerPosition.value = Number.isFinite(explicitLat) && Number.isFinite(explicitLng)
    ? { lat: explicitLat, lng: explicitLng }
    : { lat: pickupLat.value, lng: pickupLng.value }
  runnerMarker = new AMap.Marker({
    position: [runnerPosition.value.lng, runnerPosition.value.lat],
    title: '跑腿员（模拟位置）',
    label: { content: '跑腿员 · 模拟位置', direction: 'top' },
  })
  detailMap.add(runnerMarker)
  simulationProgress = 0.15
  runnerTimer = window.setInterval(() => {
    simulationProgress = Math.min(0.92, simulationProgress + 0.025)
    runnerPosition.value = {
      lat: pickupLat.value + (deliveryLat.value - pickupLat.value) * simulationProgress,
      lng: pickupLng.value + (deliveryLng.value - pickupLng.value) * simulationProgress,
    }
    runnerMarker?.setPosition([runnerPosition.value.lng, runnerPosition.value.lat])
  }, 5000)
}

async function initDetailMap() {
  if (!mapContainerRef.value || !hasRoutePoints.value) return
  mapError.value = ''
  try {
    const AMap = await loadAmap()
    detailMap?.destroy?.()
    detailMap = new AMap.Map(mapContainerRef.value, { zoom: 14, resizeEnable: true })
    detailMap.addControl?.(new AMap.ToolBar())
    const pickupMarker = new AMap.Marker({ position: [pickupLng.value, pickupLat.value], title: '取件点', label: { content: '取', direction: 'top' } })
    const deliveryMarker = new AMap.Marker({ position: [deliveryLng.value, deliveryLat.value], title: '送达点', label: { content: '送', direction: 'top' } })
    detailMap.add([pickupMarker, deliveryMarker])
    const fallbackPath = [[pickupLng.value, pickupLat.value], [deliveryLng.value, deliveryLat.value]]
    const drawPath = (path: any[]) => {
      const line = new AMap.Polyline({ path: path.length > 1 ? path : fallbackPath, strokeColor: '#165dff', strokeWeight: 6, showDir: true })
      detailMap.add(line)
      detailMap.setFitView([pickupMarker, deliveryMarker, line], false, [50, 50, 50, 50])
    }
    if (AMap.Driving) {
      const driving = new AMap.Driving({ hideMarkers: true })
      driving.search(fallbackPath[0], fallbackPath[1], (status: string, result: any) => {
        const path = status === 'complete'
          ? (result?.routes?.[0]?.steps || []).flatMap((step: any) => step?.path || [])
          : fallbackPath
        drawPath(path)
      })
    } else drawPath(fallbackPath)
    startRunnerSimulation(AMap)
  } catch (err: any) {
    mapError.value = err?.message || '地图加载失败'
  }
}

function openNavigation() {
  if (!hasRoutePoints.value) return
  const url = `https://uri.amap.com/navigation?from=${pickupLng.value},${pickupLat.value},${encodeURIComponent(pickupAddress.value)}&to=${deliveryLng.value},${deliveryLat.value},${encodeURIComponent(deliveryAddress.value)}&mode=ride&policy=1&src=campus-express&callnative=1`
  window.open(url, '_blank', 'noopener,noreferrer')
}

function goBack() {
  if (window.history.length > 1) router.back()
  else router.push('/tasks')
}

async function fetchTask() {
  const id = taskId.value
  errorMessage.value = ''
  task.value = null

  if (!id) {
    errorMessage.value = '任务ID缺失'
    return
  }

  loading.value = true
  try {
    task.value = await getTaskDetail(id)
    await loadRouteMetrics()
    await nextTick()
    await initDetailMap()
  } catch (err: any) {
    errorMessage.value = getErrorMessage(err)
  } finally {
    loading.value = false
  }
}

watch(
  () => route.fullPath,
  () => {
    fetchTask()
  },
)

async function onCancelTask() {
  if (!canCancel.value) return
  if (busyCancel.value) return
  const ok = window.confirm('确认取消该任务？')
  if (!ok) return

  busyCancel.value = true
  try {
    await cancelTask(taskId.value)
    ElMessage.success('任务已取消')
    await fetchTask()
  } catch (err: any) {
    ElMessage.error(getErrorMessage(err))
  } finally {
    busyCancel.value = false
  }
}

function goToOrders() {
  if (orderId.value) {
    router.push({ name: 'order-track', params: { orderId: orderId.value } })
    return
  }
  router.push({ name: 'orders' })
}

onMounted(fetchTask)
watch(taskId, fetchTask)
onBeforeUnmount(() => {
  if (runnerTimer !== null) window.clearInterval(runnerTimer)
  detailMap?.destroy?.()
  detailMap = null
  runnerMarker = null
})
</script>

<template>
  <div class="vstack gap-3">
    <div class="d-flex flex-wrap align-items-end justify-content-between gap-2">
      <div>
        <h1 class="h4 mb-1">任务详情</h1>
        <div class="text-muted small">任务ID：{{ taskId || '—' }}</div>
      </div>
      <button class="btn btn-outline-secondary" type="button" @click="goBack">返回</button>
    </div>

    <div v-if="errorMessage" class="alert alert-warning mb-0" role="alert">{{ errorMessage }}</div>

    <div class="card border-0 shadow-sm">
      <div class="card-body vstack gap-3">
        <div v-if="loading" class="text-muted small">加载中…</div>
        <div v-else-if="!task" class="text-muted">暂无任务数据</div>

        <template v-else>
          <div v-if="isAccepted" class="alert alert-info mb-0" role="alert">
            任务已被接单，请查看订单
            <button class="btn btn-link p-0 ms-1 align-baseline" type="button" @click="goToOrders">立即跳转</button>
          </div>

          <div class="row g-3 align-items-start">
            <div class="col-12 col-lg-8">
              <div class="vstack gap-2">
                <div class="fw-semibold">
                  <span class="text-muted">取件地址：</span>
                  <span>{{ pickupAddress }}</span>
                </div>
                <div class="fw-semibold">
                  <span class="text-muted">送达地址：</span>
                  <span>{{ deliveryAddress }}</span>
                </div>

                <div class="d-flex flex-wrap gap-2">
                  <span class="badge text-bg-light border">物品类型：{{ taskType }}</span>
                  <span class="badge text-bg-light border">配送费：¥ {{ feeTotalText }}</span>
                  <span class="badge text-bg-light border">小费：¥ {{ tipText }}</span>
                </div>

                <div class="d-flex flex-wrap gap-2">
                  <span class="badge text-bg-light border">任务状态：{{ statusUpper || '—' }}</span>
                  <span class="badge text-bg-light border">发布时间：{{ createdAtText }}</span>
                </div>

                <div class="text-muted">备注：{{ remark }}</div>
              </div>
            </div>

            <div class="col-12 col-lg-4">
              <div class="d-flex flex-wrap gap-2 justify-content-lg-end">
                <button v-if="canCancel" class="btn btn-danger" type="button" :disabled="busyCancel" @click="onCancelTask">
                  取消任务
                </button>
                <button v-if="isAccepted" class="btn btn-outline-primary" type="button" @click="goToOrders">查看订单</button>
              </div>
            </div>
          </div>

          <div v-if="imageUrls.length" class="vstack gap-2">
            <div class="fw-semibold">任务图片</div>
            <div class="task-images">
              <img v-for="(src, idx) in imageUrls" :key="`${src}_${idx}`" class="task-image" :src="src" alt="任务图片" />
            </div>
          </div>
        </template>
      </div>
    </div>

    <div v-if="task && hasRoutePoints" class="card border-0 shadow-sm">
      <div class="card-body">
        <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
          <div><div class="fw-semibold">任务路线</div><div class="text-muted small">取件点至送达点的推荐路线</div></div>
          <button class="btn btn-outline-primary" type="button" @click="openNavigation">打开地图导航</button>
        </div>
        <div v-if="mapError" class="alert alert-warning py-2">{{ mapError }}</div>
        <div ref="mapContainerRef" class="detail-map" />
        <div class="route-summary">
          <div><span>路线距离</span><strong>{{ routeDistanceText }}</strong></div>
          <div><span>预计时间</span><strong>{{ routeDurationText }}</strong></div>
          <div v-if="runner"><span>跑腿员位置</span><strong class="runner-live">模拟数据 · 每 5 秒更新</strong></div>
        </div>
      </div>
    </div>

    <div v-if="task" class="card border-0 shadow-sm">
      <div class="card-body">
        <div class="fw-semibold mb-3">任务参与者</div>
        <div class="participant-grid">
          <div class="participant-card">
            <div class="participant-avatar publisher">{{ normalizeText(publisher?.nickname ?? publisher?.name ?? '发').slice(0, 1) }}</div>
            <div class="participant-body">
              <div class="d-flex align-items-center gap-2"><strong>{{ publisher?.nickname || publisher?.name || '匿名发布者' }}</strong><span class="identity-badge">发布者</span></div>
              <div class="text-muted small">信用分 {{ publisher?.credit_score ?? publisher?.creditScore ?? '—' }}</div>
              <div class="contact-line">联系方式：{{ privacyPhone(publisher?.phone ?? publisher?.mobile) }}</div>
            </div>
          </div>
          <div v-if="runner" class="participant-card">
            <div class="participant-avatar runner">{{ normalizeText(runner?.nickname ?? runner?.name ?? '跑').slice(0, 1) }}</div>
            <div class="participant-body">
              <div class="d-flex align-items-center gap-2"><strong>{{ runner?.nickname || runner?.name || '跑腿员' }}</strong><span class="identity-badge runner">已接单跑腿员</span></div>
              <div class="runner-live small">位置正在模拟更新</div>
              <div class="contact-line">联系方式：{{ privacyPhone(runner?.phone ?? runner?.mobile) }}</div>
            </div>
          </div>
          <div v-else class="participant-placeholder">任务接单后将在此显示跑腿员信息</div>
        </div>
        <div class="privacy-note">联系方式仅在接单后向发布者、接单跑腿员及管理员显示；其他访问者不可查看。</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.detail-map { width: 100%; height: 360px; overflow: hidden; border: 1px solid var(--color-border); border-radius: var(--radius-card); }
.route-summary { display: flex; flex-wrap: wrap; gap: 12px 28px; margin-top: 14px; padding: 12px 14px; border-radius: 10px; background: var(--color-fill); }
.route-summary > div { display: flex; flex-direction: column; gap: 2px; }
.route-summary span { color: var(--color-text-muted); font-size: 12px; }
.route-summary strong { color: var(--color-text); font-size: 15px; }
.runner-live { color: var(--color-warning) !important; }
.participant-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.participant-card { display: flex; align-items: center; gap: 14px; padding: 14px; border: 1px solid var(--color-border); border-radius: var(--radius-card); background: var(--color-surface); }
.participant-avatar { display: grid; width: 48px; height: 48px; flex-shrink: 0; place-items: center; border-radius: 50%; font-size: 18px; font-weight: 700; }
.participant-avatar.publisher { background: var(--color-primary-soft); color: var(--color-primary); }
.participant-avatar.runner { background: var(--color-success-soft); color: var(--color-success); }
.participant-body { min-width: 0; }
.identity-badge { padding: 3px 8px; border-radius: var(--radius-pill); background: var(--color-primary-soft); color: var(--color-primary); font-size: 11px; font-weight: 600; }
.identity-badge.runner { background: var(--color-success-soft); color: var(--color-success); }
.contact-line { margin-top: 5px; color: var(--color-text-secondary); font-size: 13px; }
.participant-placeholder { display: grid; min-height: 78px; place-items: center; border: 1px dashed var(--color-border-strong); border-radius: var(--radius-card); color: var(--color-text-muted); font-size: 13px; text-align: center; }
.privacy-note { margin-top: 12px; color: var(--color-text-muted); font-size: 12px; }
.task-images {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px;
}

.task-image {
  width: 100%;
  height: 160px;
  object-fit: cover;
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  background: rgba(0, 0, 0, 0.02);
}

@media (max-width: 767.98px) {
  .detail-map { height: 280px; }
  .participant-grid { grid-template-columns: 1fr; }
}
</style>
