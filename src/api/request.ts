import axios from 'axios'
import { useAuthStore } from '@/stores/auth'

export const baseURL = 'http://localhost:3000/api'

export const http = axios.create({
  baseURL,
  timeout: 15000,
})

function readToken() {
  const local = String(localStorage.getItem('ce_token') || '').trim()
  if (local) return local
  try {
    const auth = useAuthStore()
    return String(auth.token || '').trim()
  } catch {
    return ''
  }
}

function toBearer(token: string) {
  const t = String(token || '').trim()
  if (!t) return ''
  if (/^bearer\s+/i.test(t)) return t
  return `Bearer ${t}`
}

http.interceptors.request.use((config) => {
  const url = String(config.url || '')
  const skipAuth =
    /\/auth\/(login|register)\b/.test(url) || /\/health\b/.test(url) || /\/public\//.test(url)
  if (skipAuth) return config

  const bearer = toBearer(readToken())
  if (bearer) {
    if (!config.headers) config.headers = {} as any
    ;(config.headers as Record<string, string>).Authorization = bearer
  }
  return config
})

export async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}
