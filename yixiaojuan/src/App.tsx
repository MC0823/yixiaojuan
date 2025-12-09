/**
 * 应用根组件
 */
import { ConfigProvider, theme as antdTheme } from 'antd'
import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { ErrorBoundary } from './components/ErrorBoundary'
import { useTheme, useLanguage } from './hooks'

// Ant Design 主题配置 - 毛璃璃风格
const getThemeConfig = (isDark: boolean) => ({
  algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
  token: {
    colorPrimary: '#87bd76',
    colorSuccess: '#4d7c3e',
    borderRadius: 8,
    fontSize: 14
  },
  components: {
    Button: {
      borderRadius: 8
    },
    Card: {
      borderRadius: 12,
      colorBgContainer: isDark ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.12)'
    },
    Modal: {
      borderRadius: 12
    },
    Layout: {
      colorBgBody: 'transparent',
      colorBgHeader: 'transparent',
      siderBg: 'transparent',
      bodyBg: 'transparent'
    },
    Upload: {
      colorFillAlter: isDark ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.08)'
    }
  }
})

function AppContent() {
  const { isDark } = useTheme()
  const { antdLocale } = useLanguage()
  
  return (
    <ConfigProvider locale={antdLocale} theme={getThemeConfig(isDark)}>
      <RouterProvider router={router} />
    </ConfigProvider>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  )
}

export default App
