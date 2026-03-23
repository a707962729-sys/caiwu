import { create } from 'zustand'

interface Contract {
  id: string
  name: string
  party: string
  amount: number
  startDate: string
  endDate: string
  status: 'active' | 'completed' | 'terminated'
  type: 'sales' | 'purchase' | 'service' | 'other'
  createdAt: string
}

interface ContractState {
  contracts: Contract[]
  loading: boolean
  addContract: (contract: Omit<Contract, 'id' | 'createdAt'>) => void
  updateContract: (id: string, contract: Partial<Contract>) => void
  deleteContract: (id: string) => void
  setContracts: (contracts: Contract[]) => void
  setLoading: (loading: boolean) => void
}

export const useContractStore = create<ContractState>((set) => ({
  contracts: [],
  loading: false,
  addContract: (contract) =>
    set((state) => ({
      contracts: [
        ...state.contracts,
        {
          ...contract,
          id: Date.now().toString(),
          createdAt: new Date().toISOString(),
        },
      ],
    })),
  updateContract: (id, contract) =>
    set((state) => ({
      contracts: state.contracts.map((c) =>
        c.id === id ? { ...c, ...contract } : c
      ),
    })),
  deleteContract: (id) =>
    set((state) => ({
      contracts: state.contracts.filter((c) => c.id !== id),
    })),
  setContracts: (contracts) => set({ contracts }),
  setLoading: (loading) => set({ loading }),
}))