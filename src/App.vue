<script setup lang="ts">
import { onBeforeUnmount, onMounted, watch } from 'vue'
import { RouterView } from 'vue-router'
import { useMessageStore } from '@/stores/messages'
import { useWebsocketStore } from '@/stores/websocket'
import { useAuthStore } from '@/stores/auth'

const socket = useWebsocketStore()
const messages = useMessageStore()
const auth = useAuthStore()
const stopTokenWatch = watch(() => auth.token, (token) => {
  if (token) resumeRealtime()
  else socket.disconnect()
})

function resumeRealtime() {
  socket.reconnectNow()
  messages.refreshUnread().catch(() => undefined)
}

function handleVisibilityChange() {
  socket.setBackground(document.hidden)
  if (!document.hidden) resumeRealtime()
}

onMounted(() => {
  socket.connect()
  messages.refreshUnread().catch(() => undefined)
  window.addEventListener('online', resumeRealtime)
  window.addEventListener('offline', socket.handleOffline)
  document.addEventListener('visibilitychange', handleVisibilityChange)
})

onBeforeUnmount(() => {
  window.removeEventListener('online', resumeRealtime)
  window.removeEventListener('offline', socket.handleOffline)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  socket.disconnect()
  stopTokenWatch()
})
</script>

<template>
  <RouterView />
</template>
