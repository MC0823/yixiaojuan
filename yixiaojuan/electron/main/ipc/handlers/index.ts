/**
 * IPC Handlers 统一入口
 * 管理所有 IPC 处理器的注册
 */
import { registerAppHandlers, registerSystemHandlers, registerActivationHandlers } from './app-handlers'
import { registerWindowHandlers } from './window-handlers'
import { registerFileHandlers, registerImageHandlers, initFileService } from './file-handlers'
import { registerCoursewareHandlers } from './courseware-handlers'
import { registerQuestionHandlers } from './question-handlers'
import { registerOcrHandlers, registerPaddleOcrHandlers } from './ocr-handlers'
import { registerSyncHandlers, initSyncService } from './sync-handlers'
import { registerExportImportHandlers, registerScreenHandlers, initExportFileService } from './export-handlers'

/**
 * 注册所有 IPC 处理器
 */
export async function registerIPCHandlers(): Promise<void> {
  // 初始化服务
  await initFileService()
  await initExportFileService()
  initSyncService()

  // 注册处理器
  registerAppHandlers()
  registerSystemHandlers()
  registerActivationHandlers()
  registerWindowHandlers()
  registerFileHandlers()
  registerImageHandlers()
  registerCoursewareHandlers()
  registerQuestionHandlers()
  registerOcrHandlers()
  registerPaddleOcrHandlers()
  registerSyncHandlers()
  registerExportImportHandlers()
  registerScreenHandlers()

  console.log('[IPC] All handlers registered')
}

// 导出所有处理器注册函数，方便按需使用
export {
  registerAppHandlers,
  registerSystemHandlers,
  registerActivationHandlers,
  registerWindowHandlers,
  registerFileHandlers,
  registerImageHandlers,
  registerCoursewareHandlers,
  registerQuestionHandlers,
  registerOcrHandlers,
  registerPaddleOcrHandlers,
  registerSyncHandlers,
  registerExportImportHandlers,
  registerScreenHandlers
}

// 导出工具函数
export * from '../utils'
