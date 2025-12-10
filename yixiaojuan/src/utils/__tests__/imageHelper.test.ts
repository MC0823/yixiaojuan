import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getImageData } from '../imageHelper'
import type { UploadImageItem } from '../../components/upload/types'

describe('imageHelper', () => {
  describe('getImageData', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('should return base64Data when available', async () => {
      const image: UploadImageItem = {
        id: '1',
        path: '/test/path',
        name: 'test.jpg',
        base64Data: 'data:image/png;base64,test123'
      }

      const result = await getImageData(image)
      expect(result).toBe('data:image/png;base64,test123')
    })

    it('should return thumbnail when base64Data is not available', async () => {
      const image: UploadImageItem = {
        id: '1',
        path: '/test/path',
        name: 'test.jpg',
        thumbnail: 'data:image/png;base64,thumbnail123'
      }

      const result = await getImageData(image)
      expect(result).toBe('data:image/png;base64,thumbnail123')
    })

    it('should fetch via IPC when neither base64Data nor thumbnail available', async () => {
      const mockGetInfo = vi.fn().mockResolvedValue({
        success: true,
        data: { base64: 'data:image/png;base64,ipc123' }
      })

      global.window = {
        electronAPI: {
          image: { getInfo: mockGetInfo }
        }
      } as any

      const image: UploadImageItem = {
        id: '1',
        path: '/test/path',
        name: 'test.jpg'
      }

      const result = await getImageData(image)
      expect(result).toBe('data:image/png;base64,ipc123')
      expect(mockGetInfo).toHaveBeenCalledWith('/test/path', true)
    })

    it('should throw error when no data source is available', async () => {
      global.window = {} as any

      const image: UploadImageItem = {
        id: '1',
        path: '/test/path',
        name: 'test.jpg'
      }

      await expect(getImageData(image)).rejects.toThrow('无法获取图片数据')
    })

    it('should throw error when IPC fails', async () => {
      const mockGetInfo = vi.fn().mockResolvedValue({
        success: false
      })

      global.window = {
        electronAPI: {
          image: { getInfo: mockGetInfo }
        }
      } as any

      const image: UploadImageItem = {
        id: '1',
        path: '/test/path',
        name: 'test.jpg'
      }

      await expect(getImageData(image)).rejects.toThrow('无法获取图片数据')
    })
  })
})
