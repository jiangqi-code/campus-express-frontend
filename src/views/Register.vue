<script setup lang="ts">
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

import { registerApi } from '@/api/auth'

const router = useRouter()

const formRef = ref<FormInstance>()
const submitting = ref(false)

const form = reactive({
  student_id: '',
  phone: '',
  password: '',
  nickname: '',
})

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
  student_id: [{ validator: requiredTrim('请输入学号'), trigger: 'blur' }],
  phone: [{ validator: requiredTrim('请输入手机号'), trigger: 'blur' }],
  nickname: [{ validator: requiredTrim('请输入昵称'), trigger: 'blur' }],
  password: [
    { validator: requiredTrim('请输入密码'), trigger: 'blur' },
    {
      validator: (_rule, value, callback) => {
        const v = String(value ?? '').trim()
        if (v.length < 6) {
          callback(new Error('密码至少 6 位'))
          return
        }
        callback()
      },
      trigger: 'blur',
    },
  ],
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
    const payload = {
      student_id: form.student_id.trim(),
      phone: form.phone.trim(),
      password: form.password.trim(),
      nickname: form.nickname.trim(),
    }

    await registerApi(payload)

    ElMessage.success('注册成功')
    await router.replace('/login')
  } catch (err) {
    ElMessage.error(getErrorMessage(err))
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div>
    <h1 class="h4 mb-1">注册</h1>
    <p class="text-muted mb-4">填写信息创建账号</p>

    <el-form ref="formRef" :model="form" :rules="rules" label-position="top" @keyup.enter="onSubmit">
      <div class="vstack gap-3">
        <el-form-item label="学号" prop="student_id">
          <el-input v-model="form.student_id" placeholder="请输入学号" :disabled="submitting" autocomplete="username" />
        </el-form-item>

        <el-form-item label="手机号" prop="phone">
          <el-input v-model="form.phone" placeholder="请输入手机号" :disabled="submitting" autocomplete="tel" />
        </el-form-item>

        <el-form-item label="昵称" prop="nickname">
          <el-input v-model="form.nickname" placeholder="请输入昵称" :disabled="submitting" autocomplete="nickname" />
        </el-form-item>

        <el-form-item label="密码" prop="password">
          <el-input
            v-model="form.password"
            placeholder="至少 6 位"
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
