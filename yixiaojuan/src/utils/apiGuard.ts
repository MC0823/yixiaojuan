/**
 * API 可用性检查工具
 * 统一处理 Electron API 的可用性验证
 */

export class ApiNotAvailableError extends Error {
  constructor(apiName: string) {
    super(`${apiName} 不可用，请在桌面应用中运行`)
    this.name = 'ApiNotAvailableError'
  }
}

export function ensureElectronAPI(): void {
  if (!window.electronAPI) {
    throw new ApiNotAvailableError('Electron API')
  }
}

export function ensurePaddleOcr(): void {
  if (!window.electronAPI?.paddleOcr) {
    throw new ApiNotAvailableError('PaddleOCR 服务')
  }
}

export function ensureFileAPI(): void {
  if (!window.electronAPI?.file) {
    throw new ApiNotAvailableError('文件 API')
  }
}

export function ensureImageAPI(): void {
  if (!window.electronAPI?.image) {
    throw new ApiNotAvailableError('图片 API')
  }
}

export function ensureScreenAPI(): void {
  if (!window.electronAPI?.screen) {
    throw new ApiNotAvailableError('屏幕 API')
  }
}
