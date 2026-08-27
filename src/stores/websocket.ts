import { io, type Socket } from 'socket.io-client'
import { ElNotification } from 'element-plus'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import router from '@/router'
import { useMessageStore, type MessageItem } from '@/stores/messages'

function readToken() {
  return String(localStorage.getItem('ce_token') || '').trim()
}

function isRunnerRole() {
  return String(localStorage.getItem('ce_role') || '')
    .trim()
    .toLowerCase() === 'runner'
}

export const useWebsocketStore = defineStore('websocket', () => {
  const status = ref<'idle' | 'connecting' | 'open' | 'closed'>('idle')
  const lastError = ref('')
  const socketRef = ref<Socket | null>(null)

  let manualClose = false
  let background = false
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  const joinedOrders = new Set<number>()

  function clearReconnectTimer() {
    if (reconnectTimer) clearTimeout(reconnectTimer)
    reconnectTimer = null
  }

  function scheduleReconnect(delay = 3000) {
    clearReconnectTimer()
    if (manualClose || !navigator.onLine) return
    reconnectTimer = setTimeout(() => connect(), background ? Math.max(delay, 10000) : delay)
  }

  function connect() {
    const token = readToken()
    if (!token) {
      console.log('[Socket.IO] 无 token，跳过连接')
      return
    }

    if (socketRef.value?.connected || status.value === 'connecting') {
      console.log('[Socket.IO] 已连接，跳过')
      return
    }

    manualClose = false
    clearReconnectTimer()
    lastError.value = ''
    status.value = 'connecting'

    const socketUrl = 'http://localhost:3000'
    const socketPath = '/socket.io'

    const socket = io(socketUrl, {
      path: socketPath,
      transports: ['websocket', 'polling'],
      auth: { token },
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 15000,
      randomizationFactor: 0.4,
    })

    socketRef.value = socket

    socket.on('connect', () => {
      console.log('[Socket.IO] 连接成功', socket.id)
      status.value = 'open'
      lastError.value = ''
      joinedOrders.forEach((orderId) => socket.emit('order:join', { orderId }))
      useMessageStore().refreshUnread().catch(() => undefined)
    })

    socket.on('disconnect', (reason) => {
      console.log('[Socket.IO] 断开连接:', reason)
      status.value = 'closed'
      if (!manualClose) scheduleReconnect()
    })

    socket.on('connect_error', (err) => {
      console.error('[Socket.IO] 连接失败:', err.message)
      lastError.value = err.message
      status.value = 'closed'
      scheduleReconnect(5000)
    })

    const receiveMessage = (data: any) => {
      const raw = data?.message ?? data?.data ?? data ?? {}
      useMessageStore().receiveMessage(raw as Partial<MessageItem>)
      if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
        new Notification(String(raw.title ?? '校园跑腿新消息'), { body: String(raw.content ?? '') })
      }
    }
    socket.on('message:new', receiveMessage)
    socket.on('notify', receiveMessage)

    // 监听后端推送的催单消息（注意：后端用的是 order:urge 事件）
    socket.on('order:urge', (data: any) => {
      console.log('[Socket.IO] 收到催单消息:', data)

      if (!isRunnerRole()) return

      const orderId = data.orderId
      const message = data.message || `用户催单，请尽快处理订单 #${orderId}`

      ElNotification({
        title: '催单提醒',
        message: message,
        type: 'warning',
        duration: 10000,
        onClick: () => {
          if (orderId) {
            router.push(`/order-track/${orderId}`)
          }
        },
      })
    })

    // 监听订单状态变更
    socket.on('order:status', (data: any) => {
      console.log('[Socket.IO] 订单状态变更:', data)
    })

    socket.on('food:order:status', (data: any) => {
      const statusLabel: Record<string, string> = {
        PAID: '待配送', ACCEPTED: '已接单', PICKED: '已取餐', DELIVERING: '配送中', COMPLETED: '已完成', CANCELLED: '已取消',
      }
      const label = statusLabel[String(data?.toStatus ?? '')] ?? '状态已更新'
      ElNotification({
        title: '外卖订单更新',
        message: `${String(data?.merchantName ?? '外卖订单')} #${String(data?.orderId ?? '')} ${label}`,
        type: String(data?.toStatus) === 'CANCELLED' ? 'warning' : 'success',
        duration: 5000,
      })
    })
  }

  function disconnect() {
    manualClose = true
    clearReconnectTimer()
    const socket = socketRef.value
    if (socket) {
      socket.disconnect()
      socketRef.value = null
    }
    status.value = 'closed'
  }

  // 加入订单房间（用于接收订单相关推送）
  function joinOrder(orderId: number) {
    joinedOrders.add(orderId)
    console.log('[Socket.IO] 尝试加入订单房间:', orderId)
    const socket = socketRef.value
    if (!socket?.connected) {
      console.log('[Socket.IO] Socket 未连接，无法加入房间')
      socket?.once('connect', () => joinOrder(orderId))
      return
    }
    socket.emit('order:join', { orderId }, (res: any) => {
      console.log('[Socket.IO] 加入订单房间响应:', res)
    })
  }

  // 离开订单房间
  function leaveOrder(orderId: number) {
    joinedOrders.delete(orderId)
    console.log('[Socket.IO] 离开订单房间:', orderId)
    const socket = socketRef.value
    if (!socket?.connected) return
    socket.emit('order:leave', { orderId })
  }

  function onChatMessage(listener: (data: any) => void) {
    const socket = socketRef.value
    socket?.on('chat:message', listener)
    return () => socket?.off('chat:message', listener)
  }

  function reconnectNow() {
    if (!readToken() || !navigator.onLine) return
    manualClose = false
    clearReconnectTimer()
    if (socketRef.value) {
      socketRef.value.auth = { token: readToken() }
      if (!socketRef.value.connected) socketRef.value.connect()
      return
    }
    connect()
  }

  function handleOffline() {
    status.value = 'closed'
    clearReconnectTimer()
  }

  function setBackground(value: boolean) {
    background = value
  }

  return { status, lastError, connect, disconnect, reconnectNow, handleOffline, setBackground, joinOrder, leaveOrder, onChatMessage }
})
