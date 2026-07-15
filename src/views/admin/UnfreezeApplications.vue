<template>
  <div class="p-4">
    <div class="d-flex justify-content-between align-items-center mb-4">
      <h2 class="h4 mb-0">解封审核</h2>
      <el-button @click="fetchData" :icon="RefreshRight">刷新</el-button>
    </div>

    <el-card shadow="never">
      <el-table :data="applications" v-loading="loading" stripe>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="user.nickname" label="申请人" width="120" />
        <el-table-column prop="user.student_id" label="学号" width="140" />
        <el-table-column prop="user.phone" label="手机号" width="130" />
        <el-table-column prop="reason" label="申请理由" min-width="200" show-overflow-tooltip />
        <el-table-column prop="contact" label="联系方式" width="130" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">{{ getStatusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="申请时间" width="170">
          <template #default="{ row }">{{ formatTime(row.created_at) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <template v-if="row.status === 'PENDING'">
              <el-button type="success" size="small" @click="handleApprove(row)">通过</el-button>
              <el-button type="danger" size="small" @click="handleReject(row)">拒绝</el-button>
            </template>
            <span v-else class="text-muted">已处理</span>
          </template>
        </el-table-column>
      </el-table>

      <div class="mt-4 d-flex justify-content-end">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :total="total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next"
          @current-change="fetchData"
          @size-change="fetchData"
        />
      </div>
    </el-card>

    <!-- 拒绝弹窗 -->
    <el-dialog v-model="rejectDialogVisible" title="拒绝解封" width="400px">
      <el-input
        v-model="rejectNote"
        type="textarea"
        rows="3"
        placeholder="请填写拒绝原因（选填）"
      />
      <template #footer>
        <el-button @click="rejectDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="processing" @click="confirmReject">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { RefreshRight } from '@element-plus/icons-vue'
import { http } from '@/api/request'

const loading = ref(false)
const applications = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const processing = ref(false)
const rejectDialogVisible = ref(false)
const rejectNote = ref('')
const currentApplication = ref<any>(null)

function formatTime(time: string) {
  if (!time) return '-'
  return new Date(time).toLocaleString()
}

function getStatusType(status: string) {
  if (status === 'PENDING') return 'warning'
  if (status === 'APPROVED') return 'success'
  return 'danger'
}

function getStatusText(status: string) {
  if (status === 'PENDING') return '待审核'
  if (status === 'APPROVED') return '已通过'
  return '已拒绝'
}

async function fetchData() {
  loading.value = true
  try {
    const res = await http.get('/admin/unfreeze-applications', {
      params: { page: page.value, pageSize: pageSize.value }
    })
    applications.value = res.data.items
    total.value = res.data.total
  } catch (err) {
    ElMessage.error('加载失败')
  } finally {
    loading.value = false
  }
}

async function handleApprove(row: any) {
  try {
    await ElMessageBox.confirm(`确定通过用户「${row.user.nickname}」的解封申请吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await http.post(`/admin/unfreeze-applications/${row.id}/process`, { action: 'approve' })
    ElMessage.success('已通过，用户已解封')
    fetchData()
  } catch (err) {
    if (err !== 'cancel') ElMessage.error('操作失败')
  }
}

function handleReject(row: any) {
  currentApplication.value = row
  rejectNote.value = ''
  rejectDialogVisible.value = true
}

async function confirmReject() {
  processing.value = true
  try {
    await http.post(`/admin/unfreeze-applications/${currentApplication.value.id}/process`, {
      action: 'reject',
      admin_note: rejectNote.value
    })
    ElMessage.success('已拒绝')
    rejectDialogVisible.value = false
    fetchData()
  } catch (err) {
    ElMessage.error('操作失败')
  } finally {
    processing.value = false
  }
}

onMounted(() => {
  fetchData()
})
</script>