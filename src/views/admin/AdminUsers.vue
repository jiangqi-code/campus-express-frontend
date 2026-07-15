<template>
  <div class="p-4">
    <div class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
      <div>
        <h2 class="h4 mb-1">用户管理</h2>
        <p class="text-muted small mb-0">查看、搜索、冻结/解封用户账户</p>
      </div>
      <div class="d-flex gap-2 flex-wrap">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索昵称/学号/手机号"
          clearable
          style="width: 220px"
          @clear="handleSearch"
          @keyup.enter="handleSearch"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
        <el-select v-model="roleFilter" placeholder="角色筛选" clearable style="width: 100px" @change="handleSearch">
          <el-option label="全部" value="" />
          <el-option label="用户" value="USER" />
          <el-option label="跑腿员" value="RUNNER" />
          <el-option label="管理员" value="ADMIN" />
        </el-select>
        <el-select v-model="statusFilter" placeholder="状态筛选" clearable style="width: 100px" @change="handleSearch">
          <el-option label="全部" value="" />
          <el-option label="正常" value="1" />
          <el-option label="冻结" value="0" />
        </el-select>
        <el-button @click="fetchUsers" :icon="RefreshRight">刷新</el-button>
      </div>
    </div>

    <el-card shadow="never" class="border">
      <el-table :data="users" v-loading="loading" stripe style="width: 100%" :row-style="{ height: '56px' }">
        <el-table-column prop="id" label="ID" width="60" align="center" fixed="left" />
        
        <el-table-column prop="nickname" label="昵称" width="140" fixed="left">
          <template #default="{ row }">
            <div class="d-flex align-items-center gap-2">
              <el-avatar :size="32" :src="row.avatar" />
              <span class="fw-semibold text-truncate" style="max-width: 100px">{{ row.nickname || '-' }}</span>
            </div>
          </template>
        </el-table-column>
        
        <el-table-column prop="student_id" label="学号" width="150">
          <template #default="{ row }">
            <span class="text-muted">{{ row.student_id || '-' }}</span>
          </template>
        </el-table-column>
        
        <el-table-column prop="phone" label="手机号" width="140">
          <template #default="{ row }">
            <span class="text-muted">{{ row.phone || '-' }}</span>
          </template>
        </el-table-column>
        
        <el-table-column prop="role" label="角色" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="getRoleType(row.role)" size="small">
              {{ getRoleLabel(row.role) }}
            </el-tag>
          </template>
        </el-table-column>
        
        <el-table-column prop="status" label="状态" width="70" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'danger'" size="small">
              {{ row.status === 1 ? '正常' : '冻结' }}
            </el-tag>
          </template>
        </el-table-column>
        
        <el-table-column prop="credit_score" label="信用分" width="80" align="center">
          <template #default="{ row }">
            <span :class="getCreditClass(row.credit_score)">{{ row.credit_score || 0 }}</span>
          </template>
        </el-table-column>
        
        <el-table-column prop="created_at" label="注册时间" width="150">
          <template #default="{ row }">
            <span class="text-muted small">{{ formatDateTime(row.created_at) }}</span>
          </template>
        </el-table-column>
        
        <el-table-column label="操作" width="160" align="center" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="row.role !== 'ADMIN'"
              :type="row.status === 1 ? 'warning' : 'success'"
              size="small"
              @click="toggleStatus(row)"
            >
              {{ row.status === 1 ? '冻结' : '解封' }}
            </el-button>
            <el-button
              type="danger"
              size="small"
              plain
              @click="resetPassword(row)"
            >
              重置密码
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="d-flex justify-content-end mt-4">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :total="pagination.total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          @current-change="fetchUsers"
          @size-change="handleSizeChange"
        />
      </div>
    </el-card>

    <!-- 重置密码弹窗 -->
    <el-dialog v-model="resetDialogVisible" title="重置密码" width="400px">
      <el-form :model="resetForm" label-width="100px">
        <el-form-item label="新密码">
          <el-input v-model="resetForm.password" type="password" placeholder="请输入新密码" />
        </el-form-item>
        <el-form-item label="确认密码">
          <el-input v-model="resetForm.confirmPassword" type="password" placeholder="请再次输入新密码" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="resetDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="resetLoading" @click="confirmResetPassword">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, RefreshRight } from '@element-plus/icons-vue'
import { http } from '@/api/request'

interface User {
  id: number
  nickname: string
  student_id: string
  phone: string
  role: string
  status: number
  credit_score: number
  avatar: string
  created_at: string
}

const loading = ref(false)
const users = ref<User[]>([])
const searchKeyword = ref('')
const roleFilter = ref('')
const statusFilter = ref('')
const resetDialogVisible = ref(false)
const resetLoading = ref(false)
const currentResetUser = ref<User | null>(null)
const resetForm = ref({
  password: '',
  confirmPassword: ''
})

const pagination = ref({
  page: 1,
  pageSize: 20,
  total: 0,
})

function formatDateTime(dateStr: string) {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getRoleType(role: string) {
  const r = role?.toUpperCase()
  if (r === 'ADMIN') return 'danger'
  if (r === 'RUNNER') return 'success'
  return 'info'
}

function getRoleLabel(role: string) {
  const r = role?.toUpperCase()
  if (r === 'ADMIN') return '管理员'
  if (r === 'RUNNER') return '跑腿员'
  return '普通用户'
}

function getCreditClass(score: number) {
  if (score >= 800) return 'text-success fw-semibold'
  if (score >= 600) return 'text-info'
  if (score >= 300) return 'text-warning'
  return 'text-danger'
}

async function fetchUsers() {
  loading.value = true
  try {
    const params: any = {
      page: pagination.value.page,
      pageSize: pagination.value.pageSize,
    }
    if (searchKeyword.value) {
      params.keyword = searchKeyword.value
    }
    if (roleFilter.value) {
      params.role = roleFilter.value
    }
    if (statusFilter.value) {
      params.status = statusFilter.value
    }
    
    const res = await http.get('/admin/users', { params })
    const data = res.data
    
    users.value = data.items || data.list || []
    pagination.value.total = data.total || 0
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.message || '加载用户列表失败')
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  pagination.value.page = 1
  fetchUsers()
}

function handleSizeChange() {
  pagination.value.page = 1
  fetchUsers()
}

async function toggleStatus(user: User) {
  const action = user.status === 1 ? 'freeze' : 'unfreeze'
  const actionText = user.status === 1 ? '冻结' : '解封'
  try {
    await ElMessageBox.confirm(`确定要${actionText}用户「${user.nickname}」吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    })
    
    // 方式1：直接使用 fetch
    const token = localStorage.getItem('ce_token')
    const res = await fetch(`http://localhost:3000/api/admin/users/${user.id}/freeze`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ action })
    })
    const data = await res.json()
    
    if (res.ok) {
      ElMessage.success(`${actionText}成功`)
      fetchUsers()
    } else {
      ElMessage.error(data?.error || `${actionText}失败`)
    }
  } catch (err: any) {
    if (err !== 'cancel') {
      ElMessage.error(err?.message || `${actionText}失败`)
    }
  }
}

function resetPassword(user: User) {
  currentResetUser.value = user
  resetForm.value = { password: '', confirmPassword: '' }
  resetDialogVisible.value = true
}

async function confirmResetPassword() {
  if (!resetForm.value.password) {
    ElMessage.warning('请输入新密码')
    return
  }
  if (resetForm.value.password !== resetForm.value.confirmPassword) {
    ElMessage.warning('两次输入的密码不一致')
    return
  }
  if (resetForm.value.password.length < 6) {
    ElMessage.warning('密码长度不能少于6位')
    return
  }
  
  resetLoading.value = true
  try {
    await http.put(`/admin/users/${currentResetUser.value?.id}/reset-password`, {
      password: resetForm.value.password,
    })
    ElMessage.success('密码重置成功')
    resetDialogVisible.value = false
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.message || '密码重置失败')
  } finally {
    resetLoading.value = false
  }
}

onMounted(() => {
  fetchUsers()
})
</script>

<style scoped>
:deep(.el-table th) {
  background-color: #f8fafc;
  font-weight: 600;
  color: #1e293b;
}

:deep(.el-table .cell) {
  white-space: nowrap;
}

.text-truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.text-success {
  color: #10b981;
}

.text-info {
  color: #3b82f6;
}

.text-warning {
  color: #f59e0b;
}

.text-danger {
  color: #ef4444;
}
</style>