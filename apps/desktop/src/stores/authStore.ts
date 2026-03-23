import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/types'

interface AuthState {
  isAuthenticated: boolean
  user: User | null
  token: string | null
  login: (user: User, token: string) => void
  logout: () => void
  updateUser: (user: Partial<User>) => void
  setToken: (token: string) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      user: null,
      token: null,
      login: (user, token) =>
        set({
          isAuthenticated: true,
          user,
          token,
        }),
      logout: () =>
        set({
          isAuthenticated: false,
          user: null,
          token: null,
        }),
      updateUser: (userData) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...userData } : null,
        })),
      setToken: (token) =>
        set({ token }),
    }),
    {
      name: 'auth-storage',
    }
  )
)