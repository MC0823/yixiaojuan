/**
 * 图片处理工具函数
 */
import type { UploadImageItem } from '../components/upload/types'

/**
 * 获取图片数据（base64格式）
 * 优先级：base64Data > thumbnail > IPC获取
 */
export async function getImageData(image: UploadImageItem): Promise<string> {
  // 1. 优先使用base64Data
  if (image.base64Data) return image.base64Data

  // 2. 其次使用thumbnail
  if (image.thumbnail) return image.thumbnail

  // 3. 最后通过IPC获取
  if (window.electronAPI) {
    const result = await window.electronAPI.image.getInfo(image.path, true)
    if (result.success && result.data?.base64) {
      return result.data.base64
    }
  }

  throw new Error('无法获取图片数据')
}
