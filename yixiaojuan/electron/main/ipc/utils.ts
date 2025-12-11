/**
 * IPC 工具函数
 * 提供错误处理、日志等通用功能
 */
import { ipcMain, IpcMainInvokeEvent } from 'electron'
import type { ApiResponse } from '../../shared/types'

/**
 * 日志分类
 */
type LogCategory = 
  | 'App' | 'Window' | 'File' | 'System' | 'Activation'
  | 'Courseware' | 'Question' | 'OCR' | 'Image'
  | 'Sync' | 'PaddleOCR' | 'Export' | 'Screen' | 'Video' | 'Audio'

/**
 * 创建带错误处理的 IPC handler
 * @param channel IPC 通道名称
 * @param category 日志分类
 * @param handler 实际的处理函数
 */
export function createHandler<T, Args extends unknown[]>(
  channel: string,
  category: LogCategory,
  handler: (event: IpcMainInvokeEvent, ...args: Args) => Promise<T> | T
): void {
  ipcMain.handle(channel, async (event, ...args: unknown[]) => {
    try {
      const result = await handler(event, ...(args as Args))
      return result
    } catch (error) {
      console.error(`[${category}] Error in ${channel}:`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  })
}

/**
 * 创建带错误处理的 IPC handler，返回 ApiResponse 格式
 */
export function createApiHandler<T, Args extends unknown[]>(
  channel: string,
  category: LogCategory,
  handler: (event: IpcMainInvokeEvent, ...args: Args) => Promise<T> | T
): void {
  ipcMain.handle(channel, async (event, ...args: unknown[]) => {
    try {
      const data = await handler(event, ...(args as Args))
      return { success: true, data } as ApiResponse<T>
    } catch (error) {
      console.error(`[${category}] Error in ${channel}:`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      } as ApiResponse<T>
    }
  })
}

/**
 * 包装现有handler，添加错误处理
 */
export function wrapHandler<T>(
  category: LogCategory,
  operation: string,
  fn: () => Promise<T> | T
): Promise<ApiResponse<T>> {
  return Promise.resolve()
    .then(fn)
    .then(data => ({ success: true, data } as ApiResponse<T>))
    .catch(error => {
      console.error(`[${category}] ${operation} failed:`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      } as ApiResponse<T>
    })
}

/**
 * 创建成功响应
 */
export function success<T>(data: T): ApiResponse<T> {
  return { success: true, data }
}

/**
 * 创建失败响应
 */
export function fail(error: string): ApiResponse<never> {
  return { success: false, error }
}

/**
 * 日志工具
 */
export const logger = {
  info: (category: LogCategory, message: string, ...args: unknown[]) => {
    console.log(`[${category}] ${message}`, ...args)
  },
  error: (category: LogCategory, message: string, ...args: unknown[]) => {
    console.error(`[${category}] ${message}`, ...args)
  },
  warn: (category: LogCategory, message: string, ...args: unknown[]) => {
    console.warn(`[${category}] ${message}`, ...args)
  }
}
