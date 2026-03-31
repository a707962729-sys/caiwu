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
    redirect: '/dashboard',
    meta: { requiresAuth: true },
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/dashboard/index.vue'),
        meta: { title: '仪表盘', icon: 'DataAnalysis' }
      },
      {
        path: 'transactions',
        name: 'Transactions',
        component: () => import('@/views/transactions/index.vue'),
        meta: { title: '记账管理', icon: 'List' }
      },
      {
        path: 'contracts',
        name: 'Contracts',
        component: () => import('@/views/contracts/index.vue'),
        meta: { title: '合同管理', icon: 'Document' }
      },
      {
        path: 'contracts/review/:id',
        name: 'ContractReview',
        component: () => import('@/views/contracts/review.vue'),
        meta: { title: '合同审核', icon: 'Document' }
      },
      {
        path: 'partners',
        name: 'Partners',
        component: () => import('@/views/partners/index.vue'),
        meta: { title: '合作伙伴', icon: 'User' }
      },
      {
        path: 'customers',
        name: 'Customers',
        component: () => import('@/views/customers/index.vue'),
        meta: { title: '客户管理', icon: 'Avatar' }
      },
      {
        path: 'receivables',
        name: 'Receivables',
        component: () => import('@/views/receivables/index.vue'),
        meta: { title: '应收账款', icon: 'Money' }
      },
      {
        path: 'payables',
        name: 'Payables',
        component: () => import('@/views/payables/index.vue'),
        meta: { title: '应付账款', icon: 'Wallet' }
      },
      {
        path: 'sales',
        name: 'Sales',
        component: () => import('@/views/sales/index.vue'),
        meta: { title: '销售订单', icon: 'ShoppingCart' }
      },
      {
        path: 'invoices',
        name: 'Invoices',
        component: () => import('@/views/invoices/index.vue'),
        meta: { title: '票据管理', icon: 'Tickets' }
      },
      {
        path: 'inventory',
        name: 'Inventory',
        component: () => import('@/views/inventory/index.vue'),
        meta: { title: '库存管理', icon: 'Box' }
      },
      {
        path: 'products',
        name: 'Products',
        component: () => import('@/views/products/index.vue'),
        meta: { title: '商品档案', icon: 'Goods' }
      },
      {
        path: 'purchase',
        name: 'Purchase',
        component: () => import('@/views/purchase/index.vue'),
        meta: { title: '采购订单', icon: 'ShoppingCart' }
      },
      {
        path: 'reports',
        name: 'Reports',
        component: () => import('@/views/reports/index.vue'),
        meta: { title: '报表中心', icon: 'TrendCharts' }
      },
      {
        path: 'users',
        name: 'Users',
        component: () => import('@/views/users/index.vue'),
        meta: { title: '用户管理', icon: 'Setting' }
      },
      {
        path: 'employees',
        name: 'Employees',
        component: () => import('@/views/employees/index.vue'),
        meta: { title: '员工管理', icon: 'UserFilled' }
      },
      {
        path: 'employees/:id',
        name: 'EmployeeDetail',
        component: () => import('@/views/employees/EmployeeDetail.vue'),
        meta: { title: '员工详情', icon: 'UserFilled' }
      },
      {
        path: 'attendance',
        name: 'Attendance',
        component: () => import('@/views/attendance/index.vue'),
        meta: { title: '考勤管理', icon: 'Clock' }
      },
      {
        path: 'salary',
        name: 'Salary',
        component: () => import('@/views/salary/index.vue'),
        meta: { title: '工资管理', icon: 'Money' }
      },
      {
        path: 'onboarding',
        name: 'Onboarding',
        component: () => import('@/views/onboarding/index.vue'),
        meta: { title: '入职录入', icon: 'User' }
      },
      {
        path: 'suppliers',
        name: 'Suppliers',
        component: () => import('@/views/suppliers/index.vue'),
        meta: { title: '供应商管理', icon: 'Shop' }
      },
      {
        path: 'workflows/history',
        name: 'WorkflowHistory',
        component: () => import('@/views/workflows/history/index.vue'),
        meta: { title: '审批历史', icon: 'Finished' }
      },
      {
        path: 'settings',
        name: 'Settings',
        component: () => import('@/views/settings/index.vue'),
        meta: { title: '系统设置', icon: 'Setting' }
      },
      {
        path: 'workflows/definitions',
        name: 'WorkflowDefinitions',
        component: () => import('@/views/workflows/definitions/index.vue'),
        meta: { title: '流程定义', icon: 'Share' }
      },
      {
        path: 'reimbursements',
        name: 'Reimbursements',
        component: () => import('@/views/reimbursements/index.vue'),
        meta: { title: '报销管理', icon: 'Wallet' }
      },
      {
        path: 'workflows/tasks',
        name: 'WorkflowTasks',
        component: () => import('@/views/workflows/tasks/index.vue'),
        meta: { title: '我的待办', icon: 'Document' }
      },
      {
        path: 'ai',
        name: 'AI',
        component: () => import('@/views/ai/index.vue'),
        meta: { title: 'AI 助手', icon: 'MagicStick' }
      },
    ]
  },
  {
    path: '/launcher',
    name: 'Launcher',
    component: () => import('@/views/launcher/index.vue'),
    meta: { title: '服务管理器', icon: 'Setting', requiresAuth: false }
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
  routes
})

router.beforeEach(async (to, from, next) => {
  // 组件的 handleMenuSelect 已经有防抖处理，这里不需要重复加锁
  
  const userStore = useUserStore()
  
  // 设置页面标题
  document.title = `${to.meta.title || '财务管家'} - 财务管家管理后台`
  
  // 不需要登录的页面
  if (to.meta.requiresAuth === false) {
    // 已登录且 Token 有效时，访问登录页跳转到仪表盘
    if (to.path === '/login' && TokenManager.isTokenValid() && userStore.isLoggedIn) {
      next('/dashboard')
      return
    }
    next()
    return
  }
  
  // 需要登录的页面
  // 1. 检查 Token 是否有效
  if (!TokenManager.isTokenValid()) {
    next({
      path: '/login',
      query: { redirect: to.fullPath }
    })
    return
  }
  
  // 2. 检查用户信息
  if (!userStore.isLoggedIn) {
    try {
      await userStore.fetchUserInfo()
    } catch {
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