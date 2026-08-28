<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { http } from '@/api/request'

type FoodOptionChoice = { name: string; price_delta: number }
type FoodOptionGroup = { name: string; required: boolean; choices: FoodOptionChoice[] }
type FoodItem = { id: number; name: string; description?: string; price: number; stock: number; category_id?: number | null; option_groups?: FoodOptionGroup[] }
type SelectedOption = { group_name: string; choice_name: string; price_delta: number }
type CartLine = { key: string; menu_item_id: number; item_name: string; quantity: number; unit_price: number; selected_options: SelectedOption[] }

const route = useRoute(), router = useRouter()
const loading = ref(false), saving = ref(false), merchant = ref<any>(null), items = ref<FoodItem[]>([]), categories = ref<any[]>([]), coupons = ref<any[]>([]), selectedCouponId = ref(''), address = ref(''), phone = ref('')
const cart = reactive<Record<string, CartLine>>({})
const specDialog = ref(false), specItem = ref<FoodItem | null>(null), specSelections = reactive<Record<string, string>>({})
const data = (r: any) => r?.data?.data ?? r?.data ?? r ?? {}
const cartLines = computed(() => Object.values(cart))
const count = computed(() => cartLines.value.reduce((sum, line) => sum + line.quantity, 0))
const amount = computed(() => cartLines.value.reduce((sum, line) => sum + line.unit_price * line.quantity, 0))
const canOrder = computed(() => merchant.value?.is_orderable !== false)
const displayCategories = computed(() => [{ id: null, name: '全部菜品' }, ...categories.value])
const optionGroups = (item: FoodItem) => Array.isArray(item.option_groups) ? item.option_groups : []
const optionSummary = (line: CartLine) => line.selected_options.map(option => `${option.group_name}:${option.choice_name}`).join(' · ') || '标准'
const itemQuantity = (item: FoodItem) => cartLines.value.filter(line => line.menu_item_id === item.id).reduce((sum, line) => sum + line.quantity, 0)

function selectedOptions(item: FoodItem) {
  return optionGroups(item).flatMap((group) => {
    const choice = group.choices.find(item => item.name === specSelections[group.name])
    return choice ? [{ group_name: group.name, choice_name: choice.name, price_delta: Number(choice.price_delta || 0) }] : []
  })
}
function cartKey(item: FoodItem, selected: SelectedOption[]) { return `${item.id}:${selected.map(option => `${option.group_name}=${option.choice_name}`).join('|')}` }
function unitPrice(item: FoodItem, selected: SelectedOption[]) { return Number(item.price) + selected.reduce((sum, option) => sum + Number(option.price_delta || 0), 0) }
function addLine(item: FoodItem, selected: SelectedOption[], delta = 1) {
  const key = cartKey(item, selected), current = cart[key], nextQuantity = (current?.quantity || 0) + delta
  const total = itemQuantity(item) + delta
  if (item.stock >= 0 && total > item.stock) return ElMessage.warning('库存不足')
  if (nextQuantity <= 0) delete cart[key]
  else cart[key] = { key, menu_item_id: item.id, item_name: item.name, quantity: nextQuantity, unit_price: unitPrice(item, selected), selected_options: selected }
}
function openItem(item: FoodItem) {
  if (!canOrder.value) return ElMessage.warning('商家当前不在营业时段')
  if (!optionGroups(item).length) return addLine(item, [])
  specItem.value = item
  Object.keys(specSelections).forEach(key => delete specSelections[key])
  optionGroups(item).forEach(group => { if (group.required) specSelections[group.name] = group.choices[0]?.name || '' })
  specDialog.value = true
}
function removeItem(item: FoodItem) {
  const line = cartLines.value.find(row => row.menu_item_id === item.id)
  if (line) addLine(item, line.selected_options, -1)
}
function addSpecifiedItem() {
  if (!specItem.value) return
  const missing = optionGroups(specItem.value).find(group => group.required && !specSelections[group.name])
  if (missing) return ElMessage.warning(`请选择${missing.name}`)
  addLine(specItem.value, selectedOptions(specItem.value)); specDialog.value = false
}
function removeLine(line: CartLine) { delete cart[line.key] }
async function load() {
  loading.value = true
  try {
    const [shop, couponResult] = await Promise.all([http.get(`/food/merchants/${route.params.id}`), http.get('/coupons/usable')])
    const result = data(shop); merchant.value = result.merchant; items.value = result.menu_items || []; categories.value = result.categories || []
    const couponData = data(couponResult); coupons.value = Array.isArray(couponData) ? couponData : (couponData.list || [])
  } catch (error: any) { ElMessage.error(error?.response?.data?.error || error.message || '菜单加载失败') } finally { loading.value = false }
}
async function submit() {
  if (!canOrder.value) return ElMessage.warning('商家当前不在营业时段')
  if (!cartLines.value.length) return
  if (!address.value.trim()) return ElMessage.warning('请填写收餐地点')
  saving.value = true
  try {
    const created = data(await http.post('/food/orders', { merchant_id: merchant.value.id, items: cartLines.value.map(line => ({ id: line.menu_item_id, quantity: line.quantity, selected_options: line.selected_options })), user_coupon_id: selectedCouponId.value || undefined, delivery_address: address.value, contact_phone: phone.value })).order
    await http.post(`/food/orders/${created.id}/pay`, {})
    ElMessage.success('支付成功，等待商家接单'); router.push('/food/orders')
  } catch (error: any) { ElMessage.error(error?.response?.data?.error || error.message || '下单失败') } finally { saving.value = false }
}
onMounted(load)
</script>
<template><section class="food-shop" v-loading="loading"><header v-if="merchant"><div><span>CAMPUS FOOD · MENU</span><h2>{{merchant.name}}</h2><p>{{merchant.announcement||merchant.description||merchant.address}}</p></div><el-tag :type="canOrder?'success':'info'">{{canOrder?`预计 ${merchant.prepare_minutes||15} 分钟备餐`:'当前不在营业时段'}}</el-tag></header><div class="layout"><section class="menu"><el-empty v-if="!items.length" description="商家暂未上架菜品"/><template v-for="category in displayCategories" :key="category.id"><h3>{{category.name}}</h3><article v-for="item in items.filter(v=>!category.id||v.category_id===category.id)" :key="item.id"><div><strong>{{item.name}}</strong><p>{{item.description||'新鲜现做'}}</p><b>¥{{Number(item.price).toFixed(2)}}</b><small v-if="optionGroups(item).length">可选{{optionGroups(item).map(group=>group.name).join('、')}}</small></div><div class="item-actions"><el-button v-if="optionGroups(item).length" plain type="primary" :disabled="!canOrder" @click="openItem(item)">选规格</el-button><el-button circle :disabled="!itemQuantity(item)" @click="removeItem(item)">−</el-button><span>{{itemQuantity(item)}}</span><el-button circle type="primary" :disabled="!canOrder" @click="openItem(item)">＋</el-button></div></article></template></section><aside class="checkout"><h3>购物车</h3><p>{{count?`${count} 份菜品 · ¥${amount.toFixed(2)}`:'请选择菜品'}}</p><div v-if="cartLines.length" class="cart-lines"><div v-for="line in cartLines" :key="line.key"><div><strong>{{line.item_name}} ×{{line.quantity}}</strong><small>{{optionSummary(line)}}</small></div><div><b>¥{{(line.unit_price*line.quantity).toFixed(2)}}</b><el-button link type="danger" @click="removeLine(line)">移除</el-button></div></div></div><el-alert v-if="!canOrder" title="商家当前已打烊，暂不能下单" type="warning" :closable="false" show-icon/><el-select v-if="coupons.length" v-model="selectedCouponId" clearable placeholder="选择优惠券" :disabled="!canOrder"><el-option v-for="row in coupons" :key="row.id" :label="row.coupon?.name||'优惠券'" :value="row.id"/></el-select><el-input v-model="address" placeholder="收餐地点，例如北区 3 栋 402" :disabled="!canOrder"/><el-input v-model="phone" placeholder="联系电话（选填）" :disabled="!canOrder"/><el-button type="primary" :disabled="!cartLines.length||!canOrder" :loading="saving" @click="submit">{{canOrder?'钱包支付并下单':'商家已打烊'}}</el-button><small>支付前由服务端重新核算金额、规格加价与优惠。</small></aside></div><el-dialog v-model="specDialog" title="选择规格" width="420px" destroy-on-close><template v-if="specItem"><h3 class="dialog-title">{{specItem.name}}</h3><el-form label-position="top"><el-form-item v-for="group in optionGroups(specItem)" :key="group.name" :label="group.name" :required="group.required"><el-select v-model="specSelections[group.name]" clearable :placeholder="group.required?'请选择':'不选择'" style="width:100%"><el-option v-for="choice in group.choices" :key="choice.name" :label="`${choice.name}${Number(choice.price_delta||0)>0?` +¥${Number(choice.price_delta).toFixed(2)}`:''}`" :value="choice.name" /></el-select></el-form-item></el-form></template><template #footer><el-button @click="specDialog=false">取消</el-button><el-button type="primary" @click="addSpecifiedItem">加入购物车</el-button></template></el-dialog></section></template>
<style scoped>.food-shop{display:grid;gap:20px}.food-shop header{display:flex;justify-content:space-between;gap:20px;padding-bottom:18px;border-bottom:1px solid var(--color-border)}header span{color:var(--color-primary);font-size:11px;font-weight:800;letter-spacing:.1em}h2{margin:6px 0;color:var(--color-navy);font-size:27px}p{margin:0;color:var(--color-text-muted)}.layout{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:20px}.menu,.checkout{padding:18px;border:1px solid var(--color-border);border-radius:var(--radius-card);background:var(--color-surface)}.menu h3{margin:6px 0 10px;color:var(--color-navy);font-size:15px}.menu article{display:flex;justify-content:space-between;gap:20px;padding:14px 0;border-top:1px solid var(--color-border)}.menu article>div:first-child{min-width:0}.menu strong{color:var(--color-navy)}.menu p{margin:5px 0;font-size:13px}.menu b{color:#dc6b44}.menu small,.cart-lines small{display:block;margin-top:4px;color:var(--color-text-muted);font-size:12px}.item-actions{display:flex;align-items:center;gap:8px;flex-shrink:0}.item-actions span{min-width:18px;color:var(--color-navy);text-align:center}.checkout{display:grid;height:max-content;gap:14px;position:sticky;top:16px}.checkout h3{margin:0;color:var(--color-navy)}.checkout small{color:var(--color-text-muted)}.cart-lines{display:grid;gap:9px;border-top:1px solid var(--color-border);border-bottom:1px solid var(--color-border);padding:10px 0}.cart-lines>div{display:flex;align-items:start;justify-content:space-between;gap:10px}.cart-lines strong{display:block;color:var(--color-navy);font-size:13px}.cart-lines b{color:#dc6b44;font-size:13px}.cart-lines>div>div:last-child{display:grid;justify-items:end}.dialog-title{margin:0 0 12px;color:var(--color-navy);font-size:17px}@media(max-width:760px){.layout{grid-template-columns:1fr}.checkout{position:static}.food-shop header{flex-direction:column}.menu article{gap:10px}.item-actions{gap:5px}}</style>
