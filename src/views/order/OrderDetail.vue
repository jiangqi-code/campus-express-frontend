<script setup lang="ts">
import { ElMessage } from 'element-plus'
import type { UploadFile, UploadFiles, UploadUserFile } from 'element-plus'
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import {
  completeOrder,
  deliverOrder,
  getOrderDetail,
  getOrderTrack,
  pickupOrder,
  saveDeliveryPhoto,
  type OrderDetail,
  type OrderTrack,
} from '@/api/order'
import { baseURL, http } from '@/api/request'
import ChatSimulator from '@/components/ChatSimulator.vue'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const orderId = computed(() => String((route.params as any)?.orderId ?? (route.query as any)?.orderId ?? '').trim())

const loading = ref(false)
const errorMessage = ref('')
const order = ref<OrderDetail | null>(null)

const trackLoading = ref(false)
const trackErrorMessage = ref('')
const track = ref<OrderTrack | null>(null)

const isRunner = computed(() => auth.role === 'runner')

const runnerPhoneLoading = ref(false)
const runnerPhone = ref('')
const showFullPhone = ref(false)

const chatVisible = ref(false)
const chatToUserId = ref('')

const AMAP_KEY = 'f977a58a3a9cc261b072364616917be1'
const amapLoading = ref(false)
const amapErrorMessage = ref('')
const mapEl = ref<HTMLDivElement | null>(null)
const map = shallowRef<any | null>(null)
const driving = shallowRef<any | null>(null)

const pickupMarker = shallowRef<any | null>(null)
const deliveryMarker = shallowRef<any | null>(null)
const runnerMarker = shallowRef<any | null>(null)
const routePath = shallowRef<Array<{ lng: number; lat: number }>>([])

const routeDistanceKm = ref<number | null>(null)
const routeDurationMin = ref<number | null>(null)
const navProgress = ref(0)
let planSeq = 0

const imageBase = 'http://localhost:3000'

function toFullUrl(url: unknown) {
  const raw = String(url ?? '').trim()
  if (!raw) return ''
  if (/^https?:\/\//i.test(raw) || raw.startsWith('data:') || raw.startsWith('blob:')) return raw
  const path = raw.startsWith('/') ? raw : `/${raw}`
  return `${imageBase}${path}`
}

const previewVisible = ref(false)
const previewUrl = ref('')
let bodyOverflowBackup = ''

function openPreview(url: string) {
  const u = String(url ?? '').trim()
  if (!u) return
  previewUrl.value = u
  previewVisible.value = true
}

function closePreview() {
  previewVisible.value = false
  previewUrl.value = ''
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && previewVisible.value) closePreview()
}

watch(previewVisible, (v) => {
  if (v) {
    bodyOverflowBackup = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  } else {
    document.body.style.overflow = bodyOverflowBackup
  }
})

function normalizeText(v: unknown) {
  return String(v ?? '').trim()
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

function maskPhone(v: string) {
  const s = String(v ?? '').trim()
  const digits = s.replace(/\D/g, '')
  if (digits.length < 7) return s || '—'
  return digits.replace(/^(\d{3})\d+(\d{4})$/, '$1****$2')
}

function pickRunnerId(o: any) {
  const root = o?.data ?? o
  const raw =
    root?.runner_id ??
    root?.runnerId ??
    root?.taker_id ??
    root?.takerId ??
    root?.runner?.id ??
    root?.taker?.id ??
    root?.runner?.user_id ??
    root?.taker?.user_id
  return String(raw ?? '').trim()
}

function pickRunnerNickname(o: any) {
  const root = o?.data ?? o
  return (
    normalizeText(root?.runnerNickname ?? root?.runner_nickname ?? root?.takerNickname ?? root?.taker_nickname) ||
    normalizeText(root?.runner?.nickname ?? root?.taker?.nickname ?? root?.runner?.name ?? root?.taker?.name) ||
    '—'
  )
}

function pickAcceptedTime(o: any) {
  const root = o?.data ?? o
  return (
    normalizeText(
      root?.accept_time ??
        root?.accepted_time ??
        root?.accepted_at ??
        root?.assign_time ??
        root?.assigned_at ??
        root?.take_time ??
        root?.taked_at ??
        root?.receive_time ??
        root?.received_at,
    ) || ''
  )
}

type LngLat = { lng: number; lat: number }

function normalizeCoord(lng: unknown, lat: unknown): LngLat | null {
  const Lng = Number(lng)
  const Lat = Number(lat)
  if (!Number.isFinite(Lng) || !Number.isFinite(Lat)) return null
  if (Lng < -180 || Lng > 180) return null
  if (Lat < -90 || Lat > 90) return null
  return { lng: Lng, lat: Lat }
}

function clamp01(v: number) {
  return Math.min(1, Math.max(0, v))
}

function pickProgressPercent(o: any) {
  const root = o?.data ?? o
  const raw = root?.progress_percent ?? root?.progressPercent ?? root?.task?.progress_percent ?? root?.task?.progressPercent
  const n = Number(raw)
  if (!Number.isFinite(n)) return 0
  return Math.min(100, Math.max(0, n))
}

function pickOrderStatusUpper(o: any) {
  const root = o?.data ?? o
  const raw = root?.status ?? root?.order_status ?? root?.orderStatus ?? root?.state ?? root?.task?.status
  return normalizeText(raw).toUpperCase()
}

function updateRunnerMarkerByProgress(progress: number) {
  const AMap = (window as any).AMap
  if (!AMap) return
  if (!runnerMarker.value || typeof runnerMarker.value.setPosition !== 'function') return

  const pts = (window as any).routePath as Array<{ lng: number; lat: number }> | undefined
  const list = Array.isArray(pts) && pts.length ? pts : routePath.value
  if (!Array.isArray(list) || !list.length) return

  const p = clamp01(progress)
  const idx = list.length <= 1 ? 0 : Math.min(list.length - 1, Math.floor(p * (list.length - 1)))
  const next = list[idx]
  if (!next) return
  runnerMarker.value.setPosition(new AMap.LngLat(next.lng, next.lat))
}

let orderPollTimer: number | null = null
let orderPollInFlight = false
let orderPollToken = 0
let lastRunnerPhoneUserId = ''

function clearOrderPollTimer() {
  if (orderPollTimer) window.clearInterval(orderPollTimer)
  orderPollTimer = null
  orderPollInFlight = false
}

function applyProgressFromOrder(data: any) {
  const status = pickOrderStatusUpper(data)
  const percent = status === 'COMPLETED' || status === 'DONE' || status === 'FINISHED' ? 100 : pickProgressPercent(data)
  navProgress.value = clamp01(percent / 100)
  updateRunnerMarkerByProgress(navProgress.value)
}

function startOrderPollTimer() {
  clearOrderPollTimer()
  if (!orderId.value) return
  orderPollTimer = window.setInterval(() => {
    void pollOrderProgress()
  }, 10000)
}

async function pollOrderProgress() {
  const id = orderId.value
  if (!id) return
  if (orderPollInFlight) return
  const token = orderPollToken
  orderPollInFlight = true
  try {
    const data = await getOrderDetail(id)
    if (token !== orderPollToken) return
    order.value = data
    applyProgressFromOrder(data)
    const runnerId = pickRunnerId(data)
    if (runnerId && runnerId !== lastRunnerPhoneUserId) {
      lastRunnerPhoneUserId = runnerId
      await fetchRunnerPhone(runnerId)
    }
  } catch {
  } finally {
    orderPollInFlight = false
  }
}

let amapPromise: Promise<any> | null = null
function loadAMap() {
  if (amapPromise) return amapPromise
  amapPromise = new Promise((resolve, reject) => {
    const startAt = Date.now()
    const timeoutMs = 15000
    const tick = () => {
      const AMap = (window as any).AMap
      if (AMap && AMap.Map) {
        resolve(AMap)
        return
      }
      if (Date.now() - startAt >= timeoutMs) {
        reject(new Error(`AMap JSAPI 未加载（key=${AMAP_KEY}）`))
        return
      }
      window.setTimeout(tick, 50)
    }
    tick()
  })
  return amapPromise
}

function ensureAMapPlugins(AMap: any, plugins: string[]) {
  const list = Array.isArray(plugins) ? plugins.filter((p) => String(p || '').trim()) : []
  if (!list.length) return Promise.resolve()
  if (!AMap || typeof AMap.plugin !== 'function') return Promise.resolve()
  return new Promise<void>((resolve) => {
    AMap.plugin(list, () => resolve())
  })
}

async function ensureMap() {
  if (map.value) return map.value
  if (!mapEl.value) return null

  amapLoading.value = true
  amapErrorMessage.value = ''
  try {
    const AMap = await loadAMap()
    if (!mapEl.value) return null

    map.value = new AMap.Map(mapEl.value, {
      zoom: 14,
      viewMode: '2D',
      resizeEnable: true,
    })

    await ensureAMapPlugins(AMap, ['AMap.Driving', 'AMap.Geolocation'])

    if (AMap.Geolocation) {
      const geo = new AMap.Geolocation({
        enableHighAccuracy: false,
        timeout: 6000,
        position: 'RB',
        showMarker: true,
        showCircle: false,
      })
      map.value.addControl(geo)
      geo.getCurrentPosition()
    }

    driving.value = new AMap.Driving({
      map: map.value,
      hideMarkers: true,
      autoFitView: true,
    })

    return map.value
  } catch (e: any) {
    amapErrorMessage.value = String(e?.message ?? '地图加载失败')
    return null
  } finally {
    amapLoading.value = false
  }
}

function setMarkerContent(label: string, bg: string, ring: string) {
  const safeLabel = String(label || '').slice(0, 4)
  return `
    <div style="
      width: 24px;
      height: 24px;
      border-radius: 999px;
      background: ${bg};
      color: #fff;
      font-size: 12px;
      line-height: 24px;
      text-align: center;
      border: 2px solid #fff;
      box-shadow: 0 2px 10px ${ring};
      user-select: none;
    ">${safeLabel}</div>
  `
}

function clearRouteOverlays() {
  if (pickupMarker.value) pickupMarker.value.setMap(null)
  if (deliveryMarker.value) deliveryMarker.value.setMap(null)
  if (runnerMarker.value) runnerMarker.value.setMap(null)
  pickupMarker.value = null
  deliveryMarker.value = null
  runnerMarker.value = null
  routePath.value = []
  ;(window as any).routePath = []
  ;(window as any).marker = null

  routeDistanceKm.value = null
  routeDurationMin.value = null
  try {
    driving.value?.clear?.()
  } catch {
    // ignore
  }
}

async function planDrivingRoute() {
  const seq = (planSeq += 1)
  amapErrorMessage.value = ''

  const m = await ensureMap()
  if (!m || !driving.value) return

  clearRouteOverlays()

  const oldPolyline = (window as any).routePolyline
  if (oldPolyline && typeof oldPolyline.setMap === 'function') oldPolyline.setMap(null)
  ;(window as any).routePolyline = null

  const AMap = await loadAMap()
  if (seq !== planSeq) return

  const startCoord: [number, number] = [113.285, 23.215]
  const endCoord: [number, number] = [113.288, 23.218]
  const startLngLat = new AMap.LngLat(startCoord[0], startCoord[1])
  const endLngLat = new AMap.LngLat(endCoord[0], endCoord[1])

  amapLoading.value = true
  driving.value.search(startLngLat, endLngLat, (status: string, result: any) => {
    console.log('status:', status)
    try {
      console.log(JSON.stringify(result, null, 2))
    } catch {
      console.log(result)
    }
    amapLoading.value = false
    if (seq !== planSeq) return

    if (!(status === 'complete' && result?.routes?.length)) {
      console.error('路线规划失败详情:', result)
      amapErrorMessage.value = String(result?.message ?? result?.info ?? '路线规划失败')
      return
    }

    const route0 = result.routes[0]
    const steps = Array.isArray(route0?.steps) ? route0.steps : []

    const path: Array<{ lng: number; lat: number }> = []
    for (const st of steps) {
      const pts = Array.isArray(st?.path) ? st.path : []
      for (const p of pts) {
        const lng = typeof p?.getLng === 'function' ? p.getLng() : Array.isArray(p) ? p[0] : p?.lng
        const lat = typeof p?.getLat === 'function' ? p.getLat() : Array.isArray(p) ? p[1] : p?.lat
        const c = normalizeCoord(lng, lat)
        if (c) path.push(c)
      }
    }

    const fallbackStart = normalizeCoord(startCoord[0], startCoord[1]) ?? { lng: startCoord[0], lat: startCoord[1] }
    const fallbackEnd = normalizeCoord(endCoord[0], endCoord[1]) ?? { lng: endCoord[0], lat: endCoord[1] }
    routePath.value = path.length ? path : [fallbackStart, fallbackEnd]
    ;(window as any).routePath = routePath.value

    try {
      driving.value?.clear?.()
    } catch {
      // ignore
    }

    const linePath = routePath.value.map((p) => [p.lng, p.lat])
    const polyline = new AMap.Polyline({
      path: linePath,
      strokeColor: '#1677ff',
      strokeWeight: 6,
      strokeOpacity: 0.9,
      showDir: true,
      zIndex: 100,
    })
    polyline.setMap(m)
    ;(window as any).routePolyline = polyline

    runnerMarker.value = new AMap.Marker({
      position: startLngLat,
      content: setMarkerContent('车', 'rgba(13, 110, 253, 0.95)', 'rgba(13, 110, 253, 0.25)'),
      offset: new AMap.Pixel(-12, -12),
    })
    runnerMarker.value.setMap(m)
    ;(window as any).marker = runnerMarker.value

    try {
      m.setFitView([polyline, runnerMarker.value], false, [40, 40, 40, 40])
    } catch {
      // ignore
    }

    updateRunnerMarkerByProgress(navProgress.value)
  })
}

async function fetchRunnerPhone(userId: string) {
  const id = String(userId ?? '').trim()
  runnerPhone.value = ''
  if (!id) return
  runnerPhoneLoading.value = true
  try {
    const resp = await http.get(`/user/${encodeURIComponent(id)}`)
    const root = resp.data?.data ?? resp.data
    const phoneRaw =
      root?.phone ??
      root?.mobile ??
      root?.tel ??
      root?.phone_number ??
      root?.phoneNumber ??
      root?.user?.phone ??
      root?.user?.mobile
    runnerPhone.value = normalizeText(phoneRaw)
  } catch {
    runnerPhone.value = ''
  } finally {
    runnerPhoneLoading.value = false
  }
}

async function fetchOrder() {
  const id = orderId.value
  orderPollToken += 1
  clearOrderPollTimer()
  order.value = null
  errorMessage.value = ''
  runnerPhone.value = ''
  showFullPhone.value = false
  if (!id) {
    errorMessage.value = '订单ID缺失'
    return
  }
  loading.value = true
  try {
    const data = await getOrderDetail(id)
    order.value = data
    console.log('订单详情:', order.value)
    console.log('跑腿员ID:', order.value?.taker?.id || (order.value as any)?.taker_id)
    applyProgressFromOrder(data)
    const runnerId = pickRunnerId(data)
    if (runnerId) {
      lastRunnerPhoneUserId = runnerId
      await fetchRunnerPhone(runnerId)
    }
    startOrderPollTimer()
  } catch (err: any) {
    errorMessage.value = err?.response?.data?.message || err?.message || '加载失败'
  } finally {
    loading.value = false
  }
}

async function fetchTrack() {
  const id = orderId.value
  track.value = null
  trackErrorMessage.value = ''
  if (!id) return
  trackLoading.value = true
  try {
    track.value = await getOrderTrack(id)
  } catch (err: any) {
    trackErrorMessage.value = err?.response?.data?.message || err?.message || '加载失败'
  } finally {
    trackLoading.value = false
  }
}

const pickupPhotoFullUrl = computed(() => toFullUrl(track.value?.pickup_photo_url))
const deliveryPhotoFullUrl = computed(() => toFullUrl(track.value?.delivery_photo_url))

const acceptedTimeRaw = computed(() => pickAcceptedTime(order.value))
const acceptedTimeText = computed(() => formatDateTime(acceptedTimeRaw.value))

const pickupTimeText = computed(() => formatDateTime(track.value?.pickup_time))
const deliveryTimeText = computed(() => formatDateTime(track.value?.delivery_time))

const pickupAddress = computed(() => {
  const o = order.value as any
  return normalizeText(o?.pickup_address ?? o?.pickupAddress ?? o?.task?.pickup_address ?? o?.task?.pickupAddress) || '—'
})

const deliveryAddress = computed(() => {
  const o = order.value as any
  return (
    normalizeText(o?.delivery_address ?? o?.deliveryAddress ?? o?.task?.delivery_address ?? o?.task?.deliveryAddress) || '—'
  )
})

const routeDistanceText = computed(() => (routeDistanceKm.value === null ? '—' : `${routeDistanceKm.value} km`))
const routeDurationText = computed(() => (routeDurationMin.value === null ? '—' : `${routeDurationMin.value} 分钟`))
const orderStatusUpper = computed(() => pickOrderStatusUpper(order.value))
const backendProgressPercent = computed(() => pickProgressPercent(order.value))
const displayProgressPercent = computed(() => {
  const status = orderStatusUpper.value
  if (status === 'COMPLETED' || status === 'DONE' || status === 'FINISHED') return 100
  return backendProgressPercent.value
})
const displayProgressPercentInt = computed(() => Math.round(displayProgressPercent.value))
const progressBarWidth = computed(
  () => `${Math.min(100, Math.max(0, displayProgressPercent.value ?? 0))}%`,
)
const deliveryStatusText = computed(() => {
  const status = orderStatusUpper.value
  const percent = displayProgressPercentInt.value
  if (status === 'COMPLETED' || status === 'DONE' || status === 'FINISHED') return '已完成'
  if ((status === 'DELIVERING' || status === 'DELIVER') && percent >= 100) return '配送完成'
  if (status === 'DELIVERING' || status === 'DELIVER') return `配送进度 ${percent}%`
  return '—'
})

const runnerNickname = computed(() => pickRunnerNickname(order.value))
const takerId = computed(() => pickRunnerId(order.value))
const publisherId = computed(() => {
  const o = order.value as any
  const raw =
    o?.publisher_id ??
    o?.publisherId ??
    o?.task?.publisher_id ??
    o?.task?.publisherId ??
    o?.publisher?.id ??
    o?.publisher?.user_id ??
    o?.task?.publisher?.id ??
    o?.task?.publisher?.user_id
  return normalizeText(raw)
})
const chatTargetId = computed(() => (isRunner.value ? publisherId.value : takerId.value))
const runnerPhoneText = computed(() => {
  if (runnerPhoneLoading.value) return '加载中…'
  if (!runnerPhone.value) return '—'
  return showFullPhone.value ? runnerPhone.value : maskPhone(runnerPhone.value)
})

const timeline = computed(() => {
  const status = orderStatusUpper.value
  const progress = displayProgressPercentInt.value
  const stageIndex =
    status === 'ACCEPTED'
      ? 0
      : status === 'PICKED'
        ? 1
        : status === 'DELIVERING' || status === 'DELIVER'
          ? progress >= 100
            ? 3
            : 2
          : status === 'COMPLETED' || status === 'DONE' || status === 'FINISHED'
            ? 4
            : -1

  const all = [
    {
      key: 'accepted',
      label: '已接单',
      time: acceptedTimeText.value,
      done: stageIndex >= 0,
      extra: '',
      photoUrl: '',
      photoApplicable: false,
    },
    {
      key: 'picked',
      label: '已取件',
      time: pickupTimeText.value,
      done: stageIndex >= 1,
      extra: '',
      photoUrl: pickupPhotoFullUrl.value,
      photoApplicable: true,
    },
    {
      key: 'delivering',
      label: '配送中',
      time: stageIndex >= 2 ? pickupTimeText.value : '—',
      done: stageIndex >= 2,
      extra: '',
      photoUrl: '',
      photoApplicable: false,
    },
    {
      key: 'delivered',
      label: '配送完成',
      time: deliveryTimeText.value,
      done: stageIndex >= 3,
      extra: '',
      photoUrl: '',
      photoApplicable: false,
    },
    {
      key: 'completed',
      label: '已完成',
      time: deliveryTimeText.value,
      done: stageIndex >= 4,
      extra: '',
      photoUrl: deliveryPhotoFullUrl.value,
      photoApplicable: true,
    },
  ]

  if (stageIndex < 0) return []
  return stageIndex >= 4 ? all : all.slice(0, stageIndex + 1)
})

type RunnerPhotoMode = 'pickup' | 'deliver'

const uploadAction = `${baseURL}/upload/image`
const uploadHeaders = computed<Record<string, string>>(() => {
  const token = localStorage.getItem('ce_token')
  return token ? { Authorization: `Bearer ${token}` } : ({} as Record<string, string>)
})

const runnerPhotoVisible = ref(false)
const runnerPhotoMode = ref<RunnerPhotoMode>('pickup')
const runnerPhotoFileList = ref<UploadUserFile[]>([])
const runnerPhotoUrl = ref('')
const runnerPhotoSubmitting = ref(false)

function normalizeUploadUrl(data: any): string {
  const root = data?.data ?? data
  if (typeof root === 'string' && root.trim()) return root.trim()

  const direct =
    root?.url ??
    root?.path ??
    root?.src ??
    root?.location ??
    root?.data?.url ??
    root?.data?.path ??
    root?.result?.url ??
    root?.result?.path

  if (typeof direct === 'string' && direct.trim()) return direct.trim()

  const urls = root?.urls ?? root?.files ?? root?.images ?? root?.data?.urls ?? root?.data?.images
  if (Array.isArray(urls) && typeof urls[0] === 'string' && urls[0].trim()) return urls[0].trim()

  throw new Error('图片上传失败：未返回可用的图片地址')
}

function onRunnerPhotoSuccess(response: any, uploadFile: UploadFile, uploadFiles: UploadFiles) {
  try {
    const url = normalizeUploadUrl(response)
    runnerPhotoUrl.value = url
    uploadFile.url = toFullUrl(url)
    const target = uploadFiles.find((f) => f.uid === uploadFile.uid)
    if (target) target.url = toFullUrl(url)
  } catch (err: any) {
    runnerPhotoUrl.value = ''
    ElMessage.error(err?.message || '图片上传失败')
  }
}

function onRunnerPhotoRemove(_uploadFile: UploadFile, uploadFiles: UploadFiles) {
  runnerPhotoFileList.value = uploadFiles as unknown as UploadUserFile[]
  runnerPhotoUrl.value = runnerPhotoFileList.value.length > 0 ? runnerPhotoUrl.value : ''
}

function closeRunnerPhoto() {
  runnerPhotoVisible.value = false
  runnerPhotoFileList.value = []
  runnerPhotoUrl.value = ''
  runnerPhotoMode.value = 'pickup'
}

function openRunnerPhoto(mode: RunnerPhotoMode) {
  if (!orderId.value) return
  runnerPhotoMode.value = mode
  runnerPhotoFileList.value = []
  runnerPhotoUrl.value = ''
  runnerPhotoVisible.value = true
}

async function submitRunnerPhoto() {
  if (runnerPhotoSubmitting.value) return
  const id = orderId.value
  if (!id) return
  if (!runnerPhotoUrl.value) {
    ElMessage.warning('请先上传图片')
    return
  }

  const mode = runnerPhotoMode.value
  runnerPhotoSubmitting.value = true
  try {
    if (mode === 'pickup') {
      await pickupOrder(id, runnerPhotoUrl.value)
      ElMessage.success('已取件')
    } else {
      await saveDeliveryPhoto(id, runnerPhotoUrl.value)
      ElMessage.success('已保存送达照片')
    }
    closeRunnerPhoto()
    await fetchOrder()
    await fetchTrack()
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.message || err?.message || '操作失败')
  } finally {
    runnerPhotoSubmitting.value = false
  }
}

const runnerStartDeliveringLoading = ref(false)

async function startDelivering() {
  if (runnerStartDeliveringLoading.value) return
  const id = orderId.value
  if (!id) return
  runnerStartDeliveringLoading.value = true
  try {
    await deliverOrder(id)
    ElMessage.success('开始配送')
    await fetchOrder()
    await fetchTrack()
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.message || err?.message || '操作失败')
  } finally {
    runnerStartDeliveringLoading.value = false
  }
}

const runnerCompleteLoading = ref(false)
const canRunnerComplete = computed(
  () =>
    isRunner.value &&
    orderStatusUpper.value === 'DELIVERING' &&
    backendProgressPercent.value >= 100,
)

async function onCompleteOrder() {
  if (runnerCompleteLoading.value) return
  const id = orderId.value
  if (!id) return
  runnerCompleteLoading.value = true
  try {
    await completeOrder(id)
    ElMessage.success('订单已完成')
    await fetchOrder()
    await fetchTrack()
    openRunnerPhoto('deliver')
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.message || err?.message || '操作失败')
  } finally {
    runnerCompleteLoading.value = false
  }
}

const canRunnerPickup = computed(
  () => isRunner.value && Boolean(orderId.value) && (orderStatusUpper.value === 'ACCEPTED' || orderStatusUpper.value === 'ASSIGNED'),
)
const canRunnerStartDelivering = computed(
  () =>
    isRunner.value &&
    Boolean(orderId.value) &&
    (orderStatusUpper.value === 'PICKED' || orderStatusUpper.value === 'PICKUP' || orderStatusUpper.value === 'PICKED_UP'),
)
const canRunnerUploadDeliveryPhoto = computed(
  () =>
    isRunner.value &&
    Boolean(orderId.value) &&
    (orderStatusUpper.value === 'COMPLETED' || orderStatusUpper.value === 'DONE' || orderStatusUpper.value === 'FINISHED') &&
    !normalizeText(track.value?.delivery_photo_url),
)

function goBack() {
  if (window.history.length > 1) router.back()
  else router.push('/orders')
}

function openChat() {
  if (!chatTargetId.value) {
    ElMessage.warning('无法获取聊天对象')
    return
  }
  chatToUserId.value = chatTargetId.value
  chatVisible.value = true
}

watch(
  orderId,
  () => {
    fetchOrder()
    fetchTrack()
  },
  { immediate: true },
)

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  ensureMap().then(() => {
    planDrivingRoute()
  })
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  clearOrderPollTimer()
  try {
    map.value?.destroy?.()
  } catch {
    // ignore
  }
  map.value = null
})
</script>

<template>

  <div class="vstack gap-3">
    <div class="d-flex flex-wrap align-items-end justify-content-between gap-2">
      <div>
        <h1 class="h4 mb-1">订单详情</h1>
        <div class="text-muted small">订单号：{{ orderId || '—' }}</div>
      </div>
      <button class="btn btn-outline-secondary" type="button" @click="goBack">返回</button>
    </div>

    <div v-if="errorMessage" class="alert alert-warning mb-0" role="alert">{{ errorMessage }}</div>

    <div class="card border-0 shadow-sm">
      <div class="card-body vstack gap-3">
        <div class="vstack gap-1">
          <div class="fw-semibold">
            <span class="text-muted">取件：</span>
            <span>{{ pickupAddress }}</span>
          </div>
          <div class="fw-semibold">
            <span class="text-muted">送达：</span>
            <span>{{ deliveryAddress }}</span>
          </div>
          <div v-if="loading" class="text-muted small">加载中…</div>
        </div>

        <div class="runner-box">
          <div class="d-flex flex-wrap justify-content-between align-items-start gap-2">
            <div class="vstack gap-1">
              <div class="fw-semibold">跑腿员信息</div>
              <div class="text-muted small">昵称：{{ runnerNickname }}</div>
              <div class="text-muted small">
                手机号：{{ runnerPhoneText }}
                <button
                  v-if="runnerPhone && !runnerPhoneLoading"
                  class="btn btn-link btn-sm p-0 ms-2"
                  type="button"
                  @click="showFullPhone = !showFullPhone"
                >
                  {{ showFullPhone ? '隐藏' : '显示' }}
                </button>
              </div>
              <div class="text-muted small">接单时间：{{ acceptedTimeText }}</div>
            </div>

            <div class="d-flex flex-wrap gap-2 align-items-center">
              <button class="btn btn-primary" type="button" :disabled="!orderId || !chatTargetId" @click="openChat">
                联系跑腿员
              </button>
              <button
                v-if="canRunnerPickup"
                class="btn btn-outline-primary"
                type="button"
                :disabled="!orderId"
                @click="openRunnerPhoto('pickup')"
              >
                取件
              </button>
              <button
                v-if="canRunnerStartDelivering"
                class="btn btn-outline-primary"
                type="button"
                :disabled="!orderId || runnerStartDeliveringLoading"
                @click="startDelivering"
              >
                开始配送
              </button>
              <button
                v-if="canRunnerComplete"
                class="btn btn-primary"
                type="button"
                :disabled="!orderId || runnerCompleteLoading"
                @click="onCompleteOrder"
              >
                完成订单
              </button>
              <button
                v-if="canRunnerUploadDeliveryPhoto"
                class="btn btn-primary"
                type="button"
                :disabled="!orderId"
                @click="openRunnerPhoto('deliver')"
              >
                上传送达照片
              </button>
            </div>
          </div>
        </div>

        <div class="route-box">
          <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
            <div class="fw-semibold">高德地图</div>
            <div class="d-flex flex-wrap gap-2">
              <span class="badge text-bg-light border">距离：{{ routeDistanceText }}</span>
              <span class="badge text-bg-light border">预计：{{ routeDurationText }}</span>
            </div>
          </div>

          <div v-if="amapErrorMessage" class="alert alert-warning mb-2" role="alert">{{ amapErrorMessage }}</div>
          <div ref="mapEl" class="amap-container" />

          <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mt-2">
            <div class="text-muted small">{{ deliveryStatusText }}</div>
            <div v-if="amapLoading" class="text-muted small">路线规划中…</div>
          </div>
          <div class="progress mt-2" style="height: 8px">
            <div class="progress-bar" role="progressbar" :style="{ width: progressBarWidth }" />
          </div>
        </div>

        <div class="track-box">
          <div class="d-flex flex-wrap align-items-center justify-content-between gap-2">
            <div class="fw-semibold">进度时间线</div>
            <div v-if="trackLoading" class="text-muted small">加载中…</div>
          </div>

          <div v-if="!orderId" class="text-muted small mt-2">缺少订单ID，无法加载进度</div>
          <div v-else-if="trackErrorMessage" class="alert alert-warning mb-0 mt-2" role="alert">
            {{ trackErrorMessage }}
          </div>
          <div v-else class="mt-3 vstack gap-3">
            <div v-for="s in timeline" :key="s.key" class="timeline-row">
              <div class="timeline-left">
                <div class="timeline-dot" :class="{ done: s.done }" />
                <div class="timeline-line" />
              </div>
              <div class="timeline-content">
                <div class="d-flex flex-wrap align-items-center justify-content-between gap-2">
                  <div class="fw-semibold">{{ s.label }}</div>
                  <div class="text-muted small">{{ s.time }}</div>
                </div>
                <div v-if="s.extra" class="text-muted small mt-1">{{ s.extra }}</div>
                <div v-if="s.photoApplicable && s.done" class="mt-2">
                  <el-image
                    v-if="s.photoUrl"
                    :src="s.photoUrl"
                    fit="cover"
                    style="width: 80px; height: 80px"
                    @click="openPreview(s.photoUrl)"
                  >
                    <template #error>
                      <div
                        style="
                          width: 80px;
                          height: 80px;
                          background: #f0f0f0;
                          display: flex;
                          align-items: center;
                          justify-content: center;
                        "
                      >
                        暂无图片
                      </div>
                    </template>
                  </el-image>
                  <div v-else class="text-muted small">暂无图片</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <ChatSimulator v-model="chatVisible" :order-id="orderId" :to-user-id="chatToUserId" />
  </div>

  <el-dialog
    v-model="runnerPhotoVisible"
    :title="runnerPhotoMode === 'pickup' ? '取件上传照片' : '送达上传照片'"
    width="520px"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    :show-close="false"
  >
    <div class="vstack gap-2">
      <div class="text-muted small">请上传 1 张图片</div>
      <el-upload
        v-model:file-list="runnerPhotoFileList"
        :action="uploadAction"
        name="image"
        accept="image/*"
        list-type="picture-card"
        :limit="1"
        :headers="uploadHeaders"
        :disabled="runnerPhotoSubmitting"
        :on-success="onRunnerPhotoSuccess"
        :on-remove="onRunnerPhotoRemove"
      >
        <div>上传</div>
      </el-upload>
    </div>
    <template #footer>
      <div class="d-flex justify-content-end gap-2">
        <el-button :disabled="runnerPhotoSubmitting" @click="closeRunnerPhoto">取消</el-button>
        <el-button type="primary" :loading="runnerPhotoSubmitting" @click="submitRunnerPhoto">提交</el-button>
      </div>
    </template>
  </el-dialog>

  <teleport to="body">
    <div v-if="previewVisible" class="img-preview-backdrop" @click="closePreview">
      <div class="img-preview-panel" @click.stop>
        <button type="button" class="btn btn-sm btn-light img-preview-close" @click="closePreview">关闭</button>
        <img class="img-preview-img" :src="previewUrl" alt="预览图片" />
      </div>
    </div>
  </teleport>
</template>

<style scoped>
.runner-box {
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 12px;
  padding: 16px;
  background: rgba(0, 0, 0, 0.02);
}

.route-box {
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 12px;
  padding: 16px;
  background: rgba(0, 0, 0, 0.02);
}

.amap-container {
  width: 100%;
  height: 360px;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.08);
  background: #f8f9fa;
}

.runner-marker {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  pointer-events: none;
}

.runner-dot {
  width: 12px;
  height: 12px;
  border-radius: 999px;
  background: rgba(13, 110, 253, 0.95);
  border: 2px solid rgba(255, 255, 255, 0.95);
  box-shadow: 0 2px 10px rgba(13, 110, 253, 0.3);
}

.runner-label {
  font-size: 12px;
  line-height: 1;
  padding: 2px 6px;
  border-radius: 999px;
  background: rgba(13, 110, 253, 0.12);
  border: 1px solid rgba(13, 110, 253, 0.25);
  color: rgba(13, 110, 253, 0.95);
}

.track-box {
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 12px;
  padding: 16px;
  background: rgba(0, 0, 0, 0.02);
}

.track-photo {
  max-height: 220px;
  object-fit: cover;
  cursor: zoom-in;
}

.img-preview-backdrop {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: rgba(0, 0, 0, 0.65);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.img-preview-panel {
  position: relative;
  max-width: min(92vw, 1100px);
  max-height: 92vh;
  display: flex;
  align-items: center;
  justify-content: center;
}

.img-preview-close {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 1;
}

.img-preview-img {
  max-width: 100%;
  max-height: 92vh;
  border-radius: 12px;
  background: #ffffff;
}

.timeline-row {
  display: grid;
  grid-template-columns: 24px 1fr;
  gap: 12px;
}

.timeline-left {
  position: relative;
  display: flex;
  justify-content: center;
}

.timeline-dot {
  width: 12px;
  height: 12px;
  border-radius: 999px;
  border: 2px solid rgba(0, 0, 0, 0.25);
  background: #ffffff;
  position: relative;
  z-index: 1;
}

.timeline-dot.done {
  border-color: rgba(25, 135, 84, 0.9);
  background: rgba(25, 135, 84, 0.12);
}

.timeline-line {
  position: absolute;
  top: 12px;
  bottom: -12px;
  width: 2px;
  background: rgba(0, 0, 0, 0.08);
}

.timeline-content {
  min-width: 0;
}
</style>
