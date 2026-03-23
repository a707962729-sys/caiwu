import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { TokenManager } from '@/utils/auth'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/login/index.vue'),
    meta: { requiresAuth: false, title: '登录' }
  },
  {
    path: '/',
    component: () => import('@/layouts/MainLayout.vue'),
    redirect: '/home',
    meta: { requiresAuth: true },
    children: [
      {
        path: 'home',
        name: 'Home',
        component: () => import('@/views/home/index.vue'),
        meta: { title: '首页', showTabbar: true }
      },
      {
        path: 'chat',
        name: 'Chat',
        component: () => import('@/views/chat/index.vue'),
        meta: { title: '智能助手', showTabbar: false }
      },
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/dashboard/index.vue'),
        meta: { title: '数据大屏', showTabbar: false }
      },
      {
        path: 'transactions',
        name: 'TransactionList',
        component: () => import('@/views/transactions/index.vue'),
        meta: { title: '记账记录', showTabbar: true }
      },
      {
        path: 'transactions/create',
        name: 'TransactionCreate',
        component: () => import('@/views/transactions/create.vue'),
        meta: { title: '新建记账' }
      },
      {
        path: 'contracts',
        name: 'ContractList',
        component: () => import('@/views/contracts/index.vue'),
        meta: { title: '合同管理', showTabbar: false }
      },
      {
        path: 'partners',
        name: 'PartnerList',
        component: () => import('@/views/partners/index.vue'),
        meta: { title: '合作伙伴', showTabbar: false }
      },
      {
        path: 'receivables',
        name: 'ReceivablesList',
        component: () => import('@/views/receivables/index.vue'),
        meta: { title: '应收账款', showTabbar: false }
      },
      {
        path: 'payables',
        name: 'PayablesList',
        component: () => import('@/views/payables/index.vue'),
        meta: { title: '应付账款', showTabbar: false }
      },
      {
        path: 'upload',
        name: 'Upload',
        component: () => import('@/views/upload/index.vue'),
        meta: { title: '上传票据', showTabbar: true }
      },
      {
        path: 'reimbursement',
        name: 'ReimbursementList',
        component: () => import('@/views/reimbursement/index.vue'),
        meta: { title: '报销记录', showTabbar: true }
      },
      {
        path: 'reimbursement/create',
        name: 'ReimbursementCreate',
        component: () => import('@/views/reimbursement/create.vue'),
        meta: { title: '新建报销' }
      },
      {
        path: 'reimbursement/:id',
        name: 'ReimbursementDetail',
        component: () => import('@/views/reimbursement/detail.vue'),
        meta: { title: '报销详情' }
      },
      {
        path: 'reports',
        name: 'Reports',
        component: () => import('@/views/reports/index.vue'),
        meta: { title: '报表中心', showTabbar: false }
      },
      {
        path: 'invoice',
        name: 'InvoiceList',
        component: () => import('@/views/invoice/index.vue'),
        meta: { title: '票据管理', showTabbar: false }
      },
      {
        path: 'invoice/:id',
        name: 'InvoiceDetail',
        component: () => import('@/views/invoice/detail.vue'),
        meta: { title: '票据详情' }
      },
      {
        path: 'profile',
        name: 'Profile',
        component: () => import('@/views/profile/index.vue'),
        meta: { title: '我的', showTabbar: true }
      },
      {
        path: 'profile/settings',
        name: 'Settings',
        component: () => import('@/views/profile/settings.vue'),
        meta: { title: '设置' }
      },
      {
        path: 'profile/password',
        name: 'ChangePassword',
        component: () => import('@/views/profile/password.vue'),
        meta: { title: '修改密码' }
      },
      {
        path: 'attendance',
        name: 'Attendance',
        component: () => import('@/views/attendance/index.vue'),
        meta: { title: '考勤管理', showTabbar: false }
      },
      {
        path: 'leave',
        name: 'Leave',
        component: () => import('@/views/leave/index.vue'),
        meta: { title: '请假管理', showTabbar: false }
      },
      {
        path: 'salary',
        name: 'Salary',
        component: () => import('@/views/salary/index.vue'),
        meta: { title: '工资管理', showTabbar: false }
      }
    ]
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/error/404.vue'),
    meta: { title: '页面不存在' }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition
    } else {
      return { top: 0 }
    }
  }
})

// 路由守卫
router.beforeEach(async (to, from, next) => {
  const userStore = useUserStore()
  
  // 设置页面标题
  document.title = `${to.meta.title || '财务管家'} - 财务管家`
  
  // 不需要登录的页面
  if (to.meta.requiresAuth === false) {
    // 已登录且 Token 有效时，访问登录页跳转到首页
    if (to.path === '/login' && TokenManager.isTokenValid() && userStore.isLoggedIn) {
      next('/home')
      return
    }
    next()
    return
  }
  
  // 需要登录的页面
  // 1. 检查 Token 是否有效
  if (!TokenManager.isTokenValid()) {
    // Token 无效或已过期
    next({
      path: '/login',
      query: { redirect: to.fullPath }
    })
    return
  }
  
  // 2. 检查用户信息
  if (!userStore.isLoggedIn) {
    // 有 Token 但没有用户信息，尝试获取
    try {
      await userStore.fetchUserInfo()
    } catch {
      // 获取用户信息失败
      next({
        path: '/login',
        query: { redirect: to.fullPath }
      })
      return
    }
  }
  
  // 3. 检查是否已登录
  if (!userStore.isLoggedIn) {
    next({
      path: '/login',
      query: { redirect: to.fullPath }
    })
    return
  }
  
  next()
})

export default router