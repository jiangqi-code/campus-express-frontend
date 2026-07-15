<template>
  <div class="p-4 sensitive-words-page">
    <div class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
      <div>
        <h2 class="h4 mb-1">敏感词管理</h2>
        <p class="text-muted small mb-0">点击词云中的词可快速删除；悬浮显示“点击删除”提示</p>
      </div>
      <div class="d-flex gap-2 flex-wrap">
        <el-button :icon="RefreshRight" :loading="loading" @click="loadWords">刷新</el-button>
      </div>
    </div>

    <div class="sensitive-words-grid">
      <el-card shadow="never" class="border cloud-card">
        <div ref="cloudWrapRef" class="cloud-wrap">
          <canvas ref="canvasRef" class="cloud-canvas" @mousemove="onCanvasMove" @mouseleave="onCanvasLeave" @click="onCanvasClick" />
          <div v-if="hoveredWord" class="cloud-tooltip" :style="{ left: `${tooltipX}px`, top: `${tooltipY}px` }">点击删除</div>
          <div v-if="!loading && words.length === 0" class="cloud-empty">暂无敏感词</div>
        </div>
      </el-card>

      <el-card shadow="never" class="border manage-card">
        <div class="d-flex align-items-center justify-content-between mb-3">
          <div class="fw-semibold">敏感词列表</div>
          <div class="text-muted small">总数：{{ words.length }}</div>
        </div>

        <div class="mb-3">
          <div class="text-muted small mb-2">单个添加</div>
          <div class="d-flex gap-2">
            <el-input v-model="singleWord" placeholder="输入敏感词" @keyup.enter="addSingle" />
            <el-button type="primary" :loading="adding" @click="addSingle">添加</el-button>
          </div>
        </div>

        <div class="mb-3">
          <div class="text-muted small mb-2">批量添加（每行一个）</div>
          <el-input v-model="batchText" type="textarea" :rows="5" placeholder="例如：&#10;脏话1&#10;脏话2" />
          <div class="d-flex gap-2 mt-2">
            <el-button type="primary" plain :loading="adding" @click="addBatch">批量添加</el-button>
            <el-button :disabled="adding" @click="batchText = ''">清空</el-button>
          </div>
        </div>

        <el-divider class="my-3" />

        <el-scrollbar height="420px">
          <div class="word-list">
            <div v-for="w in words" :key="w" class="word-item">
              <span class="word-text">{{ w }}</span>
              <el-button
                type="danger"
                link
                :icon="Delete"
                :loading="deletingWord === w"
                @click="removeWord(w)"
                aria-label="删除"
              />
            </div>
          </div>
        </el-scrollbar>
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Delete, RefreshRight } from '@element-plus/icons-vue'

import { addSensitiveWord, deleteSensitiveWord, listSensitiveWords } from '@/api/admin'

const loading = ref(false)
const adding = ref(false)
const deletingWord = ref('')

const words = ref<string[]>([])

const singleWord = ref('')
const batchText = ref('')

const canvasRef = ref<HTMLCanvasElement | null>(null)
const cloudWrapRef = ref<HTMLDivElement | null>(null)

type Placement = {
  word: string
  x: number
  y: number
  fontSize: number
  color: string
  w: number
  h: number
}

const placements = ref<Placement[]>([])
const hoveredWord = ref('')
const tooltipX = ref(0)
const tooltipY = ref(0)

let resizeObserver: ResizeObserver | null = null

function getErrorMessage(err: any) {
  return err?.response?.data?.message || err?.response?.data?.msg || err?.message || '操作失败'
}

function parseWords(text: string) {
  const raw = String(text ?? '')
    .split(/[\n\r,]+/g)
    .map((x) => x.trim())
    .filter((x) => x)
  return Array.from(new Set(raw))
}

function hashToUnit(word: string) {
  const s = String(word ?? '')
  let h = 2166136261
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4294967295
}

function randomPastelColor(seed: number) {
  const h = Math.floor(seed * 360)
  const s = 45 + Math.floor(((seed * 7) % 1) * 15)
  const l = 60 + Math.floor(((seed * 13) % 1) * 14)
  return `hsl(${h}, ${s}%, ${l}%)`
}

function calcFontSize(word: string) {
  const t = hashToUnit(word)
  const min = 12
  const max = 60
  const eased = Math.pow(t, 0.6)
  return Math.round(min + (max - min) * eased)
}

function ensureCanvasSize() {
  const wrap = cloudWrapRef.value
  const canvas = canvasRef.value
  if (!wrap || !canvas) return { w: 0, h: 0, dpr: 1 }
  const rect = wrap.getBoundingClientRect()
  const w = Math.max(240, Math.floor(rect.width))
  const h = Math.max(360, Math.floor(rect.height))
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1))
  canvas.style.width = `${w}px`
  canvas.style.height = `${h}px`
  canvas.width = Math.floor(w * dpr)
  canvas.height = Math.floor(h * dpr)
  const ctx = canvas.getContext('2d')
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  return { w, h, dpr }
}

function buildPlacements(w: number, h: number) {
  const canvas = canvasRef.value
  if (!canvas) return []
  const ctx = canvas.getContext('2d')
  if (!ctx) return []

  const padding = 10
  const cx = w / 2
  const cy = h / 2

  const entries = words.value
    .map((word) => {
      const seed = hashToUnit(word)
      return {
        word,
        seed,
        fontSize: calcFontSize(word),
        color: randomPastelColor(seed),
      }
    })
    .sort((a, b) => b.fontSize - a.fontSize)

  const placed: Placement[] = []
  const maxAttempts = 1200
  const spiralStep = 0.35
  const radiusStep = 2.2

  for (const e of entries) {
    const baseSize = e.fontSize
    ctx.font = `${baseSize}px sans-serif`
    const textW = ctx.measureText(e.word).width
    const textH = baseSize * 1.1
    const ww = Math.ceil(textW + 10)
    const hh = Math.ceil(textH + 8)

    let found = false
    for (let i = 0; i < maxAttempts; i += 1) {
      const angle = i * spiralStep
      const radius = i * radiusStep * 0.08
      const x = cx + radius * Math.cos(angle)
      const y = cy + radius * Math.sin(angle)
      const left = x - ww / 2
      const top = y - hh / 2
      const right = left + ww
      const bottom = top + hh

      if (left < padding || top < padding || right > w - padding || bottom > h - padding) continue

      let overlap = false
      for (const p of placed) {
        const l2 = p.x - p.w / 2
        const t2 = p.y - p.h / 2
        const r2 = l2 + p.w
        const b2 = t2 + p.h
        if (!(right < l2 || left > r2 || bottom < t2 || top > b2)) {
          overlap = true
          break
        }
      }
      if (overlap) continue

      placed.push({
        word: e.word,
        x,
        y,
        fontSize: baseSize,
        color: e.color,
        w: ww,
        h: hh,
      })
      found = true
      break
    }

    if (!found) continue
  }

  return placed
}

function drawCloud() {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const wrap = cloudWrapRef.value
  const rect = wrap?.getBoundingClientRect()
  const w = rect ? Math.floor(rect.width) : Math.floor(canvas.width)
  const h = rect ? Math.floor(rect.height) : Math.floor(canvas.height)

  ctx.clearRect(0, 0, w, h)

  const hovered = hoveredWord.value
  const updated: Placement[] = []

  for (const p of placements.value) {
    const isHover = hovered && p.word === hovered
    const size = isHover ? Math.min(72, Math.round(p.fontSize * 1.25)) : p.fontSize
    ctx.font = `${size}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = p.color
    ctx.fillText(p.word, p.x, p.y)

    const textW = ctx.measureText(p.word).width
    const textH = size * 1.1
    updated.push({
      ...p,
      fontSize: size,
      w: Math.ceil(textW + 10),
      h: Math.ceil(textH + 8),
    })
  }

  placements.value = updated
}

async function rebuildCloud() {
  await nextTick()
  const { w, h } = ensureCanvasSize()
  if (!w || !h) return
  placements.value = buildPlacements(w, h)
  drawCloud()
}

async function loadWords() {
  loading.value = true
  try {
    const list = await listSensitiveWords()
    words.value = [...list].sort((a, b) => a.localeCompare(b))
    hoveredWord.value = ''
    await rebuildCloud()
  } catch (err: any) {
    ElMessage.error(getErrorMessage(err) || '加载敏感词失败')
  } finally {
    loading.value = false
  }
}

async function removeWord(w: string) {
  const word = String(w ?? '').trim()
  if (!word) return

  deletingWord.value = word
  try {
    await deleteSensitiveWord(word)
    ElMessage.success('删除成功')
    await loadWords()
  } catch (err: any) {
    ElMessage.error(getErrorMessage(err))
  } finally {
    deletingWord.value = ''
  }
}

async function addSingle() {
  const list = parseWords(singleWord.value)
  const word = list[0]
  if (!word) {
    ElMessage.warning('请输入敏感词')
    return
  }
  adding.value = true
  try {
    await addSensitiveWord(word)
    ElMessage.success('添加成功')
    singleWord.value = ''
    await loadWords()
  } catch (err: any) {
    ElMessage.error(getErrorMessage(err))
  } finally {
    adding.value = false
  }
}

async function addBatch() {
  const list = parseWords(batchText.value)
  if (list.length === 0) {
    ElMessage.warning('请输入敏感词')
    return
  }
  adding.value = true
  try {
    for (const w of list) {
      await addSensitiveWord(w)
    }
    ElMessage.success(`已添加 ${list.length} 个敏感词`)
    batchText.value = ''
    await loadWords()
  } catch (err: any) {
    ElMessage.error(getErrorMessage(err))
  } finally {
    adding.value = false
  }
}

function findHitWord(x: number, y: number) {
  for (let i = placements.value.length - 1; i >= 0; i -= 1) {
    const p = placements.value[i]
    const left = p.x - p.w / 2
    const top = p.y - p.h / 2
    const right = left + p.w
    const bottom = top + p.h
    if (x >= left && x <= right && y >= top && y <= bottom) return p.word
  }
  return ''
}

function onCanvasMove(e: MouseEvent) {
  const canvas = canvasRef.value
  const wrap = cloudWrapRef.value
  if (!canvas || !wrap) return
  const rect = canvas.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top

  const hit = findHitWord(x, y)
  canvas.style.cursor = hit ? 'pointer' : 'default'
  if (hit !== hoveredWord.value) {
    hoveredWord.value = hit
    drawCloud()
  }

  if (hit) {
    tooltipX.value = Math.min(rect.width - 10, Math.max(10, x + 12))
    tooltipY.value = Math.min(rect.height - 10, Math.max(10, y + 12))
  }
}

function onCanvasLeave() {
  if (!hoveredWord.value) return
  hoveredWord.value = ''
  drawCloud()
}

async function onCanvasClick() {
  const word = hoveredWord.value
  if (!word) return
  if (deletingWord.value) return
  await removeWord(word)
}

onMounted(() => {
  loadWords()

  const wrap = cloudWrapRef.value
  if (wrap) {
    resizeObserver = new ResizeObserver(() => {
      rebuildCloud()
    })
    resizeObserver.observe(wrap)
  }
})

onBeforeUnmount(() => {
  if (resizeObserver && cloudWrapRef.value) resizeObserver.unobserve(cloudWrapRef.value)
  resizeObserver = null
})
</script>

<style scoped>
.sensitive-words-grid {
  display: grid;
  grid-template-columns: 7fr 3fr;
  gap: 12px;
}

.cloud-wrap {
  position: relative;
  width: 100%;
  height: 560px;
  overflow: hidden;
}

.cloud-canvas {
  width: 100%;
  height: 100%;
  cursor: default;
  display: block;
}

.cloud-tooltip {
  position: absolute;
  transform: translate(0, 0);
  padding: 6px 10px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.75);
  color: #fff;
  font-size: 12px;
  pointer-events: none;
  white-space: nowrap;
}

.cloud-empty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(0, 0, 0, 0.45);
  font-size: 14px;
}

.word-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-right: 6px;
}

.word-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.03);
}

.word-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
}

@media (max-width: 992px) {
  .sensitive-words-grid {
    grid-template-columns: 1fr;
  }

  .cloud-wrap {
    height: 420px;
  }
}
</style>
