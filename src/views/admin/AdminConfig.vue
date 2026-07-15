<template>
  <div class="p-4">
    <div class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
      <div>
        <h2 class="h4 mb-1">系统配置</h2>
      
      </div>
      <div class="d-flex gap-2 flex-wrap">
        <el-button :icon="RefreshRight" :loading="loading" @click="loadConfig">刷新</el-button>
      </div>
    </div>

    <div v-if="errorMessage" class="alert alert-danger">{{ errorMessage }}</div>

    <div class="d-flex flex-wrap gap-2 mt-2">
      <button
        class="btn btn-sm"
        :class="activeTab === 'config' ? 'btn-primary' : 'btn-outline-primary'"
        type="button"
        @click="activeTab = 'config'"
      >
        系统配置
      </button>
      <button
        class="btn btn-sm"
        :class="activeTab === 'pricing' ? 'btn-primary' : 'btn-outline-primary'"
        type="button"
        @click="activeTab = 'pricing'"
      >
        定价管理
      </button>
    </div>

    <div v-if="activeTab === 'config'" class="vstack gap-3 mt-3">
      <el-card v-for="g in groups" :key="g.key" shadow="never" class="border" v-loading="loading" :header="g.label">
        <el-form label-width="160px" class="mb-0">
          <el-form-item v-for="it in g.items" :key="it.key" :label="it.label">
            <div class="d-flex flex-wrap align-items-center gap-2" style="width: 100%">
              <el-input-number
                v-model="formValues[it.key]"
                :min="it.min ?? 0"
                :precision="it.precision ?? 0"
                :step="it.step ?? 1"
              ></el-input-number>
              <span v-if="it.unit" class="text-muted small">{{ it.unit }}</span>
              <div class="ms-auto d-flex align-items-center gap-2">
                <el-button type="primary" size="small" :loading="savingKey === it.key" @click="saveOne(it.key)">
                  保存
                </el-button>
              </div>
            </div>
          </el-form-item>
        </el-form>
      </el-card>

      <el-card shadow="never" class="border" v-loading="loading" header="其他配置项">
        <el-table :data="otherConfigRows" stripe style="width: 100%">
          <el-table-column prop="key" label="Key" width="280"></el-table-column>
          <el-table-column prop="value" label="Value">
            <template #default="{ row }">
              <span class="text-muted small">{{ row.value }}</span>
            </template>
          </el-table-column>
        </el-table>
      </el-card>
    </div>

    <div v-else class="vstack gap-3 mt-3">
      <el-card shadow="never" class="border" v-loading="loading" header="当前定价规则">
        <div class="d-flex flex-wrap align-items-center gap-3">
          <div class="d-flex align-items-center gap-2">
            <span class="text-muted">模式</span>
            <el-tag :type="aiPricingEnabled ? 'success' : 'info'">
              {{ aiPricingEnabled ? 'AI 模式' : '固定规则' }}
            </el-tag>
          </div>

          <div class="d-flex align-items-center gap-2">
            <span class="text-muted">开启 AI 定价</span>
            <el-switch
              v-model="aiPricingEnabledDraft"
              :disabled="savingAiEnabled"
              inline-prompt
              active-text="开启"
              inactive-text="关闭"
              @change="saveAiEnabled"
            ></el-switch>
          </div>

          <div class="d-flex align-items-center gap-2">
            <span class="text-muted">允许用户微调</span>
            <el-switch
              v-model="allowUserAdjustDraft"
              :disabled="savingAllowAdjust"
              inline-prompt
              active-text="允许"
              inactive-text="禁止"
              @change="saveAllowUserAdjust"
            ></el-switch>
          </div>
        </div>
      </el-card>

      <el-card shadow="never" class="border">
        <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
          <div class="fw-semibold">AI 推荐参数</div>
          <div class="d-flex gap-2 flex-wrap">
            <el-button :loading="recommendationLoading" @click="loadPricingRecommendation">获取推荐</el-button>
            <el-button
              type="primary"
              :loading="applyingRecommendation"
              :disabled="!pricingRecommendation"
              @click="applyRecommendation"
            >
              应用推荐
            </el-button>
          </div>
        </div>

        <el-alert
          v-if="recommendationError"
          class="mb-2"
          type="warning"
          show-icon
          :closable="false"
          :title="recommendationError"
        ></el-alert>

        <el-table :data="pricingCompareRows" stripe style="width: 100%">
          <el-table-column prop="label" label="参数" width="160"></el-table-column>
          <el-table-column prop="currentText" label="当前" width="180"></el-table-column>
          <el-table-column prop="recommendText" label="AI 推荐" width="180"></el-table-column>
        </el-table>
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watchEffect } from 'vue'
import { ElMessage } from 'element-plus'
import { RefreshRight } from '@element-plus/icons-vue'

import { http } from '@/api/request'
import { getAdminConfig, updateAdminConfig, type AdminConfigResponse } from '@/api/admin'

type ConfigItem = {
  key: string
  label: string
  unit?: string
  precision?: number
  step?: number
  min?: number
  max?: number
  aliases?: string[]
}

type ConfigGroup = {
  key: string
  label: string
  items: ConfigItem[]
}

const groups = ref<ConfigGroup[]>([
  {
    key: 'fee',
    label: '费用规则',
    items: [
      { key: 'base_delivery_fee', label: '基础配送费', unit: '元', precision: 2, step: 0.5, min: 0 },
      { key: 'distance_price_per_km', label: '每公里单价', unit: '元/km', precision: 2, step: 0.5, min: 0 },
      { key: 'urgent_fee', label: '加急费', unit: '元', precision: 2, step: 0.5, min: 0 },
      { key: 'cancel_penalty_rate', label: '取消违约金比例', unit: '%', precision: 0, step: 5, min: 0, max: 100 },
    ],
  },
  {
    key: 'timeout',
    label: '超时规则',
    items: [
      { key: 'pending_accept_minutes', label: '待接单超时', unit: '分钟', precision: 0, step: 1, min: 0 },
      { key: 'no_pickup_minutes', label: '已接单未取件超时', unit: '分钟', precision: 0, step: 1, min: 0 },
      { key: 'delivering_minutes', label: '配送中超时', unit: '分钟', precision: 0, step: 1, min: 0 },
    ],
  },
  {
    key: 'grab',
    label: '抢单限制',
    items: [
      { key: 'grab_interval_seconds', label: '同一用户抢单间隔', unit: '秒', precision: 0, step: 1, min: 0 },
      { key: 'daily_cancel_limit', label: '每日取消上限', unit: '次', precision: 0, step: 1, min: 0 },
    ],
  },
  {
    key: 'auto',
    label: '自动确认规则',
    items: [
      { key: 'auto_confirm_minutes', label: '用户自动确认完成', unit: '分钟', precision: 0, step: 1, min: 0 },
    ],
  },
])

const loading = ref(false)
const errorMessage = ref('')
const savingKey = ref<string>('')
const activeTab = ref<'config' | 'pricing'>('config')

const rawConfig = ref<Record<string, any>>({})
const flatConfig = ref<Record<string, any>>({})

const formValues = ref<Record<string, number>>({})
const boundKey = ref<Record<string, string>>({})

function getErrorMessage(err: any) {
  return (
    err?.response?.data?.message ||
    err?.response?.data?.msg ||
    err?.message ||
    '请求失败'
  )
}

function normalizeNumber(v: any, fallback = 0) {
  if (v === undefined || v === null) return fallback
  if (typeof v === 'string' && v.trim() === '') return fallback
  const n = typeof v === 'number' ? v : Number(String(v ?? '').trim())
  return Number.isFinite(n) ? n : fallback
}

function normalizeBool(v: any, fallback = false) {
  if (typeof v === 'boolean') return v
  const s = String(v ?? '').trim().toLowerCase()
  if (['1', 'true', 'yes', 'y', 'on', 'enabled'].includes(s)) return true
  if (['0', 'false', 'no', 'n', 'off', 'disabled'].includes(s)) return false
  const n = Number(s)
  if (Number.isFinite(n)) return n !== 0
  return fallback
}

function flattenObject(input: any, prefix = '', out: Record<string, any> = {}) {
  if (!input || typeof input !== 'object') return out
  const entries = Array.isArray(input) ? input.entries() : Object.entries(input)
  for (const e of entries as any) {
    const k = Array.isArray(input) ? String(e[0]) : String(e[0])
    const v = Array.isArray(input) ? e[1] : (e as any)[1]
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      flattenObject(v, key, out)
    } else {
      out[key] = v
    }
  }
  return out
}

// ========== 只需要修改这个函数 ==========
function normalizeConfigResponse(res: AdminConfigResponse): Record<string, any> {
  // 处理 { items: [...] } 格式
  let dataArray: any[] = []
  if (res && typeof res === 'object') {
    if (Array.isArray(res)) {
      dataArray = res
    } else if ('items' in res && Array.isArray((res as any).items)) {
      dataArray = (res as any).items
    } else if ('data' in res && Array.isArray((res as any).data)) {
      dataArray = (res as any).data
    }
  }
  
  const map: Record<string, any> = {}
  dataArray.forEach((it) => {
    const k = String(it?.key ?? it?.name ?? '').trim()
    if (!k) return
    map[k] = it?.value
  })
  return map
}
// =====================================

function pickBoundKey(item: ConfigItem, flat: Record<string, any>) {
  const candidates = [item.key, ...(item.aliases ?? [])]
  const found = candidates.find((k) => Object.prototype.hasOwnProperty.call(flat, k))
  return found || item.key
}

function initFormFromConfig(flat: Record<string, any>) {
  const nextValues: Record<string, number> = {}
  const nextBound: Record<string, string> = {}
  for (const g of groups.value) {
    for (const it of g.items) {
      const bk = pickBoundKey(it, flat)
      nextBound[it.key] = bk
      nextValues[it.key] = normalizeNumber(flat[bk], 0)
    }
  }
  formValues.value = nextValues
  boundKey.value = nextBound
}

const usedKeys = computed(() => {
  const set = new Set<string>()
  for (const g of groups.value) {
    for (const it of g.items) {
      set.add(boundKey.value[it.key] || it.key)
    }
  }
  return set
})

const otherConfigRows = computed(() => {
  const rows = Object.entries(flatConfig.value)
    .filter(([k]) => !usedKeys.value.has(k))
    .map(([k, v]) => ({
      key: k,
      value: typeof v === 'string' ? v : JSON.stringify(v),
    }))
    .sort((a, b) => a.key.localeCompare(b.key))
  return rows
})

async function loadConfig() {
  loading.value = true
  errorMessage.value = ''
  try {
    const res = await getAdminConfig()
    const map = normalizeConfigResponse(res)
    rawConfig.value = map
    flatConfig.value = flattenObject(map, '', {})
    initFormFromConfig(flatConfig.value)
  } catch (err: any) {
    errorMessage.value = getErrorMessage(err) || '加载配置失败'
  } finally {
    loading.value = false
  }
}

async function saveOne(itemKey: string) {
  if (savingKey.value) return
  const value = formValues.value[itemKey]
  const bk = boundKey.value[itemKey] || itemKey
  savingKey.value = itemKey
  try {
    await updateAdminConfig(bk, value)
    ElMessage.success('保存成功，已实时生效')
    flatConfig.value = { ...flatConfig.value, [bk]: value }
  } catch (err: any) {
    ElMessage.error(getErrorMessage(err))
  } finally {
    savingKey.value = ''
  }
}

function pickFlatValue(flat: Record<string, any>, candidates: string[]) {
  for (const k of candidates) {
    if (Object.prototype.hasOwnProperty.call(flat, k)) return flat[k]
  }
  return undefined
}

const aiPricingEnabled = computed(() => {
  const raw = pickFlatValue(flatConfig.value, ['ai_pricing_enabled', 'aiPricingEnabled', 'pricing.ai_pricing_enabled'])
  return normalizeBool(raw, false)
})

const allowUserAdjust = computed(() => {
  const raw = pickFlatValue(flatConfig.value, [
    'allow_user_price_adjust',
    'allowUserPriceAdjust',
    'pricing.allow_user_price_adjust',
  ])
  return normalizeBool(raw, false)
})

const aiPricingEnabledDraft = ref(false)
const allowUserAdjustDraft = ref(false)
const savingAiEnabled = ref(false)
const savingAllowAdjust = ref(false)

watchEffect(() => {
  aiPricingEnabledDraft.value = aiPricingEnabled.value
  allowUserAdjustDraft.value = allowUserAdjust.value
})

async function saveAiEnabled() {
  if (savingAiEnabled.value) return
  savingAiEnabled.value = true
  try {
    await updateAdminConfig('ai_pricing_enabled', aiPricingEnabledDraft.value ? 1 : 0)
    flatConfig.value = { ...flatConfig.value, ai_pricing_enabled: aiPricingEnabledDraft.value ? 1 : 0 }
    ElMessage.success('已更新 AI 定价开关')
  } catch (err: any) {
    ElMessage.error(getErrorMessage(err))
    aiPricingEnabledDraft.value = aiPricingEnabled.value
  } finally {
    savingAiEnabled.value = false
  }
}

async function saveAllowUserAdjust() {
  if (savingAllowAdjust.value) return
  savingAllowAdjust.value = true
  try {
    await updateAdminConfig('allow_user_price_adjust', allowUserAdjustDraft.value ? 1 : 0)
    flatConfig.value = { ...flatConfig.value, allow_user_price_adjust: allowUserAdjustDraft.value ? 1 : 0 }
    ElMessage.success('已更新用户微调权限')
  } catch (err: any) {
    ElMessage.error(getErrorMessage(err))
    allowUserAdjustDraft.value = allowUserAdjust.value
  } finally {
    savingAllowAdjust.value = false
  }
}

type PricingRecommendation = {
  base_fee: number
  distance_unit_price: number
  time_surcharge_factor: number
  weather_surcharge_factor: number
}

const pricingRecommendation = ref<PricingRecommendation | null>(null)
const recommendationLoading = ref(false)
const recommendationError = ref('')
const applyingRecommendation = ref(false)

function normalizeRecommendationPayload(data: any): PricingRecommendation | null {
  const flat = flattenObject(data, '', {})
  const base_fee = normalizeNumber(
    pickFlatValue(flat, [
      'base_fee',
      'baseFee',
      'data.base_fee',
      'data.baseFee',
      'result.base_fee',
      'result.baseFee',
      'recommendation.base_fee',
      'recommendation.baseFee',
      'pricing.base_fee',
      'pricing.baseFee',
      'base_delivery_fee',
      'baseDeliveryFee',
      'data.base_delivery_fee',
      'data.baseDeliveryFee',
      'result.base_delivery_fee',
      'result.baseDeliveryFee',
      'recommendation.base_delivery_fee',
      'recommendation.baseDeliveryFee',
      'pricing.base_delivery_fee',
      'pricing.baseDeliveryFee',
    ]),
    NaN,
  )
  const distance_unit_price = normalizeNumber(
    pickFlatValue(flat, [
      'distance_unit_price',
      'distanceUnitPrice',
      'data.distance_unit_price',
      'data.distanceUnitPrice',
      'result.distance_unit_price',
      'result.distanceUnitPrice',
      'recommendation.distance_unit_price',
      'recommendation.distanceUnitPrice',
      'pricing.distance_unit_price',
      'pricing.distanceUnitPrice',
      'distance_price_per_km',
      'distancePricePerKm',
      'data.distance_price_per_km',
      'data.distancePricePerKm',
      'result.distance_price_per_km',
      'result.distancePricePerKm',
      'recommendation.distance_price_per_km',
      'recommendation.distancePricePerKm',
      'pricing.distance_price_per_km',
      'pricing.distancePricePerKm',
    ]),
    NaN,
  )
  const time_surcharge_factor = normalizeNumber(
    pickFlatValue(flat, [
      'time_surcharge_factor',
      'timeFactor',
      'time_factor',
      'data.time_surcharge_factor',
      'data.timeFactor',
      'data.time_factor',
      'result.time_surcharge_factor',
      'result.timeFactor',
      'result.time_factor',
      'recommendation.time_surcharge_factor',
      'recommendation.timeFactor',
      'recommendation.time_factor',
      'pricing.time_surcharge_factor',
      'pricing.timeFactor',
      'pricing.time_factor',
    ]),
    NaN,
  )
  const weather_surcharge_factor = normalizeNumber(
    pickFlatValue(flat, [
      'weather_surcharge_factor',
      'weatherFactor',
      'weather_factor',
      'data.weather_surcharge_factor',
      'data.weatherFactor',
      'data.weather_factor',
      'result.weather_surcharge_factor',
      'result.weatherFactor',
      'result.weather_factor',
      'recommendation.weather_surcharge_factor',
      'recommendation.weatherFactor',
      'recommendation.weather_factor',
      'pricing.weather_surcharge_factor',
      'pricing.weatherFactor',
      'pricing.weather_factor',
    ]),
    NaN,
  )
  if (!Number.isFinite(base_fee) || !Number.isFinite(distance_unit_price)) return null
  return {
    base_fee,
    distance_unit_price,
    time_surcharge_factor: Number.isFinite(time_surcharge_factor) ? time_surcharge_factor : 1,
    weather_surcharge_factor: Number.isFinite(weather_surcharge_factor) ? weather_surcharge_factor : 1,
  }
}

async function loadPricingRecommendation() {
  if (recommendationLoading.value) return
  recommendationLoading.value = true
  recommendationError.value = ''
  try {
    const res = await http.get('/admin/pricing/recommend')
    console.log('AI推荐数据:', res)
    const rawRes = res as any
    // ✅ 修改这里：直接从 rawRes 取，不需要 .recommend
    const normalized = normalizeRecommendationPayload(rawRes)
    if (!normalized) {
      throw new Error('推荐参数解析失败：未找到 base_fee 或 distance_unit_price')
    }
    pricingRecommendation.value = normalized
    recommendationError.value = ''
  } catch (err: any) {
    pricingRecommendation.value = null
    recommendationError.value = getErrorMessage(err) || '获取推荐失败'
  } finally {
    recommendationLoading.value = false
  }
}

function formatMaybeNumber(v: any, precision = 2) {
  const n = normalizeNumber(v, NaN)
  if (!Number.isFinite(n)) return '—'
  return n.toFixed(precision)
}

const pricingCompareRows = computed(() => {
  const currentBase = pickFlatValue(flatConfig.value, ['base_delivery_fee', 'fee.base_delivery_fee'])
  const currentDistance = pickFlatValue(flatConfig.value, ['distance_price_per_km', 'fee.distance_price_per_km'])
  const currentTime = pickFlatValue(flatConfig.value, ['time_surcharge_factor', 'pricing.time_surcharge_factor'])
  const currentWeather = pickFlatValue(flatConfig.value, ['weather_surcharge_factor', 'pricing.weather_surcharge_factor'])

  return [
    {
      key: 'base_fee',
      label: '基础费（元）',
      currentText: formatMaybeNumber(currentBase, 2),
      recommendText: pricingRecommendation.value ? formatMaybeNumber(pricingRecommendation.value.base_fee, 2) : '—',
    },
    {
      key: 'distance_unit_price',
      label: '距离单价（元/km）',
      currentText: formatMaybeNumber(currentDistance, 2),
      recommendText: pricingRecommendation.value
        ? formatMaybeNumber(pricingRecommendation.value.distance_unit_price, 2)
        : '—',
    },
    {
      key: 'time_surcharge_factor',
      label: '时段系数',
      currentText: formatMaybeNumber(currentTime, 2),
      recommendText: pricingRecommendation.value ? formatMaybeNumber(pricingRecommendation.value.time_surcharge_factor, 2) : '—',
    },
    {
      key: 'weather_surcharge_factor',
      label: '天气系数',
      currentText: formatMaybeNumber(currentWeather, 2),
      recommendText: pricingRecommendation.value
        ? formatMaybeNumber(pricingRecommendation.value.weather_surcharge_factor, 2)
        : '—',
    },
  ]
})

async function applyRecommendation() {
  if (!pricingRecommendation.value || applyingRecommendation.value) return
  applyingRecommendation.value = true
  try {
    const rec = pricingRecommendation.value
    await updateAdminConfig('base_delivery_fee', rec.base_fee)
    await updateAdminConfig('distance_price_per_km', rec.distance_unit_price)
    await updateAdminConfig('time_surcharge_factor', rec.time_surcharge_factor)
    await updateAdminConfig('weather_surcharge_factor', rec.weather_surcharge_factor)
    ElMessage.success('已应用推荐参数，实时生效')
    await loadConfig()
  } catch (err: any) {
    ElMessage.error(getErrorMessage(err))
  } finally {
    applyingRecommendation.value = false
  }
}

onMounted(() => {
  loadConfig()
})
</script>
