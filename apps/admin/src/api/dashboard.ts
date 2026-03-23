import request from './request'
import { API_ENDPOINTS } from '@/config/api'

// 仪表盘概览数据类型
export interface DashboardOverview {
  incomeExpense: {
    income: number
    expense: number
    net: number
  }
  accounts: {
    total: number
    list: AccountItem[]
  }
  receivablesPayables: {
    receivable: number
    received: number
    payable: number
    paid: number
  }
  pending: {
    reimbursements: number
    invoices: number
    contracts: number
  }
  trends?: {
    income: number
    expense: number
  }
}

export interface AccountItem {
  id: number
  name: string
  account_type: 'bank' | 'cash' | 'alipay' | 'wechat' | 'other'
  account_no?: string
  balance: number
}

export interface CashflowData {
  month: string
  income: number
  expense: number
  net: number
}

export interface CategoryData {
  categories: CategoryItem[]
}

export interface CategoryItem {
  transaction_type: 'income' | 'expense'
  category: string
  total: number
  count: number
}

// 仪表盘 API
export const dashboardApi = {
  // 获取概览数据
  getOverview(params?: { startDate?: string; endDate?: string }): Promise<DashboardOverview> {
    return request.get(API_ENDPOINTS.dashboard.overview, { params })
  },
  
  // 获取现金流数据
  getCashflow(params?: { months?: number }): Promise<CashflowData[]> {
    return request.get(API_ENDPOINTS.dashboard.cashflow, { params })
  },
  
  // 获取分类统计
  getCategory(): Promise<CategoryData> {
    return request.get(API_ENDPOINTS.dashboard.category)
  },
  
  // 获取应收统计
  getReceivables(): Promise<{
    total: number
    overdue: number
    dueSoon: number
    byPartner: Array<{ partner: string; amount: number }>
  }> {
    return request.get(API_ENDPOINTS.dashboard.receivables)
  },
  
  // 获取应付统计
  getPayables(): Promise<{
    total: number
    overdue: number
    dueSoon: number
    byPartner: Array<{ partner: string; amount: number }>
  }> {
    return request.get(API_ENDPOINTS.dashboard.payables)
  }
}