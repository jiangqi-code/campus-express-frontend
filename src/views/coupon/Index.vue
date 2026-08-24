<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'

import { getMyCoupons, type Coupon, type UserCoupon } from '@/api/coupon'

type CouponTab = 'UNUSED' | 'USED' | 'EXPIRED'

const tab = ref<CouponTab>('UNUSED')
const loading = ref(false)
const list = ref<UserCoupon[]>([])

const formatDate = (value: string) => new Date(value).toLocaleDateString('zh-CN')
const valueText = (coupon: Coupon) =>
  coupon.type === 'CASH' ? `¥${Number(coupon.value).toFixed(2)}` : `减 ${Number(coupon.value)}%`
const conditionText = (coupon: Coupon) =>
  Number(coupon.min_order_amount) > 0
    ? `满 ¥${Number(coupon.min_order_amount).toFixed(2)} 可用`
    : '无门槛使用'

async function load() {
  loading.value = true
  try {
    const result = await getMyCoupons({ page: 1, pageSize: 100, status: tab.value })
    list.value = result.list
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || '优惠券加载失败')
  } finally {
    loading.value = false
  }
}

watch(tab, load)
onMounted(load)
</script>

<template>
  <section class="coupon-page" v-loading="loading">
    <header>
      <div>
        <h1>我的优惠券</h1>
        <p>发布任务结算时，可选择满足条件的优惠券抵扣配送费。</p>
      </div>
    </header>

    <el-tabs v-model="tab" class="coupon-tabs">
      <el-tab-pane label="未使用" name="UNUSED" />
      <el-tab-pane label="已使用" name="USED" />
      <el-tab-pane label="已过期" name="EXPIRED" />
    </el-tabs>

    <el-empty v-if="!loading && !list.length" description="当前分类暂无优惠券" />
    <div v-else class="coupon-grid">
      <article v-for="item in list" :key="item.id" class="coupon-card" :class="{ muted: item.status !== 'UNUSED' }">
        <div class="coupon-card__value">
          <strong>{{ valueText(item.coupon) }}</strong>
          <span>{{ item.coupon.type === 'CASH' ? '现金券' : '折扣券' }}</span>
        </div>
        <div class="coupon-card__info">
          <h2>{{ item.coupon.name }}</h2>
          <span>{{ conditionText(item.coupon) }}</span>
          <small>有效期至 {{ formatDate(item.expired_at) }}</small>
        </div>
        <RouterLink v-if="item.status === 'UNUSED'" class="coupon-card__action" to="/task/publish">
          去使用
        </RouterLink>
        <span v-else class="coupon-card__status">{{ item.status === 'USED' ? '已使用' : '已过期' }}</span>
      </article>
    </div>
  </section>
</template>

<style scoped>
.coupon-page { max-width: 1080px; margin: 0 auto; }
.coupon-page header { display: flex; margin-bottom: 16px; align-items: flex-end; justify-content: space-between; }
.coupon-page h1 { margin: 0; color: #253126; font-size: 28px; letter-spacing: 0; }
.coupon-page p { margin: 8px 0 0; color: #64748b; }
.coupon-tabs { margin-bottom: 18px; }
.coupon-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.coupon-card { position: relative; display: grid; min-height: 148px; padding: 20px; grid-template-columns: 112px minmax(0, 1fr) auto; align-items: center; gap: 18px; overflow: hidden; border: 1px solid #d8ebd2; border-radius: 8px; background: #fff; box-shadow: 0 12px 32px rgba(45, 91, 44, .08); }
.coupon-card::before { position: absolute; top: 18px; bottom: 18px; left: 131px; border-left: 1px dashed #b9dcae; content: ''; }
.coupon-card__value { display: flex; align-items: center; flex-direction: column; color: #389e0d; text-align: center; }
.coupon-card__value strong { font-size: 28px; line-height: 1.1; }
.coupon-card__value span { margin-top: 8px; color: #7b9c72; font-size: 12px; }
.coupon-card__info { display: flex; min-width: 0; padding-left: 10px; flex-direction: column; gap: 6px; }
.coupon-card__info h2 { overflow: hidden; margin: 0; color: #253126; font-size: 17px; letter-spacing: 0; text-overflow: ellipsis; white-space: nowrap; }
.coupon-card__info span, .coupon-card__info small { color: #69766b; }
.coupon-card__action { display: inline-flex; min-height: 38px; padding: 0 16px; align-items: center; justify-content: center; border-radius: 8px; background: #52c41a; color: #fff; font-size: 14px; font-weight: 700; text-decoration: none; }
.coupon-card__action:hover { background: #389e0d; }
.coupon-card__status { color: #64748b; font-size: 14px; font-weight: 700; }
.coupon-card.muted { filter: grayscale(.72); opacity: .68; }
:deep(.el-tabs__active-bar) { background: #52c41a; }
:deep(.el-tabs__item.is-active), :deep(.el-tabs__item:hover) { color: #389e0d; }
@media (max-width: 860px) {
  .coupon-grid { grid-template-columns: 1fr; }
}
@media (max-width: 560px) {
  .coupon-card { grid-template-columns: 88px minmax(0, 1fr); padding: 16px; gap: 14px; }
  .coupon-card::before { left: 111px; }
  .coupon-card__value strong { font-size: 24px; }
  .coupon-card__action, .coupon-card__status { grid-column: 2; justify-self: start; }
}
</style>
