/**
 * IPC 通道名称常量（统一定义，避免重复）
 */
export const IPC_CHANNELS = {
  // 应用相关
  APP_GET_VERSION: 'app:getVersion',
  APP_GET_PLATFORM: 'app:getPlatform',
  APP_QUIT: 'app:quit',
  APP_RELAUNCH: 'app:relaunch',

  // 窗口相关
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_CLOSE: 'window:close',
  WINDOW_IS_MAXIMIZED: 'window:isMaximized',

  // 文件相关
  FILE_SELECT_IMAGES: 'file:selectImages',
  FILE_SELECT_DIR: 'file:selectDirectory',
  FILE_SAVE: 'file:save',
  FILE_OPEN_PATH: 'file:openPath',

  // 系统相关
  SYSTEM_GET_DEVICE_ID: 'system:getDeviceId',
  SYSTEM_GET_INFO: 'system:getInfo',

  // 激活相关
  ACTIVATION_VERIFY: 'activation:verify',
  ACTIVATION_CHECK: 'activation:check',

  // 数据库相关
  DATABASE_QUERY: 'database:query',
  DATABASE_EXECUTE: 'database:execute',

  // 课件相关
  COURSEWARE_CREATE: 'courseware:create',
  COURSEWARE_GET_ALL: 'courseware:getAll',
  COURSEWARE_GET_BY_ID: 'courseware:getById',
  COURSEWARE_UPDATE: 'courseware:update',
  COURSEWARE_DELETE: 'courseware:delete',

  // 题目相关
  QUESTION_CREATE: 'question:create',
  QUESTION_CREATE_BATCH: 'question:createBatch',
  QUESTION_GET_BY_COURSEWARE: 'question:getByCourseware',
  QUESTION_UPDATE: 'question:update',
  QUESTION_DELETE: 'question:delete',
  QUESTION_REORDER: 'question:reorder',

  // OCR 相关
  OCR_RECOGNIZE: 'ocr:recognize',
  OCR_RECOGNIZE_BATCH: 'ocr:recognizeBatch',
  OCR_GET_LANGUAGES: 'ocr:getLanguages',
  OCR_TERMINATE: 'ocr:terminate',

  // 图片处理相关
  IMAGE_GET_INFO: 'image:getInfo',
  IMAGE_PROCESS: 'image:process',
  IMAGE_CREATE_THUMBNAIL: 'image:createThumbnail',
  IMAGE_SAVE: 'image:save',
  IMAGE_COPY_TO_COURSEWARE: 'image:copyToCourseware',
  IMAGE_DELETE: 'image:delete',

  // 同步相关
  SYNC_GET_CONFIG: 'sync:getConfig',
  SYNC_SAVE_CONFIG: 'sync:saveConfig',
  SYNC_EXECUTE: 'sync:execute',
  SYNC_GET_STATUS: 'sync:getStatus',
  SYNC_GET_PENDING: 'sync:getPending',
  SYNC_RETRY_FAILED: 'sync:retryFailed',
  SYNC_CLEAN_LOGS: 'sync:cleanLogs',

  // PaddleOCR
  PADDLE_OCR_HEALTH: 'paddleOcr:health',
  PADDLE_OCR_SPLIT: 'paddleOcr:split',
  PADDLE_OCR_ERASE_HANDWRITING: 'paddleOcr:eraseHandwriting'
} as const
