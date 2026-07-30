<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { http } from '@/api/request'
import { useAuthStore } from '@/stores/auth'
import { useWebsocketStore } from '@/stores/websocket'

type ChatMessage = { id: string; fromUserId: string; text: string; createdAt: string }
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const socket = useWebsocketStore()
const orderId = computed(() => String(route.params.orderId || ''))
const toUserId = ref(String(route.query.toUserId || ''))
const messages = ref<ChatMessage[]>([])
const draft = ref('')
const page = ref(1)
const hasMore = ref(true)
const loading = ref(false)
const sending = ref(false)
const listEl = ref<HTMLElement>()
let unsubscribe: (() => void) | undefined

function normalize(raw: any): ChatMessage {
  const root = raw?.data ?? raw
  return {
    id: String(root?.id ?? `${root?.from_user_id}-${root?.created_at}-${root?.message}`),
    fromUserId: String(root?.from_user_id ?? root?.fromUserId ?? ''),
    text: String(root?.message ?? root?.content ?? ''),
    createdAt: String(root?.created_at ?? root?.createdAt ?? new Date().toISOString()),
  }
}

function merge(items: ChatMessage[], prepend = false) {
  const known = new Set(messages.value.map((item) => item.id))
  const fresh = items.filter((item) => item.text && !known.has(item.id))
  messages.value = prepend ? [...fresh, ...messages.value] : [...messages.value, ...fresh]
}

async function resolveTarget() {
  if (toUserId.value) return
  const response = await http.get(`/order/${encodeURIComponent(orderId.value)}`)
  const root = response.data?.data ?? response.data
  const publisherId = String(root?.task?.publisher_id ?? root?.publisher_id ?? '')
  const takerId = String(root?.taker_id ?? root?.runner_id ?? '')
  toUserId.value = String(auth.userId) === publisherId ? takerId : publisherId
}

async function loadHistory(nextPage = 1) {
  if (loading.value) return
  loading.value = true
  try {
    const response = await http.get('/chat/messages', { params: { orderId: orderId.value, page: nextPage, pageSize: 20 } })
    const root = response.data?.data ?? response.data
    const items = (root?.messages ?? []).map(normalize)
    if (nextPage === 1) messages.value = items
    else merge(items, true)
    page.value = nextPage
    hasMore.value = Boolean(root?.pagination?.hasMore ?? items.length >= 20)
    await nextTick()
    if (nextPage === 1 && listEl.value) listEl.value.scrollTop = listEl.value.scrollHeight
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.error || error?.message || '消息加载失败')
  } finally {
    loading.value = false
  }
}

async function send() {
  const message = draft.value.trim()
  if (!message || sending.value || !toUserId.value) return
  sending.value = true
  try {
    const response = await http.post('/chat/send', { orderId: orderId.value, toUserId: toUserId.value, message })
    merge([normalize(response.data?.chatMessage ?? response.data)])
    draft.value = ''
    await nextTick()
    if (listEl.value) listEl.value.scrollTop = listEl.value.scrollHeight
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.error || error?.message || '发送失败')
  } finally {
    sending.value = false
  }
}

function receive(raw: any) {
  const item = normalize(raw)
  if (String(raw?.order_id ?? raw?.orderId ?? raw?.data?.order_id ?? '') !== orderId.value) return
  merge([item])
  nextTick(() => { if (listEl.value) listEl.value.scrollTop = listEl.value.scrollHeight })
}

onMounted(async () => {
  socket.connect()
  socket.joinOrder(Number(orderId.value))
  unsubscribe = socket.onChatMessage(receive)
  await Promise.all([resolveTarget(), loadHistory(1)])
})

onUnmounted(() => {
  unsubscribe?.()
  socket.leaveOrder(Number(orderId.value))
})
</script>

<template>
  <div class="chat-page card border-0 shadow-sm">
    <div class="card-header bg-white d-flex align-items-center justify-content-between">
      <button class="btn btn-link px-0" type="button" @click="router.back()">返回订单</button>
      <strong>订单 #{{ orderId }} 会话</strong>
      <span class="small" :class="socket.status === 'open' ? 'text-success' : 'text-muted'">{{ socket.status === 'open' ? '实时连接' : '连接中' }}</span>
    </div>
    <div ref="listEl" class="chat-history">
      <button v-if="hasMore" class="btn btn-link btn-sm d-block mx-auto" type="button" :disabled="loading" @click="loadHistory(page + 1)">{{ loading ? '加载中...' : '加载更早消息' }}</button>
      <div v-if="!loading && messages.length === 0" class="text-muted text-center py-5">暂无消息，开始沟通吧</div>
      <div v-for="item in messages" :key="item.id" class="d-flex mb-3" :class="item.fromUserId === String(auth.userId) ? 'justify-content-end' : 'justify-content-start'">
        <div class="chat-bubble" :class="item.fromUserId === String(auth.userId) ? 'mine' : 'other'">
          <div>{{ item.text }}</div>
          <small>{{ new Date(item.createdAt).toLocaleString('zh-CN') }}</small>
        </div>
      </div>
    </div>
    <form class="chat-composer" @submit.prevent="send">
      <input v-model="draft" class="form-control" maxlength="500" placeholder="输入消息..." />
      <button class="btn btn-primary" type="submit" :disabled="sending || !draft.trim() || !toUserId">{{ sending ? '发送中' : '发送' }}</button>
    </form>
  </div>
</template>

<style scoped>
.chat-page { height: calc(100vh - 120px); min-height: 560px; overflow: hidden; }
.chat-history { flex: 1; overflow-y: auto; padding: 20px; background: #f7f8fa; }
.chat-page { display: flex; flex-direction: column; }
.chat-composer { display: flex; gap: 12px; padding: 16px; border-top: 1px solid #e9ecef; }
.chat-bubble { max-width: min(72%, 560px); padding: 10px 14px; border-radius: 14px; word-break: break-word; }
.chat-bubble.mine { color: #fff; background: #0d6efd; border-bottom-right-radius: 4px; }
.chat-bubble.other { background: #fff; border: 1px solid #e5e7eb; border-bottom-left-radius: 4px; }
.chat-bubble small { display: block; margin-top: 5px; opacity: .72; font-size: 11px; }
</style>
