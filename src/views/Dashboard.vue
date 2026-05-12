<script setup lang="ts">
import { computed } from 'vue'

import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()

const greeting = computed(() => {
  if (auth.role === 'admin') return '欢迎回来，管理员'
  if (auth.role === 'runner') return '欢迎回来，跑腿员'
  return '欢迎回来'
})
</script>

<template>
  <div class="vstack gap-4">
    <div class="d-flex flex-wrap align-items-end justify-content-between gap-2">
      <div>
        <h1 class="h4 mb-1">仪表盘</h1>
        <div class="text-muted">{{ greeting }}，{{ auth.displayName }}</div>
      </div>
      <div class="d-flex gap-2">
        <RouterLink class="btn btn-primary" to="/tasks">去任务大厅</RouterLink>
        <RouterLink class="btn btn-outline-primary" to="/orders">查看订单</RouterLink>
      </div>
    </div>

    <div class="row g-3">
      <div class="col-12 col-md-6 col-lg-3">
        <div class="card border-0 shadow-sm">
          <div class="card-body">
            <div class="text-muted small">我的发布</div>
            <div class="fs-4 fw-semibold">--</div>
          </div>
        </div>
      </div>
      <div class="col-12 col-md-6 col-lg-3">
        <div class="card border-0 shadow-sm">
          <div class="card-body">
            <div class="text-muted small">我的接单</div>
            <div class="fs-4 fw-semibold">--</div>
          </div>
        </div>
      </div>
      <div class="col-12 col-md-6 col-lg-3">
        <div class="card border-0 shadow-sm">
          <div class="card-body">
            <div class="text-muted small">进行中</div>
            <div class="fs-4 fw-semibold">--</div>
          </div>
        </div>
      </div>
      <div class="col-12 col-md-6 col-lg-3">
        <div class="card border-0 shadow-sm">
          <div class="card-body">
            <div class="text-muted small">待处理</div>
            <div class="fs-4 fw-semibold">--</div>
          </div>
        </div>
      </div>
    </div>

    <div class="row g-3">
      <div class="col-12 col-lg-7">
        <div class="card border-0 shadow-sm">
          <div class="card-body">
            <div class="d-flex align-items-center justify-content-between">
              <div class="fw-semibold">待办提醒</div>
              <span class="badge text-bg-light border">骨架</span>
            </div>
            <div class="list-group list-group-flush mt-3">
              <div class="list-group-item d-flex justify-content-between align-items-center">
                <span>待支付订单</span>
                <span class="text-muted">--</span>
              </div>
              <div class="list-group-item d-flex justify-content-between align-items-center">
                <span>待确认完成</span>
                <span class="text-muted">--</span>
              </div>
              <div class="list-group-item d-flex justify-content-between align-items-center">
                <span>待上传凭证</span>
                <span class="text-muted">--</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="col-12 col-lg-5">
        <div class="card border-0 shadow-sm">
          <div class="card-body">
            <div class="fw-semibold">快捷入口</div>
            <div class="d-grid gap-2 mt-3">
              <RouterLink class="btn btn-outline-primary" to="/tasks">发布/接单</RouterLink>
              <RouterLink class="btn btn-outline-primary" to="/me/profile">完善资料</RouterLink>
              <RouterLink v-if="auth.role === 'admin'" class="btn btn-outline-primary" to="/admin/dashboard">进入管理后台</RouterLink>
              <RouterLink v-if="auth.role === 'runner'" class="btn btn-outline-primary" to="/runner/earnings">查看收入</RouterLink>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
