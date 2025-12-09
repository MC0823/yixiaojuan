/**
 * IPC 通道常量定义
 * 统一管理主进程与渲染进程之间的通信通道名称
 */

export const IPC_CHANNELS = {
  // 应用相关
  APP_GET_VERSION: 'app:get-version',
  APP_GET_PLATFORM: 'app:get-platform',
  APP_QUIT: 'app:quit',
  APP_RELAUNCH: 'app:relaunch',

  // 窗口相关
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_CLOSE: 'window:close',
  WINDOW_IS_MAXIMIZED: 'window:is-maximized',

  // 激活相关
  ACTIVATION_VERIFY: 'activation:verify',
  ACTIVATION_CHECK: 'activation:check',

  // 数据库相关
  DATABASE_QUERY: 'database:query',
  DATABASE_EXECUTE: 'database:execute',

  // 文件相关
  FILE_SELECT_IMAGES: 'file:select-images',
  FILE_SELECT_DIR: 'file:select-dir',
  FILE_SAVE: 'file:save',
  FILE_OPEN_PATH: 'file:open-path',

  // 系统相关
  SYSTEM_GET_DEVICE_ID: 'system:get-device-id',
  SYSTEM_GET_INFO: 'system:get-info',

  // 课件相关
  COURSEWARE_CREATE: 'courseware:create',
  COURSEWARE_GET_ALL: 'courseware:get-all',
  COURSEWARE_GET_BY_ID: 'courseware:get-by-id',
  COURSEWARE_UPDATE: 'courseware:update',
  COURSEWARE_DELETE: 'courseware:delete',

  // 题目相关
  QUESTION_CREATE: 'question:create',
  QUESTION_CREATE_BATCH: 'question:create-batch',
  QUESTION_GET_BY_COURSEWARE: 'question:get-by-courseware',
  QUESTION_UPDATE: 'question:update',
  QUESTION_DELETE: 'question:delete',
  QUESTION_REORDER: 'question:reorder',

  // OCR 相关
  OCR_RECOGNIZE: 'ocr:recognize',
  OCR_RECOGNIZE_BATCH: 'ocr:recognize-batch',
  OCR_GET_LANGUAGES: 'ocr:get-languages',
  OCR_TERMINATE: 'ocr:terminate',

  // 图片处理相关
  IMAGE_GET_INFO: 'image:get-info',
  IMAGE_PROCESS: 'image:process',
  IMAGE_CREATE_THUMBNAIL: 'image:create-thumbnail',
  IMAGE_SAVE: 'image:save',
  IMAGE_COPY_TO_COURSEWARE: 'image:copy-to-courseware',
  IMAGE_DELETE: 'image:delete',

  // 同步相关
  SYNC_GET_CONFIG: 'sync:get-config',
  SYNC_SAVE_CONFIG: 'sync:save-config',
  SYNC_EXECUTE: 'sync:execute',
  SYNC_GET_STATUS: 'sync:get-status',
  SYNC_GET_PENDING: 'sync:get-pending',
  SYNC_RETRY_FAILED: 'sync:retry-failed',
  SYNC_CLEAN_LOGS: 'sync:clean-logs',

  // PaddleOCR 相关
  PADDLE_OCR_HEALTH: 'paddle-ocr:health',
  PADDLE_OCR_SPLIT: 'paddle-ocr:split',
  PADDLE_OCR_ERASE_HANDWRITING: 'paddle-ocr:erase-handwriting',
  PADDLE_OCR_CORRECT_IMAGE: 'paddle-ocr:correct-image',
  PADDLE_OCR_START_SERVICE: 'paddle-ocr:start-service',
  PADDLE_OCR_STOP_SERVICE: 'paddle-ocr:stop-service',

  // 课件导入导出
  COURSEWARE_EXPORT: 'courseware:export',
  COURSEWARE_IMPORT: 'courseware:import',
  COURSEWARE_EXPORT_PDF: 'courseware:export-pdf',
  COURSEWARE_EXPORT_WORD: 'courseware:export-word',

  // 屏幕录制相关
  SCREEN_GET_SOURCES: 'screen:get-sources',

  // 视频导出相关
  VIDEO_SAVE_WEBM: 'video:save-webm',
  VIDEO_SAVE_MP4: 'video:save-mp4',
  AUDIO_SAVE: 'audio:save',
} as const

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]
