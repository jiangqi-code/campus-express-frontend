<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

import { uploadTaskImage } from '@/api/task'
import { http } from '@/api/request'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

const form = reactive({
  studentId: '',
  phone: '',
  realName: '',
  idCardNo: '',
  dormBuilding: '',
  applyReason: '',
  cardImageUrl: '',
})

const uploading = ref(false)
const submitting = ref(false)
const checking = ref(false)
const loadingMe = ref(false)

const fileInputRef = ref<HTMLInputElement | null>(null)
const localPreviewUrl = ref('')

let lastObjectUrl: string | null = null

function getErrorMessage(err: any) {
  return (
    err?.response?.data?.message ||
    err?.response?.data?.msg ||
    err?.response?.data?.error ||
    err?.message ||
    '操作失败'
  )
}

function openPicker() {
  if (uploading.value || submitting.value) return
  fileInputRef.value?.click()
}

function clearPreview() {
  if (lastObjectUrl) URL.revokeObjectURL(lastObjectUrl)
  lastObjectUrl = null
  localPreviewUrl.value = ''
}

function normalizeText(raw: unknown) {
  return String(raw ?? '').trim()
}

function isValidPhone(phone: string) {
  const p = phone.trim()
  return /^1\d{10}$/.test(p) || /^\d{11}$/.test(p)
}

function isValidIdCard(id: string) {
  const v = id.trim()
  return /^\d{15}$/.test(v) || /^\d{17}(\d|X|x)$/.test(v)
}

function normalizeRunnerAuthStatus(raw: unknown): 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED' {
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

async function fetchMeLite() {
  loadingMe.value = true
  try {
    let res: any
    try {
      res = await http.get('/user/me')
    } catch {
      res = await http.get('/auth/me')
    }
    const root = res?.data?.data ?? res?.data ?? {}
    const raw = (root?.user ?? res?.data?.user ?? root) as any
    const phone = normalizeText(raw.phone ?? raw.mobile ?? raw.tel)
    const studentId = normalizeText(raw.student_id ?? raw.studentId ?? raw.sid ?? raw.account)

    if (!form.studentId) form.studentId = studentId
    if (!form.phone) form.phone = phone
  } finally {
    loadingMe.value = false
  }
}

async function fetchRunnerAuthStatus() {
  try {
    const res = await http.get('/user/auth-status')
    const data = res?.data?.data ?? res?.data ?? {}
    const hasApplied = Boolean(data?.hasApplied ?? data?.has_applied ?? data?.applied)
    const authStatus = normalizeRunnerAuthStatus(data?.authStatus ?? data?.auth_status ?? data?.status)
    const runnerApproved = Boolean(data?.runnerApproved ?? data?.runner_approved ?? data?.approved ?? authStatus === 'APPROVED')
    const state = {
      hasApplied: hasApplied || authStatus !== 'NONE',
      authStatus,
      runnerApproved: runnerApproved || authStatus === 'APPROVED',
      updatedAt: Date.now(),
    } as const
    auth.setRunnerAuthState(state)
    return state
  } catch {
    const res = await http.get('/user/auth')
    const record = pickRunnerAuthRecord(res?.data)
    if (!record) {
      const state = { hasApplied: false, authStatus: 'NONE', runnerApproved: false, updatedAt: Date.now() } as const
      auth.setRunnerAuthState(state)
      return state
    }
    const authStatus = normalizeRunnerAuthStatus(
      record?.authStatus ??
        record?.auth_status ??
        record?.status ??
        record?.auditStatus ??
        record?.audit_status ??
        record?.state ??
        record?.resultStatus ??
        record?.result_status,
    )
    const state = { hasApplied: true, authStatus, runnerApproved: authStatus === 'APPROVED', updatedAt: Date.now() } as const
    auth.setRunnerAuthState(state)
    return state
  }
}

const runnerAuthStatus = computed(() => auth.runnerAuth.authStatus)
const hasApplied = computed(() => auth.runnerAuth.hasApplied || runnerAuthStatus.value !== 'NONE')

const statusBadgeClass = computed(() => {
  const s = runnerAuthStatus.value
  if (s === 'APPROVED') return 'badge text-bg-success'
  if (s === 'REJECTED') return 'badge text-bg-danger'
  if (s === 'PENDING') return 'badge text-bg-warning'
  return 'badge text-bg-secondary'
})

const statusLabel = computed(() => {
  const s = runnerAuthStatus.value
  if (s === 'APPROVED') return '已通过'
  if (s === 'REJECTED') return '已拒绝'
  if (s === 'PENDING') return '审核中'
  return '未申请'
})

const statusProgressText = computed(() => {
  const s = runnerAuthStatus.value
  if (s === 'APPROVED') return '已通过'
  if (s === 'REJECTED') return '已拒绝'
  if (s === 'PENDING') return '待审核 / 审核中'
  return '未提交'
})

const statusDesc = computed(() => {
  const s = runnerAuthStatus.value
  if (s === 'APPROVED') return '你的入驻申请已通过，请前往个人资料切换为跑腿员。'
  if (s === 'REJECTED') return '你的入驻申请未通过，可修改信息后重新提交。'
  if (s === 'PENDING') return '你的入驻申请已提交，正在审核中。'
  return '请填写真实信息，提交后将进入审核流程。'
})

const formLockedByStatus = computed(() => runnerAuthStatus.value === 'PENDING' || runnerAuthStatus.value === 'APPROVED')
const formDisabled = computed(() => checking.value || loadingMe.value || submitting.value || uploading.value || formLockedByStatus.value)
const showSubmitButton = computed(() => !formLockedByStatus.value)

async function onPickFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  if (!file.type.startsWith('image/')) {
    ElMessage.warning('请选择图片文件')
    if (input) input.value = ''
    return
  }

  clearPreview()
  lastObjectUrl = URL.createObjectURL(file)
  localPreviewUrl.value = lastObjectUrl

  uploading.value = true
  try {
    const url = await uploadTaskImage(file)
    form.cardImageUrl = url
    ElMessage.success('校园卡照片已上传')
  } catch (err: any) {
    form.cardImageUrl = ''
    ElMessage.error(getErrorMessage(err))
  } finally {
    uploading.value = false
    if (input) input.value = ''
  }
}

async function onSubmit() {
  if (checking.value || submitting.value || uploading.value) return
  if (formLockedByStatus.value) return

  const studentId = form.studentId.trim()
  const phone = form.phone.trim()
  const realName = form.realName.trim()

  const idCardNo = form.idCardNo.trim()
  const dormBuilding = form.dormBuilding.trim()
  const applyReason = form.applyReason.trim()

  if (!studentId) {
    ElMessage.warning('请输入学号')
    return
  }
  if (!phone) {
    ElMessage.warning('请输入手机号')
    return
  }
  if (!isValidPhone(phone)) {
    ElMessage.warning('请输入有效的手机号')
    return
  }
  if (!realName) {
    ElMessage.warning('请输入真实姓名')
    return
  }
  if (!idCardNo) {
    ElMessage.warning('请输入身份证号')
    return
  }
  if (!isValidIdCard(idCardNo)) {
    ElMessage.warning('请输入有效的身份证号')
    return
  }
  if (!dormBuilding) {
    ElMessage.warning('请输入宿舍楼栋')
    return
  }
  if (!applyReason) {
    ElMessage.warning('请填写申请理由')
    return
  }
  if (!form.cardImageUrl) {
    ElMessage.warning('请先上传校园卡照片')
    return
  }

  submitting.value = true
  try {
    const payloadFull = {
      student_id: studentId,
      phone,
      real_name: realName,
      id_card: idCardNo,
      dormitory: dormBuilding,
      reason: applyReason,
      card_image_url: form.cardImageUrl,
    }
    console.log('runner_apply_submit_payload', payloadFull)
    try {
      await http.post('/user/auth', payloadFull)
    } catch (err: any) {
      try {
        const latest = await fetchRunnerAuthStatus()
        if (latest?.hasApplied && latest?.authStatus !== 'REJECTED') {
          ElMessage.success('申请已提交，请等待管理员审核')
          return
        }
      } catch {
        // ignore
      }
      await http.post('/user/auth', {
        student_id: studentId,
        phone,
        real_name: realName,
        id_card: idCardNo,
        dormitory: dormBuilding,
        reason: applyReason,
        card_image_url: form.cardImageUrl,
      })
    }
    auth.setRunnerAuthState({ hasApplied: true, authStatus: 'PENDING', runnerApproved: false, updatedAt: Date.now() })
    ElMessage.success('申请已提交，请等待管理员审核')
    await fetchRunnerAuthStatus()
  } catch (err: any) {
    ElMessage.error(getErrorMessage(err))
  } finally {
    submitting.value = false
  }
}

function goProfile() {
  router.push('/profile')
}

onMounted(async () => {
  if (auth.role === 'runner') {
    ElMessage.info('你已是跑腿员')
    await router.replace('/profile')
    return
  }

  checking.value = true
  try {
    await Promise.all([fetchMeLite(), fetchRunnerAuthStatus()])
  } catch {
    // TODO: 后端补齐 /api/user/auth-status 后移除本地状态兜底逻辑
  } finally {
    checking.value = false
  }
})

onBeforeUnmount(() => {
  clearPreview()
})
</script>

<template>
  <div class="vstack gap-3">
    <div class="d-flex flex-wrap align-items-end justify-content-between gap-2">
      <div>
        <h1 class="h4 mb-1">申请成为跑腿员</h1>
        <div class="text-muted">请提交真实信息，完成入驻审核流程</div>
      </div>
      <button class="btn btn-outline-secondary btn-sm" type="button" @click="goProfile">返回个人资料</button>
    </div>

    <div class="row justify-content-center">
      <div class="col-12 col-md-10 col-lg-8 col-xl-7">
        <div v-if="hasApplied" class="card border-0 shadow-sm mb-3">
          <div class="card-body">
            <div class="d-flex flex-wrap align-items-center justify-content-between gap-2">
              <div class="fw-semibold">申请状态</div>
              <span :class="statusBadgeClass">{{ statusLabel }}</span>
            </div>
            <div class="text-muted mt-2">{{ statusDesc }}</div>
            <div class="text-muted small mt-2">当前审核进度：{{ statusProgressText }}</div>
          </div>
        </div>

        <div class="card border-0 shadow-sm">
          <div class="card-body">
            <form class="vstack gap-3" @submit.prevent="onSubmit">
              <div class="row g-3">
                <div class="col-12 col-md-6">
                  <label class="form-label">学号 <span class="text-danger">*</span></label>
                  <input
                    v-model="form.studentId"
                    class="form-control"
                    placeholder="请输入学号（可自动填充/可修改）"
                    autocomplete="username"
                    :disabled="formDisabled"
                  />
                </div>
                <div class="col-12 col-md-6">
                  <label class="form-label">手机号 <span class="text-danger">*</span></label>
                  <input
                    v-model="form.phone"
                    class="form-control"
                    placeholder="请输入手机号（可自动填充/可修改）"
                    autocomplete="tel"
                    :disabled="formDisabled"
                  />
                </div>
              </div>

              <div>
                <label class="form-label">真实姓名 <span class="text-danger">*</span></label>
                <input
                  v-model="form.realName"
                  class="form-control"
                  placeholder="请输入真实姓名"
                  autocomplete="name"
                  :disabled="formDisabled"
                />
              </div>

              <div>
                <label class="form-label">身份证号 <span class="text-danger">*</span></label>
                <input
                  v-model="form.idCardNo"
                  class="form-control"
                  placeholder="请输入身份证号（仅用于入驻审核）"
                  maxlength="18"
                  :disabled="formDisabled"
                />
              </div>

              <div>
                <label class="form-label">宿舍楼栋 <span class="text-danger">*</span></label>
                <input
                  v-model="form.dormBuilding"
                  class="form-control"
                  placeholder="如：第12栋 / 12栋A区"
                  :disabled="formDisabled"
                />
              </div>

              <div>
                <label class="form-label">校园卡照片 <span class="text-danger">*</span></label>
                <div class="d-flex flex-wrap align-items-center gap-2">
                  <input
                    ref="fileInputRef"
                    class="d-none"
                    type="file"
                    accept="image/*"
                    :disabled="formDisabled"
                    @change="onPickFile"
                  />
                  <button class="btn btn-outline-primary" type="button" :disabled="formDisabled" @click="openPicker">
                    <span v-if="uploading" class="spinner-border spinner-border-sm me-2" aria-hidden="true" />
                    上传图片
                  </button>
                  <span v-if="form.cardImageUrl" class="text-muted small">已上传</span>
                  <span v-else class="text-muted small">请选择清晰的校园卡正面照片</span>
                </div>

                <div v-if="localPreviewUrl || form.cardImageUrl" class="mt-3">
                  <a
                    class="d-inline-block"
                    :href="form.cardImageUrl || localPreviewUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <img
                      class="img-thumbnail"
                      :src="localPreviewUrl || form.cardImageUrl"
                      alt="campus card"
                      style="max-width: 320px; width: 100%; height: auto; object-fit: cover"
                    />
                  </a>
                </div>
              </div>

              <div>
                <label class="form-label">我的优势 / 申请理由 <span class="text-danger">*</span></label>
                <textarea
                  v-model="form.applyReason"
                  class="form-control"
                  placeholder="请简要说明：空闲时间、熟悉路线、服务经验等"
                  rows="4"
                  maxlength="200"
                  :disabled="formDisabled"
                />
              </div>

              <div class="d-flex justify-content-end gap-2 pt-2">
                <button v-if="showSubmitButton" class="btn btn-primary" type="submit" :disabled="formDisabled">
                  <span v-if="submitting" class="spinner-border spinner-border-sm me-2" aria-hidden="true" />
                  提交申请
                </button>
                <button v-else class="btn btn-secondary" type="button" disabled>
                  {{ statusLabel }}
                </button>
              </div>

              <div class="text-muted small">信息提交后将在 1-3 个工作日内审核</div>
            </form>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
