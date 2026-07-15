<template>
  <div class="p-4 ce-credit">
    <div class="d-flex flex-wrap align-items-end justify-content-between gap-2 mb-3">
      <div>
        <h2 class="h4 mb-1">我的信用</h2>
        <div class="text-muted small">信用分、等级权益、趋势与明细</div>
      </div>
      <div class="d-flex gap-2">
        <el-button :loading="refreshing" @click="refresh">刷新</el-button>
      </div>
    </div>

    <div class="row g-3">
      <div class="col-12">
        <div class="card border-0 shadow-sm ce-score-card">
          <div class="card-body">
            <div class="d-flex flex-wrap align-items-end justify-content-between gap-3">
              <div class="ce-score-left">
                <div class="ce-score-number">{{ scoreText }}</div>
                <div class="d-flex flex-wrap align-items-center gap-2 mt-1">
                  <span class="ce-score-badge">{{ currentLevelName }}</span>
                  <span class="ce-score-sub">{{ nextNeedText }}</span>
                </div>
              </div>
              <div class="ce-score-right">
                <div class="ce-score-meta">
                  <div class="ce-score-meta-label">当前等级</div>
                  <div class="ce-score-meta-value">{{ currentLevelName }}</div>
                </div>
                <div class="ce-score-meta">
                  <div class="ce-score-meta-label">下一等级</div>
                  <div class="ce-score-meta-value">{{ nextLevelNameText }}</div>
                </div>
              </div>
            </div>

            <div class="mt-3">
              <el-progress :percentage="progressPct" :show-text="false" :stroke-width="10" :color="progressColor" />
              <div class="d-flex justify-content-between mt-2">
                <div class="ce-score-foot">{{ currentLevelRangeText }}</div>
                <div class="ce-score-foot">{{ nextLevelRangeText }}</div>
              </div>
            </div>

            <div v-if="scoreError" class="ce-score-error mt-3">{{ scoreError }}</div>
          </div>
        </div>
      </div>

      <div class="col-12 col-lg-6">
        <div class="card border-0 shadow-sm">
          <div class="card-body">
            <div class="fw-semibold mb-2">等级说明</div>
            <div class="vstack gap-2">
              <div
                v-for="lv in levelCards"
                :key="lv.key"
                class="ce-level-row"
                :class="{ 'is-active': lv.key === currentLevelKey }"
              >
                <div class="ce-level-head">
                  <div class="ce-level-name">{{ lv.name }}</div>
                  <div class="ce-level-range">{{ lv.rangeText }}</div>
                </div>
                <div class="ce-level-perks">
                  <span class="text-muted small">权益：</span>
                  <span class="small">{{ lv.perksText }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="col-12 col-lg-6">
        <div class="card border-0 shadow-sm">
          <div class="card-body">
            <div class="d-flex align-items-center justify-content-between mb-2">
              <div class="fw-semibold">近30天变化趋势</div>
              <div class="text-muted small">{{ trendSubText }}</div>
            </div>
            <div ref="trendEl" class="ce-chart" />
            <div v-if="trendError" class="text-danger small mt-2">{{ trendError }}</div>
          </div>
        </div>
      </div>

      <div class="col-12">
        <div class="card border-0 shadow-sm">
          <div class="card-body">
            <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
              <div class="fw-semibold">变动记录</div>
              <div class="text-muted small">按时间倒序展示</div>
            </div>

            <el-table :data="logRows" v-loading="logsLoading" stripe style="width: 100%">
              <el-table-column prop="timeText" label="时间" width="170" />
              <el-table-column prop="typeText" label="类型" width="120" />
              <el-table-column prop="delta" label="分值" width="110" align="right">
                <template #default="{ row }">
                  <span :class="deltaClass(row.delta)">{{ deltaText(row.delta) }}</span>
                </template>
              </el-table-column>
              <el-table-column prop="remark" label="说明" min-width="220" show-overflow-tooltip />
            </el-table>

            <div class="d-flex justify-content-end mt-3">
              <el-pagination
                v-model:current-page="pagination.page"
                v-model:page-size="pagination.pageSize"
                :total="pagination.total"
                :page-sizes="[10, 20, 50, 100]"
                layout="total, sizes, prev, pager, next, jumper"
                @current-change="fetchLogsPage"
                @size-change="handleLogsSizeChange"
              />
            </div>

            <div v-if="logsError" class="text-danger small mt-2">{{ logsError }}</div>
          </div>
        </div>
      </div>

      <div class="col-12">
        <div class="card border-0 shadow-sm">
          <div class="card-body">
            <div class="fw-semibold mb-2">规则说明</div>
            <div v-if="rulesLoading" class="text-muted small">加载中…</div>
            <div v-else-if="!ruleRows.length" class="text-muted small">暂无规则</div>
            <div v-else class="list-group list-group-flush">
              <div v-for="r in ruleRows" :key="r.key" class="list-group-item px-0">
                <div class="d-flex align-items-start justify-content-between gap-3">
                  <div>
                    <div class="fw-semibold">{{ r.title }}</div>
                    <div class="text-muted small mt-1">{{ r.desc }}</div>
                  </div>
                  <div class="ce-rule-score" :class="deltaClass(r.delta)">{{ deltaText(r.delta) }}</div>
                </div>
              </div>
            </div>
            <div v-if="rulesError" class="text-danger small mt-2">{{ rulesError }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import * as echarts from 'echarts'

import { http } from '@/api/request'

type CreditScoreState = {
  creditScore: number
  creditLevel: string
  nextLevelName: string
  needScore: number
}

type CreditLogViewRow = {
  id: string
  timeText: string
  typeText: string
  delta: number
  remark: string
}

type CreditRuleViewRow = {
  key: string
  title: string
  desc: string
  delta: number
}

type LevelKey = 'BRONZE' | 'SILVER' | 'GOLD' | 'DIAMOND'
type LevelCard = {
  key: LevelKey
  name: string
  min: number
  max: number | null
  perks: string[]
}

const LEVELS: LevelCard[] = [
  { key: 'BRONZE', name: '青铜', min: 0, max: 399, perks: ['基础信用保障', '正常接单'] },
  { key: 'SILVER', name: '白银', min: 400, max: 699, perks: ['更高可信度展示', '更高接单优先级'] },
  { key: 'GOLD', name: '黄金', min: 700, max: 849, perks: ['更高曝光', '更低风控校验频次'] },
  { key: 'DIAMOND', name: '钻石', min: 850, max: null, perks: ['最高等级标识', '优先服务支持'] },
]

const scoreState = ref<CreditScoreState>({
  creditScore: 0,
  creditLevel: '',
  nextLevelName: '',
  needScore: 0,
})

const scoreLoading = ref(false)
const scoreError = ref('')

const logsLoading = ref(false)
const logsError = ref('')
const pagination = ref({ page: 1, pageSize: 20, total: 0 })
const logRows = ref<CreditLogViewRow[]>([])

const rulesLoading = ref(false)
const rulesError = ref('')
const ruleRows = ref<CreditRuleViewRow[]>([])

const trendLoading = ref(false)
const trendError = ref('')
const trendEl = ref<HTMLDivElement | null>(null)
const trendSeries = ref<{ labels: string[]; values: number[] }>({ labels: [], values: [] })
let trendChart: echarts.ECharts | null = null
let resizeObserver: ResizeObserver | null = null
let windowResizeHandler: (() => void) | null = null

const refreshing = computed(() => scoreLoading.value || logsLoading.value || rulesLoading.value || trendLoading.value)

function toNumber(v: unknown, fallback = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function normalizeText(v: unknown) {
  return String(v ?? '').trim()
}

function normalizeRoot(payload: any) {
  return payload?.data ?? payload ?? {}
}

function getErrorMessage(err: any, fallback: string) {
  return (
    err?.response?.data?.message ||
    err?.response?.data?.msg ||
    err?.response?.data?.error ||
    err?.message ||
    fallback
  )
}

function clamp(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min
  return Math.max(min, Math.min(max, n))
}

function upperKey(v: unknown) {
  return normalizeText(v).toUpperCase()
}

function normalizeLevelKey(levelRaw: unknown, score: number): LevelKey {
  const s = upperKey(levelRaw)
  const fromKey = (['BRONZE', 'SILVER', 'GOLD', 'DIAMOND'] as const).find((k) => k === s)
  if (fromKey) return fromKey
  const n = toNumber(score, 0)
  const hit = LEVELS.find((lv) => n >= lv.min && (lv.max === null ? true : n <= lv.max))
  return (hit?.key ?? 'BRONZE') as LevelKey
}

function formatDateTime(dateStr?: string) {
  const raw = normalizeText(dateStr)
  if (!raw) return '-'
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw
  try {
    return d.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  } catch {
    return raw
  }
}

function toDayKey(dateStr?: string) {
  const raw = normalizeText(dateStr)
  if (!raw) return ''
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function lastNDays(n: number) {
  const days: string[] = []
  const base = new Date()
  base.setHours(0, 0, 0, 0)
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(base)
    d.setDate(d.getDate() - i)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    days.push(`${y}-${m}-${dd}`)
  }
  return days
}

function formatShortDateLabel(dateRaw: string) {
  const m = dateRaw.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return dateRaw
  return `${m[2]}/${m[3]}`
}

function pickList(raw: any) {
  const root = normalizeRoot(raw)
  const list =
    root?.list ??
    root?.rows ??
    root?.items ??
    root?.records ??
    root?.result ??
    root?.data ??
    root?.logs ??
    root?.rules ??
    root
  return Array.isArray(list) ? list : []
}

function pickTotal(raw: any, fallback: number) {
  const root = normalizeRoot(raw)
  const total = root?.total ?? root?.count ?? root?.totalCount ?? root?.pagination?.total ?? root?.page?.total
  const n = toNumber(total, NaN)
  return Number.isFinite(n) ? n : fallback
}

function pickCreditDelta(row: any) {
  const direct = toNumber(row?.delta ?? row?.change ?? row?.points ?? row?.score ?? row?.value, NaN)
  if (Number.isFinite(direct)) return direct
  const before = toNumber(row?.before_score ?? row?.beforeScore ?? row?.before, NaN)
  const after = toNumber(row?.after_score ?? row?.afterScore ?? row?.after, NaN)
  if (Number.isFinite(before) && Number.isFinite(after)) return after - before
  return 0
}

function typeText(typeRaw: unknown) {
  const s = upperKey(typeRaw)
  const map: Record<string, string> = {
    ADD: '加分',
    PLUS: '加分',
    INC: '加分',
    INCREASE: '加分',
    SUB: '减分',
    MINUS: '减分',
    DEC: '减分',
    DECREASE: '减分',
  }
  return map[s] || (s ? s : '-')
}

function deltaText(delta: number) {
  const v = toNumber(delta, 0)
  const sign = v > 0 ? '+' : ''
  return `${sign}${Math.round(v)}`
}

function deltaClass(delta: number) {
  const v = toNumber(delta, 0)
  if (v > 0) return 'text-success'
  if (v < 0) return 'text-danger'
  return 'text-muted'
}

const currentLevelKey = computed<LevelKey>(() => normalizeLevelKey(scoreState.value.creditLevel, scoreState.value.creditScore))

const currentLevelName = computed(() => LEVELS.find((x) => x.key === currentLevelKey.value)?.name || '青铜')

const scoreText = computed(() => String(Math.max(0, Math.round(toNumber(scoreState.value.creditScore, 0)))))

const nextLevelNameText = computed(() => normalizeText(scoreState.value.nextLevelName) || (currentLevelKey.value === 'DIAMOND' ? '—' : '下一等级'))

const nextNeedText = computed(() => {
  const need = Math.max(0, Math.round(toNumber(scoreState.value.needScore, 0)))
  if (!need) return '已达最高等级'
  const nl = nextLevelNameText.value
  return `距 ${nl} 还需 ${need} 分`
})

const levelCards = computed(() => {
  return LEVELS.map((lv) => {
    const maxText = lv.max === null ? '∞' : String(lv.max)
    const rangeText = `${lv.min}-${maxText}`
    const perksText = lv.perks.join(' · ')
    return { key: lv.key, name: lv.name, rangeText, perksText }
  })
})

const progressPct = computed(() => {
  const score = toNumber(scoreState.value.creditScore, 0)
  const lv = LEVELS.find((x) => x.key === currentLevelKey.value) ?? LEVELS[0]
  const max = lv.max === null ? score : lv.max
  const denom = Math.max(1, max - lv.min)
  const pct = ((score - lv.min) / denom) * 100
  return Math.round(clamp(pct, 0, 100))
})

const progressColor = computed(() => {
  const key = currentLevelKey.value
  if (key === 'DIAMOND') return '#ffffff'
  if (key === 'GOLD') return '#ffffff'
  if (key === 'SILVER') return '#ffffff'
  return '#ffffff'
})

const currentLevelRangeText = computed(() => {
  const lv = LEVELS.find((x) => x.key === currentLevelKey.value) ?? LEVELS[0]
  const maxText = lv.max === null ? '∞' : String(lv.max)
  return `本级范围：${lv.min}-${maxText}`
})

const nextLevelRangeText = computed(() => {
  const idx = LEVELS.findIndex((x) => x.key === currentLevelKey.value)
  const next = idx >= 0 ? LEVELS[idx + 1] : null
  if (!next) return '下一等级：—'
  const maxText = next.max === null ? '∞' : String(next.max)
  return `下一等级：${next.min}-${maxText}`
})

const trendSubText = computed(() => {
  if (trendLoading.value) return '加载中…'
  const v = trendSeries.value.values
  if (!v.length) return '暂无数据'
  const first = v[0]
  const last = v[v.length - 1]
  const delta = Math.round(last - first)
  const sign = delta > 0 ? '+' : ''
  return `30天变化 ${sign}${delta}`
})

function ensureChart(el: HTMLDivElement | null, current: echarts.ECharts | null) {
  if (!el) return null
  if (current && !current.isDisposed()) return current
  try {
    return echarts.init(el)
  } catch {
    return null
  }
}

function setEmptyChart(chart: echarts.ECharts, text: string) {
  chart.setOption(
    {
      backgroundColor: 'transparent',
      title: {
        text,
        left: 'center',
        top: 'middle',
        textStyle: { color: '#909399', fontSize: 12, fontWeight: 600 },
      },
      xAxis: { show: false, type: 'category', data: [] },
      yAxis: { show: false, type: 'value' },
      series: [],
    },
    true,
  )
}

function renderTrendChart() {
  trendChart = ensureChart(trendEl.value, trendChart)
  if (!trendChart) return

  const labels = trendSeries.value.labels
  const values = trendSeries.value.values
  if (!labels.length || !values.length) {
    setEmptyChart(trendChart, '暂无趋势数据')
    return
  }

  const max = Math.max(1, ...values.map((x) => toNumber(x, 0)))
  const min = Math.min(...values.map((x) => toNumber(x, 0)))

  trendChart.setOption(
    {
      backgroundColor: 'transparent',
      grid: { left: 12, right: 12, top: 34, bottom: 10, containLabel: true },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#ffffff',
        borderColor: '#ebeef5',
        borderWidth: 1,
        textStyle: { color: '#303133', fontSize: 12 },
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: labels.map((d) => formatShortDateLabel(d)),
        axisLine: { lineStyle: { color: '#e4e7ed' } },
        axisTick: { show: false },
        axisLabel: { color: '#909399', fontSize: 11 },
      },
      yAxis: {
        type: 'value',
        min: Math.floor(min - 5),
        max: Math.ceil(max + 5),
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: '#f2f6fc' } },
        axisLabel: { color: '#909399', fontSize: 11 },
      },
      series: [
        {
          type: 'line',
          data: values.map((x) => Math.round(toNumber(x, 0))),
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 3, color: '#409eff' },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(64,158,255,0.35)' },
              { offset: 1, color: 'rgba(64,158,255,0.04)' },
            ]),
          },
        },
      ],
    },
    true,
  )
}

function resizeTrendChart() {
  try {
    trendChart?.resize()
  } catch {}
}

function bindResize() {
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => resizeTrendChart())
    if (trendEl.value) resizeObserver.observe(trendEl.value)
    return
  }
  windowResizeHandler = () => resizeTrendChart()
  window.addEventListener('resize', windowResizeHandler)
}

function unbindResize() {
  try {
    resizeObserver?.disconnect()
  } catch {}
  resizeObserver = null
  if (windowResizeHandler) {
    window.removeEventListener('resize', windowResizeHandler)
    windowResizeHandler = null
  }
}

async function fetchScore() {
  scoreError.value = ''
  scoreLoading.value = true
  try {
    const resp = await http.get('/credit/score')
    const root = normalizeRoot(resp.data)
    scoreState.value = {
      creditScore: toNumber(root?.credit_score ?? root?.creditScore ?? root?.score, 0),
      creditLevel: normalizeText(root?.credit_level ?? root?.creditLevel ?? root?.level),
      nextLevelName: normalizeText(root?.next_level_name ?? root?.nextLevelName ?? root?.nextLevel),
      needScore: toNumber(root?.need_score ?? root?.needScore ?? root?.need, 0),
    }
  } catch (err: any) {
    scoreError.value = getErrorMessage(err, '加载信用分失败')
  } finally {
    scoreLoading.value = false
  }
}

async function fetchRules() {
  rulesError.value = ''
  rulesLoading.value = true
  try {
    const resp = await http.get('/credit/rules')
    const list = pickList(resp.data)
    ruleRows.value = list.map((it: any, idx: number) => {
      const title = normalizeText(it?.title ?? it?.name ?? it?.rule ?? it?.typeText ?? it?.type) || `规则 ${idx + 1}`
      const delta = toNumber(it?.delta ?? it?.score ?? it?.points ?? it?.value, 0)
      const desc = normalizeText(it?.desc ?? it?.description ?? it?.remark ?? it?.note) || '—'
      const key = normalizeText(it?.id ?? it?.key) || `${idx}`
      return { key, title, desc, delta }
    })
  } catch (err: any) {
    rulesError.value = getErrorMessage(err, '加载规则失败')
    ruleRows.value = []
  } finally {
    rulesLoading.value = false
  }
}

async function fetchLogsPage() {
  logsError.value = ''
  logsLoading.value = true
  try {
    const params: any = {
      page: pagination.value.page,
      pageSize: pagination.value.pageSize,
      page_size: pagination.value.pageSize,
    }
    const resp = await http.get('/credit/logs', { params })
    const list = pickList(resp.data)
    const total = pickTotal(resp.data, list.length)
    pagination.value.total = total
    logRows.value = list.map((it: any, idx: number) => {
      const timeRaw = normalizeText(it?.created_at ?? it?.createdAt ?? it?.time ?? it?.date)
      const delta = pickCreditDelta(it)
      const typeRaw = it?.type ?? it?.change_type ?? it?.action ?? it?.category
      const remark = normalizeText(it?.remark ?? it?.desc ?? it?.description ?? it?.reason ?? it?.note) || '—'
      const id = normalizeText(it?.id ?? it?.log_id ?? it?.logId) || `${pagination.value.page}-${idx}`
      return { id, timeText: formatDateTime(timeRaw), typeText: typeText(typeRaw), delta, remark }
    })
  } catch (err: any) {
    logsError.value = getErrorMessage(err, '加载变动记录失败')
    logRows.value = []
    pagination.value.total = 0
  } finally {
    logsLoading.value = false
  }
}

function handleLogsSizeChange(size: number) {
  pagination.value.pageSize = size
  pagination.value.page = 1
  fetchLogsPage()
}

async function fetchTrend() {
  trendError.value = ''
  trendLoading.value = true
  try {
    const params: any = { page: 1, pageSize: 500, page_size: 500 }
    const resp = await http.get('/credit/logs', { params })
    const list = pickList(resp.data)
    const days = lastNDays(30)
    const daySet = new Set(days)
    const dailyDelta = new Map<string, number>()
    for (const it of list) {
      const timeRaw = normalizeText(it?.created_at ?? it?.createdAt ?? it?.time ?? it?.date)
      const key = toDayKey(timeRaw)
      if (!key || !daySet.has(key)) continue
      const delta = pickCreditDelta(it)
      dailyDelta.set(key, toNumber(dailyDelta.get(key), 0) + toNumber(delta, 0))
    }
    const deltasInRange = days.map((d) => toNumber(dailyDelta.get(d), 0))
    const totalDelta = deltasInRange.reduce((acc, v) => acc + toNumber(v, 0), 0)
    let running = toNumber(scoreState.value.creditScore, 0) - totalDelta
    const values: number[] = []
    for (const day of days) {
      running += toNumber(dailyDelta.get(day), 0)
      values.push(running)
    }
    trendSeries.value = { labels: days, values }
    await nextTick()
    renderTrendChart()
  } catch (err: any) {
    trendError.value = getErrorMessage(err, '加载趋势失败')
    trendSeries.value = { labels: [], values: [] }
    await nextTick()
    if (trendChart) setEmptyChart(trendChart, '暂无趋势数据')
  } finally {
    trendLoading.value = false
  }
}

async function refresh() {
  await fetchScore()
  await Promise.all([fetchRules(), fetchLogsPage(), fetchTrend()])
  if (!scoreError.value && !logsError.value && !rulesError.value && !trendError.value) {
    ElMessage.success('已刷新')
  }
}

onMounted(async () => {
  await nextTick()
  bindResize()
  await refresh()
})

onUnmounted(() => {
  unbindResize()
  try {
    trendChart?.dispose()
  } catch {}
  trendChart = null
})
</script>

<style scoped>
.ce-score-card {
  background: linear-gradient(135deg, #409eff 0%, #8b5cf6 55%, #67c23a 140%);
  color: #ffffff;
  overflow: hidden;
}

.ce-score-left {
  min-width: 220px;
}

.ce-score-number {
  font-size: 46px;
  font-weight: 900;
  line-height: 1;
  letter-spacing: 0.2px;
}

.ce-score-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 999px;
  font-weight: 700;
  font-size: 12px;
  background: rgba(255, 255, 255, 0.18);
  border: 1px solid rgba(255, 255, 255, 0.28);
}

.ce-score-sub {
  font-size: 12px;
  opacity: 0.9;
}

.ce-score-right {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px 14px;
  min-width: 220px;
}

.ce-score-meta-label {
  font-size: 12px;
  opacity: 0.85;
}

.ce-score-meta-value {
  font-size: 14px;
  font-weight: 800;
}

.ce-score-foot {
  font-size: 12px;
  opacity: 0.9;
}

.ce-score-error {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.92);
  background: rgba(0, 0, 0, 0.18);
  padding: 8px 10px;
  border-radius: 10px;
}

.ce-level-row {
  border: 1px solid #ebeef5;
  border-radius: 12px;
  padding: 12px;
  background: #ffffff;
}

.ce-level-row.is-active {
  border-color: rgba(64, 158, 255, 0.55);
  box-shadow: 0 10px 20px rgba(64, 158, 255, 0.12);
}

.ce-level-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}

.ce-level-name {
  font-weight: 900;
  color: #303133;
}

.ce-level-range {
  font-size: 12px;
  color: #909399;
  font-weight: 600;
}

.ce-level-perks {
  margin-top: 6px;
  color: #303133;
}

.ce-chart {
  height: 260px;
  width: 100%;
}

.ce-rule-score {
  font-weight: 900;
  min-width: 64px;
  text-align: right;
}

:deep(.el-progress-bar__outer) {
  background: rgba(255, 255, 255, 0.28);
}

:deep(.el-progress-bar__inner) {
  border-radius: 999px;
}

:deep(.el-table th) {
  background-color: #f8fafc;
  font-weight: 600;
  color: #1e293b;
}

.text-success {
  color: #67c23a;
  font-weight: 700;
}

.text-danger {
  color: #f56c6c;
  font-weight: 700;
}

.text-muted {
  color: #909399;
}
</style>
