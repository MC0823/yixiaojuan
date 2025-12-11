/**
 * Electron IPC 服务层
 * 统一封装所有 IPC 调用，避免 UI 层直接访问 window.electronAPI
 * 
 * 使用方式：
 * import { electronService } from '@/services/electronService'
 * const result = await electronService.courseware.getById('xxx')
 */

import type {
  Courseware,
  CoursewareInput,
  Question,
  QuestionInput,
  ApiResponse,
  OcrOptions,
  OcrResult,
  OcrLanguage,
  ImageInfo,
  ImageProcessOptions,
  FileSaveOptions,
  FileSelectResult,
  FileSaveResult,
  SyncConfig,
  SyncDirection,
  SyncResult,
  SyncStatus,
  SyncRecord,
  PdfExportData,
  WordExportData,
  ScreenSource,
  ImageCorrectOptions,
  ImageCorrectResult,
  SplitResult,
  EraseHandwritingResult,
  SystemInfo,
  ActivationResult,
  ActivationStatus
} from '@/types/shared'

// ElectronAPI 类型定义（简化版，避免跨目录引用）
interface ElectronAPI {
  app: {
    getVersion: () => Promise<string>
    getPlatform: () => Promise<NodeJS.Platform>
    quit: () => Promise<void>
    relaunch: () => Promise<void>
  }
  window: {
    minimize: () => Promise<void>
    maximize: () => Promise<void>
    close: () => Promise<void>
    isMaximized: () => Promise<boolean>
  }
  activation: {
    verify: (code: string) => Promise<ActivationResult>
    check: () => Promise<ActivationStatus>
  }
  system: {
    getDeviceId: () => Promise<string>
    getInfo: () => Promise<SystemInfo>
  }
  file: {
    selectImages: () => Promise<FileSelectResult>
    selectDirectory: () => Promise<FileSelectResult>
    save: (options?: FileSaveOptions) => Promise<FileSaveResult>
    openPath: (path: string) => Promise<string>
  }
  courseware: {
    create: (data: Partial<Courseware>) => Promise<ApiResponse<Courseware>>
    getAll: (options?: { status?: string }) => Promise<ApiResponse<Courseware[]>>
    getById: (id: string) => Promise<ApiResponse<Courseware>>
    update: (id: string, data: Partial<Courseware>) => Promise<ApiResponse<Courseware>>
    delete: (id: string) => Promise<ApiResponse<boolean>>
    export: (id: string) => Promise<ApiResponse<{ filePath: string }>>
    import: () => Promise<ApiResponse<{ coursewareId: string; title: string }>>
    exportPdf: (data: PdfExportData) => Promise<ApiResponse<{ filePath: string }>>
    exportWord: (data: WordExportData) => Promise<ApiResponse<{ filePath: string }>>
  }
  question: {
    create: (data: Partial<Question>) => Promise<ApiResponse<Question>>
    createBatch: (coursewareId: string, questions: Partial<Question>[]) => Promise<ApiResponse<Question[]>>
    getByCourseware: (coursewareId: string) => Promise<ApiResponse<Question[]>>
    update: (id: string, data: Partial<Question>) => Promise<ApiResponse<Question>>
    delete: (id: string) => Promise<ApiResponse<boolean>>
    reorder: (coursewareId: string, questionIds: string[]) => Promise<ApiResponse<void>>
  }
  ocr: {
    recognize: (imagePath: string, options?: OcrOptions) => Promise<ApiResponse<OcrResult>>
    recognizeBatch: (imagePaths: string[], options?: OcrOptions) => Promise<ApiResponse<OcrResult[]>>
    getLanguages: () => Promise<ApiResponse<OcrLanguage[]>>
    terminate: () => Promise<ApiResponse<void>>
  }
  image: {
    getInfo: (imagePath: string, includeBase64?: boolean) => Promise<ApiResponse<ImageInfo>>
    process: (imagePath: string, options: ImageProcessOptions) => Promise<ApiResponse<string>>
    createThumbnail: (imagePath: string, width?: number, height?: number) => Promise<ApiResponse<string>>
    save: (data: string, coursewareId: string, filename?: string) => Promise<ApiResponse<string>>
    copyToCourseware: (sourcePaths: string[], coursewareId: string) => Promise<ApiResponse<string[]>>
    delete: (imagePath: string) => Promise<ApiResponse<boolean>>
  }
  sync: {
    getConfig: () => Promise<ApiResponse<SyncConfig>>
    saveConfig: (config: Partial<SyncConfig>) => Promise<ApiResponse<void>>
    execute: (direction?: SyncDirection) => Promise<ApiResponse<SyncResult>>
    getStatus: () => Promise<ApiResponse<SyncStatus>>
    getPending: () => Promise<ApiResponse<SyncRecord[]>>
    retryFailed: () => Promise<ApiResponse<SyncResult>>
    cleanLogs: (beforeDate?: string) => Promise<ApiResponse<number>>
  }
  paddleOcr: {
    health: () => Promise<{ success: boolean; healthy: boolean }>
    split: (imageBase64: string) => Promise<ApiResponse<SplitResult>>
    eraseHandwriting: (imageBase64: string, mode?: string) => Promise<ApiResponse<EraseHandwritingResult>>
    correctImage: (imageBase64: string, options?: ImageCorrectOptions) => Promise<ApiResponse<ImageCorrectResult>>
    startService: () => Promise<{ success: boolean; message?: string; error?: string }>
    stopService: () => Promise<{ success: boolean; message?: string; error?: string }>
  }
  screen: {
    getSources: () => Promise<ApiResponse<ScreenSource[]>>
  }
  video: {
    saveWebm: (buffer: ArrayBuffer, defaultFileName: string) => Promise<ApiResponse<{ filePath: string }>>
    saveMp4: (buffer: ArrayBuffer, defaultFileName: string) => Promise<ApiResponse<{ filePath: string }>>
  }
  audio: {
    save: (buffer: ArrayBuffer, defaultFileName: string) => Promise<ApiResponse<{ filePath: string }>>
  }
}

// 获取类型化的 electronAPI
const getApi = (): ElectronAPI => {
  return (window as unknown as { electronAPI: ElectronAPI }).electronAPI
}

/**
 * 确保 Electron API 可用
 */
function ensureAPI(): void {
  if (!getApi()) {
    throw new Error('Electron API 不可用，请在桌面应用中运行')
  }
}

/**
 * 应用服务
 */
export const appService = {
  getVersion: async (): Promise<string> => {
    ensureAPI()
    return getApi().app.getVersion()
  },
  getPlatform: async (): Promise<NodeJS.Platform> => {
    ensureAPI()
    return getApi().app.getPlatform()
  },
  quit: async (): Promise<void> => {
    ensureAPI()
    return getApi().app.quit()
  },
  relaunch: async (): Promise<void> => {
    ensureAPI()
    return getApi().app.relaunch()
  }
}

/**
 * 窗口服务
 */
export const windowService = {
  minimize: async (): Promise<void> => {
    ensureAPI()
    return getApi().window.minimize()
  },
  maximize: async (): Promise<void> => {
    ensureAPI()
    return getApi().window.maximize()
  },
  close: async (): Promise<void> => {
    ensureAPI()
    return getApi().window.close()
  },
  isMaximized: async (): Promise<boolean> => {
    ensureAPI()
    return getApi().window.isMaximized()
  }
}

/**
 * 激活服务
 */
export const activationService = {
  verify: async (code: string): Promise<ActivationResult> => {
    ensureAPI()
    return getApi().activation.verify(code)
  },
  check: async (): Promise<ActivationStatus> => {
    ensureAPI()
    return getApi().activation.check()
  }
}

/**
 * 系统服务
 */
export const systemService = {
  getDeviceId: async (): Promise<string> => {
    ensureAPI()
    return getApi().system.getDeviceId()
  },
  getInfo: async (): Promise<SystemInfo> => {
    ensureAPI()
    return getApi().system.getInfo()
  }
}

/**
 * 文件服务
 */
export const fileService = {
  selectImages: async (): Promise<FileSelectResult> => {
    ensureAPI()
    return getApi().file.selectImages()
  },
  selectDirectory: async (): Promise<FileSelectResult> => {
    ensureAPI()
    return getApi().file.selectDirectory()
  },
  save: async (options?: FileSaveOptions): Promise<FileSaveResult> => {
    ensureAPI()
    return getApi().file.save(options)
  },
  openPath: async (path: string): Promise<string> => {
    ensureAPI()
    return getApi().file.openPath(path)
  }
}

/**
 * 课件服务
 */
export const coursewareService = {
  create: async (data: CoursewareInput): Promise<ApiResponse<Courseware>> => {
    ensureAPI()
    return getApi().courseware.create(data)
  },
  getAll: async (options?: { status?: string }): Promise<ApiResponse<Courseware[]>> => {
    ensureAPI()
    return getApi().courseware.getAll(options)
  },
  getById: async (id: string): Promise<ApiResponse<Courseware>> => {
    ensureAPI()
    return getApi().courseware.getById(id)
  },
  update: async (id: string, data: CoursewareInput): Promise<ApiResponse<Courseware>> => {
    ensureAPI()
    return getApi().courseware.update(id, data)
  },
  delete: async (id: string): Promise<ApiResponse<boolean>> => {
    ensureAPI()
    return getApi().courseware.delete(id)
  },
  export: async (id: string): Promise<ApiResponse<{ filePath: string }>> => {
    ensureAPI()
    return getApi().courseware.export(id)
  },
  import: async (): Promise<ApiResponse<{ coursewareId: string; title: string }>> => {
    ensureAPI()
    return getApi().courseware.import()
  },
  exportPdf: async (data: PdfExportData): Promise<ApiResponse<{ filePath: string }>> => {
    ensureAPI()
    return getApi().courseware.exportPdf(data)
  },
  exportWord: async (data: WordExportData): Promise<ApiResponse<{ filePath: string }>> => {
    ensureAPI()
    return getApi().courseware.exportWord(data)
  }
}

/**
 * 题目服务
 */
export const questionService = {
  create: async (data: QuestionInput): Promise<ApiResponse<Question>> => {
    ensureAPI()
    return getApi().question.create(data)
  },
  createBatch: async (coursewareId: string, questions: QuestionInput[]): Promise<ApiResponse<Question[]>> => {
    ensureAPI()
    return getApi().question.createBatch(coursewareId, questions)
  },
  getByCourseware: async (coursewareId: string): Promise<ApiResponse<Question[]>> => {
    ensureAPI()
    return getApi().question.getByCourseware(coursewareId)
  },
  update: async (id: string, data: QuestionInput): Promise<ApiResponse<Question>> => {
    ensureAPI()
    return getApi().question.update(id, data)
  },
  delete: async (id: string): Promise<ApiResponse<boolean>> => {
    ensureAPI()
    return getApi().question.delete(id)
  },
  reorder: async (coursewareId: string, questionIds: string[]): Promise<ApiResponse<void>> => {
    ensureAPI()
    return getApi().question.reorder(coursewareId, questionIds)
  }
}

/**
 * OCR 服务 (Tesseract.js)
 */
export const ocrService = {
  recognize: async (imagePath: string, options?: OcrOptions): Promise<ApiResponse<OcrResult>> => {
    ensureAPI()
    return getApi().ocr.recognize(imagePath, options)
  },
  recognizeBatch: async (imagePaths: string[], options?: OcrOptions): Promise<ApiResponse<OcrResult[]>> => {
    ensureAPI()
    return getApi().ocr.recognizeBatch(imagePaths, options)
  },
  getLanguages: async (): Promise<ApiResponse<OcrLanguage[]>> => {
    ensureAPI()
    return getApi().ocr.getLanguages()
  },
  terminate: async (): Promise<ApiResponse<void>> => {
    ensureAPI()
    return getApi().ocr.terminate()
  }
}

/**
 * 图片处理服务
 */
export const imageService = {
  getInfo: async (imagePath: string, includeBase64?: boolean): Promise<ApiResponse<ImageInfo>> => {
    ensureAPI()
    return getApi().image.getInfo(imagePath, includeBase64)
  },
  process: async (imagePath: string, options: ImageProcessOptions): Promise<ApiResponse<string>> => {
    ensureAPI()
    return getApi().image.process(imagePath, options)
  },
  createThumbnail: async (imagePath: string, width?: number, height?: number): Promise<ApiResponse<string>> => {
    ensureAPI()
    return getApi().image.createThumbnail(imagePath, width, height)
  },
  save: async (data: string, coursewareId: string, filename?: string): Promise<ApiResponse<string>> => {
    ensureAPI()
    return getApi().image.save(data, coursewareId, filename)
  },
  copyToCourseware: async (sourcePaths: string[], coursewareId: string): Promise<ApiResponse<string[]>> => {
    ensureAPI()
    return getApi().image.copyToCourseware(sourcePaths, coursewareId)
  },
  delete: async (imagePath: string): Promise<ApiResponse<boolean>> => {
    ensureAPI()
    return getApi().image.delete(imagePath)
  }
}

/**
 * 同步服务
 */
export const syncService = {
  getConfig: async (): Promise<ApiResponse<SyncConfig>> => {
    ensureAPI()
    return getApi().sync.getConfig()
  },
  saveConfig: async (config: Partial<SyncConfig>): Promise<ApiResponse<void>> => {
    ensureAPI()
    return getApi().sync.saveConfig(config)
  },
  execute: async (direction?: SyncDirection): Promise<ApiResponse<SyncResult>> => {
    ensureAPI()
    return getApi().sync.execute(direction)
  },
  getStatus: async (): Promise<ApiResponse<SyncStatus>> => {
    ensureAPI()
    return getApi().sync.getStatus()
  },
  getPending: async (): Promise<ApiResponse<SyncRecord[]>> => {
    ensureAPI()
    return getApi().sync.getPending()
  },
  retryFailed: async (): Promise<ApiResponse<SyncResult>> => {
    ensureAPI()
    return getApi().sync.retryFailed()
  },
  cleanLogs: async (beforeDate?: string): Promise<ApiResponse<number>> => {
    ensureAPI()
    return getApi().sync.cleanLogs(beforeDate)
  }
}

/**
 * PaddleOCR 服务
 */
export const paddleOcrService = {
  health: async (): Promise<{ success: boolean; healthy: boolean }> => {
    ensureAPI()
    return getApi().paddleOcr.health()
  },
  split: async (imageBase64: string): Promise<ApiResponse<SplitResult>> => {
    ensureAPI()
    return getApi().paddleOcr.split(imageBase64)
  },
  eraseHandwriting: async (imageBase64: string, mode?: string): Promise<ApiResponse<EraseHandwritingResult>> => {
    ensureAPI()
    return getApi().paddleOcr.eraseHandwriting(imageBase64, mode)
  },
  correctImage: async (imageBase64: string, options?: ImageCorrectOptions): Promise<ApiResponse<ImageCorrectResult>> => {
    ensureAPI()
    return getApi().paddleOcr.correctImage(imageBase64, options)
  },
  startService: async (): Promise<{ success: boolean; message?: string; error?: string }> => {
    ensureAPI()
    return getApi().paddleOcr.startService()
  },
  stopService: async (): Promise<{ success: boolean; message?: string; error?: string }> => {
    ensureAPI()
    return getApi().paddleOcr.stopService()
  }
}

/**
 * 屏幕录制服务
 */
export const screenService = {
  getSources: async (): Promise<ApiResponse<ScreenSource[]>> => {
    ensureAPI()
    return getApi().screen.getSources()
  }
}

/**
 * 视频服务
 */
export const videoService = {
  saveWebm: async (buffer: ArrayBuffer, defaultFileName: string): Promise<ApiResponse<{ filePath: string }>> => {
    ensureAPI()
    return getApi().video.saveWebm(buffer, defaultFileName)
  },
  saveMp4: async (buffer: ArrayBuffer, defaultFileName: string): Promise<ApiResponse<{ filePath: string }>> => {
    ensureAPI()
    return getApi().video.saveMp4(buffer, defaultFileName)
  }
}

/**
 * 音频服务
 */
export const audioService = {
  save: async (buffer: ArrayBuffer, defaultFileName: string): Promise<ApiResponse<{ filePath: string }>> => {
    ensureAPI()
    return getApi().audio.save(buffer, defaultFileName)
  }
}

/**
 * 兼容旧版 ElectronService 类（建议使用上面的独立服务）
 * @deprecated 请使用 coursewareService, questionService 等独立服务
 */
class ElectronService {
  // 课件相关
  async getCoursewareById(id: string) {
    return coursewareService.getById(id)
  }

  async getQuestionsByCourseware(coursewareId: string) {
    return questionService.getByCourseware(coursewareId)
  }

  async createCourseware(data: CoursewareInput) {
    return coursewareService.create(data)
  }

  async updateCourseware(id: string, data: CoursewareInput) {
    return coursewareService.update(id, data)
  }

  async deleteCourseware(id: string) {
    return coursewareService.delete(id)
  }

  // 文件相关
  async selectImages() {
    return fileService.selectImages()
  }

  async createThumbnail(filePath: string, width: number, height: number) {
    return imageService.createThumbnail(filePath, width, height)
  }

  // 屏幕相关
  async getSources() {
    return screenService.getSources()
  }
}

export const electronService = new ElectronService()
