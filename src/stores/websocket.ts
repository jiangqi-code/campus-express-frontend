import { io, type Socket } from 'socket.io-client'
import { ElNotification } from 'element-plus'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import router from '@/router'

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

  function connect() {
    const token = readToken()
    if (!token) {
      console.log('[Socket.IO] 无 token，跳过连接')
      return
    }

    if (socketRef.value?.connected) {
      console.log('[Socket.IO] 已连接，跳过')
      return
    }

    manualClose = false
    lastError.value = ''
    status.value = 'connecting'

    const socketUrl = 'http://localhost:3000'
    const socketPath = '/socket.io'

    const socket = io(socketUrl, {
      path: socketPath,
      transports: ['websocket', 'polling'],
      auth: { token },
      withCredentials: true,
    })

    socketRef.value = socket

    socket.on('connect', () => {
      console.log('[Socket.IO] 连接成功', socket.id)
      status.value = 'open'
      lastError.value = ''
    })

    socket.on('disconnect', (reason) => {
      console.log('[Socket.IO] 断开连接:', reason)
      status.value = 'closed'
      if (!manualClose) {
        setTimeout(() => {
          if (!manualClose && !socketRef.value?.connected) {
            connect()
          }
        }, 3000)
      }
    })

    socket.on('connect_error', (err) => {
      console.error('[Socket.IO] 连接失败:', err.message)
      lastError.value = err.message
      status.value = 'closed'
    })

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
  }

  function disconnect() {
    manualClose = true
    const socket = socketRef.value
    if (socket) {
      socket.disconnect()
      socketRef.value = null
    }
    status.value = 'closed'
  }

  // 加入订单房间（用于接收订单相关推送）
  function joinOrder(orderId: number) {
    console.log('[Socket.IO] 尝试加入订单房间:', orderId)
    const socket = socketRef.value
    if (!socket?.connected) {
      console.log('[Socket.IO] Socket 未连接，无法加入房间')
      return
    }
    socket.emit('order:join', { orderId }, (res: any) => {
      console.log('[Socket.IO] 加入订单房间响应:', res)
    })
  }

  // 离开订单房间
  function leaveOrder(orderId: number) {
    console.log('[Socket.IO] 离开订单房间:', orderId)
    const socket = socketRef.value
    if (!socket?.connected) return
    socket.emit('order:leave', { orderId })
  }

  return { status, lastError, connect, disconnect, joinOrder, leaveOrder }
})
