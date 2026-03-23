<template>
  <div class="attendance-page">
    <!-- 统计卡片 -->
    <div class="stats-card">
      <div class="stat-item">
        <div class="stat-value">{{ stats.normal_days || 0 }}</div>
        <div class="stat-label">出勤天数</div>
      </div>
      <div class="stat-item">
        <div class="stat-value warning">{{ stats.late_days || 0 }}</div>
        <div class="stat-label">迟到次数</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">{{ stats.total_overtime_hours || 0 }}h</div>
        <div class="stat-label">加班时长</div>
      </div>
    </div>

    <!-- 打卡按钮（员工） -->
    <div class="check-actions" v-if="userRole === 'employee'">
      <van-button type="primary" size="large" @click="checkIn" :disabled="checkedIn">
        {{ checkedIn ? '已签到' : '签到' }}
      </van-button>
      <van-button type="default" size="large" @click="checkOut" :disabled="!checkedIn || checkedOut">
        {{ checkedOut ? '已签退' : '签退' }}
      </van-button>
    </div>

    <!-- 筛选栏 -->
    <div class="filter-bar">
      <van-dropdown-menu>
        <van-dropdown-item v-model="filterStatus" :options="statusOptions" @change="loadData" />
      </van-dropdown-menu>
      <van-field
        v-model="filterMonth"
        type="month"
        label="月份"
        placeholder="选择月份"
        @change="loadData"
      />
    </div>

    <!-- 考勤列表 -->
    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <van-list
        v-model:loading="loading"
        :finished="finished"
        finished-text="没有更多了"
        @load="loadData"
      >
        <div class="attendance-item" v-for="item in list" :key="item.id">
          <div class="item-header">
            <span class="date">{{ item.date }}</span>
            <van-tag :type="getStatusType(item.status)">{{ getStatusText(item.status) }}</van-tag>
          </div>
          <div class="item-body">
            <div class="info-row">
              <span class="label">员工：</span>
              <span class="value">{{ item.user_name }}</span>
            </div>
            <div class="info-row">
              <span class="label">签到：</span>
              <span class="value">{{ item.check_in_time || '-' }}</span>
            </div>
            <div class="info-row">
              <span class="label">签退：</span>
              <span class="value">{{ item.check_out_time || '-' }}</span>
            </div>
            <div class="info-row">
              <span class="label">工时：</span>
              <span class="value">{{ item.work_hours || 0 }}h</span>
            </div>
          </div>
        </div>
      </van-list>
    </van-pull-refresh>
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

const list = ref([])
const loading = ref(false)
const finished = ref(false)
const refreshing = ref(false)
const page = ref(1)

const filterStatus = ref('')
const filterMonth = ref('')

const statusOptions = [
  { text: '全部状态', value: '' },
  { text: '正常', value: 'normal' },
  { text: '迟到', value: 'late' },
  { text: '早退', value: 'early_leave' },
  { text: '缺勤', value: 'absent' },
  { text: '请假', value: 'leave' }
]

const stats = ref({
  normal_days: 0,
  late_days: 0,
  total_overtime_hours: 0
})

const checkedIn = ref(false)
const checkedOut = ref(false)

const getStatusType = (status: string) => {
  const types: Record<string, string> = {
    normal: 'success',
    late: 'warning',
    early_leave: 'warning',
    absent: 'danger',
    leave: 'primary',
    holiday: 'default'
  }
  return types[status] || 'default'
}

const getStatusText = (status: string) => {
  const texts: Record<string, string> = {
    normal: '正常',
    late: '迟到',
    early_leave: '早退',
    absent: '缺勤',
    leave: '请假',
    holiday: '节假日'
  }
  return texts[status] || status
}

const loadData = async () => {
  if (refreshing.value) {
    list.value = []
    page.value = 1
    finished.value = false
    refreshing.value = false
  }

  try {
    const params: any = {
      page: page.value,
      pageSize: 20
    }
    if (filterStatus.value) params.status = filterStatus.value
    if (filterMonth.value) {
      const [year, month] = filterMonth.value.split('-')
      params.startDate = `${year}-${month}-01`
      params.endDate = `${year}-${month}-31`
    }

    const res = await request.get('/api/attendance', { params })
    if (res.data.success) {
      list.value = [...list.value, ...res.data.data.list]
      if (res.data.data.list.length < 20) {
        finished.value = true
      }
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
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1
    const res = await request.get('/api/attendance/stats', {
      params: { year, month }
    })
    if (res.data.success) {
      stats.value = res.data.data
    }
  } catch (e) {
    console.error('加载统计失败')
  }
}

const checkIn = async () => {
  try {
    const res = await request.post('/api/attendance/check-in')
    if (res.data.success) {
      showSuccessToast('签到成功')
      checkedIn.value = true
      loadData()
    }
  } catch (e: any) {
    showToast(e.response?.data?.message || '签到失败')
  }
}

const checkOut = async () => {
  try {
    const res = await request.post('/api/attendance/check-out')
    if (res.data.success) {
      showSuccessToast('签退成功')
      checkedOut.value = true
      loadData()
    }
  } catch (e: any) {
    showToast(e.response?.data?.message || '签退失败')
  }
}

const onRefresh = () => {
  refreshing.value = true
  loadData()
}

onMounted(() => {
  loadStats()
  // 检查今日打卡状态
  const today = new Date().toISOString().split('T')[0]
  request.get('/api/attendance', { params: { startDate: today, endDate: today } })
    .then(res => {
      if (res.data.success && res.data.data.list.length > 0) {
        const record = res.data.data.list[0]
        checkedIn.value = !!record.check_in_time
        checkedOut.value = !!record.check_out_time
      }
    })
})
</script>

<style scoped>
.attendance-page {
  padding: 12px;
  background: #f5f5f5;
  min-height: 100vh;
}

.stats-card {
  display: flex;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 12px;
  color: #fff;
}

.stat-item {
  flex: 1;
  text-align: center;
}

.stat-value {
  font-size: 24px;
  font-weight: bold;
}

.stat-value.warning {
  color: #ffd700;
}

.stat-label {
  font-size: 12px;
  opacity: 0.8;
  margin-top: 4px;
}

.check-actions {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
}

.filter-bar {
  background: #fff;
  border-radius: 8px;
  margin-bottom: 12px;
  overflow: hidden;
}

.attendance-item {
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

.date {
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
</style>