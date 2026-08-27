<script setup lang="ts">
import { ElMessage } from 'element-plus'
import type { UploadFile, UploadFiles, UploadInstance, UploadUserFile } from 'element-plus'
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRouter } from 'vue-router'

import { baseURL, http } from '@/api/request'
import { useAuthStore } from '@/stores/auth'
import { getUsableCoupons, type UserCoupon } from '@/api/coupon'

type ItemType = '快递' | '餐饮' | '文件' | '药品'

const router = useRouter()
const auth = useAuthStore()
const isFrozen = computed(() => Boolean(auth.isFrozen))
const IMAGE_BASE_URL = 'http://localhost:3000'
const uploadAction = `${baseURL}/upload/image`
const AMAP_KEY = '8476ce87e366c5936788fe2a47fc26ad'
const AMAP_SECURITY_JS_CODE = '63f89ed0a18fd8c4ec57d119ec552e14'

const form = reactive({
  pickup_address: '',
  delivery_address: '',
  pickup_lat: null as number | null,
  pickup_lng: null as number | null,
  delivery_lat: null as number | null,
  delivery_lng: null as number | null,
  type: '' as '' | ItemType,
  urgency: 0 as 0 | 1,
  tip: 0,
  remark: '',
})

const submitting = ref(false)
const fileList = ref<UploadUserFile[]>([])
const imagesList = ref<string[]>([])
const previewVisible = ref(false)
const previewUrl = ref('')
const uploadRef = ref<UploadInstance>()
const allowLeave = ref(false)
const coupons = ref<UserCoupon[]>([])
const selectedCouponId = ref('')
const couponLoading = ref(false)
let couponRequestSequence = 0
let couponReloadTimer: ReturnType<typeof setTimeout> | undefined

const amapContainerRef = ref<HTMLDivElement | null>(null)
const selecting = ref<null | 'pickup' | 'delivery'>(null)
const mapReady = ref(false)
const mapLoading = ref(false)
const mapErrorMessage = ref('')
const pricingLoading = ref(false)
const pricingLoaded = ref(false)
const pricingErrorMessage = ref('')
const distanceLoading = ref(false)
const distanceErrorMessage = ref('')
const routeDistanceMeters = ref<number | null>(null)
const routeDurationSeconds = ref<number | null>(null)
const pricingConfig = reactive({
  base_delivery_fee: 6.52,
  distance_price_per_km: 1.2,
  urgent_fee: 2,
  ai_pricing_enabled: false,
  allow_user_price_adjust: false,
})
let AMap: any
let map: any
let geocoder: any
let geolocation: any
let pickupMarker: any
let deliveryMarker: any
let autoComplete: any
let placeSearch: any
let distanceCalcSeq = 0
const myLocation = ref<null | { lng: number; lat: number }>(null)
const locating = ref(false)
const searchKeyword = ref('')

const uploading = computed(() => fileList.value.some((f) => f.status === 'uploading'))
const formDisabled = computed(() => submitting.value || uploading.value || isFrozen.value)
const uploadHeaders = computed<Record<string, string>>(() => {
  const token = localStorage.getItem('ce_token')
  return token ? { Authorization: `Bearer ${token}` } : ({} as Record<string, string>)
})
const hasUnsavedChanges = computed(() => Boolean(
  form.pickup_address || form.delivery_address || form.type || form.urgency || Number(form.tip) > 0 || form.remark.trim() || fileList.value.length,
))

function getErrorMessage(err: any) {
  return (
    err?.response?.data?.message ||
    err?.response?.data?.msg ||
    err?.response?.data?.error ||
    err?.message ||
    '操作失败'
  )
}

function normalizeNumber(value: unknown, fallback = 0) {
  const n = typeof value === 'number' ? value : Number(String(value ?? '').trim())
  return Number.isFinite(n) ? n : fallback
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function getCurrentTimeSlot(date = new Date()) {
  const hour = date.getHours()
  if (hour < 6) return '00-06'
  if (hour < 12) return '06-12'
  if (hour < 18) return '12-18'
  return '18-24'
}

function formatMoney(value: number | null | undefined) {
  return roundMoney(normalizeNumber(value, 0)).toFixed(2)
}

function formatDistanceMeters(value: number | null) {
  if (!Number.isFinite(Number(value)) || Number(value) <= 0) return '待计算'
  const meters = Number(value)
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters / 1000).toFixed(2)} km`
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const rad = (value: number) => (value * Math.PI) / 180
  const dLat = rad(lat2 - lat1)
  const dLng = rad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2
  return Math.round(6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))
}

function flattenObject(input: any, prefix = '', out: Record<string, any> = {}) {
  if (!input || typeof input !== 'object') return out
  const entries = Array.isArray(input) ? input.entries() : Object.entries(input)
  for (const entry of entries as any) {
    const key = Array.isArray(input) ? String(entry[0]) : String(entry[0])
    const value = Array.isArray(input) ? entry[1] : entry[1]
    const nextKey = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      flattenObject(value, nextKey, out)
    } else {
      out[nextKey] = value
    }
  }
  return out
}

function normalizeConfigPayload(data: any): Record<string, any> {
  const root = data?.data ?? data ?? {}
  if (Array.isArray(root)) {
    const map: Record<string, any> = {}
    root.forEach((item) => {
      const key = String(item?.key ?? item?.name ?? '').trim()
      if (key) map[key] = item?.value
    })
    return map
  }
  if (Array.isArray(root?.items)) {
    const map: Record<string, any> = {}
    root.items.forEach((item: any) => {
      const key = String(item?.key ?? item?.name ?? '').trim()
      if (key) map[key] = item?.value
    })
    return map
  }
  return root && typeof root === 'object' ? root : {}
}

function pickConfigNumber(flat: Record<string, any>, candidates: string[], fallback = 0) {
  for (const key of candidates) {
    if (Object.prototype.hasOwnProperty.call(flat, key)) {
      return normalizeNumber(flat[key], fallback)
    }
  }
  return fallback
}

function pickConfigBool(flat: Record<string, any>, candidates: string[], fallback = false) {
  for (const key of candidates) {
    if (!Object.prototype.hasOwnProperty.call(flat, key)) continue
    const raw = flat[key]
    if (typeof raw === 'boolean') return raw
    const s = String(raw ?? '').trim().toLowerCase()
    if (['1', 'true', 'yes', 'y', 'on', 'enabled'].includes(s)) return true
    if (['0', 'false', 'no', 'n', 'off', 'disabled'].includes(s)) return false
    const n = Number(s)
    if (Number.isFinite(n)) return n !== 0
  }
  return fallback
}

async function loadPricingConfig() {
  pricingLoading.value = true
  pricingErrorMessage.value = ''
  try {
    const response = await http.get('/config/public')
    const configMap = normalizeConfigPayload(response.data)
    const flat = flattenObject(configMap)
    pricingConfig.base_delivery_fee = pickConfigNumber(flat, ['base_delivery_fee', 'baseDeliveryFee', 'fee.base_delivery_fee'], 0)
    pricingConfig.distance_price_per_km = pickConfigNumber(
      flat,
      ['distance_price_per_km', 'distancePricePerKm', 'fee.distance_price_per_km'],
      0,
    )
    pricingConfig.urgent_fee = pickConfigNumber(flat, ['urgent_fee', 'urgentFee', 'fee.urgent_fee'], 0)
    pricingConfig.ai_pricing_enabled = pickConfigBool(flat, ['ai_pricing_enabled', 'aiPricingEnabled', 'pricing.ai_pricing_enabled'], false)
    pricingConfig.allow_user_price_adjust = pickConfigBool(
      flat,
      ['allow_user_price_adjust', 'allowUserPriceAdjust', 'pricing.allow_user_price_adjust'],
      false,
    )
    pricingLoaded.value = true
  } catch (err: any) {
    pricingLoaded.value = false
    pricingErrorMessage.value = getErrorMessage(err) || '配送费配置加载失败'
  } finally {
    pricingLoading.value = false
  }
}

function resetDistanceResult() {
  routeDistanceMeters.value = null
  routeDurationSeconds.value = null
  distanceErrorMessage.value = ''
}

const distanceKm = computed(() => {
  if (!Number.isFinite(Number(routeDistanceMeters.value)) || Number(routeDistanceMeters.value) <= 0) return 0
  return Number(routeDistanceMeters.value) / 1000
})

const baseFeeAmount = computed(() => roundMoney(pricingConfig.base_delivery_fee))
const distanceFeeAmount = computed(() => roundMoney(distanceKm.value * pricingConfig.distance_price_per_km))
const urgentFeeAmount = computed(() => (form.urgency === 1 ? roundMoney(pricingConfig.urgent_fee) : 0))
const tipAmount = computed(() => roundMoney(normalizeNumber(form.tip, 0)))

type PricingBreakdown = {
  base_fee: number
  distance_fee: number
  time_fee: number
  weather_fee: number
  urgent_fee: number
}

type PricingCalculateResult = {
  delivery_fee: number
  breakdown: PricingBreakdown
  raw: any
}

const aiPricingLoading = ref(false)
const aiPricingErrorMessage = ref('')
const aiPricingResult = ref<PricingCalculateResult | null>(null)
const userAdjustedDeliveryFee = ref<number | null>(null)
let pricingCalcSeq = 0
let pricingDebounceTimer: number | null = null

function normalizePricingCalculateResponse(data: any): PricingCalculateResult | null {
  const root = data?.data ?? data?.result ?? data ?? {}
  if (!root || typeof root !== 'object') return null

  const breakdownRoot = root?.breakdown ?? root?.detail ?? root?.details ?? root?.items ?? root?.fee_detail ?? root ?? {}
  const base_fee = normalizeNumber(
    breakdownRoot?.base_fee ?? breakdownRoot?.baseFee ?? breakdownRoot?.base ?? breakdownRoot?.base_delivery_fee,
    NaN,
  )
  const distance_fee = normalizeNumber(
    breakdownRoot?.distance_fee ?? breakdownRoot?.distanceFee ?? breakdownRoot?.distance ?? breakdownRoot?.distance_amount,
    NaN,
  )
  const time_fee = normalizeNumber(
    breakdownRoot?.time_fee ?? breakdownRoot?.timeFee ?? breakdownRoot?.period_fee ?? breakdownRoot?.time_surcharge,
    0,
  )
  const weather_fee = normalizeNumber(
    breakdownRoot?.weather_fee ?? breakdownRoot?.weatherFee ?? breakdownRoot?.weather_surcharge ?? breakdownRoot?.weather,
    0,
  )
  const urgent_fee = normalizeNumber(
    breakdownRoot?.urgent_fee ?? breakdownRoot?.urgentFee ?? breakdownRoot?.urgent ?? breakdownRoot?.urgent_amount,
    0,
  )

  const delivery_fee = normalizeNumber(
    root?.delivery_fee ??
      root?.fee ??
      root?.total ??
      root?.total_fee ??
      root?.fee_total ??
      root?.price ??
      root?.amount,
    NaN,
  )

  const baseValid = Number.isFinite(base_fee) && base_fee > 0
  const distanceValid = Number.isFinite(distance_fee) && distance_fee >= 0
  const deliveryValid = Number.isFinite(delivery_fee) && delivery_fee > 0
  const anyValid = baseValid || distanceValid || deliveryValid

  if (!anyValid) return null

  const safeBreakdown: PricingBreakdown = {
    base_fee: Number.isFinite(base_fee) ? roundMoney(base_fee) : 0,
    distance_fee: Number.isFinite(distance_fee) ? roundMoney(distance_fee) : 0,
    time_fee: Number.isFinite(time_fee) ? roundMoney(time_fee) : 0,
    weather_fee: Number.isFinite(weather_fee) ? roundMoney(weather_fee) : 0,
    urgent_fee: Number.isFinite(urgent_fee) ? roundMoney(urgent_fee) : 0,
  }

  const computedTotal = roundMoney(
    safeBreakdown.base_fee +
      safeBreakdown.distance_fee +
      safeBreakdown.time_fee +
      safeBreakdown.weather_fee +
      safeBreakdown.urgent_fee,
  )

  return {
    delivery_fee: Number.isFinite(delivery_fee) ? roundMoney(delivery_fee) : computedTotal,
    breakdown: safeBreakdown,
    raw: root,
  }
}

const breakdown = computed<PricingBreakdown>(() => {
  const ruleBased: PricingBreakdown = {
    base_fee: baseFeeAmount.value,
    distance_fee: distanceFeeAmount.value,
    time_fee: 0,
    weather_fee: 0,
    urgent_fee: urgentFeeAmount.value,
  }
  if (!aiPricingResult.value) return ruleBased
  const ai = aiPricingResult.value.breakdown
  return {
    base_fee: ai.base_fee > 0 ? ai.base_fee : ruleBased.base_fee,
    distance_fee: ai.distance_fee > 0 ? ai.distance_fee : ruleBased.distance_fee,
    time_fee: Number.isFinite(ai.time_fee) ? ai.time_fee : 0,
    weather_fee: Number.isFinite(ai.weather_fee) ? ai.weather_fee : 0,
    urgent_fee: ruleBased.urgent_fee > 0 ? ruleBased.urgent_fee : (ai.urgent_fee > 0 ? ai.urgent_fee : 0),
  }
})

const deliveryFeeAuto = computed(() => {
  const computedFromBreakdown = roundMoney(
    breakdown.value.base_fee +
      breakdown.value.distance_fee +
      breakdown.value.time_fee +
      breakdown.value.weather_fee +
      breakdown.value.urgent_fee,
  )
  if (aiPricingResult.value && aiPricingResult.value.delivery_fee > 0) {
    return roundMoney(Math.max(aiPricingResult.value.delivery_fee, computedFromBreakdown * 0.9))
  }
  return computedFromBreakdown
})

const canUserAdjustPrice = computed(() => Boolean(pricingConfig.allow_user_price_adjust))

const deliveryFeeFinal = computed(() => {
  if (canUserAdjustPrice.value && userAdjustedDeliveryFee.value != null) {
    return roundMoney(normalizeNumber(userAdjustedDeliveryFee.value, deliveryFeeAuto.value))
  }
  return deliveryFeeAuto.value
})

const totalFeeAmount = computed(() => roundMoney(deliveryFeeFinal.value + tipAmount.value))
const availableCoupons = computed(() => coupons.value.filter((item) => Number(item.coupon.min_order_amount) <= deliveryFeeFinal.value))
const discountFor = (item: UserCoupon) => {
  const coupon = item.coupon
  const raw = coupon.type === 'CASH' ? Number(coupon.value) : deliveryFeeFinal.value * Number(coupon.value) / 100
  return roundMoney(Math.min(deliveryFeeFinal.value, coupon.type === 'DISCOUNT' && Number(coupon.max_discount) > 0 ? Math.min(raw, Number(coupon.max_discount)) : raw))
}
const couponDiscount = computed(() => {
  const item = availableCoupons.value.find((entry) => entry.id === selectedCouponId.value)
  return item ? discountFor(item) : 0
})
const payableTotal = computed(() => roundMoney(totalFeeAmount.value - couponDiscount.value))
async function loadCoupons() {
  const sequence = ++couponRequestSequence
  couponLoading.value = true
  try {
    const rows = await getUsableCoupons(deliveryFeeFinal.value)
    if (sequence !== couponRequestSequence) return
    coupons.value = rows
    if (!rows.some((item) => item.id === selectedCouponId.value)) selectedCouponId.value = ''
  } catch {
    if (sequence === couponRequestSequence) {
      coupons.value = []
      selectedCouponId.value = ''
    }
  } finally {
    if (sequence === couponRequestSequence) couponLoading.value = false
  }
}

watch(
  () => deliveryFeeFinal.value,
  () => {
    if (couponReloadTimer) clearTimeout(couponReloadTimer)
    couponReloadTimer = setTimeout(loadCoupons, 250)
  },
  { immediate: true },
)

function resetAiPricing() {
  aiPricingResult.value = null
  aiPricingErrorMessage.value = ''
  aiPricingLoading.value = false
  pricingCalcSeq += 1
}

async function calculateAiPricing() {
  if (
    !pricingLoaded.value ||
    pricingLoading.value ||
    distanceLoading.value ||
    form.pickup_lng == null ||
    form.pickup_lat == null ||
    form.delivery_lng == null ||
    form.delivery_lat == null ||
    !Number.isFinite(Number(routeDistanceMeters.value)) ||
    Number(routeDistanceMeters.value) <= 0
  ) {
    resetAiPricing()
    return
  }

  const seq = (pricingCalcSeq += 1)
  aiPricingLoading.value = true
  aiPricingErrorMessage.value = ''

  const payload = {
    pickup_address: form.pickup_address,
    delivery_address: form.delivery_address,
    pickup_lng: form.pickup_lng,
    pickup_lat: form.pickup_lat,
    delivery_lng: form.delivery_lng,
    delivery_lat: form.delivery_lat,
    distance_meters: Math.round(Number(routeDistanceMeters.value)),
    distanceKm: Number(distanceKm.value.toFixed(3)),
    timeSlot: getCurrentTimeSlot(),
    task_type: form.type,
    type: form.type,
    urgency: form.urgency,
    is_urgent: form.urgency === 1,
  }

  try {
    const res = await http.post('/pricing/calculate', payload)
    if (seq !== pricingCalcSeq) return
    const normalized = normalizePricingCalculateResponse(res.data)
    if (!normalized) throw new Error('定价响应解析失败')
    aiPricingResult.value = normalized
    aiPricingErrorMessage.value = ''
  } catch (err1: any) {
    if (seq !== pricingCalcSeq) return
    const status = err1?.response?.status
    const msg1 = getErrorMessage(err1)
    if (status === 404) {
      try {
        const res2 = await http.post('/api/pricing/calculate', payload)
        if (seq !== pricingCalcSeq) return
        const normalized2 = normalizePricingCalculateResponse(res2.data)
        if (!normalized2) throw new Error('定价响应解析失败')
        aiPricingResult.value = normalized2
        aiPricingErrorMessage.value = ''
      } catch (err2: any) {
        if (seq !== pricingCalcSeq) return
        aiPricingResult.value = null
        aiPricingErrorMessage.value = getErrorMessage(err2) || msg1 || 'AI 定价失败，已使用固定规则估算'
      }
    } else {
      aiPricingResult.value = null
      aiPricingErrorMessage.value = msg1 || 'AI 定价失败，已使用固定规则估算'
    }
  } finally {
    if (seq === pricingCalcSeq) {
      aiPricingLoading.value = false
    }
  }
}

function scheduleAiPricing() {
  if (pricingDebounceTimer != null) {
    window.clearTimeout(pricingDebounceTimer)
  }
  pricingDebounceTimer = window.setTimeout(() => {
    pricingDebounceTimer = null
    calculateAiPricing()
  }, 350)
}

watch(
  () => [
    form.pickup_lng,
    form.pickup_lat,
    form.delivery_lng,
    form.delivery_lat,
    form.urgency,
    form.type,
    routeDistanceMeters.value,
    pricingLoaded.value,
  ],
  () => scheduleAiPricing(),
  { deep: false },
)

async function calculateRouteDistance() {
  if (
    form.pickup_lng == null ||
    form.pickup_lat == null ||
    form.delivery_lng == null ||
    form.delivery_lat == null
  ) {
    resetDistanceResult()
    return
  }

  const seq = (distanceCalcSeq += 1)

  distanceLoading.value = true
  distanceErrorMessage.value = ''

  const fallbackMeters = haversineMeters(form.pickup_lat, form.pickup_lng, form.delivery_lat, form.delivery_lng)
  routeDistanceMeters.value = fallbackMeters
  routeDurationSeconds.value = Math.max(60, Math.round(fallbackMeters / 4.2))

  try {
    const res = await http.post('/map/distance', {
      origin_lat: form.pickup_lat,
      origin_lng: form.pickup_lng,
      destination_lat: form.delivery_lat,
      destination_lng: form.delivery_lng
    })
    
    if (seq !== distanceCalcSeq) return

    const data = res.data?.data ?? res.data
    const distanceMeters = data?.distance_meters
    
    if (distanceMeters && Number(distanceMeters) > 0) {
      routeDistanceMeters.value = Math.round(Number(distanceMeters))
      routeDurationSeconds.value = data?.duration_seconds || routeDurationSeconds.value
      distanceErrorMessage.value = ''
    }
  } catch (err: any) {
    if (seq !== distanceCalcSeq) return
    distanceErrorMessage.value = ''
  } finally {
    if (seq === distanceCalcSeq) {
      distanceLoading.value = false
    }
  }
}

function normalizeUploadUrl(data: any): string {
  const root = data?.data ?? data
  if (typeof root === 'string' && root.trim()) return root.trim()

  const direct =
    root?.url ??
    root?.path ??
    root?.src ??
    root?.location ??
    root?.data?.url ??
    root?.data?.path ??
    root?.result?.url ??
    root?.result?.path

  if (typeof direct === 'string' && direct.trim()) return direct.trim()

  const urls = root?.urls ?? root?.files ?? root?.images ?? root?.data?.urls ?? root?.data?.images
  if (Array.isArray(urls) && typeof urls[0] === 'string' && urls[0].trim()) return urls[0].trim()

  throw new Error('图片上传失败：未返回可用的图片地址')
}

function toFullUrl(url: string) {
  const raw = String(url ?? '').trim()
  if (!raw) return ''
  if (/^https?:\/\//i.test(raw) || raw.startsWith('data:') || raw.startsWith('blob:')) return raw
  const path = raw.startsWith('/') ? raw : `/${raw}`
  return `${IMAGE_BASE_URL}${path}`
}

function syncImagesList() {
  const urls = fileList.value.map((f) => toFullUrl(String(f.url ?? '').trim())).filter(Boolean)
  imagesList.value = Array.from(new Set(urls)).slice(0, 3)
}

function onUploadSuccess(response: any, uploadFile: UploadFile, uploadFiles: UploadFiles) {
  try {
    const url = toFullUrl(normalizeUploadUrl(response))
    uploadFile.url = url
    const target = uploadFiles.find((f) => f.uid === uploadFile.uid)
    if (target) target.url = url
    syncImagesList()
  } catch (err: any) {
    ElMessage.error(err?.message || '图片上传失败')
  }
}

function onUploadError(error: Error, uploadFile: UploadFile) {
  uploadFile.status = 'fail'
  ElMessage.error(error?.message || '图片上传失败，可点击重试')
}

function retryUpload(uploadFile: UploadFile) {
  if (!uploadFile.raw || uploadFile.status !== 'fail') return
  uploadFile.status = 'ready'
  uploadRef.value?.submit()
}

function onUploadRemove(_uploadFile: UploadFile, uploadFiles: UploadFiles) {
  fileList.value = uploadFiles as unknown as UploadUserFile[]
  syncImagesList()
}

function onUploadExceed() {
  ElMessage.warning('最多上传 3 张图片')
}

function onUploadPreview(uploadFile: UploadFile) {
  const url = toFullUrl(String(uploadFile.url ?? ''))
  if (!url) return
  previewUrl.value = url
  previewVisible.value = true
}

function enterSelectMode(mode: 'pickup' | 'delivery') {
  if (!mapReady.value) {
    ElMessage.warning('地图加载中，请稍后')
    return
  }
  if (selecting.value === mode) {
    selecting.value = null
    ElMessage.info('已退出选点模式')
    return
  }
  selecting.value = mode
  ElMessage.info(`请在地图上点击选择${mode === 'pickup' ? '取件点' : '收货点'}`)
}

function createMarkerContent(mode: 'pickup' | 'delivery') {
  return `<div class="map-marker ${mode === 'pickup' ? 'map-marker--pickup' : 'map-marker--delivery'}"></div>`
}

function reverseGeocode(lng: number, lat: number): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!geocoder) return reject(new Error('Geocoder not ready'))
    geocoder.getAddress([lng, lat], (status: string, result: any) => {
      if (status === 'complete' && result?.regeocode?.formattedAddress) {
        resolve(String(result.regeocode.formattedAddress))
        return
      }
      reject(new Error('reverseGeocode failed'))
    })
  })
}

async function applySelection(mode: 'pickup' | 'delivery', lng: number, lat: number, addressOverride?: string) {
  let address = ''
  if (addressOverride && String(addressOverride).trim()) {
    address = String(addressOverride).trim()
  } else {
    try {
      address = await reverseGeocode(lng, lat)
    } catch {
      address = ''
    }
  }

  if (mode === 'pickup') {
    form.pickup_lng = lng
    form.pickup_lat = lat
    if (address) form.pickup_address = address
    if (!pickupMarker) {
      pickupMarker = new AMap.Marker({ position: [lng, lat], content: createMarkerContent('pickup') })
      pickupMarker.setMap(map)
    } else {
      pickupMarker.setPosition([lng, lat])
    }
    ElMessage.success('已设置取件点')
  } else {
    form.delivery_lng = lng
    form.delivery_lat = lat
    if (address) form.delivery_address = address
    if (!deliveryMarker) {
      deliveryMarker = new AMap.Marker({ position: [lng, lat], content: createMarkerContent('delivery') })
      deliveryMarker.setMap(map)
    } else {
      deliveryMarker.setPosition([lng, lat])
    }
    ElMessage.success('已设置收货点')
  }
  await calculateRouteDistance()
}

async function swapLocations() {
  const pickup = { address: form.pickup_address, lat: form.pickup_lat, lng: form.pickup_lng }
  form.pickup_address = form.delivery_address
  form.pickup_lat = form.delivery_lat
  form.pickup_lng = form.delivery_lng
  form.delivery_address = pickup.address
  form.delivery_lat = pickup.lat
  form.delivery_lng = pickup.lng
  if (pickupMarker && form.pickup_lng != null && form.pickup_lat != null) pickupMarker.setPosition([form.pickup_lng, form.pickup_lat])
  if (deliveryMarker && form.delivery_lng != null && form.delivery_lat != null) deliveryMarker.setPosition([form.delivery_lng, form.delivery_lat])
  if (map && form.pickup_lng != null && form.pickup_lat != null && form.delivery_lng != null && form.delivery_lat != null) {
    map.setFitView?.([pickupMarker, deliveryMarker].filter(Boolean), false, [60, 60, 60, 60])
  }
  await calculateRouteDistance()
}

function locationsAreSame() {
  if (form.pickup_lat == null || form.pickup_lng == null || form.delivery_lat == null || form.delivery_lng == null) return false
  const latDelta = Math.abs(form.pickup_lat - form.delivery_lat)
  const lngDelta = Math.abs(form.pickup_lng - form.delivery_lng)
  return (latDelta < 0.00005 && lngDelta < 0.00005) || form.pickup_address.trim() === form.delivery_address.trim()
}

function pickModeForSelection() {
  if (selecting.value) return selecting.value
  if (form.pickup_lng == null || form.pickup_lat == null) return 'pickup'
  if (form.delivery_lng == null || form.delivery_lat == null) return 'delivery'
  return 'pickup'
}

function getLngLat(pos: any): null | { lng: number; lat: number } {
  const lng = Number(pos?.getLng?.() ?? pos?.lng)
  const lat = Number(pos?.getLat?.() ?? pos?.lat)
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null
  return { lng, lat }
}

function searchFirstPoi(keyword: string): Promise<null | { lng: number; lat: number; address?: string }> {
  const kw = String(keyword || '').trim()
  if (!kw || !placeSearch) return Promise.resolve(null)
  return new Promise((resolve) => {
    placeSearch.search(kw, (status: string, result: any) => {
      if (status !== 'complete') return resolve(null)
      const poi = result?.poiList?.pois?.[0]
      const loc = getLngLat(poi?.location)
      if (!loc) return resolve(null)
      const address = [poi?.pname, poi?.cityname, poi?.adname, poi?.address, poi?.name].filter(Boolean).join('')
      resolve({ ...loc, address: address || undefined })
    })
  })
}

function setupSearch() {
  if (!map || !AMap) return
  if (autoComplete || placeSearch) return
  autoComplete = new AMap.AutoComplete({ input: 'amap-search-input' })
  placeSearch = new AMap.PlaceSearch({ pageSize: 1, pageIndex: 1 })

  autoComplete.on('select', async (e: any) => {
    const poi = e?.poi ?? {}
    const loc = getLngLat(poi?.location)
    const tipAddress = [poi?.district, poi?.address, poi?.name].filter(Boolean).join('')

    const resolved = loc ? { ...loc, address: undefined as string | undefined } : await searchFirstPoi(poi?.name || searchKeyword.value)
    if (!resolved) {
      ElMessage.warning('未找到该地点的位置')
      return
    }

    const lng = resolved.lng
    const lat = resolved.lat
    const address = String(tipAddress || resolved.address || '').trim()
    const mode = pickModeForSelection()
    selecting.value = null

    try {
      map.setZoomAndCenter?.(16, [lng, lat])
    } catch {
      map.setCenter?.([lng, lat])
    }
    await applySelection(mode, lng, lat, address || undefined)
  })
}

async function locateMyPosition(recenter: boolean, showErrorMessage: boolean) {
  if (!map || !geolocation || locating.value) return
  locating.value = true
  try {
    const result = await new Promise<any>((resolve, reject) => {
      geolocation.getCurrentPosition((status: string, res: any) => {
        if (status === 'complete') resolve(res)
        else reject(res)
      })
    })
    const pos = getLngLat(result?.position)
    if (!pos) throw new Error('定位失败')
    myLocation.value = pos
    if (recenter) {
      try {
        map.setZoomAndCenter?.(16, [pos.lng, pos.lat])
      } catch {
        map.setCenter?.([pos.lng, pos.lat])
      }
    }
  } catch (err: any) {
    if (showErrorMessage) {
      ElMessage.warning(err?.message || err?.info || '定位失败，请检查浏览器定位权限')
    }
  } finally {
    locating.value = false
  }
}

async function locateToMyPosition() {
  if (!mapReady.value) {
    ElMessage.warning('地图加载中，请稍后')
    return
  }
  if (myLocation.value) {
    try {
      map.setZoomAndCenter?.(16, [myLocation.value.lng, myLocation.value.lat])
    } catch {
      map.setCenter?.([myLocation.value.lng, myLocation.value.lat])
    }
  }
  await locateMyPosition(true, true)
}

async function initMap() {
  if (!amapContainerRef.value) return

  map = new AMap.Map(amapContainerRef.value, {
    zoom: 15,
    viewMode: '2D',
    resizeEnable: true,
    center: [113.3304, 23.1065],
  })

  if (AMap.ToolBar) map.addControl(new AMap.ToolBar())
  geocoder = new AMap.Geocoder({})
  geolocation = new AMap.Geolocation({
    enableHighAccuracy: true,
    timeout: 8000,
    showButton: false,
    showMarker: false,
    showCircle: false,
    zoomToAccuracy: false,
  })
  map.addControl(geolocation)
  setupSearch()

  map.on('click', async (e: any) => {
    if (!selecting.value) return
    const lng = Number(e?.lnglat?.getLng?.() ?? e?.lnglat?.lng)
    const lat = Number(e?.lnglat?.getLat?.() ?? e?.lnglat?.lat)
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return

    const mode = selecting.value
    selecting.value = null
    await applySelection(mode, lng, lat)
  })

  mapReady.value = true
  await locateMyPosition(true, false)
}

let amapScriptPromise: Promise<any> | null = null
function loadAMapScript() {
  if ((window as any).AMap?.Map) return Promise.resolve((window as any).AMap)
  if (amapScriptPromise) return amapScriptPromise

  amapScriptPromise = new Promise((resolve, reject) => {
    // 关键：在加载脚本前设置安全密钥
    if (typeof window !== 'undefined') {
      (window as any)._AMapSecurityConfig = {
        securityJsCode: AMAP_SECURITY_JS_CODE
      }
    }

    const script = document.createElement('script')
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${AMAP_KEY}&plugin=AMap.Geocoder,AMap.ToolBar,AMap.Geolocation,AMap.AutoComplete,AMap.PlaceSearch,AMap.Driving`
    script.async = true
    script.defer = true
    script.onload = () => {
      const AMap = (window as any).AMap
      if (AMap && AMap.Map) {
        resolve(AMap)
      } else {
        reject(new Error('AMap 加载失败'))
      }
    }
    script.onerror = () => reject(new Error('高德地图脚本加载失败'))
    document.head.appendChild(script)
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

onMounted(async () => {
  void loadPricingConfig()
  mapLoading.value = true
  mapErrorMessage.value = ''
  mapReady.value = false
  try {
    AMap = await loadAMapScript()
    await ensureAMapPlugins(AMap, [
      'AMap.Geocoder',
      'AMap.ToolBar',
      'AMap.Geolocation',
      'AMap.AutoComplete',
      'AMap.PlaceSearch',
      'AMap.Driving',
    ])
    await initMap()
  } catch (err: any) {
    mapReady.value = false
    mapErrorMessage.value = err?.message ? `高德地图加载失败：${err.message}` : '高德地图加载失败'
    ElMessage.error(mapErrorMessage.value)
  } finally {
    mapLoading.value = false
  }
})

onBeforeUnmount(() => {
  if (pricingDebounceTimer != null) {
    window.clearTimeout(pricingDebounceTimer)
    pricingDebounceTimer = null
  }
  pricingCalcSeq += 1
  try {
    map?.destroy?.()
  } catch {}
  mapReady.value = false
  mapLoading.value = false
  mapErrorMessage.value = ''
  selecting.value = null
  AMap = null
  map = null
  geocoder = null
  geolocation = null
  pickupMarker = null
  deliveryMarker = null
  autoComplete = null
  placeSearch = null
})

function beforeUnload(event: BeforeUnloadEvent) {
  if (!allowLeave.value && hasUnsavedChanges.value) {
    event.preventDefault()
    event.returnValue = ''
  }
}

onBeforeRouteLeave(() => {
  if (allowLeave.value || !hasUnsavedChanges.value) return true
  return window.confirm('当前任务尚未发布，确定放弃未保存内容并离开吗？')
})

onMounted(() => window.addEventListener('beforeunload', beforeUnload))
onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', beforeUnload)
  if (couponReloadTimer) clearTimeout(couponReloadTimer)
})

async function submit() {
  if (submitting.value || uploading.value) return
  if (isFrozen.value) {
    ElMessage.warning('账号已冻结，无法发布任务')
    return
  }

  const pickup_address = form.pickup_address.trim()
  const delivery_address = form.delivery_address.trim()
  const remark = form.remark.trim()
  const tip = Number(form.tip)

  if (!pickup_address || form.pickup_lng == null || form.pickup_lat == null) {
    ElMessage.warning('请先在地图上选择取件点')
    return
  }
  if (!delivery_address || form.delivery_lng == null || form.delivery_lat == null) {
    ElMessage.warning('请先在地图上选择收货点')
    return
  }
  if (locationsAreSame()) {
    ElMessage.warning('取件点和送达点不能相同')
    return
  }
  if (!form.type) {
    ElMessage.warning('请选择物品类型')
    return
  }
  if (!Number.isFinite(Number(form.urgency)) || (form.urgency !== 0 && form.urgency !== 1)) {
    ElMessage.warning('请选择时效')
    return
  }
  if (pricingLoading.value || !pricingLoaded.value) {
    ElMessage.warning('配送费配置加载中，请稍后再试')
    return
  }
  if (distanceLoading.value) {
    ElMessage.warning('距离计算中，请稍后再试')
    return
  }
  if (!Number.isFinite(Number(routeDistanceMeters.value)) || Number(routeDistanceMeters.value) <= 0) {
    ElMessage.warning('请先完成距离计算')
    return
  }
  if (!Number.isFinite(tip) || tip < 0 || tip > 100) {
    ElMessage.warning('小费范围为 0-100 元')
    return
  }
  if (imagesList.value.length === 0) {
    ElMessage.warning('请至少上传 1 张图片')
    return
  }

  const fee_total = roundMoney(deliveryFeeFinal.value)

  const payload = {
    pickup_address,
    delivery_address,
    pickup_lat: form.pickup_lat,
    pickup_lng: form.pickup_lng,
    delivery_lat: form.delivery_lat,
    delivery_lng: form.delivery_lng,
    type: form.type,
    urgency: form.urgency,
    is_urgent: form.urgency === 1,
    fee_total,
    tip,
    remark,
    images_json: JSON.stringify(imagesList.value),
    user_coupon_id: selectedCouponId.value || null,
  }

  submitting.value = true
  try {
    await http.post('/task/publish', payload)
    ElMessage.success('发布成功')
    allowLeave.value = true
    router.push('/tasks')
  } catch (err: any) {
    ElMessage.error(getErrorMessage(err))
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="publish-task p-4">
    <div class="publish-header d-flex align-items-center justify-content-between gap-2 mb-3">
      <h2 class="mb-0">发布任务</h2>
    </div>

    <el-card>
      <el-alert
        v-if="isFrozen"
        class="mb-3"
        type="warning"
        show-icon
        :closable="false"
        title="账号已冻结，暂不可发布任务。可点击页面顶部“申请解封”提交解封申请。"
      />
      <el-alert
        v-if="pricingErrorMessage"
        class="mb-3"
        type="warning"
        show-icon
        :closable="false"
        :title="pricingErrorMessage"
      />
      <el-form label-width="90px" @submit.prevent>
        <div class="form-section-heading">
          <div><strong>取送位置</strong><div class="text-muted small">在地图中依次选择取件点和送达点</div></div>
          <el-button :disabled="formDisabled || (!form.pickup_address && !form.delivery_address)" @click="swapLocations">互换取送点</el-button>
        </div>
        <el-form-item label="取件点" required>
          <div class="w-100">
            <el-input
              v-model="form.pickup_address"
              readonly
              placeholder="请通过高德地图选择取件点"
              :disabled="formDisabled"
            />
            <div v-if="form.pickup_lng != null && form.pickup_lat != null" class="text-muted small mt-1">
              坐标：{{ form.pickup_lng?.toFixed(6) }}, {{ form.pickup_lat?.toFixed(6) }}
            </div>
          </div>
        </el-form-item>

        <el-form-item label="收货点" required>
          <div class="w-100">
            <el-input
              v-model="form.delivery_address"
              readonly
              placeholder="请通过高德地图选择收货点"
              :disabled="formDisabled"
            />
            <div v-if="form.delivery_lng != null && form.delivery_lat != null" class="text-muted small mt-1">
              坐标：{{ form.delivery_lng?.toFixed(6) }}, {{ form.delivery_lat?.toFixed(6) }}
            </div>
          </div>
        </el-form-item>

        <el-form-item label="地图选点">
          <div class="w-100">
            <div v-if="mapErrorMessage" class="alert alert-warning mb-2" role="alert">{{ mapErrorMessage }}</div>
            <div class="d-flex flex-wrap align-items-center gap-2 mb-2">
              <el-button
                :type="selecting === 'pickup' ? 'success' : 'default'"
                :disabled="formDisabled"
                @click="enterSelectMode('pickup')"
              >
                设为取件点
              </el-button>
              <el-button
                :type="selecting === 'delivery' ? 'danger' : 'default'"
                :disabled="formDisabled"
                @click="enterSelectMode('delivery')"
              >
                设为收货点
              </el-button>
              <el-button :disabled="formDisabled || !mapReady" :loading="locating" @click="locateToMyPosition">
                定位到我的位置
              </el-button>
              <input
                id="amap-search-input"
                v-model="searchKeyword"
                class="amap-search-input"
                placeholder="搜索地点关键词"
                :disabled="formDisabled || !mapReady"
              />
              <div v-if="selecting" class="text-muted small">选点模式：请点击地图选择{{ selecting === 'pickup' ? '取件点' : '收货点' }}</div>
            </div>
            <div class="amap-wrapper" v-loading="mapLoading" element-loading-text="地图加载中…">
              <div ref="amapContainerRef" class="amap-container"></div>
            </div>
            <div class="d-flex flex-wrap align-items-center gap-3 mt-2 text-muted small">
              <span>路线距离：{{ formatDistanceMeters(routeDistanceMeters) }}</span>
              <span v-if="routeDurationSeconds">预计耗时：{{ Math.ceil(routeDurationSeconds / 60) }} 分钟</span>
              <span v-if="distanceLoading">距离计算中…</span>
              <span v-if="distanceErrorMessage">{{ distanceErrorMessage }}</span>
            </div>
          </div>
        </el-form-item>

        <div class="form-section-heading"><div><strong>任务信息</strong><div class="text-muted small">设置物品类型、时效和小费</div></div></div>
        <el-form-item label="物品类型" required>
          <el-select v-model="form.type" placeholder="请选择" :disabled="formDisabled" style="width: 220px">
            <el-option label="快递" value="快递" />
            <el-option label="餐饮" value="餐饮" />
            <el-option label="文件" value="文件" />
            <el-option label="药品" value="药品" />
          </el-select>
        </el-form-item>

        <el-form-item label="加急">
          <div class="d-flex flex-wrap align-items-center gap-2">
            <el-switch
              v-model="form.urgency"
              :active-value="1"
              :inactive-value="0"
              inline-prompt
              active-text="加急"
              inactive-text="普通"
              :disabled="formDisabled"
            />
            <span class="text-muted small">加急加价：¥ {{ formatMoney(breakdown.urgent_fee) }}</span>
          </div>
        </el-form-item>

        <el-form-item label="小费">
          <div>
            <el-input-number v-model="form.tip" :min="0" :max="100" :precision="2" :step="1" :disabled="formDisabled" />
            <div class="text-muted small mt-1">可选，范围 0-100 元，将全部支付给跑腿员</div>
          </div>
        </el-form-item>

        <div class="form-section-heading"><div><strong>费用预估</strong><div class="text-muted small">费用随路线距离和时效实时更新</div></div></div>
        <el-form-item label="费用明细">
          <div class="vstack gap-2" style="width: 100%">
            <el-alert
              v-if="aiPricingErrorMessage"
              type="warning"
              show-icon
              :closable="false"
              :title="aiPricingErrorMessage"
            />

            <div class="fee-summary">
              <div class="pricing-formula">
                基础费 ¥{{ formatMoney(breakdown.base_fee) }} + 距离费 ¥{{ formatMoney(breakdown.distance_fee) }}（{{ formatDistanceMeters(routeDistanceMeters) }}）
                <template v-if="form.urgency === 1"> + 加急费 ¥{{ formatMoney(breakdown.urgent_fee) }}</template>
              </div>
              <div class="fee-summary__row">
                <span class="text-muted">定价模式</span>
                <span>
                  <el-tag size="small" :type="aiPricingResult ? 'success' : 'info'">
                    {{ aiPricingResult ? 'AI 定价' : '固定规则（估算）' }}
                  </el-tag>
                  <span v-if="aiPricingLoading" class="text-muted small ms-2">计算中…</span>
                </span>
              </div>

              <div class="fee-summary__row">
                <span>基础费</span>
                <span>¥ {{ formatMoney(breakdown.base_fee) }}</span>
              </div>
              <div class="fee-summary__row">
                <span>距离费（{{ formatDistanceMeters(routeDistanceMeters) }}）</span>
                <span>¥ {{ formatMoney(breakdown.distance_fee) }}</span>
              </div>
              <div class="fee-summary__row">
                <span>时段加价</span>
                <span>¥ {{ formatMoney(breakdown.time_fee) }}</span>
              </div>
              <div class="fee-summary__row">
                <span>天气加价</span>
                <span>¥ {{ formatMoney(breakdown.weather_fee) }}</span>
              </div>
              <div class="fee-summary__row">
                <span>紧急加价</span>
                <span>¥ {{ formatMoney(breakdown.urgent_fee) }}</span>
              </div>

              <div class="fee-summary__row fee-summary__row--total">
                <span>配送费（AI 结果）</span>
                <span>¥ {{ formatMoney(deliveryFeeAuto) }}</span>
              </div>

              <div v-if="canUserAdjustPrice" class="fee-summary__row">
                <span class="text-muted">手动微调</span>
                <div class="d-flex align-items-center gap-2">
                  <el-input-number
                    v-model="userAdjustedDeliveryFee"
                    :min="0"
                    :precision="2"
                    :step="0.5"
                    :disabled="formDisabled"
                  />
                  <el-button size="small" :disabled="formDisabled" @click="userAdjustedDeliveryFee = null">恢复推荐</el-button>
                </div>
              </div>

              <div class="fee-summary__row">
                <span>最终配送费</span>
                <span class="fw-semibold">¥ {{ formatMoney(deliveryFeeFinal) }}</span>
              </div>

              <div class="fee-summary__row">
                <span>小费</span>
                <span>¥ {{ formatMoney(tipAmount) }}</span>
              </div>

              <div class="fee-summary__row coupon-row">
                <span>优惠券</span>
                <el-select v-model="selectedCouponId" clearable :loading="couponLoading" placeholder="选择优惠券" no-data-text="当前金额暂无可用优惠券" style="width:220px">
                  <el-option v-for="item in availableCoupons" :key="item.id" :value="item.id" :label="`${item.coupon.name}（省 ¥${discountFor(item).toFixed(2)}）`" />
                </el-select>
              </div>

              <div v-if="couponDiscount > 0" class="fee-summary__row coupon-saving">
                <span>优惠减免</span><span>- ¥ {{ formatMoney(couponDiscount) }}</span>
              </div>

              <div class="fee-summary__row fee-summary__row--total">
                <span>总计</span>
                <span>¥ {{ formatMoney(payableTotal) }}</span>
              </div>
            </div>
          </div>
        </el-form-item>

        <div class="form-section-heading"><div><strong>补充信息</strong><div class="text-muted small">添加备注与任务相关图片</div></div></div>
        <el-form-item label="备注">
          <el-input
            v-model="form.remark"
            type="textarea"
            :rows="3"
            placeholder="选填"
            :disabled="formDisabled"
          />
        </el-form-item>

        <el-form-item label="图片上传">
          <div class="vstack gap-2 w-100">
            <div class="text-muted small">最多 3 张（{{ imagesList.length }}/3）</div>
            <el-upload
              ref="uploadRef"
              v-model:file-list="fileList"
              :action="uploadAction"
              name="images"
              multiple
              accept="image/*"
              list-type="picture-card"
              :limit="3"
              :headers="uploadHeaders"
              :disabled="submitting || isFrozen"
              :on-success="onUploadSuccess"
              :on-error="onUploadError"
              :on-remove="onUploadRemove"
              :on-preview="onUploadPreview"
              :on-exceed="onUploadExceed"
            >
              <div>上传</div>
            </el-upload>
            <div v-for="file in fileList.filter(item => item.status === 'fail')" :key="file.uid" class="upload-failure-row">
              <span>{{ file.name }} 上传失败</span>
              <el-button size="small" type="primary" plain @click="retryUpload(file as UploadFile)">重试</el-button>
            </div>
            <div v-if="uploading" class="text-muted small">正在上传，图片卡片中会显示实时进度…</div>
          </div>
        </el-form-item>

        <el-form-item>
          <el-button
            type="primary"
            :loading="submitting"
            :disabled="uploading || isFrozen || pricingLoading || distanceLoading"
            @click="submit"
          >
            发布
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-dialog v-model="previewVisible" width="80%" align-center>
      <el-image
        :src="previewUrl"
        :preview-src-list="imagesList"
        :initial-index="Math.max(0, imagesList.indexOf(previewUrl))"
        fit="contain"
        style="width: 100%; max-height: 70vh"
        preview-teleported
      />
    </el-dialog>
  </div>
</template>

<style scoped>
.publish-task { max-width: 1180px; margin: 0 auto; }.publish-header { display: none; }
.publish-task :deep(.el-card) { border: 1px solid var(--color-border); border-radius: var(--radius-card); background: var(--color-surface); box-shadow: none; }.publish-task :deep(.el-card__body) { padding: 10px 28px 28px; }
.form-section-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin: 30px 0 18px; padding: 0 0 11px; border-bottom: 1px solid var(--color-border-strong); }.form-section-heading strong { color: var(--color-navy); font-size: 16px; }.form-section-heading strong::before { display: inline-block; width: 9px; height: 9px; margin-right: 8px; border-radius: 50%; background: var(--color-primary); content: ''; }.form-section-heading > div > div { margin-top: 3px; }
.pricing-formula { margin-bottom: 12px; border-radius: 10px; padding: 10px 12px; background: var(--color-primary-soft); color: var(--color-text-secondary); font-size: 13px; line-height: 1.55; }.upload-failure-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; border-radius: 8px; padding: 9px 11px; background: var(--color-danger-soft); color: var(--color-danger); font-size: 13px; }
.amap-wrapper { position: relative; }.amap-container { width: 100%; height: 340px; overflow: hidden; border: 1px solid var(--color-border-strong); border-radius: 12px; }.amap-search-input { width: min(360px, 100%); height: 36px; border: 1px solid var(--color-border); border-radius: 8px; padding: 0 11px; background: var(--color-surface); color: var(--color-text-secondary); outline: none; }.amap-search-input:focus { border-color: var(--color-primary); box-shadow: var(--focus-ring); }:deep(.amap-sug-result) { z-index: 3000; }
.map-marker { width: 18px; height: 18px; border: 2px solid #fff; border-radius: 50%; box-shadow: 0 3px 9px rgba(8, 17, 32, .24); }.map-marker--pickup { background: #7da6ff; }.map-marker--delivery { background: var(--color-primary); }
.fee-summary { width: min(460px, 100%); border: 1px solid var(--color-border-strong); border-radius: 12px; padding: 14px 16px; background: var(--color-fill); }.fee-summary__row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 8px 0; color: var(--color-text-secondary); }.fee-summary__row + .fee-summary__row { border-top: 1px dashed var(--color-border); }.fee-summary__row--total { color: var(--color-navy); font-size: 15px; font-weight: 800; }.coupon-saving { color: var(--color-success); }.coupon-row { align-items: center; }
@media (max-width: 575.98px) { .publish-header { min-height: 74px; padding: 18px; }.publish-task :deep(.el-card__body) { padding: 4px 16px 22px; }.form-section-heading { align-items: flex-start; }.form-section-heading .el-button { flex: 0 0 auto; } :deep(.el-form-item) { display: block; } :deep(.el-form-item__label) { width: auto !important; justify-content: flex-start; } :deep(.el-form-item__content) { margin-left: 0 !important; } .amap-container { height: 260px; }.fee-summary__row { align-items: flex-start; flex-direction: column; gap: 5px; }.coupon-row { align-items: flex-start; } }
</style>
