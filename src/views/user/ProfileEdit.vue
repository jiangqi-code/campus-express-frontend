<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useRouter } from 'vue-router'
import { http } from '@/api/request'
import { useAuthStore } from '@/stores/auth'
import { parseIdCard } from '@/utils/idCard'

const PHONE_PATTERN = /^1[3-9]\d{9}$/
const auth = useAuthStore()
const router = useRouter()
const loading = ref(false), saving = ref(false), uploading = ref(false)
const avatarInput = ref<HTMLInputElement | null>(null), avatarPreview = ref('')
const form = reactive({ nickname: '', phone: '', studentId: '', avatar: '', birthDate:'', idCard:'' })
const originalBirthDate=ref('')
let previewObjectUrl = ''
const disableFutureDate = (date: Date) => date.getTime() > Date.now()
const phoneError = computed(() => form.phone.trim() && !PHONE_PATTERN.test(form.phone.trim()) ? '请输入11位中国大陆手机号' : '')
const errorText = (e: any) => e?.response?.data?.message || e?.response?.data?.msg || e?.message || '操作失败'

watch(() => form.idCard, (value) => {
  const parsed = parseIdCard(value)
  if (parsed.isValid) form.birthDate = parsed.birthDate
})

function normalizeIdCard() {
  form.idCard = form.idCard.trim().toUpperCase()
}

async function fetchProfile() {
  loading.value = true
  try {
    let response: any
    try { response = await http.get('/user/me') } catch { response = await http.get('/auth/me') }
    const root = response?.data?.data ?? response?.data ?? {}, raw = root?.user ?? root
    form.nickname = String(raw.nickname ?? raw.name ?? auth.displayName ?? '')
    form.phone = String(raw.phone ?? raw.mobile ?? '')
    form.studentId = String(raw.student_id ?? raw.studentId ?? '')
    form.avatar = String(raw.avatar ?? raw.avatar_url ?? '')
    form.birthDate=String(raw.birth_date??raw.birthDate??'').slice(0,10)
    form.idCard=String(raw.id_card??raw.idCard??'')
    originalBirthDate.value=form.birthDate
  } catch (e: any) { ElMessage.error(errorText(e)) } finally { loading.value = false }
}
function openAvatarPicker() { if (!uploading.value) avatarInput.value?.click() }
async function onAvatarSelected(event: Event) {
  const input = event.target as HTMLInputElement, file = input.files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) { ElMessage.warning('请选择图片文件'); input.value = ''; return }
  if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl)
  previewObjectUrl = URL.createObjectURL(file); avatarPreview.value = previewObjectUrl; uploading.value = true
  try {
    const data = new FormData(); data.append('file', file)
    await http.post('/user/avatar', data, { headers: { 'Content-Type': 'multipart/form-data' } })
    ElMessage.success('头像已更新'); await fetchProfile()
  } catch (e: any) { ElMessage.error(errorText(e)) } finally { uploading.value = false; input.value = '' }
}
async function saveProfile() {
  if (saving.value) return
  const nickname = form.nickname.trim(), phone = form.phone.trim()
  if (!nickname) { ElMessage.warning('昵称不能为空'); return }
  if (!PHONE_PATTERN.test(phone)) { ElMessage.warning('请输入正确的11位手机号'); return }
  const parsed=form.idCard?parseIdCard(form.idCard):null
  if(form.idCard&&!parsed?.isValid){ElMessage.warning('身份证号格式或校验位不正确');return}
  if(parsed?.isValid)form.birthDate=parsed.birthDate
  if(originalBirthDate.value&&form.birthDate!==originalBirthDate.value){try{await ElMessageBox.confirm('生日信息用于发放生日优惠券，确认修改吗？','确认修改生日',{type:'warning'})}catch{return}}
  saving.value = true
  try {
    await http.put('/user/profile', { nickname, phone, student_id: form.studentId.trim(), birth_date:form.birthDate||null, id_card:form.idCard.trim()||null })
    auth.setSession({ token: auth.token, role: auth.role, displayName: nickname, userId: auth.userId })
    ElMessage.success('个人资料已保存'); await router.replace('/profile')
  } catch (e: any) { ElMessage.error(errorText(e)) } finally { saving.value = false }
}
onMounted(fetchProfile)
onBeforeUnmount(() => { if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl) })
</script>

<template>
  <div class="profile-edit vstack gap-3" v-loading="loading">
    <div><h1 class="h4 mb-1">编辑个人资料</h1><div class="text-muted">更新头像和基础身份信息</div></div>
    <div class="card border-0 shadow-sm"><div class="card-body"><form class="vstack gap-3" @submit.prevent="saveProfile">
      <div><label class="form-label">头像</label><div class="d-flex align-items-center gap-3">
        <img v-if="avatarPreview || form.avatar" class="avatar-preview" :src="avatarPreview || form.avatar" alt="头像预览" /><div v-else class="avatar-preview avatar-placeholder">头像</div>
        <input ref="avatarInput" class="d-none" type="file" accept="image/*" @change="onAvatarSelected" /><button class="btn btn-outline-primary" type="button" :disabled="uploading" @click="openAvatarPicker">{{ uploading ? '上传中…' : '更换头像' }}</button>
      </div></div>
      <div><label class="form-label">昵称</label><input v-model="form.nickname" class="form-control" maxlength="30" placeholder="请输入昵称" /></div>
      <div><label class="form-label">手机号</label><input v-model.trim="form.phone" class="form-control" :class="{ 'is-invalid': phoneError }" maxlength="11" inputmode="numeric" placeholder="请输入11位手机号" /><div v-if="phoneError" class="invalid-feedback">{{ phoneError }}</div></div>
      <div><label class="form-label">学号</label><input v-model="form.studentId" class="form-control" maxlength="30" placeholder="请输入学号" /></div>
      <div class="identity-grid">
        <div><label class="form-label">出生日期</label><el-date-picker v-model="form.birthDate" type="date" value-format="YYYY-MM-DD" :disabled-date="disableFutureDate" placeholder="补充生日信息" style="width:100%"/></div>
        <div><label class="form-label">身份证号</label><el-input v-model="form.idCard" maxlength="18" placeholder="输入后自动解析生日" @blur="normalizeIdCard"/></div>
      </div>
      <div class="text-muted small">生日信息用于自动发放生日优惠券。</div>
      <div class="d-flex justify-content-end gap-2"><button class="btn btn-outline-secondary" type="button" @click="router.back()">取消</button><button class="btn btn-primary" type="submit" :disabled="saving || uploading">{{ saving ? '保存中…' : '保存资料' }}</button></div>
    </form></div></div>
  </div>
</template>
<style scoped>.identity-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.profile-edit{max-width:720px;margin:0 auto}.avatar-preview{width:72px;height:72px;border-radius:50%;object-fit:cover}.avatar-placeholder{display:grid;place-items:center;color:#fff;background:var(--bs-secondary)}@media(max-width:640px){.identity-grid{grid-template-columns:1fr}}</style>
