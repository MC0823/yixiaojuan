/**
 * Electron 预加载脚本
 * 通过 contextBridge 安全地暴露 API 给渲染进程
 */
import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../shared/ipc-channels'

/**
 * 系统信息类型
 */
export interface SystemInfo {
  platform: NodeJS.Platform
  arch: string
  hostname: string
  cpus: number
  totalMemory: number
  freeMemory: number
  homeDir: string
  tempDir: string
}

/**
 * 激活验证结果类型
 */
export interface ActivationResult {
  success: boolean
  message: string
  expiresAt?: string
}

/**
 * 激活状态类型
 */
export interface ActivationStatus {
  isActivated: boolean
  expiresAt: string | null
}

/**
 * 课件实体类型
 */
export interface Courseware {
  id: string
  title: string
  description?: string
  thumbnail?: string
  created_at: string
  updated_at: string
  status: 'draft' | 'completed' | 'archived'
  settings?: string
}

/**
 * 题目实体类型
 */
export interface Question {
  id: string
  courseware_id: string
  order_index: number
  type?: string
  original_image?: string
  processed_image?: string
  ocr_text?: string
  options?: string
  answer?: string
  annotations?: string
  created_at: string
  updated_at: string
}

/**
 * API响应类型
 */
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

/**
 * OCR 识别结果类型
 */
export interface OcrResult {
  text: string
  confidence: number
  words: OcrWord[]
  lines: OcrLine[]
}

export interface OcrWord {
  text: string
  confidence: number
  bbox: { x0: number; y0: number; x1: number; y1: number }
}

export interface OcrLine {
  text: string
  confidence: number
  words: OcrWord[]
  bbox: { x0: number; y0: number; x1: number; y1: number }
}

export interface OcrOptions {
  language?: string
}

export interface OcrLanguage {
  code: string
  name: string
}

/**
 * 图片信息类型
 */
export interface ImageInfo {
  path: string
  name: string
  size: number
  width: number
  height: number
  format: string
  base64?: string
}

/**
 * 图片处理选项
 */
export interface ImageProcessOptions {
  width?: number
  height?: number
  quality?: number
  format?: 'jpeg' | 'png' | 'webp'
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside'
}

/**
 * 文件保存选项类型
 */
export interface FileSaveOptions {
  title?: string
  defaultPath?: string
  filters?: Array<{ name: string; extensions: string[] }>
}

/**
 * 同步配置类型
 */
export interface SyncConfig {
  serverUrl: string
  apiKey?: string
  autoSync: boolean
  syncInterval: number
}

/**
 * 同步结果类型
 */
export interface SyncResult {
  success: boolean
  uploaded: number
  downloaded: number
  conflicts: number
  errors: string[]
  lastSyncTime: string
}

/**
 * 同步记录类型
 */
export interface SyncRecord {
  id: string
  entity_type: 'courseware' | 'question'
  entity_id: string
  action: 'create' | 'update' | 'delete'
  sync_status: 'pending' | 'synced' | 'failed'
  local_updated_at: string
  remote_updated_at?: string
  error_message?: string
  created_at: string
}

/**
 * 同步状态类型
 */
export interface SyncStatus {
  isSyncing: boolean
  stats: {
    pending: number
    synced: number
    failed: number
  }
}

/**
 * 同步方向类型
 */
export type SyncDirection = 'upload' | 'download' | 'both'

/**
 * PDF导出数据类型
 */
export interface PdfExportData {
  title: string
  questions: Array<{
    index: number
    text: string
    options: Array<{ label: string; content: string }>
    answer: string
    whiteboard: string | null
  }>
}

/**
 * Word导出数据类型
 */
export interface WordExportData {
  title: string
  questions: Array<{
    index: number
    text: string
    options: Array<{ label: string; content: string }>
    answer: string
    imageBase64: string | null
  }>
}

/**
 * 暴露给渲染进程的 API 类型定义
 */
export interface ElectronAPI {
  // 应用信息
  app: {
    getVersion: () => Promise<string>
    getPlatform: () => Promise<NodeJS.Platform>
    quit: () => Promise<void>
    relaunch: () => Promise<void>
  }
  // 窗口控制
  window: {
    minimize: () => Promise<void>
    maximize: () => Promise<void>
    close: () => Promise<void>
    isMaximized: () => Promise<boolean>
  }
  // 激活相关
  activation: {
    verify: (code: string) => Promise<ActivationResult>
    check: () => Promise<ActivationStatus>
  }
  // 数据库相关
  database: {
    query: <T>(sql: string, params?: unknown[]) => Promise<T[]>
    execute: (sql: string, params?: unknown[]) => Promise<{ changes: number }>
  }
  // 文件相关
  file: {
    selectImages: () => Promise<{ canceled: boolean; filePaths: string[] }>
    selectDirectory: () => Promise<{ canceled: boolean; filePaths: string[] }>
    save: (options?: FileSaveOptions) => Promise<{ canceled: boolean; filePath?: string }>
    openPath: (path: string) => Promise<string>
  }
  // 系统相关
  system: {
    getDeviceId: () => Promise<string>
    getInfo: () => Promise<SystemInfo>
  }
  // 课件相关
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
  // 题目相关
  question: {
    create: (data: Partial<Question>) => Promise<ApiResponse<Question>>
    createBatch: (coursewareId: string, questions: Partial<Question>[]) => Promise<ApiResponse<Question[]>>
    getByCourseware: (coursewareId: string) => Promise<ApiResponse<Question[]>>
    update: (id: string, data: Partial<Question>) => Promise<ApiResponse<Question>>
    delete: (id: string) => Promise<ApiResponse<boolean>>
    reorder: (coursewareId: string, questionIds: string[]) => Promise<ApiResponse<void>>
  }
  // OCR 相关
  ocr: {
    recognize: (imagePath: string, options?: OcrOptions) => Promise<ApiResponse<OcrResult>>
    recognizeBatch: (imagePaths: string[], options?: OcrOptions) => Promise<ApiResponse<OcrResult[]>>
    getLanguages: () => Promise<ApiResponse<OcrLanguage[]>>
    terminate: () => Promise<ApiResponse<void>>
  }
  // 图片处理相关
  image: {
    getInfo: (imagePath: string, includeBase64?: boolean) => Promise<ApiResponse<ImageInfo>>
    process: (imagePath: string, options: ImageProcessOptions) => Promise<ApiResponse<string>>
    createThumbnail: (imagePath: string, width?: number, height?: number) => Promise<ApiResponse<string>>
    save: (data: string, coursewareId: string, filename?: string) => Promise<ApiResponse<string>>
    copyToCourseware: (sourcePaths: string[], coursewareId: string) => Promise<ApiResponse<string[]>>
    delete: (imagePath: string) => Promise<ApiResponse<boolean>>
  }
  // 同步相关
  sync: {
    getConfig: () => Promise<ApiResponse<SyncConfig>>
    saveConfig: (config: Partial<SyncConfig>) => Promise<ApiResponse<void>>
    execute: (direction?: SyncDirection) => Promise<ApiResponse<SyncResult>>
    getStatus: () => Promise<ApiResponse<SyncStatus>>
    getPending: () => Promise<ApiResponse<SyncRecord[]>>
    retryFailed: () => Promise<ApiResponse<SyncResult>>
    cleanLogs: (beforeDate?: string) => Promise<ApiResponse<number>>
  }
  // PaddleOCR
  paddleOcr: {
    health: () => Promise<{ success: boolean; healthy: boolean }>
    split: (imageBase64: string) => Promise<ApiResponse<{ questions: Array<{ 
      index: number
      base64: string
      ocrText: string
      stem?: string
      options?: Array<{ label: string; content: string }>
    }> }>>
    eraseHandwriting: (imageBase64: string, mode?: string) => Promise<ApiResponse<{
      image: string
      mode: string
    }>>
    correctImage: (imageBase64: string, options?: {
      auto_perspective?: boolean
      auto_rotate?: boolean
      auto_crop?: boolean
    }) => Promise<ApiResponse<{
      image: string
      corrected: boolean
      details: {
        perspective_applied: boolean
        rotation_angle: number
        cropped: boolean
      }
    }>>
    startService: () => Promise<{ success: boolean; message?: string; error?: string }>
    stopService: () => Promise<{ success: boolean; message?: string; error?: string }>
  }
  // 屏幕录制相关
  screen: {
    getSources: () => Promise<ApiResponse<Array<{
      id: string
      name: string
      thumbnail: string
      type: 'window' | 'screen'
    }>>>
  }
  // 视频/音频保存相关
  video: {
    saveWebm: (buffer: ArrayBuffer, defaultFileName: string) => Promise<ApiResponse<{ filePath: string }>>
    saveMp4: (buffer: ArrayBuffer, defaultFileName: string) => Promise<ApiResponse<{ filePath: string }>>
  }
  audio: {
    save: (buffer: ArrayBuffer, defaultFileName: string) => Promise<ApiResponse<{ filePath: string }>>
  }
}

// 通过 contextBridge 暴露安全的 API
contextBridge.exposeInMainWorld('electronAPI', {
  // 应用信息
  app: {
    getVersion: () => ipcRenderer.invoke(IPC_CHANNELS.APP_GET_VERSION),
    getPlatform: () => ipcRenderer.invoke(IPC_CHANNELS.APP_GET_PLATFORM),
    quit: () => ipcRenderer.invoke(IPC_CHANNELS.APP_QUIT),
    relaunch: () => ipcRenderer.invoke(IPC_CHANNELS.APP_RELAUNCH)
  },
  // 窗口控制
  window: {
    minimize: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_MINIMIZE),
    maximize: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_MAXIMIZE),
    close: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_CLOSE),
    isMaximized: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_IS_MAXIMIZED)
  },
  // 激活相关
  activation: {
    verify: (code: string) => ipcRenderer.invoke(IPC_CHANNELS.ACTIVATION_VERIFY, code),
    check: () => ipcRenderer.invoke(IPC_CHANNELS.ACTIVATION_CHECK)
  },
  // 数据库相关
  database: {
    query: <T>(sql: string, params?: unknown[]) => 
      ipcRenderer.invoke(IPC_CHANNELS.DATABASE_QUERY, sql, params) as Promise<T[]>,
    execute: (sql: string, params?: unknown[]) => 
      ipcRenderer.invoke(IPC_CHANNELS.DATABASE_EXECUTE, sql, params)
  },
  // 文件相关
  file: {
    selectImages: () => ipcRenderer.invoke(IPC_CHANNELS.FILE_SELECT_IMAGES),
    selectDirectory: () => ipcRenderer.invoke(IPC_CHANNELS.FILE_SELECT_DIR),
    save: (options?: FileSaveOptions) => ipcRenderer.invoke(IPC_CHANNELS.FILE_SAVE, options),
    openPath: (path: string) => ipcRenderer.invoke(IPC_CHANNELS.FILE_OPEN_PATH, path)
  },
  // 系统相关
  system: {
    getDeviceId: () => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_GET_DEVICE_ID),
    getInfo: () => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_GET_INFO)
  },
  // 课件相关
  courseware: {
    create: (data: Partial<Courseware>) => 
      ipcRenderer.invoke(IPC_CHANNELS.COURSEWARE_CREATE, data),
    getAll: (options?: { status?: string }) => 
      ipcRenderer.invoke(IPC_CHANNELS.COURSEWARE_GET_ALL, options),
    getById: (id: string) => 
      ipcRenderer.invoke(IPC_CHANNELS.COURSEWARE_GET_BY_ID, id),
    update: (id: string, data: Partial<Courseware>) => 
      ipcRenderer.invoke(IPC_CHANNELS.COURSEWARE_UPDATE, id, data),
    delete: (id: string) => 
      ipcRenderer.invoke(IPC_CHANNELS.COURSEWARE_DELETE, id),
    export: (id: string) => 
      ipcRenderer.invoke(IPC_CHANNELS.COURSEWARE_EXPORT, id),
    import: () => 
      ipcRenderer.invoke(IPC_CHANNELS.COURSEWARE_IMPORT),
    exportPdf: (data: PdfExportData) => 
      ipcRenderer.invoke(IPC_CHANNELS.COURSEWARE_EXPORT_PDF, data),
    exportWord: (data: WordExportData) => 
      ipcRenderer.invoke(IPC_CHANNELS.COURSEWARE_EXPORT_WORD, data)
  },
  // 题目相关
  question: {
    create: (data: Partial<Question>) => 
      ipcRenderer.invoke(IPC_CHANNELS.QUESTION_CREATE, data),
    createBatch: (coursewareId: string, questions: Partial<Question>[]) => 
      ipcRenderer.invoke(IPC_CHANNELS.QUESTION_CREATE_BATCH, coursewareId, questions),
    getByCourseware: (coursewareId: string) => 
      ipcRenderer.invoke(IPC_CHANNELS.QUESTION_GET_BY_COURSEWARE, coursewareId),
    update: (id: string, data: Partial<Question>) => 
      ipcRenderer.invoke(IPC_CHANNELS.QUESTION_UPDATE, id, data),
    delete: (id: string) => 
      ipcRenderer.invoke(IPC_CHANNELS.QUESTION_DELETE, id),
    reorder: (coursewareId: string, questionIds: string[]) => 
      ipcRenderer.invoke(IPC_CHANNELS.QUESTION_REORDER, coursewareId, questionIds)
  },
  // OCR 相关
  ocr: {
    recognize: (imagePath: string, options?: OcrOptions) => 
      ipcRenderer.invoke(IPC_CHANNELS.OCR_RECOGNIZE, imagePath, options),
    recognizeBatch: (imagePaths: string[], options?: OcrOptions) => 
      ipcRenderer.invoke(IPC_CHANNELS.OCR_RECOGNIZE_BATCH, imagePaths, options),
    getLanguages: () => 
      ipcRenderer.invoke(IPC_CHANNELS.OCR_GET_LANGUAGES),
    terminate: () => 
      ipcRenderer.invoke(IPC_CHANNELS.OCR_TERMINATE)
  },
  // 图片处理相关
  image: {
    getInfo: (imagePath: string, includeBase64?: boolean) => 
      ipcRenderer.invoke(IPC_CHANNELS.IMAGE_GET_INFO, imagePath, includeBase64),
    process: (imagePath: string, options: ImageProcessOptions) => 
      ipcRenderer.invoke(IPC_CHANNELS.IMAGE_PROCESS, imagePath, options),
    createThumbnail: (imagePath: string, width?: number, height?: number) => 
      ipcRenderer.invoke(IPC_CHANNELS.IMAGE_CREATE_THUMBNAIL, imagePath, width, height),
    save: (data: string, coursewareId: string, filename?: string) => 
      ipcRenderer.invoke(IPC_CHANNELS.IMAGE_SAVE, data, coursewareId, filename),
    copyToCourseware: (sourcePaths: string[], coursewareId: string) => 
      ipcRenderer.invoke(IPC_CHANNELS.IMAGE_COPY_TO_COURSEWARE, sourcePaths, coursewareId),
    delete: (imagePath: string) => 
      ipcRenderer.invoke(IPC_CHANNELS.IMAGE_DELETE, imagePath)
  },
  // 同步相关
  sync: {
    getConfig: () => 
      ipcRenderer.invoke(IPC_CHANNELS.SYNC_GET_CONFIG),
    saveConfig: (config: Partial<SyncConfig>) => 
      ipcRenderer.invoke(IPC_CHANNELS.SYNC_SAVE_CONFIG, config),
    execute: (direction?: SyncDirection) => 
      ipcRenderer.invoke(IPC_CHANNELS.SYNC_EXECUTE, direction),
    getStatus: () => 
      ipcRenderer.invoke(IPC_CHANNELS.SYNC_GET_STATUS),
    getPending: () => 
      ipcRenderer.invoke(IPC_CHANNELS.SYNC_GET_PENDING),
    retryFailed: () => 
      ipcRenderer.invoke(IPC_CHANNELS.SYNC_RETRY_FAILED),
    cleanLogs: (beforeDate?: string) => 
      ipcRenderer.invoke(IPC_CHANNELS.SYNC_CLEAN_LOGS, beforeDate)
  },
  // PaddleOCR
  paddleOcr: {
    health: () => ipcRenderer.invoke(IPC_CHANNELS.PADDLE_OCR_HEALTH),
    split: (imageBase64: string) => ipcRenderer.invoke(IPC_CHANNELS.PADDLE_OCR_SPLIT, imageBase64),
    eraseHandwriting: (imageBase64: string, mode?: string) => 
      ipcRenderer.invoke(IPC_CHANNELS.PADDLE_OCR_ERASE_HANDWRITING, imageBase64, mode || 'auto'),
    correctImage: (imageBase64: string, options?: {
      auto_perspective?: boolean
      auto_rotate?: boolean
      auto_crop?: boolean
    }) => ipcRenderer.invoke(IPC_CHANNELS.PADDLE_OCR_CORRECT_IMAGE, imageBase64, options || {}),
    startService: () => ipcRenderer.invoke(IPC_CHANNELS.PADDLE_OCR_START_SERVICE),
    stopService: () => ipcRenderer.invoke(IPC_CHANNELS.PADDLE_OCR_STOP_SERVICE)
  },
  // 屏幕录制
  screen: {
    getSources: () => ipcRenderer.invoke(IPC_CHANNELS.SCREEN_GET_SOURCES)
  },
  // 视频保存
  video: {
    saveWebm: (buffer: ArrayBuffer, defaultFileName: string) => 
      ipcRenderer.invoke(IPC_CHANNELS.VIDEO_SAVE_WEBM, { buffer, defaultFileName }),
    saveMp4: (buffer: ArrayBuffer, defaultFileName: string) => 
      ipcRenderer.invoke(IPC_CHANNELS.VIDEO_SAVE_MP4, { buffer, defaultFileName })
  },
  // 音频保存
  audio: {
    save: (buffer: ArrayBuffer, defaultFileName: string) => 
      ipcRenderer.invoke(IPC_CHANNELS.AUDIO_SAVE, { buffer, defaultFileName })
  }
} as ElectronAPI)
