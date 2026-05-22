<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useMessageStore } from '@/stores/messages'

const store = useMessageStore()
const router = useRouter()

onMounted(() => {
  store.fetchMessages()
})

function goToMessageCenter() {
  router.push('/messages')
}
</script>

<template>
  <button class="btn btn-light position-relative me-2" type="button" @click="goToMessageCenter">
    🔔
    <span v-if="store.unreadCount > 0" class="position-absolute translate-middle badge rounded-pill bg-danger" style="top:6px;right:6px">{{ store.unreadCount }}</span>
  </button>
</template>

<style scoped>
.badge { font-size: 0.65rem }
</style>
