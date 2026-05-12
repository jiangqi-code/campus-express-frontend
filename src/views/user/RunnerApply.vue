<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { onBeforeUnmount, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

import { http } from '@/api/request'
import { uploadTaskImage } from '@/api/task'

const router = useRouter()

const form = reactive({
  realName: '',
  cardImageUrl: '',
})

const uploading = ref(false)
const submitting = ref(false)

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
  if (submitting.value || uploading.value) return

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
    ElMessage.success('申请已提交')
    await router.replace('/me/profile')
  } catch (err: any) {
    ElMessage.error(getErrorMessage(err))
  } finally {
    submitting.value = false
  }
}

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
            <label class="form-label">校园卡照片</label>
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
