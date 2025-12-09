/**
 * 应用路由配置
 */
import { createHashRouter, Navigate } from 'react-router-dom'
import MainLayout from '../components/layout/MainLayout'
import WorkspacePage from '../pages/Workspace'
import SettingsPage from '../pages/Settings'
import PresentationPage from '../pages/Presentation'

// 路由路径常量
export const ROUTES = {
  HOME: '/',
  SETTINGS: '/settings',
  PRESENTATION: '/presentation/:id'
} as const

// 使用 HashRouter 以兼容 Electron 文件协议
export const router = createHashRouter([
  // 主工作区（全屏布局）
  {
    path: '/',
    element: <WorkspacePage />
  },
  // Settings页面
  {
    path: '/settings',
    element: <MainLayout />,
    children: [
      {
        index: true,
        element: <SettingsPage />
      }
    ]
  },
  // 全屏演示模式
  {
    path: '/presentation/:id',
    element: <PresentationPage />
  },
  // 404重定向到首页
  {
    path: '*',
    element: <Navigate to="/" replace />
  }
])
