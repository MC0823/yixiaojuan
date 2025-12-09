/**
 * 系统托盘管理器
 * 提供托盘图标、右键菜单、双击恢复窗口功能
 */
import { app, Tray, Menu, nativeImage, BrowserWindow, NativeImage } from 'electron'
import * as path from 'path'
import * as fs from 'fs'

class TrayManager {
  private static instance: TrayManager
  private tray: Tray | null = null
  private mainWindow: BrowserWindow | null = null
  private isQuitting: boolean = false

  private constructor() {}

  public static getInstance(): TrayManager {
    if (!TrayManager.instance) {
      TrayManager.instance = new TrayManager()
    }
    return TrayManager.instance
  }

  /**
   * 初始化托盘
   */
  public initialize(mainWindow: BrowserWindow): void {
    this.mainWindow = mainWindow
    this.createTray()
    this.setupWindowEvents()
  }

  /**
   * 创建托盘
   */
  private createTray(): void {
    // 创建托盘图标
    const icon = this.createTrayIcon()

    this.tray = new Tray(icon)
    this.tray.setToolTip('易小卷 - 试卷课件生成工具')

    // 设置右键菜单
    this.updateContextMenu()

    // 双击托盘图标显示窗口
    this.tray.on('double-click', () => {
      this.showWindow()
    })

    // 单击托盘图标（Windows）
    if (process.platform === 'win32') {
      this.tray.on('click', () => {
        this.showWindow()
      })
    }

    console.log('[Tray] System tray initialized')
  }

  /**
   * 创建托盘图标
   */
  private createTrayIcon(): NativeImage {
    // 尝试加载文件图标
    const iconPath = this.getIconPath()
    
    try {
      if (fs.existsSync(iconPath)) {
        let icon = nativeImage.createFromPath(iconPath)
        if (!icon.isEmpty()) {
          if (process.platform === 'win32') {
            icon = icon.resize({ width: 16, height: 16 })
          }
          return icon
        }
      }
    } catch (error) {
      console.warn('托盘图标加载失败:', error)
    }

    // 创建默认图标（16x16 绿色方块）
    return this.createDefaultIcon()
  }

  /**
   * 创建默认图标
   */
  private createDefaultIcon(): NativeImage {
    // 创建一个简单的 16x16 绿色图标
    const size = 16
    const canvas = Buffer.alloc(size * size * 4)
    
    // 填充绿色 (RGBA: 82, 196, 26, 255 - Ant Design 的绿色)
    for (let i = 0; i < size * size; i++) {
      const offset = i * 4
      canvas[offset] = 82     // R
      canvas[offset + 1] = 196 // G
      canvas[offset + 2] = 26  // B
      canvas[offset + 3] = 255 // A
    }
    
    return nativeImage.createFromBuffer(canvas, {
      width: size,
      height: size
    })
  }

  /**
   * 获取图标路径
   */
  private getIconPath(): string {
    // 优先使用应用资源目录中的图标
    const isDev = !app.isPackaged
    
    if (isDev) {
      // 开发环境使用public目录的图标
      return path.join(process.cwd(), 'public', 'icon.png')
    } else {
      // 生产环境使用resources目录
      return path.join(process.resourcesPath, 'icon.png')
    }
  }

  /**
   * 更新右键菜单
   */
  public updateContextMenu(): void {
    if (!this.tray) return

    const contextMenu = Menu.buildFromTemplate([
      {
        label: '显示主窗口',
        click: () => this.showWindow()
      },
      {
        type: 'separator'
      },
      {
        label: '新建课件',
        click: () => {
          this.showWindow()
          // 可以通过 webContents 发送消息到渲染进程
          this.mainWindow?.webContents.send('navigate', '/upload')
        }
      },
      {
        label: '我的课件',
        click: () => {
          this.showWindow()
          this.mainWindow?.webContents.send('navigate', '/')
        }
      },
      {
        type: 'separator'
      },
      {
        label: '设置',
        click: () => {
          this.showWindow()
          this.mainWindow?.webContents.send('navigate', '/settings')
        }
      },
      {
        type: 'separator'
      },
      {
        label: '退出',
        click: () => {
          this.isQuitting = true
          app.quit()
        }
      }
    ])

    this.tray.setContextMenu(contextMenu)
  }

  /**
   * 设置窗口事件
   */
  private setupWindowEvents(): void {
    if (!this.mainWindow) return

    // 阻止窗口关闭，改为最小化到托盘
    this.mainWindow.on('close', (event) => {
      if (!this.isQuitting) {
        event.preventDefault()
        this.hideWindow()
      }
    })

    // 最小化时隐藏到托盘
    this.mainWindow.on('minimize', () => {
      // 可选：最小化时隐藏到托盘
      // this.hideWindow()
    })
  }

  /**
   * 显示主窗口
   */
  public showWindow(): void {
    if (!this.mainWindow) return

    if (this.mainWindow.isMinimized()) {
      this.mainWindow.restore()
    }
    
    this.mainWindow.show()
    this.mainWindow.focus()
  }

  /**
   * 隐藏主窗口到托盘
   */
  public hideWindow(): void {
    if (!this.mainWindow) return
    this.mainWindow.hide()
  }

  /**
   * 设置是否正在退出
   */
  public setQuitting(value: boolean): void {
    this.isQuitting = value
  }

  /**
   * 获取是否正在退出
   */
  public isAppQuitting(): boolean {
    return this.isQuitting
  }

  /**
   * 销毁托盘
   */
  public destroy(): void {
    if (this.tray) {
      this.tray.destroy()
      this.tray = null
    }
    console.log('[Tray] System tray destroyed')
  }

  /**
   * 显示通知气泡（仅Windows）
   */
  public showNotification(title: string, content: string): void {
    if (!this.tray) return
    
    if (process.platform === 'win32') {
      this.tray.displayBalloon({
        title,
        content,
        iconType: 'info'
      })
    }
  }

  /**
   * 更新托盘图标
   */
  public updateIcon(iconPath?: string): void {
    if (!this.tray) return

    const path = iconPath || this.getIconPath()
    try {
      let icon = nativeImage.createFromPath(path)
      if (process.platform === 'win32') {
        icon = icon.resize({ width: 16, height: 16 })
      }
      this.tray.setImage(icon)
    } catch (error) {
      console.error('更新托盘图标失败:', error)
    }
  }

  /**
   * 设置托盘提示文字
   */
  public setTooltip(tooltip: string): void {
    if (!this.tray) return
    this.tray.setToolTip(tooltip)
  }
}

export const trayManager = TrayManager.getInstance()
