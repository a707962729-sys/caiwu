// 统一导出 API 模块
// 注意：reports 和 dashboard 都定义了 CategoryData，需要显式导出避免冲突

export * from './auth'
export * from './contract'
export * from './customer'
export * from './dict'
export * from './inventory'
export * from './invoice'
export * from './payable'
export * from './partner'
export * from './purchase'
export * from './receivable'
export * from './supplier'
export * from './product'
export * from './sales'
export * from './user'
export * from './workflow'

// 分别导出 reports 和 dashboard，避免 CategoryData 冲突
export { reportsApi, type ProfitLossData, type TrendData } from './reports'
export { 
  dashboardApi, 
  type DashboardOverview, 
  type AccountItem, 
  type CashflowData,
  type CategoryData as DashboardCategoryData,
  type CategoryItem
} from './dashboard'
export { 
  type CategoryData as ReportCategoryData 
} from './reports'

export { default as request } from './request'