/**
 * OCR 相关 IPC 处理器
 */
import { ipcMain, app } from 'electron'
import { spawn, ChildProcess } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import { IPC_CHANNELS } from '../../../shared/ipc-channels'
import { ocrService, type OcrOptions } from '../../services'
import type { ImageCorrectOptions } from '../../../shared/types'

// PaddleOCR 服务 URL
const OCR_SERVER_URL = 'http://localhost:8089'

/**
 * OCR进程管理类
 */
class OcrProcessManager {
  private process: ChildProcess | null = null
  private isStarting = false
  private readonly serverUrl = OCR_SERVER_URL

  async checkHealth(): Promise<boolean> {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 2000)
      try {
        const response = await fetch(`${this.serverUrl}/health`, {
          method: 'GET',
          signal: controller.signal
        })
        clearTimeout(timeout)
        return response.ok
      } catch (fetchError) {
        clearTimeout(timeout)
        throw fetchError
      }
    } catch {
      return false
    }
  }

  async start(): Promise<{ success: boolean; message?: string; error?: string }> {
    if (this.isStarting) {
      return { success: false, error: '服务正在启动中' }
    }

    // 先检查服务是否已运行
    if (await this.checkHealth()) {
      return { success: true, message: '服务已在运行' }
    }

    this.isStarting = true
    
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
        this.isStarting = false
        return { success: false, error: `找不到 OCR 服务: ${mainPyPath}` }
      }

      console.log('[PaddleOCR] 启动服务:', mainPyPath)

      // 启动 Python 服务
      this.process = spawn('python', ['main.py'], {
        cwd: ocrServerPath,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
        detached: false
      })

      this.process.stdout?.on('data', (data) => {
        console.log('[PaddleOCR]', data.toString())
      })

      this.process.stderr?.on('data', (data) => {
        console.error('[PaddleOCR Error]', data.toString())
      })

      this.process.on('close', (code) => {
        console.log('[PaddleOCR] 服务已关闭，退出码:', code)
        this.process = null
      })

      // 等待服务启动（最多等待 60 秒）
      const maxWait = 60000
      const checkInterval = 1000
      let waited = 0

      while (waited < maxWait) {
        await new Promise(resolve => setTimeout(resolve, checkInterval))
        waited += checkInterval

        if (await this.checkHealth()) {
          this.isStarting = false
          console.log('[PaddleOCR] 服务启动成功')
          return { success: true, message: '服务启动成功' }
        }
      }

      this.isStarting = false
      return { success: false, error: '服务启动超时' }
    } catch (error) {
      this.isStarting = false
      console.error('[PaddleOCR] 启动失败:', error)
      return { success: false, error: String(error) }
    }
  }

  stop(): { success: boolean; message?: string; error?: string } {
    if (this.process) {
      try {
        this.process.kill()
        this.process = null
        return { success: true }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    }
    return { success: true, message: '服务未运行' }
  }

  cleanup(): void {
    if (this.process) {
      this.process.kill()
      this.process = null
    }
  }
}

// 单例管理器
const ocrManager = new OcrProcessManager()

/**
 * 注册 OCR 相关处理器 (Tesseract.js)
 */
export function registerOcrHandlers(): void {
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
 * 注册 PaddleOCR 相关处理器
 */
export function registerPaddleOcrHandlers(): void {
  // 启动 OCR 服务
  ipcMain.handle(IPC_CHANNELS.PADDLE_OCR_START_SERVICE, async () => {
    return await ocrManager.start()
  })

  // 停止 OCR 服务
  ipcMain.handle(IPC_CHANNELS.PADDLE_OCR_STOP_SERVICE, async () => {
    return ocrManager.stop()
  })

  // 应用退出时关闭服务
  app.on('before-quit', () => {
    ocrManager.cleanup()
  })

  // 健康检查
  ipcMain.handle(IPC_CHANNELS.PADDLE_OCR_HEALTH, async () => {
    try {
      const healthy = await ocrManager.checkHealth()
      return { success: true, healthy }
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
  ipcMain.handle(IPC_CHANNELS.PADDLE_OCR_CORRECT_IMAGE, async (_event, imageBase64: string, options: ImageCorrectOptions = {}) => {
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
          auto_crop: options.auto_crop ?? true,
          enhance: options.enhance ?? true
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
