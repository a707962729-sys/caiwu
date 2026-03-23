<template>
  <div class="leave-page">
    <!-- 统计卡片 -->
    <div class="stats-card">
      <div class="stat-item" v-for="stat in leaveStats" :key="stat.type">
        <div class="stat-value">{{ stat.days }}天</div>
        <div class="stat-label">{{ getLeaveTypeText(stat.type) }}</div>
      </div>
    </div>

    <!-- 操作栏 -->
    <div class="action-bar">
      <van-button type="primary" size="small" @click="showApply = true">
        申请请假
      </van-button>
    </div>

    <!-- 筛选 -->
    <div class="filter-bar">
      <van-dropdown-menu>
        <van-dropdown-item v-model="filterStatus" :options="statusOptions" @change="loadData" />
      </van-dropdown-menu>
    </div>

    <!-- 请假列表 -->
    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <van-list
        v-model:loading="loading"
        :finished="finished"
        finished-text="没有更多了"
        @load="loadData"
      >
        <div class="leave-item" v-for="item in list" :key="item.id">
          <div class="item-header">
            <span class="user">{{ item.user_name }}</span>
            <van-tag :type="getStatusType(item.status)">{{ getStatusText(item.status) }}</van-tag>
          </div>
          <div class="item-body">
            <div class="info-row">
              <span class="label">类型：</span>
              <span class="value">{{ getLeaveTypeText(item.leave_type) }}</span>
            </div>
            <div class="info-row">
              <span class="label">日期：</span>
              <span class="value">{{ item.start_date }} ~ {{ item.end_date }}</span>
            </div>
            <div class="info-row">
              <span class="label">天数：</span>
              <span class="value">{{ item.days }}天</span>
            </div>
            <div class="info-row" v-if="item.reason">
              <span class="label">原因：</span>
              <span class="value">{{ item.reason }}</span>
            </div>
          </div>
          <!-- 审批按钮（管理员） -->
          <div class="item-actions" v-if="canApprove && item.status === 'pending'">
            <van-button size="small" type="primary" @click="approve(item.id, 'approve')">
              批准
            </van-button>
            <van-button size="small" type="danger" @click="showReject(item)">
              拒绝
            </van-button>
          </div>
        </div>
      </van-list>
    </van-pull-refresh>

    <!-- 申请弹窗 -->
    <van-popup v-model:show="showApply" position="bottom" round>
      <div class="apply-form">
        <h3>请假申请</h3>
        <van-form @submit="submitApply">
          <van-field
            name="leave_type"
            label="请假类型"
            required
          >
            <template #input>
              <van-radio-group v-model="applyForm.leave_type" direction="horizontal">
                <van-radio name="annual">年假</van-radio>
                <van-radio name="sick">病假</van-radio>
                <van-radio name="personal">事假</van-radio>
              </van-radio-group>
            </template>
          </van-field>
          <van-field
            v-model="applyForm.start_date"
            is-link
            readonly
            label="开始日期"
            placeholder="选择日期"
            @click="showStartDate = true"
            required
          />
          <van-calendar v-model:show="showStartDate" @confirm="onStartDateConfirm" />
          <van-field
            v-model="applyForm.end_date"
            is-link
            readonly
            label="结束日期"
            placeholder="选择日期"
            @click="showEndDate = true"
            required
          />
          <van-calendar v-model:show="showEndDate" @confirm="onEndDateConfirm" />
          <van-field
            v-model="applyForm.days"
            type="number"
            label="请假天数"
            required
          />
          <van-field
            v-model="applyForm.reason"
            rows="2"
            autosize
            label="请假原因"
            type="textarea"
            placeholder="请输入请假原因"
          />
          <div style="margin: 16px;">
            <van-button round block type="primary" native-type="submit">
              提交申请
            </van-button>
          </div>
        </van-form>
      </div>
    </van-popup>

    <!-- 拒绝原因弹窗 -->
    <van-dialog
      v-model:show="showRejectDialog"
      title="拒绝原因"
      show-cancel-button
      @confirm="confirmReject"
    >
      <van-field
        v-model="rejectReason"
        placeholder="请输入拒绝原因"
      />
    </van-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { showToast, showSuccessToast } from 'vant'
import request from '@/utils/request'

const userRole = computed(() => {
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  return user.role
})

const canApprove = computed(() => ['boss', 'accountant'].includes(userRole.value))

const list = ref([])
const loading = ref(false)
const finished = ref(false)
const refreshing = ref(false)
const page = ref(1)

const filterStatus = ref('')
const statusOptions = [
  { text: '全部状态', value: '' },
  { text: '待审批', value: 'pending' },
  { text: '已批准', value: 'approved' },
  { text: '已拒绝', value: 'rejected' }
]

const leaveStats = ref([])

const showApply = ref(false)
const showStartDate = ref(false)
const showEndDate = ref(false)
const applyForm = ref({
  leave_type: 'personal',
  start_date: '',
  end_date: '',
  days: 1,
  reason: ''
})

const showRejectDialog = ref(false)
const rejectReason = ref('')
const rejectItem = ref<any>(null)

const getStatusType = (status: string) => {
  const types: Record<string, string> = {
    pending: 'warning',
    approved: 'success',
    rejected: 'danger',
    cancelled: 'default'
  }
  return types[status] || 'default'
}

const getStatusText = (status: string) => {
  const texts: Record<string, string> = {
    pending: '待审批',
    approved: '已批准',
    rejected: '已拒绝',
    cancelled: '已取消'
  }
  return texts[status] || status
}

const getLeaveTypeText = (type: string) => {
  const texts: Record<string, string> = {
    annual: '年假',
    sick: '病假',
    personal: '事假',
    maternity: '产假',
    paternity: '陪产假',
    other: '其他'
  }
  return texts[type] || type
}

const loadData = async () => {
  if (refreshing.value) {
    list.value = []
    page.value = 1
    finished.value = false
    refreshing.value = false
  }

  try {
    const params: any = { page: page.value, pageSize: 20 }
    if (filterStatus.value) params.status = filterStatus.value

    const res = await request.get('/api/leave-requests', { params })
    if (res.data.success) {
      list.value = [...list.value, ...res.data.data.list]
      if (res.data.data.list.length < 20) finished.value = true
      page.value++
    }
  } catch (e) {
    showToast('加载失败')
  } finally {
    loading.value = false
  }
}

const loadStats = async () => {
  try {
    const year = new Date().getFullYear()
    const res = await request.get('/api/leave-requests/stats', { params: { year } })
    if (res.data.success) {
      leaveStats.value = res.data.data || []
    }
  } catch (e) {
    console.error('加载统计失败')
  }
}

const onStartDateConfirm = (date: Date) => {
  applyForm.value.start_date = date.toISOString().split('T')[0]
  showStartDate.value = false
}

const onEndDateConfirm = (date: Date) => {
  applyForm.value.end_date = date.toISOString().split('T')[0]
  showEndDate.value = false
}

const submitApply = async () => {
  if (!applyForm.value.start_date || !applyForm.value.end_date) {
    showToast('请选择日期')
    return
  }

  try {
    const res = await request.post('/api/leave-requests', applyForm.value)
    if (res.data.success) {
      showSuccessToast('申请已提交')
      showApply.value = false
      applyForm.value = {
        leave_type: 'personal',
        start_date: '',
        end_date: '',
        days: 1,
        reason: ''
      }
      loadData()
    }
  } catch (e: any) {
    showToast(e.response?.data?.message || '提交失败')
  }
}

const approve = async (id: number, action: string) => {
  try {
    const res = await request.post(`/api/leave-requests/${id}/approve`, { action })
    if (res.data.success) {
      showSuccessToast(action === 'approve' ? '已批准' : '已拒绝')
      loadData()
    }
  } catch (e: any) {
    showToast(e.response?.data?.message || '操作失败')
  }
}

const showReject = (item: any) => {
  rejectItem.value = item
  rejectReason.value = ''
  showRejectDialog.value = true
}

const confirmReject = async () => {
  if (rejectItem.value) {
    try {
      const res = await request.post(`/api/leave-requests/${rejectItem.value.id}/approve`, {
        action: 'reject',
        reject_reason: rejectReason.value
      })
      if (res.data.success) {
        showSuccessToast('已拒绝')
        loadData()
      }
    } catch (e: any) {
      showToast(e.response?.data?.message || '操作失败')
    }
  }
}

const onRefresh = () => {
  refreshing.value = true
  loadData()
}

onMounted(() => {
  loadStats()
})
</script>

<style scoped>
.leave-page {
  padding: 12px;
  background: #f5f5f5;
  min-height: 100vh;
}

.stats-card {
  display: flex;
  background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 12px;
  color: #fff;
  overflow-x: auto;
}

.stat-item {
  flex: 1;
  min-width: 80px;
  text-align: center;
}

.stat-value {
  font-size: 20px;
  font-weight: bold;
}

.stat-label {
  font-size: 12px;
  opacity: 0.8;
  margin-top: 4px;
}

.action-bar {
  margin-bottom: 12px;
}

.filter-bar {
  background: #fff;
  border-radius: 8px;
  margin-bottom: 12px;
}

.leave-item {
  background: #fff;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;
}

.item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.user {
  font-weight: bold;
  font-size: 16px;
}

.item-body {
  font-size: 14px;
  color: #666;
}

.info-row {
  display: flex;
  padding: 4px 0;
}

.info-row .label {
  width: 50px;
  color: #999;
}

.info-row .value {
  flex: 1;
}

.item-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #eee;
}

.apply-form {
  padding: 20px;
}

.apply-form h3 {
  margin: 0 0 16px;
  text-align: center;
}
</style>