<template>
  <div class="home-page">
    <!-- 顶部余额卡片 -->
    <div class="balance-card">
      <!-- 装饰性背景元素 -->
      <div class="card-decoration">
        <div class="circle circle-1"></div>
        <div class="circle circle-2"></div>
        <div class="circle circle-3"></div>
        <svg class="wave wave-1" viewBox="0 0 200 20" preserveAspectRatio="none">
          <path d="M0,10 Q25,0 50,10 T100,10 T150,10 T200,10 V20 H0 Z" fill="rgba(255,255,255,0.05)"/>
        </svg>
        <svg class="wave wave-2" viewBox="0 0 200 20" preserveAspectRatio="none">
          <path d="M0,5 Q25,15 50,5 T100,5 T150,5 T200,5 V20 H0 Z" fill="rgba(255,255,255,0.03)"/>
        </svg>
      </div>
      
      <div class="balance-header">
        <span class="label">账户余额(元)</span>
        <van-icon name="eye-o" size="18" color="rgba(255,255,255,0.8)" @click="toggleBalanceVisible" />
      </div>
      <div class="balance-amount" :class="{ 'number-bounce': amountAnimated }">
        {{ balanceVisible ? formatMoney(overview.totalBalance) : '****' }}
      </div>
      <div class="balance-stats">
        <div class="stat">
          <span class="stat-label">本月收入</span>
          <span class="stat-value income">
            {{ balanceVisible ? '+' + formatMoney(overview.income) : '****' }}
          </span>
        </div>
        <div class="divider"></div>
        <div class="stat">
          <span class="stat-label">本月支出</span>
          <span class="stat-value expense">
            {{ balanceVisible ? '-' + formatMoney(overview.expense) : '****' }}
          </span>
        </div>
        <div class="divider"></div>
        <div class="stat">
          <span class="stat-label">本月结余</span>
          <span class="stat-value">
            {{ balanceVisible ? formatMoney(overview.net) : '****' }}
          </span>
        </div>
      </div>
    </div>

    <!-- 快捷功能 -->
    <div class="quick-actions">
      <div class="action-item ripple" @click="$router.push('/chat')">
        <div class="action-icon ai">
          <span class="icon-inner">🤖</span>
          <div class="icon-glow"></div>
        </div>
        <span>AI助手</span>
      </div>
      <div class="action-item ripple" @click="$router.push('/transactions/create')">
        <div class="action-icon add">
          <span class="icon-inner">💰</span>
          <div class="icon-glow"></div>
        </div>
        <span>记一笔</span>
      </div>
      <div class="action-item ripple" @click="$router.push('/reimbursement/create')">
        <div class="action-icon gradient-blue">
          <span class="icon-inner">📝</span>
        </div>
        <span>报销</span>
      </div>
      <div class="action-item ripple" @click="scanInvoice">
        <div class="action-icon gradient-orange">
          <span class="icon-inner">📷</span>
        </div>
        <span>扫码</span>
      </div>
      <div class="action-item ripple" @click="$router.push('/contracts')">
        <div class="action-icon gradient-purple">
          <span class="icon-inner">📄</span>
        </div>
        <span>合同</span>
      </div>
      <div class="action-item ripple" @click="$router.push('/receivables')">
        <div class="action-icon gradient-green">
          <span class="icon-inner">📈</span>
        </div>
        <span>应收</span>
      </div>
      <div class="action-item ripple" @click="$router.push('/payables')">
        <div class="action-icon gradient-red">
          <span class="icon-inner">📉</span>
        </div>
        <span>应付</span>
      </div>
      <div class="action-item ripple" @click="$router.push('/dashboard')">
        <div class="action-icon gradient-cyan">
          <span class="icon-inner">📊</span>
        </div>
        <span>报表</span>
      </div>
    </div>

    <!-- 加载中骨架屏 -->
    <template v-if="loading">
      <div class="section">
        <Skeleton type="list" :rows="3" />
      </div>
      <div class="section">
        <Skeleton type="list" :rows="4" />
      </div>
    </template>

    <!-- 桌面端双列布局 -->
    <div class="home-grid" v-else>
      <!-- 经营概览卡片 -->
      <div class="section overview-section fade-in-up">
        <div class="section-header">
          <div class="title-wrapper">
            <div class="section-indicator"></div>
            <span class="section-title">经营概览</span>
          </div>
          <span class="section-date">{{ currentMonth }}</span>
        </div>
        <div class="overview-grid">
          <div class="overview-item">
            <div class="overview-label">营业收入</div>
            <div class="overview-value income">{{ formatMoney(overview.income) }}</div>
            <div class="overview-trend up" v-if="overview.incomeTrend > 0">
              <van-icon name="arrow-up" /> {{ overview.incomeTrend }}%
            </div>
            <div class="overview-trend down" v-else-if="overview.incomeTrend < 0">
              <van-icon name="arrow-down" /> {{ Math.abs(overview.incomeTrend) }}%
            </div>
          </div>
          <div class="overview-item">
            <div class="overview-label">营业成本</div>
            <div class="overview-value expense">{{ formatMoney(overview.expense) }}</div>
            <div class="overview-trend up" v-if="overview.expenseTrend < 0">
              <van-icon name="arrow-down" /> {{ Math.abs(overview.expenseTrend) }}%
            </div>
            <div class="overview-trend down" v-else-if="overview.expenseTrend > 0">
              <van-icon name="arrow-up" /> {{ overview.expenseTrend }}%
            </div>
          </div>
          <div class="overview-item">
            <div class="overview-label">利润率</div>
            <div class="overview-value">{{ overview.profitRate }}%</div>
            <div class="overview-bar">
              <div class="bar-fill" :style="{ width: Math.min(overview.profitRate, 100) + '%' }"></div>
            </div>
          </div>
          <div class="overview-item">
            <div class="overview-label">现金流</div>
            <div class="overview-value" :class="overview.net >= 0 ? 'income' : 'expense'">
              {{ formatMoney(overview.net) }}
            </div>
          </div>
        </div>
      </div>

      <!-- 待办提醒 -->
      <div class="section pending-section fade-in-up" v-if="hasPending">
        <div class="section-header">
          <div class="title-wrapper">
            <div class="section-indicator"></div>
            <span class="section-title">待办提醒</span>
          </div>
          <span class="pending-count" :class="{ 'badge-bounce': badgeAnimated }">{{ pendingCount }}</span>
        </div>
        <div class="pending-list">
          <div class="pending-item ripple" 
               v-if="overview.pendingReimbursements > 0" 
               @click="$router.push('/reimbursement')">
            <div class="pending-left-bar orange"></div>
            <span class="pending-badge orange">{{ overview.pendingReimbursements }}</span>
            <span class="pending-text">条报销待审批</span>
            <van-icon name="arrow" class="pending-arrow" />
          </div>
          <div class="pending-item ripple" 
               v-if="overview.pendingTransactions > 0"
               @click="$router.push('/transactions')">
            <div class="pending-left-bar blue"></div>
            <span class="pending-badge blue">{{ overview.pendingTransactions }}</span>
            <span class="pending-text">条记账待确认</span>
            <van-icon name="arrow" class="pending-arrow" />
          </div>
          <div class="pending-item ripple" 
               v-if="overview.expiringContracts > 0"
               @click="$router.push('/contracts')">
            <div class="pending-left-bar red"></div>
            <span class="pending-badge red">{{ overview.expiringContracts }}</span>
            <span class="pending-text">份合同即将到期</span>
            <van-icon name="arrow" class="pending-arrow" />
          </div>
          <div class="pending-item ripple" 
               v-if="overview.overdueReceivables > 0"
               @click="$router.push('/receivables')">
            <div class="pending-left-bar red"></div>
            <span class="pending-badge red">{{ overview.overdueReceivables }}</span>
            <span class="pending-text">笔应收已逾期</span>
            <van-icon name="arrow" class="pending-arrow" />
          </div>
        </div>
      </div>

      <!-- 应收应付汇总 -->
      <div class="section finance-section fade-in-up">
        <div class="section-header">
          <div class="title-wrapper">
            <div class="section-indicator green"></div>
            <span class="section-title">应收应付</span>
          </div>
          <span class="section-more ripple" @click="$router.push('/receivables')">
            详情 <van-icon name="arrow" />
          </span>
        </div>
        <div class="finance-grid">
          <div class="finance-item receivable" @click="$router.push('/receivables')">
            <div class="finance-icon">📈</div>
            <div class="finance-info">
              <div class="finance-label">应收账款</div>
              <div class="finance-amount">{{ formatMoney(overview.receivables) }}</div>
              <div class="finance-sub">
                <span class="sub-item" v-if="overview.overdueReceivables > 0">
                  <van-icon name="warning-o" color="#ee0a24" /> 逾期 {{ formatMoney(overview.overdueReceivablesAmount) }}
                </span>
                <span class="sub-item" v-else>无逾期</span>
              </div>
            </div>
          </div>
          <div class="finance-item payable" @click="$router.push('/payables')">
            <div class="finance-icon">📉</div>
            <div class="finance-info">
              <div class="finance-label">应付账款</div>
              <div class="finance-amount">{{ formatMoney(overview.payables) }}</div>
              <div class="finance-sub">
                <span class="sub-item" v-if="overview.duePayables > 0">
                  <van-icon name="clock-o" color="#ff976a" /> 即将到期 {{ overview.duePayables }}笔
                </span>
                <span class="sub-item" v-else>无到期</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 合同状态 -->
      <div class="section contract-section fade-in-up">
        <div class="section-header">
          <div class="title-wrapper">
            <div class="section-indicator purple"></div>
            <span class="section-title">合同概览</span>
          </div>
          <span class="section-more ripple" @click="$router.push('/contracts')">
            全部 <van-icon name="arrow" />
          </span>
        </div>
        <div class="contract-stats">
          <div class="contract-stat">
            <div class="stat-circle active">
              <span class="stat-num">{{ overview.activeContracts || 0 }}</span>
            </div>
            <div class="stat-label">执行中</div>
          </div>
          <div class="contract-stat">
            <div class="stat-circle expiring">
              <span class="stat-num">{{ overview.expiringContracts || 0 }}</span>
            </div>
            <div class="stat-label">即将到期</div>
          </div>
          <div class="contract-stat">
            <div class="stat-circle expired">
              <span class="stat-num">{{ overview.expiredContracts || 0 }}</span>
            </div>
            <div class="stat-label">已到期</div>
          </div>
          <div class="contract-stat">
            <div class="stat-circle total">
              <span class="stat-num">{{ overview.totalContracts || 0 }}</span>
            </div>
            <div class="stat-label">合同总数</div>
          </div>
        </div>
      </div>

      <!-- 最近账单 -->
      <div class="section bill-section fade-in-up" style="animation-delay: 0.1s">
      <div class="section-header">
        <span class="section-title">最近账单</span>
        <span class="section-more ripple" @click="$router.push('/transactions')">
          全部 <van-icon name="arrow" />
        </span>
      </div>
      
      <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
        <div class="bill-list">
          <div class="bill-item ripple fade-in-up" 
               v-for="(item, index) in recentTransactions" 
               :key="item.id"
               :style="{ animationDelay: index * 0.05 + 's' }"
               @click="$router.push(`/transactions/${item.id}`)">
            <div class="bill-icon" :class="item.transaction_type">
              {{ getCategoryIcon(item.category) }}
            </div>
            <div class="bill-info">
              <div class="bill-category">{{ item.category }}</div>
              <div class="bill-desc">{{ item.description || formatDate(item.transaction_date) }}</div>
            </div>
            <div class="bill-amount" :class="item.transaction_type">
              {{ item.transaction_type === 'income' ? '+' : '-' }}{{ formatMoney(item.amount) }}
            </div>
          </div>
          
          <van-empty v-if="recentTransactions.length === 0" description="暂无账单记录" image-size="80">
            <template #image>
              <div class="empty-illustration">
                <div class="empty-icon">📝</div>
                <div class="empty-dots">
                  <span></span><span></span><span></span>
                </div>
              </div>
            </template>
            <van-button type="primary" size="small" class="ripple" @click="$router.push('/transactions/create')">
              立即记账
            </van-button>
          </van-empty>
        </div>
      </van-pull-refresh>
      </div>
    </div>

    <!-- 资产账户 -->
    <div class="section account-section fade-in-up" v-if="!loading && accounts.length > 0" style="animation-delay: 0.2s">
      <div class="section-header">
        <span class="section-title">资产账户</span>
        <span class="section-total">总计 ¥{{ formatMoney(overview.totalBalance) }}</span>
      </div>
      <div class="account-list">
        <div class="account-item ripple fade-in-up" v-for="(acc, index) in accounts" :key="acc.id"
             :style="{ animationDelay: index * 0.05 + 's' }">
          <div class="account-icon" :class="acc.account_type">
            {{ getAccountIcon(acc.account_type) }}
          </div>
          <div class="account-info">
            <div class="account-name">{{ acc.name }}</div>
            <div class="account-no">{{ acc.account_no || '—' }}</div>
          </div>
          <div class="account-balance">¥{{ formatMoney(acc.balance) }}</div>
        </div>
      </div>
    </div>

    <!-- 快捷入口浮窗 -->
    <div class="fab ripple" @click="$router.push('/transactions/create')">
      <van-icon name="plus" size="24" />
      <div class="fab-ripple"></div>
    </div>

    <!-- 底部占位 -->
    <div style="height: 20px;"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { showToast } from 'vant'
import { dashboardApi, transactionApi } from '@/api'
import { useRequest } from '@/composables/useRequest'
import Skeleton from '@/components/Skeleton.vue'

// 余额显示控制
const balanceVisible = ref(true)
const amountAnimated = ref(false)
const badgeAnimated = ref(false)

const toggleBalanceVisible = () => {
  balanceVisible.value = !balanceVisible.value
  // 触发数字动画
  amountAnimated.value = true
  setTimeout(() => amountAnimated.value = false, 150)
}

// 数据状态
const overview = ref({
  totalBalance: 0,
  income: 0,
  expense: 0,
  net: 0,
  profitRate: 0,
  incomeTrend: 0,
  expenseTrend: 0,
  receivables: 0,
  payables: 0,
  overdueReceivables: 0,
  overdueReceivablesAmount: 0,
  duePayables: 0,
  activeContracts: 0,
  expiringContracts: 0,
  expiredContracts: 0,
  totalContracts: 0,
  pendingReimbursements: 0,
  pendingTransactions: 0
})

const currentMonth = computed(() => {
  const now = new Date()
  return `${now.getFullYear()}年${now.getMonth() + 1}月`
})

const recentTransactions = ref<any[]>([])
const accounts = ref<any[]>([])
const loading = ref(true)
const refreshing = ref(false)

// 计算属性
const hasPending = computed(() => {
  return overview.value.pendingReimbursements > 0 || 
         overview.value.pendingTransactions > 0 || 
         overview.value.expiringContracts > 0 ||
         overview.value.overdueReceivables > 0
})

const pendingCount = computed(() => {
  return overview.value.pendingReimbursements + 
         overview.value.pendingTransactions + 
         overview.value.expiringContracts +
         overview.value.overdueReceivables
})

// 监听待办数量变化，触发徽章动画
watch(pendingCount, (newVal, oldVal) => {
  if (newVal !== oldVal && newVal > 0) {
    badgeAnimated.value = true
    setTimeout(() => badgeAnimated.value = false, 500)
  }
})

// 工具函数
const formatMoney = (n: number) => {
  if (!n) return '0.00'
  if (n >= 10000) return (n / 10000).toFixed(2) + '万'
  return n.toFixed(2)
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

const getAccountIcon = (type: string) => {
  const icons: Record<string, string> = {
    bank: '🏦', cash: '💵', alipay: '📱', wechat: '💚', other: '💳'
  }
  return icons[type] || '💳'
}

// 扫码识别票据
const scanInvoice = () => {
  showToast('扫码功能开发中')
}

// 加载数据
const loadData = async () => {
  loading.value = true
  
  try {
    const [overviewData, txnData, receivablesData, payablesData, contractsData] = await Promise.all([
      dashboardApi.getOverview(),
      transactionApi.getList({ pageSize: 10 }),
      dashboardApi.getReceivables().catch(() => ({ total: 0, overdue: 0 })),
      dashboardApi.getPayables().catch(() => ({ total: 0, dueSoon: 0 })),
      Promise.resolve({ active: 0, expiring: 0, expired: 0, total: 0 })
    ])
    
    const income = overviewData.incomeExpense?.income || 0
    const expense = overviewData.incomeExpense?.expense || 0
    const net = income - expense
    
    overview.value = {
      totalBalance: overviewData.accounts?.total || 0,
      income,
      expense,
      net,
      profitRate: income > 0 ? Math.round((net / income) * 100) : 0,
      incomeTrend: Math.round((Math.random() - 0.5) * 20), // 模拟趋势数据
      expenseTrend: Math.round((Math.random() - 0.5) * 15),
      receivables: receivablesData.total || 0,
      payables: payablesData.total || 0,
      overdueReceivables: receivablesData.overdue || 0,
      overdueReceivablesAmount: receivablesData.overdue || 0,
      duePayables: payablesData.dueSoon || 0,
      activeContracts: contractsData.active || 0,
      expiringContracts: contractsData.expiring || overviewData.pendingItems?.contracts_expiring || 0,
      expiredContracts: contractsData.expired || 0,
      totalContracts: contractsData.total || 0,
      pendingReimbursements: overviewData.pendingItems?.reimbursements || 0,
      pendingTransactions: overviewData.pendingItems?.transactions || 0
    }
    
    recentTransactions.value = txnData.list || []
    accounts.value = overviewData.accounts?.list || []
    
    // 触发数字动画
    amountAnimated.value = true
    setTimeout(() => amountAnimated.value = false, 150)
  } catch (e) {
    console.error('加载数据失败', e)
    showToast('加载失败，请下拉刷新重试')
  } finally {
    loading.value = false
  }
}

// 下拉刷新
const onRefresh = async () => {
  await loadData()
  refreshing.value = false
}

onMounted(loadData)
</script>

<style scoped>
.home-page {
  min-height: 100vh;
  background: #f5f6fa;
}

/* 余额卡片 */
.balance-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 24px 20px 20px;
  color: #fff;
  position: relative;
  overflow: hidden;
}

/* 装饰性背景元素 */
.card-decoration {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  overflow: hidden;
}

.circle {
  position: absolute;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 100%);
}

.circle-1 {
  width: 200px;
  height: 200px;
  top: -80px;
  right: -60px;
  animation: float 8s ease-in-out infinite;
}

.circle-2 {
  width: 120px;
  height: 120px;
  bottom: -40px;
  left: -30px;
  animation: float 6s ease-in-out infinite reverse;
}

.circle-3 {
  width: 80px;
  height: 80px;
  top: 40%;
  right: 20%;
  background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
  animation: pulse 4s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(10px, -10px) scale(1.05); }
}

.wave {
  position: absolute;
  width: 200%;
  height: 40px;
  left: -50%;
}

.wave-1 {
  bottom: 20%;
  animation: waveMove 12s linear infinite;
}

.wave-2 {
  bottom: 10%;
  animation: waveMove 15s linear infinite reverse;
}

@keyframes waveMove {
  0% { transform: translateX(0); }
  100% { transform: translateX(50%); }
}

.balance-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  position: relative;
  z-index: 1;
}

.balance-header .label {
  font-size: 13px;
  opacity: 0.9;
}

.balance-amount {
  font-size: 36px;
  font-weight: 700;
  letter-spacing: 1px;
  margin-bottom: 16px;
  position: relative;
  z-index: 1;
  transition: transform 0.15s ease;
}

.balance-stats {
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 10px;
  padding: 12px 0;
  position: relative;
  z-index: 1;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.balance-stats .stat {
  flex: 1;
  text-align: center;
}

.stat-label {
  font-size: 11px;
  opacity: 0.8;
  display: block;
}

.stat-value {
  font-size: 15px;
  font-weight: 600;
  margin-top: 4px;
  display: block;
}

.stat-value.income { color: #a8f5c8; }
.stat-value.expense { color: #ffb3b3; }

.balance-stats .divider {
  width: 1px;
  height: 30px;
  background: rgba(255, 255, 255, 0.3);
}

/* 快捷功能 */
.quick-actions {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0;
  background: #fff;
  padding: 16px 0;
  margin-bottom: 12px;
}

.action-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 0;
  transition: transform 0.2s ease;
  cursor: pointer;
}

.action-item:active {
  transform: scale(0.92);
}

.action-icon {
  width: 44px;
  height: 44px;
  background: #f5f6fa;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  margin-bottom: 6px;
  position: relative;
  overflow: hidden;
  transition: all 0.3s ease;
}

.action-icon:active {
  transform: scale(0.9);
}

.icon-inner {
  position: relative;
  z-index: 1;
}

.icon-glow {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: radial-gradient(circle at center, rgba(255,255,255,0.3) 0%, transparent 70%);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.action-item:active .icon-glow {
  opacity: 1;
}

.action-icon.ai {
  background: linear-gradient(135deg, #667eea, #764ba2);
}

.action-icon.add {
  background: linear-gradient(135deg, #07c160, #00d084);
}

.action-icon.gradient-blue {
  background: linear-gradient(135deg, #1989fa, #4facfe);
}

.action-icon.gradient-orange {
  background: linear-gradient(135deg, #ff976a, #ffbe76);
}

.action-icon.gradient-purple {
  background: linear-gradient(135deg, #9c7cfa, #b794f6);
}

.action-icon.gradient-green {
  background: linear-gradient(135deg, #07c160, #38ef7d);
}

.action-icon.gradient-red {
  background: linear-gradient(135deg, #ff6b6b, #feca57);
}

.action-icon.gradient-cyan {
  background: linear-gradient(135deg, #00d2d3, #54a0ff);
}

.action-item span {
  font-size: 12px;
  color: #333;
}

/* 区块 */
.section {
  background: #fff;
  margin-bottom: 12px;
  padding: 16px;
}

/* 经营概览 */
.overview-section {
  border-radius: 16px;
}

.section-date {
  font-size: 12px;
  color: #999;
}

.overview-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.overview-item {
  background: #f8f9fc;
  border-radius: 12px;
  padding: 12px;
  text-align: center;
}

.overview-label {
  font-size: 12px;
  color: #999;
  margin-bottom: 6px;
}

.overview-value {
  font-size: 20px;
  font-weight: 700;
  color: #333;
}

.overview-value.income {
  color: #07c160;
}

.overview-value.expense {
  color: #ee0a24;
}

.overview-trend {
  font-size: 11px;
  margin-top: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
}

.overview-trend.up {
  color: #07c160;
}

.overview-trend.down {
  color: #ee0a24;
}

.overview-bar {
  height: 4px;
  background: #e8e8e8;
  border-radius: 2px;
  margin-top: 8px;
  overflow: hidden;
}

.overview-bar .bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #667eea, #764ba2);
  border-radius: 2px;
  transition: width 0.5s ease;
}

/* 应收应付 */
.finance-section {
  border-radius: 16px;
}

.finance-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.finance-item {
  background: #f8f9fc;
  border-radius: 12px;
  padding: 14px;
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.finance-item:active {
  transform: scale(0.98);
}

.finance-item.receivable {
  border-left: 3px solid #07c160;
}

.finance-item.payable {
  border-left: 3px solid #ff976a;
}

.finance-icon {
  font-size: 28px;
}

.finance-info {
  flex: 1;
}

.finance-label {
  font-size: 12px;
  color: #999;
  margin-bottom: 4px;
}

.finance-amount {
  font-size: 18px;
  font-weight: 700;
  color: #333;
}

.finance-sub {
  margin-top: 4px;
}

.finance-sub .sub-item {
  font-size: 11px;
  color: #999;
  display: flex;
  align-items: center;
  gap: 4px;
}

/* 合同状态 */
.contract-section {
  border-radius: 16px;
}

.contract-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.contract-stat {
  text-align: center;
}

.stat-circle {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 8px;
  font-weight: 700;
}

.stat-circle.active {
  background: linear-gradient(135deg, #07c160, #00d084);
  color: #fff;
}

.stat-circle.expiring {
  background: linear-gradient(135deg, #ff976a, #ffbe76);
  color: #fff;
}

.stat-circle.expired {
  background: linear-gradient(135deg, #ee0a24, #ff6b6b);
  color: #fff;
}

.stat-circle.total {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
}

.stat-num {
  font-size: 16px;
}

.contract-stat .stat-label {
  font-size: 11px;
  color: #999;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.title-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-indicator {
  width: 4px;
  height: 16px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  border-radius: 2px;
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  color: #333;
}

.section-more {
  font-size: 12px;
  color: #999;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px 8px;
  border-radius: 12px;
  transition: background 0.2s;
}

.section-more:active {
  background: #f5f6fa;
}

.section-total {
  font-size: 13px;
  color: #667eea;
  font-weight: 500;
}

/* 待办区块 */
.pending-section {
  border-left: 3px solid #ff976a;
}

.pending-count {
  background: linear-gradient(135deg, #ff976a, #ffbe76);
  color: #fff;
  font-size: 12px;
  padding: 2px 10px;
  border-radius: 12px;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(255, 151, 106, 0.3);
}

.pending-list {
  background: #f9fafb;
  border-radius: 10px;
  overflow: hidden;
}

.pending-item {
  display: flex;
  align-items: center;
  padding: 12px;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
  transition: background 0.2s ease;
  position: relative;
}

.pending-item:last-child {
  border-bottom: none;
}

.pending-item:active {
  background: #f0f0f0;
}

.pending-left-bar {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  border-radius: 0 3px 3px 0;
}

.pending-left-bar.orange { background: linear-gradient(180deg, #ff976a, #ffbe76); }
.pending-left-bar.blue { background: linear-gradient(180deg, #1989fa, #4facfe); }
.pending-left-bar.red { background: linear-gradient(180deg, #ee0a24, #ff6b6b); }

.pending-badge {
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 600;
  margin-right: 10px;
  color: #fff;
  min-width: 24px;
  text-align: center;
}

.pending-badge.orange { 
  background: linear-gradient(135deg, #ff976a, #ffbe76);
  box-shadow: 0 2px 6px rgba(255, 151, 106, 0.3);
}
.pending-badge.blue { 
  background: linear-gradient(135deg, #1989fa, #4facfe);
  box-shadow: 0 2px 6px rgba(25, 137, 250, 0.3);
}
.pending-badge.red { 
  background: linear-gradient(135deg, #ee0a24, #ff6b6b);
  box-shadow: 0 2px 6px rgba(238, 10, 36, 0.3);
}

.pending-text {
  flex: 1;
  font-size: 14px;
  color: #333;
}

.pending-arrow {
  color: #ccc;
}

/* 账单列表 */
.bill-list {
  min-height: 200px;
}

.bill-item {
  display: flex;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #f5f5f5;
  cursor: pointer;
  transition: background 0.2s ease;
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
  transition: transform 0.2s ease;
}

.bill-icon:active {
  transform: scale(0.95);
}

.bill-icon.income { 
  background: linear-gradient(135deg, #e8f9f0, #d4f5e5);
}
.bill-icon.expense { 
  background: linear-gradient(135deg, #fff0f0, #ffe8e8);
}

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

/* 账户列表 */
.account-item {
  display: flex;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #f5f5f5;
}

.account-item:last-child {
  border-bottom: none;
}

.account-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  margin-right: 12px;
  background: #f5f6fa;
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
  margin-top: 4px;
}

.account-balance {
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

/* 空状态插画 */
.empty-illustration {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.empty-icon {
  font-size: 48px;
  animation: bounce 2s ease-in-out infinite;
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

.empty-dots {
  display: flex;
  gap: 6px;
}

.empty-dots span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #ddd;
  animation: dotPulse 1.5s ease-in-out infinite;
}

.empty-dots span:nth-child(2) {
  animation-delay: 0.2s;
}

.empty-dots span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes dotPulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.2); opacity: 0.6; }
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
  box-shadow: 
    0 4px 12px rgba(102, 126, 234, 0.4),
    0 8px 24px rgba(102, 126, 234, 0.2);
  z-index: 100;
  transition: all 0.3s ease;
  overflow: hidden;
}

.fab:active {
  transform: scale(0.92);
  box-shadow: 
    0 2px 8px rgba(102, 126, 234, 0.3),
    0 4px 12px rgba(102, 126, 234, 0.15);
}

.fab-ripple {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  transition: width 0.4s ease, height 0.4s ease;
}

.fab:active .fab-ripple {
  width: 200%;
  height: 200%;
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
  background: rgba(0, 0, 0, 0.1);
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
  50% { transform: scale(1.05); }
}

/* 徽章弹跳 */
.badge-bounce {
  animation: badgeBounce 0.5s ease-out;
}

@keyframes badgeBounce {
  0%, 100% { transform: scale(1); }
  25% { transform: scale(1.2); }
  50% { transform: scale(0.9); }
  75% { transform: scale(1.1); }
}

/* 桌面端响应式布局 */
@media (min-width: 768px) {
  .home-page {
    padding: 0;
    max-width: 1200px;
    margin: 0 auto;
  }
  
  .balance-card {
    margin-bottom: 24px;
    border-radius: 20px;
    padding: 32px 40px;
  }
  
  .balance-amount {
    font-size: 48px;
  }
  
  .quick-actions {
    border-radius: 16px;
    margin-bottom: 24px;
  }
  
  .action-item {
    padding: 16px 0;
  }
  
  .action-icon {
    width: 56px;
    height: 56px;
  }
  
  /* 双列布局 */
  .home-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
  }
  
  .section {
    margin-top: 0;
    border-radius: 16px;
  }
  
  /* 待办和账单并排 */
  .pending-section {
    grid-column: 1;
  }
  
  .bill-section {
    grid-column: 2;
  }
  
  .account-section {
    grid-column: 1 / -1;
  }
  
  .account-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 12px;
  }
  
  .account-item {
    background: #f9fafb;
    border-radius: 12px;
    padding: 16px;
    margin: 0;
    border-bottom: none;
  }
  
  .fab {
    right: calc(50% - 600px + 30px);
  }
}

@media (min-width: 1024px) {
  .quick-actions {
    grid-template-columns: repeat(8, 1fr);
  }
  
  .account-list {
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  }
}
</style>