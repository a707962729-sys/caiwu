import request from './request'
import { API_ENDPOINTS } from '@/config/api'

// 损益表数据
export interface ProfitLossData {
  totalIncome: number
  totalExpense: number
  netProfit: number
  incomeByCategory: CategoryData[]
  expenseByCategory: CategoryData[]
  trend: TrendData[]
}

// 分类数据
export interface CategoryData {
  category: string
  amount: number
  percentage: number
}

// 趋势数据
export interface TrendData {
  date: string
  income: number
  expense: number
}

// 财务报表 API
export const reportsApi = {
  // 获取损益表
  getProfitLoss(params?: { startDate?: string; endDate?: string }): Promise<ProfitLossData> {
    return request.get(API_ENDPOINTS.reports.profitLoss, { params })
  },
  
  // 获取资产负债表
  getBalance(): Promise<any> {
    return request.get(API_ENDPOINTS.reports.balance)
  },
  
  // 获取现金流量表
  getCashflow(): Promise<any> {
    return request.get(API_ENDPOINTS.reports.cashflow)
  }
}