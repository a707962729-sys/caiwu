<template>
  <div class="salary-page">
    <!-- 统计卡片 -->
    <div class="stats-card">
      <div class="stat-item">
        <div class="stat-value">¥{{ formatMoney(stats.total_actual) }}</div>
        <div class="stat-label">本月工资总额</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">¥{{ formatMoney(stats.avg_salary) }}</div>
        <div class="stat-label">平均工资</div>
      </div>
    </div>

    <!-- 筛选 -->
    <div class="filter-bar">
      <van-dropdown-menu>
        <van-dropdown-item v-model="filterYear" :options="yearOptions" @change="loadData" />
        <van-dropdown-item v-model="filterMonth" :options="monthOptions" @change="loadData" />
        <van-dropdown-item v-model="filterStatus" :options="statusOptions" @change="loadData" />
      </van-dropdown-menu>
    </div>

    <!-- 工资列表 -->
    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <van-list
        v-model:loading="loading"
        :finished="finished"
        finished-text="没有更多了"
        @load="loadData"
      >
        <div class="salary-item" v-for="item in list" :key="item.id">
          <div class="item-header">
            <div class="left">
              <span class="user">{{ item.user_name }}</span>
              <span class="period">{{ item.year }}年{{ item.month }}月</span>
            </div>
            <van-tag :type="getStatusType(item.status)">{{ getStatusText(item.status) }}</van-tag>
          </div>
          <div class="item-body">
            <div class="money-row">
              <div class="income">
                <div class="label">收入</div>
                <div class="value">
                  <div class="row">
                    <span>基本工资</span>
                    <span>¥{{ formatMoney(item.base_salary) }}</span>
                  </div>
                  <div class="row" v-if="item.position_allowance">
                    <span>岗位津贴</span>
                    <span>¥{{ formatMoney(item.position_allowance) }}</span>
                  </div>
                  <div class="row" v-if="item.performance_bonus">
                    <span>绩效奖金</span>
                    <span>¥{{ formatMoney(item.performance_bonus) }}</span>
                  </div>
                  <div class="row" v-if="item.overtime_pay">
                    <span>加班费</span>
                    <span>¥{{ formatMoney(item.overtime_pay) }}</span>
                  </div>
                </div>
              </div>
              <div class="deduction">
                <div class="label">扣除</div>
                <div class="value">
                  <div class="row" v-if="item.social_insurance">
                    <span>社保</span>
                    <span>¥{{ formatMoney(item.social_insurance) }}</span>
                  </div>
                  <div class="row" v-if="item.housing_fund">
                    <span>公积金</span>
                    <span>¥{{ formatMoney(item.housing_fund) }}</span>
                  </div>
                  <div class="row" v-if="item.tax">
                    <span>个税</span>
                    <span>¥{{ formatMoney(item.tax) }}</span>
                  </div>
                </div>
              </div>
            </div>
            <div class="total-row">
              <span>实发工资</span>
              <span class="total">¥{{ formatMoney(item.actual_salary) }}</span>
            </div>
          </div>
          <!-- 操作按钮（管理员） -->
          <div class="item-actions" v-if="canManage && item.status === 'draft'">
            <van-button size="small" type="primary" @click="confirmSalary(item.id)">
              确认
            </van-button>
          </div>
          <div class="item-actions" v-if="canManage && item.status === 'confirmed'">
            <van-button size="small" type="success" @click="paySalary(item.id)">
              发放
            </van-button>
          </div>
        </div>
      </van-list>
    </van-pull-refresh>

    <!-- 新建工资（管理员） -->
    <van-floating-bubble
      v-if="canManage"
      icon="plus"
      @click="showCreate = true"
    />

    <!-- 创建工资弹窗 -->
    <van-popup v-model:show="showCreate" position="bottom" round style="height: 80%">
      <div class="create-form">
        <h3>创建工资</h3>
        <van-form @submit="submitCreate">
          <van-field
            v-model="createForm.user_name"
            is-link
            readonly
            label="员工"
            placeholder="选择员工"
            @click="showUserPicker = true"
            required
          />
          <van-field
            v-model="createForm.year"
            type="digit"
            label="年份"
            placeholder="如 2026"
            required
          />
          <van-field
            v-model="createForm.month"
            type="digit"
            label="月份"
            placeholder="1-12"
            required
          />
          <van-field
            v-model="createForm.base_salary"
            type="number"
            label="基本工资"
            required
          />
          <van-field
            v-model="createForm.position_allowance"
            type="number"
            label="岗位津贴"
          />
          <van-field
            v-model="createForm.performance_bonus"
            type="number"
            label="绩效奖金"
          />
          <van-field
            v-model="createForm.overtime_pay"
            type="number"
            label="加班费"
          />
          <van-field
            v-model="createForm.social_insurance"
            type="number"
            label="社保"
          />
          <van-field
            v-model="createForm.housing_fund"
            type="number"
            label="公积金"
          />
          <van-field
            v-model="createForm.tax"
            type="number"
            label="个税"
          />
          <div style="margin: 16px;">
            <van-button round block type="primary" native-type="submit">
              创建
            </van-button>
          </div>
        </van-form>
      </div>
    </van-popup>

    <!-- 员工选择器 -->
    <van-popup v-model:show="showUserPicker" position="bottom" round>
      <van-picker
        :columns="userColumns"
        @confirm="onUserConfirm"
        @cancel="showUserPicker = false"
      />
    </van-popup>
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

const canManage = computed(() => ['boss', 'accountant'].includes(userRole.value))

const list = ref([])
const loading = ref(false)
const finished = ref(false)
const refreshing = ref(false)
const page = ref(1)

const currentYear = new Date().getFullYear()
const currentMonth = new Date().getMonth() + 1

const filterYear = ref(currentYear)
const filterMonth = ref(currentMonth)
const filterStatus = ref('')

const yearOptions = [
  { text: '2026年', value: 2026 },
  { text: '2025年', value: 2025 }
]

const monthOptions = Array.from({ length: 12 }, (_, i) => ({
  text: `${i + 1}月`,
  value: i + 1
}))

const statusOptions = [
  { text: '全部状态', value: '' },
  { text: '草稿', value: 'draft' },
  { text: '已确认', value: 'confirmed' },
  { text: '已发放', value: 'paid' }
]

const stats = ref({
  total_actual: 0,
  avg_salary: 0
})

const showCreate = ref(false)
const showUserPicker = ref(false)
const createForm = ref({
  user_id: 0,
  user_name: '',
  year: currentYear,
  month: currentMonth,
  base_salary: 0,
  position_allowance: 0,
  performance_bonus: 0,
  overtime_pay: 0,
  social_insurance: 0,
  housing_fund: 0,
  tax: 0
})

const userColumns = ref([])

const formatMoney = (value: number) => {
  return (value || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })
}

const getStatusType = (status: string) => {
  const types: Record<string, string> = {
    draft: 'default',
    confirmed: 'primary',
    paid: 'success'
  }
  return types[status] || 'default'
}

const getStatusText = (status: string) => {
  const texts: Record<string, string> = {
    draft: '草稿',
    confirmed: '已确认',
    paid: '已发放'
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
      pageSize: 20,
      year: filterYear.value,
      month: filterMonth.value
    }
    if (filterStatus.value) params.status = filterStatus.value

    const res = await request.get('/api/salaries', { params })
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
    const res = await request.get('/api/salaries/stats', {
      params: { year: filterYear.value, month: filterMonth.value }
    })
    if (res.data.success) {
      stats.value = res.data.data.overview || {}
    }
  } catch (e) {
    console.error('加载统计失败')
  }
}

const loadUsers = async () => {
  try {
    const res = await request.get('/api/users', { params: { pageSize: 100 } })
    if (res.data.success) {
      userColumns.value = res.data.data.list.map((u: any) => ({
        text: u.real_name,
        value: u.id
      }))
    }
  } catch (e) {
    console.error('加载用户失败')
  }
}

const onUserConfirm = ({ selectedOptions }: any) => {
  const option = selectedOptions[0]
  createForm.value.user_id = option.value
  createForm.value.user_name = option.text
  showUserPicker.value = false
}

const submitCreate = async () => {
  if (!createForm.value.user_id) {
    showToast('请选择员工')
    return
  }

  try {
    const res = await request.post('/api/salaries', {
      user_id: createForm.value.user_id,
      year: createForm.value.year,
      month: createForm.value.month,
      base_salary: createForm.value.base_salary,
      position_allowance: createForm.value.position_allowance,
      performance_bonus: createForm.value.performance_bonus,
      overtime_pay: createForm.value.overtime_pay,
      social_insurance: createForm.value.social_insurance,
      housing_fund: createForm.value.housing_fund,
      tax: createForm.value.tax
    })
    if (res.data.success) {
      showSuccessToast('创建成功')
      showCreate.value = false
      loadData()
      loadStats()
    }
  } catch (e: any) {
    showToast(e.response?.data?.message || '创建失败')
  }
}

const confirmSalary = async (id: number) => {
  try {
    const res = await request.post(`/api/salaries/${id}/confirm`)
    if (res.data.success) {
      showSuccessToast('已确认')
      loadData()
    }
  } catch (e: any) {
    showToast(e.response?.data?.message || '操作失败')
  }
}

const paySalary = async (id: number) => {
  try {
    const res = await request.post(`/api/salaries/${id}/pay`)
    if (res.data.success) {
      showSuccessToast('已发放')
      loadData()
    }
  } catch (e: any) {
    showToast(e.response?.data?.message || '操作失败')
  }
}

const onRefresh = () => {
  refreshing.value = true
  loadData()
}

onMounted(() => {
  loadStats()
  if (canManage.value) loadUsers()
})
</script>

<style scoped>
.salary-page {
  padding: 12px;
  background: #f5f5f5;
  min-height: 100vh;
  padding-bottom: 80px;
}

.stats-card {
  display: flex;
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
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
  font-size: 20px;
  font-weight: bold;
}

.stat-label {
  font-size: 12px;
  opacity: 0.8;
  margin-top: 4px;
}

.filter-bar {
  background: #fff;
  border-radius: 8px;
  margin-bottom: 12px;
}

.salary-item {
  background: #fff;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;
}

.item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.item-header .left {
  display: flex;
  flex-direction: column;
}

.user {
  font-weight: bold;
  font-size: 16px;
}

.period {
  font-size: 12px;
  color: #999;
}

.item-body {
  font-size: 14px;
}

.money-row {
  display: flex;
  gap: 20px;
  padding: 12px 0;
  border-top: 1px solid #f0f0f0;
  border-bottom: 1px solid #f0f0f0;
}

.money-row > div {
  flex: 1;
}

.money-row .label {
  font-size: 12px;
  color: #999;
  margin-bottom: 8px;
}

.money-row .row {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
  font-size: 13px;
  color: #666;
}

.total-row {
  display: flex;
  justify-content: space-between;
  padding: 12px 0;
  font-weight: bold;
}

.total-row .total {
  font-size: 18px;
  color: #f5576c;
}

.item-actions {
  display: flex;
  gap: 8px;
  padding-top: 12px;
}

.create-form {
  padding: 20px;
  overflow-y: auto;
  height: 100%;
}

.create-form h3 {
  margin: 0 0 16px;
  text-align: center;
}
</style>