/**
 * 服务模块统一导出
 */
export { ocrService, type OcrResult, type OcrOptions, type OcrWord, type OcrLine } from './OcrService'
export { fileService, type ImageInfo, type ImageProcessOptions, type FileSaveOptions } from './FileService'
export { 
  syncService, 
  type SyncStatus, 
  type SyncDirection, 
  type SyncRecord, 
  type SyncConfig, 
  type SyncResult,
  type SyncConflict 
} from './SyncService'
