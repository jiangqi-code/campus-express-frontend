import { http } from './request'

export type LoginPayload = {
  account: string
  password: string
}

export async function loginApi(payload: LoginPayload) {
  const response = await http.post('/auth/login', payload)
  return response.data
}

export type RegisterPayload = {
  student_id: string
  phone: string
  password: string
  nickname: string
}

export async function registerApi(payload: RegisterPayload) {
  const response = await http.post('/auth/register', payload)
  return response.data
}

export type ApplyUnfreezePayload = {
  reason?: string
  contact?: string
}

export async function applyUnfreezeApi(payload: ApplyUnfreezePayload) {
  const body: Record<string, any> = {
    reason: payload.reason,
    contact: payload.contact,
    remark: payload.reason,
    message: payload.reason,
  }
  Object.keys(body).forEach((k) => {
    if (body[k] === undefined || body[k] === null || String(body[k]).trim() === '') delete body[k]
  })

  const endpoints = [
    { method: 'post' as const, url: '/user/apply-unfreeze' },
    { method: 'post' as const, url: '/user/unfreeze/apply' },
    { method: 'post' as const, url: '/user/unfreeze-apply' },
    { method: 'post' as const, url: '/user/unfreeze' },
    { method: 'post' as const, url: '/user/unfreeze-request' },
    { method: 'post' as const, url: '/user/unfreeze-requests' },
    { method: 'post' as const, url: '/user/appeal' },
    { method: 'post' as const, url: '/appeal' },
    { method: 'put' as const, url: '/user/unfreeze/apply' },
    { method: 'put' as const, url: '/user/unfreeze' },
  ]

  let lastErr: any
  for (const it of endpoints) {
    try {
      const res = it.method === 'put' ? await http.put(it.url, body) : await http.post(it.url, body)
      return res.data
    } catch (err: any) {
      const status = err?.response?.status
      if (status && status !== 404 && status !== 405) throw err
      lastErr = err
    }
  }
  throw lastErr || new Error('提交解封申请失败')
}
