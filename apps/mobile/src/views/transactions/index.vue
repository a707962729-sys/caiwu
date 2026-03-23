<template>
  <div class="page">
    <van-nav-bar title="账单" fixed placeholder>
      <template #right>
        <van-icon name="plus" size="20" @click="$router.push('/transactions/create')" />
      </template>
    </van-nav-bar>
    
    <!-- 月份选择器 -->
    <div class="month-selector">
      <van-icon name="arrow-left" @click="prevMonth" />
      <van-popover v-model:show="showMonthPicker" placement="bottom">
        <div class="month-picker">
          <div class="picker-year">
            <van-icon name="arrow-left" @click="pickerYear--" />
            <span>{{ pickerYear }}年</span>
            <van-icon name="arrow-right" @click="pickerYear++" />
          </div>
          <div class="picker-months">
            <span 
              v-for="m in 12" 
              :key="m"
              :class="{ active: pickerYear === currentYear && m === currentMonth }"
              @click="selectMonth(m)"
            >{{ m }}月</span>
          </div>
        </div>
        <template #reference>
          <span class="month-text">{{ currentYear }}年{{ currentMonth }}月</span>
        </template>
      </van-popover>
      <van-icon name="arrow-right" @click="nextMonth" />
    </div>
    
    <!-- 收支统计 -->
    <div class="summary-bar">
      <div class="summary-item">
        <span class="label">收入</span>
        <span class="value income">+{{ formatMoney(summary.income) }}</span>
      </div>
      <div class="summary-item">
        <span class="label">支出</span>
        <span class="value expense">-{{ formatMoney(summary.expense) }}</span>
      </div>
      <div class="summary-item">
        <span class="label">结余</span>
        <span class="value" :class="{ positive: summary.net > 0, negative: summary.net < 0 }">
          {{ summary.net >= 0 ? '' : '-' }}{{ formatMoney(Math.abs(summary.net)) }}
        </span>
      </div>
    </div>
    
    <!-- 筛选标签 -->
    <div class="filter-tabs">
      <span :class="{ active: filterType === 'all' }" @click="filterType = 'all'">全部</span>
      <span :class="{ active: filterType === 'income' }" @click="filterType = 'income'">收入</span>
      <span :class="{ active: filterType === 'expense' }" @click="filterType = 'expense'">支出</span>
    </div>
    
    <!-- 账单列表 -->
    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <div class="bill-list">
        <!-- 加载骨架屏 -->
        <template v-if="loading && transactions.length === 0">
          <div class="date-group">
            <div class="date-header">
              <Skeleton type="text" width="80px" />
            </div>
            <div class="bill-items">
              <div class="bill-item" v-for="i in 5" :key="i">
                <Skeleton type="avatar" />
                <div style="flex: 1; margin-left: 12px;">
                  <Skeleton type="text" width="60%" />
                  <Skeleton type="text" width="40%" style="margin-top: 8px;" />
                </div>
                <Skeleton type="text" width="60px" />
              </div>
            </div>
          </div>
        </template>
        
        <!-- 空状态 -->
        <van-empty v-else-if="filteredTransactions.length === 0" description="暂无账单" image-size="100">
          <van-button type="primary" size="small" @click="$router.push('/transactions/create')">
            立即记账
          </van-button>
        </van-empty>
        
        <!-- 账单分组 -->
        <template v-else>
          <div class="date-group" v-for="group in groupedTransactions" :key="group.date">
            <div class="date-header">
              <span class="date-text">{{ formatDate(group.date) }}</span>
              <span class="date-summary">
                <span class="income" v-if="group.income > 0">收: {{ formatMoney(group.income) }}</span>
                <span class="expense" v-if="group.expense > 0">支: {{ formatMoney(group.expense) }}</span>
              </span>
            </div>
            <div class="bill-items">
              <div class="bill-item" 
                   v-for="item in group.items" 
                   :key="item.id"
                   @click="$router.push(`/transactions/${item.id}`)">
                <div class="bill-icon" :class="item.transaction_type">
                  {{ getCategoryIcon(item.category) }}
                </div>
                <div class="bill-info">
                  <div class="bill-category">{{ item.category }}</div>
                  <div class="bill-desc">{{ item.description || '无备注' }}</div>
                </div>
                <div class="bill-amount" :class="item.transaction_type">
                  {{ item.transaction_type === 'income' ? '+' : '-' }}{{ formatMoney(item.amount) }}
                </div>
              </div>
            </div>
          </div>
        </template>
        
        <!-- 加载更多 -->
        <div class="load-more" v-if="hasMore" @click="loadMore">
          <van-loading v-if="loadingMore" size="16" />
          <span v-else>加载更多</span>
        </div>
        
        <div class="no-more" v-else-if="transactions.length > 0">
          <span>— 已全部加载 —</span>
        </div>
      </div>
    </van-pull-refresh>
    
    <!-- 浮动记账按钮 -->
    <div class="fab" @click="$router.push('/transactions/create')">
      <van-icon name="plus" size="24" />
    </div>
    
    <div style="height: 20px;"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { transactionApi } from '@/api'
import Skeleton from '@/components/Skeleton.vue'

// 时间选择
const currentYear = ref(new Date().getFullYear())
const currentMonth = ref(new Date().getMonth() + 1)
const pickerYear = ref(currentYear.value)
const showMonthPicker = ref(false)

// 数据状态
const transactions = ref<any[]>([])
const summary = ref({ income: 0, expense: 0, net: 0 })
const loading = ref(true)
const loadingMore = ref(false)
const refreshing = ref(false)
const hasMore = ref(false)

// 筛选
const filterType = ref<'all' | 'income' | 'expense'>('all')

// 分页
let page = 1
const pageSize = 20

// 筛选后的账单
const filteredTransactions = computed(() => {
  if (filterType.value === 'all') return transactions.value
  return transactions.value.filter(t => t.transaction_type === filterType.value)
})

// 按日期分组
const groupedTransactions = computed(() => {
  const groups: Record<string, any> = {}
  
  filteredTransactions.value.forEach(item => {
    const date = item.transaction_date
    if (!groups[date]) {
      groups[date] = { date, items: [], income: 0, expense: 0 }
    }
    groups[date].items.push(item)
    if (item.transaction_type === 'income') {
      groups[date].income += item.amount
    } else {
      groups[date].expense += item.amount
    }
  })
  
  return Object.values(groups).sort((a: any, b: any) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  )
})

// 工具函数
const formatMoney = (n: number) => {
  if (!n) return '0'
  if (n >= 10000) return (n / 10000).toFixed(1) + '万'
  return n.toFixed(0)
}

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  
  if (dateStr === today.toISOString().split('T')[0]) return '今天'
  if (dateStr === yesterday.toISOString().split('T')[0]) return '昨天'
  
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

const getCategoryIcon = (cat: string) => {
  const icons: Record<string, string> = {
    '销售收入': '💵', '服务收入': '💼', '利息收入': '🏦', '利息': '🏦',
    '人员工资': '👥', '办公费用': '📋', '办公': '📋', '差旅费': '✈️', '差旅': '✈️',
    '采购成本': '📦', '采购': '📦', '房租物业': '🏢', '房租': '🏢',
    '餐饮': '🍜', '交通': '🚗', '购物': '🛒', '工资': '👥',
    '其他': '📌', '其他支出': '📌', '其他收入': '📌'
  }
  return icons[cat] || '📌'
}

// 月份切换
const prevMonth = () => {
  if (currentMonth.value === 1) {
    currentMonth.value = 12
    currentYear.value--
  } else {
    currentMonth.value--
  }
  loadData()
}

const nextMonth = () => {
  if (currentMonth.value === 12) {
    currentMonth.value = 1
    currentYear.value++
  } else {
    currentMonth.value++
  }
  loadData()
}

const selectMonth = (m: number) => {
  currentYear.value = pickerYear.value
  currentMonth.value = m
  showMonthPicker.value = false
  loadData()
}

// 加载数据
const loadData = async (isLoadMore = false) => {
  if (isLoadMore) {
    loadingMore.value = true
  } else {
    loading.value = true
    page = 1
  }
  
  try {
    const startDate = `${currentYear.value}-${String(currentMonth.value).padStart(2, '0')}-01`
    const endDate = new Date(currentYear.value, currentMonth.value, 0).toISOString().split('T')[0]
    
    const res = await transactionApi.getList({ 
      startDate, 
      endDate, 
      page,
      pageSize
    })
    
    if (isLoadMore) {
      transactions.value = [...transactions.value, ...(res.list || [])]
    } else {
      transactions.value = res.list || []
    }
    
    summary.value = {
      income: res.summary?.total_income || 0,
      expense: res.summary?.total_expense || 0,
      net: (res.summary?.total_income || 0) - (res.summary?.total_expense || 0)
    }
    
    hasMore.value = transactions.value.length < (res.total || 0)
  } catch (e) {
    console.error('加载失败', e)
  } finally {
    loading.value = false
    loadingMore.value = false
    refreshing.value = false
  }
}

const loadMore = () => {
  page++
  loadData(true)
}

const onRefresh = () => {
  loadData()
}

// 监听筛选变化
watch(filterType, () => {
  // 筛选变化时不需要重新请求，前端筛选即可
})

onMounted(() => loadData())
</script>

<style scoped>
.page {
  background: #f5f6fa;
  min-height: 100vh;
}

/* 月份选择器 */
.month-selector {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 12px;
  background: #fff;
  gap: 20px;
}

.month-text {
  font-size: 16px;
  font-weight: 600;
  color: #333;
  cursor: pointer;
}

.month-picker {
  padding: 12px;
  background: #fff;
  border-radius: 8px;
}

.picker-year {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  font-size: 14px;
  font-weight: 500;
}

.picker-months {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.picker-months span {
  padding: 8px;
  text-align: center;
  font-size: 13px;
  border-radius: 4px;
  background: #f5f6fa;
}

.picker-months span.active {
  background: #667eea;
  color: #fff;
}

/* 收支统计 */
.summary-bar {
  display: flex;
  background: #fff;
  padding: 12px 20px;
  border-bottom: 1px solid #f5f5f5;
}

.summary-item {
  flex: 1;
  text-align: center;
}

.summary-item .label {
  font-size: 11px;
  color: #999;
  display: block;
}

.summary-item .value {
  font-size: 15px;
  font-weight: 600;
  margin-top: 4px;
  display: block;
}

.summary-item .value.income { color: #07c160; }
.summary-item .value.expense { color: #ee0a24; }
.summary-item .value.positive { color: #07c160; }
.summary-item .value.negative { color: #ee0a24; }

/* 筛选标签 */
.filter-tabs {
  display: flex;
  gap: 8px;
  padding: 10px 12px;
  background: #fff;
  margin-bottom: 12px;
}

.filter-tabs span {
  padding: 6px 16px;
  border-radius: 16px;
  font-size: 13px;
  color: #666;
  background: #f5f6fa;
}

.filter-tabs span.active {
  background: #667eea;
  color: #fff;
}

/* 账单列表 */
.bill-list {
  padding: 0 12px;
  min-height: 60vh;
}

.date-group {
  margin-top: 12px;
}

.date-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 4px;
}

.date-text {
  font-size: 13px;
  font-weight: 600;
  color: #333;
}

.date-summary {
  font-size: 11px;
  color: #999;
  display: flex;
  gap: 8px;
}

.date-summary .income { color: #07c160; }
.date-summary .expense { color: #ee0a24; }

.bill-items {
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
}

.bill-item {
  display: flex;
  align-items: center;
  padding: 14px 12px;
  border-bottom: 1px solid #f5f5f5;
  transition: background 0.2s;
}

.bill-item:last-child {
  border-bottom: none;
}

.bill-item:active {
  background: #fafafa;
}

.bill-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  margin-right: 12px;
}

.bill-icon.income { background: #e8f9f0; }
.bill-icon.expense { background: #fff0f0; }

.bill-info {
  flex: 1;
}

.bill-category {
  font-size: 14px;
  font-weight: 500;
  color: #333;
}

.bill-desc {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}

.bill-amount {
  font-size: 16px;
  font-weight: 600;
}

.bill-amount.income { color: #07c160; }
.bill-amount.expense { color: #333; }

/* 加载更多 */
.load-more {
  text-align: center;
  padding: 16px;
  color: #667eea;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.no-more {
  text-align: center;
  padding: 16px;
  color: #999;
  font-size: 12px;
}

/* 浮动按钮 */
.fab {
  position: fixed;
  right: 20px;
  bottom: 30px;
  width: 56px;
  height: 56px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  z-index: 100;
}

.fab:active {
  transform: scale(0.95);
}
</style>