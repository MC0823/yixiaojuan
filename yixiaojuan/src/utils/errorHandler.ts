import { message } from 'antd';

/**
 * 应用错误类
 */
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public userMessage: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/**
 * 错误处理器
 */
export class ErrorHandler {
  /**
   * 统一处理错误
   * @param error - 错误对象
   * @param context - 错误上下文
   */
  static handle(error: Error, context: string): void {
    console.error(`[${context}]`, error);

    const userMsg = error instanceof AppError
      ? error.userMessage
      : '操作失败,请重试';

    message.error(userMsg);
  }
}

/**
 * 常见错误类型
 */
export class NetworkError extends AppError {
  constructor(message: string) {
    super(message, 'NETWORK_ERROR', '网络连接失败,请检查网络设置');
  }
}

export class FileError extends AppError {
  constructor(message: string) {
    super(message, 'FILE_ERROR', '文件操作失败,请检查文件是否存在');
  }
}

export class OcrError extends AppError {
  constructor(message: string) {
    super(message, 'OCR_ERROR', '图片识别失败,请上传清晰的图片');
  }
}

export class DatabaseError extends AppError {
  constructor(message: string) {
    super(message, 'DATABASE_ERROR', '数据保存失败,请重试');
  }
}
