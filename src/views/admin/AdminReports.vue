<template>
  <div class="p-4">
    <div class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
      <div>
        <h2 class="h4 mb-1">举报管理</h2>
        <p class="text-muted small mb-0">审核举报并处理（封禁/扣分/驳回/标记无效），支持查看订单快照</p>
      </div>
      <div class="d-flex gap-2 flex-wrap">
        <el-select v-model="statusFilter" placeholder="状态筛选" clearable style="width: 160px" @change="handleSearch">
          <el-option label="全部" value="" />
          <el-option label="待处理" value="pending" />
          <el-option label="已处理" value="processed" />
          <el-option label="已驳回" value="rejected" />
          <el-option label="无效" value="invalid" />
        </el-select>
        <el-button @click="fetchReports" :icon="RefreshRight">刷新</el-button>
      </div>
    </div>

    <el-card shadow="never" class="border">
      <el-table :data="reports" v-loading="loading" stripe style="width: 100%" :row-style="{ height: '56px' }">
        <el-table-column prop="id" label="举报ID" width="110" align="center" fixed="left" />
        <el-table-column prop="orderId" label="订单号" width="140" fixed="left" />
        <el-table-column prop="reporter" label="举报人" width="140" />
        <el-table-column prop="accused" label="被举报人" width="140" />
        <el-table-column label="举报类型" width="140" align="center">
          <template #default="{ row }">
            <el-tag size="small" effect="plain">{{ row.reportType || '-' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="content" label="举报内容" min-width="220" show-overflow-tooltip />
        <el-table-column label="处理状态" width="120" align="center">
          <template #default="{ row }">
            <el-tag size="small" :type="getStatusType(row.status)">{{ getStatusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="提交时间" width="170">
          <template #default="{ row }">
            <span class="text-muted small">{{ formatDateTime(row.createdAt) }}</span>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="200" align="center" fixed="right">
          <template #default="{ row }">
            <el-button size="small" :icon="View" @click="openDetail(row)">详情</el-button>
            <el-button v-if="isPending(row.status)" size="small" type="primary" :icon="Edit" @click="openProcess(row)">
              处理
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="d-flex justify-content-end mt-4">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :total="pagination.total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          @current-change="fetchReports"
          @size-change="handleSizeChange"
        />
      </div>
    </el-card>

    <el-dialog v-model="detailVisible" title="举报详情" width="980px" align-center>
      <div class="vstack gap-3">
        <el-card shadow="never" class="border" v-loading="detailLoading">
          <el-descriptions :column="2" border>
            <el-descriptions-item label="举报ID">{{ detail?.id || '-' }}</el-descriptions-item>
            <el-descriptions-item label="订单号">{{ detail?.orderId || '-' }}</el-descriptions-item>
            <el-descriptions-item label="举报人">{{ detail?.reporter || '-' }}</el-descriptions-item>
            <el-descriptions-item label="被举报人">{{ detail?.accused || '-' }}</el-descriptions-item>
            <el-descriptions-item label="举报类型">{{ detail?.reportType || '-' }}</el-descriptions-item>
            <el-descriptions-item label="处理状态">
              <el-tag size="small" :type="getStatusType(detail?.status)">{{ getStatusText(detail?.status) }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="提交时间">{{ formatDateTime(detail?.createdAt) }}</el-descriptions-item>
            <el-descriptions-item label="处理时间">{{ formatDateTime(detail?.processedAt) }}</el-descriptions-item>
            <el-descriptions-item label="处理人">{{ detail?.processedBy || '-' }}</el-descriptions-item>
            <el-descriptions-item label="处理结果">{{ detail?.processResult || '-' }}</el-descriptions-item>
            <el-descriptions-item label="举报内容" :span="2">{{ detail?.content || '-' }}</el-descriptions-item>
          </el-descriptions>
        </el-card>

        <el-card shadow="never" class="border">
          <template #header>
            <div class="d-flex align-items-center justify-content-between">
              <div class="fw-semibold">订单快照</div>
              <el-button size="small" :loading="orderLoading" @click="reloadOrder">重新加载</el-button>
            </div>
          </template>

          <div v-if="orderError" class="alert alert-danger mb-0">{{ orderError }}</div>
          <div v-else>
            <div v-if="orderLoading" class="text-muted small">加载中…</div>
            <el-descriptions v-else :column="2" border>
              <el-descriptions-item label="订单号">{{ detail?.orderId || '-' }}</el-descriptions-item>
              <el-descriptions-item label="订单状态">{{ pickOrderStatus(orderSnapshot) }}</el-descriptions-item>
              <el-descriptions-item label="取件地址">{{ pickOrderPickup(orderSnapshot) }}</el-descriptions-item>
              <el-descriptions-item label="送达地址">{{ pickOrderDelivery(orderSnapshot) }}</el-descriptions-item>
              <el-descriptions-item label="金额">{{ pickOrderAmount(orderSnapshot) }}</el-descriptions-item>
              <el-descriptions-item label="创建时间">{{ formatDateTime(pickOrderCreatedAt(orderSnapshot)) }}</el-descriptions-item>
            </el-descriptions>

            <el-collapse class="mt-3">
              <el-collapse-item title="查看原始订单快照（调试用）" name="raw">
                <pre class="mb-0 small" style="white-space: pre-wrap">{{ safeJson(orderSnapshot) }}</pre>
              </el-collapse-item>
            </el-collapse>
          </div>
        </el-card>
      </div>
      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="processVisible" title="处理举报" width="600px" align-center>
      <el-form :model="processForm" label-width="120px">
        <el-form-item label="处理动作">
          <el-radio-group v-model="processForm.action">
            <el-radio label="approve">通过</el-radio>
            <el-radio label="reject">驳回</el-radio>
            <el-radio label="invalid">标记无效</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item v-if="processForm.action === 'approve'" label="处罚方式">
          <el-radio-group v-model="processForm.punish">
            <el-radio label="ban">封禁被举报人</el-radio>
            <el-radio label="deduct">扣分</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item v-if="processForm.action === 'approve' && processForm.punish === 'ban'" label="封禁天数">
          <el-input-number v-model="processForm.banDays" :min="1" :precision="0" />
        </el-form-item>

        <el-form-item v-if="processForm.action === 'approve' && processForm.punish === 'deduct'" label="扣除信用分">
          <el-input-number v-model="processForm.deductPoints" :min="1" :precision="0" />
        </el-form-item>

        <el-form-item label="处理意见">
          <el-input v-model="processForm.note" type="textarea" :rows="3" placeholder="请输入处理意见（将记录到举报处理结果）" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="processVisible = false">取消</el-button>
        <el-button type="primary" :loading="processing" @click="submitProcess">提交</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Edit, RefreshRight, View } from '@element-plus/icons-vue'

import { getOrderDetail, type OrderDetail } from '@/api/order'
import { getAdminReportDetail, listAdminReports, processAdminReport, type AdminReportRow } from '@/api/admin'

const loading = ref(false)
const reports = ref<AdminReportRow[]>([])
const statusFilter = ref('')

const pagination = ref({
  page: 1,
  pageSize: 20,
  total: 0,
})

const detailVisible = ref(false)
const detailLoading = ref(false)
const detail = ref<AdminReportRow | null>(null)

const orderLoading = ref(false)
const orderError = ref('')
const orderSnapshot = ref<OrderDetail | any | null>(null)

const processVisible = ref(false)
const processing = ref(false)
const processTarget = ref<AdminReportRow | null>(null)
const processForm = ref({
  action: 'approve' as 'approve' | 'reject' | 'invalid',
  punish: 'ban' as 'ban' | 'deduct',
  banDays: 7,
  deductPoints: 10,
  note: '',
})

function getErrorMessage(err: any) {
  return err?.response?.data?.message || err?.response?.data?.msg || err?.message || '操作失败'
}

function formatDateTime(dateStr?: string) {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function isPending(status?: string) {
  const s = String(status ?? '').toLowerCase()
  return s === '' || s === 'pending' || s === 'unprocessed' || s === '0'
}

function getStatusText(status?: string) {
  const s = String(status ?? '').toLowerCase()
  if (s === 'processed' || s === 'done' || s === 'approved') return '已处理'
  if (s === 'rejected' || s === 'reject') return '已驳回'
  if (s === 'invalid') return '无效'
  if (isPending(s)) return '待处理'
  return status || '-'
}

function getStatusType(status?: string) {
  const s = String(status ?? '').toLowerCase()
  if (s === 'processed' || s === 'done' || s === 'approved') return 'success'
  if (s === 'rejected' || s === 'reject') return 'danger'
  if (s === 'invalid') return 'info'
  if (isPending(s)) return 'warning'
  return 'info'
}

function safeJson(v: any) {
  try {
    return JSON.stringify(v ?? {}, null, 2)
  } catch {
    return String(v ?? '')
  }
}

function pickOrderStatus(o: any) {
  const s = String(o?.status ?? o?.order_status ?? o?.orderStatus ?? o?.state ?? '').trim()
  return s || '-'
}

function pickOrderPickup(o: any) {
  return String(
    o?.pickup_address ?? o?.pickupAddress ?? o?.task?.pickup_address ?? o?.task?.pickupAddress ?? '',
  ).trim() || '-'
}

function pickOrderDelivery(o: any) {
  return String(
    o?.delivery_address ?? o?.deliveryAddress ?? o?.task?.delivery_address ?? o?.task?.deliveryAddress ?? '',
  ).trim() || '-'
}

function pickOrderAmount(o: any) {
  const v = o?.amount ?? o?.total_amount ?? o?.totalAmount ?? o?.fee_total ?? o?.feeTotal ?? o?.task?.fee_total ?? o?.task?.feeTotal
  const n = typeof v === 'number' ? v : Number(String(v ?? '').trim())
  return Number.isFinite(n) ? n.toFixed(2) : '-'
}

function pickOrderCreatedAt(o: any): string {
  return String(o?.created_at ?? o?.createdAt ?? o?.time ?? '') || ''
}

async function fetchReports() {
  loading.value = true
  try {
    const res = await listAdminReports({
      page: pagination.value.page,
      pageSize: pagination.value.pageSize,
      status: statusFilter.value || undefined,
    })
    reports.value = res.list
    pagination.value.total = res.total
  } catch (err: any) {
    ElMessage.error(getErrorMessage(err) || '加载举报列表失败')
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  pagination.value.page = 1
  fetchReports()
}

function handleSizeChange() {
  pagination.value.page = 1
  fetchReports()
}

async function reloadOrder() {
  orderError.value = ''
  orderLoading.value = true
  try {
    const report = detail.value
    if (!report) return
    if (report.orderSnapshot) {
      orderSnapshot.value = report.orderSnapshot
      return
    }
    if (report.orderId && report.orderId !== '-') {
      orderSnapshot.value = await getOrderDetail(report.orderId)
      return
    }
    orderSnapshot.value = null
  } catch (err: any) {
    orderError.value = getErrorMessage(err) || '加载订单快照失败'
  } finally {
    orderLoading.value = false
  }
}

async function openDetail(row: AdminReportRow) {
  detailVisible.value = true
  detailLoading.value = true
  detail.value = null
  orderSnapshot.value = null
  orderError.value = ''
  try {
    const d = await getAdminReportDetail(row.id)
    detail.value = d
    await reloadOrder()
  } catch (err: any) {
    ElMessage.error(getErrorMessage(err))
  } finally {
    detailLoading.value = false
  }
}

function openProcess(row: AdminReportRow) {
  processTarget.value = row
  processForm.value = {
    action: 'approve',
    punish: 'ban',
    banDays: 7,
    deductPoints: 10,
    note: '',
  }
  processVisible.value = true
}

async function submitProcess() {
  if (!processTarget.value) return
  if (processing.value) return
  processing.value = true
  try {
    const f = processForm.value
    await processAdminReport(processTarget.value.id, {
      action: f.action,
      punish: f.action === 'approve' ? f.punish : undefined,
      banDays: f.action === 'approve' && f.punish === 'ban' ? f.banDays : undefined,
      deductPoints: f.action === 'approve' && f.punish === 'deduct' ? f.deductPoints : undefined,
      note: f.note,
    })
    ElMessage.success('处理完成')
    processVisible.value = false
    await fetchReports()
  } catch (err: any) {
    ElMessage.error(getErrorMessage(err))
  } finally {
    processing.value = false
  }
}

onMounted(() => {
  fetchReports()
})
</script>
