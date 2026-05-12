<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

import { uploadTaskImage } from '@/api/task'
import { http } from '@/api/request'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

const form = reactive({
  realName: '',
  cardImageUrl: '',
})

const uploading = ref(false)
const submitting = ref(false)
const checking = ref(false)

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

  const realName = form.realName.trim()
  if (!realName) {
    ElMessage.warning('请输入真实姓名')
    return
  }
  if (!form.cardImageUrl) {
    ElMessage.warning('请先上传校园卡照片')
    return
  }

  submitting.value = true
  try {
    await http.post('/user/auth', {
      real_name: realName,
      card_image_url: form.cardImageUrl,
    })
    auth.setRunnerAuthState({ hasApplied: true, authStatus: 'PENDING', runnerApproved: false, updatedAt: Date.now() })
    ElMessage.success('申请已提交，请等待管理员审核')
    await router.replace('/profile')
  } catch (err: any) {
    ElMessage.error(getErrorMessage(err))
  } finally {
    submitting.value = false
  }
}

onMounted(async () => {
  if (auth.role === 'runner') {
    ElMessage.info('你已是跑腿员')
    await router.replace('/profile')
    return
  }

  checking.value = true
  try {
    const state = await fetchRunnerAuthStatus()
    if (state.hasApplied && state.authStatus !== 'REJECTED') {
      ElMessage.info('您已提交过申请，请等待审核')
      await router.replace('/profile')
    }
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
    <div>
      <h1 class="h4 mb-1">申请成为跑腿员</h1>
      <div class="text-muted">提交真实信息后，等待管理员审核</div>
    </div>

    <div class="card border-0 shadow-sm">
      <div class="card-body">
        <form class="vstack gap-3" @submit.prevent="onSubmit">
          <div>
            <label class="form-label">真实姓名 <span class="text-danger">*</span></label>
            <input v-model="form.realName" class="form-control" placeholder="请输入真实姓名" autocomplete="name" />
          </div>

          <div>
            <label class="form-label">校园卡照片 <span class="text-danger">*</span></label>
            <div class="d-flex flex-wrap align-items-center gap-2">
              <input
                ref="fileInputRef"
                class="d-none"
                type="file"
                accept="image/*"
                :disabled="uploading || submitting"
                @change="onPickFile"
              />
              <button class="btn btn-outline-primary" type="button" :disabled="uploading || submitting" @click="openPicker">
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

          <div class="d-flex justify-content-end gap-2 pt-2">
            <button class="btn btn-primary" type="submit" :disabled="submitting || uploading">
              <span v-if="submitting" class="spinner-border spinner-border-sm me-2" aria-hidden="true" />
              提交申请
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
