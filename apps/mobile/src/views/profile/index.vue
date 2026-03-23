<template>
  <div class="profile-page">
    <!-- 用户卡片 -->
    <div class="user-card">
      <div class="user-info">
        <div class="avatar">{{ user?.real_name?.charAt(0) || 'U' }}</div>
        <div class="info">
          <div class="name">{{ user?.real_name || '用户' }}</div>
          <div class="role">{{ roleText }}</div>
        </div>
      </div>
      <van-icon name="arrow" color="#fff" />
    </div>
    
    <!-- 功能列表 -->
    <div class="menu-section">
      <van-cell-group inset>
        <van-cell title="数据大屏" icon="chart-trending-o" is-link to="/dashboard" />
        <van-cell title="账单记录" icon="balance-list-o" is-link to="/transactions" />
        <van-cell title="合同管理" icon="description" is-link to="/contracts" />
        <van-cell title="合作伙伴" icon="friends-o" is-link to="/partners" />
      </van-cell-group>
    </div>
    
    <div class="menu-section">
      <van-cell-group inset>
        <van-cell title="应收账款" icon="bill-o" is-link to="/receivables" :badge="receivableCount || ''" />
        <van-cell title="应付账款" icon="paid" is-link to="/payables" :badge="payableCount || ''" />
        <van-cell title="报销管理" icon="cash-on-deliver" is-link to="/reimbursement" />
        <van-cell title="票据管理" icon="photograph" is-link to="/upload" />
      </van-cell-group>
    </div>
    
    <div class="menu-section">
      <van-cell-group inset>
        <van-cell title="设置" icon="setting-o" is-link to="/profile/settings" />
        <van-cell title="修改密码" icon="lock" is-link to="/profile/password" />
        <van-cell title="关于我们" icon="info-o" />
        <van-cell title="退出登录" icon="close" @click="logout" />
      </van-cell-group>
    </div>
    
    <div class="version">
      <p>财务管家 v1.0.0</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { showConfirmDialog, showSuccessToast } from 'vant'
import { useUserStore } from '@/stores/user'
import { dashboardApi } from '@/api'

const router = useRouter()
const userStore = useUserStore()
const user = computed(() => userStore.user)

const roleText = computed(() => {
  const roles: Record<string, string> = { 
    boss: '老板 · 管理员', 
    accountant: '会计', 
    employee: '员工' 
  }
  return roles[user.value?.role || 'employee'] || '员工'
})

const receivableCount = ref('')
const payableCount = ref('')

const logout = async () => {
  try {
    await showConfirmDialog({
      title: '退出登录',
      message: '确定要退出登录吗？',
      confirmButtonColor: '#667eea'
    })
    // 退出登录，清除记住的用户信息
    await userStore.logout(true)
    // 清除自动登录设置
    localStorage.removeItem('caiwu_auto_login')
    showSuccessToast('已退出')
    router.replace('/login')
  } catch {}
}

onMounted(async () => {
  try {
    const data = await dashboardApi.getOverview()
    const r = data.receivablesPayables?.remainingReceivable || 0
    const p = data.receivablesPayables?.remainingPayable || 0
    receivableCount.value = r > 0 ? `${(r/10000).toFixed(0)}万` : ''
    payableCount.value = p > 0 ? `${(p/10000).toFixed(0)}万` : ''
  } catch (e) {}
})
</script>

<style scoped>
.profile-page {
  min-height: 100vh;
  background: #f5f6fa;
}

.user-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 30px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 16px;
}

.avatar {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: rgba(255,255,255,0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: 600;
  color: #fff;
}

.info .name {
  font-size: 20px;
  font-weight: 600;
  color: #fff;
}

.info .role {
  font-size: 13px;
  color: rgba(255,255,255,0.8);
  margin-top: 4px;
}

.menu-section {
  margin-top: 12px;
}

.version {
  text-align: center;
  padding: 30px 0;
  color: #999;
  font-size: 12px;
}

:deep(.van-cell-group--inset) {
  margin: 0;
}

:deep(.van-cell__left-icon) {
  color: #667eea;
}
</style>