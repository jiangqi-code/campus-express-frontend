<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { http } from '@/api/request'

type Category={id:number;name:string;icon?:string|null}
const router=useRouter(),categories=ref<Category[]>([]),saving=ref(false)
const form=reactive({category_id:'',title:'',content:'',location_name:''})
const data=(r:any)=>r?.data?.data??r?.data??r??{}
async function load(){try{const result=data(await http.get('/forum/categories'));categories.value=Array.isArray(result.list)?result.list:[];form.category_id=String(categories.value[0]?.id||'')}catch(error:any){ElMessage.error(error?.response?.data?.error||error.message||'分类加载失败')}}
async function submit(){if(!form.category_id)return ElMessage.warning('请选择信息分类');if(form.title.trim().length<2)return ElMessage.warning('标题至少需要 2 个字符');if(form.content.trim().length<5)return ElMessage.warning('正文至少需要 5 个字符');saving.value=true;try{await http.post('/forum/posts',{category_id:Number(form.category_id),title:form.title.trim(),content:form.content.trim(),location_name:form.location_name.trim()||undefined});ElMessage.success('已提交审核，通过后将在广场公开展示');router.replace('/forum')}catch(error:any){ElMessage.error(error?.response?.data?.error||error.message||'发布失败')}finally{saving.value=false}}
onMounted(load)
</script>

<template><section class="publish"><header><span>CAMPUS SQUARE · PUBLISH</span><h2>发布校园信息</h2><p>请遵守校园社区规范。提交后将由管理员审核。</p></header><section class="form-card"><el-alert title="文字信息可直接发布；如需配图，请使用小程序端发布。" type="info" :closable="false" show-icon/><el-form label-position="top"><el-form-item label="信息分类" required><el-select v-model="form.category_id" placeholder="请选择分类"><el-option v-for="category in categories" :key="category.id" :label="category.name" :value="String(category.id)"/></el-select></el-form-item><el-form-item label="标题" required><el-input v-model="form.title" maxlength="100" show-word-limit placeholder="一句话说清楚你要发布什么"/></el-form-item><el-form-item label="正文" required><el-input v-model="form.content" type="textarea" :rows="8" maxlength="2000" show-word-limit placeholder="补充物品特征、交易方式、价格或你想说的话"/></el-form-item><el-form-item label="地点（选填）"><el-input v-model="form.location_name" maxlength="120" placeholder="例如：图书馆一楼、北区宿舍楼下"/></el-form-item></el-form><div class="actions"><el-button @click="router.back()">取消</el-button><el-button type="primary" :loading="saving" @click="submit">提交审核</el-button></div></section></section></template>

<style scoped>.publish{display:grid;gap:20px;max-width:800px}.publish header{padding-bottom:18px;border-bottom:1px solid var(--color-border)}.publish header span{color:var(--color-primary);font-size:11px;font-weight:800;letter-spacing:.1em}.publish h2{margin:6px 0 4px;color:var(--color-navy);font-size:27px}.publish p{margin:0;color:var(--color-text-muted)}.form-card{display:grid;gap:20px;border:1px solid var(--color-border);border-radius:var(--radius-card);padding:22px;background:var(--color-surface);box-shadow:var(--shadow-sm)}.actions{display:flex;justify-content:flex-end;gap:10px}</style>
