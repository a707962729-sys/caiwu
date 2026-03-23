<template>
  <div class="dashboard-page">
    <!-- 头部 -->
    <div class="header">
      <van-nav-bar title="数据大屏" left-arrow @click-left="$router.back()">
        <template #right>
          <van-icon name="replay" size="20" @click="refreshAll" class="refresh-btn" :class="{ 'animate-spin': isRefreshing }" />
        </template>
      </van-nav-bar>
    </div>
    
    <!-- 加载骨架屏 -->
    <template v-if="loading">
      <div class="metrics-row">
        <div class="metric-skeleton card-elevated">
          <Skeleton type="card" />
        </div>
        <div class="metric-skeleton card-elevated">
          <Skeleton type="card" />
        </div>
      </div>
      <div class="chart-card card-elevated">
        <Skeleton type="chart" />
      </div>
    </template>
    
    <!-- 核心指标 -->
    <template v-else>
      <div class="metrics-row">
        <div class="metric-card income card-elevated fade-in-up" @click="showDetail('income')">
          <div class="metric-decoration"></div>
          <div class="metric-icon">
            <span>💰</span>
            <div class="icon-bg"></div>
          </div>
          <div class="metric-info">
            <div class="metric-value" :class="{ 'number-bounce': animatedMetrics.income }">¥{{ formatMoney(overview.totalIncome) }}</div>
            <div class="metric-label">总收入</div>
          </div>
          <div class="metric-trend up" v-if="trends.income">
            <van-icon name="arrow-up" /> {{ trends.income }}%
          </div>
        </div>
        <div class="metric-card expense card-elevated fade-in-up" style="animation-delay: 0.1s" @click="showDetail('expense')">
          <div class="metric-decoration"></div>
          <div class="metric-icon">
            <span>💸</span>
            <div class="icon-bg"></div>
          </div>
          <div class="metric-info">
            <div class="metric-value" :class="{ 'number-bounce': animatedMetrics.expense }">¥{{ formatMoney(overview.totalExpense) }}</div>
            <div class="metric-label">总支出</div>
          </div>
          <div class="metric-trend down" v-if="trends.expense">
            <van-icon name="arrow-down" /> {{ trends.expense }}%
          </div>
        </div>
      </div>
      
      <div class="metrics-row">
        <div class="metric-card profit card-elevated fade-in-up" style="animation-delay: 0.15s" @click="showDetail('profit')">
          <div class="metric-decoration"></div>
          <div class="metric-icon">
            <span>📈</span>
            <div class="icon-bg"></div>
          </div>
          <div class="metric-info">
            <div class="metric-value" :class="{ positive: overview.netProfit > 0, negative: overview.netProfit < 0, 'number-bounce': animatedMetrics.profit }">
              ¥{{ formatMoney(overview.netProfit) }}
            </div>
            <div class="metric-label">净利润</div>
          </div>
        </div>
        <div class="metric-card balance card-elevated fade-in-up" style="animation-delay: 0.2s" @click="showDetail('balance')">
          <div class="metric-decoration"></div>
          <div class="metric-icon">
            <span>🏦</span>
            <div class="icon-bg"></div>
          </div>
          <div class="metric-info">
            <div class="metric-value" :class="{ 'number-bounce': animatedMetrics.balance }">¥{{ formatMoney(overview.totalBalance) }}</div>
            <div class="metric-label">账户余额</div>
          </div>
        </div>
      </div>
    </template>
    
    <!-- 收支趋势 -->
    <div class="chart-card card-elevated fade-in-up" style="animation-delay: 0.25s">
      <div class="card-header">
        <span class="card-title">📊 收支趋势</span>
        <div class="period-tabs">
          <span :class="{ active: period === 'month' }" @click="changePeriod('month')">月</span>
          <span :class="{ active: period === 'quarter' }" @click="changePeriod('quarter')">季</span>
          <span :class="{ active: period === 'year' }" @click="changePeriod('year')">年</span>
        </div>
      </div>
      <div class="chart-wrap" ref="trendChartRef" v-if="!chartLoading"></div>
      <div class="chart-loading" v-else>
        <div class="chart-skeleton">
          <div class="skeleton-bar" v-for="i in 6" :key="i" :style="{ height: (Math.random() * 60 + 40) + 'px', animationDelay: i * 0.1 + 's' }"></div>
        </div>
      </div>
    </div>
    
    <!-- 支出构成 -->
    <div class="chart-card card-elevated fade-in-up" style="animation-delay: 0.3s">
      <div class="card-header">
        <span class="card-title">🥧 支出构成</span>
        <span class="card-action ripple" @click="showCategoryDetail">详情</span>
      </div>
      <div class="chart-wrap" ref="pieChartRef" v-if="!chartLoading"></div>
      <div class="chart-loading" v-else>
        <div class="pie-skeleton">
          <div class="pie-ring"></div>
          <div class="pie-legend">
            <div class="legend-item" v-for="i in 4" :key="i">
              <div class="legend-dot"></div>
              <div class="legend-line"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 应收应付 -->
    <div class="chart-card card-elevated fade-in-up" style="animation-delay: 0.35s">
      <div class="card-header">
        <span class="card-title">📋 应收应付</span>
      </div>
      <div class="rp-cards">
        <div class="rp-card receivable ripple" @click="$router.push('/receivables')">
          <div class="rp-header">
            <span class="rp-title">应收账款</span>
            <span class="rp-total">¥{{ formatMoney(overview.receivable) }}</span>
          </div>
          <div class="rp-progress">
            <div class="progress-bar">
              <div class="progress" :style="{ width: receivePercent + '%' }">
                <div class="progress-shine"></div>
              </div>
            </div>
            <div class="progress-info">
              <span>已收 ¥{{ formatMoney(overview.received) }}</span>
              <span>{{ receivePercent }}%</span>
            </div>
          </div>
          <div class="rp-action">
            <span>查看详情</span>
            <van-icon name="arrow" />
          </div>
        </div>
        
        <div class="rp-card payable ripple" @click="$router.push('/payables')">
          <div class="rp-header">
            <span class="rp-title">应付账款</span>
            <span class="rp-total">¥{{ formatMoney(overview.payable) }}</span>
          </div>
          <div class="rp-progress">
            <div class="progress-bar">
              <div class="progress" :style="{ width: payPercent + '%' }">
                <div class="progress-shine"></div>
              </div>
            </div>
            <div class="progress-info">
              <span>已付 ¥{{ formatMoney(overview.paid) }}</span>
              <span>{{ payPercent }}%</span>
            </div>
          </div>
          <div class="rp-action">
            <span>查看详情</span>
            <van-icon name="arrow" />
          </div>
        </div>
      </div>
    </div>
    
    <!-- 资金账户 -->
    <div class="chart-card card-elevated fade-in-up" style="animation-delay: 0.4s">
      <div class="card-header">
        <span class="card-title">💳 资金账户</span>
        <span class="card-action ripple" @click="manageAccounts">管理</span>
      </div>
      <div class="account-list">
        <div class="account-item ripple fade-in-up" v-for="(acc, index) in accounts" :key="acc.id"
             :style="{ animationDelay: 0.45 + index * 0.05 + 's' }">
          <div class="account-icon" :class="acc.account_type">{{ getAccountIcon(acc.account_type) }}</div>
          <div class="account-info">
            <div class="account-name">{{ acc.name }}</div>
            <div class="account-no">{{ acc.account_no || '—' }}</div>
          </div>
          <div class="account-balance">¥{{ formatMoney(acc.balance) }}</div>
        </div>
      </div>
      <div class="account-total">
        <span>资金总计</span>
        <span class="total-value">¥{{ formatMoney(overview.totalBalance) }}</span>
      </div>
    </div>
    
    <!-- 底部占位 -->
    <div style="height: 20px;"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, reactive, watch } from 'vue'
import { showToast } from 'vant'
import * as echarts from 'echarts'
import { dashboardApi } from '@/api'
import Skeleton from '@/components/Skeleton.vue'

const period = ref<'month' | 'quarter' | 'year'>('month')
const loading = ref(true)
const chartLoading = ref(false)
const isRefreshing = ref(false)

const overview = ref({
  totalIncome: 0,
  totalExpense: 0,
  netProfit: 0,
  totalBalance: 0,
  receivable: 0,
  received: 0,
  payable: 0,
  paid: 0
})

const trends = ref({
  income: 0,
  expense: 0
})

const accounts = ref<any[]>([])

const animatedMetrics = reactive({
  income: false,
  expense: false,
  profit: false,
  balance: false
})

const trendChartRef = ref<HTMLElement>()
const pieChartRef = ref<HTMLElement>()
let trendChart: echarts.ECharts | null = null
let pieChart: echarts.ECharts | null = null
let abortController: AbortController | null = null

const receivePercent = computed(() => {
  if (!overview.value.receivable) return 0
  return Math.round(overview.value.received / overview.value.receivable * 100)
})

const payPercent = computed(() => {
  if (!overview.value.payable) return 0
  return Math.round(overview.value.paid / overview.value.payable * 100)
})

const formatMoney = (n: number) => {
  if (!n) return '0'
  if (n >= 10000) return (n / 10000).toFixed(1) + '万'
  return n.toLocaleString()
}

const getAccountIcon = (type: string) => {
  const icons: Record<string, string> = {
    bank: '🏦', cash: '💵', alipay: '📱', wechat: '💚', other: '💳'
  }
  return icons[type] || '💳'
}

// 触发数字动画
const triggerNumberAnimation = () => {
  Object.keys(animatedMetrics).forEach((key, index) => {
    setTimeout(() => {
      animatedMetrics[key as keyof typeof animatedMetrics] = true
      setTimeout(() => {
        animatedMetrics[key as keyof typeof animatedMetrics] = false
      }, 150)
    }, index * 50)
  })
}

// 取消请求
const abortRequests = () => {
  if (abortController) {
    abortController.abort()
    abortController = null
  }
}

// 加载数据
const loadData = async () => {
  abortController = new AbortController()
  loading.value = true
  
  try {
    const data = await dashboardApi.getOverview()
    
    overview.value = {
      totalIncome: data.incomeExpense?.income || 0,
      totalExpense: data.incomeExpense?.expense || 0,
      netProfit: data.incomeExpense?.net || 0,
      totalBalance: data.accounts?.total || 0,
      receivable: data.receivablesPayables?.receivable || 0,
      received: data.receivablesPayables?.received || 0,
      payable: data.receivablesPayables?.payable || 0,
      paid: data.receivablesPayables?.paid || 0
    }
    accounts.value = data.accounts?.list || []
    
    // 计算趋势
    trends.value = {
      income: data.trends?.income || 0,
      expense: data.trends?.expense || 0
    }
    
    // 触发数字动画
    triggerNumberAnimation()
  } catch (e: any) {
    if (e.name !== 'AbortError') {
      console.error('加载数据失败', e)
      showToast('加载失败，点击右上角重试')
    }
  } finally {
    loading.value = false
  }
}

// 初始化图表
const initCharts = async () => {
  chartLoading.value = true
  
  try {
    const [cashflowData, categoryData] = await Promise.all([
      dashboardApi.getCashflow({ months: period.value === 'year' ? 12 : period.value === 'quarter' ? 3 : 6 }),
      dashboardApi.getCategory()
    ])
    
    chartLoading.value = false
    
    await nextTick()
    
    // API 返回的是数组，需要转换格式
    // cashflowData 格式: [{month, income, expense, net}, ...]
    const labels = (cashflowData || []).map((item: any) => {
      const [year, month] = item.month.split('-')
      return `${month}月`
    })
    const incomeData = (cashflowData || []).map((item: any) => item.income || 0)
    const expenseData = (cashflowData || []).map((item: any) => item.expense || 0)
    
    // categoryData 格式: { categories: [{transaction_type, category, total, count}, ...] }
    const categories = categoryData?.categories || []
    const expenseCategories = categories
      .filter((c: any) => c.transaction_type === 'expense')
      .sort((a: any, b: any) => b.total - a.total)
      .slice(0, 5)
    
    // 收支趋势图
    if (trendChartRef.value) {
      if (trendChart) trendChart.dispose()
      trendChart = echarts.init(trendChartRef.value)
      
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
          bottom: 0,
          itemWidth: 12,
          itemHeight: 12
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
                { offset: 0, color: '#07c160' },
                { offset: 1, color: '#a0f5c8' }
              ]),
              borderRadius: [6, 6, 0, 0]
            },
            barWidth: 24,
            animationDelay: (idx: number) => idx * 100
          },
          { 
            name: '支出', 
            type: 'bar', 
            data: expenseData,
            itemStyle: { 
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: '#ee0a24' },
                { offset: 1, color: '#ffb3b3' }
              ]),
              borderRadius: [6, 6, 0, 0]
            },
            barWidth: 24,
            animationDelay: (idx: number) => idx * 100 + 50
          }
        ],
        animationEasing: 'elasticOut',
        animationDuration: 1000
      })
    }
    
    // 支出构成饼图
    if (pieChartRef.value) {
      if (pieChart) pieChart.dispose()
      pieChart = echarts.init(pieChartRef.value)
      
      const colors = [
        new echarts.graphic.LinearGradient(0, 0, 1, 1, [
          { offset: 0, color: '#667eea' },
          { offset: 1, color: '#764ba2' }
        ]),
        new echarts.graphic.LinearGradient(0, 0, 1, 1, [
          { offset: 0, color: '#07c160' },
          { offset: 1, color: '#00d084' }
        ]),
        new echarts.graphic.LinearGradient(0, 0, 1, 1, [
          { offset: 0, color: '#ff976a' },
          { offset: 1, color: '#ffbe76' }
        ]),
        new echarts.graphic.LinearGradient(0, 0, 1, 1, [
          { offset: 0, color: '#9c7cfa' },
          { offset: 1, color: '#b794f6' }
        ]),
        new echarts.graphic.LinearGradient(0, 0, 1, 1, [
          { offset: 0, color: '#ffc0cb' },
          { offset: 1, color: '#ff85a2' }
        ])
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
          data: expenseCategories.map((item: any, index: number) => ({
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
            label: { show: true, fontSize: 14, fontWeight: 'bold' },
            itemStyle: {
              shadowBlur: 20,
              shadowColor: 'rgba(0, 0, 0, 0.2)'
            }
          },
          animationType: 'scale',
          animationEasing: 'elasticOut',
          animationDelay: (idx: number) => idx * 100
        }]
      })
    }
  } catch (e) {
    chartLoading.value = false
    console.error('加载图表失败', e)
  }
}

// 切换周期
const changePeriod = (newPeriod: 'month' | 'quarter' | 'year') => {
  period.value = newPeriod
  initCharts()
}

// 刷新全部
const refreshAll = async () => {
  if (isRefreshing.value) return
  isRefreshing.value = true
  abortRequests()
  await loadData()
  await initCharts()
  setTimeout(() => {
    isRefreshing.value = false
    showToast('刷新成功')
  }, 300)
}

// 详情页面
const showDetail = (type: string) => {
  // 可以跳转到对应详情页
  showToast('功能开发中')
}

const showCategoryDetail = () => {
  showToast('功能开发中')
}

const manageAccounts = () => {
  showToast('功能开发中')
}

onMounted(async () => {
  await loadData()
  await initCharts()
})

onUnmounted(() => {
  abortRequests()
  if (trendChart) trendChart.dispose()
  if (pieChart) pieChart.dispose()
})
</script>

<style scoped>
.dashboard-page {
  min-height: 100vh;
  background: #f5f6fa;
}

/* 刷新按钮动画 */
.refresh-btn {
  transition: transform 0.3s ease;
}

.refresh-btn.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* 卡片阴影 */
.card-elevated {
  background-color: #fff;
  border-radius: 12px;
  box-shadow: 
    0 2px 4px rgba(0, 0, 0, 0.02),
    0 4px 8px rgba(0, 0, 0, 0.04),
    0 8px 16px rgba(0, 0, 0, 0.06);
  transition: box-shadow 0.3s ease, transform 0.3s ease;
}

.card-elevated:active {
  box-shadow: 
    0 1px 2px rgba(0, 0, 0, 0.02),
    0 2px 4px rgba(0, 0, 0, 0.04);
  transform: scale(0.99);
}

/* 骨架屏容器 */
.metric-skeleton {
  flex: 1;
  padding: 16px;
}

/* 指标卡片 */
.metrics-row {
  display: flex;
  gap: 10px;
  padding: 0 12px;
  margin-bottom: 10px;
}

.metric-card {
  flex: 1;
  background: #fff;
  border-radius: 12px;
  padding: 14px;
  display: flex;
  align-items: center;
  gap: 10px;
  position: relative;
  cursor: pointer;
  transition: all 0.3s ease;
  overflow: hidden;
}

.metric-card:active {
  transform: scale(0.98);
}

.metric-decoration {
  position: absolute;
  top: 0;
  right: 0;
  width: 60px;
  height: 60px;
  border-radius: 0 12px 0 60px;
  opacity: 0.1;
}

.metric-card.income .metric-decoration { background: linear-gradient(135deg, #07c160, #00d084); }
.metric-card.expense .metric-decoration { background: linear-gradient(135deg, #ee0a24, #ff6b6b); }
.metric-card.profit .metric-decoration { background: linear-gradient(135deg, #1989fa, #4facfe); }
.metric-card.balance .metric-decoration { background: linear-gradient(135deg, #9c7cfa, #b794f6); }

.metric-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  position: relative;
}

.icon-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  border-radius: 12px;
  opacity: 0.15;
}

.metric-card.income .icon-bg { background: linear-gradient(135deg, #07c160, #00d084); }
.metric-card.expense .icon-bg { background: linear-gradient(135deg, #ee0a24, #ff6b6b); }
.metric-card.profit .icon-bg { background: linear-gradient(135deg, #1989fa, #4facfe); }
.metric-card.balance .icon-bg { background: linear-gradient(135deg, #9c7cfa, #b794f6); }

.metric-value {
  font-size: 18px;
  font-weight: 700;
  transition: transform 0.15s ease;
}

.metric-card.income .metric-value { color: #07c160; }
.metric-card.expense .metric-value { color: #ee0a24; }
.metric-card.profit .metric-value { color: #1989fa; }
.metric-card.balance .metric-value { color: #9c7cfa; }
.metric-value.positive { color: #07c160; }
.metric-value.negative { color: #ee0a24; }

.metric-label {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}

.metric-trend {
  position: absolute;
  top: 10px;
  right: 10px;
  font-size: 11px;
  display: flex;
  align-items: center;
  padding: 2px 6px;
  border-radius: 8px;
}

.metric-trend.up { 
  color: #07c160; 
  background: rgba(7, 193, 96, 0.1);
}
.metric-trend.down { 
  color: #ee0a24; 
  background: rgba(238, 10, 36, 0.1);
}

/* 图表卡片 */
.chart-card {
  background: #fff;
  margin: 12px;
  padding: 16px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.card-title {
  font-size: 15px;
  font-weight: 600;
  color: #333;
}

.card-action {
  font-size: 12px;
  color: #667eea;
  padding: 4px 8px;
  border-radius: 8px;
}

.card-action:active {
  background: #f5f6fa;
}

.period-tabs {
  display: flex;
  gap: 8px;
}

.period-tabs span {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  color: #999;
  background: #f5f6fa;
  transition: all 0.3s ease;
  cursor: pointer;
}

.period-tabs span:active {
  transform: scale(0.95);
}

.period-tabs span.active {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
}

.chart-wrap {
  height: 200px;
}

.chart-loading {
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 图表骨架屏动画 */
.chart-skeleton {
  display: flex;
  justify-content: space-around;
  align-items: flex-end;
  height: 150px;
  width: 100%;
  padding: 0 20px;
}

.skeleton-bar {
  width: 30px;
  background: linear-gradient(180deg, #e8e8e8 0%, #f5f5f5 100%);
  border-radius: 6px 6px 0 0;
  animation: barGrow 0.8s ease-out forwards;
  transform-origin: bottom;
}

@keyframes barGrow {
  from {
    transform: scaleY(0);
    opacity: 0;
  }
  to {
    transform: scaleY(1);
    opacity: 1;
  }
}

/* 饼图骨架屏 */
.pie-skeleton {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 40px;
  height: 150px;
}

.pie-ring {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  border: 20px solid #f0f0f0;
  border-top-color: #e8e8e8;
  border-right-color: #e8e8e8;
  animation: spin 2s linear infinite;
}

.pie-legend {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #e8e8e8;
  animation: dotPulse 1.5s ease-in-out infinite;
}

.legend-line {
  width: 60px;
  height: 10px;
  border-radius: 5px;
  background: #f0f0f0;
}

@keyframes dotPulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.2); }
}

/* 应收应付 */
.rp-cards {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.rp-card {
  background: #f9fafb;
  border-radius: 12px;
  padding: 14px;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.rp-card:active {
  background: #f0f0f0;
  transform: scale(0.99);
}

.rp-card.receivable { 
  border-left: 4px solid;
  border-image: linear-gradient(180deg, #07c160, #00d084) 1;
}
.rp-card.payable { 
  border-left: 4px solid;
  border-image: linear-gradient(180deg, #ee0a24, #ff6b6b) 1;
}

.rp-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.rp-title {
  font-size: 14px;
  color: #666;
}

.rp-total {
  font-size: 18px;
  font-weight: 700;
}

.rp-card.receivable .rp-total { color: #07c160; }
.rp-card.payable .rp-total { color: #ee0a24; }

.rp-progress .progress-bar {
  height: 8px;
  background: #e5e5e5;
  border-radius: 4px;
  overflow: hidden;
  position: relative;
}

.rp-progress .progress {
  height: 100%;
  border-radius: 4px;
  transition: width 0.6s ease;
  position: relative;
  overflow: hidden;
}

.rp-card.receivable .progress { 
  background: linear-gradient(90deg, #07c160, #00d084, #38ef7d);
  background-size: 200% 100%;
  animation: progressShine 2s ease-in-out infinite;
}
.rp-card.payable .progress { 
  background: linear-gradient(90deg, #ee0a24, #ff6b6b, #feca57);
  background-size: 200% 100%;
  animation: progressShine 2s ease-in-out infinite;
}

.progress-shine {
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
  animation: shine 2s ease-in-out infinite;
}

@keyframes progressShine {
  0% { background-position: 0% 0; }
  100% { background-position: 200% 0; }
}

@keyframes shine {
  0% { left: -100%; }
  50%, 100% { left: 100%; }
}

.progress-info {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #999;
  margin-top: 6px;
}

.rp-action {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #eee;
  font-size: 13px;
  color: #667eea;
}

/* 账户列表 */
.account-list {
  margin-bottom: 12px;
}

.account-item {
  display: flex;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid #f5f5f5;
}

.account-item:last-child {
  border-bottom: none;
}

.account-icon {
  width: 40px;
  height: 40px;
  background: #f5f6fa;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  margin-right: 12px;
}

.account-info {
  flex: 1;
}

.account-name {
  font-size: 14px;
  font-weight: 500;
  color: #333;
}

.account-no {
  font-size: 12px;
  color: #999;
  margin-top: 2px;
}

.account-balance {
  font-size: 15px;
  font-weight: 600;
  color: #333;
}

.account-total {
  display: flex;
  justify-content: space-between;
  padding-top: 12px;
  border-top: 1px solid #eee;
  font-size: 14px;
}

.total-value {
  font-size: 18px;
  font-weight: 700;
  background: linear-gradient(135deg, #667eea, #764ba2);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* 涟漪效果 */
.ripple {
  position: relative;
  overflow: hidden;
}

.ripple::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.08);
  transform: translate(-50%, -50%);
  transition: width 0.4s ease, height 0.4s ease;
}

.ripple:active::after {
  width: 200%;
  height: 200%;
}

/* 淡入动画 */
.fade-in-up {
  animation: fadeInUp 0.4s ease-out forwards;
  opacity: 0;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 数字跳动 */
.number-bounce {
  animation: numberBounce 0.15s ease-in-out;
}

@keyframes numberBounce {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.08); }
}
</style>