<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { http } from '@/api/request'
const loading=ref(false),recharging=ref(false),balance=ref(0),frozen=ref(0),rechargeAmount=ref<number>()
const errorText=(e:any)=>e?.response?.data?.message||e?.response?.data?.msg||e?.message||'操作失败'
async function fetchWallet(){loading.value=true;try{const r=await http.get('/wallet/info'),x=r?.data?.data??r?.data?.wallet??r?.data??{};balance.value=Number(x.balance??x.money??x.available??0);frozen.value=Number(x.frozen??x.frozen_amount??x.locked??0)}catch(e:any){ElMessage.error(errorText(e))}finally{loading.value=false}}
async function recharge(){if(recharging.value)return;const amount=Number(rechargeAmount.value);if(!Number.isFinite(amount)||amount<1||amount>10000){ElMessage.warning('请输入1至10000元的充值金额');return}recharging.value=true;try{await http.post('/wallet/recharge',{amount});ElMessage.success('模拟充值成功');rechargeAmount.value=undefined;await fetchWallet()}catch(e:any){ElMessage.error(errorText(e))}finally{recharging.value=false}}
onMounted(fetchWallet)
</script>
<template><div class="wallet-page vstack gap-3" v-loading="loading">
  <div class="d-flex justify-content-between align-items-start gap-3"><div><h1 class="h4 mb-1">我的钱包</h1><div class="text-muted">账户余额与充值管理</div></div><RouterLink class="btn btn-outline-primary" to="/wallet/logs">查看钱包流水</RouterLink></div>
  <div class="row g-3"><div class="col-12 col-md-6"><div class="card border-0 shadow-sm h-100"><div class="card-body"><div class="text-muted small">可用余额</div><div class="display-6 fw-semibold mt-2">¥{{ balance.toFixed(2) }}</div><div class="text-muted small mt-3">冻结金额 ¥{{ frozen.toFixed(2) }}</div></div></div></div>
  <div class="col-12 col-md-6"><div class="card border-0 shadow-sm h-100"><div class="card-body"><div class="fw-semibold">模拟充值</div><div class="alert alert-info small mt-3 mb-3">此功能仅用于校园项目演示，不会发起真实支付，也不会从任何账户扣款。</div><form class="d-flex gap-2" @submit.prevent="recharge"><div class="input-group"><span class="input-group-text">¥</span><input v-model.number="rechargeAmount" class="form-control" type="number" min="1" max="10000" step="0.01" placeholder="充值金额" /></div><button class="btn btn-primary text-nowrap" type="submit" :disabled="recharging">{{ recharging?'处理中…':'模拟充值' }}</button></form></div></div></div></div>
</div></template>
<style scoped>.wallet-page{max-width:960px;margin:0 auto}</style>
