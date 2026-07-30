<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'

import { applyUnfreezeApi } from '@/api/auth'
import { useAuthStore } from '@/stores/auth'
import { useMessageStore } from '@/stores/messages'

type Role = 'user' | 'runner' | 'admin'

type MenuItem = {
  label: string
  to: string
  roles?: Role[]
}

type MenuGroup = {
  label: string
  roles?: Role[]
  items: MenuItem[]
}

const auth = useAuthStore()
const messageStore = useMessageStore()
const route = useRoute()
const router = useRouter()

const applyingUnfreeze = ref(false)

const roleLabel = computed(() => {
  if (auth.role === 'admin') return '管理员'
  if (auth.role === 'runner') return '跑腿员'
  return '用户'
})

const frozen = computed(() => auth.isFrozen)

function isActive(prefix: string) {
  return route.path === prefix || route.path.startsWith(`${prefix}/`)
}

function canShow(roles?: Role[]) {
  if (!roles || roles.length === 0) return true
  const r = auth.role as Role
  return roles.includes(r)
}

const menuGroups = computed<MenuGroup[]>(() => {
  // 管理员专属菜单
  const adminOnly: MenuGroup[] = [
    {
      label: '管理后台',
      roles: ['admin'],
      items: [
        { label: '后台仪表盘', to: '/admin/dashboard', roles: ['admin'] },
        { label: '登录日志', to: '/admin/logs/login', roles: ['admin'] },
        { label: '错误日志', to: '/admin/logs/error', roles: ['admin'] },
        { label: '用户管理', to: '/admin/users', roles: ['admin'] },
        { label: '任务治理', to: '/admin/tasks', roles: ['admin'] },
        { label: '订单治理', to: '/admin/orders', roles: ['admin'] },
        { label: '提现审核', to: '/admin/withdrawals', roles: ['admin'] },
        { label: '退款审核', to: '/admin/refunds', roles: ['admin'] },
        { label: '解封审核', to: '/admin/unfreeze-applications', roles: ['admin'] },
        { label: '跑腿员入驻审核', to: '/admin/runner-auth', roles: ['admin'] },
        { label: '举报管理', to: '/admin/reports', roles: ['admin'] },
        { label: '投诉处理', to: '/admin/complaints', roles: ['admin'] },
        { label: '系统配置', to: '/admin/config', roles: ['admin'] },
        { label: '敏感词管理', to: '/admin/sensitive-words', roles: ['admin'] },
      ],
    },
  ]

  // 账户设置（所有角色都有）
  const accountGroup: MenuGroup[] = [
    {
      label: '账户',
      items: [{ label: '个人资料', to: '/profile' }],
    },
  ]

  const r = auth.role as Role
  
  // 管理员只显示管理后台和账户
  if (r === 'admin') {
    return [...adminOnly, ...accountGroup]
  }
  
  // 普通用户和跑腿员的共同菜单
  const common: MenuGroup[] = [
    {
      label: '任务与订单',
      items: [
        { label: '任务大厅', to: '/tasks' },
        { label: '我的订单', to: '/orders' },
        { label: `我的消息${messageStore.unreadCount ? ` (${messageStore.unreadCount > 99 ? '99+' : messageStore.unreadCount})` : ''}`, to: '/messages' },
      ],
    },
    {
      label: '我的评价',
      items: [
        { label: '我的评价', to: '/reviews' },
      ],
    },
    {
      label: '钱包',
      items: [
        { label: '钱包流水', to: '/wallet/logs' },
      ],
    },
    {
      label: '账户',
      items: [{ label: '个人资料', to: '/profile' }],
    },
  ]

  const userExtra: MenuGroup[] = [
    {
      label: '用户功能',
      roles: ['user'],
      items: [
        { label: '发布任务', to: '/task/publish', roles: ['user'] },
        { label: '申请成为跑腿员', to: '/runner/apply', roles: ['user'] },
      ],
    },
  ]

  const runnerExtra: MenuGroup[] = [
    {
      label: '跑腿员功能',
      roles: ['runner'],
      items: [
        { label: '我的信用', to: '/runner/earnings', roles: ['runner'] },
        { label: '提现记录', to: '/runner/withdrawals', roles: ['runner'] },
        { label: '跑腿员统计', to: '/runner/statistics', roles: ['runner'] },
      ],
    },
  ]

  if (r === 'user') return [...userExtra, ...common]
  if (r === 'runner') return [...runnerExtra, ...common]
  
  return []
})

function onLogout() {
  auth.logout()
  router.push('/login')
}

async function onApplyUnfreeze() {
  if (applyingUnfreeze.value) return
  applyingUnfreeze.value = true
  try {
    const { value } = await ElMessageBox.prompt('请输入解封申请原因（可选）', '申请解封', {
      confirmButtonText: '提交',
      cancelButtonText: '取消',
      inputType: 'textarea',
      inputPlaceholder: '例如：误封，已完成整改',
      inputValue: '',
      closeOnClickModal: false,
      distinguishCancelAndClose: true,
    })
    await applyUnfreezeApi({ reason: String(value ?? '').trim() || undefined })
    ElMessage.success('解封申请已提交，请等待管理员处理')
  } catch (err: any) {
    if (err === 'cancel' || err === 'close') return
    ElMessage.error(err?.response?.data?.message || err?.response?.data?.msg || err?.message || '提交解封申请失败')
  } finally {
    applyingUnfreeze.value = false
  }
}
</script>

<template>
  <div class="min-vh-100 d-flex flex-column">
    <nav class="navbar navbar-expand-lg navbar-light bg-white border-bottom">
      <div class="container-xxl">
        <RouterLink class="navbar-brand d-flex align-items-center gap-2" to="/tasks">
          <span
            class="rounded-3 d-inline-flex align-items-center justify-content-center text-white fw-semibold"
            style="width: 32px; height: 32px; background: var(--bs-primary)"
            >CE</span
          >
          <span class="fw-semibold">Campus Express</span>
        </RouterLink>

        <button
          class="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#ceNavbar"
          aria-controls="ceNavbar"
          aria-expanded="false"
          aria-label="Toggle navigation"
        >
          <span class="navbar-toggler-icon" />
        </button>

        <div id="ceNavbar" class="collapse navbar-collapse">
          <div class="ms-auto d-flex align-items-center gap-2">
            <span class="badge text-bg-light border">{{ roleLabel }}</span>
            <div class="dropdown">
              <button class="btn btn-outline-primary dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                {{ auth.displayName }}
              </button>
              <ul class="dropdown-menu dropdown-menu-end">
                <li>
                  <RouterLink class="dropdown-item" to="/profile">个人资料</RouterLink>
                </li>
                <li>
                  <RouterLink class="dropdown-item" to="/wallet/logs">钱包流水</RouterLink>
                </li>
                <li>
                  <RouterLink class="dropdown-item" to="/reviews">我的评价</RouterLink>
                </li>
                <li><hr class="dropdown-divider" /></li>
                <li><button class="dropdown-item text-danger" type="button" @click="onLogout">退出登录</button></li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </nav>

    <main class="flex-grow-1 py-4">
      <div class="container-xxl">
        <div class="row g-3">
          <div class="col-12 col-lg-3">
            <div class="card border-0 shadow-sm">
              <div class="card-body">
                <div v-for="g in menuGroups" :key="g.label" class="mb-3">
                  <div v-if="canShow(g.roles)" class="vstack gap-2">
                    <div class="text-muted small fw-semibold">{{ g.label }}</div>
                    <div class="list-group list-group-flush">
                      <template v-for="it in g.items" :key="it.to">
                        <RouterLink
                          v-if="canShow(it.roles)"
                          class="list-group-item list-group-item-action"
                          :class="{ active: isActive(it.to) }"
                          :to="it.to"
                        >
                          {{ it.label }}
                        </RouterLink>
                      </template>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="col-12 col-lg-9">
            <div
              v-if="frozen"
              class="alert alert-warning d-flex flex-wrap align-items-center justify-content-between gap-2"
              role="alert"
            >
              <div>
                <div class="fw-semibold">账号已冻结</div>
                <div class="small">你可以正常登录，但部分功能（发布任务、抢单、聊天发送）已被限制。</div>
              </div>
              <div class="d-flex gap-2">
                <button class="btn btn-warning btn-sm" type="button" :disabled="applyingUnfreeze" @click="onApplyUnfreeze">
                  申请解封
                </button>
              </div>
            </div>
            <RouterView />
          </div>
        </div>
      </div>
    </main>

    <footer class="border-top bg-white">
      <div class="container-xxl py-3 d-flex flex-wrap align-items-center justify-content-between gap-2">
        <div class="text-muted small">© Campus Express</div>
        <div class="text-muted small">主色 #4361ee · Bootstrap 5</div>
      </div>
    </footer>
  </div>
</template>
