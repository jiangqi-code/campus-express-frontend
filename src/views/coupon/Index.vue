<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'

import {
  checkCouponNotification,
  claimCoupon,
  getClaimableCoupons,
  getMyCoupons,
  receiveCoupon,
  type ClaimableCoupon,
  type Coupon,
  type UserCoupon,
} from '@/api/coupon'

type CouponTab = 'PENDING' | 'CLAIMABLE' | 'UNUSED' | 'USED' | 'EXPIRED'
type CouponItem = UserCoupon | ClaimableCoupon

const tab = ref<CouponTab>('PENDING')
const loading = ref(false)
const actionId = ref('')
const list = ref<CouponItem[]>([])
const pendingCount = ref(0)

const emptyText = computed(() => {
  if (tab.value === 'PENDING') return '暂无待领取优惠券'
  if (tab.value === 'CLAIMABLE') return '暂无可领取优惠券'
  return '当前分类暂无优惠券'
})

const formatDate = (value: string) => new Date(value).toLocaleDateString('zh-CN')
const couponFor = (item: CouponItem): Coupon => ('coupon' in item ? item.coupon : item)
const expiresAt = (item: CouponItem) => ('coupon' in item ? item.expired_at : item.end_date)
const isUserCoupon = (item: CouponItem): item is UserCoupon => 'coupon' in item
const canReceive = (item: CouponItem) => !isUserCoupon(item) && item.can_receive
const valueText = (coupon: Coupon) =>
  coupon.type === 'CASH' ? `¥${Number(coupon.value).toFixed(2)}` : `减 ${Number(coupon.value)}%`
const conditionText = (coupon: Coupon) =>
  Number(coupon.min_order_amount) > 0
    ? `满 ¥${Number(coupon.min_order_amount).toFixed(2)} 可用`
    : '无门槛使用'

async function load() {
  loading.value = true
  try {
    if (tab.value === 'PENDING') {
      const rows = await checkCouponNotification()
      list.value = rows
      pendingCount.value = rows.length
      return
    }

    if (tab.value === 'CLAIMABLE') {
      list.value = await getClaimableCoupons()
      return
    }

    const result = await getMyCoupons({ page: 1, pageSize: 100, status: tab.value })
    list.value = result.list
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || '优惠券加载失败')
  } finally {
    loading.value = false
  }
}

async function claimPending(item: CouponItem) {
  if (!isUserCoupon(item)) return
  if (actionId.value) return
  actionId.value = item.id
  try {
    await claimCoupon(item.id)
    ElMessage.success('领取成功，已放入我的优惠券')
    await load()
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || '领取失败')
  } finally {
    actionId.value = ''
  }
}

async function claimPublic(item: CouponItem) {
  if (isUserCoupon(item) || actionId.value || !item.can_receive) return
  actionId.value = item.id
  try {
    await receiveCoupon(item.id)
    ElMessage.success('领取成功，已放入我的优惠券')
    tab.value = 'UNUSED'
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || '领取失败')
  } finally {
    actionId.value = ''
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
        <p>待领取、可领取和已领取优惠券都在这里管理。</p>
      </div>
      <el-button plain :loading="loading" @click="load">刷新</el-button>
    </header>

    <el-tabs v-model="tab" class="coupon-tabs">
      <el-tab-pane :label="pendingCount ? `待领取 (${pendingCount})` : '待领取'" name="PENDING" />
      <el-tab-pane label="领券中心" name="CLAIMABLE" />
      <el-tab-pane label="未使用" name="UNUSED" />
      <el-tab-pane label="已使用" name="USED" />
      <el-tab-pane label="已过期" name="EXPIRED" />
    </el-tabs>

    <el-empty v-if="!loading && !list.length" :description="emptyText" />
    <div v-else class="coupon-grid">
      <article
        v-for="item in list"
        :key="item.id"
        class="coupon-card"
        :class="{ muted: 'status' in item && item.status !== 'UNUSED' }"
      >
        <div class="coupon-card__value">
          <strong>{{ valueText(couponFor(item)) }}</strong>
          <span>{{ couponFor(item).type === 'CASH' ? '现金券' : '折扣券' }}</span>
        </div>

        <div class="coupon-card__info">
          <h2>{{ couponFor(item).name }}</h2>
          <span>{{ conditionText(couponFor(item)) }}</span>
          <small>有效期至 {{ formatDate(expiresAt(item)) }}</small>
          <small v-if="tab === 'PENDING'" class="coupon-card__pending">系统已发放，等待领取</small>
        </div>

        <div class="coupon-card__action">
          <el-button
            v-if="tab === 'PENDING'"
            type="success"
            :loading="actionId === item.id"
            @click="claimPending(item)"
          >
            立即领取
          </el-button>
          <el-button
            v-else-if="tab === 'CLAIMABLE'"
            type="success"
            :disabled="!canReceive(item)"
            :loading="actionId === item.id"
            @click="claimPublic(item)"
          >
            {{ canReceive(item) ? '立即领取' : '已达限领' }}
          </el-button>
          <RouterLink v-else-if="'status' in item && item.status === 'UNUSED'" class="coupon-card__use" to="/task/publish">
            去使用
          </RouterLink>
          <span v-else class="coupon-card__status">
            {{ 'status' in item && item.status === 'USED' ? '已使用' : '已过期' }}
          </span>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.coupon-page { max-width: 1080px; margin: 0 auto; }
.coupon-page header { display: flex; margin-bottom: 16px; align-items: flex-end; justify-content: space-between; gap: 16px; }
.coupon-page h1 { margin: 0; color: #253126; font-size: 28px; letter-spacing: 0; }
.coupon-page p { margin: 8px 0 0; color: #64748b; }
.coupon-tabs { margin-bottom: 18px; }
.coupon-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.coupon-card { position: relative; display: grid; min-height: 156px; padding: 20px; grid-template-columns: 112px minmax(0, 1fr) auto; align-items: center; gap: 18px; overflow: hidden; border: 1px solid #d8ebd2; border-radius: 8px; background: #fff; box-shadow: 0 12px 32px rgba(45, 91, 44, .08); }
.coupon-card::before { position: absolute; top: 18px; bottom: 18px; left: 131px; border-left: 1px dashed #b9dcae; content: ''; }
.coupon-card__value { display: flex; align-items: center; flex-direction: column; color: #389e0d; text-align: center; }
.coupon-card__value strong { font-size: 28px; line-height: 1.1; }
.coupon-card__value span { margin-top: 8px; color: #7b9c72; font-size: 12px; }
.coupon-card__info { display: flex; min-width: 0; padding-left: 10px; flex-direction: column; gap: 6px; }
.coupon-card__info h2 { overflow: hidden; margin: 0; color: #253126; font-size: 17px; letter-spacing: 0; text-overflow: ellipsis; white-space: nowrap; }
.coupon-card__info span, .coupon-card__info small { color: #69766b; }
.coupon-card__pending { color: #b45309 !important; font-weight: 700; }
.coupon-card__action { display: flex; min-width: 82px; justify-content: flex-end; }
.coupon-card__action :deep(.el-button) { min-width: 82px; border-radius: 8px; }
.coupon-card__use { display: inline-flex; min-width: 82px; min-height: 38px; padding: 0 16px; align-items: center; justify-content: center; border-radius: 8px; background: #52c41a; color: #fff; font-size: 14px; font-weight: 700; text-decoration: none; transition: background-color 160ms ease-out; }
.coupon-card__use:hover { background: #389e0d; }
.coupon-card__use:focus-visible { outline: 3px solid rgba(82, 196, 26, .35); outline-offset: 2px; }
.coupon-card__status { color: #64748b; font-size: 14px; font-weight: 700; }
.coupon-card.muted { filter: grayscale(.72); opacity: .68; }
:deep(.el-tabs__active-bar) { background: #52c41a; }
:deep(.el-tabs__item.is-active), :deep(.el-tabs__item:hover) { color: #389e0d; }
@media (hover: hover) and (pointer: fine) {
  .coupon-card { transition: border-color 160ms ease-out, box-shadow 160ms ease-out, transform 160ms ease-out; }
  .coupon-card:hover { border-color: #9bd48b; box-shadow: 0 16px 34px rgba(45, 91, 44, .12); transform: translateY(-2px); }
}
@media (max-width: 860px) {
  .coupon-grid { grid-template-columns: 1fr; }
}
@media (max-width: 560px) {
  .coupon-page header { align-items: flex-start; }
  .coupon-card { grid-template-columns: 88px minmax(0, 1fr); padding: 16px; gap: 14px; }
  .coupon-card::before { left: 111px; }
  .coupon-card__value strong { font-size: 24px; }
  .coupon-card__action { grid-column: 2; justify-content: flex-start; }
}
@media (prefers-reduced-motion: reduce) {
  .coupon-card, .coupon-card__use { transition: none; }
}
</style>
