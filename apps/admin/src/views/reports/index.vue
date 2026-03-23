<template>
  <div class="reports-page">
    <!-- 时间范围选择器 -->
    <el-card shadow="hover" class="filter-card">
      <div class="filter-container">
        <div class="time-range-buttons">
          <el-radio-group v-model="timeRange" @change="handleTimeRangeChange">
            <el-radio-button label="week">本周</el-radio-button>
            <el-radio-button label="month">本月</el-radio-button>
            <el-radio-button label="year">本年</el-radio-button>
            <el-radio-button label="custom">自定义</el-radio-button>
          </el-radio-group>
        </div>
        <div v-if="timeRange === 'custom'" class="date-picker">
          <el-date-picker
            v-model="customDateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            @change="handleCustomDateChange"
          />
        </div>
        <el-button type="primary" :icon="Download" @click="exportToExcel" :loading="exporting">
          导出 Excel
        </el-button>
      </div>
    </el-card>

    <!-- 统计卡片 -->
    <el-row :gutter="20" class="stat-cards">
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card income-card">
          <div class="stat-content">
            <div class="stat-icon">
              <el-icon :size="28"><TrendCharts /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ formatMoney(reportData.totalIncome) }}</div>
              <div class="stat-label">总收入</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card expense-card">
          <div class="stat-content">
            <div class="stat-icon">
              <el-icon :size="28"><Wallet /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ formatMoney(reportData.totalExpense) }}</div>
              <div class="stat-label">总支出</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card profit-card">
          <div class="stat-content">
            <div class="stat-icon">
              <el-icon :size="28"><Money /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value" :class="{ negative: reportData.netProfit < 0 }">
                {{ formatMoney(reportData.netProfit) }}
              </div>
              <div class="stat-label">净利润</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card rate-card">
          <div class="stat-content">
            <div class="stat-icon">
              <el-icon :size="28"><DataAnalysis /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ profitRate }}%</div>
              <div class="stat-label">利润率</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 图表区域 -->
    <el-row :gutter="20" class="charts-row">
      <el-col :span="16">
        <el-card shadow="hover">
          <template #header>
            <div class="card-header">
              <span>收支趋势</span>
            </div>
          </template>
          <div ref="trendChartRef" class="chart-container" v-loading="loading"></div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="hover">
          <template #header>
            <div class="card-header">
              <span>分类占比</span>
              <el-radio-group v-model="categoryType" size="small">
                <el-radio-button label="income">收入</el-radio-button>
                <el-radio-button label="expense">支出</el-radio-button>
              </el-radio-group>
            </div>
          </template>
          <div ref="pieChartRef" class="chart-container" v-loading="loading"></div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 数据表格 -->
    <el-card shadow="hover" class="table-card">
      <template #header>
        <div class="card-header">
          <span>详细数据</span>
        </div>
      </template>
      <el-table :data="tableData" stripe border v-loading="loading" max-height="400">
        <el-table-column prop="date" label="日期" width="150" fixed />
        <el-table-column prop="income" label="收入" width="150">
          <template #default="{ row }">
            <span class="income-text">{{ formatMoney(row.income) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="expense" label="支出" width="150">
          <template #default="{ row }">
            <span class="expense-text">{{ formatMoney(row.expense) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="profit" label="净利润" width="150">
          <template #default="{ row }">
            <span :class="row.profit >= 0 ? 'income-text' : 'expense-text'">
              {{ formatMoney(row.profit) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="profitRate" label="利润率" width="120">
          <template #default="{ row }">
            <span>{{ row.profitRate }}%</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="viewDetail(row)">
              查看
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Download, TrendCharts, Wallet, Money, DataAnalysis } from '@element-plus/icons-vue'
import * as echarts from 'echarts'
import type { ECharts } from 'echarts'
import { reportsApi, type ProfitLossData, type TrendData, type CategoryData } from '@/api/reports'
// @ts-ignore
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'

// 时间范围
const timeRange = ref<'week' | 'month' | 'year' | 'custom'>('month')
const customDateRange = ref<[string, string] | null>(null)
const dateRange = ref<{ startDate: string; endDate: string }>({
  startDate: '',
  endDate: ''
})

// 数据
const loading = ref(false)
const exporting = ref(false)
const reportData = ref<ProfitLossData>({
  totalIncome: 0,
  totalExpense: 0,
  netProfit: 0,
  incomeByCategory: [],
  expenseByCategory: [],
  trend: []
})
const categoryType = ref<'income' | 'expense'>('income')

// 图表引用
const trendChartRef = ref<HTMLElement>()
const pieChartRef = ref<HTMLElement>()
let trendChart: ECharts | null = null
let pieChart: ECharts | null = null

// 计算利润率
const profitRate = computed(() => {
  if (reportData.value.totalIncome === 0) return 0
  return ((reportData.value.netProfit / reportData.value.totalIncome) * 100).toFixed(2)
})

// 表格数据
const tableData = computed(() => {
  return reportData.value.trend.map(item => ({
    date: item.date,
    income: item.income,
    expense: item.expense,
    profit: item.income - item.expense,
    profitRate: item.income > 0 ? (((item.income - item.expense) / item.income) * 100).toFixed(2) : '0.00'
  }))
})

// 格式化金额
const formatMoney = (amount: number) => {
  return `¥${amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// 获取日期范围
const getDateRange = (range: string) => {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  
  switch (range) {
    case 'week': {
      const dayOfWeek = today.getDay()
      const startOfWeek = new Date(today)
      startOfWeek.setDate(today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1))
      const endOfWeek = new Date(startOfWeek)
      endOfWeek.setDate(startOfWeek.getDate() + 6)
      return {
        startDate: formatDate(startOfWeek),
        endDate: formatDate(endOfWeek)
      }
    }
    case 'month': {
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)
      return {
        startDate: formatDate(startOfMonth),
        endDate: formatDate(endOfMonth)
      }
    }
    case 'year': {
      const startOfYear = new Date(today.getFullYear(), 0, 1)
      const endOfYear = new Date(today.getFullYear(), 11, 31)
      return {
        startDate: formatDate(startOfYear),
        endDate: formatDate(endOfYear)
      }
    }
    default:
      return dateRange.value
  }
}

// 格式化日期
const formatDate = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// 时间范围变化
const handleTimeRangeChange = (value: string) => {
  if (value !== 'custom') {
    dateRange.value = getDateRange(value)
    fetchReportData()
  }
}

// 自定义日期变化
const handleCustomDateChange = (value: [string, string] | null) => {
  if (value && value.length === 2) {
    dateRange.value = {
      startDate: value[0],
      endDate: value[1]
    }
    fetchReportData()
  }
}

// 获取报表数据
const fetchReportData = async () => {
  loading.value = true
  try {
    const params: { startDate?: string; endDate?: string } = {}
    if (dateRange.value.startDate) {
      params.startDate = dateRange.value.startDate
    }
    if (dateRange.value.endDate) {
      params.endDate = dateRange.value.endDate
    }
    
    const response = await reportsApi.getProfitLoss(params) as any
    if (response.code === 200) {
      reportData.value = response.data
      await nextTick()
      renderCharts()
    }
  } catch (error) {
    console.error('获取报表数据失败:', error)
    ElMessage.error('获取报表数据失败，使用模拟数据展示')
    // 使用模拟数据
    generateMockData()
    await nextTick()
    renderCharts()
  } finally {
    loading.value = false
  }
}

// 生成模拟数据
const generateMockData = () => {
  const trend: TrendData[] = []
  const now = new Date()
  
  for (let i = 6; i >= 0; i--) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    const income = Math.floor(Math.random() * 50000) + 10000
    const expense = Math.floor(Math.random() * 30000) + 5000
    trend.push({
      date: formatDate(date),
      income,
      expense
    })
  }
  
  const totalIncome = trend.reduce((sum, item) => sum + item.income, 0)
  const totalExpense = trend.reduce((sum, item) => sum + item.expense, 0)
  
  reportData.value = {
    totalIncome,
    totalExpense,
    netProfit: totalIncome - totalExpense,
    incomeByCategory: [
      { category: '产品销售', amount: totalIncome * 0.5, percentage: 50 },
      { category: '服务收入', amount: totalIncome * 0.3, percentage: 30 },
      { category: '咨询费用', amount: totalIncome * 0.15, percentage: 15 },
      { category: '其他收入', amount: totalIncome * 0.05, percentage: 5 }
    ],
    expenseByCategory: [
      { category: '人员工资', amount: totalExpense * 0.4, percentage: 40 },
      { category: '办公费用', amount: totalExpense * 0.25, percentage: 25 },
      { category: '营销推广', amount: totalExpense * 0.2, percentage: 20 },
      { category: '其他支出', amount: totalExpense * 0.15, percentage: 15 }
    ],
    trend
  }
}

// 渲染图表
const renderCharts = () => {
  renderTrendChart()
  renderPieChart()
}

// 渲染趋势图
const renderTrendChart = () => {
  if (!trendChartRef.value) return
  
  if (trendChart) {
    trendChart.dispose()
  }
  
  trendChart = echarts.init(trendChartRef.value)
  
  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross'
      },
      formatter: (params: any) => {
        let result = `${params[0].axisValue}<br/>`
        params.forEach((item: any) => {
          result += `${item.marker}${item.seriesName}: ¥${item.value.toLocaleString()}<br/>`
        })
        return result
      }
    },
    legend: {
      data: ['收入', '支出'],
      top: 10
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '60',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: reportData.value.trend.map(item => item.date)
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        formatter: (value: number) => `¥${(value / 1000).toFixed(0)}k`
      }
    },
    series: [
      {
        name: '收入',
        type: 'line',
        smooth: true,
        data: reportData.value.trend.map(item => item.income),
        itemStyle: {
          color: '#67C23A'
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(103, 194, 58, 0.3)' },
            { offset: 1, color: 'rgba(103, 194, 58, 0.1)' }
          ])
        }
      },
      {
        name: '支出',
        type: 'line',
        smooth: true,
        data: reportData.value.trend.map(item => item.expense),
        itemStyle: {
          color: '#F56C6C'
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(245, 108, 108, 0.3)' },
            { offset: 1, color: 'rgba(245, 108, 108, 0.1)' }
          ])
        }
      }
    ]
  }
  
  trendChart.setOption(option)
}

// 渲染饼图
const renderPieChart = () => {
  if (!pieChartRef.value) return
  
  if (pieChart) {
    pieChart.dispose()
  }
  
  pieChart = echarts.init(pieChartRef.value)
  
  const data = categoryType.value === 'income' 
    ? reportData.value.incomeByCategory 
    : reportData.value.expenseByCategory
  
  const option = {
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => {
        return `${params.name}<br/>${params.marker}金额: ¥${params.value.toLocaleString()}<br/>占比: ${params.percent}%`
      }
    },
    legend: {
      orient: 'vertical',
      right: 10,
      top: 'center',
      itemWidth: 10,
      itemHeight: 10
    },
    series: [
      {
        name: categoryType.value === 'income' ? '收入分类' : '支出分类',
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['40%', '50%'],
        avoidLabelOverlap: false,
        label: {
          show: false,
          position: 'center'
        },
        emphasis: {
          label: {
            show: true,
            fontSize: '16',
            fontWeight: 'bold'
          }
        },
        labelLine: {
          show: false
        },
        data: data.map(item => ({
          value: item.amount,
          name: item.category
        }))
      }
    ],
    color: categoryType.value === 'income' 
      ? ['#67C23A', '#409EFF', '#E6A23C', '#909399'] 
      : ['#F56C6C', '#E6A23C', '#409EFF', '#909399']
  }
  
  pieChart.setOption(option)
}

// 导出 Excel
const exportToExcel = async () => {
  exporting.value = true
  try {
    // 创建工作簿
    // @ts-ignore
    const wb = XLSX.utils.book_new()
    
    // 趋势数据工作表
    const trendWsData = [
      ['日期', '收入', '支出', '净利润', '利润率'],
      ...reportData.value.trend.map(item => [
        item.date,
        item.income,
        item.expense,
        item.income - item.expense,
        item.income > 0 ? `${(((item.income - item.expense) / item.income) * 100).toFixed(2)}%` : '0.00%'
      ])
    ]
    // @ts-ignore
    const trendWs = XLSX.utils.aoa_to_sheet(trendWsData)
    // @ts-ignore
    XLSX.utils.book_append_sheet(wb, trendWs, '收支趋势')
    
    // 分类数据工作表
    const categoryWsData = [
      ['收入分类', '金额', '占比'],
      ...reportData.value.incomeByCategory.map(item => [
        item.category,
        item.amount,
        `${item.percentage}%`
      ]),
      [],
      ['支出分类', '金额', '占比'],
      ...reportData.value.expenseByCategory.map(item => [
        item.category,
        item.amount,
        `${item.percentage}%`
      ])
    ]
    // @ts-ignore
    const categoryWs = XLSX.utils.aoa_to_sheet(categoryWsData)
    // @ts-ignore
    XLSX.utils.book_append_sheet(wb, categoryWs, '分类占比')
    
    // 汇总数据工作表
    const summaryWsData = [
      ['财务汇总报表'],
      [],
      ['时间范围', timeRange.value === 'custom' ? `${dateRange.value.startDate} 至 ${dateRange.value.endDate}` : getTimeRangeText()],
      ['生成时间', new Date().toLocaleString('zh-CN')],
      [],
      ['总收入', reportData.value.totalIncome],
      ['总支出', reportData.value.totalExpense],
      ['净利润', reportData.value.netProfit],
      ['利润率', `${profitRate.value}%`]
    ]
    // @ts-ignore
    const summaryWs = XLSX.utils.aoa_to_sheet(summaryWsData)
    // @ts-ignore
    XLSX.utils.book_append_sheet(wb, summaryWs, '汇总')
    
    // 生成文件
    // @ts-ignore
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' }) as ArrayBuffer
    const blob = new Blob([wbout], { type: 'application/octet-stream' })
    
    // 下载文件
    const fileName = `财务报表_${new Date().toISOString().split('T')[0]}.xlsx`
    saveAs(blob, fileName)
    
    ElMessage.success('导出成功')
  } catch (error) {
    console.error('导出失败:', error)
    ElMessage.error('导出失败，请重试')
  } finally {
    exporting.value = false
  }
}

// 获取时间范围文本
const getTimeRangeText = () => {
  switch (timeRange.value) {
    case 'week':
      return '本周'
    case 'month':
      return '本月'
    case 'year':
      return '本年'
    default:
      return '自定义'
  }
}

// 查看详情
const viewDetail = (row: any) => {
  ElMessage.info(`查看 ${row.date} 的详细数据`)
}

// 窗口大小变化时重新渲染图表
const handleResize = () => {
  trendChart?.resize()
  pieChart?.resize()
}

// 监听分类类型变化
const unwatchCategoryType = ref()

onMounted(() => {
  // 初始化日期范围
  dateRange.value = getDateRange('month')
  
  // 获取数据
  fetchReportData()
  
  // 监听窗口大小变化
  window.addEventListener('resize', handleResize)
  
  // 监听分类类型变化
  unwatchCategoryType.value = watch(categoryType, () => {
    nextTick(() => {
      renderPieChart()
    })
  })
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  trendChart?.dispose()
  pieChart?.dispose()
  unwatchCategoryType.value?.()
})
</script>

<script lang="ts">
export default {
  name: 'Reports'
}
</script>

<style lang="scss" scoped>
.reports-page {
  padding: 0;
}

.filter-card {
  margin-bottom: 20px;
  
  .filter-container {
    display: flex;
    align-items: center;
    gap: 20px;
    flex-wrap: wrap;
    
    .time-range-buttons {
      flex: 1;
    }
    
    .date-picker {
      flex: 1;
    }
  }
}

.stat-cards {
  margin-bottom: 20px;
}

.stat-card {
  .stat-content {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  
  .stat-icon {
    width: 60px;
    height: 60px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
  }
  
  .stat-info {
    flex: 1;
  }
  
  .stat-value {
    font-size: 24px;
    font-weight: 600;
    color: #1a1a2e;
    
    &.negative {
      color: #F56C6C;
    }
  }
  
  .stat-label {
    font-size: 14px;
    color: #909399;
    margin-top: 4px;
  }
  
  &.income-card .stat-icon {
    background: linear-gradient(135deg, #67C23A 0%, #85ce61 100%);
  }
  
  &.expense-card .stat-icon {
    background: linear-gradient(135deg, #F56C6C 0%, #f78989 100%);
  }
  
  &.profit-card .stat-icon {
    background: linear-gradient(135deg, #409EFF 0%, #66b1ff 100%);
  }
  
  &.rate-card .stat-icon {
    background: linear-gradient(135deg, #E6A23C 0%, #ebb563 100%);
  }
}

.charts-row {
  margin-bottom: 20px;
}

.chart-container {
  height: 350px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.table-card {
  margin-top: 20px;
}

.income-text {
  color: #67C23A;
  font-weight: 500;
}

.expense-text {
  color: #F56C6C;
  font-weight: 500;
}
</style>