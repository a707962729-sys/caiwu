<template>
  <div class="page">
    <van-nav-bar title="报销管理">
      <template #right>
        <van-icon name="plus" size="20" @click="$router.push('/reimbursement/create')" />
      </template>
    </van-nav-bar>
    
    <van-tabs v-model:active="activeTab">
      <van-tab title="全部" />
      <van-tab title="待审批" />
      <van-tab title="已通过" />
      <van-tab title="已拒绝" />
    </van-tabs>
    
    <div class="list">
      <div class="item" v-for="item in list" :key="item.id" @click="viewDetail(item)">
        <div class="item-header">
          <span class="type">{{ item.type }}</span>
          <van-tag :type="getStatusType(item.status)">{{ getStatusText(item.status) }}</van-tag>
        </div>
        <div class="item-body">
          <div class="amount">¥{{ formatMoney(item.amount) }}</div>
          <div class="desc">{{ item.description || '-' }}</div>
          <div class="info">
            <span>{{ item.expense_date }}</span>
            <span>{{ item.applicant_name || '我' }}</span>
          </div>
        </div>
        <div class="item-footer" v-if="item.status === 'pending' && canApprove">
          <van-button size="small" type="primary" @click.stop="approve(item)">通过</van-button>
          <van-button size="small" @click.stop="reject(item)">拒绝</van-button>
        </div>
      </div>
      
      <van-empty v-if="list.length === 0" description="暂无报销记录" />
    </div>
    
    <div style="height: 60px;"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { showSuccessToast, showConfirmDialog } from 'vant'
import { useUserStore } from '@/stores/user'
import { reimbursementApi } from '@/api'

const router = useRouter()
const userStore = useUserStore()
const activeTab = ref(0)
const list = ref<any[]>([])

const canApprove = computed(() => {
  const role = userStore.user?.role
  return role === 'boss' || role === 'accountant'
})

const formatMoney = (n: number) => {
  if (!n) return '0'
  return n.toLocaleString()
}

const getStatusType = (s: string) => {
  const map: Record<string, string> = {
    pending: 'warning',
    approved: 'success',
    rejected: 'danger',
    paid: 'primary'
  }
  return map[s] || 'default'
}

const getStatusText = (s: string) => {
  const map: Record<string, string> = {
    pending: '待审批',
    approved: '已通过',
    rejected: '已拒绝',
    paid: '已付款'
  }
  return map[s] || s
}

const viewDetail = (item: any) => {
  router.push(`/reimbursement/${item.id}`)
}

const approve = async (item: any) => {
  try {
    await showConfirmDialog({
      title: '审批通过',
      message: `确认通过该报销申请？金额：¥${item.amount}`
    })
    await reimbursementApi.approve(item.id)
    showSuccessToast('已通过')
    loadData()
  } catch {}
}

const reject = async (item: any) => {
  try {
    await showConfirmDialog({
      title: '拒绝报销',
      message: '确认拒绝该报销申请？'
    })
    await reimbursementApi.reject(item.id, '不符合报销标准')
    showSuccessToast('已拒绝')
    loadData()
  } catch {}
}

const loadData = async () => {
  try {
    const res = await reimbursementApi.getList()
    list.value = res.list || [
      { id: 1, type: '差旅费', amount: 3580, status: 'pending', expense_date: '2026-03-15', description: '出差北京' },
      { id: 2, type: '办公用品', amount: 1200, status: 'pending', expense_date: '2026-03-14', description: '办公耗材采购' },
      { id: 3, type: '招待费', amount: 890, status: 'approved', expense_date: '2026-03-10', description: '客户招待' },
      { id: 4, type: '交通费', amount: 256, status: 'paid', expense_date: '2026-03-08', description: '打车费用' }
    ]
  } catch (e) {
    // 使用模拟数据
    list.value = [
      { id: 1, type: '差旅费', amount: 3580, status: 'pending', expense_date: '2026-03-15', description: '出差北京' },
      { id: 2, type: '办公用品', amount: 1200, status: 'pending', expense_date: '2026-03-14', description: '办公耗材采购' }
    ]
  }
}

onMounted(loadData)
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: #f5f6fa;
}

.list {
  padding: 12px;
}

.item {
  background: #fff;
  border-radius: 12px;
  padding: 14px;
  margin-bottom: 10px;
}

.item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.type {
  font-size: 15px;
  font-weight: 600;
}

.amount {
  font-size: 20px;
  font-weight: 700;
  color: #333;
}

.desc {
  font-size: 13px;
  color: #666;
  margin-top: 6px;
}

.info {
  font-size: 12px;
  color: #999;
  margin-top: 8px;
  display: flex;
  gap: 16px;
}

.item-footer {
  display: flex;
  gap: 10px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #f5f5f5;
}
</style>