<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'

import { http } from '@/api/request'
import { useAuthStore } from '@/stores/auth'
import { useMessageStore } from '@/stores/messages'

type ChatSide = 'me' | 'other'

type ChatMessageVM = {
  id: string
  side: ChatSide
  fromName: string
  text: string
  ts: number
}

const props = defineProps<{
  modelValue: boolean
  orderId: string
  toUserId: string
  title?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
})

const messages = ref<ChatMessageVM[]>([])
const draft = ref('')
const listEl = ref<HTMLElement | null>(null)
const auth = useAuthStore()
const messageStore = useMessageStore()

const isFrozen = computed(() => Boolean(auth.isFrozen))

const myUserId = computed(() => String(auth.userId || '').trim())
const myDisplayName = computed(() => String(auth.displayName || '').trim())

const resolvedTitle = computed(() => {
  if (props.title) return props.title
  return '联系跑腿员'
})

const loadingHistory = ref(false)
const sending = ref(false)
const polling = ref(false)
const pollError = ref('')

const resolvedToUserId = computed(() => String(props.toUserId ?? '').trim())

let pollTimer: number | null = null

function getErrorMessage(err: any) {
  return (
    err?.response?.data?.message ||
    err?.response?.data?.msg ||
    err?.response?.data?.error ||
    err?.message ||
    '操作失败'
  )
}

function parseTimeMs(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v > 0 ? v : 0
  try {
    const s = String(v ?? '').trim()
    if (!s) return 0
    const ts = Date.parse(s)
    return Number.isFinite(ts) ? ts : 0
  } catch {
    return 0
  }
}

function scrollToBottom() {
  if (!listEl.value) return
  listEl.value.scrollTop = listEl.value.scrollHeight
}

function close() {
  visible.value = false
}

function normalizeMessagesPayload(payload: any): unknown[] {
  const root = payload?.data ?? payload
  const list = root?.messages ?? root?.list ?? root?.rows ?? root?.items ?? root?.records ?? root
  return Array.isArray(list) ? list : []
}

function isMineFromUserId(fromUserId: string): boolean {
  const from = String(fromUserId || '').trim()
  if (!from) return false
  const myId = myUserId.value
  if (myId) return from === myId
  const to = resolvedToUserId.value
  if (to) return from !== to
  return false
}

function hashString32(input: string) {
  let h = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(16)
}

function pickFromName(root: any) {
  const v =
    root?.from_user?.nickname ??
    root?.from_user?.displayName ??
    root?.from_user?.name ??
    root?.fromUser?.nickname ??
    root?.fromUser?.displayName ??
    root?.fromUser?.name ??
    root?.senderNickname ??
    root?.senderName ??
    root?.fromNickname ??
    root?.fromName ??
    root?.nickname ??
    root?.name
  return String(v ?? '').trim()
}

function mapMessage(raw: any, index: number): ChatMessageVM | null {
  const root = raw?.data ?? raw
  const id = String(root?.id ?? root?._id ?? root?.message_id ?? root?.messageId ?? '').trim()
  const fromUserId = String(root?.from_user_id ?? root?.fromUserId ?? root?.from_user?.id ?? root?.fromUser?.id ?? '').trim()
  const text = String(root?.message ?? root?.text ?? root?.content ?? '').trim()
  const ts =
    (typeof root?.ts === 'number' ? root.ts : 0) ||
    parseTimeMs(root?.created_at ?? root?.createdAt ?? root?.time ?? root?.createdTime) ||
    0

  if (!text) return null
  const finalTs = ts || Date.now()
  const side: ChatSide = isMineFromUserId(fromUserId) ? 'me' : 'other'
  const fromName = (side === 'me' ? myDisplayName.value : pickFromName(root)) || (side === 'me' ? '我' : '对方')
  const stableKey = `${fromUserId || ''}|${finalTs}|${text}`
  const finalId = id || `m_${hashString32(stableKey)}_${index}`
  return { id: finalId, side, fromName, text, ts: finalTs }
}

function normalizeMessages(payload: any): ChatMessageVM[] {
  const list = normalizeMessagesPayload(payload)
  const mapped = list
    .map((m, idx) => mapMessage(m, idx))
    .filter((m): m is ChatMessageVM => Boolean(m))
    .sort((a, b) => a.ts - b.ts)
  return mapped
}

function isSameMessageList(a: ChatMessageVM[], b: ChatMessageVM[]) {
  if (a === b) return true
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) {
    const x = a[i]
    const y = b[i]
    if (!x || !y) return false
    if (x.id !== y.id) return false
    if (x.ts !== y.ts) return false
    if (x.text !== y.text) return false
    if (x.side !== y.side) return false
    if (x.fromName !== y.fromName) return false
  }
  return true
}

function mergeMessages(nextList: ChatMessageVM[]) {
  if (messages.value.length === 0) {
    if (nextList.length === 0) return false
    messages.value = nextList
    return true
  }
  const existing = new Set(messages.value.map((m) => m.id))
  const additions = nextList.filter((m) => !existing.has(m.id))
  if (additions.length === 0) return false
  messages.value = [...messages.value, ...additions].sort((a, b) => a.ts - b.ts)
  return true
}

async function loadHistory(mode: 'replace' | 'merge' = 'replace') {
  const orderId = String(props.orderId ?? '').trim()
  if (!orderId) {
    messages.value = []
    return
  }
  if (loadingHistory.value) return

  loadingHistory.value = true
  try {
    const response = await http.get('/chat/messages', { params: { orderId } })
    const nextList = normalizeMessages(response.data)
    let changed = false
    if (mode === 'replace') {
      if (!isSameMessageList(messages.value, nextList)) {
        messages.value = nextList
        changed = true
      }
    } else {
      changed = mergeMessages(nextList)
    }
    if (pollError.value) pollError.value = ''
    if (changed) {
      await nextTick()
      scrollToBottom()
    }
  } catch (err) {
    pollError.value = getErrorMessage(err)
  } finally {
    loadingHistory.value = false
  }
}

function stopPolling() {
  if (pollTimer) {
    window.clearInterval(pollTimer)
    pollTimer = null
  }
}

function startPolling() {
  stopPolling()
  pollTimer = window.setInterval(async () => {
    if (!visible.value) return
    if (polling.value) return
    polling.value = true
    try {
      await loadHistory('merge')
    } finally {
      polling.value = false
    }
  }, 10000)
}

async function openDialog() {
  pollError.value = ''
  await loadHistory('replace')
  startPolling()
}

function closeDialog() {
  stopPolling()
}

async function send() {
  if (isFrozen.value) {
    ElMessage.warning('账号已冻结，无法发送消息')
    return
  }
  const orderId = String(props.orderId ?? '').trim()
  const toUserId = resolvedToUserId.value
  const message = draft.value.trim()
  if (!orderId || !toUserId || !message) return
  if (sending.value) return

  sending.value = true
  try {
    await http.post('/chat/send', { orderId, toUserId, message })
    draft.value = ''
    await loadHistory('replace')
    pollError.value = ''
    messageStore.fetchMessages().catch(() => {})
  } catch (err) {
    ElMessage.error(getErrorMessage(err))
  } finally {
    sending.value = false
  }
}

function formatTime(ts: number) {
  if (!Number.isFinite(ts) || ts <= 0) return ''
  try {
    return new Date(ts).toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

watch(
  () => visible.value,
  async (v) => {
    if (v) await openDialog()
    else closeDialog()
  },
)

watch(
  () => props.orderId,
  async () => {
    if (!visible.value) return
    await openDialog()
  },
)

onUnmounted(() => {
  stopPolling()
})
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="resolvedTitle"
    width="720px"
    :close-on-click-modal="false"
    @close="closeDialog"
  >
    <div class="vstack gap-2">
      <el-alert v-if="pollError" type="error" :closable="false" show-icon :title="pollError" />
      <el-alert
        v-if="isFrozen"
        type="warning"
        :closable="false"
        show-icon
        title="账号已冻结，聊天发送功能已被限制。"
      />

      <div ref="listEl" class="ce-chat-list">
        <div v-if="loadingHistory" class="text-muted small">正在加载消息…</div>
        <div v-else-if="messages.length === 0" class="text-muted small">暂无消息，发一条试试</div>
        <div v-for="m in messages" :key="m.id" class="d-flex" :class="m.side === 'me' ? 'justify-content-end' : 'justify-content-start'">
          <div class="ce-chat-bubble" :class="m.side === 'me' ? 'ce-chat-bubble-me' : 'ce-chat-bubble-other'">
            <div class="ce-chat-meta">
              <div class="ce-chat-from">{{ m.fromName }}</div>
              <div class="ce-chat-time">{{ formatTime(m.ts) }}</div>
            </div>
            <div class="small">{{ m.text }}</div>
          </div>
        </div>
      </div>

      <div class="d-flex gap-2">
        <el-input
          v-model="draft"
          placeholder="输入消息…"
          :disabled="sending || !orderId || !resolvedToUserId || isFrozen"
          @keyup.enter="send"
        />
        <el-button
          type="primary"
          :loading="sending"
          :disabled="sending || !draft.trim() || !orderId || !resolvedToUserId || isFrozen"
          @click="send"
        >
          发送
        </el-button>
      </div>

      <div v-if="orderId && !resolvedToUserId" class="text-muted small">未识别到接收方，暂不可发送消息。</div>
    </div>

    <template #footer>
      <div class="d-flex justify-content-end gap-2">
        <el-button @click="close">关闭</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>
.ce-chat-list {
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 12px;
  padding: 12px;
  background: rgba(0, 0, 0, 0.02);
  max-height: 320px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ce-chat-bubble {
  max-width: 80%;
  border-radius: 12px;
  padding: 8px 10px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  background: #ffffff;
}

.ce-chat-bubble-me {
  background: rgba(13, 110, 253, 0.12);
  border-color: rgba(13, 110, 253, 0.2);
}

.ce-chat-bubble-other {
  background: rgba(25, 135, 84, 0.12);
  border-color: rgba(25, 135, 84, 0.2);
}

.ce-chat-meta {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 2px;
}

.ce-chat-from {
  font-size: 12px;
  opacity: 0.8;
}

.ce-chat-time {
  font-size: 12px;
  opacity: 0.7;
  text-align: right;
}
</style>
