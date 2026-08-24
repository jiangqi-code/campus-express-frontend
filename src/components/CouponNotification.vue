<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  checkCouponNotification,
  claimCoupon,
  takeQueuedWelcomeCoupons,
  type UserCoupon,
} from '@/api/coupon'

const items = ref<UserCoupon[]>([])
const visible = ref(false)
const active = ref(0)
const claiming = ref(false)
const coupon = computed(() => items.value[active.value])

const valueText = (row: UserCoupon) =>
  row.coupon.type === 'CASH' ? `¥${Number(row.coupon.value).toFixed(0)}` : `减 ${Number(row.coupon.value)}%`
const condition = (row: UserCoupon) =>
  Number(row.coupon.min_order_amount) > 0
    ? `满 ¥${Number(row.coupon.min_order_amount).toFixed(2)} 可用`
    : '无门槛使用'

async function load() {
  const queued = takeQueuedWelcomeCoupons()
  if (queued.length) {
    items.value = queued
    visible.value = true
  }
  try {
    const remote = await checkCouponNotification()
    const merged = new Map<string, UserCoupon>()
    ;[...queued, ...remote].forEach((item) => merged.set(item.id, item))
    items.value = [...merged.values()]
  } catch {
    items.value = queued
  }
  visible.value = items.value.length > 0
}

async function claim() {
  const row = coupon.value
  if (!row || claiming.value) return
  claiming.value = true
  try {
    await claimCoupon(row.id)
    items.value.splice(active.value, 1)
    if (!items.value.length) {
      visible.value = false
    } else {
      active.value = Math.min(active.value, items.value.length - 1)
    }
    ElMessage.success('领取成功，优惠券已放入账户')
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || '领取失败')
  } finally {
    claiming.value = false
  }
}

onMounted(load)
</script>

<template>
  <el-dialog
    v-model="visible"
    class="coupon-dialog"
    width="420px"
    align-center
    destroy-on-close
    modal-class="coupon-dialog-overlay"
    :close-on-click-modal="false"
  >
    <div v-if="coupon" class="coupon-dialog__body">
      <img src="/favicon.svg" alt="" class="coupon-dialog__logo">
      <div class="coupon-dialog__eyebrow">校园跑腿新人礼</div>
      <div class="coupon-dialog__value">{{ valueText(coupon) }}</div>
      <h2>{{ coupon.coupon.name }}</h2>
      <div class="coupon-ticket">
        <span>{{ condition(coupon) }}</span>
        <span>有效期至 {{ new Date(coupon.expired_at).toLocaleDateString('zh-CN') }}</span>
      </div>
      <div v-if="items.length > 1" class="coupon-dialog__dots" aria-label="优惠券切换">
        <button
          v-for="(_, index) in items"
          :key="index"
          type="button"
          :class="{ active: index === active }"
          :aria-label="`查看第 ${index + 1} 张优惠券`"
          @click="active = index"
        />
      </div>
      <el-button class="coupon-dialog__claim" type="success" size="large" :loading="claiming" @click="claim">
        立即领取
      </el-button>
    </div>
  </el-dialog>
</template>

<style scoped>
.coupon-dialog__body { padding: 4px 12px 12px; text-align: center; }
.coupon-dialog__logo { width: 52px; height: 52px; border-radius: 8px; box-shadow: 0 8px 24px rgba(41, 72, 38, .14); }
.coupon-dialog__eyebrow { margin-top: 14px; color: #52c41a; font-size: 13px; font-weight: 800; }
.coupon-dialog__value { margin-top: 4px; color: #389e0d; font-size: 52px; font-weight: 900; line-height: 1.1; }
.coupon-dialog__body h2 { margin: 8px 0 18px; color: #253126; font-size: 22px; letter-spacing: 0; }
.coupon-ticket { display: flex; padding: 14px 16px; flex-direction: column; gap: 6px; border: 1px dashed #a9d89a; border-radius: 8px; background: rgba(246, 255, 237, .82); color: #657064; font-size: 13px; }
.coupon-dialog__dots { display: flex; min-height: 32px; align-items: center; justify-content: center; gap: 7px; }
.coupon-dialog__dots button { width: 7px; height: 7px; padding: 0; border: 0; border-radius: 50%; background: #cfd8cc; transition: width .2s ease, background-color .2s ease; }
.coupon-dialog__dots button.active { width: 22px; border-radius: 4px; background: #52c41a; }
.coupon-dialog__claim { width: 100%; border-color: #52c41a; border-radius: 8px; background: #52c41a; font-weight: 700; }
:global(.coupon-dialog.el-dialog) { overflow: hidden; border: 1px solid rgba(255, 255, 255, .72); border-radius: 8px; background: rgba(255, 255, 255, .92); box-shadow: 0 28px 90px rgba(30, 72, 34, .24); backdrop-filter: blur(20px); }
:global(.coupon-dialog .el-dialog__header) { padding: 14px 16px 0; }
:global(.coupon-dialog .el-dialog__body) { padding: 0 20px 20px; }
:global(.coupon-dialog .el-dialog__headerbtn) { top: 10px; right: 10px; width: 36px; height: 36px; }
:global(.coupon-dialog-overlay) { backdrop-filter: blur(8px); }
@media (max-width: 520px) {
  :global(.coupon-dialog.el-dialog) {
    width: calc(100% - 32px) !important;
    height: auto !important;
    max-height: calc(100vh - 32px);
    margin: auto 16px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .coupon-dialog__dots button { transition: none; }
}
</style>
