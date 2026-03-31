<template>
  <el-container class="main-layout">
    <!-- 侧边栏 -->
    <el-aside :width="isCollapse ? '64px' : '220px'" class="sidebar">
      <div class="sidebar-header">
        <div class="logo">
          <el-icon :size="28" color="#fff"><Wallet /></el-icon>
        </div>
        <span v-show="!isCollapse" class="title">财务管家</span>
      </div>
      
      <el-menu
        :default-active="activeMenu"
        :collapse="isCollapse"
        :collapse-transition="false"
        class="sidebar-menu"
        @select="handleMenuSelect"
      >
        <el-menu-item index="/dashboard">
          <el-icon><DataAnalysis /></el-icon>
          <template #title>仪表盘</template>
        </el-menu-item>
        
        <el-menu-item index="/transactions">
          <el-icon><List /></el-icon>
          <template #title>记账管理</template>
        </el-menu-item>
        
        <el-menu-item index="/contracts">
          <el-icon><Document /></el-icon>
          <template #title>合同管理</template>
        </el-menu-item>
        
        <el-menu-item index="/partners">
          <el-icon><User /></el-icon>
          <template #title>合作伙伴</template>
        </el-menu-item>
        
        <el-menu-item index="/customers">
          <el-icon><Avatar /></el-icon>
          <template #title>客户管理</template>
        </el-menu-item>
        
        <el-sub-menu index="finance">
          <template #title>
            <el-icon><Money /></el-icon>
            <span>财务往来</span>
          </template>
          <el-menu-item index="/receivables">应收账款</el-menu-item>
          <el-menu-item index="/payables">应付账款</el-menu-item>
        </el-sub-menu>
        
        <el-menu-item index="/sales">
          <el-icon><ShoppingCart /></el-icon>
          <template #title>销售订单</template>
        </el-menu-item>
        <el-menu-item index="/invoices">
          <el-icon><Tickets /></el-icon>
          <template #title>票据管理</template>
        </el-menu-item>
        
        <el-menu-item index="/reports">
          <el-icon><TrendCharts /></el-icon>
          <template #title>报表中心</template>
        </el-menu-item>
        
        <el-menu-item index="/users">
          <el-icon><Setting /></el-icon>
          <template #title>用户管理</template>
        </el-menu-item>

        <el-sub-menu index="hr">
          <template #title>
            <el-icon><UserFilled /></el-icon>
            <span>人事管理</span>
          </template>
          <el-menu-item index="/employees">员工管理</el-menu-item>
          <el-menu-item index="/attendance">考勤管理</el-menu-item>
          <el-menu-item index="/salary">工资管理</el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="system">
          <template #title>
            <el-icon><Setting /></el-icon>
            <span>系统设置</span>
          </template>
          <el-menu-item index="/settings">基础设置</el-menu-item>
          <el-menu-item index="/settings?tab=qqbot">QQ机器人</el-menu-item>
          <el-menu-item index="/launcher">服务管理器</el-menu-item>
        </el-sub-menu>
      </el-menu>
    </el-aside>

    <!-- 主内容区 -->
    <el-container class="main-container">
      <!-- 头部 -->
      <el-header class="header">
        <div class="header-left">
          <el-icon 
            class="collapse-btn" 
            @click="isCollapse = !isCollapse"
          >
            <component :is="isCollapse ? 'Expand' : 'Fold'" />
          </el-icon>
          <el-breadcrumb separator="/">
            <el-breadcrumb-item :to="{ path: '/' }">首页</el-breadcrumb-item>
            <el-breadcrumb-item>{{ currentTitle }}</el-breadcrumb-item>
          </el-breadcrumb>
        </div>
        
        <div class="header-right">
          <el-dropdown @command="handleCommand">
            <div class="user-info">
              <el-avatar :size="32" :src="userAvatar">
                <el-icon><User /></el-icon>
              </el-avatar>
              <span class="username">{{ userName }}</span>
              <el-icon><ArrowDown /></el-icon>
            </div>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="profile">
                  <el-icon><User /></el-icon>
                  个人中心
                </el-dropdown-item>
                <el-dropdown-item command="settings">
                  <el-icon><Setting /></el-icon>
                  系统设置
                </el-dropdown-item>
                <el-dropdown-item divided command="logout">
                  <el-icon><SwitchButton /></el-icon>
                  退出登录
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>

      <!-- 内容区 -->
      <el-main class="main">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </el-main>
    </el-container>

    <!-- AI 聊天助手 -->
    <AiChatWidget />
  </el-container>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import { 
  Wallet, DataAnalysis, List, Document, User, Avatar, Money,
  Tickets, TrendCharts, Setting, ArrowDown, SwitchButton,
  Expand, Fold, ShoppingCart, UserFilled, Clock
} from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'
import AiChatWidget from '@/components/AiChatWidget.vue'
import { useSafeNavigate } from '@/composables/useNavigation'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const { safeNavigate } = useSafeNavigate()

// 侧边栏折叠状态
const isCollapse = ref(false)

// 当前激活菜单
const activeMenu = computed(() => route.path)

// 当前页面标题
const currentTitle = computed(() => route.meta.title as string || '首页')

// 用户信息
const userName = computed(() => userStore.userName)
const userAvatar = computed(() => userStore.user?.avatar || '')

// 防抖导航函数 - 使用全局导航锁
const handleMenuSelect = (index: string) => {
  // 防止在同一路由快速点击
  if (index === route.path) return
  
  // 使用安全的导航（内部已有防抖）
  safeNavigate(index)
}

// 处理下拉菜单命令
async function handleCommand(command: string) {
  switch (command) {
    case 'profile':
      safeNavigate('/profile')
      break
    case 'settings':
      safeNavigate('/settings')
      break
    case 'logout':
      try {
        await ElMessageBox.confirm('确定要退出登录吗？', '提示', {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning'
        })
        await userStore.logout()
        safeNavigate('/login')
      } catch {
        // 取消退出
      }
      break
  }
}
</script>

<style lang="scss" scoped>
.main-layout {
  height: 100vh;
  overflow: hidden;
}

// 侧边栏
.sidebar {
  background: linear-gradient(180deg, #1a1a2e 0%, #16213e 100%);
  transition: width 0.3s;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  height: 100%;
}

.sidebar-header {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 0 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);

  .logo {
    width: 36px;
    height: 36px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .title {
    font-size: 18px;
    font-weight: 600;
    color: #fff;
    white-space: nowrap;
  }
}

.sidebar-menu {
  background: transparent;
  border: none;
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  
  // 美化滚动条
  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 2px;
  }
  &::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.3);
  }
  
  :deep(.el-menu-item),
  :deep(.el-sub-menu__title) {
    color: rgba(255, 255, 255, 0.7);
    
    &:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #fff;
    }
    
    // 导航锁定时的禁用样式
    &.is-disabled {
      opacity: 0.5;
      cursor: not-allowed;
      pointer-events: none;
    }
  }
  
  :deep(.el-menu-item.is-active) {
    background: linear-gradient(90deg, rgba(102, 126, 234, 0.3) 0%, transparent 100%);
    color: #fff;
    border-left: 3px solid #667eea;
  }
  
  :deep(.el-sub-menu.is-active > .el-sub-menu__title) {
    color: #fff;
  }
  
  // 二级菜单样式
  :deep(.el-sub-menu .el-menu) {
    background: rgba(0, 0, 0, 0.2);
  }
  
  :deep(.el-sub-menu .el-menu-item) {
    color: rgba(255, 255, 255, 0.6);
    background: transparent;
    padding-left: 50px !important;
    
    &:hover {
      background: rgba(255, 255, 255, 0.08);
      color: #fff;
    }
    
    &.is-active {
      background: linear-gradient(90deg, rgba(102, 126, 234, 0.2) 0%, transparent 100%);
      color: #667eea;
      border-left: none;
    }
    
    &.is-disabled {
      opacity: 0.5;
      cursor: not-allowed;
      pointer-events: none;
    }
  }
}

// 主容器
.main-container {
  flex-direction: column;
  background: #f5f7fa;
}

// 头部
.header {
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  height: 60px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;

  .collapse-btn {
    font-size: 20px;
    cursor: pointer;
    color: #606266;
    transition: color 0.3s;
    
    &:hover {
      color: #667eea;
    }
  }
}

.header-right {
  display: flex;
  align-items: center;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 8px 12px;
  border-radius: 8px;
  transition: background 0.3s;
  
  &:hover {
    background: #f5f7fa;
  }
  
  .username {
    font-size: 14px;
    color: #1a1a2e;
  }
}

// 内容区
.main {
  padding: 20px;
  overflow-y: auto;
}

// 过渡动画
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>