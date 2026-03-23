<template>
  <div class="page">
    <van-nav-bar title="合同管理">
      <template #right><van-icon name="plus" size="20" /></template>
    </van-nav-bar>
    <van-tabs v-model:active="activeTab">
      <van-tab title="全部" />
      <van-tab title="执行中" />
      <van-tab title="已完成" />
    </van-tabs>
    <div class="contract-list">
      <div class="contract-card" v-for="item in list" :key="item.id">
        <div class="header">
          <span class="name">{{ item.name }}</span>
          <van-tag :type="getStatusType(item.status)">{{ getStatusText(item.status) }}</van-tag>
        </div>
        <div class="info">
          <div class="row">
            <span class="label">合同编号</span>
            <span>{{ item.contract_no }}</span>
          </div>
          <div class="row">
            <span class="label">合作方</span>
            <span>{{ item.partner_name || '-' }}</span>
          </div>
          <div class="row">
            <span class="label">合同金额</span>
            <span class="amount">¥{{ formatMoney(item.amount) }}</span>
          </div>
          <div class="row">
            <span class="label">有效期</span>
            <span>{{ item.start_date }} ~ {{ item.end_date }}</span>
          </div>
        </div>
      </div>
    </div>
    <van-empty v-if="list.length === 0" description="暂无合同" />
  </div>
</template>
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { contractApi } from '@/api'
const activeTab = ref(0)
const list = ref<any[]>([])

const formatMoney = (n: number) => n >= 10000 ? (n/10000).toFixed(1)+'万' : n?.toLocaleString() || '0'
const getStatusType = (s: string) => ({ active: 'success', completed: 'primary', draft: 'default' }[s] || 'default')
const getStatusText = (s: string) => ({ active: '执行中', completed: '已完成', draft: '草稿' }[s] || s)

onMounted(async () => {
  try { list.value = (await contractApi.getList()).list || [] } catch (e) {}
})
</script>
<style scoped>
.page { background: #f5f7fa; min-height: 100vh; }
.contract-list { padding: 12px; }
.contract-card { background: #fff; border-radius: 8px; padding: 12px; margin-bottom: 10px; }
.contract-card .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.contract-card .name { font-size: 15px; font-weight: 500; }
.contract-card .info .row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; }
.contract-card .label { color: #999; }
.contract-card .amount { color: #1989fa; font-weight: 500; }
</style>
