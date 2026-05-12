<script setup lang="ts">
const rows = [
  { id: 'w1', title: '订单收入', amount: 8, time: '—' },
  { id: 'w2', title: '订单支出', amount: -5, time: '—' },
]
</script>

<template>
  <div class="vstack gap-3">
    <div>
      <h1 class="h4 mb-1">钱包</h1>
      <div class="text-muted">余额、流水与提现（骨架）</div>
    </div>

    <div class="row g-3">
      <div class="col-12 col-lg-4">
        <div class="card border-0 shadow-sm">
          <div class="card-body">
            <div class="text-muted small">当前余额</div>
            <div class="fs-4 fw-semibold">--</div>
            <div class="d-grid gap-2 mt-3">
              <button class="btn btn-primary" type="button">充值</button>
              <button class="btn btn-outline-primary" type="button">提现</button>
            </div>
          </div>
        </div>
      </div>
      <div class="col-12 col-lg-8">
        <div class="card border-0 shadow-sm">
          <div class="card-body">
            <div class="fw-semibold">流水记录</div>
            <div class="table-responsive mt-3">
              <table class="table table-hover align-middle">
                <thead>
                  <tr>
                    <th>类型</th>
                    <th class="text-nowrap">金额</th>
                    <th class="text-nowrap">时间</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="r in rows" :key="r.id">
                    <td class="fw-semibold">{{ r.title }}</td>
                    <td class="text-nowrap" :class="r.amount >= 0 ? 'text-success' : 'text-danger'">
                      {{ r.amount >= 0 ? '+' : '' }}{{ r.amount.toFixed(2) }}
                    </td>
                    <td class="text-nowrap text-muted">{{ r.time }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

