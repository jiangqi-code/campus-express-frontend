<script setup lang="ts">
import { ElMessage } from 'element-plus'
import type { UploadFile, UploadFiles, UploadUserFile } from 'element-plus'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import {
  cancelOrder,
  completeOrder,
  confirmOrder as confirmOrderApi,
  deliverOrder,
  pickupOrder,
  saveDeliveryPhoto,
  urgeOrder,
} from '@/api/order'
import { baseURL, http } from '@/api/request'
import ChatSimulator from '@/components/ChatSimulator.vue'
import { useAuthStore } from '@/stores/auth'

type TabKey = 'published' | 'taken'

const auth = useAuthStore()
const router = useRouter()

const isRunner = computed(() => auth.role === 'runner')

const activeTab = ref<TabKey>('published')

const loading = ref(false)
const errorMessage = ref('')

type OrderRow = {
  id: string | number
  order_id?: string | number
  task_id?: string | number
  pickup_address?: string
  delivery_address?: string
  status?: string
  fee_total?: number | string
  final_price?: number | string
  task?: {
    fee_total?: number | string
  }
  order?: {
    final_price?: number | string
  }
}

const publishedRows = ref<OrderRow[]>([])
const takenRows = ref<OrderRow[]>([])

const busyAction = ref<Record<string, string | undefined>>({})
const locallyConfirmed = ref<Record<string, boolean | undefined>>({})

type RunnerPhotoMode = 'pickup' | 'deliver'

const IMAGE_BASE_URL = 'http://localhost:3000'
const uploadAction = `${baseURL}/upload/image`
const uploadHeaders = computed<Record<string, string>>(() => {
  const token = localStorage.getItem('ce_token')
  return token ? { Authorization: `Bearer ${token}` } : ({} as Record<string, string>)
})

const runnerPhotoVisible = ref(false)
const runnerPhotoMode = ref<RunnerPhotoMode>('pickup')
const runnerPhotoOrderId = ref('')
const runnerPhotoFileList = ref<UploadUserFile[]>([])
const runnerPhotoUrl = ref('')
const runnerPhotoSubmitting = ref(false)

const chatVisible = ref(false)
const chatOrderId = ref('')
const chatToUserId = ref('')

function getErrorMessage(err: any) {
  return (
    err?.response?.data?.message ||
    err?.response?.data?.msg ||
    err?.response?.data?.error ||
    err?.message ||
    '操作失败'
  )
}

function normalizeStatus(v: unknown) {
  return String(v ?? '')
    .trim()
    .toUpperCase()
}

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

function toFullUrl(url: string) {
  const raw = String(url ?? '').trim()
  if (!raw) return ''
  if (/^https?:\/\//i.test(raw) || raw.startsWith('data:') || raw.startsWith('blob:')) return raw
  const path = raw.startsWith('/') ? raw : `/${raw}`
  return `${IMAGE_BASE_URL}${path}`
}

function statusLabel(statusRaw: unknown) {
  const s = normalizeStatus(statusRaw)
  if (s === 'PENDING' || s === 'CREATED') return '待处理'
  if (s === 'ACCEPTED' || s === 'ASSIGNED') return '已接单'
  if (s === 'PICKED_UP' || s === 'PICKUP' || s === 'PICKED') return '已取件'
  if (s === 'DELIVERING' || s === 'DELIVER') return '配送中'
  if (s === 'COMPLETED' || s === 'DONE' || s === 'FINISHED') return '已完成'
  if (s === 'CANCELLED' || s === 'CANCELED' || s === 'CANCEL') return '已取消'
  return s || '未知'
}

function statusBadgeClass(statusRaw: unknown) {
  const s = normalizeStatus(statusRaw)
  if (s === 'COMPLETED' || s === 'DONE' || s === 'FINISHED') return 'badge text-bg-success'
  if (s === 'CANCELLED' || s === 'CANCELED' || s === 'CANCEL') return 'badge text-bg-secondary'
  if (s === 'DELIVERING' || s === 'DELIVER') return 'badge text-bg-info'
  if (s === 'PICKED_UP' || s === 'PICKUP' || s === 'PICKED') return 'badge text-bg-primary'
  if (s === 'ACCEPTED' || s === 'ASSIGNED') return 'badge text-bg-warning'
  if (s === 'PENDING' || s === 'CREATED') return 'badge text-bg-light border'
  return 'badge text-bg-light border'
}

function formatMoney(v: unknown) {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').trim())
  return (Number.isFinite(n) ? n : 0).toFixed(2)
}

function getAmount(row: any) {
  return formatMoney(row?.fee_total ?? row?.task?.fee_total ?? row?.final_price ?? row?.order?.final_price ?? 0)
}

function toOrderId(o: OrderRow) {
  return String(o.order_id || o.id || '').trim()
}

function openDetail(o: OrderRow) {
  const orderId = String(o.order_id ?? '').trim()
  const taskId = String(o.task_id ?? o.id ?? '').trim()
  
  if (activeTab.value === 'taken') {
    router.push({ name: 'order-track', params: { orderId: orderId || taskId } })
  } else {
    if (orderId) {
      router.push({ name: 'order-track', params: { orderId } })
    } else if (taskId) {
      router.push({ name: 'task-detail', params: { id: taskId } })
    }
  }
}

function openChat(o: OrderRow) {
  const id = toOrderId(o)
  if (!id) return
  chatOrderId.value = id
  chatToUserId.value = ''
  chatVisible.value = true

  const row: any = o as any
  const rowPublisherId = String(row?.publisher_id ?? row?.publisherId ?? row?.task?.publisher_id ?? row?.task?.publisherId ?? '').trim()
  const rowTakerId = String(row?.taker_id ?? row?.takerId ?? row?.runner_id ?? row?.runnerId ?? row?.taker?.id ?? row?.runner?.id ?? '').trim()
  chatToUserId.value = activeTab.value === 'taken' ? rowPublisherId : rowTakerId
  if (chatToUserId.value) return

  void (async () => {
    try {
      const resp = await http.get(`/order/${encodeURIComponent(id)}`)
      const detail = resp.data?.data ?? resp.data
      const root = detail?.data ?? detail
      const publisherId = String(
        root?.task?.publisher_id ?? root?.task?.publisherId ?? root?.publisher_id ?? root?.publisherId ?? '',
      ).trim()
      const takerId = String(root?.taker_id ?? root?.takerId ?? root?.runner_id ?? root?.runnerId ?? '').trim()
      chatToUserId.value = activeTab.value === 'taken' ? publisherId : takerId
    } catch {
      chatToUserId.value = ''
    }
  })()
}

function taskAddress(o: OrderRow) {
  const left = String(o.pickup_address ?? '').trim()
  const right = String(o.delivery_address ?? '').trim()
  if (left && right) return `${left} → ${right}`
  return left || right || '-'
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

const simulatedDistanceCache = new Map<string, number>()

function getSimulatedDistanceMeters(key: string) {
  const k = key || 'order'
  const cached = simulatedDistanceCache.get(k)
  if (cached !== undefined) return cached
  const r = pseudoRandom01(hashStringToUint32(k))
  const km = 1 + r * 4
  const meters = Math.round(km * 1000)
  simulatedDistanceCache.set(k, meters)
  return meters
}

function toEtaMinutesByMeters(meters: number | null) {
  if (!Number.isFinite(Number(meters)) || (meters as number) < 0) return null
  const km = Number(meters) / 1000
  const minutes = Math.ceil(km * 2 + 10)
  return Number.isFinite(minutes) ? minutes : null
}

function stageProgressByStatus(statusRaw: unknown) {
  const s = normalizeStatus(statusRaw)
  if (s === 'COMPLETED' || s === 'DONE' || s === 'FINISHED') return 1
  if (s === 'DELIVERING' || s === 'DELIVER') return 0
  if (s === 'PICKED_UP' || s === 'PICKUP' || s === 'PICKED') return 0.55
  if (s === 'ACCEPTED' || s === 'ASSIGNED') return 0.15
  return 0
}

function clamp01(v: number) {
  return Math.min(1, Math.max(0, v))
}

function pickProgressPercentFromRow(o: any) {
  const raw = o?.progress_percent ?? o?.progressPercent ?? o?.task?.progress_percent ?? o?.task?.progressPercent
  const n = Number(raw)
  if (!Number.isFinite(n)) return null
  return Math.min(100, Math.max(0, n))
}

const deliveringProgressPercent = ref<Record<string, number>>({})
let deliveringTimer: number | null = null

function clearDeliveringTimer() {
  if (deliveringTimer) window.clearInterval(deliveringTimer)
  deliveringTimer = null
}

function deliveringProgressOf(o: OrderRow) {
  const id = toOrderId(o)
  if (!id) return stageProgressByStatus(o.status)
  const stored = deliveringProgressPercent.value[id]
  if (Number.isFinite(stored)) return clamp01(Number(stored) / 100)
  const fromRow = pickProgressPercentFromRow(o as any)
  if (fromRow !== null) return clamp01(fromRow / 100)
  return stageProgressByStatus(o.status)
}

function stageProgress(o: OrderRow) {
  const s = normalizeStatus(o.status)
  if (s === 'DELIVERING' || s === 'DELIVER') return deliveringProgressOf(o)
  return stageProgressByStatus(o.status)
}

function statusLabelForRow(o: OrderRow) {
  const s = normalizeStatus(o.status)
  if ((s === 'DELIVERING' || s === 'DELIVER') && stageProgress(o) >= 1) return '已送达'
  return statusLabel(o.status)
}

function pruneDeliveringProgress(rows: OrderRow[]) {
  const keep = new Set<string>()
  for (const r of rows) {
    const id = toOrderId(r)
    if (!id) continue
    if (isDeliveringStatus(r.status)) keep.add(id)
  }
  const next: Record<string, number> = {}
  for (const [k, v] of Object.entries(deliveringProgressPercent.value)) {
    if (keep.has(k) && Number.isFinite(Number(v))) next[k] = Number(v)
  }
  deliveringProgressPercent.value = next
}

function shouldRunDeliveringTimer() {
  if (!isRunner.value) return false
  if (activeTab.value !== 'taken') return false
  return takenRows.value.some((r) => isDeliveringStatus(r.status))
}

function startDeliveringTimerIfNeeded() {
  if (!shouldRunDeliveringTimer()) {
    clearDeliveringTimer()
    return
  }
  if (deliveringTimer) return
  deliveringTimer = window.setInterval(() => {
    if (!shouldRunDeliveringTimer()) {
      clearDeliveringTimer()
      return
    }
    for (const r of takenRows.value) {
      if (!isDeliveringStatus(r.status)) continue
      const id = toOrderId(r)
      if (!id) continue
      const currentPercent = Math.round(stageProgress(r) * 100)
      if (currentPercent >= 100) {
        continue
      }
      const next = Math.min(100, currentPercent + 10)
      deliveringProgressPercent.value = { ...deliveringProgressPercent.value, [id]: next }
    }
  }, 10000)
}

function etaRemainMinutes(o: OrderRow) {
  const id = toOrderId(o)
  const meters = getSimulatedDistanceMeters(`${id}|${pickupAddressText(o)}|${deliveryAddressText(o)}`)
  const total = toEtaMinutesByMeters(meters) ?? 20
  const progress = stageProgress(o)
  const remain = Math.round(total * (1 - progress))
  return remain > 0 ? remain : 0
}

function runnerLeft(o: OrderRow) {
  const progress = stageProgress(o)
  return `${(progress * 100).toFixed(2)}%`
}

type StoredChatMessage = { id: string; from: 'user' | 'runner'; text: string; ts: number }

function safeParseMessages(raw: string | null) {
  if (!raw) return []
  try {
    const v = JSON.parse(raw)
    if (!Array.isArray(v)) return []
    return v
      .map((m) => ({
        id: String(m?.id ?? ''),
        from: m?.from === 'runner' ? 'runner' : 'user',
        text: String(m?.text ?? ''),
        ts: Number(m?.ts ?? 0),
      }))
      .filter((m) => m.id && m.text && Number.isFinite(m.ts) && m.ts > 0) as StoredChatMessage[]
  } catch {
    return []
  }
}

function lastUserMessagePreview(orderId: string) {
  const id = String(orderId ?? '').trim()
  if (!id) return ''
  const raw = localStorage.getItem(`ce:order_chat:${id}`)
  const list = safeParseMessages(raw)
  const lastFromUser = [...list].reverse().find((m) => m.from === 'user')
  return lastFromUser ? lastFromUser.text : ''
}

function pickupAddressText(o: OrderRow) {
  return String(o.pickup_address ?? '').trim() || '-'
}

function deliveryAddressText(o: OrderRow) {
  return String(o.delivery_address ?? '').trim() || '-'
}

function runnerNextAction(statusRaw: unknown): 'pickup' | 'startDelivering' | 'complete' | 'uploadDeliveryPhoto' | null {
  const s = normalizeStatus(statusRaw)
  if (s === 'ACCEPTED' || s === 'ASSIGNED') return 'pickup'
  if (s === 'PICKED_UP' || s === 'PICKUP' || s === 'PICKED') return 'startDelivering'
  if (s === 'DELIVERING' || s === 'DELIVER') return 'complete'
  if (s === 'COMPLETED' || s === 'DONE' || s === 'FINISHED') return 'uploadDeliveryPhoto'
  return null
}

function isCompletedStatus(statusRaw: unknown) {
  const s = normalizeStatus(statusRaw)
  return s === 'COMPLETED' || s === 'DONE' || s === 'FINISHED'
}

function isCancelledStatus(statusRaw: unknown) {
  const s = normalizeStatus(statusRaw)
  return s === 'CANCELLED' || s === 'CANCELED' || s === 'CANCEL'
}

function isDeliveringStatus(statusRaw: unknown) {
  const s = normalizeStatus(statusRaw)
  return s === 'DELIVERING' || s === 'DELIVER'
}

function isCancelableStatus(statusRaw: unknown) {
  const s = normalizeStatus(statusRaw)
  return s === 'PENDING' || s === 'ACCEPTED'
}

function canUrge(o: OrderRow) {
  return !isCompletedStatus(o.status) && !isCancelledStatus(o.status)
}

function canCancel(o: OrderRow) {
  const id = toOrderId(o)
  if (!id) return false
  return isCancelableStatus(o.status)
}

function canConfirm(o: OrderRow) {
  const id = toOrderId(o)
  if (!id) return false
  return isDeliveringStatus(o.status) && !locallyConfirmed.value[id]
}

function pickItems(data: any): OrderRow[] {
  const root = data?.data ?? data
  const items = root?.items ?? root?.list ?? root?.rows ?? root?.records ?? root?.result ?? []
  return Array.isArray(items) ? (items as OrderRow[]) : []
}

function buildListUrl(type: TabKey) {
  return `/order/list?type=${encodeURIComponent(type)}`
}

async function fetchPublished() {
  loading.value = true
  errorMessage.value = ''
  try {
    const url = buildListUrl('published')
    console.log('[MyOrders] GET', `${baseURL.replace(/\/$/, '')}${url}`)
    const resp = await http.get(url)
    console.log('[MyOrders] published response', resp.data)
    publishedRows.value = pickItems(resp.data)
  } catch (err: any) {
    errorMessage.value = getErrorMessage(err)
  } finally {
    loading.value = false
  }
}

async function fetchTaken() {
  loading.value = true
  errorMessage.value = ''
  try {
    const url = buildListUrl('taken')
    console.log('[MyOrders] GET', `${baseURL.replace(/\/$/, '')}${url}`)
    const resp = await http.get(url)
    console.log('[MyOrders] taken response', resp.data)
    takenRows.value = pickItems(resp.data)
    pruneDeliveringProgress(takenRows.value)
  } catch (err: any) {
    errorMessage.value = getErrorMessage(err)
  } finally {
    loading.value = false
    startDeliveringTimerIfNeeded()
  }
}

async function refresh() {
  if (activeTab.value === 'taken') return fetchTaken()
  return fetchPublished()
}

async function loadOrders() {
  return refresh()
}

function setTab(next: TabKey) {
  if (next === 'taken' && !isRunner.value) return
  activeTab.value = next
}

function isBusy(id: string | number, action: string) {
  return busyAction.value[String(id)] === action
}

async function runAction(id: string, action: string, runner: () => Promise<any>, successMessage: string) {
  if (loading.value) return
  if (busyAction.value[id]) return

  busyAction.value = { ...busyAction.value, [id]: action }
  try {
    await runner()
    ElMessage.success(successMessage)
    await loadOrders()
  } catch (err: any) {
    ElMessage.error(getErrorMessage(err))
  } finally {
    busyAction.value = { ...busyAction.value, [id]: undefined }
  }
}

async function onUrge(o: OrderRow) {
  const ok = window.confirm('确认催单？')
  if (!ok) return
  const orderId = toOrderId(o)
  await runAction(String(o.id), 'urge', () => urgeOrder(orderId), '已催单')
}

async function onCancel(o: OrderRow) {
  if (!isCancelableStatus(o.status)) return
  const ok = window.confirm('确认取消该订单？')
  if (!ok) return
  const orderId = String(o.order_id ?? '').trim()
  const taskId = String(o.task_id ?? o.id ?? '').trim()
  
  if (orderId) {
    await runAction(String(o.id), 'cancel', () => cancelOrder(orderId), '订单已取消')
  } else if (taskId) {
    await runAction(String(o.id), 'cancel', () => http.delete(`/task/${encodeURIComponent(taskId)}/cancel`), '任务已取消')
  }
}

function isAlreadyConfirmedError(err: any) {
  const msg = String(getErrorMessage(err) ?? '').toLowerCase()
  return msg.includes('已确认') || msg.includes('already') || msg.includes('重复') || msg.includes('exists')
}

async function onConfirm(o: OrderRow) {
  const ok = window.confirm('确认完成该订单？')
  if (!ok) return
  if (loading.value) return
  const orderId = toOrderId(o)
  if (!orderId) return
  const rowId = String(o.id)
  if (busyAction.value[rowId]) return

  busyAction.value = { ...busyAction.value, [rowId]: 'confirm' }
  try {
    try {
      await confirmOrderApi(orderId)
    } catch (err: any) {
      if (!isAlreadyConfirmedError(err)) throw err
    }
    locallyConfirmed.value = { ...locallyConfirmed.value, [orderId]: true }
    ElMessage.success('已确认完成')
    await loadOrders()
  } catch (err: any) {
    ElMessage.error(getErrorMessage(err))
  } finally {
    busyAction.value = { ...busyAction.value, [rowId]: undefined }
  }
}

async function onPickup(o: OrderRow) {
  const orderId = toOrderId(o)
  if (!orderId) return
  runnerPhotoMode.value = 'pickup'
  runnerPhotoOrderId.value = orderId
  runnerPhotoFileList.value = []
  runnerPhotoUrl.value = ''
  runnerPhotoVisible.value = true
}

async function onDeliver(o: OrderRow) {
  const orderId = toOrderId(o)
  if (!orderId) return
  await runAction(String(o.id), 'startDelivering', () => deliverOrder(orderId), '已开始配送')
}

function openDeliveryPhotoDialog(orderId: string) {
  const id = String(orderId ?? '').trim()
  if (!id) return
  runnerPhotoMode.value = 'deliver'
  runnerPhotoOrderId.value = id
  runnerPhotoFileList.value = []
  runnerPhotoUrl.value = ''
  runnerPhotoVisible.value = true
}

async function onComplete(o: OrderRow) {
  const orderId = toOrderId(o)
  if (!orderId) return
  if (loading.value) return
  const rowId = String(o.id)
  if (busyAction.value[rowId]) return
  busyAction.value = { ...busyAction.value, [rowId]: 'complete' }
  try {
    await completeOrder(orderId)
    ElMessage.success('订单已完成，请上传送达照片')
    openDeliveryPhotoDialog(orderId)
    await loadOrders()
  } catch (err: any) {
    ElMessage.error(getErrorMessage(err))
  } finally {
    busyAction.value = { ...busyAction.value, [rowId]: undefined }
  }
}

async function onUploadDeliveryPhoto(o: OrderRow) {
  const orderId = toOrderId(o)
  if (!orderId) return
  openDeliveryPhotoDialog(orderId)
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
  runnerPhotoOrderId.value = ''
  runnerPhotoMode.value = 'pickup'
}

async function submitRunnerPhoto() {
  if (runnerPhotoSubmitting.value) return
  const id = runnerPhotoOrderId.value
  if (!id) return
  if (!runnerPhotoUrl.value) {
    ElMessage.warning('请先上传图片')
    return
  }

  runnerPhotoSubmitting.value = true
  try {
    if (runnerPhotoMode.value === 'pickup') {
      await pickupOrder(id, runnerPhotoUrl.value)
      ElMessage.success('已取件')
      closeRunnerPhoto()
      await loadOrders()
      return
    }

    await saveDeliveryPhoto(id, runnerPhotoUrl.value)
    ElMessage.success('已保存送达照片')
    closeRunnerPhoto()
    await loadOrders()
  } catch (err: any) {
    ElMessage.error(getErrorMessage(err))
  } finally {
    runnerPhotoSubmitting.value = false
  }
}

const displayRows = computed(() => (activeTab.value === 'taken' ? takenRows.value : publishedRows.value))

watch(
  () => isRunner.value,
  (r) => {
    if (!r && activeTab.value === 'taken') activeTab.value = 'published'
  },
)

watch(
  () => activeTab.value,
  () => {
    loadOrders()
    startDeliveringTimerIfNeeded()
  },
)

onMounted(() => {
  if (activeTab.value === 'taken' && !isRunner.value) activeTab.value = 'published'
  loadOrders()
  startDeliveringTimerIfNeeded()
})

onUnmounted(() => {
  clearDeliveringTimer()
})
</script>

<template>
  <div class="vstack gap-3">
    <div class="d-flex flex-wrap align-items-end justify-content-between gap-2">
      <div>
        <h1 class="h4 mb-1">我的订单</h1>
        <div class="text-muted">查看/操作我的订单</div>
      </div>
      <div class="d-flex gap-2">
        <button class="btn btn-outline-primary" type="button" :disabled="loading" @click="loadOrders">刷新</button>
      </div>
    </div>

    <div class="card border-0 shadow-sm">
      <div class="card-body">
        <ul class="nav nav-tabs">
          <li class="nav-item">
            <button
              class="nav-link"
              :class="{ active: activeTab === 'published' }"
              type="button"
              :disabled="loading"
              @click="setTab('published')"
            >
              我发布的订单
            </button>
          </li>
          <li v-if="isRunner" class="nav-item">
            <button
              class="nav-link"
              :class="{ active: activeTab === 'taken' }"
              type="button"
              :disabled="loading"
              @click="setTab('taken')"
            >
              我接单的订单
            </button>
          </li>
        </ul>

        <div v-if="errorMessage" class="alert alert-danger mt-3 mb-0" role="alert">{{ errorMessage }}</div>

        <div v-if="loading && displayRows.length === 0" class="placeholder-glow mt-3">
          <div class="placeholder col-12 mb-2" />
          <div class="placeholder col-10 mb-2" />
          <div class="placeholder col-11" />
        </div>

        <div v-else class="mt-3 vstack gap-2">
          <div v-if="displayRows.length === 0" class="text-muted">暂无订单</div>

          <div v-for="o in displayRows" :key="o.id" class="card border-0 shadow-sm">
            <div class="card-body">
              <div class="d-flex flex-wrap align-items-start justify-content-between gap-2">
                <div class="vstack gap-1">
                  <template v-if="activeTab === 'taken'">
                    <div class="d-flex flex-wrap align-items-center gap-2">
                      <span :class="statusBadgeClass(o.status)">{{ statusLabelForRow(o) }}</span>
                    </div>
                    <div class="text-muted small">取件地址：{{ pickupAddressText(o) }}</div>
                    <div class="text-muted small">送达地址：{{ deliveryAddressText(o) }}</div>
                    <div class="mini-route-box mt-2">
                      <div class="d-flex align-items-center justify-content-between">
                        <div class="text-muted small">ETA：{{ etaRemainMinutes(o) }} 分钟</div>
                        <div class="text-muted small">进度：{{ Math.round(stageProgress(o) * 100) }}%</div>
                      </div>
                      <div class="mini-route mt-2">
                        <div class="mini-dot start" />
                        <div class="mini-line">
                          <div class="mini-runner" :style="{ left: runnerLeft(o) }" />
                        </div>
                        <div class="mini-dot end" />
                      </div>
                      <div class="text-muted small mt-2">
                        用户消息：{{ lastUserMessagePreview(toOrderId(o)) || '暂无' }}
                      </div>
                    </div>
                  </template>
                  <template v-else>
                    <div class="d-flex flex-wrap align-items-center gap-2">
                      <div class="fw-semibold">{{ taskAddress(o) }}</div>
                      <span :class="statusBadgeClass(o.status)">{{ statusLabel(o.status) }}</span>
                    </div>
                    <div class="text-muted small">金额：¥ {{ getAmount(o) }}</div>
                  </template>
                </div>

                <div class="d-flex flex-wrap gap-2">
                  <template v-if="activeTab === 'published'">
                    <button class="btn btn-outline-primary btn-sm" type="button" :disabled="loading" @click="openDetail(o)">
                      详情
                    </button>
                    <button
                      v-if="o.order_id"
                      class="btn btn-outline-secondary btn-sm"
                      type="button"
                      :disabled="loading"
                      @click="openChat(o)"
                    >
                      联系跑腿员
                    </button>
                    <button
                      v-if="canUrge(o)"
                      class="btn btn-outline-secondary btn-sm"
                      type="button"
                      :disabled="loading || isBusy(o.id, 'urge')"
                      @click="onUrge(o)"
                    >
                      催单
                    </button>
                    <button
                      v-if="canCancel(o)"
                      class="btn btn-outline-danger btn-sm"
                      type="button"
                      :disabled="loading || isBusy(o.id, 'cancel')"
                      @click="onCancel(o)"
                    >
                      取消订单
                    </button>
                    <button
                      v-if="canConfirm(o)"
                      class="btn btn-primary btn-sm"
                      type="button"
                      :disabled="loading || isBusy(o.id, 'confirm')"
                      @click="onConfirm(o)"
                    >
                      确认完成
                    </button>
                  </template>

                  <template v-else-if="activeTab === 'taken'">
                    <button class="btn btn-outline-primary btn-sm" type="button" :disabled="loading" @click="openDetail(o)">
                      详情
                    </button>
                    <button class="btn btn-outline-secondary btn-sm" type="button" :disabled="loading" @click="openChat(o)">
                      消息
                    </button>
                    <button
                      v-if="runnerNextAction(o.status) === 'pickup'"
                      class="btn btn-outline-primary btn-sm"
                      type="button"
                      :disabled="loading || isBusy(o.id, 'pickup')"
                      @click="onPickup(o)"
                    >
                      取件
                    </button>
                    <button
                      v-if="runnerNextAction(o.status) === 'startDelivering'"
                      class="btn btn-outline-primary btn-sm"
                      type="button"
                      :disabled="loading || isBusy(o.id, 'startDelivering')"
                      @click="onDeliver(o)"
                    >
                      开始配送
                    </button>
                    <button
                      v-if="runnerNextAction(o.status) === 'uploadDeliveryPhoto'"
                      class="btn btn-primary btn-sm"
                      type="button"
                      :disabled="loading"
                      @click="onUploadDeliveryPhoto(o)"
                    >
                      上传送达照片
                    </button>
                    <button
                      v-if="runnerNextAction(o.status) === 'complete'"
                      class="btn btn-primary btn-sm"
                      type="button"
                      :disabled="loading || isBusy(o.id, 'complete')"
                      @click="onComplete(o)"
                    >
                      完成订单
                    </button>
                  </template>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
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

  <ChatSimulator v-model="chatVisible" :order-id="chatOrderId" :to-user-id="chatToUserId" />
</template>

<style scoped>
.mini-route-box {
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 12px;
  padding: 12px;
  background: rgba(0, 0, 0, 0.02);
}

.mini-route {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 14px;
}

.mini-dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  border: 2px solid rgba(0, 0, 0, 0.25);
  background: #ffffff;
  flex: 0 0 auto;
}

.mini-dot.start {
  border-color: rgba(25, 135, 84, 0.8);
}

.mini-dot.end {
  border-color: rgba(220, 53, 69, 0.8);
}

.mini-line {
  position: relative;
  height: 2px;
  background: linear-gradient(90deg, rgba(25, 135, 84, 0.8), rgba(220, 53, 69, 0.8));
  flex: 1 1 auto;
  border-radius: 999px;
}

.mini-runner {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: rgba(13, 110, 253, 0.95);
  border: 2px solid rgba(255, 255, 255, 0.95);
  box-shadow: 0 2px 10px rgba(13, 110, 253, 0.3);
}
</style>
