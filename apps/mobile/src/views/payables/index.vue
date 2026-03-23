<template>
  <div class="page">
    <van-nav-bar title="应付账款" left-arrow @click-left="$router.back()" />
    <div class="summary-card pay">
      <div class="item">
        <div class="label">应付总额</div>
        <div class="value">¥{{ formatMoney(summary.total) }}</div>
      </div>
      <div class="item">
        <div class="label">已付款</div>
        <div class="value green">¥{{ formatMoney(summary.paid) }}</div>
      </div>
      <div class="item">
        <div class="label">待付款</div>
        <div class="value red">¥{{ formatMoney(summary.pending) }}</div>
      </div>
    </div>
    <van-tabs v-model:active="activeTab">
      <van-tab title="全部" />
      <van-tab title="待付款" />
      <van-tab title="已逾期" />
    </van-tabs>
    <div class="list">
      <div class="rp-card" v-for="item in list" :key="item.id">
        <div class="header">
          <span class="partner">{{ item.partner_name || '-' }}</span>
          <van-tag :type="item.status === 'settled' ? 'success' : 'warning'">{{ getStatusText(item.status) }}</van-tag>
        </div>
        <div class="amount-row">
          <span class="label">应付金额</span>
          <span class="amount">¥{{ formatMoney(item.amount) }}</span>
        </div>
        <div class="amount-row">
          <span class="label">已付金额</span>
          <span class="received">¥{{ formatMoney(item.paid_amount) }}</span>
        </div>
        <div class="footer">
          <span>到期日: {{ item.due_date }}</span>
          <span class="remaining">待付: ¥{{ formatMoney(item.remaining_amount) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, computed } from 'vue'
const activeTab = ref(0)
const list = ref<any[]>([
  { id: 1, partner_name: '北京优质供应商有限公司', amount: 78000, paid_amount: 30000, remaining_amount: 48000, due_date: '2026-04-01', status: 'partial' },
  { id: 2, partner_name: '杭州电商供应商', amount: 125000, paid_amount: 0, remaining_amount: 125000, due_date: '2026-03-20', status: 'pending' },
])

const summary = computed(() => ({
  total: list.value.reduce((s, i) => s + i.amount, 0),
  paid: list.value.reduce((s, i) => s + i.paid_amount, 0),
  pending: list.value.reduce((s, i) => s + i.remaining_amount, 0)
}))

const formatMoney = (n: number) => n >= 10000 ? (n/10000).toFixed(1)+'万' : n?.toLocaleString() || '0'
const getStatusText = (s: string) => ({ pending: '待付款', partial: '部分付款', settled: '已结清' }[s] || s)
</script>
<style scoped>
.page { background: #f5f7fa; min-height: 100vh; }
.summary-card { display: flex; background: linear-gradient(135deg, #ee0a24, #ff6034); color: #fff; padding: 16px; margin: 12px; border-radius: 12px; }
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
.amount-row .amount { color: #ee0a24; font-weight: 500; }
.amount-row .received { color: #07c160; }
.rp-card .footer { display: flex; justify-content: space-between; margin-top: 8px; padding-top: 8px; border-top: 1px solid #f5f5f5; font-size: 12px; color: #999; }
.rp-card .remaining { color: #ee0a24; }
</style>
