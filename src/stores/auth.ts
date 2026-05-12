import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

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
const RUNNER_AUTH_KEY = 'ce_runner_auth_state'

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

function newToken() {
  const cryptoAny = crypto as unknown as { randomUUID?: () => string }
  return cryptoAny.randomUUID ? cryptoAny.randomUUID() : `t_${Math.random().toString(16).slice(2)}`
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem(TOKEN_KEY) || '')
  const role = ref<Role>(normalizeRole(localStorage.getItem(ROLE_KEY)))
  const displayName = ref(localStorage.getItem(NAME_KEY) || '同学')
  const userId = ref(localStorage.getItem(USER_ID_KEY) || '')
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

  function setSession(next: { token: string; role: Role; displayName: string; userId?: string }): void
  function setSession(token: string, role: Role, displayName: string, userId?: string): void
  function setSession(
    arg1: string | { token: string; role: Role; displayName?: string; nickname?: string; userId?: string },
    arg2?: Role,
    arg3?: string,
    arg4?: string,
  ) {
    const nextToken = typeof arg1 === 'string' ? arg1 : arg1.token
    const nextRole: Role = normalizeRole(typeof arg1 === 'string' ? (arg2 ?? 'user') : arg1.role)
    const nextName =
      typeof arg1 === 'string' ? (arg3 ?? '同学') : arg1.displayName ?? arg1.nickname ?? '同学'
    const nextUserId = typeof arg1 === 'string' ? (arg4 ?? '') : arg1.userId ?? ''

    token.value = nextToken
    role.value = nextRole
    displayName.value = nextName
    userId.value = nextUserId
    localStorage.setItem(TOKEN_KEY, nextToken)
    localStorage.setItem(ROLE_KEY, nextRole)
    localStorage.setItem(NAME_KEY, nextName)
    localStorage.setItem(USER_ID_KEY, nextUserId)
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

  async function login(input: LoginInput) {
    const name = input.account.trim().split('@')[0] || '同学'
    setSession({ token: newToken(), role: input.role, displayName: name })
  }

  function logout() {
    token.value = ''
    role.value = 'user'
    displayName.value = '同学'
    userId.value = ''
    runnerAuth.value = { hasApplied: false, authStatus: 'NONE', runnerApproved: false, updatedAt: 0 }
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(ROLE_KEY)
    localStorage.removeItem(NAME_KEY)
    localStorage.removeItem(USER_ID_KEY)
    localStorage.removeItem(RUNNER_AUTH_KEY)
  }

  return { token, role, displayName, userId, runnerAuth, isAuthenticated, login, logout, setSession, setRunnerAuthState }
})
