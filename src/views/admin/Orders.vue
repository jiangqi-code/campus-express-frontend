<script setup lang="ts">
const columns = ['订单号', '用户', '跑腿员', '金额', '状态', '操作']
</script>

<template>
  <div class="vstack gap-3">
    <div>
      <h1 class="h4 mb-1">订单治理</h1>
      <div class="text-muted">管理员：筛选/异常处理（骨架）</div>
    </div>

    <div class="card border-0 shadow-sm">
      <div class="card-body">
        <div class="d-flex align-items-center justify-content-between">
          <div class="fw-semibold">订单列表</div>
          <span class="badge text-bg-light border">骨架</span>
        </div>

        <div class="table-responsive mt-3">
          <table class="table table-hover align-middle">
            <thead>
              <tr>
                <th v-for="c in columns" :key="c" class="text-nowrap">{{ c }}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colspan="6" class="text-muted">待接入数据源</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

