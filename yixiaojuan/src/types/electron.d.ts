/**
 * Electron API 类型声明
 * 在渲染进程中通过 window.electronAPI 访问
 */
import type { ElectronAPI } from '../electron/preload/index'

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
