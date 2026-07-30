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
    /\/auth\/(login|register|send-code|verify-code)\b/.test(url) || /\/health\b/.test(url) || /\/public\//.test(url)
  if (skipAuth) return config

  const bearer = toBearer(readToken())
  if (bearer) {
    if (!config.headers) config.headers = {} as any
    ;(config.headers as Record<string, string>).Authorization = bearer
  }
  return config
})

let redirectingToLogin = false

http.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401 && !redirectingToLogin) {
      const pathname = window.location.pathname
      if (pathname !== '/login' && pathname !== '/register') {
        redirectingToLogin = true
        ;['ce_token', 'ce_role', 'ce_display_name', 'ce_user_id', 'ce_user_status'].forEach((key) =>
          localStorage.removeItem(key),
        )
        const redirect = `${pathname}${window.location.search}${window.location.hash}`
        window.location.replace(`/login?redirect=${encodeURIComponent(redirect)}`)
      }
    }
    return Promise.reject(error)
  },
)

export async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}
