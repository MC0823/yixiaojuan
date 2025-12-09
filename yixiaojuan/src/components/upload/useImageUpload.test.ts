import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useImageUpload } from './useImageUpload'
import * as paddleOcrService from '../../services/paddleOcrService'

vi.mock('../../services/paddleOcrService')

describe('useImageUpload - handleSplitAll', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should filter and split only unsplit images', async () => {
    const { result } = renderHook(() => useImageUpload())

    act(() => {
      result.current.setImages([
        { id: '1', name: 'test1.png', path: '/test1.png', thumbnail: '' },
        { id: 'split_123', name: 'split', path: '/split.png', thumbnail: '' }
      ])
    })

    vi.mocked(paddleOcrService.ensureOcrServiceReady).mockResolvedValue(true)
    vi.mocked(paddleOcrService.paddleOcrSplit).mockResolvedValue({
      success: true,
      questions: [{ index: 1, base64: 'data', ocrText: 'Q1', stem: 'Q1', options: [] }]
    })

    await act(async () => {
      await result.current.handleSplitAll()
    })

    expect(paddleOcrService.paddleOcrSplit).toHaveBeenCalledTimes(1)
  })

  it('should handle empty image list', async () => {
    const { result } = renderHook(() => useImageUpload())

    await act(async () => {
      await result.current.handleSplitAll()
    })

    expect(paddleOcrService.ensureOcrServiceReady).not.toHaveBeenCalled()
  })

  it('should handle OCR service failure', async () => {
    const { result } = renderHook(() => useImageUpload())

    act(() => {
      result.current.setImages([{ id: '1', name: 'test.png', path: '/test.png', thumbnail: '' }])
    })

    vi.mocked(paddleOcrService.ensureOcrServiceReady).mockResolvedValue(false)

    await act(async () => {
      await result.current.handleSplitAll()
    })

    expect(paddleOcrService.paddleOcrSplit).not.toHaveBeenCalled()
  })

  it('should handle task cancellation', async () => {
    const { result } = renderHook(() => useImageUpload())

    act(() => {
      result.current.setImages([{ id: '1', name: 'test.png', path: '/test.png', thumbnail: '' }])
    })

    vi.mocked(paddleOcrService.ensureOcrServiceReady).mockResolvedValue(true)

    await act(async () => {
      const promise = result.current.handleSplitAll()
      result.current.cancelTask('split_batch_' + Date.now())
      await promise
    })

    expect(paddleOcrService.paddleOcrSplit).not.toHaveBeenCalled()
  })

  it('should handle individual image split failure', async () => {
    const { result } = renderHook(() => useImageUpload())

    act(() => {
      result.current.setImages([
        { id: '1', name: 'test1.png', path: '/test1.png', thumbnail: '' },
        { id: '2', name: 'test2.png', path: '/test2.png', thumbnail: '' }
      ])
    })

    vi.mocked(paddleOcrService.ensureOcrServiceReady).mockResolvedValue(true)
    vi.mocked(paddleOcrService.paddleOcrSplit)
      .mockRejectedValueOnce(new Error('Split failed'))
      .mockResolvedValueOnce({
        success: true,
        questions: [{ index: 1, base64: 'data', ocrText: 'Q1', stem: 'Q1', options: [] }]
      })

    await act(async () => {
      await result.current.handleSplitAll()
    })

    expect(result.current.images.some(img => img.id.startsWith('split_'))).toBe(true)
  })
})
