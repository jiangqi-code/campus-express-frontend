import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { http } from '@/api/request'

export type Role = 'user' | 'runner' | 'admin'

export type RunnerAuthStatus = 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED'

export type RunnerAuthState = {
  hasApplied: boolean
  authStatus: RunnerAuthStatus
  runnerApproved: boolean
  updatedAt: number
}

type LoginInput = {
  account: string
  password: string
  role: Role
}

const TOKEN_KEY = 'ce_token'
const ROLE_KEY = 'ce_role'
const NAME_KEY = 'ce_display_name'
const USER_ID_KEY = 'ce_user_id'
const USER_STATUS_KEY = 'ce_user_status'
const RUNNER_AUTH_KEY = 'ce_runner_auth_state'

function normalizeUserStatus(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  const s = String(raw ?? '').trim()
  if (!s) return 1
  const n = Number(s)
  if (Number.isFinite(n)) return n
  const lower = s.toLowerCase()
  if (lower === 'frozen' || lower === 'freeze' || lower === 'disabled' || lower.includes('冻结')) return 0
  if (lower === 'active' || lower === 'enabled' || lower.includes('正常')) return 1
  return 1
}

function normalizeRunnerAuthStatus(raw: unknown): RunnerAuthStatus {
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

function normalizeRole(raw: unknown): Role {
  const s = String(raw ?? 'user')
    .trim()
    .toLowerCase()
  if (s === 'admin') return 'admin'
  if (s === 'runner') return 'runner'
  return 'user'
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem(TOKEN_KEY) || '')
  const role = ref<Role>(normalizeRole(localStorage.getItem(ROLE_KEY)))
  const displayName = ref(localStorage.getItem(NAME_KEY) || '同学')
  const userId = ref(localStorage.getItem(USER_ID_KEY) || '')
  const userStatus = ref<number>(normalizeUserStatus(localStorage.getItem(USER_STATUS_KEY)))
  const runnerAuth = ref<RunnerAuthState>((() => {
    try {
      const raw = localStorage.getItem(RUNNER_AUTH_KEY)
      if (!raw) return { hasApplied: false, authStatus: 'NONE', runnerApproved: false, updatedAt: 0 }
      const parsed = JSON.parse(raw)
      const hasApplied = Boolean(parsed?.hasApplied ?? parsed?.has_applied ?? parsed?.applied)
      const authStatus = normalizeRunnerAuthStatus(parsed?.authStatus ?? parsed?.auth_status ?? parsed?.status)
      const runnerApproved = Boolean(parsed?.runnerApproved ?? parsed?.runner_approved ?? authStatus === 'APPROVED')
      const updatedAt = Number(parsed?.updatedAt ?? parsed?.updated_at ?? 0)
      return { hasApplied, authStatus, runnerApproved, updatedAt: Number.isFinite(updatedAt) ? updatedAt : 0 }
    } catch {
      return { hasApplied: false, authStatus: 'NONE', runnerApproved: false, updatedAt: 0 }
    }
  })())

  const isAuthenticated = computed(() => token.value.length > 0)
  const isFrozen = computed(() => normalizeUserStatus(userStatus.value) === 0)

  function setSession(next: { token: string; role: Role; displayName: string; userId?: string; status?: number | string }): void
  function setSession(token: string, role: Role, displayName: string, userId?: string, status?: number | string): void
  function setSession(
    arg1: string | { token: string; role: Role; displayName?: string; nickname?: string; userId?: string; status?: number | string },
    arg2?: Role,
    arg3?: string,
    arg4?: string,
    arg5?: number | string,
  ) {
    const nextToken = typeof arg1 === 'string' ? arg1 : arg1.token
    const nextRole: Role = normalizeRole(typeof arg1 === 'string' ? (arg2 ?? 'user') : arg1.role)
    const nextName =
      typeof arg1 === 'string' ? (arg3 ?? '同学') : arg1.displayName ?? arg1.nickname ?? '同学'
    const nextUserId = typeof arg1 === 'string' ? (arg4 ?? '') : arg1.userId ?? ''
    const nextStatusRaw = typeof arg1 === 'string' ? arg5 : arg1.status

    token.value = nextToken
    role.value = nextRole
    displayName.value = nextName
    userId.value = nextUserId
    if (nextStatusRaw !== undefined) userStatus.value = normalizeUserStatus(nextStatusRaw)
    localStorage.setItem(TOKEN_KEY, nextToken)
    localStorage.setItem(ROLE_KEY, nextRole)
    localStorage.setItem(NAME_KEY, nextName)
    localStorage.setItem(USER_ID_KEY, nextUserId)
    if (nextStatusRaw !== undefined) localStorage.setItem(USER_STATUS_KEY, String(normalizeUserStatus(nextStatusRaw)))
  }

  function setRunnerAuthState(next: Partial<RunnerAuthState>) {
    const merged: RunnerAuthState = {
      hasApplied: next.hasApplied ?? runnerAuth.value.hasApplied,
      authStatus: next.authStatus ?? runnerAuth.value.authStatus,
      runnerApproved: next.runnerApproved ?? runnerAuth.value.runnerApproved,
      updatedAt: next.updatedAt ?? Date.now(),
    }
    runnerAuth.value = merged
    localStorage.setItem(RUNNER_AUTH_KEY, JSON.stringify(merged))
  }

  async function fetchUserInfo() {
    try {
      const res = await http.get('/auth/me')
      // 后端返回的是 { user: {...} }
      const data = res.data.user || res.data

      const userIdStr = String(data.id ?? '')
      const userName = data.nickname || '同学'
      const userRole = normalizeRole(data.role)
      const userStatusValue = data.status ?? 1

      setSession({
        token: token.value,
        role: userRole,
        displayName: userName,
        userId: userIdStr,
        status: userStatusValue
      })
    } catch (err) {
      console.error('获取用户信息失败', err)
    }
  }

  async function login(input: LoginInput) {
    try {
      const res = await http.post('/auth/login', {
        account: input.account,
        password: input.password
      })

      const { token: loginToken, role: userRole, status: userStatusValue } = res.data

      setSession({
        token: loginToken,
        role: normalizeRole(userRole),
        displayName: input.account.split('@')[0] || '同学',
        userId: res.data.userId || '',
        status: userStatusValue ?? 1
      })

      await fetchUserInfo()

      return res.data
    } catch (err) {
      throw err
    }
  }

  async function applyUnfreeze(reason: string, contact?: string) {
    const res = await http.post('/user/apply-unfreeze', { reason, contact })
    return res.data
  }

  function logout() {
    token.value = ''
    role.value = 'user'
    displayName.value = '同学'
    userId.value = ''
    userStatus.value = 1
    runnerAuth.value = { hasApplied: false, authStatus: 'NONE', runnerApproved: false, updatedAt: 0 }
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(ROLE_KEY)
    localStorage.removeItem(NAME_KEY)
    localStorage.removeItem(USER_ID_KEY)
    localStorage.removeItem(USER_STATUS_KEY)
    localStorage.removeItem(RUNNER_AUTH_KEY)
  }

  return {
    token,
    role,
    displayName,
    userId,
    userStatus,
    isFrozen,
    runnerAuth,
    isAuthenticated,
    login,
    logout,
    setSession,
    setRunnerAuthState,
    fetchUserInfo,
    applyUnfreeze,
  }
})
