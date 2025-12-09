/**
 * 主题管理 Hook
 * 支持浅色/深色/跟随系统模式
 */
import { useEffect, useState, useCallback } from 'react'
import { theme } from 'antd'
import { useAppStore } from '../stores'

export type ThemeMode = 'light' | 'dark' | 'system'

export function useTheme() {
  const { settings, updateSettings } = useAppStore()
  const [isDark, setIsDark] = useState(false)

  // 检测系统主题
  const detectSystemTheme = useCallback(() => {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  }, [])

  // 更新实际主题状态
  const updateTheme = useCallback(() => {
    let dark = false
    if (settings.theme === 'dark') {
      dark = true
    } else if (settings.theme === 'system') {
      dark = detectSystemTheme()
    }
    setIsDark(dark)
    
    // 更新 document 属性用于 CSS 变量
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
  }, [settings.theme, detectSystemTheme])

  // 监听主题变化
  useEffect(() => {
    updateTheme()
    
    // 监听系统主题变化
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      if (settings.theme === 'system') {
        updateTheme()
      }
    }
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [settings.theme, updateTheme])

  // 设置主题模式
  const setThemeMode = useCallback((mode: ThemeMode) => {
    updateSettings({ theme: mode })
  }, [updateSettings])

  // 获取 antd 主题配置
  const antdTheme = {
    algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      colorPrimary: '#1890ff',
    }
  }

  return {
    themeMode: settings.theme,
    isDark,
    setThemeMode,
    antdTheme
  }
}
