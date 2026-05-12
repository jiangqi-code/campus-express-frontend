<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'

import { listAdminRunnerAuthAll, type AdminAuthRow } from '@/api/admin'
import { http } from '@/api/request'

const loading = ref(false)
const errorMessage = ref('')
const rows = ref<AdminAuthRow[]>([])

const busyAction = reactive<Record<string, 'approve' | 'reject' | undefined>>({})

const detailDialogVisible = ref(false)
const detailRow = ref<AdminAuthRow | null>(null)

const approveDialogVisible = ref(false)
const approveSubmitting = ref(false)
const approveRow = ref<AdminAuthRow | null>(null)
const approveReason = ref('')
const approveError = ref('')

const rejectDialogVisible = ref(false)
const rejectSubmitting = ref(false)
const rejectRow = ref<AdminAuthRow | null>(null)
const rejectReason = ref('')
const rejectError = ref('')

function getErrorMessage(err: any) {
  return (
    err?.response?.data?.message ||
    err?.response?.data?.msg ||
    err?.response?.data?.error ||
    err?.message ||
    '操作失败'
  )
}

function normalizeStatusUpper(status: unknown): 'PENDING' | 'APPROVED' | 'REJECTED' {
  const s = String(status ?? '').trim()
  const lower = s.toLowerCase()
  if (!s || lower === '0') return 'PENDING'
  if (lower === 'pending' || lower === 'wait' || lower === 'waiting' || lower.includes('待') || lower.includes('审核中') || lower.includes('review'))
    return 'PENDING'
  if (lower === '1' || lower.includes('approve') || lower.includes('pass') || lower.includes('success') || lower.includes('通过')) return 'APPROVED'
  if (lower === '2' || lower.includes('reject') || lower.includes('fail') || lower.includes('refuse') || lower.includes('拒绝')) return 'REJECTED'
  return 'PENDING'
}

function statusTagType(status: unknown): 'warning' | 'success' | 'danger' {
  const s = normalizeStatusUpper(status)
  if (s === 'APPROVED') return 'success'
  if (s === 'REJECTED') return 'danger'
  return 'warning'
}

function formatTime(v?: string) {
  if (!v) return '-'
  const dt = new Date(v)
  if (Number.isNaN(dt.getTime())) return String(v)
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(dt)
}

const tableRows = computed(() => {
  return [...rows.value].sort((a, b) => {
    const ta = a.appliedAt ? new Date(a.appliedAt).getTime() : 0
    const tb = b.appliedAt ? new Date(b.appliedAt).getTime() : 0
    return tb - ta
  })
})

function resolvePhotoUrl(raw: unknown) {
  const v = String(raw ?? '').trim()
  if (!v) return ''
  if (/^https?:\/\//i.test(v)) return v
  if (v.startsWith('/')) return `http://localhost:3000${v}`
  return `http://localhost:3000/${v}`
}

async function fetchList() {
  loading.value = true
  errorMessage.value = ''
  try {
    const list = await listAdminRunnerAuthAll()
    rows.value = list
  } catch (err: any) {
    errorMessage.value = getErrorMessage(err)
    rows.value = []
  } finally {
    loading.value = false
  }
}

function openDetail(row: AdminAuthRow) {
  detailRow.value = row
  detailDialogVisible.value = true
}

function closeDetail() {
  detailDialogVisible.value = false
  detailRow.value = null
}

function openApprove(row: AdminAuthRow) {
  if (busyAction[row.id]) return
  approveRow.value = row
  approveReason.value = ''
  approveError.value = ''
  approveDialogVisible.value = true
}

function closeApprove() {
  if (approveSubmitting.value) return
  approveDialogVisible.value = false
  approveRow.value = null
  approveReason.value = ''
  approveError.value = ''
}

async function submitApprove() {
  const row = approveRow.value
  if (!row) return
  if (approveSubmitting.value) return

  approveSubmitting.value = true
  approveError.value = ''
  busyAction[row.id] = 'approve'
  try {
    const reason = approveReason.value.trim()
    const body: Record<string, any> = { action: 'approve' }
    if (reason) body.reason = reason
    await http.post(`/admin/auth/${row.id}/audit`, body)
    ElMessage.success('已通过')
    approveDialogVisible.value = false
    approveRow.value = null
    approveReason.value = ''
    await fetchList()
  } catch (err: any) {
    const msg = getErrorMessage(err)
    approveError.value = msg
    ElMessage.error(msg)
  } finally {
    busyAction[row.id] = undefined
    approveSubmitting.value = false
  }
}

function openReject(row: AdminAuthRow) {
  if (busyAction[row.id]) return
  rejectRow.value = row
  rejectReason.value = ''
  rejectError.value = ''
  rejectDialogVisible.value = true
}

function closeReject() {
  if (rejectSubmitting.value) return
  rejectDialogVisible.value = false
  rejectRow.value = null
  rejectReason.value = ''
  rejectError.value = ''
}

async function submitReject() {
  const row = rejectRow.value
  if (!row) return

  const reason = rejectReason.value.trim()
  if (!reason) {
    ElMessage.error('拒绝理由不能为空')
    return
  }

  if (rejectSubmitting.value) return
  rejectSubmitting.value = true
  rejectError.value = ''
  busyAction[row.id] = 'reject'
  try {
    await http.post(`/admin/auth/${row.id}/audit`, { action: 'reject', reason })
    ElMessage.success('已拒绝')
    rejectDialogVisible.value = false
    rejectRow.value = null
    rejectReason.value = ''
    await fetchList()
  } catch (err: any) {
    const msg = getErrorMessage(err)
    rejectError.value = msg
    ElMessage.error(msg)
  } finally {
    busyAction[row.id] = undefined
    rejectSubmitting.value = false
  }
}

onMounted(() => {
  fetchList()
})
</script>

<template>
  <div class="vstack gap-3">
    <div class="d-flex flex-wrap align-items-end justify-content-between gap-2">
      <div>
        <h1 class="h4 mb-1">跑腿员入驻审核</h1>
        <div class="text-muted">管理员：审核跑腿员入驻申请</div>
      </div>
      <div class="d-flex gap-2">
        <el-button type="primary" :loading="loading" @click="fetchList">刷新</el-button>
      </div>
    </div>

    <div v-if="errorMessage" class="alert alert-danger mb-0" role="alert">{{ errorMessage }}</div>

    <el-card>
      <el-table :data="tableRows" v-loading="loading" row-key="id" empty-text="暂无申请记录">
        <el-table-column prop="applicantName" label="申请人姓名" min-width="140" />
        <el-table-column label="校园卡照片" min-width="160">
          <template #default="scope">
            <el-image
              v-if="resolvePhotoUrl(scope.row.card_image_url)"
              :src="resolvePhotoUrl(scope.row.card_image_url)"
              :preview-src-list="[resolvePhotoUrl(scope.row.card_image_url)]"
              fit="cover"
              style="width: 96px; height: 64px; border-radius: 6px"
              preview-teleported
            />
            <span v-else class="text-muted">暂无图片</span>
          </template>
        </el-table-column>
        <el-table-column label="申请时间" min-width="180">
          <template #default="{ row }">
            <span>{{ formatTime(row.appliedAt) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="140">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)">{{ normalizeStatusUpper(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="260" fixed="right">
          <template #default="{ row }">
            <div class="d-flex gap-2">
              <el-button size="small" @click="openDetail(row)">查看详情</el-button>
              <el-button
                type="success"
                size="small"
                :loading="busyAction[row.id] === 'approve'"
                :disabled="normalizeStatusUpper(row.status) !== 'PENDING' || Boolean(busyAction[row.id])"
                @click="openApprove(row)"
              >
                通过
              </el-button>
              <el-button
                type="danger"
                size="small"
                :loading="busyAction[row.id] === 'reject'"
                :disabled="normalizeStatusUpper(row.status) !== 'PENDING' || Boolean(busyAction[row.id])"
                @click="openReject(row)"
              >
                拒绝
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="detailDialogVisible" title="申请详情" width="720px" :close-on-click-modal="false" @close="closeDetail">
      <el-descriptions :column="1" border>
        <el-descriptions-item label="申请人姓名">{{ detailRow?.applicantName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="申请时间">{{ formatTime(detailRow?.appliedAt) }}</el-descriptions-item>
        <el-descriptions-item label="校园卡照片">
          <el-image
            v-if="resolvePhotoUrl(detailRow?.card_image_url)"
            :src="resolvePhotoUrl(detailRow?.card_image_url)"
            :preview-src-list="[resolvePhotoUrl(detailRow?.card_image_url)]"
            fit="contain"
            style="width: 240px; height: 160px; border-radius: 8px"
            preview-teleported
          />
          <span v-else class="text-muted">暂无图片</span>
        </el-descriptions-item>
      </el-descriptions>
      <template #footer>
        <div class="d-flex justify-content-end gap-2">
          <el-button @click="closeDetail">关闭</el-button>
        </div>
      </template>
    </el-dialog>

    <el-dialog
      v-model="approveDialogVisible"
      title="通过申请"
      width="520px"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      :show-close="false"
      @close="closeApprove"
    >
      <div class="vstack gap-2">
        <div class="text-muted">
          申请人：<span class="text-body">{{ approveRow?.applicantName || '-' }}</span>
        </div>
        <el-alert v-if="approveError" type="error" :closable="false" show-icon :title="approveError" />
        <el-input
          v-model="approveReason"
          type="textarea"
          :rows="4"
          maxlength="200"
          show-word-limit
          placeholder="备注（可选）"
        />
      </div>
      <template #footer>
        <div class="d-flex justify-content-end gap-2">
          <el-button :disabled="approveSubmitting" @click="closeApprove">取消</el-button>
          <el-button type="success" :loading="approveSubmitting" @click="submitApprove">确认通过</el-button>
        </div>
      </template>
    </el-dialog>

    <el-dialog
      v-model="rejectDialogVisible"
      title="拒绝申请"
      width="520px"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      :show-close="false"
      @close="closeReject"
    >
      <div class="vstack gap-2">
        <div class="text-muted">
          申请人：<span class="text-body">{{ rejectRow?.applicantName || '-' }}</span>
        </div>
        <el-alert v-if="rejectError" type="error" :closable="false" show-icon :title="rejectError" />
        <el-input
          v-model="rejectReason"
          type="textarea"
          :rows="4"
          maxlength="200"
          show-word-limit
          placeholder="请输入拒绝理由（必填）"
        />
      </div>
      <template #footer>
        <div class="d-flex justify-content-end gap-2">
          <el-button :disabled="rejectSubmitting" @click="closeReject">取消</el-button>
          <el-button type="danger" :loading="rejectSubmitting" @click="submitReject">确认拒绝</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>
