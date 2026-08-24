<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { http } from '@/api/request'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const loading = ref(false)
const profile = ref({ nickname: auth.displayName || '同学', avatar: '', role: auth.role as string, creditScore: 0, birthDate:'' })
const roleName = computed(() => profile.value.role === 'runner' ? '跑腿员' : profile.value.role === 'admin' ? '管理员' : '普通用户')
const avatarText = computed(() => profile.value.nickname.slice(0, 1).toUpperCase() || 'U')
const errorText = (e: any) => e?.response?.data?.message || e?.response?.data?.msg || e?.message || '个人资料加载失败'

async function fetchProfile() {
  loading.value = true
  try {
    let response: any
    try { response = await http.get('/user/me') } catch { response = await http.get('/auth/me') }
    const root = response?.data?.data ?? response?.data ?? {}
    const raw = root?.user ?? root
    profile.value = {
      nickname: String(raw.nickname ?? raw.name ?? auth.displayName ?? '同学'),
      avatar: String(raw.avatar ?? raw.avatar_url ?? ''),
      role: String(raw.role ?? auth.role).toLowerCase(),
      creditScore: Number(raw.credit_score ?? raw.creditScore ?? raw.credit ?? 0),
      birthDate:String(raw.birth_date??raw.birthDate??'').slice(0,10),
    }
  } catch (e: any) { ElMessage.error(errorText(e)) } finally { loading.value = false }
}
onMounted(fetchProfile)
</script>

<template>
  <div class="profile-page vstack gap-3" v-loading="loading">
    <div><h1 class="h4 mb-1">个人中心</h1><div class="text-muted">账户核心信息与常用功能入口</div></div>
    <div class="card border-0 shadow-sm"><div class="card-body d-flex align-items-center gap-3">
      <img v-if="profile.avatar" class="profile-avatar" :src="profile.avatar" alt="用户头像" />
      <div v-else class="profile-avatar profile-avatar--fallback">{{ avatarText }}</div>
      <div class="flex-grow-1"><div class="fs-5 fw-semibold">{{ profile.nickname }}</div><div class="d-flex gap-2 mt-2">
        <span class="badge text-bg-primary">{{ roleName }}</span><span class="badge text-bg-light text-dark">信用分 {{ profile.creditScore }}</span>
      </div><div class="birthday mt-2"><span>出生日期</span><strong v-if="profile.birthDate">{{ profile.birthDate }}</strong><RouterLink v-else to="/profile/edit">补充生日信息</RouterLink></div></div>
    </div></div>
    <div class="row g-3">
      <div v-for="item in [
        { to: '/profile/edit', title: '个人资料', desc: '修改头像、昵称、手机号和学号' },
        { to: '/wallet', title: '我的钱包', desc: '查看余额与模拟充值' },
        { to: '/wallet/logs', title: '钱包流水', desc: '查看账户资金变动记录' },
        { to: '/orders', title: '我的订单', desc: '管理发布和接取的订单' },
        { to: '/reviews', title: '我的评价', desc: '查看已提交的评价' },
        { to: '/coupon', title: '我的优惠券', desc: '领取优惠券并查看使用状态' },
      ]" :key="item.to" class="col-12 col-md-6 col-xl-4">
        <RouterLink class="menu-card card border-0 shadow-sm h-100 text-decoration-none" :to="item.to"><div class="card-body">
          <div class="fw-semibold text-dark">{{ item.title }}</div><div class="text-muted small mt-1">{{ item.desc }}</div>
        </div></RouterLink>
      </div>
      <div v-if="auth.role === 'user'" class="col-12 col-md-6 col-xl-4"><RouterLink class="menu-card card border-0 shadow-sm h-100 text-decoration-none" to="/runner/apply"><div class="card-body">
        <div class="fw-semibold text-dark">跑腿员申请</div><div class="text-muted small mt-1">提交身份资料并查看申请进度</div>
      </div></RouterLink></div>
    </div>
  </div>
</template>

<style scoped>
.profile-page{max-width:960px;margin:0 auto}.profile-avatar{width:72px;height:72px;border-radius:50%;object-fit:cover;flex:0 0 auto}.profile-avatar--fallback{display:grid;place-items:center;color:#fff;font-size:1.5rem;font-weight:700;background:var(--bs-primary)}.birthday{display:flex;align-items:center;gap:10px;color:#6b7280;font-size:14px}.birthday strong{color:#263427}.birthday a{color:#389e0d;font-weight:700;text-decoration:none}.birthday a:hover{text-decoration:underline}.menu-card{transition:transform .2s ease}.menu-card:hover{transform:translateY(-2px)}
</style>
