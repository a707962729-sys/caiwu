import { create } from 'zustand'

interface AccountingRecord {
  id: string
  date: string
  type: 'income' | 'expense'
  category: string
  amount: number
  description: string
  projectId?: string
  createdAt: string
}

interface AccountingState {
  records: AccountingRecord[]
  loading: boolean
  addRecord: (record: Omit<AccountingRecord, 'id' | 'createdAt'>) => void
  updateRecord: (id: string, record: Partial<AccountingRecord>) => void
  deleteRecord: (id: string) => void
  setRecords: (records: AccountingRecord[]) => void
  setLoading: (loading: boolean) => void
}

export const useAccountingStore = create<AccountingState>((set) => ({
  records: [],
  loading: false,
  addRecord: (record) =>
    set((state) => ({
      records: [
        ...state.records,
        {
          ...record,
          id: Date.now().toString(),
          createdAt: new Date().toISOString(),
        },
      ],
    })),
  updateRecord: (id, record) =>
    set((state) => ({
      records: state.records.map((r) =>
        r.id === id ? { ...r, ...record } : r
      ),
    })),
  deleteRecord: (id) =>
    set((state) => ({
      records: state.records.filter((r) => r.id !== id),
    })),
  setRecords: (records) => set({ records }),
  setLoading: (loading) => set({ loading }),
}))