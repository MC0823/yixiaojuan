/**
 * 统一类型定义文件
 * 所有进程共享的类型定义
 */

// ============== 基础响应类型 ==============

/**
 * API响应类型
 */
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

// ============== 系统类型 ==============

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

// ============== 激活类型 ==============

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

// ============== 课件类型 ==============

/**
 * 课件状态
 */
export type CoursewareStatus = 'draft' | 'completed' | 'archived'

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
  status: CoursewareStatus
  settings?: string
}

/**
 * 创建/更新课件的输入类型
 */
export type CoursewareInput = Partial<Omit<Courseware, 'id' | 'created_at' | 'updated_at'>>

// ============== 题目类型 ==============

/**
 * 题目类型枚举
 */
export type QuestionType = 'single' | 'multiple' | 'judge' | 'fill' | 'essay' | 'unknown'

/**
 * 题目实体类型
 */
export interface Question {
  id: string
  courseware_id: string
  order_index: number
  type?: QuestionType | string
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
 * 创建/更新题目的输入类型
 */
export type QuestionInput = Partial<Omit<Question, 'id' | 'created_at' | 'updated_at'>>

// ============== OCR 类型 ==============

/**
 * OCR 识别选项
 */
export interface OcrOptions {
  language?: string
}

/**
 * OCR 单词结果
 */
export interface OcrWord {
  text: string
  confidence: number
  bbox: { x0: number; y0: number; x1: number; y1: number }
}

/**
 * OCR 行结果
 */
export interface OcrLine {
  text: string
  confidence: number
  words: OcrWord[]
  bbox: { x0: number; y0: number; x1: number; y1: number }
}

/**
 * OCR 识别结果
 */
export interface OcrResult {
  text: string
  confidence: number
  words: OcrWord[]
  lines: OcrLine[]
}

/**
 * OCR 语言
 */
export interface OcrLanguage {
  code: string
  name: string
}

// ============== 图片处理类型 ==============

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

// ============== 文件类型 ==============

/**
 * 文件保存选项
 */
export interface FileSaveOptions {
  title?: string
  defaultPath?: string
  filters?: Array<{ name: string; extensions: string[] }>
}

/**
 * 文件选择结果
 */
export interface FileSelectResult {
  canceled: boolean
  filePaths: string[]
}

/**
 * 文件保存结果
 */
export interface FileSaveResult {
  canceled: boolean
  filePath?: string
}

// ============== 同步类型 ==============

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
 * 同步方向类型
 */
export type SyncDirection = 'upload' | 'download' | 'both'

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

// ============== 导出类型 ==============

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
 * 课件导出数据格式
 */
export interface CoursewareExportData {
  version: string
  exportTime: string
  courseware: {
    title: string
    description?: string
    status: CoursewareStatus
    settings?: string
  }
  questions: Array<{
    order_index: number
    type?: string
    ocr_text?: string
    options?: string
    answer?: string
    annotations?: string
    original_image_base64?: string | null
  }>
}

// ============== 屏幕录制类型 ==============

/**
 * 屏幕源类型
 */
export interface ScreenSource {
  id: string
  name: string
  thumbnail: string
  type: 'window' | 'screen'
}

/**
 * 视频保存选项
 */
export interface VideoSaveOptions {
  buffer: ArrayBuffer
  defaultFileName: string
}

// ============== PaddleOCR 类型 ==============

/**
 * 题目切分结果中的题目
 */
export interface SplitQuestion {
  index: number
  base64: string
  ocrText: string
  stem?: string
  options?: Array<{ label: string; content: string }>
}

/**
 * 题目切分结果
 */
export interface SplitResult {
  questions: SplitQuestion[]
}

/**
 * 笔迹擦除结果
 */
export interface EraseHandwritingResult {
  image: string
  mode: string
}

/**
 * 图片矫正选项
 */
export interface ImageCorrectOptions {
  auto_perspective?: boolean
  auto_rotate?: boolean
  auto_crop?: boolean
  enhance?: boolean
}

/**
 * 图片矫正结果
 */
export interface ImageCorrectResult {
  image: string
  corrected: boolean
  details: {
    perspective_applied: boolean
    rotation_angle: number
    cropped: boolean
    enhanced: boolean
    enhance_details?: {
      shadow_removed: boolean
      contrast_enhanced: boolean
      sharpened: boolean
      denoised: boolean
      white_balanced: boolean
    }
  }
}

// ============== IPC Handler 返回类型工具 ==============

/**
 * IPC Handler 包装函数的返回类型
 */
export type IpcHandlerResult<T> = Promise<ApiResponse<T>>

/**
 * 服务启动结果
 */
export interface ServiceResult {
  success: boolean
  message?: string
  error?: string
}
