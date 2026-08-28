<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { EditPen, Plus, RefreshRight } from '@element-plus/icons-vue'
import { http } from '@/api/request'

type BusinessHour = { day: number; enabled: boolean; start: string; end: string }
type FoodOptionChoice = { name: string; price_delta: number }
type FoodOptionGroup = { name: string; required: boolean; choices: FoodOptionChoice[] }
type Merchant = { id: number; name: string; description?: string | null; announcement?: string | null; min_order_amount?: number; prepare_minutes?: number; address: string; phone?: string | null; status: string; audit_note?: string | null; is_open: boolean; is_orderable?: boolean; commission_rate: number; business_hours?: BusinessHour[] | null }
type Category = { id: number; name: string; sort_order: number; is_active: boolean }
type MenuItem = { id: number; category_id?: number | null; name: string; description?: string | null; price: number; stock: number; is_active: boolean; sort_order: number; option_groups?: FoodOptionGroup[] }
type FoodOrder = { id: number; status: string; delivery_address: string; total_amount: number; created_at: string; user?: { nickname?: string; phone?: string }; items: Array<{ item_name: string; quantity: number; selected_options?: Array<{ group_name: string; choice_name: string }> }> }

const loading = ref(false)
const merchant = ref<Merchant | null>(null)
const categories = ref<Category[]>([])
const menuItems = ref<MenuItem[]>([])
const orders = ref<FoodOrder[]>([])
const applying = ref(false)
const itemDialog = ref(false)
const editingItemId = ref<number | null>(null)
const merchantForm = reactive({ name: '', description: '', announcement: '', min_order_amount: 0, prepare_minutes: 15, address: '', phone: '' })
const itemForm = reactive<{ category_id: number | null | undefined; name: string; description: string; price: number; stock: number; sort_order: number; is_active: boolean; option_groups: FoodOptionGroup[] }>({ category_id: undefined, name: '', description: '', price: 0, stock: -1, sort_order: 0, is_active: true, option_groups: [] })
const categoryName = ref('')
const useBusinessHours = ref(false)
const weekNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const defaultBusinessHours = (): BusinessHour[] => weekNames.map((_, day) => ({ day, enabled: true, start: '09:00', end: '22:00' }))
const businessHours = ref<BusinessHour[]>(defaultBusinessHours())

function unwrap(result: any) { return result?.data?.data ?? result?.data ?? result ?? {} }
function errorMessage(error: any) { return error?.response?.data?.error || error?.message || '操作失败，请稍后重试' }
function formatMoney(value: number) { return `¥${Number(value || 0).toFixed(2)}` }
function formatTime(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('zh-CN', { hour12: false }) }
function statusText(status: string) { return ({ PENDING: '审核中', APPROVED: '已通过', REJECTED: '已驳回', DISABLED: '已停用' } as Record<string, string>)[status] || status }
function foodItemText(item: FoodOrder['items'][number]) { const options = Array.isArray(item.selected_options) ? item.selected_options.map(option => `${option.group_name}:${option.choice_name}`).join('·') : ''; return `${item.item_name}${options ? `（${options}）` : ''} ×${item.quantity}` }

async function load() {
  loading.value = true
  try {
    const result = unwrap(await http.get('/food/merchant/my'))
    const data = result.data ?? result
    merchant.value = data?.merchant || null
    categories.value = Array.isArray(data?.categories) ? data.categories : []
    menuItems.value = Array.isArray(data?.menu_items) ? data.menu_items : []
    if (merchant.value) {
      Object.assign(merchantForm, { name: merchant.value.name, description: merchant.value.description || '', announcement: merchant.value.announcement || '', min_order_amount: merchant.value.min_order_amount || 0, prepare_minutes: merchant.value.prepare_minutes || 15, address: merchant.value.address, phone: merchant.value.phone || '' })
      const savedHours = Array.isArray(merchant.value.business_hours) ? merchant.value.business_hours : []
      useBusinessHours.value = savedHours.length > 0
      businessHours.value = weekNames.map((_, day) => {
        const saved = savedHours.find((hour) => Number(hour.day) === day)
        return saved ? { day, enabled: Boolean(saved.enabled), start: saved.start, end: saved.end } : { day, enabled: false, start: '09:00', end: '22:00' }
      })
      const orderResult = unwrap(await http.get(`/food/merchant/${merchant.value.id}/orders`, { params: { page_size: 20 } }))
      orders.value = Array.isArray(orderResult.list) ? orderResult.list : []
    } else { orders.value = []; categories.value = [] }
  } catch (error) { ElMessage.error(errorMessage(error)) } finally { loading.value = false }
}

async function saveMerchant() {
  if (!merchantForm.name.trim() || !merchantForm.address.trim()) return ElMessage.warning('请填写商家名称和地址')
  applying.value = true
  try {
    const payload = { ...merchantForm, business_hours: useBusinessHours.value ? businessHours.value : [] }
    if (merchant.value) await http.put(`/food/merchant/${merchant.value.id}`, payload)
    else await http.post('/food/merchant/apply', payload)
    ElMessage.success(merchant.value ? '商家资料已更新' : '入驻申请已提交')
    await load()
  } catch (error) { ElMessage.error(errorMessage(error)) } finally { applying.value = false }
}

async function setOpen(value: boolean) {
  if (!merchant.value) return
  try { await http.put(`/food/merchant/${merchant.value.id}`, { is_open: value }); ElMessage.success(value ? '商家已开业' : '商家已打烊') } catch (error) { merchant.value.is_open = !value; ElMessage.error(errorMessage(error)) }
}

function optionGroups(value: unknown): FoodOptionGroup[] { return Array.isArray(value) ? value.map((group: any) => ({ name: String(group?.name || ''), required: Boolean(group?.required), choices: Array.isArray(group?.choices) ? group.choices.map((choice: any) => ({ name: String(choice?.name || ''), price_delta: Number(choice?.price_delta || 0) })) : [] })) : [] }
function openCreateItem() { editingItemId.value = null; Object.assign(itemForm, { category_id: categories.value[0]?.id, name: '', description: '', price: 0, stock: -1, sort_order: menuItems.value.length * 10 + 10, is_active: true, option_groups: [] }); itemDialog.value = true }
function openEditItem(item: MenuItem) { editingItemId.value = item.id; Object.assign(itemForm, { ...item, option_groups: optionGroups(item.option_groups) }); itemDialog.value = true }
function addOptionGroup() { itemForm.option_groups.push({ name: '', required: false, choices: [{ name: '', price_delta: 0 }] }) }
function removeOptionGroup(index: number) { itemForm.option_groups.splice(index, 1) }
function addOptionChoice(group: FoodOptionGroup) { group.choices.push({ name: '', price_delta: 0 }) }
function removeOptionChoice(group: FoodOptionGroup, index: number) { group.choices.splice(index, 1) }
async function saveItem() {
  if (!merchant.value || !itemForm.name.trim() || Number(itemForm.price) <= 0) return ElMessage.warning('请填写菜品名称和正确价格')
  if (itemForm.option_groups.some(group => !group.name.trim() || !group.choices.length || group.choices.some(choice => !choice.name.trim()))) return ElMessage.warning('请完善规格组和选项名称')
  try {
    if (editingItemId.value) await http.put(`/food/merchant/${merchant.value.id}/menu/${editingItemId.value}`, itemForm)
    else await http.post(`/food/merchant/${merchant.value.id}/menu`, itemForm)
    ElMessage.success(editingItemId.value ? '菜品已更新' : '菜品已添加'); itemDialog.value = false; await load()
  } catch (error) { ElMessage.error(errorMessage(error)) }
}
async function toggleItem(item: MenuItem) { if (!merchant.value) return; try { await http.put(`/food/merchant/${merchant.value.id}/menu/${item.id}`, { is_active: item.is_active }); ElMessage.success(item.is_active ? '已上架' : '已下架') } catch (error) { item.is_active = !item.is_active; ElMessage.error(errorMessage(error)) } }
async function createCategory() { if (!merchant.value || !categoryName.value.trim()) return ElMessage.warning('请输入分类名称'); try { await http.post(`/food/merchant/${merchant.value.id}/categories`, { name: categoryName.value.trim(), sort_order: categories.value.length * 10 + 10 }); categoryName.value = ''; ElMessage.success('分类已添加'); await load() } catch (error) { ElMessage.error(errorMessage(error)) } }
async function deactivateCategory(category: Category) { if (!merchant.value) return; try { await ElMessageBox.confirm(`下架「${category.name}」后，原有菜品不会删除，但不会再在此分类下展示。`, '确认下架分类', { confirmButtonText: '确认下架', cancelButtonText: '取消', type: 'warning' }); await http.delete(`/food/merchant/${merchant.value.id}/categories/${category.id}`); ElMessage.success('分类已下架'); await load() } catch (error: any) { if (error !== 'cancel' && error !== 'close') ElMessage.error(errorMessage(error)) } }
function foodStatus(status: string) { return ({ PAID: '待接单', MERCHANT_ACCEPTED: '已接单', PREPARING: '备餐中', READY_FOR_PICKUP: '待取餐', ACCEPTED: '配送员已接单', PICKED: '已取餐', DELIVERING: '配送中', DELIVERED: '等待确认', COMPLETED: '已完成', REFUNDED: '已退款' } as Record<string, string>)[status] || status }
async function handleOrder(row: FoodOrder, action: string) { if (!merchant.value) return; try { if (action === 'reject') return; await http.post(`/food/merchant/${merchant.value.id}/orders/${row.id}/status`, { action }); ElMessage.success('订单状态已更新'); await load() } catch (error) { ElMessage.error(errorMessage(error)) } }

onMounted(load)
</script>

<template>
  <section class="merchant-center">
    <header class="page-heading"><div><span class="eyebrow">CAMPUS FOOD · MERCHANT</span><h2>商家工作台</h2><p>管理档口资料、菜品上架和顾客订单。</p></div><el-button :icon="RefreshRight" :loading="loading" @click="load">刷新</el-button></header>
    <template v-if="!merchant">
      <section class="apply-panel"><div class="panel-intro"><h3>申请入驻</h3><p>提交资料后，管理员审核通过即可开始上架菜品和接收订单。</p></div><el-form label-position="top" class="merchant-form"><el-form-item label="商家名称" required><el-input v-model="merchantForm.name" placeholder="例如：一食堂 · 面点档" /></el-form-item><el-form-item label="商家地址" required><el-input v-model="merchantForm.address" placeholder="例如：一食堂一楼 A03 档口" /></el-form-item><el-form-item label="联系电话"><el-input v-model="merchantForm.phone" /></el-form-item><el-form-item label="商家介绍"><el-input v-model="merchantForm.description" type="textarea" :rows="3" placeholder="说明主营菜品、营业时间等" /></el-form-item><el-button type="primary" :loading="applying" @click="saveMerchant">提交入驻申请</el-button></el-form></section>
    </template>
    <template v-else>
      <section class="merchant-status"><div><span class="status-label" :class="`status-${merchant.status.toLowerCase()}`">{{ statusText(merchant.status) }}</span><h3>{{ merchant.name }}</h3><p v-if="merchant.audit_note">审核说明：{{ merchant.audit_note }}</p><p v-else>{{ merchant.address }} · 平台抽成 {{ (merchant.commission_rate * 100).toFixed(0) }}%</p></div><el-switch :model-value="merchant.is_open" :disabled="merchant.status !== 'APPROVED'" active-text="营业中" inactive-text="已打烊" @change="setOpen" /></section>
      <section class="work-panel"><div class="section-head"><div><h3>商家资料</h3><p>修改资料不会影响已经生成的外卖订单。</p></div><el-button type="primary" :loading="applying" @click="saveMerchant">保存资料</el-button></div><div class="merchant-form compact"><el-input v-model="merchantForm.name" placeholder="商家名称" /><el-input v-model="merchantForm.address" placeholder="商家地址" /><el-input v-model="merchantForm.phone" placeholder="联系电话" /><el-input v-model="merchantForm.description" placeholder="商家介绍" /><el-input v-model="merchantForm.announcement" placeholder="营业公告" /><el-input-number v-model="merchantForm.min_order_amount" :min="0" :precision="2" placeholder="起送金额" /><el-input-number v-model="merchantForm.prepare_minutes" :min="1" :max="180" placeholder="备餐分钟数" /></div></section>
      <section class="work-panel"><div class="section-head"><div><h3>营业时段</h3><p>开启后，用户只能在设定时段内看到并下单；关闭则仅由「营业中」开关控制。</p></div><el-switch v-model="useBusinessHours" active-text="按时段营业" inactive-text="全天营业" /></div><div v-if="useBusinessHours" class="hours-list"><div v-for="hour in businessHours" :key="hour.day" class="hour-row"><strong>{{ weekNames[hour.day] }}</strong><el-switch v-model="hour.enabled" active-text="营业" inactive-text="休息" /><label>开始<el-input v-model="hour.start" :disabled="!hour.enabled" maxlength="5" placeholder="09:00" /></label><label>结束<el-input v-model="hour.end" :disabled="!hour.enabled" maxlength="5" placeholder="22:00" /></label></div></div><p v-else class="schedule-tip">当前不限制每日营业时间。需要临时打烊时，可使用页面顶部的营业开关。</p></section>
      <section class="work-panel"><div class="section-head"><div><h3>菜品分类</h3><p>分类会同步显示在用户的点餐菜单中。</p></div></div><div class="category-tools"><el-tag v-for="category in categories" :key="category.id" closable :disable-transitions="false" @close="deactivateCategory(category)">{{ category.name }}</el-tag><label class="add-category">新增分类<el-input v-model="categoryName" maxlength="60" placeholder="例如：招牌套餐" @keyup.enter="createCategory" /></label><el-button type="primary" plain :icon="Plus" @click="createCategory">添加</el-button></div></section>
      <section class="work-panel"><div class="section-head"><div><h3>菜品管理</h3><p>库存填 -1 表示不限量。</p></div><el-button type="primary" :icon="Plus" :disabled="merchant.status === 'DISABLED'" @click="openCreateItem">添加菜品</el-button></div><el-table :data="menuItems" v-loading="loading"><el-table-column prop="sort_order" label="排序" width="76" /><el-table-column prop="name" label="菜品" min-width="180"><template #default="{ row }"><div class="item-cell"><strong>{{ row.name }}</strong><span>{{ row.description || '暂无介绍' }}</span></div></template></el-table-column><el-table-column label="分类" width="120"><template #default="{ row }">{{ categories.find(category => category.id === row.category_id)?.name || '未分类' }}</template></el-table-column><el-table-column label="价格" width="110"><template #default="{ row }">{{ formatMoney(row.price) }}</template></el-table-column><el-table-column prop="stock" label="库存" width="90"><template #default="{ row }">{{ row.stock < 0 ? '不限量' : row.stock }}</template></el-table-column><el-table-column label="上架" width="100"><template #default="{ row }"><el-switch v-model="row.is_active" @change="toggleItem(row)" /></template></el-table-column><el-table-column label="操作" width="90"><template #default="{ row }"><el-button link type="primary" :icon="EditPen" @click="openEditItem(row)">编辑</el-button></template></el-table-column></el-table></section>
      <section class="work-panel"><div class="section-head"><div><h3>最新订单</h3><p>按接单、备餐、出餐顺序处理；餐品备好后才会开放跑腿员接单。</p></div></div><el-table :data="orders" v-loading="loading"><el-table-column prop="id" label="订单" width="90"><template #default="{ row }">#{{ row.id }}</template></el-table-column><el-table-column label="菜品" min-width="250"><template #default="{ row }">{{ row.items.map(foodItemText).join('、') }}</template></el-table-column><el-table-column label="顾客" width="130"><template #default="{ row }">{{ row.user?.nickname || row.user?.phone || '-' }}</template></el-table-column><el-table-column prop="delivery_address" label="配送地址" min-width="180" show-overflow-tooltip /><el-table-column label="金额" width="100"><template #default="{ row }">{{ formatMoney(row.total_amount) }}</template></el-table-column><el-table-column label="状态" width="130"><template #default="{ row }">{{ foodStatus(row.status) }}</template></el-table-column><el-table-column label="操作" width="120"><template #default="{ row }"><el-button v-if="row.status==='PAID'" link type="primary" @click="handleOrder(row,'accept')">接单</el-button><el-button v-else-if="row.status==='MERCHANT_ACCEPTED'" link type="primary" @click="handleOrder(row,'prepare')">开始备餐</el-button><el-button v-else-if="row.status==='PREPARING'||row.status==='MERCHANT_ACCEPTED'" link type="success" @click="handleOrder(row,'ready')">餐品备好</el-button></template></el-table-column><el-table-column label="时间" width="170"><template #default="{ row }">{{ formatTime(row.created_at) }}</template></el-table-column></el-table></section>
    </template>
    <el-dialog v-model="itemDialog" :title="editingItemId ? '编辑菜品' : '添加菜品'" width="650px" destroy-on-close><el-form label-position="top"><el-form-item label="菜品分类"><el-select v-model="itemForm.category_id" clearable placeholder="选择分类（可选）"><el-option v-for="category in categories" :key="category.id" :label="category.name" :value="category.id" /></el-select></el-form-item><el-form-item label="菜品名称" required><el-input v-model="itemForm.name" /></el-form-item><el-form-item label="菜品介绍"><el-input v-model="itemForm.description" /></el-form-item><div class="form-grid"><el-form-item label="基础价格（元）"><el-input-number v-model="itemForm.price" :min="0.01" :precision="2" /></el-form-item><el-form-item label="库存"><el-input-number v-model="itemForm.stock" :min="-1" /></el-form-item></div><el-form-item label="排序"><el-input-number v-model="itemForm.sort_order" :min="0" /></el-form-item><div class="spec-section"><div class="spec-heading"><div><strong>菜品规格 / 加料</strong><p>例如辣度、份量、加蛋；加价会计入用户实际支付金额。</p></div><el-button type="primary" plain size="small" :icon="Plus" @click="addOptionGroup">添加规格组</el-button></div><div v-if="!itemForm.option_groups.length" class="spec-empty">未设置规格时，用户将直接按基础价格下单。</div><section v-for="(group, groupIndex) in itemForm.option_groups" :key="groupIndex" class="spec-editor"><div class="spec-group-head"><el-input v-model="group.name" maxlength="30" placeholder="规格名称，例如辣度" /><el-switch v-model="group.required" active-text="必选" inactive-text="可选" /><el-button link type="danger" @click="removeOptionGroup(groupIndex)">删除规格组</el-button></div><div v-for="(choice, choiceIndex) in group.choices" :key="choiceIndex" class="spec-choice"><label>选项<el-input v-model="choice.name" maxlength="40" placeholder="例如微辣" /></label><label>加价<el-input-number v-model="choice.price_delta" :min="-100" :max="100" :precision="2" /></label><el-button link type="danger" :disabled="group.choices.length === 1" @click="removeOptionChoice(group, choiceIndex)">删除</el-button></div><el-button link type="primary" :icon="Plus" :disabled="group.choices.length >= 12" @click="addOptionChoice(group)">添加选项</el-button></section></div></el-form><template #footer><el-button @click="itemDialog = false">取消</el-button><el-button type="primary" @click="saveItem">保存</el-button></template></el-dialog>
  </section>
</template>

<style scoped>
.merchant-center { display: grid; gap: 20px; }.page-heading, .section-head, .merchant-status { display: flex; align-items: end; justify-content: space-between; gap: 20px; }.page-heading { padding-bottom: 18px; border-bottom: 1px solid var(--color-border); }.eyebrow { color: var(--color-primary); font-size: 11px; font-weight: 850; letter-spacing: .1em; }.page-heading h2 { margin: 6px 0 3px; color: var(--color-navy); font-size: 26px; letter-spacing: -.04em; }.page-heading p, .section-head p, .merchant-status p { margin: 3px 0 0; color: var(--color-text-muted); font-size: 13px; }.apply-panel, .work-panel, .merchant-status { border: 1px solid var(--color-border); border-radius: var(--radius-card); padding: 22px; background: var(--color-surface); box-shadow: var(--shadow-sm); }.apply-panel { display: grid; grid-template-columns: minmax(0, .8fr) minmax(340px, 1.2fr); gap: 36px; }.panel-intro h3, .section-head h3, .merchant-status h3 { margin: 0; color: var(--color-navy); font-size: 18px; }.panel-intro p { max-width: 290px; color: var(--color-text-secondary); font-size: 14px; line-height: 1.7; }.merchant-form { display: grid; }.merchant-form.compact { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }.section-head { align-items: start; margin-bottom: 17px; }.merchant-status { align-items: center; }.status-label { display: inline-flex; margin-bottom: 9px; border-radius: 999px; padding: 5px 9px; font-size: 11px; font-weight: 800; }.status-pending { background: #fff3cd; color: #926b08; }.status-approved { background: #e4f5e9; color: #247143; }.status-rejected, .status-disabled { background: #fde8e8; color: #a73838; }.hours-list { display: grid; overflow: hidden; border: 1px solid var(--color-border); border-radius: 10px; }.hour-row { display: grid; grid-template-columns: 64px 130px minmax(150px, 1fr) minmax(150px, 1fr); gap: 14px; padding: 12px 14px; align-items: center; border-top: 1px solid var(--color-border); }.hour-row:first-child { border-top: 0; }.hour-row strong { color: var(--color-navy); font-size: 13px; }.hour-row label { display: grid; grid-template-columns: 32px minmax(0, 1fr); align-items: center; gap: 7px; color: var(--color-text-muted); font-size: 12px; }.schedule-tip { margin: 0; border-radius: 10px; padding: 12px 14px; background: #f5f8f5; color: var(--color-text-secondary); font-size: 13px; }.category-tools { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }.add-category { display: flex; width: 265px; align-items: center; gap: 8px; color: var(--color-text-secondary); font-size: 13px; white-space: nowrap; }.item-cell { display: grid; gap: 3px; }.item-cell strong { color: var(--color-navy); }.item-cell span { overflow: hidden; color: var(--color-text-muted); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }.spec-section { display: grid; gap: 12px; border-top: 1px solid var(--color-border); padding-top: 16px; }.spec-heading, .spec-group-head, .spec-choice { display: flex; align-items: center; justify-content: space-between; gap: 12px; }.spec-heading strong { color: var(--color-navy); font-size: 14px; }.spec-heading p { margin: 3px 0 0; color: var(--color-text-muted); font-size: 12px; }.spec-empty { border-radius: 9px; padding: 11px 12px; background: #f5f8f5; color: var(--color-text-secondary); font-size: 12px; }.spec-editor { display: grid; gap: 9px; border: 1px solid var(--color-border); border-radius: 10px; padding: 12px; }.spec-group-head .el-input { max-width: 240px; }.spec-choice { justify-content: flex-start; }.spec-choice label { display: grid; grid-template-columns: 31px minmax(110px, 1fr); align-items: center; gap: 7px; color: var(--color-text-muted); font-size: 12px; }.spec-choice label:first-child { flex: 1; }.spec-choice .el-input-number { width: 128px; } @media (max-width: 800px) { .apply-panel { grid-template-columns: 1fr; }.merchant-form.compact { grid-template-columns: 1fr; }.page-heading, .section-head, .spec-heading, .spec-group-head { align-items: flex-start; flex-direction: column; }.hour-row { grid-template-columns: 52px 1fr; }.hour-row label { grid-column: span 1; }.add-category { width: 100%; }.spec-choice { align-items: flex-start; flex-wrap: wrap; }.spec-choice label { min-width: 100%; } }
</style>
