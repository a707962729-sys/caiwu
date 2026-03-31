import request from './request'

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  images?: string[]
}

export interface ChatResponse {
  response: string
  conversationId: string
  provider: string
  toolUsed?: string
  toolResult?: any
  isStructured?: boolean
}

export interface QueryResponse {
  success: boolean
  question: string
  answer: string
  data: any
  queryInfo: any
  chart?: 'bar' | 'pie' | 'number'
}

export interface AiQueryData {
  question: string
}

export const aiApi = {
  /**
   * AI 对话
   * POST /api/ai/chat
   */
  chat(params: { message: string; context?: ChatMessage[]; conversationId?: string; images?: string[] }): Promise<ChatResponse> {
    return request.post('/ai/chat', params)
  },

  /**
   * 自然语言查询（财务数据查询）
   * POST /api/ai-query
   */
  query(params: AiQueryData): Promise<QueryResponse> {
    return request.post('/ai-query', params)
  }
}
