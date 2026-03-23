<template>
  <div class="page">
    <van-nav-bar title="应收账款" left-arrow @click-left="$router.back()" />
    <div class="summary-card">
      <div class="item">
        <div class="label">应收总额</div>
        <div class="value">¥{{ formatMoney(summary.total) }}</div>
      </div>
      <div class="item">
        <div class="label">已收款</div>
        <div class="value green">¥{{ formatMoney(summary.received) }}</div>
      </div>
      <div class="item">
        <div class="label">待收款</div>
        <div class="value red">¥{{ formatMoney(summary.pending) }}</div>
      </div>
    </div>
    <van-tabs v-model:active="activeTab">
      <van-tab title="全部" />
      <van-tab title="待收款" />
      <van-tab title="已逾期" />
    </van-tabs>
    <div class="list">
      <div class="rp-card" v-for="item in list" :key="item.id">
        <div class="header">
          <span class="partner">{{ item.partner_name || '-' }}</span>
          <van-tag :type="item.status === 'settled' ? 'success' : item.status === 'overdue' ? 'danger' : 'warning'">
            {{ getStatusText(item.status) }}
          </van-tag>
        </div>
        <div class="amount-row">
          <span class="label">应收金额</span>
          <span class="amount">¥{{ formatMoney(item.amount) }}</span>
        </div>
        <div class="amount-row">
          <span class="label">已收金额</span>
          <span class="received">¥{{ formatMoney(item.paid_amount) }}</span>
        </div>
        <div class="footer">
          <span>到期日: {{ item.due_date }}</span>
          <span class="remaining">待收: ¥{{ formatMoney(item.remaining_amount) }}</span>
        </div>
      </div>
    </div>
    <van-empty v-if="list.length === 0" description="暂无应收账款" />
  </div>
</template>
<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
const activeTab = ref(0)
const list = ref<any[]>([
  { id: 1, partner_name: '上海大客户集团', amount: 156000, paid_amount: 50000, remaining_amount: 106000, due_date: '2026-04-15', status: 'pending' },
  { id: 2, partner_name: '深圳科技合作伙伴', amount: 89000, paid_amount: 0, remaining_amount: 89000, due_date: '2026-03-25', status: 'pending' },
  { id: 3, partner_name: '广州贸易公司', amount: 230000, paid_amount: 180000, remaining_amount: 50000, due_date: '2026-05-01', status: 'partial' },
])

const summary = computed(() => ({
  total: list.value.reduce((s, i) => s + i.amount, 0),
  received: list.value.reduce((s, i) => s + i.paid_amount, 0),
  pending: list.value.reduce((s, i) => s + i.remaining_amount, 0)
}))

const formatMoney = (n: number) => n >= 10000 ? (n/10000).toFixed(1)+'万' : n?.toLocaleString() || '0'
const getStatusText = (s: string) => ({ pending: '待收款', partial: '部分收款', settled: '已结清', overdue: '已逾期' }[s] || s)
</script>
<style scoped>
.page { background: #f5f7fa; min-height: 100vh; }
.summary-card { display: flex; background: linear-gradient(135deg, #1989fa, #4facfe); color: #fff; padding: 16px; margin: 12px; border-radius: 12px; }
.summary-card .item { flex: 1; text-align: center; }
.summary-card .label { font-size: 12px; opacity: 0.8; }
.summary-card .value { font-size: 18px; font-weight: 600; margin-top: 6px; }
.summary-card .value.green { color: #a0f5c8; }
.summary-card .value.red { color: #ffb3b3; }
.list { padding: 12px; }
.rp-card { background: #fff; border-radius: 8px; padding: 12px; margin-bottom: 10px; }
.rp-card .header { display: flex; justify-content: space-between; margin-bottom: 10px; }
.rp-card .partner { font-size: 15px; font-weight: 500; }
.amount-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; }
.amount-row .label { color: #999; }
.amount-row .amount { color: #1989fa; font-weight: 500; }
.amount-row .received { color: #07c160; }
.rp-card .footer { display: flex; justify-content: space-between; margin-top: 8px; padding-top: 8px; border-top: 1px solid #f5f5f5; font-size: 12px; color: #999; }
.rp-card .remaining { color: #ee0a24; }
</style>
