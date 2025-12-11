/**
 * 同步相关 IPC 处理器
 */
import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../../shared/ipc-channels'
import { syncService, type SyncDirection } from '../../services'

/**
 * 初始化同步服务
 */
export function initSyncService(): void {
  syncService.initialize()
}

/**
 * 注册同步相关处理器
 */
export function registerSyncHandlers(): void {
  // 获取同步配置
  ipcMain.handle(IPC_CHANNELS.SYNC_GET_CONFIG, () => {
    return { success: true, data: syncService.getConfig() }
  })

  // 保存同步配置
  ipcMain.handle(IPC_CHANNELS.SYNC_SAVE_CONFIG, (_event, config: Partial<{
    serverUrl: string
    apiKey: string
    autoSync: boolean
    syncInterval: number
  }>) => {
    try {
      syncService.saveConfig(config)
      return { success: true }
    } catch (error) {
      console.error('[Sync] 保存配置失败:', error)
      return { success: false, error: String(error) }
    }
  })

  // 执行同步
  ipcMain.handle(IPC_CHANNELS.SYNC_EXECUTE, async (_event, direction?: SyncDirection) => {
    try {
      const result = await syncService.sync(direction || 'both')
      console.log('[Sync] 同步完成:', result)
      return { success: true, data: result }
    } catch (error) {
      console.error('[Sync] 同步失败:', error)
      return { success: false, error: String(error) }
    }
  })

  // 获取同步状态
  ipcMain.handle(IPC_CHANNELS.SYNC_GET_STATUS, () => {
    return { success: true, data: syncService.getStatus() }
  })

  // 获取待同步记录
  ipcMain.handle(IPC_CHANNELS.SYNC_GET_PENDING, () => {
    return { success: true, data: syncService.getPendingSyncRecords() }
  })

  // 重试失败的同步
  ipcMain.handle(IPC_CHANNELS.SYNC_RETRY_FAILED, async () => {
    try {
      const result = await syncService.retryFailed()
      return { success: true, data: result }
    } catch (error) {
      console.error('[Sync] 重试失败:', error)
      return { success: false, error: String(error) }
    }
  })

  // 清理已同步的日志
  ipcMain.handle(IPC_CHANNELS.SYNC_CLEAN_LOGS, (_event, beforeDate?: string) => {
    try {
      const cleaned = syncService.cleanSyncedLogs(beforeDate)
      return { success: true, data: cleaned }
    } catch (error) {
      console.error('[Sync] 清理日志失败:', error)
      return { success: false, error: String(error) }
    }
  })
}
