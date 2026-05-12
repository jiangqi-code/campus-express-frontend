<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'

import { auditAdminAuth, listAdminAuth, type AdminAuthRow } from '@/api/admin'

const loading = ref(false)
const errorMessage = ref('')
const rows = ref<AdminAuthRow[]>([])
const total = ref(0)

const pagination = reactive({
  page: 1,
  pageSize: 10,
})

const pageSizeOptions = [10, 20, 50]

const busyAction = reactive<Record<string, 'audit' | undefined>>({})

const auditModal = ref(false)
const auditSubmitting = ref(false)
const currentRow = ref<AdminAuthRow | null>(null)
const auditForm = reactive({
  decision: 'approve' as 'approve' | 'reject',
  reason: '',
})

function getErrorMessage(err: any) {
  return (
    err?.response?.data?.message ||
    err?.response?.data?.msg ||
    err?.response?.data?.error ||
    err?.message ||
    '操作失败'
  )
}

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pagination.pageSize)))

const pageItems = computed<(number | '...')[]>(() => {
  const tp = totalPages.value
  const cur = pagination.page
  if (tp <= 7) return Array.from({ length: tp }, (_, i) => i + 1)

  const items: (number | '...')[] = [1]

  if (cur <= 4) {
    items.push(2, 3, 4, 5, '...', tp)
    return items
  }

  if (cur >= tp - 3) {
    items.push('...', tp - 4, tp - 3, tp - 2, tp - 1, tp)
    return items
  }

  items.push('...', cur - 1, cur, cur + 1, '...', tp)
  return items
})

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

function isPendingStatus(status: string) {
  const s = String(status || '').trim().toLowerCase()
  if (!s) return true
  if (s === '0') return true
  return s === 'pending' || s === 'wait' || s === 'waiting' || s.includes('待') || s.includes('审核中') || s.includes('review')
}

function statusLabel(status: string) {
  const s = String(status || '').trim()
  const lower = s.toLowerCase()
  if (!s) return '待审核'
  if (isPendingStatus(s)) return '待审核'
  if (lower === '1') return '已通过'
  if (lower === '2') return '已拒绝'
  if (lower.includes('approve') || lower.includes('pass') || s.includes('通过')) return '已通过'
  if (lower.includes('reject') || lower.includes('fail') || s.includes('拒绝')) return '已拒绝'
  return s
}

function statusBadgeClass(status: string) {
  const s = String(status || '').trim().toLowerCase()
  if (!s || isPendingStatus(s)) return 'badge text-bg-warning'
  if (s === '1') return 'badge text-bg-success'
  if (s === '2') return 'badge text-bg-danger'
  if (s.includes('approve') || s.includes('pass') || s.includes('success') || s.includes('通过')) return 'badge text-bg-success'
  if (s.includes('reject') || s.includes('fail') || s.includes('拒绝')) return 'badge text-bg-danger'
  return 'badge text-bg-light border'
}

async function fetchList() {
  loading.value = true
  errorMessage.value = ''
  try {
    const res = await listAdminAuth({ page: pagination.page, pageSize: pagination.pageSize })
    rows.value = res.list
    total.value = res.total

    const tp = Math.max(1, Math.ceil(res.total / pagination.pageSize))
    if (pagination.page > tp) {
      pagination.page = tp
      const res2 = await listAdminAuth({ page: pagination.page, pageSize: pagination.pageSize })
      rows.value = res2.list
      total.value = res2.total
    }
  } catch (err: any) {
    errorMessage.value = getErrorMessage(err)
    rows.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

function onChangePageSize(next: number) {
  pagination.pageSize = next
  pagination.page = 1
  fetchList()
}

function goPage(p: number) {
  if (p < 1 || p > totalPages.value || p === pagination.page) return
  pagination.page = p
  fetchList()
}

function openAudit(row: AdminAuthRow) {
  currentRow.value = row
  auditForm.decision = 'approve'
  auditForm.reason = ''
  auditModal.value = true
}

function closeAudit() {
  if (auditSubmitting.value) return
  auditModal.value = false
  currentRow.value = null
  auditForm.decision = 'approve'
  auditForm.reason = ''
}

async function submitAudit() {
  const row = currentRow.value
  if (!row) return

  const approved = auditForm.decision === 'approve'
  const reason = auditForm.reason.trim()
  if (!approved && !reason) {
    ElMessage.warning('请输入拒绝原因')
    return
  }

  auditSubmitting.value = true
  busyAction[row.id] = 'audit'
  try {
    await auditAdminAuth(row.id, { approved, reason: approved ? undefined : reason })
    ElMessage.success(approved ? '已通过' : '已拒绝')
    closeAudit()
    if (rows.value.length === 1 && pagination.page > 1) pagination.page -= 1
    await fetchList()
  } catch (err: any) {
    ElMessage.error(getErrorMessage(err))
  } finally {
    busyAction[row.id] = undefined
    auditSubmitting.value = false
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
        <button class="btn btn-outline-primary" type="button" :disabled="loading" @click="fetchList">刷新</button>
      </div>
    </div>

    <div v-if="errorMessage" class="alert alert-danger mb-0" role="alert">{{ errorMessage }}</div>

    <div class="card border-0 shadow-sm">
      <div class="card-body">
        <div class="row g-3 align-items-end">
          <div class="col-6 col-md-4 col-lg-2">
            <label class="form-label text-muted small mb-1">每页</label>
            <select
              class="form-select"
              :value="pagination.pageSize"
              :disabled="loading"
              @change="onChangePageSize(Number(($event.target as HTMLSelectElement).value))"
            >
              <option v-for="s in pageSizeOptions" :key="s" :value="s">{{ s }}</option>
            </select>
          </div>
          <div class="col-12 col-md-8 col-lg-10 d-flex justify-content-md-end">
            <div class="text-muted small">共 {{ total }} 条 · 第 {{ pagination.page }} / {{ totalPages }} 页</div>
          </div>
        </div>

        <div v-if="loading && rows.length === 0" class="placeholder-glow mt-3">
          <div class="placeholder col-12 mb-2" />
          <div class="placeholder col-10 mb-2" />
          <div class="placeholder col-11" />
        </div>

        <div v-else class="table-responsive mt-3">
          <table class="table table-hover align-middle">
            <thead>
              <tr>
                <th>申请人姓名</th>
                <th class="text-nowrap">校园卡照片</th>
                <th class="text-nowrap">申请时间</th>
                <th class="text-nowrap">状态</th>
                <th class="text-nowrap">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="rows.length === 0">
                <td colspan="5" class="text-muted text-center py-4">暂无数据</td>
              </tr>
              <tr v-for="r in rows" :key="r.id">
                <td class="fw-semibold">{{ r.applicantName }}</td>
                <td class="text-nowrap">
                  <a v-if="r.campusCardPhotoUrl" :href="r.campusCardPhotoUrl" target="_blank" rel="noopener noreferrer">
                    <img
                      :src="r.campusCardPhotoUrl"
                      alt="campus-card"
                      class="rounded border"
                      style="width: 96px; height: 60px; object-fit: cover"
                    />
                  </a>
                  <span v-else class="text-muted">-</span>
                </td>
                <td class="text-nowrap text-muted">{{ formatTime(r.appliedAt) }}</td>
                <td class="text-nowrap">
                  <span :class="statusBadgeClass(r.status)">{{ statusLabel(r.status) }}</span>
                </td>
                <td class="text-nowrap">
                  <button
                    class="btn btn-sm btn-primary"
                    type="button"
                    :disabled="loading || Boolean(busyAction[r.id]) || !isPendingStatus(r.status)"
                    @click="openAudit(r)"
                  >
                    <span v-if="busyAction[r.id] === 'audit'" class="spinner-border spinner-border-sm me-2" aria-hidden="true" />
                    审核
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mt-3">
          <div class="text-muted small">显示 {{ rows.length }} 条</div>
          <nav aria-label="Pagination">
            <ul class="pagination mb-0">
              <li class="page-item" :class="{ disabled: pagination.page <= 1 || loading }">
                <button class="page-link" type="button" @click="goPage(pagination.page - 1)">上一页</button>
              </li>
              <li
                v-for="it in pageItems"
                :key="String(it)"
                class="page-item"
                :class="{ active: it === pagination.page, disabled: it === '...' || loading }"
              >
                <button v-if="it !== '...'" class="page-link" type="button" @click="goPage(it as number)">{{ it }}</button>
                <span v-else class="page-link">…</span>
              </li>
              <li class="page-item" :class="{ disabled: pagination.page >= totalPages || loading }">
                <button class="page-link" type="button" @click="goPage(pagination.page + 1)">下一页</button>
              </li>
            </ul>
          </nav>
        </div>
      </div>
    </div>

    <div v-if="auditModal" class="modal fade show" tabindex="-1" style="display: block" role="dialog" aria-modal="true">
      <div class="modal-dialog modal-dialog-centered modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">审核申请</h5>
            <button class="btn-close" type="button" aria-label="Close" :disabled="auditSubmitting" @click="closeAudit" />
          </div>
          <div class="modal-body">
            <div v-if="currentRow" class="row g-3">
              <div class="col-12 col-lg-5">
                <div class="text-muted small">申请人</div>
                <div class="fw-semibold">{{ currentRow.applicantName }}</div>
                <div class="text-muted small mt-2">校园卡照片</div>
                <div class="mt-1">
                  <a
                    v-if="currentRow.campusCardPhotoUrl"
                    :href="currentRow.campusCardPhotoUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <img
                      :src="currentRow.campusCardPhotoUrl"
                      alt="campus-card"
                      class="rounded border w-100"
                      style="max-height: 240px; object-fit: contain; background: #fff"
                    />
                  </a>
                  <div v-else class="text-muted">无图片</div>
                </div>
              </div>
              <div class="col-12 col-lg-7">
                <div class="text-muted small">申请时间</div>
                <div class="fw-semibold">{{ formatTime(currentRow.appliedAt) }}</div>

                <div class="mt-3">
                  <div class="text-muted small mb-2">审核结果</div>
                  <div class="d-flex flex-wrap gap-3">
                    <div class="form-check">
                      <input id="ce-audit-approve" v-model="auditForm.decision" class="form-check-input" type="radio" value="approve" />
                      <label class="form-check-label" for="ce-audit-approve">通过</label>
                    </div>
                    <div class="form-check">
                      <input id="ce-audit-reject" v-model="auditForm.decision" class="form-check-input" type="radio" value="reject" />
                      <label class="form-check-label" for="ce-audit-reject">拒绝</label>
                    </div>
                  </div>
                </div>

                <div class="mt-3">
                  <label class="form-label">拒绝原因</label>
                  <textarea
                    v-model="auditForm.reason"
                    class="form-control"
                    rows="4"
                    placeholder="请输入拒绝原因"
                    :disabled="auditSubmitting || auditForm.decision !== 'reject'"
                  />
                </div>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline-secondary" type="button" :disabled="auditSubmitting" @click="closeAudit">取消</button>
            <button class="btn btn-primary" type="button" :disabled="auditSubmitting" @click="submitAudit">
              <span v-if="auditSubmitting" class="spinner-border spinner-border-sm me-2" aria-hidden="true" />
              {{ auditForm.decision === 'approve' ? '通过' : '拒绝' }}
            </button>
          </div>
        </div>
      </div>
    </div>
    <div v-if="auditModal" class="modal-backdrop fade show" @click="closeAudit" />
  </div>
</template>
