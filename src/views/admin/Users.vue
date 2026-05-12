<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { listUsers, type AdminUser } from '@/api/admin'

const loading = ref(true)
const rows = ref<AdminUser[]>([])

onMounted(async () => {
  loading.value = true
  rows.value = await listUsers()
  loading.value = false
})
</script>

<template>
  <div class="vstack gap-3">
    <div>
      <h1 class="h4 mb-1">用户管理</h1>
      <div class="text-muted">管理员：审核与治理（骨架）</div>
    </div>

    <div class="card border-0 shadow-sm">
      <div class="card-body">
        <div class="d-flex align-items-center justify-content-between">
          <div class="fw-semibold">用户列表</div>
          <span class="badge text-bg-light border">骨架</span>
        </div>

        <div v-if="loading" class="placeholder-glow mt-3">
          <div class="placeholder col-12 mb-2" />
          <div class="placeholder col-10 mb-2" />
          <div class="placeholder col-11" />
        </div>

        <div v-else class="table-responsive mt-3">
          <table class="table table-hover align-middle">
            <thead>
              <tr>
                <th>用户</th>
                <th class="text-nowrap">角色</th>
                <th class="text-nowrap">跑腿员状态</th>
                <th class="text-nowrap">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="u in rows" :key="u.id">
                <td class="fw-semibold">{{ u.name }}</td>
                <td class="text-nowrap"><span class="badge text-bg-light border">{{ u.role }}</span></td>
                <td class="text-nowrap"><span class="badge text-bg-light border">{{ u.runnerStatus }}</span></td>
                <td class="text-nowrap">
                  <button class="btn btn-sm btn-outline-primary" type="button">查看</button>
                  <button class="btn btn-sm btn-primary ms-2" type="button">处理</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

