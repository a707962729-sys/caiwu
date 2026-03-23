<template>
  <div class="app-layout">
    <!-- 侧边栏 -->
    <aside class="sidebar" :class="{ collapsed: sidebarCollapsed }">
      <!-- Logo -->
      <div class="sidebar-header">
        <div class="logo" v-if="!sidebarCollapsed">
          <span class="logo-icon">💰</span>
          <span class="logo-text">财务管家</span>
        </div>
        <div class="logo-mini" v-else>
          <span>💰</span>
        </div>
        <button class="collapse-btn" @click="toggleSidebar">
          <van-icon :name="sidebarCollapsed ? 'arrow-right' : 'arrow-left'" />
        </button>
      </div>
      
      <!-- 用户信息 -->
      <div class="user-info" v-if="!sidebarCollapsed">
        <div class="avatar">{{ userInitial }}</div>
        <div class="user-detail">
          <div class="username">{{ userName }}</div>
          <div class="role">{{ userRole }}</div>
        </div>
      </div>
      
      <!-- 导航菜单 -->
      <nav class="nav-menu">
        <div class="nav-group" v-for="group in menuGroups" :key="group.title">
          <div class="nav-group-title" v-if="group.title && !sidebarCollapsed">
            {{ group.title }}
          </div>
          <router-link 
            v-for="item in group.items" 
            :key="item.path"
            :to="item.path"
            class="nav-item"
            :class="{ active: isActive(item.path) }"
          >
            <span class="nav-icon">{{ item.icon }}</span>
            <span class="nav-text" v-if="!sidebarCollapsed">{{ item.name }}</span>
            <span class="nav-badge" v-if="item.badge && !sidebarCollapsed">{{ item.badge }}</span>
          </router-link>
        </div>
      </nav>
      
      <!-- 底部操作 -->
      <div class="sidebar-footer">
        <div class="nav-item" @click="handleLogout">
          <span class="nav-icon">🚪</span>
          <span class="nav-text" v-if="!sidebarCollapsed">退出登录</span>
        </div>
      </div>
    </aside>
    
    <!-- 主内容区 -->
    <main class="main-content">
      <!-- 顶部栏 -->
      <header class="topbar">
        <div class="topbar-left">
          <button class="menu-btn" @click="toggleSidebar">
            <van-icon name="wap-nav" size="20" />
          </button>
          <h1 class="page-title">{{ pageTitle }}</h1>
        </div>
        <div class="topbar-right">
          <div class="quick-action" @click="$router.push('/transactions/create')">
            <van-icon name="plus" size="18" />
          </div>
          <div class="notification" @click="showNotifications">
            <van-icon name="bell" size="18" />
            <span class="badge" v-if="notificationCount > 0">{{ notificationCount }}</span>
          </div>
        </div>
      </header>
      
      <!-- 页面内容 -->
      <div class="page-content">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <keep-alive :include="cachedPages">
              <component :is="Component" />
            </keep-alive>
          </transition>
        </router-view>
      </div>
    </main>
    
    <!-- 移动端遮罩 -->
    <div 
      class="sidebar-overlay" 
      :class="{ visible: showOverlay }"
      @click="closeSidebar"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showConfirmDialog, showToast } from 'vant'
import { useUserStore } from '@/stores/user'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const sidebarCollapsed = ref(false)
const showOverlay = ref(false)
const cachedPages = ['Home', 'TransactionList', 'Dashboard']
const notificationCount = ref(3)

// 用户信息
const userName = computed(() => userStore.user?.real_name || '用户')
const userInitial = computed(() => userName.value.charAt(0))
const userRole = computed(() => {
  const roleMap: Record<string, string> = {
    'admin': '管理员',
    'accountant': '会计',
    'employee': '员工'
  }
  return roleMap[userStore.user?.role || 'employee'] || '员工'
})

// 页面标题
const pageTitle = computed(() => route.meta.title as string || '财务管家')

// 菜单配置
const menuGroups = computed(() => {
  const role = userStore.user?.role
  const groups = [
    {
      title: '',
      items: [
        { name: '首页', path: '/home', icon: '🏠' },
        { name: '数据大屏', path: '/dashboard', icon: '📊' }
      ]
    },
    {
      title: '财务管理',
      items: [
        { name: '记账', path: '/transactions', icon: '📝' },
        { name: '应收账款', path: '/receivables', icon: '📈' },
        { name: '应付账款', path: '/payables', icon: '📉' }
      ]
    },
    {
      title: '业务管理',
      items: [
        { name: '合同管理', path: '/contracts', icon: '📄' },
        { name: '合作伙伴', path: '/partners', icon: '🤝' },
        { name: '票据管理', path: '/invoice', icon: '🧾' }
      ]
    },
    {
      title: '员工管理',
      items: [
        { name: '考勤管理', path: '/attendance', icon: '⏰' },
        { name: '请假管理', path: '/leave', icon: '📅' },
        { name: '工资管理', path: '/salary', icon: '💰' }
      ]
    },
    {
      title: '其他',
      items: [
        { name: '报销管理', path: '/reimbursement', icon: '💸' },
        { name: 'AI 助手', path: '/chat', icon: '🤖' },
        { name: '个人中心', path: '/profile', icon: '👤' }
      ]
    }
  ]
  
  return groups
})

const isActive = (path: string) => {
  return route.path === path || route.path.startsWith(path + '/')
}

const toggleSidebar = () => {
  sidebarCollapsed.value = !sidebarCollapsed.value
  // 移动端显示遮罩
  if (window.innerWidth < 768) {
    showOverlay.value = !sidebarCollapsed.value
  }
}

const closeSidebar = () => {
  if (window.innerWidth < 768) {
    sidebarCollapsed.value = true
    showOverlay.value = false
  }
}

const showNotifications = () => {
  showToast('通知功能开发中')
}

const handleLogout = async () => {
  try {
    await showConfirmDialog({
      title: '退出登录',
      message: '确定要退出登录吗？'
    })
    userStore.logout()
    router.push('/login')
  } catch {}
}

// 响应式处理
const handleResize = () => {
  if (window.innerWidth < 768) {
    sidebarCollapsed.value = true
  }
}

onMounted(() => {
  handleResize()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})
</script>

<style scoped>
.app-layout {
  display: flex;
  min-height: 100vh;
  background: #f0f2f5;
}

/* 侧边栏 */
.sidebar {
  width: 240px;
  background: linear-gradient(180deg, #1a1f36 0%, #252b48 100%);
  color: #fff;
  display: flex;
  flex-direction: column;
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
  z-index: 100;
  transition: width 0.3s ease;
}

.sidebar.collapsed {
  width: 72px;
}

.sidebar-header {
  padding: 20px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.logo {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo-icon {
  font-size: 28px;
}

.logo-text {
  font-size: 18px;
  font-weight: 600;
}

.logo-mini {
  font-size: 28px;
}

.collapse-btn {
  width: 28px;
  height: 28px;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 8px;
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.collapse-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

/* 用户信息 */
.user-info {
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.avatar {
  width: 40px;
  height: 40px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 600;
}

.user-detail {
  flex: 1;
}

.username {
  font-size: 14px;
  font-weight: 500;
}

.role {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  margin-top: 2px;
}

/* 导航菜单 */
.nav-menu {
  flex: 1;
  overflow-y: auto;
  padding: 12px 0;
}

.nav-group {
  margin-bottom: 8px;
}

.nav-group-title {
  padding: 8px 20px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.nav-item {
  display: flex;
  align-items: center;
  padding: 12px 20px;
  color: rgba(255, 255, 255, 0.7);
  text-decoration: none;
  transition: all 0.2s;
  cursor: pointer;
  position: relative;
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.nav-item.active {
  background: linear-gradient(90deg, rgba(102, 126, 234, 0.3), transparent);
  color: #fff;
}

.nav-item.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: #667eea;
  border-radius: 0 3px 3px 0;
}

.nav-icon {
  font-size: 20px;
  width: 24px;
  text-align: center;
}

.nav-text {
  margin-left: 12px;
  font-size: 14px;
  flex: 1;
}

.nav-badge {
  background: #ee0a24;
  color: #fff;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 10px;
  min-width: 18px;
  text-align: center;
}

/* 侧边栏底部 */
.sidebar-footer {
  padding: 12px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

/* 主内容区 */
.main-content {
  flex: 1;
  margin-left: 240px;
  transition: margin-left 0.3s ease;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.sidebar.collapsed + .main-content {
  margin-left: 72px;
}

/* 顶部栏 */
.topbar {
  height: 60px;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  position: sticky;
  top: 0;
  z-index: 50;
}

.topbar-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.menu-btn {
  display: none;
  width: 36px;
  height: 36px;
  background: #f5f6fa;
  border: none;
  border-radius: 8px;
  cursor: pointer;
}

.page-title {
  font-size: 18px;
  font-weight: 600;
  color: #1a1f36;
  margin: 0;
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.quick-action,
.notification {
  width: 36px;
  height: 36px;
  background: #f5f6fa;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  position: relative;
  transition: all 0.2s;
}

.quick-action:hover,
.notification:hover {
  background: #e8e9ef;
}

.notification .badge {
  position: absolute;
  top: -4px;
  right: -4px;
  background: #ee0a24;
  color: #fff;
  font-size: 10px;
  min-width: 16px;
  height: 16px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 页面内容 */
.page-content {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
  box-sizing: border-box;
}

/* 移动端遮罩 */
.sidebar-overlay {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 90;
}

.sidebar-overlay.visible {
  display: block;
}

/* 页面过渡 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 响应式 */
@media (max-width: 768px) {
  .sidebar {
    transform: translateX(-100%);
    width: 260px;
  }
  
  .sidebar:not(.collapsed) {
    transform: translateX(0);
  }
  
  .sidebar.collapsed {
    transform: translateX(-100%);
  }
  
  .main-content {
    margin-left: 0;
  }
  
  .sidebar.collapsed + .main-content {
    margin-left: 0;
  }
  
  .menu-btn {
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .collapse-btn {
    display: none;
  }
}
</style>