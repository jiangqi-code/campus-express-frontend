<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useMessageStore } from '@/stores/messages'

const store = useMessageStore()
const router = useRouter()

const errorMessage = ref('')
const total = ref(0)

const pagination = reactive({
  page: 1,
  pageSize: 10,
})

const pageSizeOptions = [10, 20, 50]

const loading = computed(() => store.loading)

const messages = computed(() => store.messages)
const unreadCount = computed(() => store.unreadCount)

// 格式化时间（兼容后端返回的 ISO 字符串）
function formatTime(createdAt: string) {
  if (!createdAt) return '-'
  try {
    const date = new Date(createdAt)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    
    if (diff < 24 * 60 * 60 * 1000) {
      // 今天：显示时间
      return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
    } else if (diff < 7 * 24 * 60 * 60 * 1000) {
      // 一周内：显示星期
      const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
      return weekdays[date.getDay()]
    } else {
      // 更早：显示日期
      return `${date.getMonth() + 1}/${date.getDate()}`
    }
  } catch {
    return '-'
  }
}

// 获取显示标题（发送者名称 + 消息类型）
function getDisplayTitle(message: any) {
  // 如果是聊天消息，显示发送者名称
  if (message.type === 'chat') {
    const senderName = message.sender_name || '用户'
    return `${senderName} 发来消息`
  }
  // 系统消息直接返回 title
  return message.title || '通知'
}

// 获取显示内容
function getDisplayContent(message: any) {
  return message.content || ''
}

// 获取发送者头像（用于显示头像）
function getSenderAvatar(message: any) {
  return message.sender_avatar || null
}

// 标记单条已读
async function markOneRead(message: any) {
  if (!message || message.is_read) return
  try {
    await store.markRead(message.id)
  } catch {
    ElMessage.error('标记已读失败')
  }
}

// 点击消息跳转
async function openMessage(message: any) {
  if (!message) return
  
  // 先标记为已读
  if (!message.is_read) {
    await markOneRead(message)
  }
  
  // 根据类型跳转
  const orderId = message.order_id ?? message.orderId ?? message.related_id ?? message.conversation_id
  if ((message.type === 'chat' || message.type === 'order' || orderId) && orderId) {
    // 跳转到订单详情
    router.push({ name: 'order-track', params: { orderId } })
  } else if (message.type === 'task' && message.related_id) {
    // 跳转到任务详情
    router.push({ name: 'task-detail', params: { id: message.related_id } })
  }
}

// 分页相关
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

// 获取消息列表
async function fetchMessages() {
  errorMessage.value = ''
  try {
    const res = await store.fetchMessages(pagination.page, pagination.pageSize)
    total.value = Number(res?.total ?? 0) || 0

    const tp = Math.max(1, Math.ceil(total.value / pagination.pageSize))
    if (pagination.page > tp) {
      pagination.page = tp
      const res2 = await store.fetchMessages(pagination.page, pagination.pageSize)
      total.value = Number(res2?.total ?? 0) || 0
    }
  } catch (e: any) {
    errorMessage.value = String(e?.message ?? '获取消息失败')
    total.value = 0
  }
}

function onChangePageSize(next: number) {
  pagination.pageSize = next
  pagination.page = 1
  fetchMessages()
}

function goPage(p: number) {
  if (p < 1 || p > totalPages.value || p === pagination.page) return
  pagination.page = p
  fetchMessages()
}

// 全部已读
async function markAll() {
  if (unreadCount.value === 0) {
    ElMessage.info('暂无未读消息')
    return
  }
  try {
    await store.markAllRead()
    ElMessage.success('已全部标记为已读')
    // 刷新列表
    await fetchMessages()
  } catch {
    ElMessage.error('全部已读失败')
  }
}

onMounted(() => {
  fetchMessages()
})
</script>

<template>
  <div class="vstack gap-3">
    <div class="d-flex flex-wrap align-items-end justify-content-between gap-2">
      <div>
        <h1 class="h4 mb-1">消息中心</h1>
        <div class="text-muted">未读 {{ unreadCount }} 条 · 共 {{ total }} 条</div>
      </div>
      <div class="d-flex gap-2">
        <button class="btn btn-outline-primary" type="button" :disabled="loading" @click="fetchMessages">刷新</button>
        <button class="btn btn-primary" type="button" :disabled="loading || unreadCount === 0" @click="markAll">全部已读</button>
      </div>
    </div>

    <div class="card border-0 shadow-sm">
      <div class="card-body">
        <div v-if="errorMessage" class="alert alert-danger mb-3" role="alert">{{ errorMessage }}</div>
        <div v-else-if="loading && messages.length === 0" class="text-muted">加载中...</div>
        <div v-else-if="messages.length === 0" class="text-muted">暂无消息</div>

        <div v-else class="list-group list-group-flush">
          <button
            v-for="m in messages"
            :key="m.id"
            type="button"
            class="list-group-item list-group-item-action d-flex align-items-start"
            :class="{ 'bg-light': !m.is_read }"
            @click="openMessage(m)"
          >
            <!-- 头像 -->
            <div class="flex-shrink-0 me-3">
              <img 
                v-if="getSenderAvatar(m)" 
                :src="getSenderAvatar(m)" 
                class="rounded-circle" 
                style="width: 40px; height: 40px; object-fit: cover"
                alt="头像"
              />
              <div v-else class="bg-secondary rounded-circle d-flex align-items-center justify-content-center text-white" style="width: 40px; height: 40px;">
                {{ (getDisplayTitle(m).charAt(0) || '消').slice(0, 1) }}
              </div>
            </div>
            
            <div class="flex-grow-1">
              <div class="d-flex justify-content-between align-items-center">
                <div class="fw-semibold">{{ getDisplayTitle(m) }}</div>
                <div class="text-muted small">{{ formatTime(m.created_at) }}</div>
              </div>
              <div class="text-muted small mt-1 text-truncate" style="max-width: 300px;">
                {{ getDisplayContent(m) }}
              </div>
            </div>
            
            <div class="ms-3 d-flex align-items-center gap-2">
              <span v-if="!m.is_read" class="badge bg-danger rounded-pill">新</span>
              <button 
                v-if="!m.is_read" 
                class="btn btn-sm btn-outline-secondary" 
                type="button" 
                @click.stop="markOneRead(m)"
              >
                标为已读
              </button>
            </div>
          </button>
        </div>

        <!-- 分页 -->
        <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mt-3">
          <div class="d-flex align-items-center gap-2">
            <div class="text-muted small">第 {{ pagination.page }} / {{ totalPages }} 页</div>
            <select
              class="form-select form-select-sm"
              style="width: 96px"
              :value="pagination.pageSize"
              :disabled="loading"
              @change="onChangePageSize(Number(($event.target as HTMLSelectElement).value))"
            >
              <option v-for="s in pageSizeOptions" :key="s" :value="s">{{ s }}/页</option>
            </select>
          </div>
          <nav aria-label="Pagination">
            <ul class="pagination pagination-sm mb-0">
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

<style scoped>
.bg-light { background: #fff8f0 !important }
.text-truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
