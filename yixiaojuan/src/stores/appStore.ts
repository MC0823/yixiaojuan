/**
 * 应用全局状态 Store
 * 管理应用级别的状态，如用户信息、激活状态等
 */
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface UserInfo {
  id: string
  phone: string
  nickname?: string
  avatar?: string
}

export interface ActivationInfo {
  isActivated: boolean
  expiresAt: string | null
  deviceId: string | null
}

interface AppState {
  // 用户信息
  user: UserInfo | null
  isLoggedIn: boolean
  
  // 激活状态
  activation: ActivationInfo
  
  // 应用设置
  settings: {
    autoSave: boolean
    theme: 'light' | 'dark' | 'system'
    language: 'zh-CN' | 'en-US'
    cloudSync: boolean
  }
  
  // Actions
  setUser: (user: UserInfo | null) => void
  logout: () => void
  setActivation: (activation: Partial<ActivationInfo>) => void
  updateSettings: (settings: Partial<AppState['settings']>) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // 初始状态
      user: null,
      isLoggedIn: false,
      
      activation: {
        isActivated: false,
        expiresAt: null,
        deviceId: null
      },
      
      settings: {
        autoSave: true,
        theme: 'light',
        language: 'zh-CN',
        cloudSync: false
      },
      
      // Actions
      setUser: (user) => set({ user, isLoggedIn: !!user }),
      
      logout: () => set({ user: null, isLoggedIn: false }),
      
      setActivation: (activation) => set((state) => ({
        activation: { ...state.activation, ...activation }
      })),
      
      updateSettings: (settings) => set((state) => ({
        settings: { ...state.settings, ...settings }
      }))
    }),
    {
      name: 'yixiaojuan-app-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        isLoggedIn: state.isLoggedIn,
        activation: state.activation,
        settings: state.settings
      })
    }
  )
)
