<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

import {
  createCouponEvent,
  deleteCouponEvent,
  getAdminCoupons,
  getCouponEvents,
  triggerCouponDistribution,
  updateCouponEvent,
} from '@/api/coupon'

const list = ref<any[]>([])
const coupons = ref<any[]>([])
const loading = ref(false)
const dialog = ref(false)
const editing = ref('')
const triggerLoading = ref(false)
const triggerDate = ref('')
const triggerSummary = ref('')
const form = reactive<any>({ coupon_id: '', trigger_type: 'NEW_USER', start_date: '', end_date: '', is_active: true })
const labels: Record<string, string> = { NEW_USER: '新人', BIRTHDAY: '生日', HOLIDAY: '节日' }
const activeCoupons = computed(() => coupons.value.filter((item) => item.status === 'ACTIVE'))

function dateValue(value?: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleDateString('zh-CN') : ''
}

async function load() {
  loading.value = true
  try {
    const [events, couponResult] = await Promise.all([
      getCouponEvents({ page: 1, pageSize: 100 }),
      getAdminCoupons({ page: 1, pageSize: 100 }),
    ])
    list.value = events.list
    coupons.value = couponResult.list
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || '规则加载失败')
  } finally {
    loading.value = false
  }
}

function open(row?: any) {
  editing.value = row?.id || ''
  Object.assign(form, {
    coupon_id: row?.coupon_id || '',
    trigger_type: row?.trigger_type || 'NEW_USER',
    start_date: dateValue(row?.start_date),
    end_date: dateValue(row?.end_date),
    is_active: row?.is_active ?? true,
  })
  dialog.value = true
}

async function save() {
  try {
    if (editing.value) await updateCouponEvent(editing.value, form)
    else await createCouponEvent(form)
    ElMessage.success('规则已保存')
    dialog.value = false
    await load()
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || '保存失败')
  }
}

async function remove(row: any) {
  try {
    await ElMessageBox.confirm(`确认删除“${row.coupon.name}”发放规则？`, '删除规则', { type: 'warning' })
    await deleteCouponEvent(row.id)
    ElMessage.success('已删除')
    await load()
  } catch (error: any) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(error?.response?.data?.message || '删除失败')
    }
  }
}

async function trigger() {
  if (triggerLoading.value) return
  triggerLoading.value = true
  triggerSummary.value = ''
  try {
    const result = await triggerCouponDistribution(triggerDate.value || undefined)
    const eventSummary = (result?.events || [])
      .map((item: any) => `${labels[item.triggerType] || item.triggerType} ${item.issued} 张`)
      .join('，')
    triggerSummary.value = result?.created
      ? `${result.date} 已创建 ${result.created} 张待领取优惠券${eventSummary ? `（${eventSummary}）` : ''}`
      : `${result?.date || '所选日期'} 没有符合条件的发放对象`
    ElMessage.success(result?.created ? `已发放 ${result.created} 张优惠券` : '未发放优惠券')
    await load()
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || '触发失败')
  } finally {
    triggerLoading.value = false
  }
}

onMounted(load)
</script>

<template>
  <section>
    <header class="head">
      <div>
        <h1>发放规则</h1>
        <p>按新人、生日或节日自动生成待领取优惠券。</p>
      </div>
      <div class="head-actions">
        <el-date-picker v-model="triggerDate" type="date" value-format="YYYY-MM-DD" clearable placeholder="补发日期" />
        <el-button :loading="triggerLoading" @click="trigger">立即执行</el-button>
        <el-button type="success" @click="open()">新增规则</el-button>
      </div>
    </header>

    <p v-if="triggerSummary" class="trigger-summary">{{ triggerSummary }}</p>

    <el-card shadow="never">
      <el-table :data="list" v-loading="loading">
        <el-table-column prop="coupon.name" label="优惠券" />
        <el-table-column label="触发条件">
          <template #default="{ row }">{{ labels[row.trigger_type] }}</template>
        </el-table-column>
        <el-table-column label="生效时间">
          <template #default="{ row }">{{ row.start_date ? formatDate(row.start_date) : '立即' }} - {{ row.end_date ? formatDate(row.end_date) : '长期' }}</template>
        </el-table-column>
        <el-table-column label="状态">
          <template #default="{ row }"><el-tag :type="row.is_active ? 'success' : 'info'">{{ row.is_active ? '启用' : '停用' }}</el-tag></template>
        </el-table-column>
        <el-table-column label="操作" width="150">
          <template #default="{ row }">
            <el-button link type="primary" @click="open(row)">编辑</el-button>
            <el-button link type="danger" @click="remove(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialog" :title="editing ? '编辑规则' : '新增规则'" width="520px">
      <el-form label-width="110px">
        <el-form-item label="优惠券">
          <el-select v-model="form.coupon_id" style="width: 100%">
            <el-option v-for="coupon in activeCoupons" :key="coupon.id" :label="coupon.name" :value="coupon.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="触发类型">
          <el-select v-model="form.trigger_type" style="width: 100%">
            <el-option v-for="(label, key) in labels" :key="key" :label="label" :value="key" />
          </el-select>
        </el-form-item>
        <el-form-item label="开始日期">
          <el-date-picker v-model="form.start_date" type="date" value-format="YYYY-MM-DD" clearable placeholder="立即生效" style="width: 100%" />
        </el-form-item>
        <el-form-item label="结束日期（含当天）">
          <el-date-picker v-model="form.end_date" type="date" value-format="YYYY-MM-DD" clearable placeholder="长期有效" style="width: 100%" />
        </el-form-item>
        <el-form-item label="启用"><el-switch v-model="form.is_active" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog = false">取消</el-button>
        <el-button type="success" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.head { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; margin-bottom: 20px; }
.head h1 { margin: 0; }
.head p { margin: 7px 0 0; color: #64748b; }
.head-actions { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 10px; }
.trigger-summary { margin: -8px 0 16px; padding: 10px 12px; border-left: 3px solid #52c41a; border-radius: 4px; background: #f6ffed; color: #3f6212; font-size: 14px; }
@media (max-width: 720px) {
  .head { align-items: flex-start; flex-direction: column; }
  .head-actions { justify-content: flex-start; }
  .head-actions :deep(.el-date-editor) { width: min(100%, 220px); }
  .head-actions :deep(.el-button) { min-width: 104px; }
}
</style>
