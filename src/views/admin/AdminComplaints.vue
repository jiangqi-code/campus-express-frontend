<template>
  <div class="p-4">
    <div class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
      <div>
        <h2 class="h4 mb-1">投诉管理</h2>
        <p class="text-muted small mb-0">查看投诉凭证、订单信息，并进行仲裁处理（支持通知双方）</p>
      </div>
      <div class="d-flex gap-2 flex-wrap">
        <el-select v-model="typeFilter" placeholder="类型筛选" clearable style="width: 170px" @change="handleSearch">
          <el-option label="全部" value="" />
          <el-option label="态度差" value="ATTITUDE_BAD" />
          <el-option label="物品损坏" value="DAMAGED" />
          <el-option label="超时" value="TIMEOUT" />
          <el-option label="虚假完成" value="FAKE_COMPLETION" />
          <el-option label="其他" value="OTHER" />
        </el-select>
        <el-select v-model="statusFilter" placeholder="状态筛选" clearable style="width: 140px" @change="handleSearch">
          <el-option label="全部" value="" />
          <el-option label="待处理" value="pending" />
          <el-option label="已处理" value="approved" />
          <el-option label="已驳回" value="rejected" />
        </el-select>
        <el-button @click="fetchComplaints" :icon="RefreshRight">刷新</el-button>
      </div>
    </div>

    <el-card shadow="never" class="border">
      <el-table :data="complaints" v-loading="loading" stripe style="width: 100%" :row-style="{ height: '56px' }">
        <el-table-column prop="id" label="投诉ID" width="100" align="center" fixed="left" />

        <el-table-column prop="orderId" label="订单号" width="130" fixed="left" />

        <el-table-column label="投诉人" width="160">
          <template #default="{ row }">
            <div class="d-flex align-items-center gap-2">
              <el-tag size="small" :type="row.complainantRole === 'runner' ? 'success' : 'info'">
                {{ row.complainantRole === 'runner' ? '跑腿员' : '用户' }}
              </el-tag>
              <span class="fw-semibold text-truncate" style="max-width: 90px">{{ row.complainant || '-' }}</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="respondent" label="被投诉方" width="140" />

        <el-table-column label="投诉类型" width="140" align="center">
          <template #default="{ row }">
            <el-tag size="small" effect="plain">{{ getTypeText(row.complaintType) }}</el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="content" label="投诉内容" min-width="220" show-overflow-tooltip />

        <el-table-column label="凭证图片" width="180">
          <template #default="{ row }">
            <div v-if="row.evidenceUrls && row.evidenceUrls.length" class="d-flex align-items-center gap-2">
              <el-image
                v-for="(u, idx) in row.evidenceUrls.slice(0, 2)"
                :key="u + idx"
                :src="u"
                style="width: 44px; height: 44px; border-radius: 6px"
                fit="cover"
                :preview-src-list="row.evidenceUrls"
                :initial-index="idx"
                preview-teleported
              />
              <span v-if="row.evidenceUrls.length > 2" class="text-muted small">+{{ row.evidenceUrls.length - 2 }}</span>
            </div>
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>

        <el-table-column label="状态" width="110" align="center">
          <template #default="{ row }">
            <el-tag size="small" :type="getStatusType(row.status)">{{ getStatusText(row.status) }}</el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="createdAt" label="提交时间" width="170">
          <template #default="{ row }">
            <span class="text-muted small">{{ formatDateTime(row.createdAt) }}</span>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="160" align="center" fixed="right">
          <template #default="{ row }">
            <el-button size="small" :icon="View" @click="openDetail(row)">详情</el-button>
            <el-button
              v-if="isPending(row.status)"
              size="small"
              type="primary"
              :icon="Edit"
              @click="openProcess(row)"
            >
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
          @current-change="fetchComplaints"
          @size-change="handleSizeChange"
        />
      </div>
    </el-card>

    <el-dialog v-model="detailVisible" title="投诉详情" width="980px" align-center>
      <div class="vstack gap-3">
        <el-card shadow="never" class="border">
          <el-descriptions :column="2" border>
            <el-descriptions-item label="投诉ID">{{ current?.id || '-' }}</el-descriptions-item>
            <el-descriptions-item label="订单号">{{ current?.orderId || '-' }}</el-descriptions-item>
            <el-descriptions-item label="投诉人">
              {{ current?.complainant || '-' }}
              <span class="text-muted small ms-2">({{ current?.complainantRole === 'runner' ? '跑腿员' : '用户' }})</span>
            </el-descriptions-item>
            <el-descriptions-item label="被投诉方">{{ current?.respondent || '-' }}</el-descriptions-item>
            <el-descriptions-item label="投诉类型">{{ getTypeText(current?.complaintType) }}</el-descriptions-item>
            <el-descriptions-item label="状态">
              <el-tag size="small" :type="getStatusType(current?.status)">{{ getStatusText(current?.status) }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="提交时间">{{ formatDateTime(current?.createdAt) }}</el-descriptions-item>
            <el-descriptions-item label="处理时间">{{ formatDateTime(current?.processedAt) }}</el-descriptions-item>
            <el-descriptions-item label="投诉内容" :span="2">{{ current?.content || '-' }}</el-descriptions-item>
            <el-descriptions-item label="凭证图片" :span="2">
              <div v-if="current?.evidenceUrls?.length" class="d-flex flex-wrap gap-2">
                <el-image
                  v-for="(u, idx) in current.evidenceUrls"
                  :key="u + idx"
                  :src="u"
                  style="width: 80px; height: 80px; border-radius: 8px"
                  fit="cover"
                  :preview-src-list="current.evidenceUrls"
                  :initial-index="idx"
                  preview-teleported
                />
              </div>
              <span v-else class="text-muted">-</span>
            </el-descriptions-item>
          </el-descriptions>
        </el-card>

        <el-card shadow="never" class="border">
          <template #header>
            <div class="d-flex align-items-center justify-content-between">
              <div class="fw-semibold">订单信息</div>
              <el-button size="small" :loading="orderLoading" @click="reloadOrder">重新加载</el-button>
            </div>
          </template>

          <div v-if="orderError" class="alert alert-danger mb-0">{{ orderError }}</div>
          <div v-else>
            <div v-if="orderLoading" class="text-muted small">加载中…</div>
            <el-descriptions v-else :column="2" border>
              <el-descriptions-item label="订单号">{{ current?.orderId || '-' }}</el-descriptions-item>
              <el-descriptions-item label="订单状态">{{ pickOrderStatus(orderDetail) }}</el-descriptions-item>
              <el-descriptions-item label="取件地址">{{ pickOrderPickup(orderDetail) }}</el-descriptions-item>
              <el-descriptions-item label="送达地址">{{ pickOrderDelivery(orderDetail) }}</el-descriptions-item>
              <el-descriptions-item label="金额">{{ pickOrderAmount(orderDetail) }}</el-descriptions-item>
              <el-descriptions-item label="创建时间">{{ formatDateTime(pickOrderCreatedAt(orderDetail)) }}</el-descriptions-item>
            </el-descriptions>

            <el-collapse class="mt-3">
              <el-collapse-item title="查看原始订单数据（调试用）" name="raw">
                <pre class="mb-0 small" style="white-space: pre-wrap">{{ safeJson(orderDetail) }}</pre>
              </el-collapse-item>
            </el-collapse>
          </div>
        </el-card>

        <el-card v-if="current && isPending(current.status)" shadow="never" class="border">
          <template #header>
            <div class="fw-semibold">仲裁处理</div>
          </template>
          <el-form :model="processForm" label-width="120px">
            <el-form-item label="责任方">
              <el-select v-model="processForm.responsibility" placeholder="请选择责任方" style="width: 260px">
                <el-option label="投诉人" value="complainant" />
                <el-option label="被投诉方" value="respondent" />
                <el-option label="双方" value="both" />
                <el-option label="无责任/无法判定" value="none" />
              </el-select>
            </el-form-item>
            <el-form-item label="退款金额(元)">
              <el-input-number v-model="processForm.refundAmount" :min="0" :precision="2" />
            </el-form-item>
            <el-form-item label="补偿金额(元)">
              <el-input-number v-model="processForm.compensationAmount" :min="0" :precision="2" />
            </el-form-item>
            <el-form-item label="扣除信用分">
              <el-input-number v-model="processForm.creditDeduct" :min="0" :precision="0" />
            </el-form-item>
            <el-form-item label="处理意见">
              <el-input v-model="processForm.note" type="textarea" :rows="3" placeholder="请输入处理意见（将记录在投诉处理结果中）" />
            </el-form-item>
            <el-form-item label="通知双方">
              <el-switch v-model="processForm.notify" />
            </el-form-item>
          </el-form>
          <div class="d-flex justify-content-end gap-2">
            <el-button type="primary" :loading="processing" @click="submitProcess">提交处理</el-button>
            <el-button :loading="processing" @click="rejectComplaint">驳回投诉</el-button>
          </div>
        </el-card>

        <el-card v-else-if="current && !isPending(current.status)" shadow="never" class="border">
          <template #header>
            <div class="fw-semibold">处理结果</div>
          </template>
          <el-descriptions :column="2" border>
            <el-descriptions-item label="责任方">{{ current.responsibility || '-' }}</el-descriptions-item>
            <el-descriptions-item label="处理意见">{{ current.processNote || '-' }}</el-descriptions-item>
            <el-descriptions-item label="退款金额(元)">{{ current.refundAmount ?? '-' }}</el-descriptions-item>
            <el-descriptions-item label="补偿金额(元)">{{ current.compensationAmount ?? '-' }}</el-descriptions-item>
            <el-descriptions-item label="扣除信用分">{{ current.creditDeduct ?? '-' }}</el-descriptions-item>
            <el-descriptions-item label="处理时间">{{ formatDateTime(current.processedAt) }}</el-descriptions-item>
          </el-descriptions>
        </el-card>
      </div>
      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="processVisible" title="处理投诉" width="560px" align-center>
      <el-form :model="processForm" label-width="120px">
        <el-form-item label="责任方">
          <el-select v-model="processForm.responsibility" placeholder="请选择责任方" style="width: 260px">
            <el-option label="投诉人" value="complainant" />
            <el-option label="被投诉方" value="respondent" />
            <el-option label="双方" value="both" />
            <el-option label="无责任/无法判定" value="none" />
          </el-select>
        </el-form-item>
        <el-form-item label="退款金额(元)">
          <el-input-number v-model="processForm.refundAmount" :min="0" :precision="2" />
        </el-form-item>
        <el-form-item label="补偿金额(元)">
          <el-input-number v-model="processForm.compensationAmount" :min="0" :precision="2" />
        </el-form-item>
        <el-form-item label="扣除信用分">
          <el-input-number v-model="processForm.creditDeduct" :min="0" :precision="0" />
        </el-form-item>
        <el-form-item label="处理意见">
          <el-input v-model="processForm.note" type="textarea" :rows="3" placeholder="请输入处理意见（将记录在投诉处理结果中）" />
        </el-form-item>
        <el-form-item label="通知双方">
          <el-switch v-model="processForm.notify" />
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
import { ElMessage, ElMessageBox } from 'element-plus'
import { Edit, RefreshRight, View } from '@element-plus/icons-vue'

import { getOrderDetail, type OrderDetail } from '@/api/order'
import { listAdminComplaints, processAdminComplaint, type AdminComplaintRow } from '@/api/admin'

const loading = ref(false)
const complaints = ref<AdminComplaintRow[]>([])

const typeFilter = ref('')
const statusFilter = ref('')

const pagination = ref({
  page: 1,
  pageSize: 20,
  total: 0,
})

const detailVisible = ref(false)
const processVisible = ref(false)
const current = ref<AdminComplaintRow | null>(null)

const orderLoading = ref(false)
const orderError = ref('')
const orderDetail = ref<OrderDetail | null>(null)

const processing = ref(false)
const processForm = ref({
  responsibility: 'respondent' as 'complainant' | 'respondent' | 'both' | 'none',
  refundAmount: 0,
  compensationAmount: 0,
  creditDeduct: 0,
  note: '',
  notify: true,
})

function getErrorMessage(err: any) {
  return (
    err?.response?.data?.message ||
    err?.response?.data?.msg ||
    err?.message ||
    '操作失败'
  )
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
  return s === '' || s === 'pending' || s === '0' || s === 'unprocessed' || s === 'processing'
}

function getStatusText(status?: string) {
  const s = String(status ?? '').toLowerCase()
  if (s === 'approved' || s === 'processed' || s === 'done') return '已处理'
  if (s === 'rejected' || s === 'reject') return '已驳回'
  if (isPending(s)) return '待处理'
  return status || '-'
}

function getStatusType(status?: string) {
  const s = String(status ?? '').toLowerCase()
  if (s === 'approved' || s === 'processed' || s === 'done') return 'success'
  if (s === 'rejected' || s === 'reject') return 'danger'
  if (isPending(s)) return 'warning'
  return 'info'
}

function getTypeText(t?: string) {
  const s = String(t ?? '').trim().toUpperCase()
  const map: Record<string, string> = {
    ATTITUDE_BAD: '态度差',
    DAMAGED: '物品损坏',
    TIMEOUT: '超时',
    FAKE_COMPLETION: '虚假完成',
    OTHER: '其他',
  }
  return map[s] || (s ? s : '-')
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

async function fetchComplaints() {
  loading.value = true
  try {
    const res = await listAdminComplaints({
      page: pagination.value.page,
      pageSize: pagination.value.pageSize,
      type: typeFilter.value || undefined,
      status: statusFilter.value || undefined,
    })
    complaints.value = res.list
    pagination.value.total = res.total
  } catch (err: any) {
    ElMessage.error(getErrorMessage(err) || '加载投诉列表失败')
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  pagination.value.page = 1
  fetchComplaints()
}

function handleSizeChange() {
  pagination.value.page = 1
  fetchComplaints()
}

async function reloadOrder() {
  if (!current.value?.orderId) return
  orderLoading.value = true
  orderError.value = ''
  try {
    const data = await getOrderDetail(current.value.orderId)
    orderDetail.value = data
  } catch (err: any) {
    orderError.value = getErrorMessage(err) || '加载订单信息失败'
  } finally {
    orderLoading.value = false
  }
}

function resetProcessForm() {
  processForm.value = {
    responsibility: 'respondent',
    refundAmount: 0,
    compensationAmount: 0,
    creditDeduct: 0,
    note: '',
    notify: true,
  }
}

async function openDetail(row: AdminComplaintRow) {
  current.value = row
  detailVisible.value = true
  orderDetail.value = null
  orderError.value = ''
  await reloadOrder()
}

function openProcess(row: AdminComplaintRow) {
  current.value = row
  resetProcessForm()
  processVisible.value = true
}

async function submitProcess() {
  if (!current.value) return
  if (processing.value) return
  if (!processForm.value.note.trim()) {
    ElMessage.warning('请输入处理意见')
    return
  }
  processing.value = true
  try {
    await processAdminComplaint(current.value.id, {
      decision: 'resolve',
      responsibility: processForm.value.responsibility,
      refundAmount: processForm.value.refundAmount,
      compensationAmount: processForm.value.compensationAmount,
      creditDeduct: processForm.value.creditDeduct,
      note: processForm.value.note,
      notify: processForm.value.notify,
    })
    ElMessage.success(processForm.value.notify ? '处理完成，已通知双方' : '处理完成')
    processVisible.value = false
    detailVisible.value = false
    await fetchComplaints()
  } catch (err: any) {
    ElMessage.error(getErrorMessage(err))
  } finally {
    processing.value = false
  }
}

async function rejectComplaint() {
  if (!current.value) return
  if (processing.value) return
  try {
    const { value } = await ElMessageBox.prompt('请输入驳回原因/处理意见', '驳回投诉', {
      confirmButtonText: '提交',
      cancelButtonText: '取消',
      inputType: 'textarea',
      inputPlaceholder: '例如：证据不足，建议双方协商',
      inputValue: '',
      closeOnClickModal: false,
      distinguishCancelAndClose: true,
    })
    const note = String(value ?? '').trim()
    if (!note) {
      ElMessage.warning('请输入驳回原因')
      return
    }
    processing.value = true
    await processAdminComplaint(current.value.id, {
      decision: 'reject',
      note,
      notify: true,
    })
    ElMessage.success('已驳回，已通知双方')
    detailVisible.value = false
    await fetchComplaints()
  } catch (err: any) {
    if (err === 'cancel' || err === 'close') return
    ElMessage.error(getErrorMessage(err))
  } finally {
    processing.value = false
  }
}

onMounted(() => {
  fetchComplaints()
})
</script>
