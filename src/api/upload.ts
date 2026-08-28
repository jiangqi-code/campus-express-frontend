import { baseURL, http } from './request'

function unwrap(data: any) {
  return data?.data ?? data ?? {}
}

export function imageUrl(value: unknown): string {
  const path = String(value ?? '').trim()
  if (!path || /^(?:https?:|data:|blob:)/i.test(path)) return path
  const origin = new URL(baseURL).origin
  return path.startsWith('/') ? `${origin}${path}` : `${origin}/${path}`
}

export async function uploadImage(file: File): Promise<string> {
  const form = new FormData()
  form.append('image', file)
  const response = await http.post('/upload/image', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  const data = unwrap(response.data)
  const url = data?.url ?? data?.path ?? data?.urls?.[0] ?? data?.files?.[0] ?? data?.images?.[0]
  if (typeof url !== 'string' || !url.trim()) throw new Error('图片上传后未返回可用地址')
  return url.trim()
}
