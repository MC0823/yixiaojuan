/**
 * 窗口管理器
 * 统一管理应用窗口的创建、销毁和状态
 */
import { BrowserWindow, screen, app, session } from 'electron'
import { join } from 'path'

export interface WindowConfig {
  width?: number
  height?: number
  minWidth?: number
  minHeight?: number
  show?: boolean
  frame?: boolean
  devTools?: boolean
}

const DEFAULT_CONFIG: WindowConfig = {
  width: 1280,
  height: 800,
  minWidth: 1024,
  minHeight: 700,
  show: false,
  frame: true,
  devTools: true
}

class WindowManager {
  private mainWindow: BrowserWindow | null = null
  private get isDev() {
    return !app.isPackaged
  }

  /**
   * 获取预加载脚本路径
   */
  private getPreloadPath(): string {
    return join(__dirname, '../preload/index.js')
  }

  /**
   * 创建主窗口
   */
  createMainWindow(config: WindowConfig = {}): BrowserWindow {
    const mergedConfig = { ...DEFAULT_CONFIG, ...config }
    
    // 获取屏幕尺寸，确保窗口不超出屏幕
    const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize
    const width = Math.min(mergedConfig.width!, screenWidth)
    const height = Math.min(mergedConfig.height!, screenHeight)

    this.mainWindow = new BrowserWindow({
      width,
      height,
      minWidth: mergedConfig.minWidth,
      minHeight: mergedConfig.minHeight,
      show: mergedConfig.show,
      frame: mergedConfig.frame,
      titleBarStyle: 'default',
      backgroundColor: '#fafcf8', // 米白背景色
      webPreferences: {
        preload: this.getPreloadPath(),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false, // 关闭沙箱以支持屏幕录制
        webSecurity: true
      }
    })

    // 设置屏幕录制权限
    this.setupMediaPermissions()

    this.setupWindowEvents()
    this.loadContent()

    return this.mainWindow
  }

  /**
   * 设置窗口事件监听
   */
  private setupWindowEvents(): void {
    if (!this.mainWindow) return

    // 窗口准备就绪后显示
    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow?.show()
    })

    // 窗口关闭时清理引用
    this.mainWindow.on('closed', () => {
      this.mainWindow = null
    })

    // 阻止外部链接在应用内打开
    this.mainWindow.webContents.setWindowOpenHandler(() => {
      return { action: 'deny' }
    })
  }

  /**
   * 设置媒体权限（屏幕录制、麦克风）
   */
  private setupMediaPermissions(): void {
    // 设置权限请求处理
    session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
      const allowedPermissions = ['media', 'mediaKeySystem', 'display-capture', 'audioCapture', 'videoCapture']
      if (allowedPermissions.includes(permission)) {
        callback(true)
      } else {
        callback(false)
      }
    })

    // 设置权限检查处理
    session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
      const allowedPermissions = ['media', 'mediaKeySystem', 'display-capture', 'audioCapture', 'videoCapture']
      return allowedPermissions.includes(permission)
    })
  }

  /**
   * 加载页面内容
   */
  private loadContent(): void {
    if (!this.mainWindow) return

    if (this.isDev) {
      // 开发环境：加载 Vite 开发服务器
      // 尝试多个端口
      const ports = [5173, 5174, 5175]
      this.tryLoadDevServer(ports, 0)
      this.mainWindow.webContents.openDevTools()
    } else {
      // 生产环境：加载打包后的文件
      this.mainWindow.loadFile(join(__dirname, '../../dist/index.html'))
    }
  }

  /**
   * 尝试连接开发服务器（自动重试不同端口）
   */
  private tryLoadDevServer(ports: number[], index: number): void {
    if (!this.mainWindow || index >= ports.length) return

    const port = ports[index]
    this.mainWindow.loadURL(`http://localhost:${port}`).catch(() => {
      console.log(`端口 ${port} 连接失败，尝试下一个端口...`)
      this.tryLoadDevServer(ports, index + 1)
    })
  }

  /**
   * 获取主窗口实例
   */
  getMainWindow(): BrowserWindow | null {
    return this.mainWindow
  }

  /**
   * 显示主窗口
   */
  showMainWindow(): void {
    if (this.mainWindow) {
      if (this.mainWindow.isMinimized()) {
        this.mainWindow.restore()
      }
      this.mainWindow.focus()
    }
  }

  /**
   * 隐藏主窗口
   */
  hideMainWindow(): void {
    this.mainWindow?.hide()
  }

  /**
   * 最小化主窗口
   */
  minimizeMainWindow(): void {
    this.mainWindow?.minimize()
  }

  /**
   * 最大化/还原主窗口
   */
  toggleMaximize(): void {
    if (!this.mainWindow) return
    
    if (this.mainWindow.isMaximized()) {
      this.mainWindow.unmaximize()
    } else {
      this.mainWindow.maximize()
    }
  }

  /**
   * 检查主窗口是否存在
   */
  hasMainWindow(): boolean {
    return this.mainWindow !== null && !this.mainWindow.isDestroyed()
  }

  /**
   * 关闭所有窗口
   */
  closeAllWindows(): void {
    BrowserWindow.getAllWindows().forEach(win => {
      win.close()
    })
  }
}

// 导出单例
export const windowManager = new WindowManager()
