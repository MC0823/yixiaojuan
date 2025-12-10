import { describe, it, expect } from 'vitest'
import { UPLOAD_CONFIG } from '../upload.config'

describe('upload.config', () => {
  describe('UPLOAD_CONFIG', () => {
    it('should have correct file size limits', () => {
      expect(UPLOAD_CONFIG.MAX_FILE_SIZE).toBe(10 * 1024 * 1024)
      expect(UPLOAD_CONFIG.MAX_TOTAL_SIZE).toBe(50 * 1024 * 1024)
    })

    it('should have valid image types', () => {
      expect(UPLOAD_CONFIG.ALLOWED_TYPES).toContain('image/jpeg')
      expect(UPLOAD_CONFIG.ALLOWED_TYPES).toContain('image/png')
      expect(UPLOAD_CONFIG.ALLOWED_TYPES.length).toBeGreaterThan(0)
    })

    it('should have reasonable thumbnail dimensions', () => {
      expect(UPLOAD_CONFIG.THUMBNAIL_WIDTH).toBeGreaterThan(0)
      expect(UPLOAD_CONFIG.THUMBNAIL_HEIGHT).toBeGreaterThan(0)
    })

    it('should have positive delay values', () => {
      expect(UPLOAD_CONFIG.RENDER_DELAY).toBeGreaterThan(0)
      expect(UPLOAD_CONFIG.CANVAS_LOAD_DELAY).toBeGreaterThan(0)
    })

    it('should have valid OCR concurrency', () => {
      expect(UPLOAD_CONFIG.OCR_CONCURRENCY).toBeGreaterThan(0)
      expect(UPLOAD_CONFIG.OCR_CONCURRENCY).toBeLessThanOrEqual(10)
    })
  })
})
