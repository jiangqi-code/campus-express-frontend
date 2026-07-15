<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { getGivenReviews, getReceivedReviews, type ReviewListItem } from '@/api/review'

type ReviewTab = 'received' | 'given'

const router = useRouter()

const activeTab = ref<ReviewTab>('received')
const loading = ref(false)
const errorMessage = ref('')
const reviews = ref<ReviewListItem[]>([])

const ratingOptions = [
  { label: '全部评分', value: 0 },
  { label: '5 星', value: 5 },
  { label: '4 星', value: 4 },
  { label: '3 星', value: 3 },
  { label: '2 星', value: 2 },
  { label: '1 星', value: 1 },
]

const filters = reactive({
  rating: 0,
})

const pagination = reactive({
  page: 1,
  pageSize: 10,
  total: 0,
})

const emptyDescription = computed(() => (activeTab.value === 'received' ? '暂未收到评价' : '暂未发出评价'))

function getErrorMessage(err: any) {
  return (
    err?.response?.data?.message ||
    err?.response?.data?.msg ||
    err?.response?.data?.error ||
    err?.message ||
    '加载评价失败'
  )
}

function formatDateTime(value: string) {
  const text = String(value ?? '').trim()
  if (!text) return '-'
  const date = new Date(text)
  if (Number.isNaN(date.getTime())) return text
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function goToOrderDetail(orderId: string) {
  const id = String(orderId ?? '').trim()
  if (!id) return
  router.push({ name: 'order-track', params: { orderId: id } })
}

async function fetchReviews() {
  loading.value = true
  errorMessage.value = ''

  try {
    const query = {
      page: pagination.page,
      pageSize: pagination.pageSize,
      rating: filters.rating || undefined,
    }

    const result =
      activeTab.value === 'received' ? await getReceivedReviews(query) : await getGivenReviews(query)

    reviews.value = result.items
    pagination.total = result.total
    pagination.page = result.page || pagination.page
    pagination.pageSize = result.pageSize || pagination.pageSize
  } catch (err: any) {
    reviews.value = []
    pagination.total = 0
    errorMessage.value = getErrorMessage(err)
  } finally {
    loading.value = false
  }
}

function handleTabChange() {
  pagination.page = 1
  fetchReviews()
}

function handleFilterChange() {
  pagination.page = 1
  fetchReviews()
}

function handleCurrentChange(page: number) {
  pagination.page = page
  fetchReviews()
}

function handleSizeChange(size: number) {
  pagination.pageSize = size
  pagination.page = 1
  fetchReviews()
}

watch(
  () => activeTab.value,
  () => {
    handleTabChange()
  },
)

onMounted(() => {
  fetchReviews()
})
</script>

<template>
  <div class="review-page vstack gap-3">
    <div class="d-flex flex-wrap align-items-end justify-content-between gap-3">
      <div>
        <h1 class="h4 mb-1">我的评价</h1>
        <div class="text-muted">查看收到的评价和发出的评价</div>
      </div>

      <div class="d-flex flex-wrap align-items-center gap-2">
        <el-select v-model="filters.rating" style="width: 150px" @change="handleFilterChange">
          <el-option
            v-for="option in ratingOptions"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </el-select>
        <el-button :loading="loading" @click="fetchReviews">刷新</el-button>
      </div>
    </div>

    <div class="review-panel">
      <el-tabs v-model="activeTab" class="review-tabs">
        <el-tab-pane label="收到的评价" name="received" />
        <el-tab-pane label="发出的评价" name="given" />
      </el-tabs>

      <div v-if="errorMessage" class="alert alert-danger mb-3" role="alert">
        {{ errorMessage }}
      </div>

      <div v-loading="loading" class="review-content">
        <template v-if="reviews.length > 0">
          <div class="review-list">
            <div v-for="item in reviews" :key="item.id" class="review-card">
              <div class="review-card__header">
                <div class="d-flex flex-wrap align-items-center gap-3">
                  <div class="d-flex align-items-center gap-2">
                    <span class="review-label">评分</span>
                    <el-rate :model-value="item.rating" disabled show-score text-color="#ff9900" />
                  </div>

                  <div class="review-meta">
                    <span class="review-label">
                      {{ activeTab === 'received' ? '评价人' : '被评价人' }}
                    </span>
                    <span class="review-meta__value">
                      {{ activeTab === 'received' ? item.reviewerNickname || '-' : item.revieweeNickname || '-' }}
                    </span>
                  </div>
                </div>

                <div class="review-time">{{ formatDateTime(item.createdAt) }}</div>
              </div>

              <div class="review-card__body">
                <div class="review-content-text">
                  {{ item.content || '用户未填写文字评价' }}
                </div>

                <div v-if="item.tags.length > 0" class="review-tags">
                  <el-tag v-for="tag in item.tags" :key="`${item.id}-${tag}`" type="primary" effect="light">
                    {{ tag }}
                  </el-tag>
                </div>

                <div class="review-footer">
                  <span class="review-label">关联订单</span>
                  <el-link type="primary" :underline="false" @click="goToOrderDetail(item.orderId)">
                    {{ item.orderId || '-' }}
                  </el-link>
                </div>
              </div>
            </div>
          </div>

          <div class="d-flex justify-content-end mt-4">
            <el-pagination
              v-model:current-page="pagination.page"
              v-model:page-size="pagination.pageSize"
              :total="pagination.total"
              :page-sizes="[10, 20, 50]"
              layout="total, sizes, prev, pager, next, jumper"
              @current-change="handleCurrentChange"
              @size-change="handleSizeChange"
            />
          </div>
        </template>

        <div v-else class="review-empty">
          <el-empty :description="emptyDescription" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.review-panel {
  background: #ffffff;
  border-radius: 18px;
  padding: 20px;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.06);
}

.review-content {
  min-height: 240px;
}

.review-list {
  display: grid;
  gap: 16px;
}

.review-card {
  background: #ffffff;
  border-radius: 16px;
  border: 1px solid rgba(67, 97, 238, 0.08);
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.05);
  padding: 20px;
}

.review-card__header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.review-card__body {
  display: grid;
  gap: 14px;
}

.review-content-text {
  color: #1f2937;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
}

.review-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.review-footer,
.review-meta {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #6b7280;
  font-size: 14px;
}

.review-meta__value,
.review-time {
  color: #374151;
  font-size: 14px;
}

.review-label {
  color: #6b7280;
  font-size: 14px;
}

.review-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 320px;
}

:deep(.review-tabs .el-tabs__nav-wrap::after) {
  background-color: rgba(67, 97, 238, 0.12);
}

@media (max-width: 768px) {
  .review-panel {
    padding: 16px;
  }

  .review-card {
    padding: 16px;
  }
}
</style>
