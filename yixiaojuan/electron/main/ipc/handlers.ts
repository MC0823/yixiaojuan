/**
 * IPC 处理器注册
 * 统一管理主进程与渲染进程之间的通信
 */
import { ipcMain, app, dialog, shell, BrowserWindow, desktopCapturer } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { spawn, ChildProcess } from 'child_process'
import { windowManager } from '../window/WindowManager'
import { databaseService, coursewareRepository, questionRepository, type Courseware, type Question } from '../database'
import { ocrService, syncService, type OcrOptions, type ImageProcessOptions, type SyncDirection } from '../services'
import type { fileService as FileServiceType } from '../services'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import { InputValidator } from '../utils/validator'
import * as crypto from 'crypto'
import * as os from 'os'
import {
  Document,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  HeadingLevel,
  BorderStyle,
  Packer
} from 'docx'

let fileService: typeof FileServiceType

/**
 * 注册所有 IPC 处理器
 */
export async function registerIPCHandlers(): Promise<void> {
  // 动态导入services以避免过早访问app API
  const services = await import('../services')
  fileService = services.fileService
  fileService.initialize()
  services.syncService.initialize()

  registerAppHandlers()
  registerWindowHandlers()
  registerFileHandlers()
  registerSystemHandlers()
  registerActivationHandlers()
  registerCoursewareHandlers()
  registerQuestionHandlers()
  registerOcrHandlers()
  registerImageHandlers()
  registerSyncHandlers()
  registerPaddleOcrHandlers()
  registerExportImportHandlers()
  registerScreenHandlers()

  console.log('[IPC] All handlers registered')
}

/**
 * 应用相关处理器
 */
function registerAppHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.APP_GET_VERSION, () => {
    return app.getVersion()
  })

  ipcMain.handle(IPC_CHANNELS.APP_GET_PLATFORM, () => {
    return process.platform
  })

  ipcMain.handle(IPC_CHANNELS.APP_QUIT, () => {
    app.quit()
  })

  ipcMain.handle(IPC_CHANNELS.APP_RELAUNCH, () => {
    app.relaunch()
    app.quit()
  })
}

/**
 * 窗口相关处理器
 */
function registerWindowHandlers(): void {
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

/**
 * 文件相关处理器
 */
function registerFileHandlers(): void {
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
  ipcMain.handle(IPC_CHANNELS.FILE_SAVE, async (_event, options: {
    title?: string
    defaultPath?: string
    filters?: { name: string; extensions: string[] }[]
  }) => {
    const mainWindow = windowManager.getMainWindow()
    if (!mainWindow) return { canceled: true, filePath: undefined }

    return dialog.showSaveDialog(mainWindow, {
      title: options.title || '保存文件',
      defaultPath: options.defaultPath,
      filters: options.filters || [
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
 * 系统相关处理器
 */
function registerSystemHandlers(): void {
  // 获取设备唯一标识
  ipcMain.handle(IPC_CHANNELS.SYSTEM_GET_DEVICE_ID, () => {
    const machineInfo = [
      os.hostname(),
      os.platform(),
      os.arch(),
      os.cpus()[0]?.model || 'unknown'
    ].join('-')
    
    return crypto.createHash('sha256').update(machineInfo).digest('hex').substring(0, 32)
  })

  // 获取系统信息
  ipcMain.handle(IPC_CHANNELS.SYSTEM_GET_INFO, () => {
    return {
      platform: os.platform(),
      arch: os.arch(),
      hostname: os.hostname(),
      cpus: os.cpus().length,
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      homeDir: os.homedir(),
      tempDir: os.tmpdir()
    }
  })
}

/**
 * 激活相关处理器（预留接口）
 */
function registerActivationHandlers(): void {
  // 验证激活码
  ipcMain.handle(IPC_CHANNELS.ACTIVATION_VERIFY, async (_event, code: string) => {
    // TODO: 实现激活码验证逻辑
    console.log('[Activation] 验证激活码:', code)
    
    // 临时返回成功，后续接入真实API
    return {
      success: true,
      message: '激活成功（测试模式）',
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
    }
  })

  // 检查激活状态
  ipcMain.handle(IPC_CHANNELS.ACTIVATION_CHECK, async () => {
    // TODO: 从本地存储读取激活状态
    return {
      isActivated: false,
      expiresAt: null
    }
  })
}

/**
 * 课件相关处理器
 */
function registerCoursewareHandlers(): void {
  // 创建课件
  ipcMain.handle(IPC_CHANNELS.COURSEWARE_CREATE, async (_event, data: Partial<Courseware>) => {
    try {
      const courseware = coursewareRepository.create(data)
      console.log('[Courseware] 创建成功:', courseware.id)
      return { success: true, data: courseware }
    } catch (error) {
      console.error('[Courseware] 创建失败:', error)
      return { success: false, error: String(error) }
    }
  })

  // 获取所有课件
  ipcMain.handle(IPC_CHANNELS.COURSEWARE_GET_ALL, async (_event, options?: { status?: string }) => {
    try {
      const list = coursewareRepository.findAll(options)
      return { success: true, data: list }
    } catch (error) {
      console.error('[Courseware] 获取列表失败:', error)
      return { success: false, error: String(error) }
    }
  })

  // 根据ID获取课件
  ipcMain.handle(IPC_CHANNELS.COURSEWARE_GET_BY_ID, async (_event, id: string) => {
    if (!InputValidator.isValidUUID(id)) {
      return { success: false, error: '无效的课件ID' }
    }
    try {
      const courseware = coursewareRepository.findById(id)
      if (!courseware) {
        return { success: false, error: '课件不存在' }
      }
      return { success: true, data: courseware }
    } catch (error) {
      console.error('[Courseware] 获取失败:', error)
      return { success: false, error: String(error) }
    }
  })

  // 更新课件
  ipcMain.handle(IPC_CHANNELS.COURSEWARE_UPDATE, async (_event, id: string, data: Partial<Courseware>) => {
    if (!InputValidator.isValidUUID(id)) {
      return { success: false, error: '无效的课件ID' }
    }
    try {
      const courseware = coursewareRepository.update(id, data)
      if (!courseware) {
        return { success: false, error: '课件不存在' }
      }
      console.log('[Courseware] 更新成功:', id)
      return { success: true, data: courseware }
    } catch (error) {
      console.error('[Courseware] 更新失败:', error)
      return { success: false, error: String(error) }
    }
  })

  // 删除课件
  ipcMain.handle(IPC_CHANNELS.COURSEWARE_DELETE, async (_event, id: string) => {
    if (!InputValidator.isValidUUID(id)) {
      return { success: false, error: '无效的课件ID' }
    }
    try {
      // 先删除关联的题目
      questionRepository.deleteByCoursewareId(id)
      // 再删除课件
      const deleted = coursewareRepository.delete(id)
      console.log('[Courseware] 删除成功:', id)
      return { success: true, data: deleted }
    } catch (error) {
      console.error('[Courseware] 删除失败:', error)
      return { success: false, error: String(error) }
    }
  })
}

/**
 * 题目相关处理器
 */
function registerQuestionHandlers(): void {
  // 创建单个题目
  ipcMain.handle(IPC_CHANNELS.QUESTION_CREATE, async (_event, data: Partial<Question>) => {
    try {
      const question = questionRepository.create(data)
      console.log('[Question] Created:', question.id)
      return { success: true, data: question }
    } catch (error) {
      console.error('[Question] Create failed:', error)
      return { success: false, error: String(error) }
    }
  })

  // 批量创建题目
  ipcMain.handle(IPC_CHANNELS.QUESTION_CREATE_BATCH, async (
    _event, 
    coursewareId: string, 
    questions: Partial<Question>[]
  ) => {
    try {
      const created = questionRepository.createBatch(coursewareId, questions)
      console.log('[Question] Batch created:', created.length)
      return { success: true, data: created }
    } catch (error) {
      console.error('[Question] Batch create failed:', error)
      return { success: false, error: String(error) }
    }
  })

  // 获取课件下的所有题目
  ipcMain.handle(IPC_CHANNELS.QUESTION_GET_BY_COURSEWARE, async (_event, coursewareId: string) => {
    if (!InputValidator.isValidUUID(coursewareId)) {
      return { success: false, error: '无效的课件ID' }
    }
    try {
      const list = questionRepository.findByCoursewareId(coursewareId)
      return { success: true, data: list }
    } catch (error) {
      console.error('[Question] Get list failed:', error)
      return { success: false, error: String(error) }
    }
  })

  // 更新题目
  ipcMain.handle(IPC_CHANNELS.QUESTION_UPDATE, async (_event, id: string, data: Partial<Question>) => {
    if (!InputValidator.isValidUUID(id)) {
      return { success: false, error: '无效的题目ID' }
    }
    try {
      const question = questionRepository.update(id, data)
      if (!question) {
        return { success: false, error: '题目不存在' }
      }
      console.log('[Question] Updated:', id)
      return { success: true, data: question }
    } catch (error) {
      console.error('[Question] Update failed:', error)
      return { success: false, error: String(error) }
    }
  })

  // 删除题目
  ipcMain.handle(IPC_CHANNELS.QUESTION_DELETE, async (_event, id: string) => {
    if (!InputValidator.isValidUUID(id)) {
      return { success: false, error: '无效的题目ID' }
    }
    try {
      const deleted = questionRepository.delete(id)
      console.log('[Question] Deleted:', id)
      return { success: true, data: deleted }
    } catch (error) {
      console.error('[Question] Delete failed:', error)
      return { success: false, error: String(error) }
    }
  })

  // 重排序题目
  ipcMain.handle(IPC_CHANNELS.QUESTION_REORDER, async (
    _event, 
    coursewareId: string, 
    questionIds: string[]
  ) => {
    try {
      questionRepository.reorder(coursewareId, questionIds)
      console.log('[Question] Reordered')
      return { success: true }
    } catch (error) {
      console.error('[Question] Reorder failed:', error)
      return { success: false, error: String(error) }
    }
  })
}

/**
 * OCR 相关处理器
 */
function registerOcrHandlers(): void {
  // 识别单张图片
  ipcMain.handle(IPC_CHANNELS.OCR_RECOGNIZE, async (
    _event,
    imagePath: string,
    options?: OcrOptions
  ) => {
    try {
      const result = await ocrService.recognize(imagePath, options)
      return { success: true, data: result }
    } catch (error) {
      console.error('[OCR] 识别失败:', error)
      return { success: false, error: String(error) }
    }
  })

  // 批量识别图片
  ipcMain.handle(IPC_CHANNELS.OCR_RECOGNIZE_BATCH, async (
    _event,
    imagePaths: string[],
    options?: OcrOptions
  ) => {
    try {
      const results = await ocrService.recognizeBatch(imagePaths, options)
      return { success: true, data: results }
    } catch (error) {
      console.error('[OCR] 批量识别失败:', error)
      return { success: false, error: String(error) }
    }
  })

  // 获取支持的语言列表
  ipcMain.handle(IPC_CHANNELS.OCR_GET_LANGUAGES, () => {
    return { success: true, data: ocrService.getSupportedLanguages() }
  })

  // 终止 OCR Worker
  ipcMain.handle(IPC_CHANNELS.OCR_TERMINATE, async () => {
    try {
      await ocrService.terminate()
      return { success: true }
    } catch (error) {
      console.error('[OCR] 终止失败:', error)
      return { success: false, error: String(error) }
    }
  })
}

/**
 * 图片处理相关处理器
 */
function registerImageHandlers(): void {
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

/**
 * 同步相关处理器
 */
function registerSyncHandlers(): void {
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

/**
 * PaddleOCR 服务代理处理器
 */
function registerPaddleOcrHandlers(): void {
  const OCR_SERVER_URL = 'http://localhost:8089'
  let ocrServerProcess: ChildProcess | null = null
  let isStarting = false

  // 启动 OCR 服务
  ipcMain.handle(IPC_CHANNELS.PADDLE_OCR_START_SERVICE, async () => {
    if (isStarting) {
      return { success: false, error: '服务正在启动中' }
    }

    // 先检查服务是否已运行
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 2000)
      const response = await fetch(`${OCR_SERVER_URL}/health`, {
        method: 'GET',
        signal: controller.signal
      })
      clearTimeout(timeout)
      if (response.ok) {
        return { success: true, message: '服务已在运行' }
      }
    } catch {
      // 服务未运行，继续启动
    }

    isStarting = true
    
    try {
      // 查找 ocr_server 目录
      const appPath = app.getAppPath()
      let ocrServerPath = path.join(appPath, '..', '..', 'ocr_server')
      
      // 开发环境
      if (!fs.existsSync(ocrServerPath)) {
        ocrServerPath = path.join(appPath, '..', 'ocr_server')
      }
      if (!fs.existsSync(ocrServerPath)) {
        ocrServerPath = path.join(process.cwd(), '..', 'ocr_server')
      }
      if (!fs.existsSync(ocrServerPath)) {
        ocrServerPath = path.join(process.cwd(), 'ocr_server')
      }
      
      const mainPyPath = path.join(ocrServerPath, 'main.py')
      if (!fs.existsSync(mainPyPath)) {
        isStarting = false
        return { success: false, error: `找不到 OCR 服务: ${mainPyPath}` }
      }

      console.log('[PaddleOCR] 启动服务:', mainPyPath)

      // 启动 Python 服务
      ocrServerProcess = spawn('python', ['main.py'], {
        cwd: ocrServerPath,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
        detached: false
      })

      ocrServerProcess.stdout?.on('data', (data) => {
        console.log('[PaddleOCR]', data.toString())
      })

      ocrServerProcess.stderr?.on('data', (data) => {
        console.error('[PaddleOCR Error]', data.toString())
      })

      ocrServerProcess.on('close', (code) => {
        console.log('[PaddleOCR] 服务已关闭，退出码:', code)
        ocrServerProcess = null
      })

      // 等待服务启动（最多等待 60 秒）
      const maxWait = 60000
      const checkInterval = 1000
      let waited = 0

      while (waited < maxWait) {
        await new Promise(resolve => setTimeout(resolve, checkInterval))
        waited += checkInterval

        try {
          const controller = new AbortController()
          const timeout = setTimeout(() => controller.abort(), 2000)
          const response = await fetch(`${OCR_SERVER_URL}/health`, {
            method: 'GET',
            signal: controller.signal
          })
          clearTimeout(timeout)
          
          if (response.ok) {
            isStarting = false
            console.log('[PaddleOCR] 服务启动成功')
            return { success: true, message: '服务启动成功' }
          }
        } catch {
          // 继续等待
        }
      }

      isStarting = false
      return { success: false, error: '服务启动超时' }
    } catch (error) {
      isStarting = false
      console.error('[PaddleOCR] 启动失败:', error)
      return { success: false, error: String(error) }
    }
  })

  // 停止 OCR 服务
  ipcMain.handle(IPC_CHANNELS.PADDLE_OCR_STOP_SERVICE, async () => {
    if (ocrServerProcess) {
      try {
        ocrServerProcess.kill()
        ocrServerProcess = null
        return { success: true }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    }
    return { success: true, message: '服务未运行' }
  })

  // 应用退出时关闭服务
  app.on('before-quit', () => {
    if (ocrServerProcess) {
      ocrServerProcess.kill()
      ocrServerProcess = null
    }
  })

  // 健康检查
  ipcMain.handle(IPC_CHANNELS.PADDLE_OCR_HEALTH, async () => {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)
      
      const response = await fetch(`${OCR_SERVER_URL}/health`, {
        method: 'GET',
        signal: controller.signal
      })
      clearTimeout(timeout)
      
      return { success: true, healthy: response.ok }
    } catch {
      return { success: true, healthy: false }
    }
  })

  // 题目切分
  ipcMain.handle(IPC_CHANNELS.PADDLE_OCR_SPLIT, async (_event, imageBase64: string) => {
    try {
      const response = await fetch(`${OCR_SERVER_URL}/split`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageBase64 })
      })
      if (!response.ok) {
        throw new Error(`OCR 服务错误: ${response.status}`)
      }
      const result = await response.json()
      return { success: true, data: result }
    } catch (error) {
      console.error('[PaddleOCR] 切题失败:', error)
      return { success: false, error: String(error) }
    }
  })

  // 笔迹擦除
  ipcMain.handle(IPC_CHANNELS.PADDLE_OCR_ERASE_HANDWRITING, async (_event, imageBase64: string, mode: string = 'auto') => {
    try {
      const response = await fetch(`${OCR_SERVER_URL}/erase-handwriting`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageBase64, mode })
      })
      if (!response.ok) {
        throw new Error(`笔迹擦除服务错误: ${response.status}`)
      }
      const result = await response.json()
      return { success: true, data: result }
    } catch (error) {
      console.error('[PaddleOCR] 笔迹擦除失败:', error)
      return { success: false, error: String(error) }
    }
  })

  // 图片自动矫正
  ipcMain.handle(IPC_CHANNELS.PADDLE_OCR_CORRECT_IMAGE, async (_event, imageBase64: string, options: {
    auto_perspective?: boolean
    auto_rotate?: boolean
    auto_crop?: boolean
  } = {}) => {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 60000) // 60秒超时
      
      const response = await fetch(`${OCR_SERVER_URL}/correct-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          image: imageBase64,
          auto_perspective: options.auto_perspective ?? true,
          auto_rotate: options.auto_rotate ?? true,
          auto_crop: options.auto_crop ?? true
        }),
        signal: controller.signal
      })
      clearTimeout(timeout)
      
      if (!response.ok) {
        throw new Error(`图片矫正服务错误: ${response.status}`)
      }
      const result = await response.json()
      return { success: true, data: result }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.error('[PaddleOCR] 图片矫正超时')
        return { success: false, error: '图片矫正超时，请尝试压缩图片后重试' }
      }
      console.error('[PaddleOCR] 图片矫正失败:', error)
      return { success: false, error: String(error) }
    }
  })
}

/**
 * 课件导入导出处理器
 */
function registerExportImportHandlers(): void {
  // 导出课件
  ipcMain.handle(IPC_CHANNELS.COURSEWARE_EXPORT, async (_event, coursewareId: string) => {
    const mainWindow = windowManager.getMainWindow()
    if (!mainWindow) return { success: false, error: '窗口不可用' }
    
    try {
      // 获取课件信息
      const courseware = coursewareRepository.findById(coursewareId)
      if (!courseware) {
        return { success: false, error: '课件不存在' }
      }
      
      // 获取课件下的所有题目
      const questions = questionRepository.findByCoursewareId(coursewareId)
      
      // 选择保存路径
      const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
        title: '导出课件',
        defaultPath: `${courseware.title}.yxj`,
        filters: [{ name: '易小卷课件', extensions: ['yxj'] }]
      })
      
      if (canceled || !filePath) {
        return { success: false, error: '用户取消' }
      }
      
      // 构建导出数据
      const exportData = {
        version: '1.0',
        exportTime: new Date().toISOString(),
        courseware: {
          title: courseware.title,
          description: courseware.description,
          status: courseware.status,
          settings: courseware.settings
        },
        questions: questions.map(q => ({
          order_index: q.order_index,
          type: q.type,
          ocr_text: q.ocr_text,
          options: q.options,
          answer: q.answer,
          annotations: q.annotations,
          // 图片转换为base64
          original_image_base64: q.original_image ? readImageAsBase64(q.original_image) : null
        }))
      }
      
      // 写入文件
      fs.writeFileSync(filePath, JSON.stringify(exportData, null, 2), 'utf-8')
      
      console.log('[Export] 课件导出成功:', filePath)
      return { success: true, data: { filePath } }
    } catch (error) {
      console.error('[Export] 导出失败:', error)
      return { success: false, error: String(error) }
    }
  })
  
  // 导入课件
  ipcMain.handle(IPC_CHANNELS.COURSEWARE_IMPORT, async () => {
    const mainWindow = windowManager.getMainWindow()
    if (!mainWindow) return { success: false, error: '窗口不可用' }
    
    try {
      // 选择文件
      const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
        title: '导入课件',
        filters: [{ name: '易小卷课件', extensions: ['yxj'] }],
        properties: ['openFile']
      })
      
      if (canceled || filePaths.length === 0) {
        return { success: false, error: '用户取消' }
      }
      
      const filePath = filePaths[0]
      const content = fs.readFileSync(filePath, 'utf-8')
      const importData = JSON.parse(content)
      
      // 验证数据格式
      if (!importData.version || !importData.courseware) {
        return { success: false, error: '无效的课件文件格式' }
      }
      
      // 创建新课件
      const newCourseware = coursewareRepository.create({
        title: importData.courseware.title + '（导入）',
        description: importData.courseware.description,
        status: 'draft',
        settings: importData.courseware.settings
      })
      
      // 导入题目
      if (importData.questions && importData.questions.length > 0) {
        const questionsToCreate = []
        
        for (const q of importData.questions) {
          let imagePath: string | undefined = undefined
          
          // 如果有图片base64，保存到本地
          if (q.original_image_base64) {
            imagePath = await fileService.saveImage(
              q.original_image_base64, 
              newCourseware.id,
              { filename: `question_${q.order_index}.png` }
            )
          }
          
          questionsToCreate.push({
            order_index: q.order_index,
            type: q.type,
            ocr_text: q.ocr_text,
            options: q.options,
            answer: q.answer,
            annotations: q.annotations,
            original_image: imagePath
          })
        }
        
        questionRepository.createBatch(newCourseware.id, questionsToCreate)
      }
      
      console.log('[Import] Courseware imported:', newCourseware.id)
      return { success: true, data: { coursewareId: newCourseware.id, title: newCourseware.title } }
    } catch (error) {
      console.error('[Import] Import failed:', error)
      return { success: false, error: String(error) }
    }
  })
  
  // 导出PDF
  ipcMain.handle(IPC_CHANNELS.COURSEWARE_EXPORT_PDF, async (_event, pdfData: {
    title: string
    questions: Array<{
      index: number
      text: string
      options: Array<{ label: string; content: string }>
      answer: string
      whiteboard: string | null
    }>
  }) => {
    const mainWindow = windowManager.getMainWindow()
    if (!mainWindow) return { success: false, error: 'Window not available' }
    
    try {
      // 选择保存路径
      const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
        title: '导出PDF',
        defaultPath: `${pdfData.title}.pdf`,
        filters: [{ name: 'PDF文件', extensions: ['pdf'] }]
      })
      
      if (canceled || !filePath) {
        return { success: false, error: '用户取消' }
      }
      
      // 生成HTML内容
      const htmlContent = generatePdfHtml(pdfData)
      
      // 创建隐藏窗口用于渲染PDF
      const pdfWindow = new BrowserWindow({
        width: 800,
        height: 600,
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      })
      
      // 加载HTML内容
      await pdfWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`)
      
      // 等待渲染完成
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // 生成PDF
      const pdfBuffer = await pdfWindow.webContents.printToPDF({
        pageSize: 'A4',
        printBackground: true,
        margins: {
          top: 0.5,
          bottom: 0.5,
          left: 0.5,
          right: 0.5
        }
      })
      
      // 关闭窗口
      pdfWindow.close()
      
      // 保存PDF文件
      fs.writeFileSync(filePath, pdfBuffer)
      
      console.log('[PDF] Export success:', filePath)
      return { success: true, data: { filePath } }
    } catch (error) {
      console.error('[PDF] Export failed:', error)
      return { success: false, error: String(error) }
    }
  })
  
  // 导出Word
  ipcMain.handle(IPC_CHANNELS.COURSEWARE_EXPORT_WORD, async (_event, wordData: {
    title: string
    questions: Array<{
      index: number
      text: string
      options: Array<{ label: string; content: string }>
      answer: string
      imageBase64: string | null
    }>
  }) => {
    const mainWindow = windowManager.getMainWindow()
    if (!mainWindow) return { success: false, error: '窗口不可用' }
    
    try {
      // 选择保存路径
      const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
        title: '导出Word文档',
        defaultPath: `${wordData.title}.docx`,
        filters: [{ name: 'Word文档', extensions: ['docx'] }]
      })
      
      if (canceled || !filePath) {
        return { success: false, error: '用户取消' }
      }
      
      // 生成Word文档
      const doc = generateWordDocument(wordData)
      
      // 导出为buffer并保存
      const buffer = await Packer.toBuffer(doc)
      fs.writeFileSync(filePath, buffer)
      
      console.log('[Word] Export success:', filePath)
      return { success: true, data: { filePath } }
    } catch (error) {
      console.error('[Word] Export failed:', error)
      return { success: false, error: String(error) }
    }
  })
}

/**
 * 读取图片为base64
 */
function readImageAsBase64(imagePath: string): string | null {
  try {
    if (!fs.existsSync(imagePath)) return null
    const buffer = fs.readFileSync(imagePath)
    const ext = path.extname(imagePath).toLowerCase().slice(1)
    const mimeType = ext === 'jpg' ? 'jpeg' : ext
    return `data:image/${mimeType};base64,${buffer.toString('base64')}`
  } catch {
    return null
  }
}

/**
 * 生成PDF的HTML内容
 * 支持两种模式：
 * 1. 截图模式：当 whiteboard 是图片 dataUrl 时，每道题的截图作为一页
 * 2. 文字模式：当 whiteboard 不是图片时，使用文字格式
 */
function generatePdfHtml(pdfData: {
  title: string
  questions: Array<{
    index: number
    text: string
    options: Array<{ label: string; content: string }>
    answer: string
    whiteboard: string | null
  }>
}): string {
  // 检测是否是截图模式（whiteboard 是图片 dataUrl）
  const isScreenshotMode = pdfData.questions.length > 0 && 
    pdfData.questions[0].whiteboard?.startsWith('data:image/')
  
  if (isScreenshotMode) {
    // 截图模式：每道题的截图作为一页
    const pagesHtml = pdfData.questions.map((q, idx) => `
      <div class="page" ${idx > 0 ? 'style="page-break-before: always;"' : ''}>
        <div class="page-header">第 ${q.index} 题</div>
        <img src="${q.whiteboard}" class="screenshot" />
      </div>
    `).join('')
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${pdfData.title}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          @page {
            size: A4 landscape;
            margin: 10mm;
          }
          body {
            font-family: 'Microsoft YaHei', 'SimHei', sans-serif;
          }
          .page {
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
          }
          .page-header {
            font-size: 16px;
            font-weight: bold;
            color: #2ec4b6;
            margin-bottom: 10px;
            text-align: center;
          }
          .screenshot {
            max-width: 100%;
            max-height: calc(100vh - 40px);
            object-fit: contain;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
          }
        </style>
      </head>
      <body>
        ${pagesHtml}
      </body>
      </html>
    `
  }
  
  // 文字模式：使用原有的文字格式
  const questionsHtml = pdfData.questions.map(q => {
    const optionsHtml = q.options.map(opt => `
      <div class="option ${q.answer?.includes(opt.label) ? 'correct' : ''}">
        <span class="label">${opt.label}.</span>
        <span class="content">${opt.content}</span>
        ${q.answer?.includes(opt.label) ? '<span class="check">✓</span>' : ''}
      </div>
    `).join('')
    
    const whiteboardHtml = q.whiteboard ? `
      <div class="whiteboard">
        <div class="whiteboard-title">板书批注</div>
        <div class="whiteboard-note">（白板数据已保存）</div>
      </div>
    ` : ''
    
    return `
      <div class="question">
        <div class="question-header">题目 ${q.index}</div>
        <div class="question-text">${q.text}</div>
        <div class="options">${optionsHtml}</div>
        <div class="answer">
          <strong>正确答案:</strong> ${q.answer || '未设置'}
        </div>
        ${whiteboardHtml}
      </div>
    `
  }).join('')
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${pdfData.title}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Microsoft YaHei', 'SimHei', sans-serif;
          font-size: 14px;
          line-height: 1.6;
          padding: 20px;
          color: #333;
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
          padding-bottom: 20px;
          border-bottom: 2px solid #2ec4b6;
        }
        .header h1 {
          font-size: 24px;
          color: #2ec4b6;
        }
        .question {
          margin-bottom: 30px;
          padding: 20px;
          background: #f8f9fa;
          border-radius: 8px;
          page-break-inside: avoid;
        }
        .question-header {
          font-size: 16px;
          font-weight: bold;
          color: #2ec4b6;
          margin-bottom: 12px;
        }
        .question-text {
          font-size: 15px;
          margin-bottom: 16px;
          white-space: pre-wrap;
        }
        .options {
          margin-bottom: 16px;
        }
        .option {
          padding: 10px 15px;
          margin: 8px 0;
          background: white;
          border-radius: 6px;
          border: 1px solid #e0e0e0;
          display: flex;
          align-items: center;
        }
        .option.correct {
          background: #e8f5e9;
          border-color: #4caf50;
        }
        .option .label {
          font-weight: bold;
          margin-right: 10px;
          color: #666;
        }
        .option .content {
          flex: 1;
        }
        .option .check {
          color: #4caf50;
          font-weight: bold;
          margin-left: 10px;
        }
        .answer {
          padding: 12px 15px;
          background: #e3f2fd;
          border-radius: 6px;
          color: #1976d2;
        }
        .whiteboard {
          margin-top: 16px;
          padding: 12px;
          background: #fff3e0;
          border-radius: 6px;
        }
        .whiteboard-title {
          font-weight: bold;
          color: #e65100;
        }
        .whiteboard-note {
          font-size: 12px;
          color: #999;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${pdfData.title}</h1>
        <p>共 ${pdfData.questions.length} 道题目</p>
      </div>
      ${questionsHtml}
    </body>
    </html>
  `
}

/**
 * 生成Word文档
 */
function generateWordDocument(wordData: {
  title: string
  questions: Array<{
    index: number
    text: string
    options: Array<{ label: string; content: string }>
    answer: string
    imageBase64: string | null
  }>
}): Document {
  const children: (Paragraph | Table)[] = []
  
  // 标题
  children.push(
    new Paragraph({
      text: wordData.title,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 }
    })
  )
  
  // 副标题
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `共 ${wordData.questions.length} 道题目`,
          size: 24,
          color: '666666'
        })
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 600 }
    })
  )
  
  // 遍历题目
  for (const q of wordData.questions) {
    // 题号
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `题目 ${q.index}`,
            bold: true,
            size: 28,
            color: '2EC4B6'
          })
        ],
        spacing: { before: 400, after: 200 }
      })
    )
    
    // 题目内容
    if (q.text) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: q.text,
              size: 24
            })
          ],
          spacing: { after: 200 }
        })
      )
    }
    
    // 选项表格
    if (q.options && q.options.length > 0) {
      const optionRows = q.options.map(opt => {
        const isCorrect = q.answer?.includes(opt.label)
        return new TableRow({
          children: [
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `${opt.label}.`,
                      bold: true,
                      size: 22,
                      color: isCorrect ? '4CAF50' : '333333'
                    })
                  ]
                })
              ],
              width: { size: 10, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 1, color: 'E0E0E0' },
                bottom: { style: BorderStyle.SINGLE, size: 1, color: 'E0E0E0' },
                left: { style: BorderStyle.SINGLE, size: 1, color: 'E0E0E0' },
                right: { style: BorderStyle.SINGLE, size: 1, color: 'E0E0E0' }
              }
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: opt.content,
                      size: 22,
                      color: isCorrect ? '4CAF50' : '333333'
                    }),
                    ...(isCorrect ? [
                      new TextRun({
                        text: ' ✓',
                        bold: true,
                        size: 22,
                        color: '4CAF50'
                      })
                    ] : [])
                  ]
                })
              ],
              width: { size: 90, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 1, color: 'E0E0E0' },
                bottom: { style: BorderStyle.SINGLE, size: 1, color: 'E0E0E0' },
                left: { style: BorderStyle.SINGLE, size: 1, color: 'E0E0E0' },
                right: { style: BorderStyle.SINGLE, size: 1, color: 'E0E0E0' }
              }
            })
          ]
        })
      })
      
      children.push(
        new Table({
          rows: optionRows,
          width: { size: 100, type: WidthType.PERCENTAGE }
        })
      )
    }
    
    // 正确答案
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: '正确答案: ',
            bold: true,
            size: 22,
            color: '1976D2'
          }),
          new TextRun({
            text: q.answer || '未设置',
            size: 22,
            color: '1976D2'
          })
        ],
        spacing: { before: 200, after: 300 },
        shading: { fill: 'E3F2FD' }
      })
    )
    
    // 分隔线
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: '\u2500'.repeat(60),
            color: 'CCCCCC',
            size: 16
          })
        ],
        spacing: { after: 200 }
      })
    )
  }
  
  return new Document({
    sections: [{
      properties: {},
      children
    }]
  })
}

/**
 * 屏幕录制相关处理器
 */
function registerScreenHandlers(): void {
  // 获取可用的屏幕源
  ipcMain.handle(IPC_CHANNELS.SCREEN_GET_SOURCES, async () => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['window', 'screen'],
        thumbnailSize: { width: 150, height: 150 }
      })
      
      // 将窗口类型排在前面，并标记类型
      const mappedSources = sources.map(source => ({
        id: source.id,
        name: source.name,
        thumbnail: source.thumbnail.toDataURL(),
        type: source.id.startsWith('window') ? 'window' : 'screen'
      }))
      
      // 窗口排在前面
      mappedSources.sort((a, b) => {
        if (a.type === 'window' && b.type !== 'window') return -1
        if (a.type !== 'window' && b.type === 'window') return 1
        return 0
      })
      
      console.log('[Screen] 获取到的源:', mappedSources.map(s => ({ name: s.name, type: s.type })))
      
      return {
        success: true,
        data: mappedSources
      }
    } catch (error) {
      console.error('[Screen] 获取屏幕源失败:', error)
      return {
        success: false,
        error: '获取屏幕源失败'
      }
    }
  })

  // 保存视频文件（WebM 格式）
  ipcMain.handle(IPC_CHANNELS.VIDEO_SAVE_WEBM, async (_event, options: {
    buffer: ArrayBuffer
    defaultFileName: string
  }) => {
    const mainWindow = windowManager.getMainWindow()
    if (!mainWindow) return { success: false, error: '窗口不可用' }

    try {
      const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
        title: '保存视频',
        defaultPath: options.defaultFileName,
        filters: [{ name: 'WebM视频', extensions: ['webm'] }]
      })

      if (canceled || !filePath) {
        return { success: false, error: '用户取消' }
      }

      // 将 ArrayBuffer 转换为 Buffer 并保存
      const buffer = Buffer.from(options.buffer)
      fs.writeFileSync(filePath, buffer)

      console.log('[Video] 视频保存成功:', filePath)
      return { success: true, data: { filePath } }
    } catch (error) {
      console.error('[Video] 视频保存失败:', error)
      return { success: false, error: String(error) }
    }
  })

  // 保存视频文件（MP4 格式 - 先保存为 webm，提示用户转换）
  ipcMain.handle(IPC_CHANNELS.VIDEO_SAVE_MP4, async (_event, options: {
    buffer: ArrayBuffer
    defaultFileName: string
  }) => {
    const mainWindow = windowManager.getMainWindow()
    if (!mainWindow) return { success: false, error: '窗口不可用' }

    try {
      const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
        title: '保存视频',
        defaultPath: options.defaultFileName.replace('.webm', '.mp4'),
        filters: [{ name: 'MP4视频', extensions: ['mp4'] }]
      })

      if (canceled || !filePath) {
        return { success: false, error: '用户取消' }
      }

      // 将 ArrayBuffer 转换为 Buffer 并保存
      // 注意：这里保存的实际上是 webm 编码的内容，但扩展名为 mp4
      // 大多数播放器可以正常播放
      const buffer = Buffer.from(options.buffer)
      fs.writeFileSync(filePath, buffer)

      console.log('[Video] MP4视频保存成功:', filePath)
      return { success: true, data: { filePath } }
    } catch (error) {
      console.error('[Video] MP4视频保存失败:', error)
      return { success: false, error: String(error) }
    }
  })

  // 保存音频文件 (MP3 格式)
  ipcMain.handle(IPC_CHANNELS.AUDIO_SAVE, async (_event, options: {
    buffer: ArrayBuffer
    defaultFileName: string
  }) => {
    const mainWindow = windowManager.getMainWindow()
    if (!mainWindow) return { success: false, error: '窗口不可用' }

    try {
      const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
        title: '保存音频',
        defaultPath: options.defaultFileName,
        filters: [{ name: 'MP3音频', extensions: ['mp3'] }]
      })

      if (canceled || !filePath) {
        return { success: false, error: '用户取消' }
      }

      const buffer = Buffer.from(options.buffer)
      fs.writeFileSync(filePath, buffer)

      console.log('[Audio] 音频保存成功:', filePath)
      return { success: true, data: { filePath } }
    } catch (error) {
      console.error('[Audio] 音频保存失败:', error)
      return { success: false, error: String(error) }
    }
  })
}
