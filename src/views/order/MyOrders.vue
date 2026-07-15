<script setup lang="ts">
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules, UploadFile, UploadFiles, UploadUserFile } from 'element-plus'
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import {
  cancelOrder,
  completeOrder,
  confirmOrder as confirmOrderApi,
  deliverOrder,
  pickupOrder,
  saveDeliveryPhoto,
  submitOrderReview,
  urgeOrder,
} from '@/api/order'
import { baseURL, http } from '@/api/request'
import { cancelTask } from '@/api/task'
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
  orderId?: string | number
  task_id?: string | number
  taskId?: string | number
  pickup_address?: string
  delivery_address?: string
  status?: string
  fee_total?: number | string
  final_price?: number | string
  task?: {
    id?: string | number
    fee_total?: number | string
  }
  order?: {
    id?: string | number
    final_price?: number | string
  }
  hasRefunded?: boolean
}

const publishedRows = ref<OrderRow[]>([])
const takenRows = ref<OrderRow[]>([])

const busyAction = ref<Record<string, string | undefined>>({})
const locallyConfirmed = ref<Record<string, boolean | undefined>>({})

// 退款相关
const refundDialogVisible = ref(false)
const refundSubmitting = ref(false)
const refundReason = ref('')
const refundDescription = ref('')
const currentRefundOrder = ref<any>(null)

const REVIEW_TAG_OPTIONS = ['准时', '态度好', '物品完好', '速度快', '专业', '细心']
const reviewDialogVisible = ref(false)
const reviewSubmitting = ref(false)
const reviewFormRef = ref<FormInstance>()
const currentReviewOrder = ref<OrderRow | null>(null)
const reviewFileList = ref<UploadUserFile[]>([])
const reviewImageMap = ref<Record<string, string>>({})
const locallyReviewed = ref<Record<string, boolean | undefined>>({})
const reviewForm = reactive({
  rating: 0,
  tags: [] as string[],
  content: '',
  images: [] as string[],
})
const reviewRules: FormRules = {
  rating: [
    {
      validator: (_rule, value, callback) => {
        if (Number(value) > 0) {
          callback()
          return
        }
        callback(new Error('请选择评分'))
      },
      trigger: 'change',
    },
  ],
}

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

function pickOrderIdFromRow(row: any) {
  return String(
    row?.order_id ??
      row?.orderId ??
      row?.order?.id ??
      row?.order?.order_id ??
      row?.order?.orderId ??
      '',
  ).trim()
}

function pickTaskIdFromRow(row: any) {
  return String(row?.task_id ?? row?.taskId ?? row?.task?.id ?? row?.id ?? '').trim()
}

function hasTaskOrOrderId(row: any) {
  return Boolean(pickOrderIdFromRow(row) || pickTaskIdFromRow(row))
}

function pickStatusFromRow(row: any) {
  return normalizeStatus(
    row?.status ??
      row?.order_status ??
      row?.orderStatus ??
      row?.task?.status ??
      row?.task?.order_status ??
      row?.task?.orderStatus ??
      '',
  )
}

function isPublishedVisibleStatus(statusRaw: unknown) {
  const s = normalizeStatus(statusRaw)
  return (
    s === 'PENDING' ||
    s === 'CREATED' ||
    s === 'ACCEPTED' ||
    s === 'ASSIGNED' ||
    s === 'PICKED' ||
    s === 'PICKED_UP' ||
    s === 'PICKUP' ||
    s === 'DELIVERING' ||
    s === 'DELIVER' ||
    s === 'COMPLETED' ||
    s === 'DONE' ||
    s === 'FINISHED' ||
    s === 'CANCELLED' ||
    s === 'CANCELED' ||
    s === 'CANCEL'
  )
}

function isTakenVisibleStatus(statusRaw: unknown) {
  const s = normalizeStatus(statusRaw)
  return (
    s === 'ACCEPTED' ||
    s === 'ASSIGNED' ||
    s === 'PICKED' ||
    s === 'PICKED_UP' ||
    s === 'PICKUP' ||
    s === 'DELIVERING' ||
    s === 'DELIVER' ||
    s === 'COMPLETED' ||
    s === 'DONE' ||
    s === 'FINISHED'
  )
}

function toOrderId(o: OrderRow) {
  const picked = pickOrderIdFromRow(o)
  if (picked) return picked
  return String((o as any)?.id ?? '').trim()
}

function openDetail(o: OrderRow) {
  const orderId = toOrderId(o)
  const taskId = pickTaskIdFromRow(o)

  if (orderId) {
    router.push({ name: 'order-track', params: { orderId } })
    return
  }
  if (taskId) {
    router.push({ name: 'task-detail', params: { id: taskId } })
  }
}

function openChat(o: OrderRow) {
  const id = toOrderId(o)
  if (!id) return
  chatOrderId.value = id
  chatToUserId.value = ''
  chatVisible.value = true

  const row: any = o as any
  const rowPublisherId = String(
    row?.publisher_id ??
      row?.publisherId ??
      row?.task?.publisher_id ??
      row?.task?.publisherId ??
      row?.publisher?.id ??
      row?.publisher?.user_id ??
      row?.task?.publisher?.id ??
      row?.task?.publisher?.user_id ??
      '',
  ).trim()
  const rowTakerId = String(
    row?.taker_id ??
      row?.takerId ??
      row?.runner_id ??
      row?.runnerId ??
      row?.task?.taker_id ??
      row?.task?.takerId ??
      row?.task?.runner_id ??
      row?.task?.runnerId ??
      row?.taker?.id ??
      row?.runner?.id ??
      row?.task?.taker?.id ??
      row?.task?.runner?.id ??
      row?.taker?.user_id ??
      row?.runner?.user_id ??
      row?.task?.taker?.user_id ??
      row?.task?.runner?.user_id ??
      '',
  ).trim()
  chatToUserId.value = activeTab.value === 'taken' ? rowPublisherId : rowTakerId
  if (chatToUserId.value) return

  void (async () => {
    try {
      const resp = await http.get(`/order/${encodeURIComponent(id)}`)
      const detail = resp.data?.data ?? resp.data
      const root = detail?.data ?? detail
      const publisherId = String(
        root?.task?.publisher_id ??
          root?.task?.publisherId ??
          root?.publisher_id ??
          root?.publisherId ??
          root?.publisher?.id ??
          root?.publisher?.user_id ??
          root?.task?.publisher?.id ??
          root?.task?.publisher?.user_id ??
          '',
      ).trim()
      const takerId = String(
        root?.taker_id ??
          root?.takerId ??
          root?.runner_id ??
          root?.runnerId ??
          root?.task?.taker_id ??
          root?.task?.takerId ??
          root?.task?.runner_id ??
          root?.task?.runnerId ??
          root?.taker?.id ??
          root?.runner?.id ??
          root?.task?.taker?.id ??
          root?.task?.runner?.id ??
          root?.taker?.user_id ??
          root?.runner?.user_id ??
          root?.task?.taker?.user_id ??
          root?.task?.runner?.user_id ??
          '',
      ).trim()
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

function runnerNextAction(statusRaw: unknown): 'pickup' | 'startDelivering' | 'markDelivered' | null {
  const s = normalizeStatus(statusRaw)
  if (s === 'ACCEPTED' || s === 'ASSIGNED') return 'pickup'
  if (s === 'PICKED_UP' || s === 'PICKUP' || s === 'PICKED') return 'startDelivering'
  if (s === 'DELIVERING' || s === 'DELIVER') return 'markDelivered'
  return null
}

function isCompletedStatus(statusRaw: unknown) {
  const s = normalizeStatus(statusRaw)
  return s === 'COMPLETED' || s === 'DONE' || s === 'FINISHED'
}

function isAwaitingUserConfirmStatus(statusRaw: unknown) {
  return normalizeStatus(statusRaw) === 'COMPLETED'
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
  const id = toOrderId(o)
  if (!id) return false
  return !isCompletedStatus(o.status) && !isCancelledStatus(o.status)
}

function canCancel(o: OrderRow) {
  const orderId = toOrderId(o)
  const taskId = pickTaskIdFromRow(o)
  if (!orderId && !taskId) return false
  const status = pickStatusFromRow(o)
  return isCancelableStatus(status)
}

function canConfirm(o: OrderRow) {
  const id = toOrderId(o)
  if (!id) return false
  // 只有配送中状态才能确认完成
  const isDelivering = isDeliveringStatus(o.status)
  const notConfirmed = !locallyConfirmed.value[id]
  return isDelivering && notConfirmed
}

function canApplyRefund(o: OrderRow) {
  // 只有配送中状态才能申请退款，已完成的不显示
  const isDelivering = isDeliveringStatus(o.status)
  const notRefunded = !(o as any).hasRefunded
  return isDelivering && notRefunded
}

function isTruthyFlag(value: unknown) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value > 0
  if (value && typeof value === 'object') return true
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
  return ['1', 'true', 'yes', 'reviewed', 'done', 'completed', '已评价'].includes(normalized)
}





function hasReviewed(o: OrderRow) {
  // 跑腿员侧不显示已评价状态
  if (activeTab.value === 'taken') return false
  
  const orderId = toOrderId(o)
  if (!orderId) return false
  if (locallyReviewed.value[orderId]) return true

  const row: any = o as any
  const roleSpecificFlags =
    activeTab.value === 'published'
      ? [
          row?.publisher_reviewed,
          row?.publisherReviewed,
          row?.user_reviewed,
          row?.userReviewed,
          row?.customer_reviewed,
          row?.customerReviewed,
        ]
      : [
          row?.runner_reviewed,
          row?.runnerReviewed,
          row?.taker_reviewed,
          row?.takerReviewed,
          row?.courier_reviewed,
          row?.courierReviewed,
        ]

  const genericFlags = [
    row?.has_review,
    row?.hasReview,
    row?.has_reviewed,
    row?.hasReviewed,
    row?.is_reviewed,
    row?.isReviewed,
    row?.reviewed,
    row?.my_review,
    row?.myReview,
    row?.review,
    row?.review_id,
    row?.reviewId,
    row?.review_status,
    row?.reviewStatus,
  ]

  return [...roleSpecificFlags, ...genericFlags].some((value) => isTruthyFlag(value))
}

function canReviewBase(o: OrderRow) {
  const orderId = toOrderId(o)
  if (!orderId) return false
  // 只有已完成状态才能评价
  if (!isCompletedStatus(o.status)) return false
  // 跑腿员不能评价
  if (activeTab.value === 'taken') return false
  return true
}
function canReview(o: OrderRow) {
  // 跑腿员不能评价
  if (activeTab.value === 'taken') return false
  
  const orderId = toOrderId(o)
  if (!orderId) return false
  // 只有已完成状态才能评价
  if (!isCompletedStatus(o.status)) return false
  // 如果已评价，不显示
  if (hasReviewed(o)) return false
  return true
}

function syncReviewImages() {
  reviewForm.images = reviewFileList.value
    .map((file) => reviewImageMap.value[String(file.uid)])
    .filter((url): url is string => Boolean(url))
}

function resetReviewState() {
  reviewForm.rating = 0
  reviewForm.tags = []
  reviewForm.content = ''
  reviewForm.images = []
  reviewFileList.value = []
  reviewImageMap.value = {}
}

function openReviewDialog(o: OrderRow) {
  if (!canReview(o)) return
  currentReviewOrder.value = o
  resetReviewState()
  reviewDialogVisible.value = true
  void nextTick(() => {
    reviewFormRef.value?.clearValidate()
  })
}

function closeReviewDialog() {
  if (reviewSubmitting.value) return
  reviewDialogVisible.value = false
}

function handleReviewDialogClosed() {
  currentReviewOrder.value = null
  resetReviewState()
  reviewFormRef.value?.clearValidate()
}

function onReviewUploadSuccess(response: any, uploadFile: UploadFile, uploadFiles: UploadFiles) {
  try {
    const url = normalizeUploadUrl(response)
    reviewImageMap.value = { ...reviewImageMap.value, [String(uploadFile.uid)]: url }
    uploadFile.url = toFullUrl(url)
    const target = uploadFiles.find((file) => file.uid === uploadFile.uid)
    if (target) target.url = toFullUrl(url)
    reviewFileList.value = uploadFiles as unknown as UploadUserFile[]
    syncReviewImages()
  } catch (err: any) {
    ElMessage.error(err?.message || '图片上传失败')
  }
}

function onReviewUploadRemove(uploadFile: UploadFile, uploadFiles: UploadFiles) {
  const nextMap = { ...reviewImageMap.value }
  delete nextMap[String(uploadFile.uid)]
  reviewImageMap.value = nextMap
  reviewFileList.value = uploadFiles as unknown as UploadUserFile[]
  syncReviewImages()
}

function onReviewUploadExceed() {
  ElMessage.warning('最多上传 3 张图片')
}

function onReviewUploadError() {
  ElMessage.error('图片上传失败')
}

async function submitReview() {
  const targetOrder = currentReviewOrder.value
  if (!targetOrder) return
  if (reviewFileList.value.some((file) => file.status === 'uploading')) {
    ElMessage.warning('图片上传中，请稍候再提交')
    return
  }

  const valid = await reviewFormRef.value?.validate().catch(() => false)
  if (!valid) return

  const orderId = toOrderId(targetOrder)
  if (!orderId) return

  reviewSubmitting.value = true
  try {
    syncReviewImages()
    await submitOrderReview(orderId, {
      rating: Number(reviewForm.rating),
      tags: [...reviewForm.tags],
      content: reviewForm.content.trim(),
      images: [...reviewForm.images],
    })
    locallyReviewed.value = { ...locallyReviewed.value, [orderId]: true }
    reviewDialogVisible.value = false
    ElMessage.success('评价提交成功')
    await loadOrders()
  } catch (err: any) {
    ElMessage.error(getErrorMessage(err))
  } finally {
    reviewSubmitting.value = false
  }
}

function pickItems(data: any, type: TabKey): OrderRow[] {
  const root = data?.data ?? data
  const items = root?.items ?? root?.list ?? root?.rows ?? root?.records ?? root?.result ?? []
  if (!Array.isArray(items)) return []
  return (items as any[])
    .map((it) => {
      const task = it?.task ?? {}
      const orderId = pickOrderIdFromRow(it)
      const taskId = String(it?.task_id ?? it?.taskId ?? task?.id ?? it?.id ?? '').trim()
      const normalized: any = { ...(it as any) }
      if (orderId && normalized.order_id === undefined) normalized.order_id = orderId
      if (taskId && normalized.task_id === undefined) normalized.task_id = taskId
      if (normalized.status === undefined && task?.status !== undefined) normalized.status = task.status
      if (normalized.pickup_address === undefined && task?.pickup_address !== undefined) normalized.pickup_address = task.pickup_address
      if (normalized.pickupAddress === undefined && task?.pickupAddress !== undefined) normalized.pickupAddress = task.pickupAddress
      if (normalized.delivery_address === undefined && task?.delivery_address !== undefined) normalized.delivery_address = task.delivery_address
      if (normalized.deliveryAddress === undefined && task?.deliveryAddress !== undefined) normalized.deliveryAddress = task.deliveryAddress
      if (normalized.fee_total === undefined && task?.fee_total !== undefined) normalized.fee_total = task.fee_total
      if (normalized.final_price === undefined && task?.final_price !== undefined) normalized.final_price = task.final_price
      return normalized as OrderRow
    })
    .filter((row) => {
      const status = pickStatusFromRow(row)
      if (type === 'published') {
        return hasTaskOrOrderId(row) && isPublishedVisibleStatus(status)
      }
      return Boolean(pickOrderIdFromRow(row)) && isTakenVisibleStatus(status)
    })
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
    publishedRows.value = pickItems(resp.data, 'published')
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
    takenRows.value = pickItems(resp.data, 'taken')
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

function removeOrderRowLocally(o: OrderRow) {
  const targetId = pickOrderIdFromRow(o)
  if (!targetId) return
  if (activeTab.value === 'taken') {
    takenRows.value = takenRows.value.filter((row) => pickOrderIdFromRow(row) !== targetId)
    pruneDeliveringProgress(takenRows.value)
    startDeliveringTimerIfNeeded()
    return
  }
  publishedRows.value = publishedRows.value.filter((row) => pickOrderIdFromRow(row) !== targetId)
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
  if (!orderId) return
  await runAction(String(o.id), 'urge', () => urgeOrder(orderId), '已催单')
}

async function onCancel(o: OrderRow) {
  const status = pickStatusFromRow(o)
  if (!isCancelableStatus(status)) return
  const ok = window.confirm('确认取消该订单？')
  if (!ok) return
  const orderId = toOrderId(o)
  const taskId = pickTaskIdFromRow(o)
  if (!orderId && !taskId) return
  if (loading.value) return
  const rowId = String(o.id)
  if (busyAction.value[rowId]) return

  busyAction.value = { ...busyAction.value, [rowId]: 'cancel' }
  try {
    const shouldCancelTask = status === 'PENDING' || (!orderId && !!taskId)
    if (shouldCancelTask) {
      await cancelTask(taskId)
      ElMessage.success('任务已取消')
    } else if (orderId) {
      await cancelOrder(orderId)
      ElMessage.success('订单已取消')
    }
    removeOrderRowLocally(o)
    await loadOrders()
  } catch (err: any) {
    ElMessage.error(getErrorMessage(err))
  } finally {
    busyAction.value = { ...busyAction.value, [rowId]: undefined }
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

// 申请退款
function applyRefund(o: OrderRow) {
  if (!canApplyRefund(o)) {
    ElMessage.warning('当前状态无法申请退款')
    return
  }
  currentRefundOrder.value = o
  refundReason.value = ''
  refundDescription.value = ''
  refundDialogVisible.value = true
}

async function submitRefund() {
  if (!refundReason.value) {
    ElMessage.warning('请选择退款原因')
    return
  }
  if (!currentRefundOrder.value) return
  
  refundSubmitting.value = true
  try {
    const orderId = toOrderId(currentRefundOrder.value)
    await http.post(`/order/${orderId}/refund`, {
      reason: refundReason.value,
      description: refundDescription.value
    })
    
    ElMessage.success('退款申请已提交，请等待管理员审核')
    refundDialogVisible.value = false
    
    await loadOrders()
    
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.message || '提交失败')
  } finally {
    refundSubmitting.value = false
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
      console.log('取件图片URL:', runnerPhotoUrl.value)
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

function runnerDisplayLabel(o: OrderRow) {
  const s = normalizeStatus(o.status)
  if ((s === 'DELIVERING' || s === 'DELIVER') && stageProgress(o) >= 1) return '已完成'
  return statusLabel(o.status)
}

function runnerDisplayBadgeClass(o: OrderRow) {
  const s = normalizeStatus(o.status)
  if ((s === 'DELIVERING' || s === 'DELIVER') && stageProgress(o) >= 1) return 'badge text-bg-success'
  return statusBadgeClass(o.status)
}

function publishedDisplayLabel(o: OrderRow) {
  const id = toOrderId(o)
  // 已完成状态直接显示「已完成」
  if (isCompletedStatus(o.status)) return '已完成'
  // 本地确认标记优先
  if (id && locallyConfirmed.value[id]) return '已完成'
  if (isAwaitingUserConfirmStatus(o.status)) return '待确认'
  return statusLabel(o.status)
}

function publishedDisplayBadgeClass(o: OrderRow) {
  const id = toOrderId(o)
  // 已完成状态用绿色
  if (isCompletedStatus(o.status)) return 'badge text-bg-success'
  if (id && locallyConfirmed.value[id]) return 'badge text-bg-success'
  if (isAwaitingUserConfirmStatus(o.status)) return 'badge text-bg-warning'
  return statusBadgeClass(o.status)
}

function canRunnerMarkDelivered(o: OrderRow) {
  return runnerNextAction(o.status) === 'markDelivered' && stageProgress(o) >= 1 && !isCompletedStatus(o.status)
}

async function onMarkDelivered(o: OrderRow) {
  const orderId = toOrderId(o)
  if (!orderId) return
  if (loading.value) return
  const rowId = String(o.id)
  if (busyAction.value[rowId]) return
  const ok = window.confirm('确认已送达？')
  if (!ok) return

  busyAction.value = { ...busyAction.value, [rowId]: 'markDelivered' }
  try {
    await completeOrder(orderId)
    ElMessage.success('已标记送达，等待用户确认')
    openDeliveryPhotoDialog(orderId)
    await loadOrders()
  } catch (err: any) {
    ElMessage.error(getErrorMessage(err))
  } finally {
    busyAction.value = { ...busyAction.value, [rowId]: undefined }
  }
}
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
                      <span :class="runnerDisplayBadgeClass(o)">{{ runnerDisplayLabel(o) }}</span>
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
                      <span :class="publishedDisplayBadgeClass(o)">{{ publishedDisplayLabel(o) }}</span>
                    </div>
                    <div class="text-muted small">金额：¥ {{ getAmount(o) }}</div>
                  </template>
                </div>

                <div class="d-flex flex-wrap gap-2">
                  <!-- 我发布的订单（用户侧） -->
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
    class="btn btn-success btn-sm"
    type="button"
    :disabled="loading || isBusy(o.id, 'confirm')"
    @click="onConfirm(o)"
  >
    确认完成
  </button>
  <button
    v-if="canApplyRefund(o)"
    class="btn btn-warning btn-sm"
    type="button"
    :disabled="loading"
    @click="applyRefund(o)"
  >
    申请退款
  </button>
  <button
    v-if="canReviewBase(o) && hasReviewed(o)"
    class="btn btn-secondary btn-sm"
    type="button"
    disabled
  >
    已评价
  </button>
  <button
    v-else-if="canReview(o)"
    class="btn btn-outline-warning btn-sm"
    type="button"
    :disabled="loading"
    @click="openReviewDialog(o)"
  >
    评价
  </button>
</template>

                  <!-- 我接单的订单（跑腿员侧） -->
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
                      v-if="canRunnerMarkDelivered(o)"
                      class="btn btn-primary btn-sm"
                      type="button"
                      :disabled="loading || isBusy(o.id, 'markDelivered')"
                      @click="onMarkDelivered(o)"
                    >
                      标记已送达
                    </button>
                    <button
                      v-if="canReviewBase(o) && hasReviewed(o)"
                      class="btn btn-secondary btn-sm"
                      type="button"
                      disabled
                    >
                      已评价
                    </button>
                    <button
                      v-else-if="canReview(o)"
                      class="btn btn-outline-warning btn-sm"
                      type="button"
                      :disabled="loading"
                      @click="openReviewDialog(o)"
                    >
                      评价
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

  <!-- 申请退款弹窗 -->
  <el-dialog v-model="refundDialogVisible" title="申请退款" width="500px">
    <el-form>
      <el-form-item label="订单号">
        <el-input :value="currentRefundOrder?.id" disabled />
      </el-form-item>
      <el-form-item label="订单金额">
        <el-input :value="'¥' + getAmount(currentRefundOrder)" disabled />
      </el-form-item>
      <el-form-item label="退款原因" required>
        <el-select v-model="refundReason" placeholder="请选择退款原因" style="width: 100%">
          <el-option label="物品损坏" value="物品损坏" />
          <el-option label="超时送达" value="超时送达" />
          <el-option label="跑腿员态度差" value="跑腿员态度差" />
          <el-option label="物品丢失" value="物品丢失" />
          <el-option label="其他" value="其他" />
        </el-select>
      </el-form-item>
      <el-form-item label="详细说明">
        <el-input
          v-model="refundDescription"
          type="textarea"
          rows="3"
          placeholder="请详细说明退款原因"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="refundDialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="refundSubmitting" @click="submitRefund">提交申请</el-button>
    </template>
  </el-dialog>

  <!-- 评价弹窗 -->
  <el-dialog
    v-model="reviewDialogVisible"
    title="订单评价"
    width="620px"
    :close-on-click-modal="!reviewSubmitting"
    @closed="handleReviewDialogClosed"
  >
    <el-form ref="reviewFormRef" :model="reviewForm" :rules="reviewRules" label-position="top">
      <el-form-item label="订单号">
        <el-input :model-value="currentReviewOrder ? toOrderId(currentReviewOrder) : ''" disabled />
      </el-form-item>
      <el-form-item label="评分" prop="rating" required>
        <el-rate v-model="reviewForm.rating" />
      </el-form-item>
      <el-form-item label="评价标签">
        <el-checkbox-group v-model="reviewForm.tags" class="review-tag-options">
          <el-checkbox-button v-for="tag in REVIEW_TAG_OPTIONS" :key="tag" :label="tag" :value="tag">
            {{ tag }}
          </el-checkbox-button>
        </el-checkbox-group>
      </el-form-item>
      <el-form-item label="文字评价">
        <el-input
          v-model="reviewForm.content"
          type="textarea"
          :rows="4"
          maxlength="200"
          show-word-limit
          placeholder="请输入评价内容，最多 200 字"
        />
      </el-form-item>
      <el-form-item label="上传图片">
        <el-upload
          v-model:file-list="reviewFileList"
          :action="uploadAction"
          name="image"
          accept="image/*"
          list-type="picture-card"
          :limit="3"
          multiple
          :headers="uploadHeaders"
          :disabled="reviewSubmitting"
          :on-success="onReviewUploadSuccess"
          :on-remove="onReviewUploadRemove"
          :on-error="onReviewUploadError"
          :on-exceed="onReviewUploadExceed"
        >
          <div>上传</div>
        </el-upload>
        <div class="form-text">最多上传 3 张图片，可选。</div>
      </el-form-item>
    </el-form>
    <template #footer>
      <div class="d-flex justify-content-end gap-2">
        <el-button :disabled="reviewSubmitting" @click="closeReviewDialog">取消</el-button>
        <el-button type="primary" :loading="reviewSubmitting" @click="submitReview">提交评价</el-button>
      </div>
    </template>
  </el-dialog>

  <!-- 跑腿员上传照片弹窗 -->
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
