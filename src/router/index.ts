import { createRouter, createWebHistory, type RouteLocationNormalized, type RouteRecordRaw } from 'vue-router'
import { ElMessage } from 'element-plus'
import { defineComponent, h } from 'vue'

import AuthLayout from '@/layouts/AuthLayout.vue'
import MainLayout from '@/layouts/MainLayout.vue'

type Role = 'user' | 'runner' | 'admin'

function placeholderPage(title: string, subtitle = '该功能正在建设中') {
  return defineComponent({
    name: 'PlaceholderPage',
    setup() {
      return () =>
        h('div', { class: 'vstack gap-3' }, [
          h('div', {}, [h('h1', { class: 'h4 mb-1' }, title), h('div', { class: 'text-muted' }, subtitle)]),
          h('div', { class: 'card border-0 shadow-sm' }, [
            h('div', { class: 'card-body' }, [
              h('div', { class: 'text-muted' }, '请稍后再来，或联系管理员了解开通进度。'),
            ]),
          ]),
        ])
    },
  })
}

function normalizeRole(raw: unknown): Role {
  const s = String(raw ?? 'user')
    .trim()
    .toLowerCase()
  if (s === 'admin') return 'admin'
  if (s === 'runner') return 'runner'
  return 'user'
}

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    component: AuthLayout,
    meta: { public: true, title: '登录' },
    children: [{ path: '', name: 'login', component: () => import('@/views/Login.vue') }],
  },
  {
    path: '/register',
    component: AuthLayout,
    meta: { public: true, title: '注册' },
    children: [{ path: '', name: 'register', component: () => import('@/views/Register.vue') }],
  },
  {
    path: '/',
    component: MainLayout,
    redirect: '/tasks',
    meta: { title: '校园跑腿' },
    children: [
      {
        path: 'profile',
        name: 'profile',
        component: () => import('@/views/user/Profile.vue'),
        meta: { title: '个人中心' },
      },
      {
        path: 'profile/edit',
        name: 'profile-edit',
        component: () => import('@/views/user/ProfileEdit.vue'),
        meta: { title: '编辑个人资料' },
      },
      {
        path: 'runner/apply',
        name: 'runner-apply',
        component: () => import('@/views/RunnerApply.vue'),
        meta: { title: '申请成为跑腿员', roles: ['user'] satisfies Role[] },
      },

      {
        path: 'task/publish',
        name: 'task-publish',
        component: () => import('@/views/task/PublishTask.vue'),
        meta: { title: '发布任务', roles: ['user', 'admin'] satisfies Role[] },
      },
      {
        path: 'tasks',
        name: 'tasks',
        component: () => import('@/views/task/TaskHall.vue'),
        meta: { title: '任务大厅' },
      },
      {
        path: 'task/:id',
        name: 'task-detail',
        component: () => import('@/views/task/TaskDetail.vue'),
        meta: { title: '任务详情' },
      },

      {
        path: 'orders',
        name: 'orders',
        component: () => import('@/views/order/MyOrders.vue'),
        meta: { title: '我的订单' },
      },
      {
        path: 'reviews',
        name: 'reviews',
        component: () => import('@/views/user/Reviews.vue'),
        meta: { title: '我的评价' },
      },
      {
        path: 'order/:orderId/track',
        name: 'order-track',
        component: () => import('@/views/order/OrderDetail.vue'),
        meta: { title: '订单详情' },
      },
      {
        path: 'order/:orderId/chat',
        name: 'order-chat',
        component: () => import('@/views/order/OrderChat.vue'),
        meta: { title: '订单聊天' },
      },
      {
        path: 'messages',
        name: 'messages',
        component: () => import('@/views/message/MessageCenter.vue'),
        meta: { title: '我的消息' },
      },

      {
        path: 'runner/earnings',
        name: 'runner-earnings',
        component: () => import('@/views/runner/Earnings.vue'),
        meta: { title: '跑腿收益' },
      },
      {
        path: 'runner/withdrawals',
        name: 'runner-withdrawals',
        component: () => import('@/views/runner/Withdrawals.vue'),
        meta: { title: '提现记录' },
      },
      {
        path: 'runner/statistics',
        name: 'runner-statistics',
        component: placeholderPage('跑腿员统计'),
        meta: { title: '跑腿员统计', roles: ['runner', 'admin'] satisfies Role[] },
      },

      {
        path: 'wallet',
        name: 'wallet',
        component: () => import('@/views/user/Wallet.vue'),
        meta: { title: '我的钱包' },
      },
      {
        path: 'coupons',
        name: 'coupons',
        component: () => import('@/views/user/Coupons.vue'),
        meta: { title: '我的优惠券' },
      },
      {
        path: 'wallet/recharge',
        name: 'wallet-recharge',
        component: placeholderPage('钱包充值'),
        meta: { title: '钱包充值' },
      },
      {
        path: 'wallet/logs',
        name: 'wallet-logs',
        component: () => import('@/views/user/WalletLogs.vue'),
        meta: { title: '钱包流水' },
      },

      {
        path: 'admin/dashboard',
        name: 'admin-dashboard',
        component: () => import('@/views/admin/Dashboard.vue'),
        meta: { title: '后台仪表盘', requiresAdmin: true, roles: ['admin'] satisfies Role[] },
      },
      {
        path: 'admin/logs',
        name: 'admin-logs',
        component: placeholderPage('后台日志'),
        meta: { title: '后台日志', requiresAdmin: true, roles: ['admin'] satisfies Role[] },
      },
      {
        path: 'admin/logs/login',
        name: 'admin-login-logs',
        component: () => import('@/views/admin/LoginLogs.vue'),
        meta: { title: '登录日志', requiresAdmin: true, roles: ['admin'] satisfies Role[] },
      },
      {
        path: 'admin/logs/error',
        name: 'admin-error-logs',
        component: () => import('@/views/admin/ErrorLogs.vue'),  // 替换 placeholderPage
        meta: { title: '错误日志', requiresAdmin: true, roles: ['admin'] },
      },
      {
        path: 'admin/config',
        name: 'admin-config',
        component: () => import('@/views/admin/AdminConfig.vue'),
        meta: { title: '系统配置', requiresAdmin: true, roles: ['admin'] satisfies Role[] },
      },
      {
        path: 'admin/coupons',
        name: 'admin-coupons',
        component: () => import('@/views/admin/AdminCoupons.vue'),
        meta: { title: '优惠券管理', requiresAdmin: true, roles: ['admin'] satisfies Role[] },
      },
      {
        path: 'admin/sensitive-words',
        name: 'admin-sensitive-words',
        component: () => import('@/views/admin/AdminSensitiveWords.vue'),
        meta: { title: '敏感词管理', requiresAdmin: true, roles: ['admin'] satisfies Role[] },
      },
      {
        path: 'admin/users',
        name: 'admin-users',
        component: () => import('@/views/admin/AdminUsers.vue'),
        meta: { title: '用户管理', requiresAdmin: true, roles: ['admin'] satisfies Role[] },
      },
      {
        path: 'admin/tasks',
        name: 'admin-tasks',
        component: () => import('@/views/admin/Tasks.vue'),
        meta: { title: '任务治理', requiresAdmin: true, roles: ['admin'] satisfies Role[] },
      },
      {
        path: 'admin/orders',
        name: 'admin-orders',
        component: () => import('@/views/admin/AdminOrders.vue'),
        meta: { title: '订单治理', requiresAdmin: true, roles: ['admin'] satisfies Role[] },
      },
      {
        path: 'admin/withdrawals',
        name: 'admin-withdrawals',
        component: () => import('@/views/admin/Withdrawals.vue'),
        meta: { title: '提现审核', requiresAdmin: true, roles: ['admin'] },
      },
      {
        path: 'admin/refunds',
        name: 'admin-refunds',
        component: () => import('@/views/admin/Refunds.vue'),
        meta: { title: '退款审核', requiresAdmin: true, roles: ['admin'] },
      },
      {
        path: 'admin/unfreeze-applications',
        name: 'admin-unfreeze-applications',
        component: () => import('@/views/admin/UnfreezeApplications.vue'),
        meta: { title: '解封审核', requiresAdmin: true, roles: ['admin'] },
      },
      {
        path: 'admin/runner-auth',
        name: 'admin-runner-auth',
        component: () => import('@/views/admin/AdminRunnerAuth.vue'),
        meta: { title: '跑腿员入驻审核', requiresAdmin: true, roles: ['admin'] satisfies Role[] },
      },
      {
        path: 'admin/reports',
        name: 'admin-reports',
        component: () => import('@/views/admin/AdminReports.vue'),
        meta: { title: '举报管理', requiresAdmin: true, roles: ['admin'] satisfies Role[] },
      },
      {
        path: 'admin/complaints',
        name: 'admin-complaints',
        component: () => import('@/views/admin/AdminComplaints.vue'),
        meta: { title: '投诉处理', requiresAdmin: true, roles: ['admin'] satisfies Role[] },
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/tasks',
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

router.beforeEach((to: RouteLocationNormalized) => {
  const token = localStorage.getItem('ce_token')
  const role = normalizeRole(localStorage.getItem('ce_role'))

  if (to.meta.public) {
    if (token && (to.name === 'login' || to.name === 'register')) {
      const redirectTo = typeof to.query.redirect === 'string' ? to.query.redirect : '/tasks'
      return redirectTo
    }
    return true
  }

  if (!token) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }

  if (to.meta.requiresAdmin && role !== 'admin') {
    ElMessage.warning('仅管理员可访问该页面')
    return '/tasks'
  }

  if (to.name === 'runner-apply' && role === 'runner') {
    ElMessage.info('你已是跑腿员')
    return '/runner/earnings'
  }

  const roles = to.meta.roles as Role[] | undefined
  if (roles && !roles.includes(role)) {
    ElMessage.warning('无权限访问该页面')
    return '/tasks'
  }

  return true
})

router.afterEach((to: RouteLocationNormalized) => {
  const title = typeof to.meta.title === 'string' ? to.meta.title : '校园跑腿'
  document.title = `${title} - Campus Express`
})

export default router
