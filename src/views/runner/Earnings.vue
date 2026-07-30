<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import * as echarts from 'echarts'
import { ElMessage } from 'element-plus'
import { http } from '@/api/request'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const isRunner = computed(() => auth.role === 'runner')
const loading = ref(false)
const summary = ref({ todayAmount: 0, weekAmount: 0, monthAmount: 0, totalAmount: 0 })
const trend = ref<{ date: string; amount: number }[]>([])
const earnings = ref<any[]>([])
const creditLogs = ref<any[]>([])
const activeLog = ref<'earning' | 'credit'>('earning')
const page = ref(1)
const pageSize = 10
const total = ref(0)
const chartEl = ref<HTMLDivElement>()
let chart: echarts.ECharts | undefined

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))
const cards = computed(() => [
  ['今日收益', summary.value.todayAmount], ['本周收益', summary.value.weekAmount],
  ['本月收益', summary.value.monthAmount], ['累计收益', summary.value.totalAmount],
])
const money = (value: unknown) => Number(value || 0).toFixed(2)
const time = (value: unknown) => value ? new Date(String(value)).toLocaleString('zh-CN') : '-'

function renderChart() {
  if (!chartEl.value || !isRunner.value) return
  chart ||= echarts.init(chartEl.value)
  chart.setOption({
    tooltip: { trigger: 'axis' },
    grid: { left: 45, right: 20, top: 25, bottom: 35 },
    xAxis: { type: 'category', data: trend.value.map(item => item.date.slice(5)) },
    yAxis: { type: 'value', name: '元' },
    series: [{ type: 'line', smooth: true, areaStyle: { opacity: .12 }, data: trend.value.map(item => Number(item.amount)), itemStyle: { color: '#0d6efd' } }],
  })
}

async function loadEarnings(targetPage = page.value) {
  if (!isRunner.value) return
  loading.value = true
  try {
    const response = await http.get('/earning/dashboard', { params: { page: targetPage, pageSize, days: 7 } })
    const root = response.data?.data ?? response.data
    summary.value = {
      todayAmount: Number(root?.summary?.todayAmount || 0), weekAmount: Number(root?.summary?.weekAmount || 0),
      monthAmount: Number(root?.summary?.monthAmount || 0), totalAmount: Number(root?.summary?.totalAmount || 0),
    }
    trend.value = root?.trend ?? []
    earnings.value = root?.items ?? []
    total.value = Number(root?.total || 0)
    page.value = targetPage
    await nextTick(); renderChart()
  } catch (error: any) { ElMessage.error(error?.response?.data?.error || '收益数据加载失败') }
  finally { loading.value = false }
}

async function loadCreditLogs() {
  if (!isRunner.value || creditLogs.value.length) return
  try {
    const response = await http.get('/credit/logs', { params: { page: 1, pageSize: 20 } })
    const root = response.data?.data ?? response.data
    creditLogs.value = root?.items ?? root?.list ?? []
  } catch { creditLogs.value = [] }
}

watch(activeLog, value => { if (value === 'credit') void loadCreditLogs() })
onMounted(() => { if (isRunner.value) void loadEarnings(1) })
onUnmounted(() => chart?.dispose())
</script>

<template>
  <div class="p-4">
    <div v-if="!isRunner" class="alert alert-info mb-0">您还不是跑腿员，暂无收益数据</div>
    <template v-else>
      <div class="d-flex justify-content-between align-items-center mb-4"><div><h2 class="h4 mb-1">跑腿收益</h2><div class="text-muted small">收益统计、趋势与订单明细</div></div><button class="btn btn-outline-primary" :disabled="loading" @click="loadEarnings(1)">刷新</button></div>
      <div class="row g-3 mb-4"><div v-for="card in cards" :key="card[0]" class="col-6 col-lg-3"><div class="card border-0 shadow-sm h-100"><div class="card-body"><div class="text-muted small">{{ card[0] }}</div><div class="h3 mt-2 mb-0">¥{{ money(card[1]) }}</div></div></div></div></div>
      <div class="card border-0 shadow-sm mb-4"><div class="card-body"><h3 class="h6">近7日收入趋势</h3><div ref="chartEl" class="income-chart" /></div></div>
      <div class="card border-0 shadow-sm"><div class="card-body">
        <ul class="nav nav-tabs mb-3"><li class="nav-item"><button class="nav-link" :class="{ active: activeLog === 'earning' }" @click="activeLog = 'earning'">收益日志</button></li><li class="nav-item"><button class="nav-link" :class="{ active: activeLog === 'credit' }" @click="activeLog = 'credit'">信用日志</button></li></ul>
        <div v-if="activeLog === 'earning'" v-loading="loading" class="table-responsive"><table class="table align-middle"><thead><tr><th>订单</th><th>路线</th><th>结算时间</th><th class="text-end">收益</th></tr></thead><tbody><tr v-for="item in earnings" :key="item.id"><td>#{{ item.orderId || '-' }}</td><td>{{ item.pickupAddress || '-' }} → {{ item.deliveryAddress || '-' }}</td><td>{{ time(item.settledAt) }}</td><td class="text-end text-success fw-semibold">+¥{{ money(item.amount) }}</td></tr><tr v-if="!earnings.length"><td colspan="4" class="text-center text-muted py-4">暂无收益明细</td></tr></tbody></table><div class="d-flex justify-content-end align-items-center gap-2"><button class="btn btn-sm btn-outline-secondary" :disabled="page <= 1" @click="loadEarnings(page - 1)">上一页</button><span class="small text-muted">{{ page }} / {{ totalPages }}</span><button class="btn btn-sm btn-outline-secondary" :disabled="page >= totalPages" @click="loadEarnings(page + 1)">下一页</button></div></div>
        <div v-else><div v-for="item in creditLogs" :key="item.id" class="d-flex justify-content-between border-bottom py-3"><div><div>{{ item.remark || item.description || '信用变动' }}</div><small class="text-muted">{{ time(item.created_at || item.createdAt) }}</small></div><strong :class="Number(item.delta) >= 0 ? 'text-success' : 'text-danger'">{{ Number(item.delta) >= 0 ? '+' : '' }}{{ item.delta }}</strong></div><div v-if="!creditLogs.length" class="text-center text-muted py-4">暂无信用日志</div></div>
      </div></div>
    </template>
  </div>
</template>

<style scoped>.income-chart { height: 300px; }.nav-link { color: #6c757d; }.nav-link.active { color: #0d6efd; font-weight: 600; }</style>
