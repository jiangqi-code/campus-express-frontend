<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { http } from '@/api/request'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const loading = ref(false)
const profile = ref({ nickname: auth.displayName || '同学', avatar: '', role: auth.role as string, creditScore: 0, birthDate: '' })
const roleName = computed(() => profile.value.role === 'runner' ? '跑腿员' : profile.value.role === 'admin' ? '管理员' : '普通用户')
const avatarText = computed(() => profile.value.nickname.slice(0, 1).toUpperCase() || 'U')
const errorText = (e: any) => e?.response?.data?.message || e?.response?.data?.msg || e?.message || '个人资料加载失败'
const shortcuts = [
  { to: '/profile/edit', title: '个人资料', desc: '修改头像、昵称、手机号和学号' }, { to: '/wallet', title: '我的钱包', desc: '查看余额与模拟充值' },
  { to: '/wallet/logs', title: '钱包流水', desc: '查看账户资金变动记录' }, { to: '/orders', title: '我的订单', desc: '管理发布和接取的订单' },
  { to: '/reviews', title: '我的评价', desc: '查看已提交的评价' }, { to: '/coupon', title: '我的优惠券', desc: '领取优惠券并查看使用状态' },
]
async function fetchProfile() {
  loading.value = true
  try {
    let response: any
    try { response = await http.get('/user/me') } catch { response = await http.get('/auth/me') }
    const root = response?.data?.data ?? response?.data ?? {}; const raw = root?.user ?? root
    profile.value = { nickname: String(raw.nickname ?? raw.name ?? auth.displayName ?? '同学'), avatar: String(raw.avatar ?? raw.avatar_url ?? ''), role: String(raw.role ?? auth.role).toLowerCase(), creditScore: Number(raw.credit_score ?? raw.creditScore ?? raw.credit ?? 0), birthDate: String(raw.birth_date ?? raw.birthDate ?? '').slice(0, 10) }
  } catch (e: any) { ElMessage.error(errorText(e)) } finally { loading.value = false }
}
onMounted(fetchProfile)
</script>

<template>
  <div class="profile-page" v-loading="loading">
    <div class="profile-pass">
      <div class="profile-pass__identity">
        <img v-if="profile.avatar" class="profile-avatar" :src="profile.avatar" alt="用户头像" />
        <div v-else class="profile-avatar profile-avatar--fallback">{{ avatarText }}</div>
        <div><h1>{{ profile.nickname }}</h1><div class="profile-pass__role"><span>{{ roleName }}</span><b>信用分 {{ profile.creditScore }}</b></div></div>
      </div>
      <div class="profile-pass__route"><span>我的服务路线</span><strong>账户与常用入口</strong><RouterLink to="/profile/edit">编辑资料</RouterLink></div>
    </div>

    <div class="profile-detail"><span>出生日期</span><strong v-if="profile.birthDate">{{ profile.birthDate }}</strong><RouterLink v-else to="/profile/edit">补充生日信息</RouterLink></div>

    <section class="profile-shortcuts" aria-label="常用服务">
      <RouterLink v-for="(item, index) in shortcuts" :key="item.to" class="profile-link" :class="`profile-link--${index % 4}`" :to="item.to">
        <span class="profile-link__route" aria-hidden="true"><i /><i /></span>
        <span><strong>{{ item.title }}</strong><small>{{ item.desc }}</small></span>
      </RouterLink>
      <RouterLink v-if="auth.role === 'user'" class="profile-link profile-link--runner" to="/runner/apply">
        <span class="profile-link__route" aria-hidden="true"><i /><i /></span><span><strong>跑腿员申请</strong><small>提交身份资料并查看申请进度</small></span>
      </RouterLink>
    </section>
  </div>
</template>

<style scoped>
.profile-page { max-width: 1180px; margin: 0; }
.profile-pass { display: flex; min-height: 148px; align-items: center; justify-content: space-between; gap: 36px; border: 1px solid var(--color-border); border-radius: var(--radius-card); padding: 28px 30px; background: var(--color-surface); }
.profile-pass__identity { display: flex; min-width: 0; align-items: center; gap: 18px; }
.profile-avatar { width: 78px; height: 78px; flex: 0 0 auto; border: 1px solid var(--color-sidebar-rule); border-radius: 50%; background: var(--color-primary-soft); object-fit: cover; }
.profile-avatar--fallback { display: grid; place-items: center; background: var(--color-primary); color: #fff; font-size: 28px; font-weight: 850; }
.profile-pass h1 { margin: 0; color: var(--color-navy); font-size: clamp(24px, 3vw, 32px); letter-spacing: -.03em; }
.profile-pass__role { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 9px; }
.profile-pass__role span, .profile-pass__role b { border-radius: var(--radius-pill); padding: 4px 9px; font-size: 12px; font-weight: 750; }
.profile-pass__role span { border: 1px solid var(--color-border); background: var(--color-fill); color: var(--color-text-secondary); }
.profile-pass__role b { background: var(--color-primary-soft); color: var(--color-primary-active); }
.profile-pass__route { display: grid; min-width: 244px; gap: 3px; padding-left: 28px; border-left: 1px solid var(--color-border); }
.profile-pass__route span { color: var(--color-text-muted); font-size: 11px; font-weight: 750; }
.profile-pass__route strong { color: var(--color-text); font-size: 14px; }
.profile-pass__route a { width: max-content; margin-top: 7px; border-bottom: 1px solid currentColor; color: var(--color-primary); font-size: 12px; font-weight: 750; }
.profile-detail { display: flex; min-height: 58px; align-items: center; gap: 12px; margin: 16px 0 22px; border-top: 1px solid var(--color-border); border-bottom: 1px solid var(--color-border); padding: 12px 16px; background: rgba(255,255,255,.64); color: var(--color-text-muted); font-size: 13px; }
.profile-detail strong { color: var(--color-text); }.profile-detail a { color: var(--color-primary); font-weight: 750; }
.profile-shortcuts { display: grid; overflow: hidden; border: 1px solid var(--color-border); border-radius: var(--radius-card); background: var(--color-surface); }
.profile-link { display: flex; min-height: 78px; align-items: center; gap: 16px; border-bottom: 1px solid var(--color-border); padding: 15px 20px; background: transparent; transition: background var(--transition-fast), color var(--transition-fast); }
.profile-link:last-child { border-bottom: 0; }.profile-link:hover { background: var(--color-primary-soft); text-decoration: none; }.profile-link:focus-visible { outline: none; box-shadow: inset var(--focus-ring); }
.profile-link strong, .profile-link small { display: block; }.profile-link strong { color: var(--color-navy); font-size: 15px; }.profile-link small { margin-top: 3px; color: var(--color-text-muted); font-size: 12px; line-height: 1.45; }
.profile-link__route { position: relative; display: grid; width: 29px; height: 35px; flex: 0 0 29px; align-items: center; justify-items: center; color: var(--color-primary); }.profile-link__route::before { position: absolute; top: 6px; bottom: 6px; width: 1px; background: currentColor; content: ''; }.profile-link__route i { position: relative; z-index: 1; width: 9px; height: 9px; border: 2px solid var(--color-surface); border-radius: 50%; background: currentColor; }.profile-link:hover .profile-link__route { color: var(--color-primary-active); }
@media (max-width: 820px) { .profile-pass { gap: 24px; }.profile-pass__route { min-width: 190px; padding-left: 22px; } }
@media (max-width: 575.98px) { .profile-pass { align-items: flex-start; flex-direction: column; padding: 22px; }.profile-pass__route { width: 100%; min-width: 0; padding: 14px 0 0; border-top: 1px solid var(--color-border); border-left: 0; }.profile-detail { margin: 14px 0 18px; padding: 12px; }.profile-link { min-height: 72px; padding: 14px 16px; } }
</style>
