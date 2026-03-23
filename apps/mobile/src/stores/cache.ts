import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Reimbursement, Invoice } from '@/types'

export const useCacheStore = defineStore('cache', () => {
  // 待提交的报销单（本地草稿）
  const reimbursementDraft = ref<Partial<Reimbursement> | null>(null)
  
  // 已上传但未使用的票据
  const unusedInvoices = ref<Invoice[]>([])
  
  // 最近使用的报销类型
  const recentReimbursementTypes = ref<string[]>([])
  
  // 最近使用的费用类别
  const recentCategories = ref<string[]>([])
  
  // Actions
  function saveReimbursementDraft(draft: Partial<Reimbursement>) {
    reimbursementDraft.value = draft
  }
  
  function clearReimbursementDraft() {
    reimbursementDraft.value = null
  }
  
  function addUnusedInvoice(invoice: Invoice) {
    unusedInvoices.value.push(invoice)
  }
  
  function removeUnusedInvoice(invoiceId: number) {
    const index = unusedInvoices.value.findIndex(i => i.id === invoiceId)
    if (index > -1) {
      unusedInvoices.value.splice(index, 1)
    }
  }
  
  function clearUnusedInvoices() {
    unusedInvoices.value = []
  }
  
  function addRecentReimbursementType(type: string) {
    const index = recentReimbursementTypes.value.indexOf(type)
    if (index > -1) {
      recentReimbursementTypes.value.splice(index, 1)
    }
    recentReimbursementTypes.value.unshift(type)
    // 保留最近 10 个
    if (recentReimbursementTypes.value.length > 10) {
      recentReimbursementTypes.value.pop()
    }
  }
  
  function addRecentCategory(category: string) {
    const index = recentCategories.value.indexOf(category)
    if (index > -1) {
      recentCategories.value.splice(index, 1)
    }
    recentCategories.value.unshift(category)
    // 保留最近 10 个
    if (recentCategories.value.length > 10) {
      recentCategories.value.pop()
    }
  }
  
  function clearCache() {
    reimbursementDraft.value = null
    unusedInvoices.value = []
    recentReimbursementTypes.value = []
    recentCategories.value = []
  }
  
  return {
    // State
    reimbursementDraft,
    unusedInvoices,
    recentReimbursementTypes,
    recentCategories,
    // Actions
    saveReimbursementDraft,
    clearReimbursementDraft,
    addUnusedInvoice,
    removeUnusedInvoice,
    clearUnusedInvoices,
    addRecentReimbursementType,
    addRecentCategory,
    clearCache
  }
}, {
  persist: {
    key: 'caiwu-cache',
    storage: localStorage
  }
})