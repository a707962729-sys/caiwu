<template>
  <div class="dashboard-page" v-loading="loading">
    <!-- 核心指标卡片 -->
    <el-row :gutter="20" class="metrics-row">
      <el-col :xs="24" :sm="12" :md="6">
        <el-card shadow="hover" class="metric-card income" @click="navigateTo('/transactions?type=income')">
          <div class="metric-content">
            <div class="metric-icon">
              <el-icon :size="28"><TrendCharts /></el-icon>
            </div>
            <div class="metric-info">
              <div class="metric-value">¥{{ formatMoney(overview.incomeExpense?.income || 0) }}</div>
              <div class="metric-label">本月收入</div>
            </div>
            <div class="metric-trend up" v-if="overview.trends?.income">
              <el-icon><ArrowUp /></el-icon>
              {{ overview.trends.income }}%
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :md="6">
        <el-card shadow="hover" class="metric-card expense" @click="navigateTo('/transactions?type=expense')">
          <div class="metric-content">
            <div class="metric-icon">
              <el-icon :size="28"><Wallet /></el-icon>
            </div>
            <div class="metric-info">
              <div class="metric-value">¥{{ formatMoney(overview.incomeExpense?.expense || 0) }}</div>
              <div class="metric-label">本月支出</div>
            </div>
            <div class="metric-trend down" v-if="overview.trends?.expense">
              <el-icon><ArrowDown /></el-icon>
              {{ overview.trends.expense }}%
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :md="6">
        <el-card shadow="hover" class="metric-card profit" @click="navigateTo('/reports')">
          <div class="metric-content">
            <div class="metric-icon">
              <el-icon :size="28"><DataAnalysis /></el-icon>
            </div>
            <div class="metric-info">
              <div class="metric-value" :class="{ positive: netProfit > 0, negative: netProfit < 0 }">
                ¥{{ formatMoney(netProfit) }}
              </div>
              <div class="metric-label">本月利润</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :md="6">
        <el-card shadow="hover" class="metric-card pending" @click="navigateTo('/workflows/tasks')">
          <div class="metric-content">
            <div class="metric-icon">
              <el-icon :size="28"><Bell /></el-icon>
            </div>
            <div class="metric-info">
              <div class="metric-value">{{ pendingCount }}</div>
              <div class="metric-label">待审核事项</div>
            </div>
            <el-badge :value="pendingCount" :max="99" class="pending-badge" v-if="pendingCount > 0" />
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 图表区域 -->
    <el-row :gutter="20" class="chart-row">
      <!-- 收支趋势图 -->
      <el-col :xs="24" :lg="16">
        <el-card shadow="hover" class="chart-card">
          <template #header>
            <div class="card-header">
              <span class="card-title">收支趋势</span>
              <el-radio-group v-model="period" size="small" @change="loadCashflowData">
                <el-radio-button label="month">近6月</el-radio-button>
                <el-radio-button label="quarter">近季度</el-radio-button>
                <el-radio-button label="year">近一年</el-radio-button>
              </el-radio-group>
            </div>
          </template>
          <div ref="trendChartRef" class="chart-container" v-loading="chartLoading"></div>
        </el-card>
      </el-col>

      <!-- 快捷操作 -->
      <el-col :xs="24" :lg="8">
        <el-card shadow="hover" class="quick-actions-card">
          <template #header>
            <span class="card-title">快捷操作</span>
          </template>
          <div class="quick-actions">
            <el-button type="primary" :icon="Plus" size="large" @click="navigateTo('/transactions?action=create')">
              新建记账
            </el-button>
            <el-button type="success" :icon="Upload" size="large" @click="navigateTo('/invoices?action=upload')">
              上传票据
            </el-button>
            <el-button type="warning" :icon="Document" size="large" @click="navigateTo('/contracts?action=create')">
              新建合同
            </el-button>
            <el-button type="info" :icon="DataLine" size="large" @click="navigateTo('/reports')">
              查看报表
            </el-button>
          </div>
        </el-card>

        <!-- 支出构成 -->
        <el-card shadow="hover" class="category-card" v-if="!categoryLoading">
          <template #header>
            <span class="card-title">支出构成</span>
          </template>
          <div ref="pieChartRef" class="pie-chart-container"></div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 应收应付 -->
    <el-row :gutter="20" class="rp-row">
      <el-col :xs="24" :md="12">
        <el-card shadow="hover" class="rp-card receivable" @click="navigateTo('/receivables')">
          <div class="rp-header">
            <span class="rp-title">应收账款</span>
            <span class="rp-total">¥{{ formatMoney(overview.receivablesPayables?.receivable || 0) }}</span>
          </div>
          <div class="rp-progress">
            <el-progress 
              :percentage="receivePercent" 
              :stroke-width="10"
              :color="'#67C23A'"
            />
            <div class="progress-info">
              <span>已收 ¥{{ formatMoney(overview.receivablesPayables?.received || 0) }}</span>
              <span>{{ receivePercent }}%</span>
            </div>
          </div>
          <div class="rp-action">
            <span>查看详情</span>
            <el-icon><ArrowRight /></el-icon>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :md="12">
        <el-card shadow="hover" class="rp-card payable" @click="navigateTo('/payables')">
          <div class="rp-header">
            <span class="rp-title">应付账款</span>
            <span class="rp-total">¥{{ formatMoney(overview.receivablesPayables?.payable || 0) }}</span>
          </div>
          <div class="rp-progress">
            <el-progress 
              :percentage="payPercent" 
              :stroke-width="10"
              :color="'#E6A23C'"
            />
            <div class="progress-info">
              <span>已付 ¥{{ formatMoney(overview.receivablesPayables?.paid || 0) }}</span>
              <span>{{ payPercent }}%</span>
            </div>
          </div>
          <div class="rp-action">
            <span>查看详情</span>
            <el-icon><ArrowRight /></el-icon>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 资金账户 -->
    <el-card shadow="hover" class="accounts-card">
      <template #header>
        <div class="card-header">
          <span class="card-title">资金账户</span>
          <el-button text type="primary" @click="navigateTo('/accounts')">
            管理
          </el-button>
        </div>
      </template>
      <div class="account-list">
        <div class="account-item" v-for="account in accounts" :key="account.id">
          <div class="account-icon" :class="account.account_type">
            {{ getAccountIcon(account.account_type) }}
          </div>
          <div class="account-info">
            <div class="account-name">{{ account.name }}</div>
            <div class="account-no">{{ account.account_no || '—' }}</div>
          </div>
          <div class="account-balance">¥{{ formatMoney(account.balance) }}</div>
        </div>
      </div>
      <div class="account-total">
        <span>资金总计</span>
        <span class="total-value">¥{{ formatMoney(overview.accounts?.total || 0) }}</span>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useSafeNavigate } from '@/composables/useNavigation'
import * as echarts from 'echarts'
import { 
  TrendCharts, Wallet, DataAnalysis, Bell, Plus, Upload, Document, DataLine,
  ArrowUp, ArrowDown, ArrowRight
} from '@element-plus/icons-vue'
import { dashboardApi, type DashboardOverview, type AccountItem, type CashflowData, type DashboardCategoryData } from '@/api'

const router = useRouter()
const { safeNavigate } = useSafeNavigate()

// 数据状态
const loading = ref(true)
const chartLoading = ref(false)
const categoryLoading = ref(true)
const period = ref<'month' | 'quarter' | 'year'>('month')

const overview = ref<DashboardOverview>({
  incomeExpense: { income: 0, expense: 0, net: 0 },
  accounts: { total: 0, list: [] },
  receivablesPayables: { receivable: 0, received: 0, payable: 0, paid: 0 },
  pending: { reimbursements: 0, invoices: 0, contracts: 0 }
})

const accounts = ref<AccountItem[]>([])
const cashflowData = ref<CashflowData[]>([])
const categoryData = ref<DashboardCategoryData | null>(null)

// 图表引用
const trendChartRef = ref<HTMLElement>()
const pieChartRef = ref<HTMLElement>()
let trendChart: echarts.ECharts | null = null
let pieChart: echarts.ECharts | null = null

// 计算属性
const netProfit = computed(() => overview.value.incomeExpense?.net || 0)

const pendingCount = computed(() => {
  const p = overview.value.pending
  return (p?.reimbursements || 0) + (p?.invoices || 0) + (p?.contracts || 0)
})

const receivePercent = computed(() => {
  const rp = overview.value.receivablesPayables
  if (!rp?.receivable) return 0
  return Math.round(rp.received / rp.receivable * 100)
})

const payPercent = computed(() => {
  const rp = overview.value.receivablesPayables
  if (!rp?.payable) return 0
  return Math.round(rp.paid / rp.payable * 100)
})

// 工具函数
const formatMoney = (n: number) => {
  if (!n) return '0.00'
  if (Math.abs(n) >= 10000) {
    return (n / 10000).toFixed(2) + '万'
  }
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const getAccountIcon = (type: string) => {
  const icons: Record<string, string> = {
    bank: '🏦', cash: '💵', alipay: '📱', wechat: '💚', other: '💳'
  }
  return icons[type] || '💳'
}

const navigateTo = (path: string) => {
  safeNavigate(path)
}

// 加载数据
const loadOverview = async () => {
  try {
    const data = await dashboardApi.getOverview()
    overview.value = data
    accounts.value = data.accounts?.list || []
  } catch (e) {
    console.error('加载概览数据失败', e)
  }
}

const loadCashflowData = async () => {
  chartLoading.value = true
  try {
    const months = period.value === 'year' ? 12 : period.value === 'quarter' ? 3 : 6
    const data = await dashboardApi.getCashflow({ months })
    cashflowData.value = data || []
    await nextTick()
    renderTrendChart()
  } catch (e) {
    console.error('加载现金流数据失败', e)
  } finally {
    chartLoading.value = false
  }
}

const loadCategoryData = async () => {
  categoryLoading.value = true
  try {
    const data = await dashboardApi.getCategory()
    categoryData.value = data
    await nextTick()
    renderPieChart()
  } catch (e) {
    console.error('加载分类数据失败', e)
  } finally {
    categoryLoading.value = false
  }
}

// 渲染图表
const renderTrendChart = () => {
  if (!trendChartRef.value) return
  
  if (trendChart) {
    trendChart.dispose()
  }
  
  trendChart = echarts.init(trendChartRef.value)
  
  const labels = cashflowData.value.map(item => {
    const [year, month] = item.month.split('-')
    return `${month}月`
  })
  const incomeData = cashflowData.value.map(item => item.income || 0)
  const expenseData = cashflowData.value.map(item => item.expense || 0)
  
  trendChart.setOption({
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(0,0,0,0.75)',
      borderColor: 'transparent',
      borderRadius: 8,
      textStyle: { color: '#fff' }
    },
    legend: {
      data: ['收入', '支出'],
      bottom: 0
    },
    grid: {
      left: '3%', right: '4%', top: '10%', bottom: '15%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: labels,
      axisLine: { lineStyle: { color: '#e5e5e5' } },
      axisLabel: { color: '#999' }
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      splitLine: { lineStyle: { color: '#f0f0f0', type: 'dashed' } },
      axisLabel: { color: '#999' }
    },
    series: [
      {
        name: '收入',
        type: 'bar',
        data: incomeData,
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#67C23A' },
            { offset: 1, color: '#a0f5c8' }
          ]),
          borderRadius: [6, 6, 0, 0]
        },
        barWidth: 30
      },
      {
        name: '支出',
        type: 'bar',
        data: expenseData,
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#E6A23C' },
            { offset: 1, color: '#ffdfb3' }
          ]),
          borderRadius: [6, 6, 0, 0]
        },
        barWidth: 30
      }
    ],
    animationEasing: 'elasticOut',
    animationDuration: 1000
  })
}

const renderPieChart = () => {
  if (!pieChartRef.value || !categoryData.value) return
  
  if (pieChart) {
    pieChart.dispose()
  }
  
  pieChart = echarts.init(pieChartRef.value)
  
  const categories = categoryData.value.categories || []
  const expenseCategories = categories
    .filter(c => c.transaction_type === 'expense')
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)
  
  const colors = [
    '#667eea', '#67C23A', '#E6A23C', '#909399', '#F56C6C'
  ]
  
  pieChart.setOption({
    tooltip: {
      trigger: 'item',
      formatter: '{b}: ¥{c} ({d}%)',
      backgroundColor: 'rgba(0,0,0,0.75)',
      borderColor: 'transparent',
      borderRadius: 8,
      textStyle: { color: '#fff' }
    },
    legend: {
      bottom: 0,
      itemWidth: 10,
      itemHeight: 10
    },
    series: [{
      type: 'pie',
      radius: ['45%', '70%'],
      center: ['50%', '40%'],
      avoidLabelOverlap: false,
      data: expenseCategories.map((item, index) => ({
        value: item.total || 0,
        name: item.category,
        itemStyle: {
          color: colors[index % colors.length],
          borderRadius: 6,
          borderColor: '#fff',
          borderWidth: 2
        }
      })),
      label: { show: false },
      emphasis: {
        label: { show: true, fontSize: 14, fontWeight: 'bold' }
      },
      animationType: 'scale',
      animationEasing: 'elasticOut'
    }]
  })
}

// 窗口resize处理
const handleResize = () => {
  trendChart?.resize()
  pieChart?.resize()
}

// 初始化
onMounted(async () => {
  loading.value = true
  try {
    await Promise.all([
      loadOverview(),
      loadCashflowData(),
      loadCategoryData()
    ])
  } finally {
    loading.value = false
  }
  
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  trendChart?.dispose()
  pieChart?.dispose()
})
</script>

<style lang="scss" scoped>
.dashboard-page {
  padding: 20px;
  background: #f5f7fa;
  min-height: calc(100vh - 60px);
}

// 指标卡片
.metrics-row {
  margin-bottom: 20px;
  
  .el-col {
    margin-bottom: 15px;
  }
}

.metric-card {
  cursor: pointer;
  transition: all 0.3s ease;
  border-radius: 12px;
  
  &:hover {
    transform: translateY(-4px);
  }
  
  &.income {
    .metric-icon { background: linear-gradient(135deg, #67C23A, #85ce61); }
    .metric-value { color: #67C23A; }
  }
  
  &.expense {
    .metric-icon { background: linear-gradient(135deg, #E6A23C, #ebb563); }
    .metric-value { color: #E6A23C; }
  }
  
  &.profit {
    .metric-icon { background: linear-gradient(135deg, #409EFF, #66b1ff); }
    .metric-value { color: #409EFF; }
    .metric-value.positive { color: #67C23A; }
    .metric-value.negative { color: #F56C6C; }
  }
  
  &.pending {
    .metric-icon { background: linear-gradient(135deg, #909399, #a6a9ad); }
    .metric-value { color: #303133; }
  }
  
  .metric-content {
    display: flex;
    align-items: center;
    gap: 16px;
    position: relative;
  }
  
  .metric-icon {
    width: 56px;
    height: 56px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
  }
  
  .metric-info {
    flex: 1;
  }
  
  .metric-value {
    font-size: 24px;
    font-weight: 700;
  }
  
  .metric-label {
    font-size: 14px;
    color: #909399;
    margin-top: 4px;
  }
  
  .metric-trend {
    position: absolute;
    top: 0;
    right: 0;
    font-size: 12px;
    display: flex;
    align-items: center;
    padding: 2px 8px;
    border-radius: 12px;
    
    &.up {
      color: #67C23A;
      background: rgba(103, 194, 58, 0.1);
    }
    
    &.down {
      color: #E6A23C;
      background: rgba(230, 162, 60, 0.1);
    }
  }
  
  .pending-badge {
    position: absolute;
    top: 0;
    right: 0;
  }
}

// 图表区域
.chart-row {
  margin-bottom: 20px;
  
  .el-col {
    margin-bottom: 15px;
  }
}

.chart-card {
  border-radius: 12px;
  
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .card-title {
    font-size: 16px;
    font-weight: 600;
    color: #303133;
  }
}

.chart-container {
  height: 320px;
}

// 快捷操作
.quick-actions-card {
  border-radius: 12px;
  margin-bottom: 20px;
  
  .card-title {
    font-size: 16px;
    font-weight: 600;
  }
}

.quick-actions {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  
  .el-button {
    height: 60px;
    font-size: 14px;
    border-radius: 10px;
  }
}

.category-card {
  border-radius: 12px;
  
  .card-title {
    font-size: 16px;
    font-weight: 600;
  }
}

.pie-chart-container {
  height: 200px;
}

// 应收应付
.rp-row {
  margin-bottom: 20px;
  
  .el-col {
    margin-bottom: 15px;
  }
}

.rp-card {
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
  
  &:hover {
    transform: translateY(-2px);
  }
  
  &.receivable {
    border-left: 4px solid #67C23A;
  }
  
  &.payable {
    border-left: 4px solid #E6A23C;
  }
  
  .rp-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }
  
  .rp-title {
    font-size: 14px;
    color: #606266;
  }
  
  .rp-total {
    font-size: 24px;
    font-weight: 700;
  }
  
  &.receivable .rp-total { color: #67C23A; }
  &.payable .rp-total { color: #E6A23C; }
  
  .rp-progress {
    margin-bottom: 16px;
  }
  
  .progress-info {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    color: #909399;
    margin-top: 8px;
  }
  
  .rp-action {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 12px;
    border-top: 1px solid #ebeef5;
    font-size: 14px;
    color: #409EFF;
  }
}

// 资金账户
.accounts-card {
  border-radius: 12px;
  
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .card-title {
    font-size: 16px;
    font-weight: 600;
  }
}

.account-list {
  .account-item {
    display: flex;
    align-items: center;
    padding: 12px 0;
    border-bottom: 1px solid #f5f7fa;
    
    &:last-child {
      border-bottom: none;
    }
  }
  
  .account-icon {
    width: 44px;
    height: 44px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    margin-right: 12px;
    background: #f5f7fa;
    
    &.bank { background: #e6f7ff; }
    &.cash { background: #fff7e6; }
    &.alipay { background: #e6f7ff; }
    &.wechat { background: #f6ffed; }
  }
  
  .account-info {
    flex: 1;
  }
  
  .account-name {
    font-size: 14px;
    font-weight: 500;
    color: #303133;
  }
  
  .account-no {
    font-size: 12px;
    color: #909399;
    margin-top: 2px;
  }
  
  .account-balance {
    font-size: 16px;
    font-weight: 600;
    color: #303133;
  }
}

.account-total {
  display: flex;
  justify-content: space-between;
  padding-top: 16px;
  border-top: 1px solid #ebeef5;
  font-size: 14px;
  
  .total-value {
    font-size: 20px;
    font-weight: 700;
    background: linear-gradient(135deg, #667eea, #764ba2);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
}

// 响应式
@media (max-width: 768px) {
  .dashboard-page {
    padding: 15px;
  }
  
  .metric-value {
    font-size: 20px !important;
  }
  
  .quick-actions {
    grid-template-columns: 1fr;
  }
  
  .chart-container {
    height: 250px;
  }
}
</style>