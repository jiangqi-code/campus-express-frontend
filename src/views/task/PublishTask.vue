<script setup lang="ts">
import { ElMessage } from 'element-plus'
import type { UploadFile, UploadFiles, UploadUserFile } from 'element-plus'
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

import { baseURL, http } from '@/api/request'

type ItemType = '快递' | '餐饮' | '文件' | '药品'

const router = useRouter()
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
  fee_total: 0,
  urgency: 0 as 0 | 1,
  tip: 0,
  remark: '',
})

const submitting = ref(false)
const fileList = ref<UploadUserFile[]>([])
const imagesList = ref<string[]>([])
const previewVisible = ref(false)
const previewUrl = ref('')

const amapContainerRef = ref<HTMLDivElement | null>(null)
const selecting = ref<null | 'pickup' | 'delivery'>(null)
const mapReady = ref(false)
const mapLoading = ref(false)
const mapErrorMessage = ref('')
let AMap: any
let map: any
let geocoder: any
let geolocation: any
let pickupMarker: any
let deliveryMarker: any
let autoComplete: any
let placeSearch: any
const myLocation = ref<null | { lng: number; lat: number }>(null)
const locating = ref(false)
const searchKeyword = ref('')

const uploading = computed(() => fileList.value.some((f) => f.status === 'uploading'))
const uploadHeaders = computed<Record<string, string>>(() => {
  const token = localStorage.getItem('ce_token')
  return token ? { Authorization: `Bearer ${token}` } : ({} as Record<string, string>)
})

function getErrorMessage(err: any) {
  return (
    err?.response?.data?.message ||
    err?.response?.data?.msg ||
    err?.response?.data?.error ||
    err?.message ||
    '操作失败'
  )
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
  ElMessage.info(`请在地图上点击选择${mode === 'pickup' ? '取件点' : '送达点'}`)
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
    return
  }

  form.delivery_lng = lng
  form.delivery_lat = lat
  if (address) form.delivery_address = address
  if (!deliveryMarker) {
    deliveryMarker = new AMap.Marker({ position: [lng, lat], content: createMarkerContent('delivery') })
    deliveryMarker.setMap(map)
  } else {
    deliveryMarker.setPosition([lng, lat])
  }
  ElMessage.success('已设置送达点')
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

onMounted(async () => {
  mapLoading.value = true
  mapErrorMessage.value = ''
  mapReady.value = false
  try {
    AMap = await loadAMapScript()
    await ensureAMapPlugins(AMap, ['AMap.Geocoder', 'AMap.ToolBar', 'AMap.Geolocation', 'AMap.AutoComplete', 'AMap.PlaceSearch'])
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

async function submit() {
  if (submitting.value || uploading.value) return

  const pickup_address = form.pickup_address.trim()
  const delivery_address = form.delivery_address.trim()
  const remark = form.remark.trim()

  const fee_total = Number(form.fee_total)
  const tip = Number(form.tip)
  if (!pickup_address) {
    ElMessage.warning('请输入取件地址')
    return
  }
  if (!delivery_address) {
    ElMessage.warning('请输入送达地址')
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
  if (!Number.isFinite(fee_total) || fee_total <= 0) {
    ElMessage.warning('请输入正确的配送费')
    return
  }
  if (!Number.isFinite(tip) || tip < 0) {
    ElMessage.warning('请输入正确的小费')
    return
  }
  if (imagesList.value.length === 0) {
    ElMessage.warning('请至少上传 1 张图片')
    return
  }

  const payload = {
    pickup_address,
    delivery_address,
    pickup_lat: form.pickup_lat,
    pickup_lng: form.pickup_lng,
    delivery_lat: form.delivery_lat,
    delivery_lng: form.delivery_lng,
    type: form.type,
    fee_total,
    urgency: form.urgency,
    tip,
    remark,
    images_json: JSON.stringify(imagesList.value),
  }

  submitting.value = true
  try {
    await http.post('/task/publish', payload)
    ElMessage.success('发布成功')
    router.push('/tasks')
  } catch (err: any) {
    ElMessage.error(getErrorMessage(err))
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="p-4">
    <div class="d-flex align-items-center justify-content-between gap-2 mb-3">
      <h2 class="mb-0">发布任务</h2>
    </div>

    <el-card>
      <el-form label-width="90px" @submit.prevent>
        <el-form-item label="取件地址" required>
          <el-input v-model="form.pickup_address" placeholder="请输入取件地址" :disabled="submitting || uploading" />
        </el-form-item>

        <el-form-item label="送达地址" required>
          <el-input v-model="form.delivery_address" placeholder="请输入送达地址" :disabled="submitting || uploading" />
        </el-form-item>

        <el-form-item label="地图选点">
          <div class="w-100">
            <div v-if="mapErrorMessage" class="alert alert-warning mb-2" role="alert">{{ mapErrorMessage }}</div>
            <div class="d-flex flex-wrap align-items-center gap-2 mb-2">
              <el-button
                :type="selecting === 'pickup' ? 'success' : 'default'"
                :disabled="submitting || uploading"
                @click="enterSelectMode('pickup')"
              >
                设为取件点
              </el-button>
              <el-button
                :type="selecting === 'delivery' ? 'danger' : 'default'"
                :disabled="submitting || uploading"
                @click="enterSelectMode('delivery')"
              >
                设为送达点
              </el-button>
              <el-button :disabled="submitting || uploading || !mapReady" :loading="locating" @click="locateToMyPosition">
                定位到我的位置
              </el-button>
              <input
                id="amap-search-input"
                v-model="searchKeyword"
                class="amap-search-input"
                placeholder="搜索地点关键词"
                :disabled="submitting || uploading || !mapReady"
              />
              <div v-if="selecting" class="text-muted small">选点模式：请点击地图选择{{ selecting === 'pickup' ? '取件点' : '送达点' }}</div>
            </div>
            <div class="amap-wrapper" v-loading="mapLoading" element-loading-text="地图加载中…">
              <div ref="amapContainerRef" class="amap-container"></div>
            </div>
          </div>
        </el-form-item>

        <el-form-item label="物品类型" required>
          <el-select v-model="form.type" placeholder="请选择" :disabled="submitting || uploading" style="width: 220px">
            <el-option label="快递" value="快递" />
            <el-option label="餐饮" value="餐饮" />
            <el-option label="文件" value="文件" />
            <el-option label="药品" value="药品" />
          </el-select>
        </el-form-item>

        <el-form-item label="时效" required>
          <el-radio-group v-model="form.urgency" :disabled="submitting || uploading">
            <el-radio :label="0">普通</el-radio>
            <el-radio :label="1">加急</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="配送费" required>
          <el-input-number
            v-model="form.fee_total"
            :min="0.01"
            :precision="2"
            :step="0.5"
            placeholder="请输入配送费"
            :disabled="submitting || uploading"
          />
        </el-form-item>

        <el-form-item label="小费">
          <el-input-number v-model="form.tip" :min="0" :precision="0" :step="1" :disabled="submitting || uploading" />
        </el-form-item>

        <el-form-item label="备注">
          <el-input
            v-model="form.remark"
            type="textarea"
            :rows="3"
            placeholder="选填"
            :disabled="submitting || uploading"
          />
        </el-form-item>

        <el-form-item label="图片上传">
          <div class="vstack gap-2 w-100">
            <div class="text-muted small">最多 3 张（{{ imagesList.length }}/3）</div>
            <el-upload
              v-model:file-list="fileList"
              :action="uploadAction"
              name="images"
              multiple
              accept="image/*"
              list-type="picture-card"
              :limit="3"
              :headers="uploadHeaders"
              :disabled="submitting"
              :on-success="onUploadSuccess"
              :on-remove="onUploadRemove"
              :on-preview="onUploadPreview"
              :on-exceed="onUploadExceed"
            >
              <div>上传</div>
            </el-upload>
          </div>
        </el-form-item>

        <el-form-item>
          <el-button type="primary" :loading="submitting" :disabled="uploading" @click="submit">发布</el-button>
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
.amap-wrapper {
  position: relative;
}

.amap-container {
  height: 300px;
  width: 100%;
  border-radius: 8px;
  border: 1px solid var(--el-border-color);
  overflow: hidden;
}

.amap-search-input {
  width: min(360px, 100%);
  height: 32px;
  padding: 0 10px;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  background: var(--el-bg-color);
  color: var(--el-text-color-regular);
  outline: none;
}

.amap-search-input:focus {
  border-color: var(--el-color-primary);
}

:deep(.amap-sug-result) {
  z-index: 3000;
}

.map-marker {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid #ffffff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
}

.map-marker--pickup {
  background: #22c55e;
}

.map-marker--delivery {
  background: #ef4444;
}
</style>
