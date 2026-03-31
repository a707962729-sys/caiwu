<template>
  <div class="attendance-page">
    <!-- 快捷打卡区 -->
    <el-card shadow="never" class="checkin-card">
      <div class="checkin-area">
        <div class="current-time">{{ currentTime }}</div>
        <div class="checkin-date">{{ currentDate }}</div>
        <div class="checkin-buttons">
          <el-button type="primary" size="large" :loading="clockInLoading" @click="handleCheckIn('clock_in')">
            <el-icon><Timer /></el-icon> 上班打卡
          </el-button>
          <el-button type="success" size="large" :loading="clockOutLoading" @click="handleCheckIn('clock_out')">
            <el-icon><Timer /></el-icon> 下班打卡
          </el-button>
        </div>
        <div class="checkin-employee">
          <el-select v-model="selectedEmployee" placeholder="选择员工" filterable style="width: 200px">
            <el-option v-for="emp in employeeOptions" :key="emp.id" :label="emp.name" :value="emp.id" />
          </el-select>
        </div>
      </div>
    </el-card>

    <!-- 筛选区 -->
    <el-card shadow="never" class="filter-card">
      <el-form :inline="true" :model="filterForm">
        <el-form-item label="员工">
          <el-select v-model="filterForm.employee_id" placeholder="全部员工" clearable filterable style="width: 160px" @change="handleFilter">
            <el-option v-for="emp in employeeOptions" :key="emp.id" :label="emp.name" :value="emp.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="日期">
          <el-date-picker v-model="dateRange" type="daterange" range-separator="至" start-placeholder="开始日期" end-placeholder="结束日期" value-format="YYYY-MM-DD" style="width: 260px" @change="handleFilter" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="filterForm.status" placeholder="全部状态" clearable style="width: 100px" @change="handleFilter">
            <el-option label="正常" value="normal" />
            <el-option label="迟到" value="late" />
            <el-option label="早退" value="early" />
            <el-option label="旷工" value="absent" />
            <el-option label="请假" value="leave" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="handleFilter">搜索</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 考勤统计 -->
    <el-card shadow="never" class="stat-card" v-if="!filterForm.employee_id">
      <template #header><span>本月考勤统计</span></template>
      <el-row :gutter="20">
        <el-col :span="4" v-for="s in statSummary" :key="s.label">
          <div class="stat-item" :class="s.type">
            <div class="stat-num">{{ s.value }}</div>
            <div class="stat-label">{{ s.label }}</div>
          </div>
        </el-col>
      </el-row>
    </el-card>

    <!-- 数据表格 -->
    <el-card shadow="never" class="table-card">
      <el-table v-loading="loading" :data="tableData" stripe>
        <el-table-column prop="date" label="日期" width="120" />
        <el-table-column prop="employee_name" label="员工姓名" width="120" />
        <el-table-column prop="clock_in" label="上班打卡" width="100">
          <template #default="{ row }">
            <span :class="{ 'text-warn': row.status === 'late' }">{{ row.clock_in || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="clock_out" label="下班打卡" width="100">
          <template #default="{ row }">
            <span :class="{ 'text-warn': row.status === 'early' }">{{ row.clock_out || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="work_hours" label="工时" width="80" align="center">
          <template #default="{ row }">{{ row.work_hours ? row.work_hours + 'h' : '-' }}</template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag size="small" :type="getTagType(row.status)">{{ getLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" />
      </el-table>
      <div class="pagination-container">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :page-sizes="[10, 20, 50]"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next"
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Search, Timer } from '@element-plus/icons-vue'
import { attendanceApi, type AttendanceRecord } from '@/api/attendance'
import { employeeApi } from '@/api/employee'
import dayjs from 'dayjs'

const loading = ref(false)
const clockInLoading = ref(false)
const clockOutLoading = ref(false)
const tableData = ref<AttendanceRecord[]>([])
const employeeOptions = ref<Array<{ id: number; name: string }>>([])
const selectedEmployee = ref<number | null>(null)
const dateRange = ref<string[]>([])
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })

const filterForm = reactive({
  employee_id: undefined as number | undefined,
  start_date: '',
  end_date: '',
  status: '' as string | ''
})

const statSummary = computed(() => [
  { label: '正常', value: totalStat.normal_days, type: 'normal' },
  { label: '迟到', value: totalStat.late_days, type: 'warn' },
  { label: '早退', value: totalStat.early_days, type: 'warn' },
  { label: '旷工', value: totalStat.absent_days, type: 'danger' },
  { label: '请假', value: totalStat.leave_days, type: 'info' },
  { label: '出勤率', value: (totalStat.attendance_rate || 0) + '%', type: 'primary' }
])

const totalStat = reactive({
  normal_days: 0, late_days: 0, early_days: 0, absent_days: 0, leave_days: 0, attendance_rate: 0
})

const currentTime = ref(dayjs().format('HH:mm:ss'))
const currentDate = ref(dayjs().format('YYYY年MM月DD日 dddd'))

let timer: ReturnType<typeof setInterval>

const getTagType = (status: string) => ({ normal: 'success', late: 'warning', absent: 'danger', leave: 'info', early: 'warning' }[status] || '')
const getLabel = (status: string) => ({ normal: '正常', late: '迟到', absent: '旷工', leave: '请假', early: '早退' }[status] || status)

const loadEmployees = async () => {
  try {
    const res = await employeeApi.getList({ page: 1, pageSize: 100, status: 1 })
    employeeOptions.value = (res.list || []).map((e: any) => ({ id: e.id, name: e.name }))
  } catch (e) { console.error(e) }
}

const loadData = async () => {
  loading.value = true
  try {
    const res = await attendanceApi.getList({
      page: pagination.page,
      pageSize: pagination.pageSize,
      employee_id: filterForm.employee_id,
      start_date: dateRange.value?.[0],
      end_date: dateRange.value?.[1],
      status: filterForm.status as any
    })
    tableData.value = res.list || []
    pagination.total = res.total || 0
  } catch (e) { ElMessage.error('加载失败') }
  finally { loading.value = false }
}

const loadStats = async () => {
  try {
    const stats = await attendanceApi.getStats({ month: dayjs().format('YYYY-MM') })
    if (stats.length > 0) {
      const s = stats[0]
      totalStat.normal_days = s.normal_days
      totalStat.late_days = s.late_days
      totalStat.early_days = s.early_days
      totalStat.absent_days = s.absent_days
      totalStat.leave_days = s.leave_days
      totalStat.attendance_rate = s.attendance_rate
    }
  } catch (e) { console.error(e) }
}

const handleCheckIn = async (type: 'clock_in' | 'clock_out') => {
  if (!selectedEmployee.value) { ElMessage.warning('请先选择员工'); return }
  const loadingKey = type === 'clock_in' ? 'clockInLoading' : 'clockOutLoading'
  if (clockInLoading.value || clockOutLoading.value) return
  if (type === 'clock_in') clockInLoading.value = true
  else clockOutLoading.value = true
  try {
    await attendanceApi.checkIn({ employee_id: selectedEmployee.value, type })
    ElMessage.success(type === 'clock_in' ? '上班打卡成功' : '下班打卡成功')
    loadData()
  } catch (e: any) {
    ElMessage.error(e?.message || '打卡失败')
  } finally {
    clockInLoading.value = false
    clockOutLoading.value = false
  }
}

const handleFilter = () => {
  pagination.page = 1
  loadData()
}

const handleSizeChange = (size: number) => { pagination.pageSize = size; pagination.page = 1; loadData() }
const handlePageChange = (page: number) => { pagination.page = page; loadData() }

onMounted(() => {
  timer = setInterval(() => {
    currentTime.value = dayjs().format('HH:mm:ss')
    currentDate.value = dayjs().format('YYYY年MM月DD日 dddd')
  }, 1000)
  loadEmployees()
  loadData()
  loadStats()
})

onUnmounted(() => clearInterval(timer))
</script>

<style lang="scss" scoped>
.attendance-page {
  .checkin-card { margin-bottom: 20px; border-radius: 12px; .checkin-area { text-align: center; padding: 20px; .current-time { font-size: 48px; font-weight: 700; color: #1a1a2e; } .checkin-date { font-size: 16px; color: #909399; margin: 8px 0 24px; } .checkin-buttons { display: flex; gap: 16px; justify-content: center; margin-bottom: 16px; } .checkin-employee { margin-top: 12px; } } }
  .filter-card { margin-bottom: 20px; border-radius: 12px; :deep(.el-card__body) { padding: 16px 20px; } }
  .stat-card { margin-bottom: 20px; border-radius: 12px; .stat-item { text-align: center; padding: 16px; border-radius: 8px; &.normal { background: #e8f9f0; .stat-num { color: #07c160; } } &.warn { background: #fef9e7; .stat-num { color: #f59e0b; } } &.danger { background: #fef2f2; .stat-num { color: #ef4444; } } &.info { background: #f0f5ff; .stat-num { color: #3b82f6; } } &.primary { background: #e8f4fd; .stat-num { color: #3b82f6; } } .stat-num { font-size: 24px; font-weight: 600; } .stat-label { font-size: 13px; color: #909399; margin-top: 4px; } } }
  .table-card { border-radius: 12px; :deep(.el-card__body) { padding: 0; } :deep(.el-table) { th.el-table__cell { background: #fafafa; } .text-warn { color: #f56c6c; font-weight: 500; } } }
  .pagination-container { padding: 20px; display: flex; justify-content: flex-end; border-top: 1px solid #ebeef5; }
}
</style>
