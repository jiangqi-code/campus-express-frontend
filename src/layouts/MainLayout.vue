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
const directionContract = 'THESIS: Campus Express is a precise campus relay board, not a generic dashboard. OWN-WORLD: deep ink navigation, warm paper surfaces, coral actions, mustard attention, and teal completion markers connected by route lines. STORY: every role sees the current handoff and its next action. FIRST VIEWPORT: a dark utility bar leads into a three-part relay shell—route rail, work surface, and live context—where the primary action sits at the top of the active route. FORM: Campus Relay Board, direction 5, seed 43d60da0. FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance'

onMounted(() => document.body.prepend(document.createComment(directionContract)))

const roleLabel = computed(() => {
  if (auth.role === 'admin') return '管理员'
  if (auth.role === 'runner') return '跑腿员'
  return '用户'
})

const roleHint = computed(() => {
  if (auth.role === 'admin') return '运营与治理工作台'
  if (auth.role === 'runner') return '接力中的校园服务'
  return '校园服务，从这里出发'
})

const contextAction = computed(() => {
  if (auth.role === 'admin') return { label: '进入运营概览', to: '/admin/dashboard', note: '先看今天的运营状态与待处理事项' }
  if (auth.role === 'runner') return { label: '查看可接任务', to: '/tasks', note: '从待接力任务中选择下一单' }
  return { label: '发布任务', to: '/task/publish', note: '把你的需求送上校园服务路线' }
})

const contextSteps = computed(() => {
  if (auth.role === 'admin') return ['查看运营概览', '处理待审核事项', '跟进异常与反馈']
  if (auth.role === 'runner') return ['筛选可接任务', '确认取送信息', '完成交接并更新状态']
  return ['发布一项任务', '查看订单交接进度', '完成后留下评价']
})

const frozen = computed(() => auth.isFrozen)
function isActive(prefix: string) { return route.path === prefix || route.path.startsWith(`${prefix}/`) }
function canShow(roles?: Role[]) { return !roles?.length || roles.includes(auth.role as Role) }

const menuGroups = computed<MenuGroup[]>(() => {
  const adminOnly: MenuGroup[] = [{
    label: '运营工作台', roles: ['admin'], items: [
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
  const account: MenuGroup[] = [{ label: '我的账户', items: [{ label: '个人资料', to: '/profile' }] }]
  if (auth.role === 'admin') return [...adminOnly, ...account]

  const common: MenuGroup[] = [
    { label: '任务与订单', items: [
      { label: '任务大厅', to: '/tasks' },
      { label: '我的订单', to: '/orders' },
      { label: `我的消息${messageStore.unreadCount ? ` · ${messageStore.unreadCount > 99 ? '99+' : messageStore.unreadCount}` : ''}`, to: '/messages' },
    ] },
    { label: '我的服务记录', items: [{ label: '我的评价', to: '/reviews' }] },
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
  <!-- THESIS: Campus Express is a precise campus relay board, not a generic dashboard. OWN-WORLD: deep ink navigation, warm paper surfaces, coral actions, mustard attention, and teal completion markers connected by route lines. STORY: every role sees the current handoff and its next action. FIRST VIEWPORT: a dark utility bar leads into a three-part relay shell—route rail, work surface, and live context—where the primary action sits at the top of the active route. FORM: Campus Relay Board, direction 5, seed 43d60da0. FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance -->
  <div class="relay-app">
    <header class="relay-topbar">
      <div class="relay-topbar__inner">
        <RouterLink class="relay-brand" to="/tasks" aria-label="Campus Express 任务大厅">
          <span class="relay-brand__mark">CE</span>
          <span class="relay-brand__words"><strong>Campus Express</strong><small>校园服务接力站</small></span>
        </RouterLink>

        <button class="relay-menu-toggle" type="button" data-bs-toggle="collapse" data-bs-target="#ceNavbar" aria-controls="ceNavbar" aria-expanded="false" aria-label="展开导航">
          <span /><span /><span />
        </button>

        <div id="ceNavbar" class="collapse relay-topbar__actions">
          <div class="relay-status"><span class="relay-status__dot" aria-hidden="true" />{{ roleHint }}</div>
          <span class="relay-role">{{ roleLabel }}</span>
          <div class="dropdown">
            <button class="relay-account" type="button" data-bs-toggle="dropdown" aria-expanded="false">
              <span class="relay-account__avatar">{{ auth.displayName?.slice(0, 1) || 'C' }}</span>
              <span class="relay-account__name">{{ auth.displayName }}</span>
            </button>
            <ul class="dropdown-menu dropdown-menu-end relay-dropdown">
              <li><RouterLink class="dropdown-item" to="/profile">个人资料</RouterLink></li>
              <li><RouterLink class="dropdown-item" to="/wallet/logs">钱包流水</RouterLink></li>
              <li><RouterLink class="dropdown-item" to="/reviews">我的评价</RouterLink></li>
              <li><hr class="dropdown-divider" /></li>
              <li><button class="dropdown-item relay-dropdown__logout" type="button" @click="onLogout">退出登录</button></li>
            </ul>
          </div>
        </div>
      </div>
    </header>

    <main class="relay-main">
      <div class="relay-shell">
        <aside class="relay-rail">
          <div class="relay-rail__summary">
            <span class="relay-rail__signal" aria-hidden="true"><i /><i /><i /></span>
            <div><strong>{{ roleLabel }}路线</strong><span>从这里继续下一段服务</span></div>
          </div>
          <nav class="relay-menu" aria-label="主导航">
            <section v-for="group in menuGroups" :key="group.label" v-show="canShow(group.roles)" class="relay-menu__group">
              <div class="relay-menu__label">{{ group.label }}</div>
              <template v-for="item in group.items" :key="item.to">
                <RouterLink v-if="canShow(item.roles)" class="relay-menu__link" :class="{ active: isActive(item.to) }" :to="item.to">
                  <span class="relay-menu__node" aria-hidden="true" />
                  <span>{{ item.label }}</span>
                </RouterLink>
              </template>
            </section>
          </nav>
          <div class="relay-mobile-hint">左右滑动查看全部路线</div>
        </aside>

        <section class="relay-content">
          <div v-if="frozen" class="relay-freeze" role="alert">
            <div><strong>账户当前处于限制状态</strong><span>你可以正常登录，但发布、抢单与发送消息等操作暂不可用。</span></div>
            <button class="btn btn-primary btn-sm" type="button" :disabled="applyingUnfreeze" @click="onApplyUnfreeze">申请解封</button>
          </div>
          <RouterView />
        </section>

        <aside class="relay-context">
          <div class="relay-context__top"><h2>下一段服务</h2><p>{{ contextAction.note }}</p></div>
          <RouterLink class="btn btn-primary relay-context__action" :to="contextAction.to">{{ contextAction.label }}</RouterLink>
          <ol class="relay-context__steps">
            <li v-for="(step, index) in contextSteps" :key="step"><span>{{ index + 1 }}</span><div>{{ step }}</div></li>
          </ol>
          <RouterLink class="relay-context__link" to="/orders">查看我的订单</RouterLink>
        </aside>
      </div>
    </main>

    <CouponNotification v-if="auth.role !== 'admin'" />
    <footer class="relay-footer"><span>Campus Express · 校园服务接力站</span><span>让每一次托付都有清晰去向</span></footer>
  </div>
</template>

<style scoped>
.relay-app { min-height: 100vh; }
.relay-topbar { position: sticky; z-index: 1020; top: 0; border-bottom: 1px solid rgba(255, 255, 255, 0.14); background: var(--color-navy); color: #fffdf8; }
.relay-topbar__inner { display: flex; width: min(1480px, calc(100% - 40px)); min-height: 72px; align-items: center; gap: 24px; margin: 0 auto; }
.relay-brand { display: inline-flex; min-width: max-content; align-items: center; gap: 11px; color: inherit; }
.relay-brand:hover { color: inherit; text-decoration: none; }
.relay-brand__mark { display: grid; width: 38px; height: 38px; place-items: center; border-radius: 12px 12px 12px 4px; background: var(--color-primary); color: #fffdf8; font-size: 13px; font-weight: 850; letter-spacing: .03em; }
.relay-brand__words { display: grid; gap: 1px; line-height: 1.1; }
.relay-brand__words strong { font-size: 16px; letter-spacing: -0.025em; }
.relay-brand__words small { color: rgba(255, 253, 248, 0.66); font-size: 11px; }
.relay-topbar__actions { display: flex; flex: 1; align-items: center; justify-content: flex-end; gap: 16px; }
.relay-status { display: inline-flex; align-items: center; gap: 8px; color: rgba(255, 253, 248, 0.72); font-size: 12px; }
.relay-status__dot { width: 8px; height: 8px; border-radius: 50%; background: #4cb19b; box-shadow: 0 0 0 4px rgba(76, 177, 155, 0.15); }
.relay-role { padding: 5px 9px; border: 1px solid rgba(255, 253, 248, 0.23); border-radius: var(--radius-pill); color: #f7bf4f; font-size: 12px; font-weight: 750; }
.relay-account { display: inline-flex; align-items: center; gap: 8px; border: 0; border-radius: 10px; padding: 5px 7px; background: transparent; color: #fffdf8; font-weight: 700; }
.relay-account:hover { background: rgba(255, 255, 255, 0.1); }
.relay-account__avatar { display: grid; width: 30px; height: 30px; place-items: center; border-radius: 9px 9px 9px 3px; background: #f7bf4f; color: var(--color-navy); font-size: 13px; font-weight: 850; }
.relay-account__name { max-width: 128px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.relay-dropdown { min-width: 176px; padding: 8px; border: 1px solid var(--color-border); border-radius: 12px; background: var(--color-surface); box-shadow: var(--shadow-md); }
.relay-dropdown .dropdown-item { border-radius: 7px; padding: 9px 10px; color: var(--color-text-secondary); font-size: 13px; font-weight: 650; }
.relay-dropdown .dropdown-item:hover { background: var(--color-fill); color: var(--color-text); }
.relay-dropdown__logout { color: var(--color-primary) !important; }
.relay-menu-toggle { display: none; margin-left: auto; border: 0; padding: 7px; background: transparent; }
.relay-menu-toggle span { display: block; width: 22px; height: 2px; margin: 4px; border-radius: 99px; background: #fffdf8; }
.relay-main { width: min(1480px, calc(100% - 40px)); margin: 0 auto; padding: 26px 0 44px; }
.relay-shell { display: grid; grid-template-columns: 242px minmax(0, 1fr) 216px; align-items: start; gap: 28px; }
.relay-rail { position: sticky; top: 98px; overflow: hidden; border: 1px solid var(--color-border); border-radius: var(--radius-card); background: var(--color-surface); }
.relay-rail__summary { display: flex; align-items: center; gap: 11px; padding: 18px; border-bottom: 1px solid var(--color-border); background: var(--color-fill); }
.relay-rail__summary strong, .relay-rail__summary span { display: block; }
.relay-rail__summary strong { color: var(--color-navy); font-size: 13px; }
.relay-rail__summary span:last-child { margin-top: 3px; color: var(--color-text-muted); font-size: 11px; line-height: 1.45; }
.relay-rail__signal { display: flex !important; width: 28px; flex: 0 0 28px; align-items: end; gap: 3px; }
.relay-rail__signal i { display: block; width: 7px; border-radius: 2px 2px 0 0; background: var(--color-primary); }
.relay-rail__signal i:nth-child(1) { height: 10px; background: var(--color-success); }.relay-rail__signal i:nth-child(2) { height: 19px; background: var(--color-mustard); }.relay-rail__signal i:nth-child(3) { height: 14px; }
.relay-menu { max-height: calc(100vh - 154px); overflow: auto; padding: 13px 10px 16px; }
.relay-menu__group + .relay-menu__group { margin-top: 20px; }
.relay-menu__label { margin: 0 7px 7px; color: var(--color-text-muted); font-size: 11px; font-weight: 800; letter-spacing: .04em; }
.relay-menu__link { position: relative; display: flex; min-height: 36px; align-items: center; gap: 10px; border-radius: 8px; padding: 7px 8px; color: var(--color-text-secondary); font-size: 13px; font-weight: 650; }
.relay-menu__link:hover { background: var(--color-fill); color: var(--color-navy); text-decoration: none; }
.relay-menu__link.active { background: var(--color-primary-soft); color: var(--color-primary); }
.relay-menu__node { width: 7px; height: 7px; flex: 0 0 7px; border: 1.5px solid currentColor; border-radius: 50%; opacity: .72; }
.relay-menu__link.active .relay-menu__node { border-color: var(--color-primary); background: var(--color-primary); box-shadow: 0 0 0 3px rgba(183, 71, 52, .14); }
.relay-mobile-hint { display: none; }
.relay-content { min-width: 0; }
.relay-context { position: sticky; top: 98px; border: 1px solid var(--color-border); border-radius: var(--radius-card); padding: 18px; background: var(--color-surface); }.relay-context__top { padding-bottom: 14px; border-bottom: 1px solid var(--color-border); }.relay-context h2 { margin: 0; color: var(--color-navy); font-size: 16px; }.relay-context p { margin: 6px 0 0; color: var(--color-text-muted); font-size: 12px; line-height: 1.55; }.relay-context__action { display: block; width: 100%; margin: 15px 0 17px; text-align: center; }.relay-context__steps { display: grid; gap: 14px; margin: 0; padding: 0; list-style: none; }.relay-context__steps li { display: flex; align-items: flex-start; gap: 9px; color: var(--color-text-secondary); font-size: 12px; line-height: 1.45; }.relay-context__steps span { display: grid; width: 19px; height: 19px; flex: 0 0 19px; place-items: center; border-radius: 50%; background: var(--color-fill-strong); color: var(--color-navy); font-size: 10px; font-weight: 850; }.relay-context__steps li:first-child span { background: var(--color-mustard); }.relay-context__link { display: inline-block; margin-top: 17px; border-bottom: 1px solid var(--color-primary); color: var(--color-primary); font-size: 12px; font-weight: 750; }
.relay-freeze { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 20px; padding: 14px 16px; border: 1px solid #dfb04d; border-radius: var(--radius-button); background: var(--color-warning-soft); }
.relay-freeze strong, .relay-freeze span { display: block; }.relay-freeze strong { color: #704600; font-size: 14px; }.relay-freeze span { margin-top: 2px; color: #835d1d; font-size: 12px; }
.relay-footer { display: flex; width: min(1480px, calc(100% - 40px)); justify-content: space-between; gap: 16px; margin: 0 auto; padding: 18px 0 28px; border-top: 1px solid var(--color-border); color: var(--color-text-muted); font-size: 12px; }
@media (max-width: 1199.98px) { .relay-shell { grid-template-columns: 222px minmax(0, 1fr); }.relay-context { display: none; } }
@media (max-width: 991.98px) { .relay-topbar__inner, .relay-main, .relay-footer { width: min(100% - 28px, 820px); }.relay-menu-toggle { display: block; }.relay-topbar__actions { display: none; width: 100%; flex-basis: 100%; justify-content: flex-start; padding: 0 0 14px; }.relay-topbar__actions.show { display: flex; }.relay-shell { grid-template-columns: 1fr; gap: 18px; }.relay-rail { position: static; }.relay-menu { display: grid; max-height: none; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 20px; }.relay-menu__group + .relay-menu__group { margin-top: 0; }.relay-menu__label { margin-top: 6px; }.relay-rail__summary { padding: 14px 16px; } }
@media (max-width: 575.98px) { .relay-topbar__inner { min-height: 62px; gap: 10px; }.relay-brand__words small, .relay-status, .relay-role, .relay-account__name { display: none; }.relay-topbar__actions { justify-content: flex-end; }.relay-rail { overflow: visible; border: 0; border-radius: 0; background: transparent; }.relay-rail__summary, .relay-menu__label { display: none; }.relay-menu { display: flex; max-height: none; overflow-x: auto; gap: 8px; padding: 0 0 2px; scrollbar-width: none; }.relay-menu::-webkit-scrollbar { display: none; }.relay-menu__group { display: contents; }.relay-menu__link { min-height: 38px; flex: 0 0 auto; border: 1px solid var(--color-border); background: var(--color-surface); padding: 7px 11px; }.relay-menu__link.active { border-color: var(--color-primary); }.relay-mobile-hint { display: block; margin: 7px 2px 0; color: var(--color-text-muted); font-size: 11px; }.relay-main { padding-top: 16px; }.relay-footer { align-items: flex-start; flex-direction: column; padding-top: 16px; }.relay-freeze { align-items: flex-start; flex-direction: column; }.relay-content :deep(.p-4) { padding: 0 !important; } }
</style>
