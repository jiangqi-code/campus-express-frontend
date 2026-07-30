import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { http } from '@/api/request'

export type MessageTarget = 'order' | 'task' | 'chat' | 'other'

export type MessageItem = {
  id: number
  title: string
  content: string
  type: string
  is_read: boolean
  created_at: string
  sender_name: string | null
  sender_avatar: string | null
  conversation_id: string | null
  related_id: number | null
}

export type FetchMessagesResponse = {
  items: MessageItem[]
  total: number
  unreadCount: number
}

export const useMessageStore = defineStore('messages', () => {
  const messages = ref<MessageItem[]>([])
  const loading = ref(false)
  const _unreadCount = ref(0)
  const _total = ref(0)

  const unreadCount = computed(() => _unreadCount.value)
  const total = computed(() => _total.value)

  async function fetchMessages(page: number = 1, pageSize: number = 10): Promise<FetchMessagesResponse> {
    loading.value = true
    try {
      // ✅ 把 /api/messages/ 改成 /messages/
      const response = await http.get<FetchMessagesResponse>('/messages/', {
        params: { page, pageSize }
      })
      messages.value = response.data.items
      _unreadCount.value = response.data.unreadCount
      _total.value = response.data.total
      return response.data
    } catch (error) {
      console.error('获取消息列表失败:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  async function refreshUnread(): Promise<number> {
    if (!localStorage.getItem('ce_token')) return 0
    const response = await http.get<FetchMessagesResponse>('/messages/', { params: { page: 1, pageSize: 1 } })
    _unreadCount.value = Number(response.data.unreadCount ?? 0)
    _total.value = Number(response.data.total ?? _total.value)
    return _unreadCount.value
  }

  function receiveMessage(payload: Partial<MessageItem>) {
    const item: MessageItem = {
      id: Number(payload.id ?? Date.now()),
      title: String(payload.title ?? '新消息'),
      content: String(payload.content ?? ''),
      type: String(payload.type ?? 'other'),
      is_read: false,
      created_at: String(payload.created_at ?? new Date().toISOString()),
      sender_name: payload.sender_name ?? null,
      sender_avatar: payload.sender_avatar ?? null,
      conversation_id: payload.conversation_id ?? null,
      related_id: payload.related_id == null ? null : Number(payload.related_id),
    }
    const index = messages.value.findIndex((message) => message.id === item.id)
    if (index >= 0) messages.value[index] = { ...messages.value[index], ...item }
    else messages.value.unshift(item)
    _unreadCount.value += index >= 0 && !messages.value[index]?.is_read ? 0 : 1
    _total.value += index >= 0 ? 0 : 1
  }

  async function markRead(id: number): Promise<void> {
    // ✅ 把 /api/messages/${id}/read 改成 /messages/${id}/read
    await http.put(`/messages/${id}/read`)
    const item = messages.value.find((m) => m.id === id)
    if (item) {
      item.is_read = true
      _unreadCount.value = Math.max(0, _unreadCount.value - 1)
    }
  }

  async function readAll(): Promise<void> {
    // ✅ 把 /api/messages/read-all 改成 /messages/read-all
    await http.put('/messages/read-all')
    messages.value.forEach((m) => (m.is_read = true))
    _unreadCount.value = 0
  }

  function markAllRead() {
    return readAll()
  }

  function fetchRecent(count = 5) {
    return messages.value.slice(0, count)
  }

  function formatTime(createdAt: string): string {
    const date = new Date(createdAt)
    const now = new Date()
    const diff = now.getTime() - date.getTime()

    if (diff < 24 * 60 * 60 * 1000) {
      return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
    } else if (diff < 7 * 24 * 60 * 60 * 1000) {
      const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
      return weekdays[date.getDay()]
    } else {
      return `${date.getMonth() + 1}/${date.getDate()}`
    }
  }

  return {
    messages,
    unreadCount,
    total,
    loading,
    fetchMessages,
    refreshUnread,
    receiveMessage,
    markRead,
    readAll,
    markAllRead,
    fetchRecent,
    formatTime
  }
})
