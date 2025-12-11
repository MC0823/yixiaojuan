/**
 * 文件相关 IPC 处理器
 */
import { ipcMain, dialog, shell } from 'electron'
import { IPC_CHANNELS } from '../../../shared/ipc-channels'
import { windowManager } from '../../window/WindowManager'
import { InputValidator } from '../../utils/validator'
import type { FileSaveOptions, ImageProcessOptions } from '../../../shared/types'
import type { fileService as FileServiceType } from '../../services'

// 延迟加载的文件服务
let fileService: typeof FileServiceType

/**
 * 初始化文件服务
 */
export async function initFileService(): Promise<void> {
  const services = await import('../../services')
  fileService = services.fileService
  fileService.initialize()
}

/**
 * 注册文件相关处理器
 */
export function registerFileHandlers(): void {
  // 选择图片文件
  ipcMain.handle(IPC_CHANNELS.FILE_SELECT_IMAGES, async () => {
    const mainWindow = windowManager.getMainWindow()
    if (!mainWindow) return { canceled: true, filePaths: [] }

    return dialog.showOpenDialog(mainWindow, {
      title: '选择图片',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: '图片文件', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'] }
      ]
    })
  })

  // 选择目录
  ipcMain.handle(IPC_CHANNELS.FILE_SELECT_DIR, async () => {
    const mainWindow = windowManager.getMainWindow()
    if (!mainWindow) return { canceled: true, filePaths: [] }

    return dialog.showOpenDialog(mainWindow, {
      title: '选择文件夹',
      properties: ['openDirectory', 'createDirectory']
    })
  })

  // 保存文件对话框
  ipcMain.handle(IPC_CHANNELS.FILE_SAVE, async (_event, options: FileSaveOptions) => {
    const mainWindow = windowManager.getMainWindow()
    if (!mainWindow) return { canceled: true, filePath: undefined }

    return dialog.showSaveDialog(mainWindow, {
      title: options?.title || '保存文件',
      defaultPath: options?.defaultPath,
      filters: options?.filters || [
        { name: '所有文件', extensions: ['*'] }
      ]
    })
  })

  // 在系统文件管理器中打开路径
  ipcMain.handle(IPC_CHANNELS.FILE_OPEN_PATH, async (_event, path: string) => {
    return shell.openPath(path)
  })
}

/**
 * 注册图片处理相关处理器
 */
export function registerImageHandlers(): void {
  // 获取图片信息
  ipcMain.handle(IPC_CHANNELS.IMAGE_GET_INFO, async (
    _event,
    imagePath: string,
    includeBase64?: boolean
  ) => {
    if (!InputValidator.isValidPath(imagePath)) {
      return { success: false, error: '无效的文件路径' }
    }
    try {
      const info = await fileService.getImageInfo(imagePath, includeBase64)
      return { success: true, data: info }
    } catch (error) {
      console.error('[Image] 获取信息失败:', error)
      return { success: false, error: String(error) }
    }
  })

  // 处理图片
  ipcMain.handle(IPC_CHANNELS.IMAGE_PROCESS, async (
    _event,
    imagePath: string,
    options: ImageProcessOptions
  ) => {
    if (!InputValidator.isValidPath(imagePath)) {
      return { success: false, error: '无效的文件路径' }
    }
    try {
      const buffer = await fileService.processImage(imagePath, options)
      const base64 = buffer.toString('base64')
      return { success: true, data: `data:image/${options.format || 'png'};base64,${base64}` }
    } catch (error) {
      console.error('[Image] 处理失败:', error)
      return { success: false, error: String(error) }
    }
  })

  // 创建缩略图
  ipcMain.handle(IPC_CHANNELS.IMAGE_CREATE_THUMBNAIL, async (
    _event,
    imagePath: string,
    width?: number,
    height?: number
  ) => {
    if (!InputValidator.isValidPath(imagePath)) {
      return { success: false, error: '无效的文件路径' }
    }
    try {
      const buffer = await fileService.createThumbnail(imagePath, width, height)
      const base64 = buffer.toString('base64')
      return { success: true, data: `data:image/jpeg;base64,${base64}` }
    } catch (error) {
      console.error('[Image] 创建缩略图失败:', error)
      return { success: false, error: String(error) }
    }
  })

  // 保存图片
  ipcMain.handle(IPC_CHANNELS.IMAGE_SAVE, async (
    _event,
    data: string,
    coursewareId: string,
    filename?: string
  ) => {
    if (!InputValidator.isValidUUID(coursewareId)) {
      return { success: false, error: '无效的课件ID' }
    }
    try {
      const filePath = await fileService.saveImage(data, coursewareId, { filename })
      return { success: true, data: filePath }
    } catch (error) {
      console.error('[Image] 保存失败:', error)
      return { success: false, error: String(error) }
    }
  })

  // 复制图片到课件目录
  ipcMain.handle(IPC_CHANNELS.IMAGE_COPY_TO_COURSEWARE, async (
    _event,
    sourcePaths: string[],
    coursewareId: string
  ) => {
    if (!InputValidator.isValidUUID(coursewareId)) {
      return { success: false, error: '无效的课件ID' }
    }
    if (!Array.isArray(sourcePaths) || sourcePaths.some(p => !InputValidator.isValidPath(p))) {
      return { success: false, error: '无效的文件路径' }
    }
    try {
      const destPaths = await fileService.copyImagesToCourseware(sourcePaths, coursewareId)
      return { success: true, data: destPaths }
    } catch (error) {
      console.error('[Image] 复制失败:', error)
      return { success: false, error: String(error) }
    }
  })

  // 删除图片
  ipcMain.handle(IPC_CHANNELS.IMAGE_DELETE, async (_event, imagePath: string) => {
    if (!InputValidator.isValidPath(imagePath)) {
      return { success: false, error: '无效的文件路径' }
    }
    try {
      const deleted = fileService.deleteImage(imagePath)
      return { success: true, data: deleted }
    } catch (error) {
      console.error('[Image] 删除失败:', error)
      return { success: false, error: String(error) }
    }
  })
}
