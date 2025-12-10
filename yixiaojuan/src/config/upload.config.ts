/**
 * 上传功能配置常量
 */
export const UPLOAD_CONFIG = {
  // 文件限制
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_TOTAL_SIZE: 50 * 1024 * 1024, // 50MB
  ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/bmp', 'image/webp'],

  // 缩略图配置
  THUMBNAIL_WIDTH: 200,
  THUMBNAIL_HEIGHT: 200,

  // 延迟配置
  RENDER_DELAY: 300,
  CANVAS_LOAD_DELAY: 100,

  // 并发配置
  OCR_CONCURRENCY: 3,
} as const
