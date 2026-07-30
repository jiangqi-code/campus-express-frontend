<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { applyUnfreezeApi, loginApi } from '@/api/auth'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const form = reactive({
  account: '',
  password: '',
})

const submitting = ref(false)
const showPassword = ref(false)
const errors = reactive({ account: '', password: '' })
const PHONE_RE = /^1[3-9]\d{9}$/
const STUDENT_ID_RE = /^[A-Za-z0-9]{6,20}$/

function validateField(field: 'account' | 'password') {
  if (field === 'account') {
    const value = form.account.trim()
    errors.account = !value
      ? '请输入手机号或学号'
      : PHONE_RE.test(value) || STUDENT_ID_RE.test(value)
        ? ''
        : '请输入11位手机号或6-20位字母/数字学号'
  } else {
    errors.password = form.password ? '' : '请输入密码'
  }
  return !errors[field]
}

function toAppRole(role: string): 'admin' | 'runner' | 'user' {
  const normalized = role.trim().toUpperCase()
  if (normalized === 'ADMIN') return 'admin'
  if (normalized === 'RUNNER') return 'runner'
  return 'user'
}

function getErrorMessage(err: any) {
  return (
    err?.response?.data?.message ||
    err?.response?.data?.msg ||
    err?.response?.data?.error ||
    err?.message ||
    '登录失败'
  )
}

function isFrozenUser(user: any): boolean {
  const directBool = user?.frozen ?? user?.isFrozen ?? user?.is_frozen ?? user?.freeze ?? user?.is_freeze
  if (typeof directBool === 'boolean') return directBool
  if (typeof directBool === 'number') return directBool === 1
  if (typeof directBool === 'string') {
    const s = directBool.trim().toLowerCase()
    if (s === 'true' || s === '1' || s === 'yes') return true
    if (s === 'false' || s === '0' || s === 'no') return false
  }

  const statusRaw = user?.status ?? user?.user_status ?? user?.state ?? user?.account_status
  if (typeof statusRaw === 'number' && Number.isFinite(statusRaw)) return statusRaw === 0
  const s = String(statusRaw ?? '').trim().toLowerCase()
  if (!s) return false
  if (s === '0') return true
  if (s === 'frozen' || s === 'freeze' || s === 'disabled' || s.includes('冻结')) return true
  return false
}

async function handleLogin() {
  const account = form.account.trim()
  if (submitting.value) return


  const password = form.password
  if (!validateField('account') || !validateField('password')) return

  submitting.value = true

  try {
    const data = await loginApi({ account, password })

    const token = data.token
    const user = data.user

    if (!token || !user?.role) {
      throw new Error('登录信息不完整')
    }

    const appRole = toAppRole(String(user.role))
    const frozen = isFrozenUser(user)
    const statusValue = frozen ? 0 : (user?.status ?? user?.user_status ?? user?.state ?? 1)

    auth.setSession({
      token,
      role: appRole,
      displayName: user.nickname || '同学',
      userId: String(user?.id ?? user?.user_id ?? user?.uid ?? user?.account ?? '').trim(),
      status: statusValue,
    })

    if (frozen) {
      try {
        await ElMessageBox.confirm(
          '你的账号已被冻结：可以正常登录，但发布任务、抢单、聊天发送等功能已被限制。',
          '账号冻结',
          {
            confirmButtonText: '申请解封',
            cancelButtonText: '继续进入',
            type: 'warning',
            closeOnClickModal: false,
            distinguishCancelAndClose: true,
          },
        )

        try {
          const { value } = await ElMessageBox.prompt('请输入解封申请原因（可选）', '申请解封', {
            confirmButtonText: '提交',
            cancelButtonText: '取消',
            inputType: 'textarea',
            inputPlaceholder: '例如：误封，已完成整改',
            inputValue: '',
            closeOnClickModal: false,
            distinguishCancelAndClose: true,
          })
          await applyUnfreezeApi({ reason: String(value ?? '').trim() || undefined })
          ElMessage.success('解封申请已提交，请等待管理员处理')
        } catch (err: any) {
          if (err === 'cancel' || err === 'close') {
            ElMessage.info('已取消提交解封申请')
          } else {
            ElMessage.error(err?.response?.data?.message || err?.response?.data?.msg || err?.message || '提交解封申请失败')
          }
        }
      } catch (err: any) {
        if (err === 'cancel' || err === 'close') {
        } else {
          ElMessage.error(getErrorMessage(err))
        }
      }
    }

    const redirect = route.query.redirect
    const rolePath =
      appRole === 'admin' ? '/admin/users' : appRole === 'runner' ? '/runner/earnings' : '/tasks'
    await router.replace(typeof redirect === 'string' ? redirect : rolePath)
  } catch (err) {
    ElMessage.error(getErrorMessage(err))
  } finally {
    submitting.value = false
  }
}

</script>

<template>
  <div class="auth-form">
    <h1 class="h4 mb-1">登录</h1>
    <p class="text-muted mb-4">使用账号进入校园跑腿系统</p>

    <form class="vstack gap-3" @submit.prevent="handleLogin">
      <div>
        <label class="form-label">账号</label>
        <input
          v-model="form.account"
          class="form-control"
          placeholder="手机号 / 学号"
          autocomplete="username"
          :class="{ 'is-invalid': errors.account }"
          @blur="validateField('account')"
          @input="errors.account = ''"
        />
        <div v-if="errors.account" class="invalid-feedback">{{ errors.account }}</div>
      </div>
      <div>
        <label class="form-label">密码</label>
        <div class="input-group has-validation">
          <input
            v-model="form.password"
            class="form-control"
            :class="{ 'is-invalid': errors.password }"
            placeholder="请输入密码"
            :type="showPassword ? 'text' : 'password'"
            autocomplete="current-password"
            @blur="validateField('password')"
            @input="errors.password = ''"
          />
          <button class="btn btn-outline-secondary password-toggle" type="button" @click="showPassword = !showPassword">
            {{ showPassword ? '隐藏' : '显示' }}
          </button>
          <div v-if="errors.password" class="invalid-feedback">{{ errors.password }}</div>
        </div>
      </div>

      <button
        class="btn btn-primary w-100"
        type="submit"
        :disabled="submitting"
      >
        <span v-if="submitting" class="spinner-border spinner-border-sm me-2" aria-hidden="true" />
        登录
      </button>

      <div class="d-flex justify-content-between align-items-center">
        <RouterLink class="link-primary" to="/register">去注册</RouterLink>
        <span class="text-muted small">安全登录校园跑腿</span>
      </div>
    </form>
  </div>
</template>

<style scoped>
.auth-form { width: 100%; }
.password-toggle { min-width: 68px; }
@media (max-width: 575.98px) {
  .auth-form h1 { font-size: 1.5rem; }
  .auth-form .btn-primary { min-height: 46px; }
}
</style>
