/// <reference types="vite/client" />

/**
 * 声明 Electron API 类型，使 window.electronAPI 可用
 */
import type { ElectronAPI } from '../electron/preload/index'

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

// CSS Modules 类型声明
declare module '*.module.less' {
  const classes: { readonly [key: string]: string }
  export default classes
}

declare module '*.module.css' {
  const classes: { readonly [key: string]: string }
  export default classes
}

// 图片资源类型声明
declare module '*.svg' {
  const content: string
  export default content
}

declare module '*.png' {
  const content: string
  export default content
}

declare module '*.jpg' {
  const content: string
  export default content
}
