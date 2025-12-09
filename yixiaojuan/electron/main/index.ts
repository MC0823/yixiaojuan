/**
 * Electron 主进程入口
 * 负责应用生命周期管理和模块初始化
 */
import { app, BrowserWindow } from 'electron'
import { windowManager } from './window/WindowManager'
import { registerIPCHandlers } from './ipc/handlers'
import { databaseService } from './database'
import { trayManager } from './tray'
import { syncService } from './services'

// 禁用硬件加速（某些低配机器可能需要）
// app.disableHardwareAcceleration()

/**
 * 初始化应用
 */
async function initializeApp(): Promise<void> {
  // 单实例锁定
  const gotTheLock = app.requestSingleInstanceLock()
  if (!gotTheLock) {
    app.quit()
    return
  }
  try {
    // 初始化数据库
    try {
      await databaseService.initialize()
      console.log('[App] Database initialized')
    } catch (dbError) {
      console.warn('[App] Database init failed, using offline mode:', dbError)
      // 继续运行，不中止应用
    }

    // 注册 IPC 处理器(会初始化文件服务)
    await registerIPCHandlers()
    
    // 创建主窗口
    const mainWindow = windowManager.createMainWindow()

    // 初始化系统托盘
    if (mainWindow) {
      trayManager.initialize(mainWindow)
      console.log('[App] System tray initialized')
    }

    console.log('[App] Application initialized')
  } catch (error) {
    console.error('[App] Initialization failed:', error)
    app.quit()
  }
}

// 应用就绪时初始化
app.whenReady().then(async () => {
  await initializeApp()

  // macOS 特殊处理：点击 dock 图标时重新创建窗口
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      windowManager.createMainWindow()
    }
  })
})

// 所有窗口关闭时的处理
app.on('window-all-closed', () => {
  // 注意：有托盘时，关闭窗口不退出应用
  // 只有通过托盘菜单退出才真正退出
  if (trayManager.isAppQuitting()) {
    // 关闭数据库连接
    databaseService.close()
    // 销毁托盘
    trayManager.destroy()
  }
})

// 应用退出前的清理
app.on('before-quit', () => {
  trayManager.setQuitting(true)
  // 清理同步定时器
  syncService.clearAutoSync()
})

// 第二个实例启动时，聚焦到主窗口
app.on('second-instance', () => {
  windowManager.showMainWindow()
})

module.exports = { windowManager }
