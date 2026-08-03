<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { checkCouponNotification, claimCoupon, type UserCoupon } from '@/api/coupon'

const items=ref<UserCoupon[]>([]),visible=ref(false),active=ref(0),claiming=ref(false)
const coupon=()=>items.value[active.value]
const valueText=(row:UserCoupon)=>row.coupon.type==='CASH'?`¥${Number(row.coupon.value).toFixed(0)}`:`${Number(row.coupon.value)}折`
const condition=(row:UserCoupon)=>Number(row.coupon.min_order_amount)>0?`满 ¥${Number(row.coupon.min_order_amount).toFixed(2)} 可用`:'无门槛'
async function load(){try{items.value=await checkCouponNotification();visible.value=items.value.length>0}catch{/* 静默检查 */}}
async function claim(){const row=coupon();if(!row||claiming.value)return;claiming.value=true;try{await claimCoupon(row.id);row.claimed_at=new Date().toISOString();ElMessage.success('优惠券已放入账户');setTimeout(()=>{if(active.value<items.value.length-1)active.value++;else visible.value=false},450)}catch(e:any){ElMessage.error(e?.response?.data?.message||'领取失败')}finally{claiming.value=false}}
onMounted(load)
</script>
<template><transition name="coupon-pop"><aside v-if="visible&&coupon()" class="coupon-notice"><button class="close" aria-label="关闭" @click="visible=false">×</button><img src="/favicon.svg" alt="" class="logo"><div class="eyebrow">一份校园小惊喜</div><div class="value">{{valueText(coupon())}}</div><h3>{{coupon().coupon.name}}</h3><p>{{condition(coupon())}} · {{new Date(coupon().expired_at).toLocaleDateString('zh-CN')}} 前有效</p><div v-if="items.length>1" class="dots"><i v-for="(_,i) in items" :key="i" :class="{active:i===active}" @click="active=i"/></div><el-button type="success" round size="large" :loading="claiming" @click="claim">立即领取</el-button></aside></transition></template>
<style scoped>.coupon-notice{position:fixed;right:28px;bottom:28px;z-index:2200;width:330px;padding:28px;text-align:center;border:1px solid rgba(82,196,26,.42);border-radius:24px;background:rgba(255,255,255,.9);box-shadow:0 24px 70px rgba(40,78,29,.2);backdrop-filter:blur(18px)}.close{position:absolute;right:14px;top:12px;border:0;background:transparent;color:#7b8b77;font-size:25px}.logo{width:48px;height:48px;border-radius:14px}.eyebrow{margin-top:10px;color:#52c41a;font-size:13px;font-weight:700}.value{margin-top:4px;color:#389e0d;font-size:48px;font-weight:900}.coupon-notice h3{margin:0;color:#263427}.coupon-notice p{margin:8px 0 18px;color:#73806f;font-size:13px}.coupon-notice .el-button{width:100%;background:#52c41a;border-color:#52c41a}.dots{display:flex;justify-content:center;gap:6px;margin-bottom:14px}.dots i{width:6px;height:6px;border-radius:50%;background:#d7dfd3}.dots i.active{width:18px;background:#52c41a}.coupon-pop-enter-active,.coupon-pop-leave-active{transition:all .3s ease}.coupon-pop-enter-from,.coupon-pop-leave-to{opacity:0;transform:translateY(18px)}@media(max-width:600px){.coupon-notice{right:16px;left:16px;bottom:16px;width:auto}}</style>
