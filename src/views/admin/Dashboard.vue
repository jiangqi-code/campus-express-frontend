<template>
  <main class="screen" v-loading="loading">
    <header class="top">
      <div><p>实时洞察校园配送业务态势与运力表现</p></div>
      <div class="actions"><span class="system-state">系统运行正常</span><span>{{ updated || '--:--:--' }}</span><button @click="load" :disabled="loading">刷新数据</button></div>
    </header>
    <el-alert v-if="error" class="alert" type="error" :closable="false" :title="error" show-icon />
    <section class="stats"><article v-for="x in cards" :key="x.name" :style="{ '--c': x.color }"><span>{{ x.name }}</span><strong>{{ x.value }}</strong><small>{{ x.en }}</small></article></section>
    <section class="grid"><article v-for="x in panels" :key="x.key"><header><h2>{{ x.title }}</h2><small>{{ x.en }}</small></header><div :ref="el => bind(x.key, el)" class="chart" /></article></section>
    <footer><span>数据源：/api/admin/dashboard</span><span>Campus Express Admin Intelligence</span></footer>
  </main>
</template>

<script setup lang="ts">
import * as echarts from 'echarts'
import { computed, nextTick, onMounted, onUnmounted, ref, type ComponentPublicInstance } from 'vue'
import { http } from '@/api/request'

type Key = 'trend' | 'rank' | 'types' | 'heat'
type Row = { name: string; value: number }
type Heat = { name: string; x: number; y: number; value: number }
const loading = ref(false)
const error = ref('')
const updated = ref('')
const els: Partial<Record<Key, HTMLDivElement>> = {}
const charts: Partial<Record<Key, echarts.ECharts>> = {}
const data = ref({ todayOrders: 0, todayAmount: 0, activeUsers: 0, runnerCount: 0, trend: [] as { date: string; value: number }[], rank: [] as Row[], types: [] as Row[], heat: [] as Heat[] })
const panels: { key: Key; title: string; en: string }[] = [{ key: 'trend', title: '近 7 天订单趋势', en: 'ORDERS TREND' }, { key: 'rank', title: '跑腿员接单排行', en: 'RUNNER RANKING' }, { key: 'types', title: '订单类型分布', en: 'ORDER CATEGORY' }, { key: 'heat', title: '区域订单密度', en: 'CAMPUS HEATMAP' }]
const toNumber = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0
const toList = (value: unknown): any[] => Array.isArray(value) ? value : []
const cards = computed(() => [
  { name: '今日订单量', value: data.value.todayOrders.toLocaleString(), en: 'TODAY ORDERS', color: '#1457d9' },
  { name: '今日交易额', value: new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(data.value.todayAmount), en: 'TODAY REVENUE', color: '#2f6fe4' },
  { name: '活跃用户', value: data.value.activeUsers.toLocaleString(), en: 'ACTIVE USERS', color: '#4d85ea' },
  { name: '在线运力', value: data.value.runnerCount.toLocaleString(), en: 'ACTIVE RUNNERS', color: '#0d2e70' },
])

function bind(key: Key, el: Element | ComponentPublicInstance | null) { if (el instanceof HTMLDivElement) els[key] = el }
function normalize(response: any) {
  const root = response?.data?.data ?? response?.data ?? {}
  const order = root.orderStats ?? {}
  const amount = root.amountStats ?? {}
  const users = root.userStats ?? {}
  const rankSource = toList(root.runnerRanking ?? root.runnerRank)
  return {
    todayOrders: toNumber(root.todayOrders ?? order.todayOrders),
    todayAmount: toNumber(root.todayAmount ?? amount.todayAmount ?? root.totalAmount ?? amount.totalAmount),
    activeUsers: toNumber(root.activeUsers ?? users.activeUsers),
    runnerCount: toNumber(root.runnerCount ?? users.runnerCount ?? rankSource.length),
    trend: toList(root.trend7d ?? root.orderTrend ?? root.ordersTrend).map(row => ({ date: String(row.date ?? row.day ?? ''), value: toNumber(row.orders ?? row.count ?? row.value) })),
    rank: rankSource.map((row, index) => ({ name: String(row.name ?? row.nickname ?? ('跑腿员 ' + (index + 1))), value: toNumber(row.orders ?? row.completedOrders ?? row.orderCount) })),
    types: toList(root.orderTypeDistribution ?? root.orderTypes).map(row => ({ name: String(row.name ?? row.typeName ?? row.type ?? '其他'), value: toNumber(row.value ?? row.count ?? row.orders) })),
    heat: toList(root.areaOrderDensity ?? root.heatmap ?? root.regionDistribution).map((row, index) => ({ name: String(row.area ?? row.name ?? row.region ?? ('区域 ' + (index + 1))), x: toNumber(row.x ?? row.col ?? index % 5), y: toNumber(row.y ?? row.row ?? Math.floor(index / 5)), value: toNumber(row.value ?? row.count ?? row.orders ?? row.heat) })),
  }
}
const tip = { backgroundColor: '#081120f5', borderColor: '#6d9cff', textStyle: { color: '#ffffff' } }
const axis = { color: '#66738a' }
const split = { lineStyle: { color: '#dbe3f0' } }
const empty = (text: string): echarts.EChartsOption => ({ title: { text, left: 'center', top: 'middle', textStyle: { color: '#66738a', fontSize: 13, fontWeight: 400 } } })
function make(key: Key) { charts[key]?.dispose(); return els[key] ? (charts[key] = echarts.init(els[key])) : undefined }

function render() {
  const trend = data.value.trend
  const rank = data.value.rank.slice(0, 8).reverse()
  const types = data.value.types
  const heat = data.value.heat
  make('trend')?.setOption(trend.length ? { tooltip: { ...tip, trigger: 'axis' }, grid: { left: 45, right: 25, top: 30, bottom: 35 }, xAxis: { type: 'category', boundaryGap: false, data: trend.map(row => row.date.slice(5)), axisLabel: axis }, yAxis: { type: 'value', axisLabel: axis, splitLine: split }, series: [{ type: 'line', smooth: true, data: trend.map(row => row.value), lineStyle: { color: '#1457d9', width: 3 }, symbol: 'circle', symbolSize: 6, itemStyle: { color: '#1457d9' } }] } : empty('暂无近 7 天趋势数据'))
  make('rank')?.setOption(rank.length ? { tooltip: { ...tip, trigger: 'axis' }, grid: { left: 80, right: 30, top: 25, bottom: 25 }, xAxis: { type: 'value', axisLabel: axis, splitLine: split }, yAxis: { type: 'category', data: rank.map(row => row.name), axisLabel: axis }, series: [{ type: 'bar', barWidth: 12, data: rank.map(row => row.value), itemStyle: { borderRadius: [0, 3, 3, 0], color: '#2f6fe4' } }] } : empty('暂无跑腿员排行数据'))
  make('types')?.setOption(types.length ? { tooltip: { ...tip, trigger: 'item' }, legend: { bottom: 8, textStyle: { color: '#66738a' } }, color: ['#1457d9', '#2f6fe4', '#4d85ea', '#6d9cff', '#0d2e70'], series: [{ type: 'pie', radius: ['45%', '69%'], center: ['50%', '44%'], padAngle: 3, label: { color: '#253552', formatter: '{b}\\n{d}%' }, itemStyle: { borderColor: '#ffffff', borderWidth: 3, borderRadius: 3 }, data: types }] } : empty('暂无订单类型分布数据'))
  const maxX = Math.max(4, ...heat.map(row => row.x))
  const maxY = Math.max(3, ...heat.map(row => row.y))
  make('heat')?.setOption(heat.length ? { tooltip: { ...tip, formatter: (item: any) => String(item.data[3]) + '<br/>订单密度：' + String(item.data[2]) }, grid: { left: 45, right: 30, top: 25, bottom: 55 }, xAxis: { type: 'category', data: Array.from({ length: maxX + 1 }, (_, index) => String(index + 1) + '区'), axisLabel: axis, splitArea: { show: true } }, yAxis: { type: 'category', data: Array.from({ length: maxY + 1 }, (_, index) => String.fromCharCode(65 + index) + '片'), axisLabel: axis, splitArea: { show: true } }, visualMap: { min: 0, max: Math.max(1, ...heat.map(row => row.value)), calculable: true, orient: 'horizontal', left: 'center', bottom: 3, textStyle: { color: '#66738a' }, inRange: { color: ['#eff4ff', '#b9ceff', '#6d9cff', '#1457d9'] } }, series: [{ type: 'heatmap', data: heat.map(row => [row.x, row.y, row.value, row.name]), label: { show: true, color: '#0e172a', formatter: (item: any) => String(item.data[3]) }, itemStyle: { borderColor: '#ffffff', borderWidth: 3 } }] } : empty('暂无区域订单密度数据'))
}
async function load() {
  if (loading.value) return
  loading.value = true
  error.value = ''
  try { data.value = normalize(await http.get('/admin/dashboard')); updated.value = new Date().toLocaleTimeString('zh-CN', { hour12: false }); await nextTick(); render() }
  catch (err: any) { error.value = err?.response?.data?.message ?? err?.message ?? '数据加载失败，请稍后重试' }
  finally { loading.value = false }
}
function resize() { Object.values(charts).forEach(chart => chart?.resize()) }
onMounted(() => { load(); window.addEventListener('resize', resize) })
onUnmounted(() => { window.removeEventListener('resize', resize); Object.values(charts).forEach(chart => chart?.dispose()) })
</script>

<style scoped>
.screen { min-height: calc(100vh - 72px); padding: 0; color: var(--color-text); font-family: "PingFang SC", "Microsoft YaHei", sans-serif; }
.top { display: flex; align-items: center; justify-content: space-between; gap: 24px; margin-bottom: 18px; padding: 0 0 18px; border-bottom: 1px solid var(--color-border); }.top p { margin: 0; color: var(--color-text-muted); }
.actions { display: flex; align-items: center; gap: 14px; color: var(--color-text-muted); font-size: 12px; }.system-state { display: inline-flex; align-items: center; gap: 7px; color: var(--color-text-secondary); }.system-state::before { width: 7px; height: 7px; border-radius: 50%; background: var(--color-primary); content: ""; }.actions button { border: 1px solid var(--color-border-strong); border-radius: var(--radius-button); padding: 9px 14px; background: #fff; color: var(--color-text-secondary); font-weight: 700; cursor: pointer; }.actions button:hover { border-color: var(--color-primary); color: var(--color-primary); }
.alert { margin-bottom: 16px; }.stats { display: grid; grid-template-columns: repeat(4, 1fr); margin-bottom: 12px; border: 1px solid var(--color-border); border-radius: var(--radius-card); background: var(--color-surface); }.stats article { display: grid; min-height: 104px; align-content: center; gap: 2px; padding: 18px; }.stats article + article { border-left: 1px solid var(--color-border); }.stats article:hover { background: var(--color-fill); }.stats span { color: var(--color-text-muted); font-size: 12px; font-weight: 700; }.stats strong { color: var(--c); font-size: clamp(24px, 2vw, 31px); letter-spacing: -.04em; }.stats small { color: var(--color-text-muted); font-size: 9px; font-weight: 800; letter-spacing: .08em; }
.grid { display: grid; grid-template-columns: 1.25fr 1fr; grid-template-rows: repeat(2, 310px); gap: 12px; }.grid article { overflow: hidden; border: 1px solid var(--color-border); border-radius: var(--radius-card); background: var(--color-surface); transition: transform var(--transition-fast), border-color var(--transition-fast); }.grid article:hover { transform: translateY(-1px); border-color: var(--color-primary); }.grid header { display: flex; align-items: center; justify-content: space-between; height: 54px; padding: 0 18px; border-bottom: 1px solid var(--color-border); }.grid h2 { margin: 0; color: var(--color-navy); font-size: 15px; }.grid header small { color: var(--color-text-muted); font-size: 10px; font-weight: 800; letter-spacing: .08em; }.chart { height: calc(100% - 54px); } footer { display: flex; justify-content: space-between; margin-top: 18px; color: var(--color-text-muted); font-size: 10px; }
@media (max-width: 1100px) { .stats { grid-template-columns: repeat(2, 1fr); }.stats article:nth-child(3) { border-left: 0; border-top: 1px solid var(--color-border); }.stats article:nth-child(4) { border-top: 1px solid var(--color-border); }.grid { grid-template-columns: 1fr; grid-template-rows: repeat(4, 320px); } }
@media (max-width: 700px) { .top { align-items: flex-start; flex-direction: column; padding: 22px; }.actions { flex-wrap: wrap; }.stats { grid-template-columns: 1fr; }.stats article + article { border-top: 1px solid var(--color-border); border-left: 0; }.grid { grid-template-rows: repeat(4, 280px); } footer { gap: 8px; flex-direction: column; } }
</style>
