<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { EditPen, Plus, RefreshRight, Search } from '@element-plus/icons-vue'
import { http } from '@/api/request'

type Category = { id: number; code: string; name: string; icon?: string | null; sort_order: number; is_active: boolean }
type ForumPost = {
  id: number
  title: string
  content: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'HIDDEN'
  audit_note?: string | null
  is_pinned: boolean
  created_at: string
  author?: { nickname?: string | null; phone?: string | null }
  category?: Category
  like_count: number
  comment_count: number
}
type ForumComment = {
  id: number
  content: string
  status: 'APPROVED' | 'HIDDEN'
  created_at: string
  author?: { nickname?: string | null }
  post?: { id: number; title: string }
}

const activeTab = ref('posts')
const loading = ref(false)
const categories = ref<Category[]>([])
const posts = ref<ForumPost[]>([])
const comments = ref<ForumComment[]>([])
const postTotal = ref(0)
const commentTotal = ref(0)
const postQuery = reactive({ page: 1, pageSize: 20, status: 'PENDING', categoryId: '', keyword: '' })
const commentQuery = reactive({ page: 1, pageSize: 20, status: 'APPROVED', keyword: '' })
const categoryDialogOpen = ref(false)
const savingCategory = ref(false)
const editingCategoryId = ref<number | null>(null)
const categoryForm = reactive({ code: '', name: '', icon: '', sort_order: 60, is_active: true })

function unwrap(response: any) {
  return response?.data?.data ?? response?.data ?? response ?? {}
}

function errorMessage(error: any) {
  return error?.response?.data?.error || error?.response?.data?.message || error?.message || '操作失败，请稍后重试'
}

function formatTime(value?: string) {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('zh-CN', { hour12: false })
}

function statusText(status: ForumPost['status'] | ForumComment['status']) {
  const map: Record<string, string> = { PENDING: '待审核', APPROVED: '已通过', REJECTED: '已驳回', HIDDEN: '已隐藏' }
  return map[status] || status
}

function statusType(status: string) {
  const map: Record<string, 'warning' | 'success' | 'danger' | 'info'> = { PENDING: 'warning', APPROVED: 'success', REJECTED: 'danger', HIDDEN: 'info' }
  return map[status] || 'info'
}

async function loadCategories() {
  const data = unwrap(await http.get('/admin/forum/categories'))
  categories.value = Array.isArray(data.list) ? data.list : []
}

async function loadPosts() {
  loading.value = true
  try {
    const data = unwrap(await http.get('/admin/forum/posts', {
      params: {
        page: postQuery.page,
        page_size: postQuery.pageSize,
        status: postQuery.status || undefined,
        category_id: postQuery.categoryId || undefined,
        keyword: postQuery.keyword.trim() || undefined,
      },
    }))
    posts.value = Array.isArray(data.list) ? data.list : []
    postTotal.value = Number(data.total || 0)
  } catch (error) {
    ElMessage.error(errorMessage(error))
  } finally {
    loading.value = false
  }
}

async function loadComments() {
  loading.value = true
  try {
    const data = unwrap(await http.get('/admin/forum/comments', {
      params: {
        page: commentQuery.page,
        page_size: commentQuery.pageSize,
        status: commentQuery.status || undefined,
        keyword: commentQuery.keyword.trim() || undefined,
      },
    }))
    comments.value = Array.isArray(data.list) ? data.list : []
    commentTotal.value = Number(data.total || 0)
  } catch (error) {
    ElMessage.error(errorMessage(error))
  } finally {
    loading.value = false
  }
}

async function refreshActiveTab() {
  if (activeTab.value === 'posts') await loadPosts()
  if (activeTab.value === 'comments') await loadComments()
  if (activeTab.value === 'categories') await loadCategories()
}

function resetPostFilters() {
  postQuery.page = 1
  postQuery.status = 'PENDING'
  postQuery.categoryId = ''
  postQuery.keyword = ''
  void loadPosts()
}

async function auditPost(row: ForumPost, action: 'approve' | 'reject' | 'hide') {
  let auditNote = ''
  try {
    if (action === 'reject') {
      const prompt = await ElMessageBox.prompt('请填写驳回原因，该说明会展示给发布者。', '驳回信息', {
        inputType: 'textarea', inputPlaceholder: '例如：信息描述不完整，请补充物品特征', inputValidator: (value) => Boolean(String(value || '').trim()) || '请填写驳回原因',
        confirmButtonText: '确认驳回', cancelButtonText: '取消', closeOnClickModal: false,
      })
      auditNote = String(prompt.value || '').trim()
    } else {
      const copy = action === 'approve' ? '通过后该信息将对校园用户公开展示。' : '隐藏后该信息将不再公开展示。'
      await ElMessageBox.confirm(copy, action === 'approve' ? '通过审核' : '隐藏信息', {
        type: action === 'approve' ? 'success' : 'warning', confirmButtonText: '确认', cancelButtonText: '取消',
      })
    }
    await http.put(`/admin/forum/posts/${row.id}/audit`, { action, audit_note: auditNote })
    ElMessage.success(action === 'approve' ? '已通过审核' : action === 'reject' ? '已驳回' : '已隐藏')
    await loadPosts()
  } catch (error: any) {
    if (error === 'cancel' || error === 'close') return
    ElMessage.error(errorMessage(error))
  }
}

function openCreateCategory() {
  editingCategoryId.value = null
  Object.assign(categoryForm, { code: '', name: '', icon: '', sort_order: Math.max(10, categories.value.length * 10 + 10), is_active: true })
  categoryDialogOpen.value = true
}

function openEditCategory(row: Category) {
  editingCategoryId.value = row.id
  Object.assign(categoryForm, { code: row.code, name: row.name, icon: row.icon || '', sort_order: row.sort_order, is_active: row.is_active })
  categoryDialogOpen.value = true
}

async function saveCategory() {
  if (!categoryForm.name.trim()) return ElMessage.warning('请填写分类名称')
  if (!editingCategoryId.value && !categoryForm.code.trim()) return ElMessage.warning('请填写分类编码')
  savingCategory.value = true
  try {
    const payload = { ...categoryForm, code: categoryForm.code.trim(), name: categoryForm.name.trim(), icon: categoryForm.icon.trim() }
    if (editingCategoryId.value) await http.put(`/admin/forum/categories/${editingCategoryId.value}`, payload)
    else await http.post('/admin/forum/categories', payload)
    ElMessage.success(editingCategoryId.value ? '分类已更新' : '分类已创建')
    categoryDialogOpen.value = false
    await loadCategories()
  } catch (error) {
    ElMessage.error(errorMessage(error))
  } finally {
    savingCategory.value = false
  }
}

async function deactivateCategory(row: Category) {
  try {
    await ElMessageBox.confirm(`停用“${row.name}”后，用户将不能再选择该分类；历史信息仍会保留。`, '停用分类', {
      type: 'warning', confirmButtonText: '确认停用', cancelButtonText: '取消',
    })
    await http.delete(`/admin/forum/categories/${row.id}`)
    ElMessage.success('分类已停用')
    await loadCategories()
  } catch (error: any) {
    if (error === 'cancel' || error === 'close') return
    ElMessage.error(errorMessage(error))
  }
}

async function updateCategoryStatus(row: Category) {
  try {
    await http.put(`/admin/forum/categories/${row.id}`, { is_active: row.is_active })
    ElMessage.success(row.is_active ? '分类已启用' : '分类已停用')
  } catch (error) {
    row.is_active = !row.is_active
    ElMessage.error(errorMessage(error))
  }
}

async function hideComment(row: ForumComment) {
  try {
    await ElMessageBox.confirm('隐藏后，该评论不再对普通用户展示。', '隐藏评论', {
      type: 'warning', confirmButtonText: '确认隐藏', cancelButtonText: '取消',
    })
    await http.put(`/admin/forum/comments/${row.id}/hide`)
    ElMessage.success('评论已隐藏')
    await loadComments()
  } catch (error: any) {
    if (error === 'cancel' || error === 'close') return
    ElMessage.error(errorMessage(error))
  }
}

onMounted(async () => {
  await Promise.all([loadCategories(), loadPosts()])
})
</script>

<template>
  <section class="forum-moderation">
    <header class="page-heading">
      <div>
        <span class="eyebrow">CAMPUS SQUARE · MODERATION</span>
        <h2>信息广场治理</h2>
        <p>审核校园信息，维护分类，并处理不当评论。</p>
      </div>
      <el-button :icon="RefreshRight" :loading="loading" @click="refreshActiveTab">刷新</el-button>
    </header>

    <el-tabs v-model="activeTab" class="forum-tabs" @tab-change="refreshActiveTab">
      <el-tab-pane label="信息审核" name="posts">
        <section class="work-panel">
          <div class="filter-bar">
            <el-select v-model="postQuery.status" clearable placeholder="审核状态" @change="postQuery.page = 1; loadPosts()">
              <el-option label="待审核" value="PENDING" /><el-option label="已通过" value="APPROVED" />
              <el-option label="已驳回" value="REJECTED" /><el-option label="已隐藏" value="HIDDEN" />
            </el-select>
            <el-select v-model="postQuery.categoryId" clearable placeholder="全部分类" @change="postQuery.page = 1; loadPosts()">
              <el-option v-for="category in categories" :key="category.id" :label="`${category.icon || ''} ${category.name}`" :value="String(category.id)" />
            </el-select>
            <el-input v-model="postQuery.keyword" clearable placeholder="搜索标题、正文或发布者" @keyup.enter="postQuery.page = 1; loadPosts()">
              <template #prefix><el-icon><Search /></el-icon></template>
            </el-input>
            <el-button type="primary" @click="postQuery.page = 1; loadPosts()">查询</el-button>
            <el-button text @click="resetPostFilters">重置</el-button>
          </div>
          <el-table :data="posts" v-loading="loading" class="data-table">
            <el-table-column prop="id" label="ID" width="76" />
            <el-table-column label="分类" width="128"><template #default="{ row }"><el-tag effect="plain">{{ row.category?.icon }} {{ row.category?.name || '-' }}</el-tag></template></el-table-column>
            <el-table-column label="信息内容" min-width="320">
              <template #default="{ row }"><div class="post-cell"><strong>{{ row.title }}</strong><span>{{ row.content }}</span></div></template>
            </el-table-column>
            <el-table-column label="发布者" width="130"><template #default="{ row }">{{ row.author?.nickname || row.author?.phone || '-' }}</template></el-table-column>
            <el-table-column label="互动" width="105"><template #default="{ row }">赞 {{ row.like_count }} · 评 {{ row.comment_count }}</template></el-table-column>
            <el-table-column label="状态" width="105"><template #default="{ row }"><el-tag :type="statusType(row.status)">{{ statusText(row.status) }}</el-tag></template></el-table-column>
            <el-table-column label="提交时间" width="172"><template #default="{ row }">{{ formatTime(row.created_at) }}</template></el-table-column>
            <el-table-column label="操作" width="200" fixed="right">
              <template #default="{ row }">
                <div class="table-actions">
                  <el-button v-if="row.status === 'PENDING'" type="success" link @click="auditPost(row, 'approve')">通过</el-button>
                  <el-button v-if="row.status === 'PENDING'" type="danger" link @click="auditPost(row, 'reject')">驳回</el-button>
                  <el-button v-if="row.status === 'APPROVED'" type="warning" link @click="auditPost(row, 'hide')">隐藏</el-button>
                  <span v-if="row.status !== 'PENDING' && row.status !== 'APPROVED'" class="muted-action">已处理</span>
                </div>
              </template>
            </el-table-column>
          </el-table>
          <div class="pagination-row"><el-pagination v-model:current-page="postQuery.page" :page-size="postQuery.pageSize" :total="postTotal" layout="total, prev, pager, next" @current-change="loadPosts" /></div>
        </section>
      </el-tab-pane>

      <el-tab-pane label="分类管理" name="categories">
        <section class="work-panel">
          <div class="panel-toolbar"><span>停用分类不会影响已发布的信息。</span><el-button type="primary" :icon="Plus" @click="openCreateCategory">新增分类</el-button></div>
          <el-table :data="categories" v-loading="loading" class="data-table">
            <el-table-column prop="sort_order" label="排序" width="90" /><el-table-column prop="code" label="编码" width="170" />
            <el-table-column label="分类名称" min-width="180"><template #default="{ row }"><span class="category-name">{{ row.icon || '◉' }} {{ row.name }}</span></template></el-table-column>
            <el-table-column label="状态" width="110"><template #default="{ row }"><el-switch v-model="row.is_active" @change="updateCategoryStatus(row)" /></template></el-table-column>
            <el-table-column label="操作" width="180" fixed="right"><template #default="{ row }"><el-button :icon="EditPen" link type="primary" @click="openEditCategory(row)">编辑</el-button><el-button v-if="row.is_active" link type="danger" @click="deactivateCategory(row)">停用</el-button></template></el-table-column>
          </el-table>
        </section>
      </el-tab-pane>

      <el-tab-pane label="评论治理" name="comments">
        <section class="work-panel">
          <div class="filter-bar">
            <el-select v-model="commentQuery.status" clearable placeholder="评论状态" @change="commentQuery.page = 1; loadComments()"><el-option label="正常" value="APPROVED" /><el-option label="已隐藏" value="HIDDEN" /></el-select>
            <el-input v-model="commentQuery.keyword" clearable placeholder="搜索评论或用户" @keyup.enter="commentQuery.page = 1; loadComments()"><template #prefix><el-icon><Search /></el-icon></template></el-input>
            <el-button type="primary" @click="commentQuery.page = 1; loadComments()">查询</el-button>
          </div>
          <el-table :data="comments" v-loading="loading" class="data-table">
            <el-table-column prop="id" label="ID" width="76" /><el-table-column label="评论内容" min-width="320"><template #default="{ row }"><div class="post-cell"><strong>{{ row.post?.title || `信息 #${row.post?.id || '-'}` }}</strong><span>{{ row.content }}</span></div></template></el-table-column>
            <el-table-column label="评论者" width="135"><template #default="{ row }">{{ row.author?.nickname || '-' }}</template></el-table-column>
            <el-table-column label="状态" width="100"><template #default="{ row }"><el-tag :type="statusType(row.status)">{{ statusText(row.status) }}</el-tag></template></el-table-column>
            <el-table-column label="时间" width="172"><template #default="{ row }">{{ formatTime(row.created_at) }}</template></el-table-column>
            <el-table-column label="操作" width="100" fixed="right"><template #default="{ row }"><el-button v-if="row.status === 'APPROVED'" type="danger" link @click="hideComment(row)">隐藏</el-button><span v-else class="muted-action">已处理</span></template></el-table-column>
          </el-table>
          <div class="pagination-row"><el-pagination v-model:current-page="commentQuery.page" :page-size="commentQuery.pageSize" :total="commentTotal" layout="total, prev, pager, next" @current-change="loadComments" /></div>
        </section>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="categoryDialogOpen" :title="editingCategoryId ? '编辑分类' : '新增分类'" width="480px" destroy-on-close>
      <el-form label-position="top">
        <el-form-item label="分类编码" required><el-input v-model="categoryForm.code" :disabled="Boolean(editingCategoryId)" placeholder="例如 LOST_FOUND" /></el-form-item>
        <el-form-item label="分类名称" required><el-input v-model="categoryForm.name" placeholder="例如 失物招领" /></el-form-item>
        <div class="form-grid"><el-form-item label="图标"><el-input v-model="categoryForm.icon" placeholder="🔎" /></el-form-item><el-form-item label="排序"><el-input-number v-model="categoryForm.sort_order" :min="0" :max="9999" /></el-form-item></div>
        <el-form-item v-if="editingCategoryId" label="启用状态"><el-switch v-model="categoryForm.is_active" active-text="启用" inactive-text="停用" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="categoryDialogOpen = false">取消</el-button><el-button type="primary" :loading="savingCategory" @click="saveCategory">保存</el-button></template>
    </el-dialog>
  </section>
</template>

<style scoped>
.forum-moderation { display: grid; gap: 20px; }.page-heading { display: flex; align-items: end; justify-content: space-between; gap: 20px; padding-bottom: 18px; border-bottom: 1px solid var(--color-border); }.eyebrow { color: var(--color-primary); font-size: 11px; font-weight: 850; letter-spacing: .1em; }.page-heading h2 { margin: 6px 0 3px; color: var(--color-navy); font-size: 26px; letter-spacing: -.04em; }.page-heading p { margin: 0; color: var(--color-text-muted); font-size: 13px; }.forum-tabs :deep(.el-tabs__header) { margin-bottom: 14px; }.forum-tabs :deep(.el-tabs__item) { font-weight: 720; }.work-panel { border: 1px solid var(--color-border); border-radius: var(--radius-card); padding: 18px; background: var(--color-surface); box-shadow: var(--shadow-sm); }.filter-bar, .panel-toolbar { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }.filter-bar :deep(.el-select) { width: 132px; }.filter-bar :deep(.el-input) { width: min(320px, 100%); }.panel-toolbar { justify-content: space-between; color: var(--color-text-muted); font-size: 13px; }.data-table :deep(.el-table__header th) { background: var(--color-fill); color: var(--color-text-secondary); font-weight: 750; }.post-cell { display: grid; gap: 4px; max-width: 440px; }.post-cell strong, .post-cell span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.post-cell strong { color: var(--color-navy); font-size: 13px; }.post-cell span { color: var(--color-text-muted); font-size: 12px; }.table-actions { display: flex; align-items: center; gap: 8px; }.muted-action { color: var(--color-text-muted); font-size: 12px; }.pagination-row { display: flex; justify-content: flex-end; margin-top: 18px; }.category-name { color: var(--color-navy); font-weight: 700; }.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; } @media (max-width: 720px) { .page-heading { align-items: flex-start; flex-direction: column; }.filter-bar { flex-wrap: wrap; }.filter-bar :deep(.el-input) { width: 100%; }.panel-toolbar { align-items: flex-start; flex-direction: column; } }
</style>
