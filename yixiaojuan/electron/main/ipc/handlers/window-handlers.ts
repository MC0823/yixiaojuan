/**
 * 窗口相关 IPC 处理器
 */
import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../../shared/ipc-channels'
import { windowManager } from '../../window/WindowManager'

/**
 * 注册窗口相关处理器
 */
export function registerWindowHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.WINDOW_MINIMIZE, () => {
    windowManager.minimizeMainWindow()
  })

  ipcMain.handle(IPC_CHANNELS.WINDOW_MAXIMIZE, () => {
    windowManager.toggleMaximize()
  })

  ipcMain.handle(IPC_CHANNELS.WINDOW_CLOSE, () => {
    const mainWindow = windowManager.getMainWindow()
    mainWindow?.close()
  })

  ipcMain.handle(IPC_CHANNELS.WINDOW_IS_MAXIMIZED, () => {
    const mainWindow = windowManager.getMainWindow()
    return mainWindow?.isMaximized() ?? false
  })
}
