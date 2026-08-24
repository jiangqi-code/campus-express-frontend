<script setup lang="ts">
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { registerApi, sendCodeApi, verifyCodeApi } from '@/api/auth'
import { checkWelcomeCoupons, queueWelcomeCoupons, type UserCoupon } from '@/api/coupon'
import { useAuthStore } from '@/stores/auth'
import { parseIdCard } from '@/utils/idCard'

const router = useRouter()
const auth=useAuthStore()

const formRef = ref<FormInstance>()
const submitting = ref(false)
const codeSending = ref(false)
const countdown = ref(0)
const codeVerified = ref(false)
const verifiedPhone = ref('')
let countdownTimer: ReturnType<typeof setInterval> | undefined

const form = reactive({
  student_id: '',
  phone: '',
  password: '',
  nickname: '',
  verification_code: '',
  birthDate: '',
  idCard: '',
})

const PHONE_RE = /^1[3-9]\d{9}$/
const STUDENT_ID_RE = /^[A-Za-z0-9]{6,20}$/
const PASSWORD_RE = /^(?=.*[A-Za-z])(?=.*\d).{8,32}$/
const disableFutureDate = (date: Date) => date.getTime() > Date.now()

function requiredTrim(message: string) {
  return (_rule: any, value: any, callback: any) => {
    const v = String(value ?? '').trim()
    if (!v) {
      callback(new Error(message))
      return
    }
    callback()
  }
}

const rules: FormRules = {
  student_id: [
    { validator: requiredTrim('请输入学号'), trigger: 'blur' },
    { pattern: STUDENT_ID_RE, message: '学号需为6-20位字母或数字', trigger: ['blur', 'change'] },
  ],
  phone: [
    { validator: requiredTrim('请输入手机号'), trigger: 'blur' },
    { pattern: PHONE_RE, message: '请输入正确的11位手机号', trigger: ['blur', 'change'] },
  ],
  nickname: [{ validator: requiredTrim('请输入昵称'), trigger: 'blur' }],
  password: [
    { validator: requiredTrim('请输入密码'), trigger: 'blur' },
    {
      validator: (_rule, value, callback) => {
        const v = String(value ?? '').trim()
        if (!PASSWORD_RE.test(v)) {
          callback(new Error('密码需为8-32位，且包含字母和数字'))
          return
        }
        callback()
      },
      trigger: 'blur',
    },
  ],
  verification_code: [
    { required: true, message: '请输入验证码', trigger: 'blur' },
    { pattern: /^\d{6}$/, message: '验证码必须是6位数字', trigger: ['blur', 'change'] },
  ],
  idCard: [{validator:(_rule,value,callback)=>{if(value&&!parseIdCard(value).isValid)return callback(new Error('身份证号格式或校验位不正确'));callback()},trigger:['blur','change']}],
}

watch(
  () => form.phone,
  () => {
    if (form.phone.trim() !== verifiedPhone.value) codeVerified.value = false
  },
)
watch(()=>form.idCard,value=>{const parsed=parseIdCard(value);if(parsed.isValid)form.birthDate=parsed.birthDate})

function normalizeIdCard() {
  form.idCard = form.idCard.trim().toUpperCase()
}

onBeforeUnmount(() => {
  if (countdownTimer) clearInterval(countdownTimer)
})

function startCountdown(seconds = 60) {
  countdown.value = seconds
  if (countdownTimer) clearInterval(countdownTimer)
  countdownTimer = setInterval(() => {
    countdown.value -= 1
    if (countdown.value <= 0 && countdownTimer) {
      clearInterval(countdownTimer)
      countdownTimer = undefined
    }
  }, 1000)
}

async function sendCode() {
  if (codeSending.value || countdown.value > 0 || submitting.value) return
  const valid = await formRef.value?.validateField('phone').then(() => true).catch(() => false)
  if (!valid) return
  codeSending.value = true
  try {
    const result = await sendCodeApi(form.phone.trim())
    startCountdown(result.resendAfter || 60)
    codeVerified.value = false
    ElMessage.success(result.mockCode ? `模拟验证码：${result.mockCode}` : '验证码已发送')
  } catch (err) {
    ElMessage.error(getErrorMessage(err))
  } finally {
    codeSending.value = false
  }
}

function getErrorMessage(err: any) {
  return err?.response?.data?.message || err?.response?.data?.msg || err?.response?.data?.error || err?.message || '注册失败'
}

async function onSubmit() {
  if (submitting.value) return

  const ok = await formRef.value?.validate().catch(() => false)
  if (!ok) return

  submitting.value = true
  try {
    const verification = await verifyCodeApi(form.phone.trim(), form.verification_code.trim())
    if (!verification.verified) throw new Error('验证码校验失败')
    codeVerified.value = true
    verifiedPhone.value = form.phone.trim()
    const payload = {
      student_id: form.student_id.trim(),
      phone: form.phone.trim(),
      password: form.password.trim(),
      nickname: form.nickname.trim(),
      birth_date: form.birthDate || undefined,
      id_card: form.idCard.trim().toUpperCase() || undefined,
    }

    const result=await registerApi(payload)
    const user=result?.user??{}
    auth.setSession({token:String(result?.token||''),role:String(user.role||'USER').toLowerCase() as any,displayName:String(user.nickname||form.nickname),userId:String(user.id||'')})
    let coupons = Array.isArray(result?.welcomeCoupons) ? result.welcomeCoupons as UserCoupon[] : []
    try {
      const welcome = await checkWelcomeCoupons()
      coupons = Array.isArray(welcome?.coupons) ? welcome.coupons : coupons
    } catch {
      // 注册已完成，新人券检查失败不应让用户误以为注册失败。
    }
    queueWelcomeCoupons(coupons)

    ElMessage.success('注册成功')
    await router.replace('/tasks')
  } catch (err) {
    ElMessage.error(getErrorMessage(err))
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="auth-form">
    <h1 class="h4 mb-1">注册</h1>
    <p class="text-muted mb-4">填写信息创建账号</p>

    <el-form ref="formRef" :model="form" :rules="rules" label-position="top" @keyup.enter="onSubmit">
      <div class="vstack gap-3">
        <el-form-item label="学号" prop="student_id">
          <el-input v-model="form.student_id" placeholder="请输入学号" :disabled="submitting" autocomplete="username" />
        </el-form-item>

        <el-form-item label="手机号" prop="phone">
          <el-input v-model="form.phone" maxlength="11" placeholder="请输入11位手机号" :disabled="submitting" autocomplete="tel" />
        </el-form-item>

        <el-form-item label="手机验证码" prop="verification_code">
          <div class="code-row">
            <el-input
              v-model="form.verification_code"
              maxlength="6"
              inputmode="numeric"
              placeholder="6位数字验证码"
              :disabled="submitting"
            />
            <el-button :disabled="countdown > 0 || submitting" :loading="codeSending" @click="sendCode">
              {{ countdown > 0 ? `${countdown}s 后重试` : '获取验证码' }}
            </el-button>
          </div>
        </el-form-item>

        <el-form-item label="昵称" prop="nickname">
          <el-input v-model="form.nickname" placeholder="请输入昵称" :disabled="submitting" autocomplete="nickname" />
        </el-form-item>
        <div class="identity-grid">
          <el-form-item label="出生日期">
            <el-date-picker v-model="form.birthDate" type="date" value-format="YYYY-MM-DD" placeholder="请选择出生日期" :disabled-date="disableFutureDate" :disabled="submitting" style="width:100%"/>
          </el-form-item>
          <el-form-item label="身份证号（选填）" prop="idCard">
            <el-input v-model="form.idCard" maxlength="18" placeholder="输入后自动解析生日" :disabled="submitting" @blur="normalizeIdCard"/>
          </el-form-item>
        </div>

        <el-form-item label="密码" prop="password">
          <el-input
            v-model="form.password"
            placeholder="8-32位，包含字母和数字"
            :disabled="submitting"
            type="password"
            show-password
            autocomplete="new-password"
          />
        </el-form-item>

        <el-button type="primary" :loading="submitting" class="w-100" @click="onSubmit">注册</el-button>

        <div class="d-flex justify-content-between align-items-center">
          <RouterLink class="link-primary" to="/login">已有账号？去登录</RouterLink>
          <span class="text-muted small">注册即表示同意服务条款</span>
        </div>
      </div>
    </el-form>
  </div>
</template>

<style scoped>
.auth-form { width: 100%; }
.code-row { display: grid; width: 100%; grid-template-columns: minmax(0, 1fr) 120px; gap: 10px; }
.code-row .el-button { margin-left: 0; }
.identity-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
@media (max-width: 575.98px) {
  .auth-form h1 { font-size: 1.5rem; }
  .code-row { grid-template-columns: minmax(0, 1fr) 112px; gap: 8px; }
  .identity-grid{grid-template-columns:1fr}
  .auth-form :deep(.el-button--primary) { min-height: 46px; }
}
</style>
