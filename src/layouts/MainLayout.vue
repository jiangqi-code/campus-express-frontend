<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'

import { applyUnfreezeApi } from '@/api/auth'
import { useAuthStore } from '@/stores/auth'
import { useMessageStore } from '@/stores/messages'
import CouponNotification from '@/components/CouponNotification.vue'

type Role = 'user' | 'runner' | 'admin'
type MenuItem = { label: string; to: string; roles?: Role[] }
type MenuGroup = { label: string; roles?: Role[]; items: MenuItem[] }

const auth = useAuthStore()
const messageStore = useMessageStore()
const route = useRoute()
const router = useRouter()
const applyingUnfreeze = ref(false)
const mobileMenuOpen = ref(false)
const directionContract = 'THESIS: Campus Express is one continuous campus operations canvas, not a set of disconnected dashboard cards. OWN-WORLD: a full-height pale-blue work index at left, a white daylight workspace at right, thin blue-gray rules, and one restrained cobalt action signal. STORY: each role moves from navigation to task without crossing visual seams or competing panels. FIRST VIEWPORT: the left index is part of the page field; a single white command header names the active page and holds the primary action, while the work surface starts directly below. FORM: Campus Operations Canvas, user-pinned reference composition, seed 75f731a9. FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance'

onMounted(() => document.body.prepend(document.createComment(directionContract)))

const roleLabel = computed(() => auth.role === 'admin' ? '管理员' : auth.role === 'runner' ? '跑腿员' : '用户')
const pageTitle = computed(() => String(route.meta.title || (auth.role === 'admin' ? '运营工作台' : '校园服务')))
const pageDescription = computed(() => auth.role === 'admin' ? '管理校园服务与日常运营' : auth.role === 'runner' ? '处理任务、收益与服务记录' : '发布、追踪并管理你的校园服务')
const contextAction = computed(() => {
  if (auth.role === 'admin') return { label: '运营概览', to: '/admin/dashboard' }
  if (auth.role === 'runner') return { label: '查看可接任务', to: '/tasks' }
  return { label: '发布任务', to: '/task/publish' }
})
const frozen = computed(() => auth.isFrozen)

function isActive(prefix: string) { return route.path === prefix || route.path.startsWith(`${prefix}/`) }
function canShow(roles?: Role[]) { return !roles?.length || roles.includes(auth.role as Role) }
function closeMobileMenu() { mobileMenuOpen.value = false }

const menuGroups = computed<MenuGroup[]>(() => {
  const adminOnly: MenuGroup[] = [{
    label: '运营管理', roles: ['admin'], items: [
      { label: '运营概览', to: '/admin/dashboard', roles: ['admin'] },
      { label: '用户管理', to: '/admin/users', roles: ['admin'] },
      { label: '任务治理', to: '/admin/tasks', roles: ['admin'] },
      { label: '订单治理', to: '/admin/orders', roles: ['admin'] },
      { label: '跑腿员审核', to: '/admin/runner-auth', roles: ['admin'] },
      { label: '提现审核', to: '/admin/withdrawals', roles: ['admin'] },
      { label: '退款审核', to: '/admin/refunds', roles: ['admin'] },
      { label: '投诉处理', to: '/admin/complaints', roles: ['admin'] },
    ],
  }, {
    label: '系统与风控', roles: ['admin'], items: [
      { label: '登录日志', to: '/admin/logs/login', roles: ['admin'] },
      { label: '错误日志', to: '/admin/logs/error', roles: ['admin'] },
      { label: '举报管理', to: '/admin/reports', roles: ['admin'] },
      { label: '解封审核', to: '/admin/unfreeze-applications', roles: ['admin'] },
      { label: '优惠券管理', to: '/admin/coupons', roles: ['admin'] },
      { label: '发放规则', to: '/admin/coupon-events', roles: ['admin'] },
      { label: '发放记录', to: '/admin/coupon-records', roles: ['admin'] },
      { label: '敏感词管理', to: '/admin/sensitive-words', roles: ['admin'] },
      { label: '系统配置', to: '/admin/config', roles: ['admin'] },
    ],
  }]
  const account: MenuGroup[] = [{ label: '账户', items: [{ label: '个人资料', to: '/profile' }] }]
  if (auth.role === 'admin') return [...adminOnly, ...account]

  const common: MenuGroup[] = [
    { label: '任务与订单', items: [
      { label: '任务大厅', to: '/tasks' },
      { label: '我的订单', to: '/orders' },
      { label: `我的消息${messageStore.unreadCount ? ` · ${messageStore.unreadCount > 99 ? '99+' : messageStore.unreadCount}` : ''}`, to: '/messages' },
    ] },
    { label: '服务记录', items: [{ label: '我的评价', to: '/reviews' }] },
    { label: '资金与权益', items: [{ label: '钱包流水', to: '/wallet/logs' }, { label: '我的优惠券', to: '/coupon' }] },
    ...account,
  ]
  const userExtra: MenuGroup[] = [{ label: '发布与成长', roles: ['user'], items: [{ label: '发布任务', to: '/task/publish', roles: ['user'] }, { label: '申请成为跑腿员', to: '/runner/apply', roles: ['user'] }] }]
  const runnerExtra: MenuGroup[] = [{ label: '跑腿员中心', roles: ['runner'], items: [{ label: '跑腿收益', to: '/runner/earnings', roles: ['runner'] }, { label: '提现记录', to: '/runner/withdrawals', roles: ['runner'] }, { label: '服务统计', to: '/runner/statistics', roles: ['runner'] }] }]
  if (auth.role === 'user') return [...userExtra, ...common]
  if (auth.role === 'runner') return [...runnerExtra, ...common]
  return []
})

function onLogout() { auth.logout(); router.push('/login') }
async function onApplyUnfreeze() {
  if (applyingUnfreeze.value) return
  applyingUnfreeze.value = true
  try {
    const { value } = await ElMessageBox.prompt('请输入解封申请原因（可选）', '申请解封', { confirmButtonText: '提交', cancelButtonText: '取消', inputType: 'textarea', inputPlaceholder: '例如：误封，已完成整改', inputValue: '', closeOnClickModal: false, distinguishCancelAndClose: true })
    await applyUnfreezeApi({ reason: String(value ?? '').trim() || undefined })
    ElMessage.success('解封申请已提交，请等待管理员处理')
  } catch (err: any) {
    if (err === 'cancel' || err === 'close') return
    ElMessage.error(err?.response?.data?.message || err?.response?.data?.msg || err?.message || '提交解封申请失败')
  } finally { applyingUnfreeze.value = false }
}
</script>

<template>
  <!-- THESIS: Campus Express is one continuous campus operations canvas, not a set of disconnected dashboard cards. OWN-WORLD: a full-height pale-blue work index at left, a white daylight workspace at right, thin blue-gray rules, and one restrained cobalt action signal. STORY: each role moves from navigation to task without crossing visual seams or competing panels. FIRST VIEWPORT: the left index is part of the page field; a single white command header names the active page and holds the primary action, while the work surface starts directly below. FORM: Campus Operations Canvas, user-pinned reference composition, seed 75f731a9. FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance -->
  <div class="workspace-app">
    <aside class="workspace-sidebar" :class="{ 'is-open': mobileMenuOpen }" aria-label="主导航">
      <div class="workspace-sidebar__brand">
        <RouterLink class="workspace-brand" to="/tasks" aria-label="Campus Express 任务大厅" @click="closeMobileMenu">
          <span class="workspace-brand__mark">CE</span>
          <span><strong>Campus Express</strong><small>校园服务平台</small></span>
        </RouterLink>
      </div>

      <nav class="workspace-menu">
        <section v-for="group in menuGroups" :key="group.label" v-show="canShow(group.roles)" class="workspace-menu__group">
          <div class="workspace-menu__label">{{ group.label }}</div>
          <template v-for="item in group.items" :key="item.to">
            <RouterLink v-if="canShow(item.roles)" class="workspace-menu__link" :class="{ active: isActive(item.to) }" :to="item.to" @click="closeMobileMenu">
              <span class="workspace-menu__dot" aria-hidden="true" />
              <span>{{ item.label }}</span>
            </RouterLink>
          </template>
        </section>
      </nav>

      <div class="workspace-sidebar__account">
        <div class="workspace-account__avatar">{{ auth.displayName?.slice(0, 1) || 'C' }}</div>
        <div><strong>{{ auth.displayName || 'Campus Express' }}</strong><span>{{ roleLabel }}</span></div>
        <div class="dropup ms-auto">
          <button class="workspace-account__more" type="button" data-bs-toggle="dropdown" aria-expanded="false" aria-label="账户操作"><span /><span /><span /></button>
          <ul class="dropdown-menu dropdown-menu-end workspace-dropdown">
            <li><RouterLink class="dropdown-item" to="/profile">个人资料</RouterLink></li>
            <li><RouterLink class="dropdown-item" to="/wallet/logs">钱包流水</RouterLink></li>
            <li><hr class="dropdown-divider" /></li>
            <li><button class="dropdown-item workspace-dropdown__logout" type="button" @click="onLogout">退出登录</button></li>
          </ul>
        </div>
      </div>
    </aside>

    <div class="workspace-main">
      <header class="workspace-header">
        <button class="workspace-menu-toggle" type="button" aria-label="打开导航" @click="mobileMenuOpen = !mobileMenuOpen"><span /><span /><span /></button>
        <div class="workspace-heading"><h1>{{ pageTitle }}</h1><p>{{ pageDescription }}</p></div>
        <div class="workspace-header__actions">
          <RouterLink class="btn btn-primary workspace-primary-action" :to="contextAction.to">{{ contextAction.label }}</RouterLink>
          <span class="workspace-role">{{ roleLabel }}</span>
          <div class="dropdown">
            <button class="workspace-user" type="button" data-bs-toggle="dropdown" aria-expanded="false" aria-label="打开账户菜单">{{ auth.displayName?.slice(0, 1) || 'C' }}</button>
            <ul class="dropdown-menu dropdown-menu-end workspace-dropdown">
              <li><RouterLink class="dropdown-item" to="/profile">个人资料</RouterLink></li>
              <li><RouterLink class="dropdown-item" to="/reviews">我的评价</RouterLink></li>
              <li><hr class="dropdown-divider" /></li>
              <li><button class="dropdown-item workspace-dropdown__logout" type="button" @click="onLogout">退出登录</button></li>
            </ul>
          </div>
        </div>
      </header>

      <main class="workspace-stage">
        <section class="workspace-content">
          <div v-if="frozen" class="workspace-freeze" role="alert">
            <div><strong>账户当前处于限制状态</strong><span>你可以正常登录，但发布、抢单与发送消息等操作暂不可用。</span></div>
            <button class="btn btn-primary btn-sm" type="button" :disabled="applyingUnfreeze" @click="onApplyUnfreeze">申请解封</button>
          </div>
          <RouterView />
        </section>
      </main>

      <footer class="workspace-footer"><span>Campus Express · 校园服务平台</span><span>任务清晰，行动直接</span></footer>
    </div>

    <button v-if="mobileMenuOpen" class="workspace-backdrop" type="button" aria-label="关闭导航" @click="closeMobileMenu" />
    <CouponNotification v-if="auth.role !== 'admin'" />
  </div>
</template>

<style scoped>
.workspace-app { display: grid; min-height: 100vh; grid-template-columns: 260px minmax(0, 1fr); background: var(--color-canvas); }
.workspace-sidebar { z-index: 1030; display: flex; min-height: 100vh; flex-direction: column; border-right: 1px solid var(--color-sidebar-rule); background: var(--color-sidebar); }
.workspace-sidebar__brand { display: flex; min-height: 108px; align-items: center; padding: 0 28px; border-bottom: 1px solid var(--color-sidebar-rule); }
.workspace-brand { display: inline-flex; align-items: center; gap: 11px; color: var(--color-navy); text-decoration: none; }.workspace-brand:hover { color: var(--color-navy); }
.workspace-brand__mark { display: grid; width: 38px; height: 38px; place-items: center; border-radius: 9px; background: var(--color-primary); color: #fff; font-size: 13px; font-weight: 850; letter-spacing: .02em; }
.workspace-brand > span:last-child { display: grid; gap: 1px; }.workspace-brand strong { font-size: 17px; letter-spacing: -.03em; }.workspace-brand small { color: var(--color-text-muted); font-size: 11px; }
.workspace-menu { flex: 1; overflow: auto; padding: 24px 14px 18px; }.workspace-menu__group + .workspace-menu__group { margin-top: 25px; }
.workspace-menu__label { margin: 0 12px 8px; color: #7890ae; font-size: 11px; font-weight: 800; letter-spacing: .05em; }
.workspace-menu__link { display: flex; min-height: 42px; align-items: center; gap: 11px; border-radius: 8px; padding: 9px 12px; color: #35506f; font-size: 14px; font-weight: 680; transition: background-color var(--transition-fast), color var(--transition-fast); }
.workspace-menu__link:hover { background: rgba(255,255,255,.56); color: var(--color-navy); text-decoration: none; }.workspace-menu__link.active { background: #fff; color: var(--color-primary); box-shadow: var(--shadow-sm); }
.workspace-menu__dot { width: 7px; height: 7px; flex: 0 0 7px; border: 1.5px solid currentColor; border-radius: 50%; opacity: .72; }.workspace-menu__link.active .workspace-menu__dot { border-color: var(--color-primary); background: var(--color-primary); opacity: 1; }
.workspace-sidebar__account { display: flex; min-height: 82px; align-items: center; gap: 10px; padding: 14px 20px; border-top: 1px solid var(--color-sidebar-rule); }.workspace-account__avatar { display: grid; width: 34px; height: 34px; flex: 0 0 34px; place-items: center; border-radius: 50%; background: #cbdfff; color: var(--color-primary-active); font-size: 13px; font-weight: 850; }.workspace-sidebar__account strong, .workspace-sidebar__account span { display: block; }.workspace-sidebar__account strong { max-width: 118px; overflow: hidden; color: var(--color-navy); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }.workspace-sidebar__account span { margin-top: 1px; color: var(--color-text-muted); font-size: 11px; }.workspace-account__more { display: flex; align-items: center; gap: 3px; border: 0; border-radius: 6px; padding: 8px 5px; background: transparent; }.workspace-account__more span { width: 3px; height: 3px; border-radius: 50%; background: #5d7595; }.workspace-account__more:hover { background: rgba(255,255,255,.65); }
.workspace-main { display: grid; min-width: 0; grid-template-rows: auto 1fr auto; background: var(--color-canvas); }.workspace-header { position: sticky; z-index: 1020; top: 0; display: flex; min-height: 108px; align-items: center; gap: 24px; border-bottom: 1px solid var(--color-border); padding: 20px 38px; background: rgba(255,255,255,.97); }.workspace-heading { min-width: 0; }.workspace-heading h1 { margin: 0; color: var(--color-navy); font-size: clamp(26px, 2.25vw, 34px); letter-spacing: -.035em; }.workspace-heading p { margin: 5px 0 0; color: var(--color-text-muted); font-size: 14px; }.workspace-header__actions { display: flex; align-items: center; gap: 13px; margin-left: auto; }.workspace-primary-action { min-width: 106px; }.workspace-role { border: 1px solid var(--color-border); border-radius: var(--radius-pill); padding: 5px 9px; color: var(--color-text-secondary); font-size: 12px; font-weight: 720; }.workspace-user { display: grid; width: 36px; height: 36px; place-items: center; border: 0; border-radius: 50%; background: var(--color-navy); color: #fff; font-size: 13px; font-weight: 850; }.workspace-user:hover { background: var(--color-primary); }.workspace-menu-toggle { display: none; border: 0; padding: 7px; background: transparent; }.workspace-menu-toggle span { display: block; width: 22px; height: 2px; margin: 4px; border-radius: 99px; background: var(--color-navy); }
.workspace-stage { min-width: 0; padding: 34px 38px 48px; background: var(--color-canvas); }.workspace-content { width: min(100%, 1540px); margin: 0 auto; }.workspace-content :deep(.p-4) { padding: 0 !important; }
.workspace-freeze { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin: 0 0 20px; border: 1px solid #9ebdf1; border-radius: var(--radius-card); padding: 14px 16px; background: #edf5ff; }.workspace-freeze strong, .workspace-freeze span { display: block; }.workspace-freeze strong { color: var(--color-navy); font-size: 14px; }.workspace-freeze span { margin-top: 2px; color: var(--color-text-secondary); font-size: 12px; }
.workspace-footer { display: flex; justify-content: space-between; gap: 16px; border-top: 1px solid var(--color-border); padding: 19px 38px 24px; color: var(--color-text-muted); font-size: 12px; }.workspace-dropdown { min-width: 168px; padding: 7px; border: 1px solid var(--color-border); border-radius: 10px; background: #fff; box-shadow: var(--shadow-md); }.workspace-dropdown .dropdown-item { border-radius: 6px; padding: 8px 10px; color: var(--color-text-secondary); font-size: 13px; font-weight: 650; }.workspace-dropdown .dropdown-item:hover { background: var(--color-fill); color: var(--color-navy); }.workspace-dropdown__logout { color: var(--color-primary) !important; }
.workspace-backdrop { display: none; }
@media (max-width: 991.98px) { .workspace-app { display: block; }.workspace-sidebar { position: fixed; z-index: 1050; top: 0; bottom: 0; left: 0; width: min(284px, 82vw); min-height: 0; transform: translateX(-102%); transition: transform var(--transition); box-shadow: var(--shadow-lg); }.workspace-sidebar.is-open { transform: translateX(0); }.workspace-backdrop { position: fixed; z-index: 1040; inset: 0; display: block; border: 0; background: rgba(8,17,32,.22); }.workspace-menu-toggle { display: block; }.workspace-header { min-height: 78px; gap: 11px; padding: 15px 20px; }.workspace-heading h1 { font-size: 24px; }.workspace-heading p { display: none; }.workspace-stage { padding: 24px 20px 36px; }.workspace-footer { padding: 18px 20px 22px; }.workspace-freeze { align-items: flex-start; flex-direction: column; } }
@media (max-width: 575.98px) { .workspace-header { gap: 6px; padding: 14px; }.workspace-heading h1 { font-size: 21px; }.workspace-header__actions { gap: 8px; }.workspace-primary-action { min-width: auto; padding-right: 10px; padding-left: 10px; font-size: 12px; }.workspace-role { display: none; }.workspace-user { width: 32px; height: 32px; }.workspace-stage { padding: 18px 14px 30px; }.workspace-footer { align-items: flex-start; flex-direction: column; padding: 16px 14px 22px; }.workspace-content :deep(.p-4) { padding: 0 !important; } }
</style>
