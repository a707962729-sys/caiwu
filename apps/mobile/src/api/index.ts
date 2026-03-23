import type { 
  LoginParams, 
  LoginResult, 
  User,
  Transaction,
  TransactionCreateParams,
  TransactionListParams,
  Contract,
  ContractCreateParams,
  ContractListParams,
  Order,
  OrderCreateParams,
  OrderListParams,
  Reimbursement,
  ReimbursementCreateParams,
  ReimbursementListParams,
  Invoice,
  InvoiceCreateParams,
  InvoiceListParams,
  Partner,
  PartnerCreateParams,
  PartnerListParams,
  ReceivablePayable,
  DashboardOverview,
  UploadResult,
  OcrResult,
  PaginationResult
} from '@/types'
import { API_ENDPOINTS } from '@/config/api'
import { http } from '@/utils/request'

// 认证 API
export const authApi = {
  login(params: LoginParams): Promise<LoginResult> {
    return http.post(API_ENDPOINTS.auth.login, params)
  },
  
  logout(): Promise<void> {
    return http.post(API_ENDPOINTS.auth.logout)
  },
  
  getMe(): Promise<User> {
    return http.get(API_ENDPOINTS.auth.me)
  },
  
  updatePassword(data: { oldPassword: string; newPassword: string }): Promise<void> {
    return http.put(API_ENDPOINTS.auth.password, data)
  },
  
  refreshToken(): Promise<{ token: string }> {
    return http.post(API_ENDPOINTS.auth.refresh)
  }
}

// 用户 API
export const userApi = {
  getList(params?: { role?: string; status?: string }): Promise<PaginationResult<User>> {
    return http.get(API_ENDPOINTS.users.list, { params })
  },
  
  getDetail(id: number): Promise<User> {
    return http.get(API_ENDPOINTS.users.detail(id))
  },
  
  create(data: Partial<User> & { password: string }): Promise<User> {
    return http.post(API_ENDPOINTS.users.create, data)
  },
  
  update(id: number, data: Partial<User>): Promise<User> {
    return http.put(API_ENDPOINTS.users.update(id), data)
  },
  
  delete(id: number): Promise<void> {
    return http.delete(API_ENDPOINTS.users.delete(id))
  },
  
  resetPassword(id: number): Promise<{ tempPassword: string }> {
    return http.post(API_ENDPOINTS.users.resetPassword(id))
  }
}

// 交易 API
export const transactionApi = {
  getList(params: TransactionListParams): Promise<PaginationResult<Transaction>> {
    return http.get(API_ENDPOINTS.transactions.list, { params })
  },
  
  getStats(params?: { startDate?: string; endDate?: string }): Promise<{
    totalIncome: number
    totalExpense: number
    netProfit: number
    byCategory: Array<{ category: string; amount: number }>
  }> {
    return http.get(API_ENDPOINTS.transactions.stats, { params })
  },
  
  getDetail(id: number): Promise<Transaction> {
    return http.get(API_ENDPOINTS.transactions.detail(id))
  },
  
  create(data: TransactionCreateParams): Promise<Transaction> {
    return http.post(API_ENDPOINTS.transactions.create, data)
  },
  
  update(id: number, data: Partial<TransactionCreateParams>): Promise<Transaction> {
    return http.put(API_ENDPOINTS.transactions.update(id), data)
  },
  
  delete(id: number): Promise<void> {
    return http.delete(API_ENDPOINTS.transactions.delete(id))
  }
}

// 合同 API
export const contractApi = {
  getList(params: ContractListParams): Promise<PaginationResult<Contract>> {
    return http.get(API_ENDPOINTS.contracts.list, { params })
  },
  
  getDetail(id: number): Promise<Contract> {
    return http.get(API_ENDPOINTS.contracts.detail(id))
  },
  
  create(data: ContractCreateParams): Promise<Contract> {
    return http.post(API_ENDPOINTS.contracts.create, data)
  },
  
  update(id: number, data: Partial<ContractCreateParams>): Promise<Contract> {
    return http.put(API_ENDPOINTS.contracts.update(id), data)
  },
  
  delete(id: number): Promise<void> {
    return http.delete(API_ENDPOINTS.contracts.delete(id))
  }
}

// 订单 API
export const orderApi = {
  getList(params: OrderListParams): Promise<PaginationResult<Order>> {
    return http.get(API_ENDPOINTS.orders.list, { params })
  },
  
  getDetail(id: number): Promise<Order> {
    return http.get(API_ENDPOINTS.orders.detail(id))
  },
  
  create(data: OrderCreateParams): Promise<Order> {
    return http.post(API_ENDPOINTS.orders.create, data)
  },
  
  update(id: number, data: Partial<OrderCreateParams>): Promise<Order> {
    return http.put(API_ENDPOINTS.orders.update(id), data)
  },
  
  delete(id: number): Promise<void> {
    return http.delete(API_ENDPOINTS.orders.delete(id))
  }
}

// 报销 API
export const reimbursementApi = {
  getList(params: ReimbursementListParams): Promise<PaginationResult<Reimbursement>> {
    return http.get(API_ENDPOINTS.reimbursements.list, { params })
  },
  
  getDetail(id: number): Promise<Reimbursement> {
    return http.get(API_ENDPOINTS.reimbursements.detail(id))
  },
  
  create(data: ReimbursementCreateParams): Promise<Reimbursement> {
    return http.post(API_ENDPOINTS.reimbursements.create, data)
  },
  
  update(id: number, data: Partial<ReimbursementCreateParams>): Promise<Reimbursement> {
    return http.put(API_ENDPOINTS.reimbursements.update(id), data)
  },
  
  delete(id: number): Promise<void> {
    return http.delete(API_ENDPOINTS.reimbursements.delete(id))
  },
  
  submit(id: number): Promise<Reimbursement> {
    return http.post(API_ENDPOINTS.reimbursements.submit(id))
  },
  
  approve(id: number, data: { action: 'approve' | 'reject'; reject_reason?: string }): Promise<Reimbursement> {
    return http.post(API_ENDPOINTS.reimbursements.approve(id), data)
  },
  
  pay(id: number): Promise<Reimbursement> {
    return http.post(API_ENDPOINTS.reimbursements.pay(id))
  }
}

// 票据 API
export const invoiceApi = {
  getList(params: InvoiceListParams): Promise<PaginationResult<Invoice>> {
    return http.get(API_ENDPOINTS.invoices.list, { params })
  },
  
  getStats(): Promise<{
    total: number
    pending: number
    verified: number
    used: number
    totalAmount: number
  }> {
    return http.get(API_ENDPOINTS.invoices.stats)
  },
  
  getDetail(id: number): Promise<Invoice> {
    return http.get(API_ENDPOINTS.invoices.detail(id))
  },
  
  create(data: InvoiceCreateParams): Promise<Invoice> {
    return http.post(API_ENDPOINTS.invoices.create, data)
  },
  
  update(id: number, data: Partial<InvoiceCreateParams>): Promise<Invoice> {
    return http.put(API_ENDPOINTS.invoices.update(id), data)
  },
  
  delete(id: number): Promise<void> {
    return http.delete(API_ENDPOINTS.invoices.delete(id))
  },
  
  verify(id: number): Promise<Invoice> {
    return http.post(API_ENDPOINTS.invoices.verify(id))
  }
}

// 客户/供应商 API
export const partnerApi = {
  getList(params?: PartnerListParams): Promise<PaginationResult<Partner>> {
    return http.get(API_ENDPOINTS.partners.list, { params })
  },
  
  getDetail(id: number): Promise<Partner> {
    return http.get(API_ENDPOINTS.partners.detail(id))
  },
  
  create(data: PartnerCreateParams): Promise<Partner> {
    return http.post(API_ENDPOINTS.partners.create, data)
  },
  
  update(id: number, data: Partial<PartnerCreateParams>): Promise<Partner> {
    return http.put(API_ENDPOINTS.partners.update(id), data)
  },
  
  delete(id: number): Promise<void> {
    return http.delete(API_ENDPOINTS.partners.delete(id))
  }
}

// 应收应付 API
export const receivablePayableApi = {
  getList(params?: { type?: 'receivable' | 'payable'; status?: string }): Promise<PaginationResult<ReceivablePayable>> {
    return http.get(API_ENDPOINTS.receivablesPayables.list, { params })
  },
  
  getReceivables(params?: { status?: string }): Promise<PaginationResult<ReceivablePayable>> {
    return http.get(API_ENDPOINTS.receivablesPayables.receivables, { params })
  },
  
  getPayables(params?: { status?: string }): Promise<PaginationResult<ReceivablePayable>> {
    return http.get(API_ENDPOINTS.receivablesPayables.payables, { params })
  },
  
  getDetail(id: number): Promise<ReceivablePayable> {
    return http.get(API_ENDPOINTS.receivablesPayables.detail(id))
  },
  
  create(data: Partial<ReceivablePayable>): Promise<ReceivablePayable> {
    return http.post(API_ENDPOINTS.receivablesPayables.create, data)
  },
  
  update(id: number, data: Partial<ReceivablePayable>): Promise<ReceivablePayable> {
    return http.put(API_ENDPOINTS.receivablesPayables.update(id), data)
  },
  
  delete(id: number): Promise<void> {
    return http.delete(API_ENDPOINTS.receivablesPayables.delete(id))
  }
}

// 仪表盘 API
export const dashboardApi = {
  getOverview(params?: { startDate?: string; endDate?: string }): Promise<DashboardOverview> {
    return http.get(API_ENDPOINTS.dashboard.overview, { params })
  },
  
  getCashflow(params?: { months?: number }): Promise<{
    labels: string[]
    income: number[]
    expense: number[]
    balance: number[]
  }> {
    return http.get(API_ENDPOINTS.dashboard.cashflow, { params })
  },
  
  getCategory(): Promise<{
    income: Array<{ category: string; amount: number }>
    expense: Array<{ category: string; amount: number }>
  }> {
    return http.get(API_ENDPOINTS.dashboard.category)
  },
  
  getReceivables(): Promise<{
    total: number
    overdue: number
    dueSoon: number
    byPartner: Array<{ partner: string; amount: number }>
  }> {
    return http.get(API_ENDPOINTS.dashboard.receivables)
  },
  
  getPayables(): Promise<{
    total: number
    overdue: number
    dueSoon: number
    byPartner: Array<{ partner: string; amount: number }>
  }> {
    return http.get(API_ENDPOINTS.dashboard.payables)
  },
  
  getTax(params?: { year?: number }): Promise<{
    inputTax: number
    outputTax: number
    payableTax: number
    byMonth: Array<{ month: string; input: number; output: number }>
  }> {
    return http.get(API_ENDPOINTS.dashboard.tax, { params })
  }
}

// 文件上传 API
export const uploadApi = {
  uploadImage(file: File, onProgress?: (percent: number) => void): Promise<UploadResult> {
    return http.upload(API_ENDPOINTS.upload.image, file, onProgress)
  },
  
  uploadFile(file: File, onProgress?: (percent: number) => void): Promise<UploadResult> {
    return http.upload(API_ENDPOINTS.upload.file, file, onProgress)
  }
}

// AI 服务 API - 连接 OpenClaw 代理
export const aiApi = {
  // OpenClaw Gateway 地址（实际端口）
  OPENCLAW_URL: 'http://localhost:18789',
  
  // 根据角色获取代理 ID
  getAgentId(role: string): string {
    const agentMap: Record<string, string> = {
      'boss': 'caiwu-boss',
      'accountant': 'caiwu-accountant',
      'employee': 'caiwu-employee'
    }
    return agentMap[role] || 'caiwu-employee'
  },
  
  // 发送消息到 OpenClaw 代理
  async chat(data: { message: string; sessionId?: string; history?: any[] }): Promise<{
    response: string
    actions?: any[]
    sessionId?: string
  }> {
    // 获取当前用户角色
    const userStr = localStorage.getItem('user')
    const user = userStr ? JSON.parse(userStr) : null
    const agentId = this.getAgentId(user?.role || 'employee')
    
    try {
      // 调用 OpenClaw Gateway API
      const response = await fetch(`${this.OPENCLAW_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify({
          agentId,
          message: data.message,
          sessionId: data.sessionId,
          history: data.history
        })
      })
      
      if (!response.ok) {
        throw new Error('AI 服务暂不可用')
      }
      
      const result = await response.json()
      return {
        response: result.response || result.message || '收到',
        actions: result.actions,
        sessionId: result.sessionId
      }
    } catch (e) {
      console.error('OpenClaw chat error:', e)
      // 降级到本地 AI API
      return http.post('/ai/chat', data)
    }
  },
  
  recognizeInvoice(image: string): Promise<OcrResult> {
    return http.post(API_ENDPOINTS.ai.recognize, {
      type: 'invoice',
      image
    })
  },
  
  analyze(data: { module: string; period: string; metrics: string[] }): Promise<Record<string, unknown>> {
    return http.post(API_ENDPOINTS.ai.analyze, data)
  },
  
  recommend(data: { type: string; context: Record<string, unknown> }): Promise<{
    suggestions: Array<{ label: string; value: string; confidence: number }>
  }> {
    return http.post(API_ENDPOINTS.ai.recommend, data)
  },
  
  feedback(data: { suggestionId: string; helpful: boolean; comment?: string }): Promise<void> {
    return http.post(API_ENDPOINTS.ai.feedback, data)
  }
}