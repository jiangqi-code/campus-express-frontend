<template>
  <div class="ce-admin-dashboard" v-loading="overlayLoading" element-loading-text="加载中…">
    <div class="ce-head">
      <div>
        <div class="ce-title">高级数据看板</div>
        <div class="ce-subtitle">
          <span>任务热力地图 · KPI · 排行榜 · 趋势 · 分布 · 能力 · 进度</span>
          <span v-if="lastUpdatedText" class="ce-dot">·</span>
          <span v-if="lastUpdatedText" class="ce-muted">更新于 {{ lastUpdatedText }}</span>
        </div>
      </div>
      <div class="d-flex gap-2">
        <el-button type="primary" :loading="pageLoading" @click="refresh">刷新</el-button>
      </div>
    </div>

    <el-alert v-if="pageError" type="error" :closable="false" show-icon :title="pageError" />

    <div ref="gridEl" class="ce-grid">
      <section class="ce-panel ce-kpi">
        <div class="ce-panel-head">
          <div class="ce-panel-title">今日 KPI</div>
          <div class="ce-panel-sub">环比</div>
        </div>
        <div class="ce-kpi-grid">
          <div v-for="it in kpiCards" :key="it.key" class="ce-kpi-card">
            <div class="ce-kpi-label">{{ it.label }}</div>
            <div class="ce-kpi-value">{{ it.valueText }}</div>
            <div class="ce-kpi-delta" :class="deltaClass(it.deltaPct)">
              <span class="ce-kpi-arrow">{{ deltaArrow(it.deltaPct) }}</span>
              <span>{{ deltaText(it.deltaPct) }}</span>
            </div>
          </div>
        </div>
        <div v-if="dashboardError" class="ce-panel-foot ce-danger">{{ dashboardError }}</div>
      </section>

      <section class="ce-panel ce-radar">
        <div class="ce-panel-head">
          <div class="ce-panel-title">跑腿员能力画像</div>
          <div class="ce-panel-sub">{{ topRunnerNameText }}</div>
        </div>
        <div class="ce-panel-body">
          <div ref="radarEl" class="ce-chart" />
        </div>
        <div v-if="radarHintText" class="ce-panel-foot ce-muted">{{ radarHintText }}</div>
      </section>

      <section class="ce-panel ce-trend">
        <div class="ce-panel-head">
          <div class="ce-panel-title">7 日订单趋势</div>
          <div class="ce-panel-sub">订单数</div>
        </div>
        <div class="ce-panel-body">
          <div ref="trendEl" class="ce-chart" />
        </div>
      </section>

      <section class="ce-panel ce-map">
        <div class="ce-panel-head">
          <div class="ce-panel-title">任务热力地图</div>
          <div class="ce-panel-sub">支持缩放 / 悬浮</div>
        </div>
        <div class="ce-panel-body">
          <div v-show="heatmapMode === 'amap'" ref="amapEl" class="ce-map-canvas" />
          <div v-show="heatmapMode !== 'amap'" ref="heatEl" class="ce-chart ce-map-chart" />
          <div v-if="heatmapError" class="ce-overlay ce-danger">{{ heatmapError }}</div>
        </div>
      </section>

      <section class="ce-panel ce-rank">
        <div class="ce-panel-head">
          <div class="ce-panel-title">跑腿员排行榜</div>
          <div class="ce-panel-sub">Top 5</div>
        </div>
        <div class="ce-rank-list">
          <div v-for="(it, idx) in runnerRankTop5" :key="it.id" class="ce-rank-row">
            <div class="ce-rank-left">
              <div class="ce-rank-badge">{{ medalText(idx) }}</div>
              <div class="ce-rank-name">{{ it.name }}</div>
            </div>
            <div class="ce-rank-right">
              <div class="ce-rank-metric">
                <span class="ce-muted">完成</span>
                <span class="ce-strong">{{ it.orders }}</span>
              </div>
              <div class="ce-rank-metric">
                <span class="ce-muted">收益</span>
                <span class="ce-strong">{{ formatMoney(it.amount) }}</span>
              </div>
            </div>
          </div>
          <div v-if="!runnerRankTop5.length" class="ce-empty ce-muted">暂无排行榜数据</div>
        </div>
      </section>

      <section class="ce-panel ce-progress">
        <div class="ce-panel-head">
          <div class="ce-panel-title">本周进度</div>
          <div class="ce-panel-sub">{{ weekProgressSubText }}</div>
        </div>
        <div class="ce-panel-body">
          <div ref="progressEl" class="ce-chart" />
        </div>
        <div v-if="weekProgressError" class="ce-panel-foot ce-danger">{{ weekProgressError }}</div>
      </section>

      <section class="ce-panel ce-status">
        <div class="ce-panel-head">
          <div class="ce-panel-title">订单状态分布</div>
          <div class="ce-panel-sub">今日</div>
        </div>
        <div class="ce-panel-body">
          <div ref="statusEl" class="ce-chart" />
        </div>
        <div v-if="statusError" class="ce-panel-foot ce-danger">{{ statusError }}</div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus'
import * as echarts from 'echarts'


import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'

import { http } from '@/api/request'
import { listAdminOrders, type AdminDashboardRunnerRankItem } from '@/api/admin'

type DashboardTrendPoint = { date: string; orders: number }

type DashboardCore = {
  todayOrders: number
  weekOrders: number      // 新增
  totalOrders: number     // 新增
  totalAmount: number
  activeUsers: number
  trend7d: DashboardTrendPoint[]
  runnerRank: AdminDashboardRunnerRankItem[]
  raw: any
}

type HeatmapPoint = { name: string; value: number; coord?: [number, number] }

type OrderStatusKey = 'PENDING' | 'ACCEPTED' | 'PICKED' | 'DELIVERING' | 'COMPLETED' | 'CANCELLED'

const COLORS = {
  bg: '#f5f7fa',
  card: '#ffffff',
  border: '#e4e7ed',
  text: '#303133',
  muted: '#909399',
  primary: '#409eff',
  success: '#67c23a',
  warning: '#e6a23c',
  danger: '#f56c6c',
  info: '#909399',
  violet: '#8b5cf6',
}

const ORDER_STATUS_META: Array<{ key: OrderStatusKey; label: string; color: string }> = [
  { key: 'PENDING', label: '待接单', color: COLORS.primary },
  { key: 'ACCEPTED', label: '已接单', color: COLORS.violet },
  { key: 'PICKED', label: '已取件', color: COLORS.warning },
  { key: 'DELIVERING', label: '配送中', color: '#00bcd4' },
  { key: 'COMPLETED', label: '已完成', color: COLORS.success },
  { key: 'CANCELLED', label: '已取消', color: COLORS.danger },
]

const API_TIMEOUT_MS = 10000
const API_RETRIES = 1
const WEEK_TARGET_DEFAULT = 400

const pageLoading = ref(false)
const pageError = ref('')
const lastUpdatedAt = ref<number | null>(null)

const dashboard = ref<DashboardCore | null>(null)
const dashboardError = ref('')

const overlayLoading = computed(() => pageLoading.value && !dashboard.value && !pageError.value)

const heatmapPoints = ref<HeatmapPoint[]>([])
const heatmapError = ref('')
const heatmapMode = ref<'amap' | 'echarts'>('echarts')

const statusDist = ref<Array<{ key: OrderStatusKey; label: string; value: number; color: string }>>([])
const statusError = ref('')

const weekProgress = ref<{ target: number; completed: number; weekTotalOrders?: number } | null>(null)
const weekProgressError = ref('')

const gridEl = ref<HTMLDivElement | null>(null)
const heatEl = ref<HTMLDivElement | null>(null)
const amapEl = ref<HTMLDivElement | null>(null)
const trendEl = ref<HTMLDivElement | null>(null)
const statusEl = ref<HTMLDivElement | null>(null)
const radarEl = ref<HTMLDivElement | null>(null)
const progressEl = ref<HTMLDivElement | null>(null)

let mapChart: echarts.ECharts | null = null
let trendChart: echarts.ECharts | null = null
let statusChart: echarts.ECharts | null = null
let radarChart: echarts.ECharts | null = null
let progressChart: echarts.ECharts | null = null

let amapMap: any | null = null
let amapHeatLayer: any | null = null
let amapScriptPromise: Promise<any> | null = null

let resizeObserver: ResizeObserver | null = null
let windowResizeHandler: (() => void) | null = null

function toNumber(v: unknown, fallback = 0) {
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN
  return Number.isFinite(n) ? n : fallback
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function getErrorMessageFromAny(err: any) {
  return (
    err?.response?.data?.message ||
    err?.response?.data?.msg ||
    err?.response?.data?.error ||
    err?.message ||
    '加载失败'
  )
}

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function toYmd(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function endOfToday() {
  const d = new Date()
  d.setHours(23, 59, 59, 999)
  return d
}

function startOfWeekMonday() {
  const d = new Date()
  const day = d.getDay()
  const delta = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + delta)
  d.setHours(0, 0, 0, 0)
  return d
}

function formatMoney(n: number) {
  const v = Number.isFinite(n) ? n : 0
  return `¥ ${v.toFixed(2)}`
}

function formatInt(n: number) {
  const v = Number.isFinite(n) ? Math.round(n) : 0
  return String(v)
}

function formatShortDateLabel(dateRaw: string) {
  const s = String(dateRaw || '').trim()
  const m = s.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
  if (m) return `${pad2(Number(m[2]))}/${pad2(Number(m[3]))}`
  const mmdd = s.match(/(\d{1,2})[-/](\d{1,2})/)
  if (mmdd) return `${pad2(Number(mmdd[1]))}/${pad2(Number(mmdd[2]))}`
  return s || '—'
}

function computeDeltaPct(current: number, prev: number) {
  const c = toNumber(current, 0)
  const p = toNumber(prev, 0)
  if (!Number.isFinite(c) || !Number.isFinite(p)) return null
  if (p === 0) return c === 0 ? 0 : null
  return ((c - p) / p) * 100
}

function deltaArrow(v: number | null) {
  if (v === null) return '—'
  if (v > 0) return '↑'
  if (v < 0) return '↓'
  return '→'
}

function deltaText(v: number | null) {
  if (v === null) return '—'
  const n = Math.abs(v)
  return `${n.toFixed(1)}%`
}

function deltaClass(v: number | null) {
  if (v === null) return 'is-neutral'
  if (v > 0) return 'is-up'
  if (v < 0) return 'is-down'
  return 'is-neutral'
}

function medalText(idx: number) {
  if (idx === 0) return '🥇'
  if (idx === 1) return '🥈'
  if (idx === 2) return '🥉'
  return String(idx + 1).padStart(2, '0')
}

function normalizeDashboardRoot(dataRaw: any): DashboardCore {
  const root = dataRaw?.data ?? dataRaw
  
  // 后端返回的是嵌套结构
  const orderStats = root?.orderStats ?? {}
  const amountStats = root?.amountStats ?? {}
  const userStats = root?.userStats ?? {}
  const runnerRanking = root?.runnerRanking ?? []
  
  // 获取订单统计
  const todayOrders = toNumber(orderStats?.todayOrders, 0)
  const weekOrders = toNumber(orderStats?.weekOrders, 0)
  const totalOrders = toNumber(orderStats?.totalOrders, 0)
  
  // 获取金额统计
  const totalAmount = toNumber(amountStats?.totalAmount, 0)
  
  // 获取用户统计
  const activeUsers = toNumber(userStats?.activeUsers, 0)
  
  // 构建7日趋势（后端可能没有，从 orderStats 无法获取，先留空）
  let trend7d: DashboardTrendPoint[] = []
  
  // 如果后端有 trend7d 字段就取，没有就空
  if (root?.trend7d && Array.isArray(root.trend7d)) {
    trend7d = root.trend7d.map((item: any) => ({
      date: item.date || '',
      orders: toNumber(item.orders, 0)
    }))
  }
  
  // 转换跑腿员排行榜
  const runnerRank = runnerRanking.map((item: any) => ({
    id: String(item.user_id || item.id || ''),
    name: item.nickname || `跑腿员${item.user_id}`,
    orders: toNumber(item.completedOrders, 0),
    amount: toNumber(item.totalEarning, 0)
  }))
  
  return {
    todayOrders,
    weekOrders,
    totalOrders,
    totalAmount,
    activeUsers,
    trend7d,
    runnerRank,
    raw: root,
  }
}

function normalizeHeatmapList(dataRaw: any): HeatmapPoint[] {
  const root = dataRaw?.data ?? dataRaw
  const list = root?.list ?? root?.regions ?? root?.data ?? root ?? []
  const arr = Array.isArray(list) ? list : []
  return arr
    .map((it) => {
      const r = it?.data ?? it
      const name = String(r?.name ?? r?.region ?? r?.area ?? r?.title ?? '').trim()
      const value = toNumber(r?.value ?? r?.count ?? r?.orders ?? r?.heat, 0)
      const lng = toNumber(r?.lng ?? r?.lon ?? r?.longitude ?? r?.x, NaN)
      const lat = toNumber(r?.lat ?? r?.latitude ?? r?.y, NaN)
      const coord: [number, number] | undefined = Number.isFinite(lng) && Number.isFinite(lat) ? [lng, lat] : undefined
      return name ? ({ name, value, coord } as HeatmapPoint) : null
    })
    .filter((x): x is HeatmapPoint => Boolean(x))
}

function ensureChart(el: HTMLDivElement | null, existing: echarts.ECharts | null) {
  if (!el) return null
  if (existing) return existing
  return echarts.init(el, undefined, { renderer: 'canvas' })
}

function setEmptyChart(chart: echarts.ECharts | null, text: string) {
  if (!chart) return
  chart.setOption(
    {
      backgroundColor: 'transparent',
      title: { show: true, text, left: 'center', top: 'center', textStyle: { color: COLORS.muted, fontSize: 13 } },
      series: [],
    },
    true,
  )
}

const AMAP_KEY = '8476ce87e366c5936788fe2a47fc26ad'
const AMAP_SECURITY_JS_CODE = '63f89ed0a18fd8c4ec57d119ec552e14'

function waitMs(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms))
}

async function runWithRetry<T>(
  executor: (signal: AbortSignal) => Promise<T>,
  options?: { timeoutMs?: number; retries?: number; retryDelayMs?: number },
) {
  const timeoutMs = options?.timeoutMs ?? API_TIMEOUT_MS
  const retries = options?.retries ?? API_RETRIES
  const retryDelayMs = options?.retryDelayMs ?? 500

  let lastError: any = null
  for (let i = 0; i <= retries; i += 1) {
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), timeoutMs)
    try {
      const r = await executor(controller.signal)
      window.clearTimeout(timer)
      return r
    } catch (err: any) {
      window.clearTimeout(timer)
      lastError = err
      const aborted = String(err?.name || '').toLowerCase().includes('abort')
      if (i >= retries || aborted) throw err
      await waitMs(retryDelayMs * Math.pow(1.6, i))
    }
  }
  throw lastError
}

function loadAMapScript() {
  if ((window as any).AMap?.Map) return Promise.resolve((window as any).AMap)
  if (amapScriptPromise) return amapScriptPromise

  amapScriptPromise = new Promise((resolve, reject) => {
    const timeoutMs = 15000
    const startAt = Date.now()
    const poll = () => {
      const AMap = (window as any).AMap
      if (AMap?.Map) {
        resolve(AMap)
        return
      }
      if (Date.now() - startAt >= timeoutMs) {
        reject(new Error(`AMap JSAPI 未加载（key=${AMAP_KEY}）`))
        return
      }
      window.setTimeout(poll, 50)
    }

    try {
      ;(window as any)._AMapSecurityConfig = { securityJsCode: AMAP_SECURITY_JS_CODE }
    } catch {}

    const scriptId = 'amap-jsapi'
    const existing = document.getElementById(scriptId) as HTMLScriptElement | null
    if (existing) {
      poll()
      return
    }

    const script = document.createElement('script')
    script.id = scriptId
    script.async = true
    script.defer = true
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(AMAP_KEY)}`
    script.onerror = () => reject(new Error('高德地图脚本加载失败'))
    document.head.appendChild(script)
    poll()
  })

  return amapScriptPromise
}

function ensureAMapPlugins(AMap: any, plugins: string[]) {
  const list = Array.isArray(plugins) ? plugins.filter((p) => String(p || '').trim()) : []
  if (!list.length) return Promise.resolve()
  if (!AMap || typeof AMap.plugin !== 'function') return Promise.resolve()
  return new Promise<void>((resolve) => {
    AMap.plugin(list, () => resolve())
  })
}

function destroyAmap() {
  try {
    amapHeatLayer?.setMap?.(null)
  } catch {}
  amapHeatLayer = null

  try {
    amapMap?.destroy?.()
  } catch {}
  amapMap = null
}

async function renderAmapHeatmap() {
  const withCoord = heatmapPoints.value.filter((p) => Array.isArray(p.coord))
  if (!withCoord.length) throw new Error('热力数据缺少经纬度')
  if (!amapEl.value) throw new Error('地图容器不存在')

  const AMap = await loadAMapScript()
  await ensureAMapPlugins(AMap, ['AMap.HeatMap', 'AMap.ToolBar'])
  if (!amapEl.value) throw new Error('地图容器不存在')

  const maxValue = Math.max(1, ...withCoord.map((p) => p.value))
  const center = withCoord[0]?.coord ?? [113.3304, 23.1065]

  if (!amapMap) {
    amapMap = new AMap.Map(amapEl.value, {
      zoom: 13,
      viewMode: '2D',
      resizeEnable: true,
      center,
    })
    if (AMap.ToolBar) amapMap.addControl(new AMap.ToolBar())
  }

  if (!amapHeatLayer) {
    amapHeatLayer = new AMap.HeatMap(amapMap, {
      radius: 26,
      opacity: [0.05, 0.85],
      gradient: {
        0.2: COLORS.primary,
        0.55: COLORS.warning,
        0.85: COLORS.danger,
        1.0: '#b91c1c',
      },
    })
  }

  amapHeatLayer.setDataSet({
    max: maxValue,
    data: withCoord.map((p) => ({ lng: p.coord![0], lat: p.coord![1], count: p.value, name: p.name })),
  })
}

async function ensureHeatmapMode() {
  const withCoord = heatmapPoints.value.filter((p) => Array.isArray(p.coord))
  if (!withCoord.length) {
    heatmapMode.value = 'echarts'
    destroyAmap()
    return
  }

  try {
    await renderAmapHeatmap()
    heatmapMode.value = 'amap'
    try {
      mapChart?.dispose()
    } catch {}
    mapChart = null
  } catch (err: any) {
    destroyAmap()
    heatmapMode.value = 'echarts'
    const msg = getErrorMessageFromAny(err)
    heatmapError.value = heatmapError.value || `高德地图加载失败，已切换为模拟热力图：${msg}`
  }
}

function renderHeatmapChart() {
  if (heatmapMode.value === 'amap') return

  mapChart = ensureChart(heatEl.value, mapChart)
  if (!mapChart) return

  const points = heatmapPoints.value
  if (!points.length) {
    setEmptyChart(mapChart, '暂无热力数据')
    return
  }

  const withCoord = points.filter((p) => Array.isArray(p.coord))
  const maxValue = Math.max(1, ...points.map((p) => p.value))

  const baseGeo: echarts.EChartsOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: '#ffffff',
      borderColor: '#ebeef5',
      borderWidth: 1,
      textStyle: { color: COLORS.text, fontSize: 12 },
      formatter: (p: any) => {
        const name = String(p?.name ?? '')
        const value = toNumber(p?.value ?? p?.data?.value, 0)
        if (!name) return `${value}`
        return `${name}<br/>任务：${value}`
      },
    },
    visualMap: {
      show: true,
      min: 0,
      max: maxValue,
      left: 14,
      bottom: 10,
      text: ['高', '低'],
      textStyle: { color: COLORS.muted },
      calculable: true,
      inRange: { color: ['rgba(64,158,255,0.18)', 'rgba(230,162,60,0.55)', 'rgba(245,108,108,0.9)'] },
      itemWidth: 12,
      itemHeight: 70,
      backgroundColor: 'transparent',
      borderColor: 'transparent',
    },
    geo: {
      map: 'china',
      roam: true,
      zoom: 1.1,
      layoutCenter: ['50%', '52%'],
      layoutSize: '130%',
      itemStyle: {
        areaColor: '#f2f6fc',
        borderColor: '#dcdfe6',
        borderWidth: 1,
      },
      emphasis: {
        itemStyle: {
          areaColor: '#ecf5ff',
          borderColor: COLORS.primary,
          borderWidth: 1,
        },
      },
    },
  }

  if (withCoord.length) {
    const heatData = withCoord
      .filter((p) => p.coord)
      .map((p) => [p.coord![0], p.coord![1], p.value])
    const top = [...withCoord].sort((a, b) => b.value - a.value).slice(0, 10)
    const scatterData = top
      .filter((p) => p.coord)
      .map((p) => ({ name: p.name, value: [p.coord![0], p.coord![1], p.value] }))

    mapChart.setOption(
      {
        ...baseGeo,
        series: [
          {
            type: 'heatmap',
            coordinateSystem: 'geo',
            data: heatData,
            pointSize: 14,
            blurSize: 22,
            emphasis: { disabled: true },
          },
          {
            type: 'effectScatter',
            coordinateSystem: 'geo',
            data: scatterData,
            symbolSize: (val: any) => {
              const v = Array.isArray(val) ? toNumber(val[2], 0) : toNumber(val, 0)
              return clamp(6 + (v / maxValue) * 18, 8, 28)
            },
            showEffectOn: 'render',
            rippleEffect: { brushType: 'stroke', scale: 2.2 },
            itemStyle: { color: COLORS.success, shadowBlur: 18, shadowColor: 'rgba(103, 194, 58, 0.35)' },
            tooltip: {
              formatter: (p: any) => {
                const name = String(p?.name ?? '')
                const value = Array.isArray(p?.value) ? toNumber(p.value[2], 0) : toNumber(p?.value, 0)
                return `${name}<br/>任务：${value}`
              },
            },
          },
        ],
      },
      true,
    )
    return
  }

  const regionData = points.map((p) => ({ name: p.name, value: p.value }))
  mapChart.setOption(
    {
      ...baseGeo,
      series: [
        {
          type: 'map',
          map: 'china',
          roam: true,
          data: regionData,
          label: { show: false },
          itemStyle: {
            borderColor: '#dcdfe6',
          },
          emphasis: {
            label: { show: false },
            itemStyle: { borderColor: COLORS.primary },
          },
        },
      ],
    },
    true,
  )
}

function renderTrendChart() {
  trendChart = ensureChart(trendEl.value, trendChart)
  if (!trendChart) return

  const points = dashboard.value?.trend7d ?? []
  if (!points.length) {
    setEmptyChart(trendChart, '暂无趋势数据')
    return
  }

  const labels = points.map((p) => formatShortDateLabel(p.date))
  const orders = points.map((p) => toNumber(p.orders, 0))
  const max = Math.max(1, ...orders)

  trendChart.setOption(
    {
      backgroundColor: 'transparent',
      grid: { left: 12, right: 12, top: 38, bottom: 10, containLabel: true },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#ffffff',
        borderColor: '#ebeef5',
        borderWidth: 1,
        textStyle: { color: COLORS.text, fontSize: 12 },
        axisPointer: { type: 'line', lineStyle: { color: 'rgba(64,158,255,0.45)' } },
        formatter: (ps: any) => {
          const p = Array.isArray(ps) ? ps[0] : ps
          return `${p?.axisValueLabel ?? ''}<br/>订单：${toNumber(p?.data, 0)}`
        },
      },
      legend: {
        top: 10,
        right: 12,
        icon: 'circle',
        itemWidth: 8,
        itemHeight: 8,
        textStyle: { color: COLORS.muted, fontSize: 12 },
      },
      xAxis: {
        type: 'category',
        data: labels,
        axisLine: { lineStyle: { color: '#dcdfe6' } },
        axisTick: { show: false },
        axisLabel: { color: COLORS.muted, fontSize: 12, margin: 12 },
      },
      yAxis: {
        type: 'value',
        splitNumber: 4,
        axisLabel: { color: COLORS.muted, fontSize: 12 },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: '#ebeef5', type: 'dashed' } },
        min: 0,
        max: Math.ceil(max * 1.25),
      },
      series: [
        {
          name: '订单数',
          type: 'line',
          data: orders,
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          showSymbol: false,
          lineStyle: { width: 3, color: COLORS.primary },
          itemStyle: { color: COLORS.primary },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(64,158,255,0.22)' },
              { offset: 1, color: 'rgba(64,158,255,0.02)' },
            ]),
          },
        },
      ],
    },
    true,
  )
}

function renderStatusChart() {
  statusChart = ensureChart(statusEl.value, statusChart)
  if (!statusChart) return

  const rows = statusDist.value
  const total = rows.reduce((s, x) => s + toNumber(x.value, 0), 0)
  if (!rows.length || total <= 0) {
    setEmptyChart(statusChart, '暂无状态数据')
    return
  }

  statusChart.setOption(
    {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        backgroundColor: '#ffffff',
        borderColor: '#ebeef5',
        borderWidth: 1,
        textStyle: { color: COLORS.text, fontSize: 12 },
        formatter: (p: any) => `${p?.name}<br/>${toNumber(p?.value, 0)} 单 (${toNumber(p?.percent, 0).toFixed(1)}%)`,
      },
      legend: {
        top: 'middle',
        right: 10,
        orient: 'vertical',
        icon: 'circle',
        itemWidth: 8,
        itemHeight: 8,
        itemGap: 10,
        textStyle: { color: COLORS.muted, fontSize: 12 },
      },
      series: [
        {
          type: 'pie',
          radius: ['52%', '72%'],
          center: ['38%', '52%'],
          avoidLabelOverlap: false,
          label: { show: false },
          labelLine: { show: false },
          itemStyle: { borderRadius: 10, borderWidth: 2, borderColor: '#ffffff' },
          data: rows.map((r) => ({ name: r.label, value: r.value, itemStyle: { color: r.color } })),
        },
      ],
      graphic: [
        {
          type: 'text',
          left: '38%',
          top: '45%',
          style: { text: '今日总单', fill: COLORS.muted, fontSize: 12, fontWeight: 600 },
        },
        {
          type: 'text',
          left: '38%',
          top: '53%',
          style: { text: formatInt(total), fill: COLORS.text, fontSize: 22, fontWeight: 800 },
        },
      ],
    },
    true,
  )
}

function normalizePctTo100(vRaw: unknown): number | null {
  const v = toNumber(vRaw, NaN)
  if (!Number.isFinite(v)) return null
  if (v >= 0 && v <= 1) return v * 100
  return v
}

function pickNumberByKeys(root: any, keys: string[]) {
  for (const k of keys) {
    const v = root?.[k]
    const n = toNumber(v, NaN)
    if (Number.isFinite(n)) return n
  }
  return null
}

function renderRadarChart() {
  radarChart = ensureChart(radarEl.value, radarChart)
  if (!radarChart) return

  const top = runnerRankTop5.value[0]
  const root = dashboard.value?.raw
  if (!top) {
    setEmptyChart(radarChart, '暂无跑腿员数据')
    return
  }

  const maxOrders = Math.max(1, ...runnerRankTop5.value.map((r) => toNumber(r.orders, 0)))
  const avgIncome = top.orders > 0 ? top.amount / Math.max(1, top.orders) : 0
  const maxAvgIncome = Math.max(
    1,
    ...runnerRankTop5.value.map((r) => (toNumber(r.orders, 0) > 0 ? toNumber(r.amount, 0) / toNumber(r.orders, 1) : 0)),
  )

  const speedPct = normalizePctTo100(
    pickNumberByKeys(root, ['topRunnerAcceptSpeed', 'acceptSpeed', 'accept_speed', 'speed', 'speedScore']),
  )
  const onTimePct = normalizePctTo100(pickNumberByKeys(root, ['onTimeRate', 'on_time_rate', 'punctuality', 'punctualityRate']))
  const ratingPct = normalizePctTo100(pickNumberByKeys(root, ['goodRate', 'good_rate', 'rating', 'ratingScore']))
  const creditRaw = pickNumberByKeys(root, ['credit', 'creditScore', 'credit_score', 'creditPoint'])
  const creditPct = creditRaw === null ? null : creditRaw > 100 ? (creditRaw / 1000) * 100 : creditRaw

  const acceptSpeedScore =
    speedPct !== null
      ? clamp(speedPct, 0, 100)
      : (() => {
          const secs = pickNumberByKeys(root, ['acceptSeconds', 'accept_sec', 'avgAcceptSeconds', 'avg_accept_seconds'])
          if (secs === null || !Number.isFinite(secs) || secs <= 0) return null
          const score = 100 * (60 / secs)
          return clamp(score, 0, 100)
        })()

  const dims = [
    { name: '接单速度', value: acceptSpeedScore },
    { name: '准时率', value: onTimePct !== null ? clamp(onTimePct, 0, 100) : null },
    { name: '完成单量', value: clamp((top.orders / maxOrders) * 100, 0, 100) },
    { name: '好评率', value: ratingPct !== null ? clamp(ratingPct, 0, 100) : null },
    { name: '信用分', value: creditPct !== null ? clamp(creditPct, 0, 100) : null },
    { name: '平均收益', value: clamp((avgIncome / maxAvgIncome) * 100, 0, 100) },
  ]

  const filled = dims.map((d) => (d.value === null ? 0 : d.value))

  radarChart.setOption(
    {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        backgroundColor: '#ffffff',
        borderColor: '#ebeef5',
        borderWidth: 1,
        textStyle: { color: COLORS.text, fontSize: 12 },
        formatter: () => {
          const lines = dims.map((d) => `${d.name}：${d.value === null ? '—' : `${d.value.toFixed(0)}/100`}`)
          return `${top.name}<br/>${lines.join('<br/>')}`
        },
      },
      radar: {
        indicator: dims.map((d) => ({ name: d.name, max: 100 })),
        center: ['50%', '56%'],
        radius: '68%',
        splitNumber: 4,
        axisName: { color: COLORS.muted, fontSize: 12 },
        splitLine: { lineStyle: { color: '#ebeef5' } },
        splitArea: { areaStyle: { color: ['rgba(64,158,255,0.03)', 'rgba(64,158,255,0.01)'] } },
        axisLine: { lineStyle: { color: '#dcdfe6' } },
      },
      series: [
        {
          type: 'radar',
          data: [
            {
              value: filled,
              name: top.name,
              areaStyle: { color: 'rgba(64,158,255,0.18)' },
              lineStyle: { color: COLORS.primary, width: 2 },
              itemStyle: { color: COLORS.primary },
              symbolSize: 6,
            },
          ],
        },
      ],
    },
    true,
  )
}

function renderProgressChart() {
  progressChart = ensureChart(progressEl.value, progressChart)
  if (!progressChart) return

  const total = toNumber(weekProgress.value?.target, 0)
  const completed = toNumber(weekProgress.value?.completed, 0)
  const pct = total <= 0 ? 0 : clamp((completed / total) * 100, 0, 100)

  progressChart.setOption(
    {
      backgroundColor: 'transparent',
      series: [
        {
          type: 'gauge',
          startAngle: 90,
          endAngle: -270,
          radius: '92%',
          progress: {
            show: true,
            overlap: false,
            roundCap: true,
            clip: false,
            itemStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                { offset: 0, color: COLORS.primary },
                { offset: 0.55, color: COLORS.warning },
                { offset: 1, color: COLORS.success },
              ]),
            },
          },
          axisLine: { lineStyle: { width: 14, color: [[1, '#ebeef5']] } },
          pointer: { show: false },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          data: [{ value: pct, name: '完成率' }],
          detail: {
            valueAnimation: true,
            offsetCenter: [0, '8%'],
            color: COLORS.text,
            fontSize: 26,
            fontWeight: 900,
            formatter: (v: number) => `${Math.round(v)}%`,
          },
          title: { show: true, offsetCenter: [0, '42%'], color: COLORS.muted, fontSize: 12, fontWeight: 600 },
        },
      ],
    },
    true,
  )
}

function resizeCharts() {
  try {
    mapChart?.resize()
  } catch {}
  try {
    amapMap?.resize?.()
  } catch {}
  try {
    trendChart?.resize()
  } catch {}
  try {
    statusChart?.resize()
  } catch {}
  try {
    radarChart?.resize()
  } catch {}
  try {
    progressChart?.resize()
  } catch {}
}

async function fetchDashboardCore() {
  dashboardError.value = ''
  try {
    const resp = await runWithRetry((signal) => http.get('/admin/dashboard', { timeout: API_TIMEOUT_MS, signal }))
    dashboard.value = normalizeDashboardRoot(resp.data)
  } catch (err: any) {
    dashboard.value = null
    dashboardError.value = getErrorMessageFromAny(err)
    throw err
  }
}

async function fetchHeatmap() {
  heatmapError.value = ''
  try {
    const resp = await runWithRetry((signal) => http.get('/admin/heatmap', { timeout: API_TIMEOUT_MS, signal }))
    heatmapPoints.value = normalizeHeatmapList(resp.data)
  } catch (err: any) {
    heatmapPoints.value = []
    heatmapError.value = getErrorMessageFromAny(err)
  }
}

async function fetchTodayStatusDistribution() {
  statusError.value = ''
  try {
    const start = startOfToday()
    const end = endOfToday()
    const baseQuery = {
      page: 1,
      pageSize: 1,
      startDate: toYmd(start),
      endDate: toYmd(end),
      startTime: start.toISOString(),
      endTime: end.toISOString(),
    }

    const settled = await Promise.allSettled(
      ORDER_STATUS_META.map(async (s) => {
        const res = await runWithRetry(
          (signal) => listAdminOrders({ ...baseQuery, status: s.key }, { timeout: API_TIMEOUT_MS, signal }),
          { timeoutMs: API_TIMEOUT_MS, retries: API_RETRIES },
        )
        return { key: s.key, label: s.label, color: s.color, value: toNumber(res.total, 0) }
      }),
    )

    const rows = settled
      .map((r) => (r.status === 'fulfilled' ? r.value : null))
      .filter((x): x is { key: OrderStatusKey; label: string; color: string; value: number } => Boolean(x))

    const total = rows.reduce((s, x) => s + toNumber(x.value, 0), 0)
    if (rows.length && total > 0) {
      statusDist.value = rows
      return
    }

    const listRes = await runWithRetry(
      (signal) => listAdminOrders({ ...baseQuery, pageSize: 200 }, { timeout: API_TIMEOUT_MS, signal }),
      { timeoutMs: API_TIMEOUT_MS, retries: 0 },
    )
    const counts = new Map<OrderStatusKey, number>()
    for (const it of listRes.list) {
      const k = String((it as any)?.status ?? '').trim().toUpperCase() as OrderStatusKey
      if (!k) continue
      counts.set(k, (counts.get(k) ?? 0) + 1)
    }
    statusDist.value = ORDER_STATUS_META.map((s) => ({
      key: s.key,
      label: s.label,
      color: s.color,
      value: counts.get(s.key) ?? 0,
    }))
  } catch (err: any) {
    statusDist.value = []
    statusError.value = getErrorMessageFromAny(err)
  }
}

function pickWeekTargetFromAny(root: any) {
  return pickNumberByKeys(root, ['weekTarget', 'week_goal', 'weekGoal', 'weeklyTarget', 'weekly_goal', 'weekOrderTarget', 'week_order_target'])
}

async function fetchWeekProgress() {
  weekProgressError.value = ''
  try {
    const start = startOfWeekMonday()
    const end = endOfToday()
    const baseQuery = {
      page: 1,
      pageSize: 1,
      startDate: toYmd(start),
      endDate: toYmd(end),
      startTime: start.toISOString(),
      endTime: end.toISOString(),
    }
    const [allRes, doneRes] = await Promise.all([
      runWithRetry((signal) => listAdminOrders({ ...baseQuery }, { timeout: API_TIMEOUT_MS, signal }), {
        timeoutMs: API_TIMEOUT_MS,
        retries: 0,
      }),
      runWithRetry((signal) => listAdminOrders({ ...baseQuery, status: 'COMPLETED' }, { timeout: API_TIMEOUT_MS, signal }), {
        timeoutMs: API_TIMEOUT_MS,
        retries: 0,
      }),
    ])

    const targetRaw = pickWeekTargetFromAny(dashboard.value?.raw)
    const target = clamp(toNumber(targetRaw, WEEK_TARGET_DEFAULT), 1, 999999)
    weekProgress.value = {
      target,
      completed: toNumber(doneRes.total, 0),
      weekTotalOrders: toNumber(allRes.total, 0),
    }
  } catch (err: any) {
    weekProgress.value = null
    weekProgressError.value = getErrorMessageFromAny(err)
  }
}

async function ensureTrendFallback() {
  const d = dashboard.value
  if (!d || (d.trend7d ?? []).length) return

  const end = endOfToday()
  const days: Array<{ start: Date; end: Date }> = []
  for (let i = 6; i >= 0; i -= 1) {
    const s = new Date(end)
    s.setDate(s.getDate() - i)
    s.setHours(0, 0, 0, 0)
    const e = new Date(s)
    e.setHours(23, 59, 59, 999)
    days.push({ start: s, end: e })
  }

  const settled = await Promise.allSettled(
    days.map((it) =>
      runWithRetry(
        (signal) =>
          listAdminOrders(
            {
              page: 1,
              pageSize: 1,
              startDate: toYmd(it.start),
              endDate: toYmd(it.end),
              startTime: it.start.toISOString(),
              endTime: it.end.toISOString(),
            },
            { timeout: API_TIMEOUT_MS, signal },
          ),
        { timeoutMs: API_TIMEOUT_MS, retries: 0 },
      ),
    ),
  )

  const trend = days.map((it, idx) => {
    const r = settled[idx]
    const orders = r.status === 'fulfilled' ? toNumber(r.value.total, 0) : 0
    return { date: toYmd(it.start), orders }
  })

  const sum = trend.reduce((s, x) => s + toNumber(x.orders, 0), 0)
  if (sum > 0) dashboard.value!.trend7d = trend
}

async function fetchAll() {
  if (pageLoading.value) return
  pageLoading.value = true
  pageError.value = ''

  try {
    const tasks = [fetchDashboardCore(), fetchHeatmap(), fetchTodayStatusDistribution(), fetchWeekProgress()] as const
    const settled = await Promise.allSettled(tasks)
    const dashFailed = settled[0].status === 'rejected'
    if (dashFailed) {
      pageError.value = dashboardError.value || '加载仪表盘失败'
      ElMessage.error(pageError.value)
    } else {
      await ensureTrendFallback()
      if (weekProgress.value) {
        const targetRaw = pickWeekTargetFromAny(dashboard.value?.raw)
        const target = clamp(toNumber(targetRaw, weekProgress.value.target || WEEK_TARGET_DEFAULT), 1, 999999)
        weekProgress.value = { ...weekProgress.value, target }
      }
    }

    lastUpdatedAt.value = Date.now()
    await nextTick()
    await ensureHeatmapMode()
    renderAll()
  } finally {
    pageLoading.value = false
  }
}

function renderAll() {
  renderHeatmapChart()
  renderTrendChart()
  renderStatusChart()
  renderRadarChart()
  renderProgressChart()
  resizeCharts()
}

function refresh() {
  fetchAll()
}

const lastUpdatedText = computed(() => {
  if (!lastUpdatedAt.value) return ''
  const d = new Date(lastUpdatedAt.value)
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
})

const runnerRankTop5 = computed(() => (dashboard.value?.runnerRank ?? []).slice(0, 5))

const topRunnerNameText = computed(() => {
  const top = runnerRankTop5.value[0]
  return top ? `第一名：${top.name}` : '—'
})

const radarHintText = computed(() => {
  const root = dashboard.value?.raw
  const hasExtra =
    pickNumberByKeys(root, ['onTimeRate', 'goodRate', 'creditScore', 'acceptSpeed', 'speedScore', 'punctualityRate']) !== null
  return hasExtra 
})

const weekProgressSubText = computed(() => {
  const target = toNumber(weekProgress.value?.target, 0)
  const c = toNumber(weekProgress.value?.completed, 0)
  if (target <= 0) return '本周目标未配置'
  return `已完成 ${c}/${target}`
})

const kpiCards = computed(() => {
  const d = dashboard.value
  const trend = d?.trend7d ?? []
  const last = trend.length ? trend[trend.length - 1] : null
  const prev = trend.length >= 2 ? trend[trend.length - 2] : null

  const ordersDelta = last && prev ? computeDeltaPct(last.orders, prev.orders) : null

  const raw = d?.raw
  const amountDelta = normalizePctTo100(pickNumberByKeys(raw, ['totalAmountMoM', 'total_amount_mom', 'gmvMoM', 'amountMoM']))
  const activeDelta = normalizePctTo100(pickNumberByKeys(raw, ['activeUsersMoM', 'active_users_mom', 'activeMoM']))

  return [
    { key: 'todayOrders', label: '今日订单数', valueText: d ? formatInt(d.todayOrders) : '—', deltaPct: ordersDelta },
    { key: 'totalAmount', label: '总交易额', valueText: d ? formatMoney(d.totalAmount) : '—', deltaPct: amountDelta },
    { key: 'activeUsers', label: '活跃用户数', valueText: d ? formatInt(d.activeUsers) : '—', deltaPct: activeDelta },
  ]
})

onMounted(() => {
  fetchAll()

  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => resizeCharts())
    if (gridEl.value) resizeObserver.observe(gridEl.value)
  } else {
    windowResizeHandler = () => resizeCharts()
    window.addEventListener('resize', windowResizeHandler)
  }
})

onUnmounted(() => {
  try {
    resizeObserver?.disconnect()
  } catch {}
  resizeObserver = null

  if (windowResizeHandler) {
    window.removeEventListener('resize', windowResizeHandler)
    windowResizeHandler = null
  }

  try {
    mapChart?.dispose()
  } catch {}
  mapChart = null

  destroyAmap()

  try {
    trendChart?.dispose()
  } catch {}
  trendChart = null

  try {
    statusChart?.dispose()
  } catch {}
  statusChart = null

  try {
    radarChart?.dispose()
  } catch {}
  radarChart = null

  try {
    progressChart?.dispose()
  } catch {}
  progressChart = null
})
</script>

<style scoped>
.ce-admin-dashboard {
  padding: 18px;
  min-height: calc(100vh - 24px);
  color: #303133;
  background: #f5f7fa;
  border-radius: 18px;
}

.ce-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
}

.ce-title {
  font-size: 18px;
  font-weight: 900;
  letter-spacing: 0.2px;
}

.ce-subtitle {
  font-size: 12px;
  color: #909399;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}

.ce-dot {
  opacity: 0.65;
}

.ce-muted {
  color: #909399;
}

.ce-strong {
  color: #303133;
  font-weight: 800;
}

.ce-danger {
  color: #f56c6c;
}

.ce-grid {
  display: grid;
  grid-template-columns: 3fr 4fr 3fr;
  grid-template-rows: 1fr 1fr 1fr;
  gap: 14px;
  height: max(760px, calc(100vh - 210px));
}

.ce-panel {
  position: relative;
  border-radius: 18px;
  border: 1px solid #e4e7ed;
  background: #ffffff;
  box-shadow:
    0 10px 30px rgba(0, 0, 0, 0.08),
    0 2px 8px rgba(0, 0, 0, 0.04);
  overflow: hidden;
}

.ce-panel-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 10px;
  padding: 14px 14px 0 14px;
}

.ce-panel-title {
  font-size: 13px;
  font-weight: 900;
  letter-spacing: 0.2px;
}

.ce-panel-sub {
  font-size: 12px;
  color: #909399;
}

.ce-panel-body {
  padding: 10px 12px 12px 12px;
  height: calc(100% - 44px);
}

.ce-panel-foot {
  padding: 0 14px 12px 14px;
  font-size: 12px;
}

.ce-chart {
  width: 100%;
  height: 100%;
  min-height: 190px;
}

.ce-map-chart {
  min-height: 560px;
}

.ce-map-canvas {
  width: 100%;
  height: 100%;
  min-height: 560px;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid #ebeef5;
}

.ce-overlay {
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: 12px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid rgba(245, 108, 108, 0.35);
  background: rgba(255, 255, 255, 0.92);
  font-size: 12px;
}

.ce-kpi-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  padding: 12px 12px 12px 12px;
}

.ce-kpi-card {
  border-radius: 14px;
  border: 1px solid #ebeef5;
  background: #ffffff;
  padding: 12px 12px 10px 12px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
}

.ce-kpi-label {
  font-size: 12px;
  color: #909399;
  font-weight: 650;
}

.ce-kpi-value {
  font-size: 20px;
  font-weight: 950;
  letter-spacing: 0.2px;
  margin-top: 6px;
  color: #303133;
}

.ce-kpi-delta {
  margin-top: 6px;
  font-size: 12px;
  font-weight: 750;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 8px;
  border-radius: 999px;
  border: 1px solid #ebeef5;
  background: #f5f7fa;
}

.ce-kpi-delta.is-up {
  color: #67c23a;
  border-color: rgba(103, 194, 58, 0.35);
}

.ce-kpi-delta.is-down {
  color: #f56c6c;
  border-color: rgba(245, 108, 108, 0.35);
}

.ce-kpi-delta.is-neutral {
  color: #909399;
}

.ce-kpi-arrow {
  font-weight: 900;
}

.ce-map {
  grid-column: 2 / 3;
  grid-row: 1 / 4;
}

.ce-kpi {
  grid-column: 1 / 2;
  grid-row: 1 / 2;
}

.ce-radar {
  grid-column: 1 / 2;
  grid-row: 2 / 3;
}

.ce-trend {
  grid-column: 1 / 2;
  grid-row: 3 / 4;
}

.ce-rank {
  grid-column: 3 / 4;
  grid-row: 1 / 2;
}

.ce-progress {
  grid-column: 3 / 4;
  grid-row: 2 / 3;
}

.ce-status {
  grid-column: 3 / 4;
  grid-row: 3 / 4;
}

.ce-rank-list {
  padding: 12px 12px 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ce-rank-row {
  border-radius: 14px;
  border: 1px solid #ebeef5;
  background: #ffffff;
  padding: 10px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.ce-rank-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.ce-rank-badge {
  width: 32px;
  height: 32px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
  border: 1px solid #ebeef5;
  font-size: 16px;
}

.ce-rank-name {
  font-weight: 850;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ce-rank-right {
  display: flex;
  gap: 12px;
  align-items: baseline;
}

.ce-rank-metric {
  display: flex;
  gap: 6px;
  align-items: baseline;
  font-size: 12px;
}

.ce-empty {
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px dashed #dcdfe6;
  background: #f5f7fa;
  text-align: center;
  font-size: 12px;
}

@media (max-width: 1200px) {
  .ce-grid {
    grid-template-columns: 1fr;
    grid-template-rows: auto;
    min-height: 0;
  }

  .ce-map,
  .ce-kpi,
  .ce-radar,
  .ce-trend,
  .ce-rank,
  .ce-progress,
  .ce-status {
    grid-column: auto;
    grid-row: auto;
  }

  .ce-map-chart {
    min-height: 520px;
  }

  .ce-map-canvas {
    min-height: 520px;
  }

  .ce-kpi-grid {
    grid-template-columns: 1fr;
  }
}
</style>
