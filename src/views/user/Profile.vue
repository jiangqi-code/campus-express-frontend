<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useRouter } from 'vue-router'

import { http } from '@/api/request'
import { useAuthStore, type RunnerAuthState, type RunnerAuthStatus } from '@/stores/auth'

type RoleLabel = 'ADMIN' | 'RUNNER' | 'USER'
type AppRole = 'admin' | 'runner' | 'user'

type MeVM = {
  id: string
  nickname: string
  phone: string
  studentId: string
  role: RoleLabel
  creditScore: number
  avatarUrl: string
}

type WalletVM = {
  balance: number
  frozen: number
}

const auth = useAuthStore()
const router = useRouter()

const loading = ref(false)
const walletLoading = ref(false)
const busySave = ref(false)
const busySwitchRole = ref(false)
const busyAvatar = ref(false)
const runnerAuthLoading = ref(false)

const me = ref<MeVM | null>(null)
const wallet = ref<WalletVM>({ balance: 0, frozen: 0 })

const form = reactive({
  nickname: '',
  phone: '',
  studentId: '',
})

const avatarInputRef = ref<HTMLInputElement | null>(null)
const avatarPreviewUrl = ref<string>('')

const rechargeModal = ref(false)
const rechargeSubmitting = ref(false)
const rechargeAmountInput = ref<string>('')

function getErrorMessage(err: any) {
  return (
    err?.response?.data?.message ||
    err?.response?.data?.msg ||
    err?.response?.data?.error ||
    err?.message ||
    '操作失败'
  )
}

function normalizeNumber(v: unknown, fallback = 0) {
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN
  return Number.isFinite(n) ? n : fallback
}

function normalizeText(v: unknown) {
  return String(v ?? '').trim()
}

function normalizeRunnerAuthStatus(raw: unknown): RunnerAuthStatus {
  const s = String(raw ?? '').trim()
  const lower = s.toLowerCase()
  if (!s) return 'NONE'
  if (lower === 'none') return 'NONE'
  if (lower === 'pending' || lower === 'wait' || lower === 'waiting' || lower.includes('待') || lower.includes('审核'))
    return 'PENDING'
  if (lower === 'approved' || lower === 'pass' || lower === 'success' || lower.includes('通过')) return 'APPROVED'
  if (lower === 'rejected' || lower === 'reject' || lower === 'fail' || lower.includes('拒绝')) return 'REJECTED'
  return 'PENDING'
}

function normalizeRunnerAuthState(input: any): RunnerAuthState {
  const hasApplied = Boolean(input?.hasApplied ?? input?.has_applied ?? input?.applied)
  const authStatus = normalizeRunnerAuthStatus(input?.authStatus ?? input?.auth_status ?? input?.status ?? input?.auditStatus)
  const runnerApproved = Boolean(input?.runnerApproved ?? input?.runner_approved ?? input?.approved ?? authStatus === 'APPROVED')
  return { hasApplied: hasApplied || authStatus !== 'NONE', authStatus, runnerApproved: runnerApproved || authStatus === 'APPROVED', updatedAt: Date.now() }
}

function pickRunnerAuthRecord(data: any): any | null {
  const root = data?.data ?? data
  const list =
    root?.list ??
    root?.rows ??
    root?.items ??
    root?.records ??
    root?.result ??
    root?.authList ??
    root?.auths ??
    root?.data ??
    undefined
  const arr = Array.isArray(root) ? root : Array.isArray(list) ? list : null
  if (arr && arr.length > 0) {
    const sorted = [...arr].sort((a, b) => {
      const ta = new Date(String(a?.appliedAt ?? a?.applied_at ?? a?.createdAt ?? a?.created_at ?? a?.time ?? 0)).getTime()
      const tb = new Date(String(b?.appliedAt ?? b?.applied_at ?? b?.createdAt ?? b?.created_at ?? b?.time ?? 0)).getTime()
      return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0)
    })
    return sorted[0] ?? null
  }
  if (root && typeof root === 'object') return root
  return null
}

async function fetchRunnerAuthStatus() {
  if (auth.role !== 'user') return
  runnerAuthLoading.value = true
  try {
    try {
      const res = await http.get('/user/auth-status')
      const data = res?.data?.data ?? res?.data ?? {}
      auth.setRunnerAuthState(normalizeRunnerAuthState(data))
      return
    } catch {
      const res = await http.get('/user/auth')
      const record = pickRunnerAuthRecord(res?.data)
      if (!record) {
        auth.setRunnerAuthState({ hasApplied: false, authStatus: 'NONE', runnerApproved: false, updatedAt: Date.now() })
        return
      }
      const status = normalizeRunnerAuthStatus(
        record?.authStatus ??
          record?.auth_status ??
          record?.status ??
          record?.auditStatus ??
          record?.audit_status ??
          record?.state ??
          record?.resultStatus ??
          record?.result_status,
      )
      auth.setRunnerAuthState({
        hasApplied: true,
        authStatus: status,
        runnerApproved: status === 'APPROVED',
        updatedAt: Date.now(),
      })
    }
  } catch {
    auth.setRunnerAuthState({ updatedAt: Date.now() })
    // TODO: 后端补齐 /api/user/auth-status 后移除本地状态兜底逻辑
  } finally {
    runnerAuthLoading.value = false
  }
}

function toRoleLabel(role: unknown): RoleLabel {
  const s = normalizeText(role).toUpperCase()
  if (s === 'ADMIN') return 'ADMIN'
  if (s === 'RUNNER') return 'RUNNER'
  return 'USER'
}

function toAppRole(role: unknown): AppRole {
  const s = toRoleLabel(role)
  if (s === 'ADMIN') return 'admin'
  if (s === 'RUNNER') return 'runner'
  return 'user'
}

function roleBadgeClass(role: RoleLabel) {
  if (role === 'ADMIN') return 'badge text-bg-danger'
  if (role === 'RUNNER') return 'badge text-bg-primary'
  return 'badge text-bg-secondary'
}

function formatMoney(v: number) {
  return (Number.isFinite(v) ? v : 0).toFixed(2)
}

const currentRoleLabel = computed<RoleLabel>(() => toRoleLabel(me.value?.role ?? auth.role))

const showRoleSwitchButton = computed(() => auth.role === 'user' || auth.role === 'runner')
const roleSwitchButtonLabel = computed(() => {
  if (auth.role === 'user') return '切换为跑腿员'
  if (auth.role === 'runner') return '切换为普通用户'
  return ''
})

const effectiveRunnerAuthStatus = computed<RunnerAuthStatus>(() => {
  if (auth.role !== 'user') return auth.runnerAuth.authStatus
  if (auth.runnerAuth.hasApplied && auth.runnerAuth.authStatus === 'NONE') return 'PENDING'
  return auth.runnerAuth.authStatus
})

const runnerStatusLabel = computed(() => {
  if (auth.role === 'runner') return '已是跑腿员'
  if (auth.role === 'admin') return '管理员'
  const s = effectiveRunnerAuthStatus.value
  if (s === 'APPROVED') return '已通过'
  if (s === 'REJECTED') return '已拒绝'
  if (s === 'PENDING') return '审核中'
  return auth.runnerAuth.hasApplied ? '审核中' : '未申请'
})

const runnerStatusBadgeClass = computed(() => {
  if (auth.role === 'runner') return 'badge text-bg-primary'
  if (auth.role === 'admin') return 'badge text-bg-danger'
  const s = effectiveRunnerAuthStatus.value
  if (s === 'APPROVED') return 'badge text-bg-success'
  if (s === 'REJECTED') return 'badge text-bg-danger'
  if (s === 'PENDING') return 'badge text-bg-warning'
  return 'badge text-bg-secondary'
})

const showApplyButton = computed(() => auth.role === 'user' && effectiveRunnerAuthStatus.value !== 'APPROVED')

const applyButtonText = computed(() => {
  if (runnerAuthLoading.value) return '加载中'
  const s = effectiveRunnerAuthStatus.value
  if (s === 'PENDING') return '审核中'
  if (s === 'REJECTED') return '重新申请'
  return '申请成为跑腿员'
})

const applyButtonDisabled = computed(() => runnerAuthLoading.value || effectiveRunnerAuthStatus.value === 'PENDING')
const applyButtonClass = computed(() => (applyButtonDisabled.value ? 'btn btn-secondary flex-fill' : 'btn btn-primary flex-fill'))

const avatarInitial = computed(() => {
  const name = (me.value?.nickname || auth.displayName || '同学').trim()
  return name.slice(0, 1).toUpperCase() || 'U'
})

const studentIdLabel = computed(() => (form.studentId ? form.studentId : '—'))

function openAvatarPicker() {
  if (busyAvatar.value) return
  avatarInputRef.value?.click()
}

async function fetchMe() {
  loading.value = true
  try {
    const res = await http.get('/auth/me')
    const raw = res?.data?.user ?? res?.data?.data ?? res?.data ?? {}
    const nickname = normalizeText(raw.nickname ?? raw.displayName ?? raw.name ?? raw.username) || '同学'
    const phone = normalizeText(raw.phone ?? raw.mobile ?? raw.tel)
    const studentId = normalizeText(raw.student_id ?? raw.studentId ?? raw.sid ?? raw.account)
    const role = toRoleLabel(raw.role ?? raw.userRole ?? raw.identity)
    const creditScore = normalizeNumber(raw.credit ?? raw.credit_score ?? raw.creditScore ?? raw.score ?? raw.reputation, 0)
    const avatarUrl = normalizeText(raw.avatar ?? raw.avatar_url ?? raw.avatarUrl ?? raw.headImg ?? raw.head_img)
    const id = normalizeText(raw.id ?? raw.user_id ?? raw.uid ?? raw.account ?? auth.userId)

    me.value = { id, nickname, phone, studentId, role, creditScore, avatarUrl }
    form.nickname = nickname
    form.phone = phone
    form.studentId = studentId

    auth.setSession({
      token: auth.token,
      role: toAppRole(role),
      displayName: nickname || auth.displayName,
      userId: id || auth.userId,
    })
  } catch (err: any) {
    ElMessage.error(getErrorMessage(err))
  } finally {
    loading.value = false
  }
}

async function fetchWallet() {
  walletLoading.value = true
  try {
    const res = await http.get('/wallet/info')
    const raw = res?.data?.data ?? res?.data?.wallet ?? res?.data ?? {}
    wallet.value = {
      balance: normalizeNumber(raw.balance ?? raw.money ?? raw.amount ?? raw.available, 0),
      frozen: normalizeNumber(raw.frozen ?? raw.freeze ?? raw.frozen_amount ?? raw.locked, 0),
    }
  } catch (err: any) {
    ElMessage.error(getErrorMessage(err))
  } finally {
    walletLoading.value = false
  }
}

async function refreshAll() {
  await Promise.all([fetchMe(), fetchWallet(), fetchRunnerAuthStatus()])
}

async function onSaveProfile() {
  if (busySave.value) return
  const nickname = form.nickname.trim()
  const phone = form.phone.trim()
  const studentId = form.studentId.trim()

  if (!nickname) {
    ElMessage.warning('昵称不能为空')
    return
  }

  busySave.value = true
  try {
    const payload: Record<string, any> = { nickname, phone }
    if (studentId) payload.student_id = studentId

    try {
      await http.put('/user/profile', payload)
    } catch (err: any) {
      if (studentId) {
        await http.put('/user/profile', { nickname, phone })
      } else {
        throw err
      }
    }

    ElMessage.success('资料已更新')
    await fetchMe()
  } catch (err: any) {
    ElMessage.error(getErrorMessage(err))
  } finally {
    busySave.value = false
  }
}

async function onAvatarSelected(e: Event) {
  const input = e.target as HTMLInputElement | null
  const file = input?.files?.[0]
  if (!file) return

  if (!file.type.startsWith('image/')) {
    ElMessage.warning('请选择图片文件')
    if (input) input.value = ''
    return
  }

  if (busyAvatar.value) return
  busyAvatar.value = true

  if (avatarPreviewUrl.value) URL.revokeObjectURL(avatarPreviewUrl.value)
  avatarPreviewUrl.value = URL.createObjectURL(file)

  try {
    const fd = new FormData()
    fd.append('file', file)
    await http.post('/user/avatar', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    ElMessage.success('头像已更新')
    await fetchMe()
  } catch (err: any) {
    ElMessage.error(getErrorMessage(err))
  } finally {
    if (input) input.value = ''
    busyAvatar.value = false
  }
}

async function onSwitchRole() {
  if (!showRoleSwitchButton.value || busySwitchRole.value) return

  const nextRoleLabel: RoleLabel = auth.role === 'user' ? 'RUNNER' : 'USER'
  const nextAppRole: AppRole = nextRoleLabel === 'RUNNER' ? 'runner' : 'user'
  const successMsg = nextRoleLabel === 'RUNNER' ? '已切换为跑腿员' : '已切换为普通用户'

  busySwitchRole.value = true
  try {
    try {
      await http.put('/user/switch-role', { role: nextRoleLabel })
    } catch {
      await http.put('/user/switch-role', {})
    }

    if (me.value) me.value = { ...me.value, role: nextRoleLabel }
    auth.setSession({ token: auth.token, role: nextAppRole, displayName: auth.displayName, userId: auth.userId })
    ElMessage.success(successMsg)
    await refreshAll()
  } catch (err: any) {
    ElMessage.error(getErrorMessage(err))
  } finally {
    busySwitchRole.value = false
  }
}

async function onGoApplyRunner() {
  if (applyButtonDisabled.value) return
  await router.push('/runner/apply')
}

function openRecharge() {
  rechargeAmountInput.value = ''
  rechargeModal.value = true
}

function closeRecharge() {
  if (rechargeSubmitting.value) return
  rechargeModal.value = false
}

async function submitRecharge() {
  if (rechargeSubmitting.value) return
  const amount = Number(rechargeAmountInput.value)
  if (!Number.isFinite(amount) || amount <= 0) {
    ElMessage.warning('请输入正确的充值金额')
    return
  }

  rechargeSubmitting.value = true
  try {
    await http.post('/wallet/recharge', { amount })
    ElMessage.success('充值成功')
    rechargeModal.value = false
    await fetchWallet()
  } catch (err: any) {
    ElMessage.error(getErrorMessage(err))
  } finally {
    rechargeSubmitting.value = false
  }
}

onMounted(() => {
  refreshAll()
})
</script>

<template>
  <div class="vstack gap-3">
    <div class="d-flex flex-wrap align-items-end justify-content-between gap-2">
      <div>
        <h1 class="h4 mb-1">个人中心</h1>
        <div class="text-muted">头像、资料、钱包与身份管理</div>
      </div>
      <div class="d-flex gap-2">
        <button class="btn btn-outline-primary" type="button" :disabled="loading || walletLoading" @click="refreshAll">
          刷新
        </button>
      </div>
    </div>

    <div class="row g-3">
      <div class="col-12 col-lg-7">
        <div class="card border-0 shadow-sm">
          <div class="card-body">
            <div class="d-flex flex-wrap align-items-start justify-content-between gap-3">
              <div class="d-flex align-items-center gap-3">
                <div
                  v-if="!avatarPreviewUrl && !me?.avatarUrl"
                  class="rounded-circle d-flex align-items-center justify-content-center border"
                  style="width: 64px; height: 64px; background: rgba(59, 130, 246, 0.08)"
                >
                  <span class="fw-semibold">{{ avatarInitial }}</span>
                </div>
                <img
                  v-else
                  class="rounded-circle border"
                  style="width: 64px; height: 64px; object-fit: cover"
                  :src="avatarPreviewUrl || me?.avatarUrl"
                  alt="avatar"
                />

                <div>
                  <div class="d-flex flex-wrap align-items-center gap-2">
                    <div class="fs-5 fw-semibold">{{ me?.nickname || auth.displayName }}</div>
                    <span :class="roleBadgeClass(currentRoleLabel)">{{ currentRoleLabel }}</span>
                  </div>
                  <div class="text-muted small mt-1">
                    <span class="me-3">学号：{{ studentIdLabel }}</span>
                    <span>信用分：{{ me?.creditScore ?? 0 }}</span>
                  </div>
                </div>
              </div>

              <div class="d-flex gap-2">
                <input
                  ref="avatarInputRef"
                  class="d-none"
                  type="file"
                  accept="image/*"
                  :disabled="busyAvatar"
                  @change="onAvatarSelected"
                />
                <button class="btn btn-outline-primary" type="button" :disabled="busyAvatar" @click="openAvatarPicker">
                  <span v-if="busyAvatar" class="spinner-border spinner-border-sm me-2" aria-hidden="true" />
                  上传头像
                </button>
              </div>
            </div>

            <hr class="my-4" />

            <div class="row g-3">
              <div class="col-12 col-md-6">
                <label class="form-label">昵称</label>
                <input v-model="form.nickname" class="form-control" :disabled="busySave" placeholder="请输入昵称" />
              </div>
              <div class="col-12 col-md-6">
                <label class="form-label">手机号</label>
                <input v-model="form.phone" class="form-control" :disabled="busySave" placeholder="请输入手机号" />
              </div>
              <div class="col-12 col-md-6">
                <label class="form-label">学号</label>
                <input v-model="form.studentId" class="form-control" :disabled="busySave" placeholder="请输入学号" />
              </div>
            </div>

            <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-4">
              <div class="text-muted small">用户ID：{{ me?.id || auth.userId || '—' }}</div>
              <button class="btn btn-primary" type="button" :disabled="busySave" @click="onSaveProfile">
                <span v-if="busySave" class="spinner-border spinner-border-sm me-2" aria-hidden="true" />
                保存资料
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="col-12 col-lg-5">
        <div class="vstack gap-3">
          <div class="card border-0 shadow-sm">
            <div class="card-body">
              <div class="d-flex align-items-start justify-content-between">
                <div>
                  <div class="fw-semibold">钱包</div>
                  <div class="text-muted small mt-1">余额与冻结金额</div>
                </div>
                <button class="btn btn-primary btn-sm" type="button" :disabled="walletLoading" @click="openRecharge">
                  充值
                </button>
              </div>

              <div class="row g-3 mt-2">
                <div class="col-6">
                  <div class="text-muted small">余额</div>
                  <div class="fs-4 fw-semibold">{{ formatMoney(wallet.balance) }}</div>
                </div>
                <div class="col-6">
                  <div class="text-muted small">冻结</div>
                  <div class="fs-4 fw-semibold">{{ formatMoney(wallet.frozen) }}</div>
                </div>
              </div>

              <div class="d-flex gap-2 mt-4">
                <RouterLink class="btn btn-outline-primary flex-fill" to="/me/wallet">查看钱包</RouterLink>
                <button
                  v-if="showRoleSwitchButton"
                  class="btn btn-outline-secondary flex-fill"
                  type="button"
                  :disabled="busySwitchRole"
                  @click="onSwitchRole"
                >
                  <span v-if="busySwitchRole" class="spinner-border spinner-border-sm me-2" aria-hidden="true" />
                  {{ roleSwitchButtonLabel }}
                </button>
              </div>

              <div v-if="auth.role === 'admin'" class="alert alert-warning mt-3 mb-0" role="alert">
                管理员账号不支持在此页面切换身份。
              </div>
            </div>
          </div>

          <div class="card border-0 shadow-sm">
            <div class="card-body">
              <div class="d-flex align-items-start justify-content-between">
                <div>
                  <div class="fw-semibold">申请/跑腿员状态</div>
                  <div class="text-muted small mt-1">申请入驻审核与身份切换</div>
                </div>
                <button
                  v-if="auth.role === 'user'"
                  class="btn btn-outline-primary btn-sm"
                  type="button"
                  :disabled="runnerAuthLoading"
                  @click="fetchRunnerAuthStatus"
                >
                  <span v-if="runnerAuthLoading" class="spinner-border spinner-border-sm me-2" aria-hidden="true" />
                  刷新
                </button>
              </div>

              <div class="mt-3">
                <div class="text-muted small">当前状态</div>
                <div class="d-flex align-items-center gap-2 mt-1">
                  <span :class="runnerStatusBadgeClass">{{ runnerStatusLabel }}</span>
                </div>
              </div>

              <div v-if="auth.role === 'user'" class="d-flex gap-2 mt-4">
                <button
                  v-if="showApplyButton"
                  :class="applyButtonClass"
                  type="button"
                  :disabled="applyButtonDisabled"
                  @click="onGoApplyRunner"
                >
                  {{ applyButtonText }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="rechargeModal" class="modal fade show" tabindex="-1" style="display: block" role="dialog" aria-modal="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">充值</h5>
            <button class="btn-close" type="button" aria-label="Close" :disabled="rechargeSubmitting" @click="closeRecharge" />
          </div>
          <div class="modal-body">
            <div class="mb-2 text-muted small">当前余额：{{ formatMoney(wallet.balance) }}</div>
            <label class="form-label">充值金额</label>
            <input
              v-model="rechargeAmountInput"
              class="form-control"
              inputmode="decimal"
              placeholder="请输入金额"
              :disabled="rechargeSubmitting"
              @keyup.enter="submitRecharge"
            />
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline-secondary" type="button" :disabled="rechargeSubmitting" @click="closeRecharge">
              取消
            </button>
            <button class="btn btn-primary" type="button" :disabled="rechargeSubmitting" @click="submitRecharge">
              <span v-if="rechargeSubmitting" class="spinner-border spinner-border-sm me-2" aria-hidden="true" />
              确认充值
            </button>
          </div>
        </div>
      </div>
    </div>
    <div v-if="rechargeModal" class="modal-backdrop fade show" @click="closeRecharge" />
  </div>
</template>
