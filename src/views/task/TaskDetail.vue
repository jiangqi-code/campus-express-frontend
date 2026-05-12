<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { baseURL } from '@/api/request'
import { cancelTask, getTaskDetail, type TaskDetail } from '@/api/task'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const loading = ref(false)
const busyCancel = ref(false)
const errorMessage = ref('')
const task = ref<TaskDetail | null>(null)

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

const orderId = computed(() => normalizeText((task.value as any)?.order_id ?? (task.value as any)?.orderId))

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
  </div>
</template>

<style scoped>
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
</style>
