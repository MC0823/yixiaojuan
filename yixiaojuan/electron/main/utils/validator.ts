/**
 * 输入验证工具
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

export class InputValidator {
  /**
   * 验证UUID格式
   */
  static isValidUUID(id: string): boolean {
    return typeof id === 'string' && UUID_REGEX.test(id)
  }

  /**
   * 验证文件路径（防止路径遍历）
   */
  static isValidPath(path: string): boolean {
    if (typeof path !== 'string' || !path) return false
    const normalized = path.replace(/\\/g, '/')
    return !normalized.includes('..') && !normalized.includes('~')
  }

  /**
   * 验证文件大小
   */
  static isValidFileSize(size: number): boolean {
    return typeof size === 'number' && size > 0 && size <= MAX_FILE_SIZE
  }

  /**
   * 验证图片格式
   */
  static isValidImageFormat(filename: string): boolean {
    const ext = filename.toLowerCase().split('.').pop()
    return ['jpg', 'jpeg', 'png', 'webp', 'bmp'].includes(ext || '')
  }

  /**
   * 清理SQL输入（额外保护层）
   */
  static sanitizeSQL(input: string): string {
    return input.replace(/[;'"\\]/g, '')
  }
}
