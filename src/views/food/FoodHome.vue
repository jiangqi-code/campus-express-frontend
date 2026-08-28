<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { http } from '@/api/request'
import { imageUrl } from '@/api/upload'

const router = useRouter()
const loading = ref(false)
const keyword = ref('')
const merchants = ref<any[]>([])
const visible = computed(() => merchants.value.filter((shop) => !keyword.value.trim() || `${shop.name}${shop.address}${shop.description || ''}`.includes(keyword.value.trim())))
const data = (result: any) => result?.data?.data ?? result?.data ?? result ?? {}

async function load() {
  loading.value = true
  try {
    const result = data(await http.get('/food/merchants', { params: { page: 1, page_size: 50 } }))
    merchants.value = Array.isArray(result.list) ? result.list : []
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.error || error.message || '商家加载失败')
  } finally { loading.value = false }
}

onMounted(load)
</script>

<template>
  <section class="food-home">
    <header><div><h2>校园食堂点餐</h2><p>从商家菜单直接下单，跑腿员为你配送到楼下。</p></div><el-button :loading="loading" @click="load">刷新商家</el-button></header>
    <el-input v-model="keyword" clearable placeholder="搜索食堂、档口或菜品" class="search" />
    <div v-loading="loading" class="shops">
      <el-empty v-if="!loading && !visible.length" description="暂无营业商家" />
      <article v-for="shop in visible" :key="shop.id" tabindex="0" @click="router.push(`/food/merchant/${shop.id}`)" @keyup.enter="router.push(`/food/merchant/${shop.id}`)">
        <div class="cover"><img v-if="shop.cover_image || shop.logo" :src="imageUrl(shop.cover_image || shop.logo)" :alt="`${shop.name} 门头照片`" /><span v-else>{{ shop.name.slice(0, 1) }}</span></div>
        <div class="shop-copy"><h3>{{ shop.name }} <el-tag size="small" type="success">营业中</el-tag></h3><p>{{ shop.description || shop.address }}</p><small>起送 ¥{{ Number(shop.min_order_amount || 0).toFixed(0) }} · 预计 {{ shop.prepare_minutes || 15 }} 分钟 · {{ shop.menu_item_count || 0 }} 道菜</small></div>
        <b class="arrow" aria-hidden="true">›</b>
      </article>
    </div>
  </section>
</template>

<style scoped>
.food-home { display: grid; gap: 20px; }.food-home header { display: flex; align-items: end; justify-content: space-between; gap: 16px; padding: 10px 0 20px; border-bottom: 1px solid var(--color-border); }.food-home h2 { margin: 0 0 5px; color: var(--color-navy); font-size: 27px; }.food-home p { margin: 0; color: var(--color-text-muted); }.search { max-width: 440px; }.shops { display: grid; min-height: 250px; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); gap: 16px; }.shops article { display: flex; align-items: center; gap: 14px; border: 1px solid var(--color-border); border-radius: var(--radius-card); padding: 16px; background: var(--color-surface); cursor: pointer; transition: border-color var(--transition-fast), transform var(--transition-fast); }.shops article:hover, .shops article:focus-visible { border-color: var(--color-primary); outline: 0; transform: translateY(-1px); }.cover { display: grid; width: 68px; height: 68px; flex: 0 0 68px; overflow: hidden; place-items: center; border-radius: 8px; background: var(--color-primary-soft); color: var(--color-primary-active); font-size: 26px; font-weight: 800; }.cover img { width: 100%; height: 100%; object-fit: cover; }.shop-copy { min-width: 0; flex: 1; }.shops h3 { overflow: hidden; margin: 0; color: var(--color-navy); font-size: 16px; text-overflow: ellipsis; white-space: nowrap; }.shops p { overflow: hidden; margin: 7px 0; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; }.shops small { color: var(--color-text-muted); font-size: 12px; }.arrow { color: var(--color-primary); font-size: 24px; font-weight: 500; } @media (max-width: 640px) { .food-home header { align-items: start; flex-direction: column; gap: 14px; } }
</style>
