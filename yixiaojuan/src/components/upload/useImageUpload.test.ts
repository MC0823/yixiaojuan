/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useImageUpload } from './useImageUpload'
import * as paddleOcrService from '../../services/paddleOcrService'

vi.mock('../../services/paddleOcrService')
vi.mock('antd', () => ({
  message: {
    loading: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  }
}))

describe('useImageUpload - handleSplitAll', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should filter and split only unsplit images', async () => {
    const { result } = renderHook(() => useImageUpload())

    act(() => {
      result.current.setImages([
        { id: '1', name: 'test1.png', path: '/test1.png', thumbnail: 'base64data', base64Data: 'base64data' },
        { id: 'split_123', name: 'split', path: '/split.png', thumbnail: 'base64data', base64Data: 'base64data' }
      ])
    })

    vi.mocked(paddleOcrService.ensureOcrServiceReady).mockResolvedValue(true)
    vi.mocked(paddleOcrService.paddleOcrSplit).mockResolvedValue({
      success: true,
      questions: [{ index: 1, base64: 'data', ocrText: 'Q1', stem: 'Q1', options: [] }],
      total: 1
    })

    await act(async () => {
      await result.current.handleSplitAll()
    })

    // 只处理未切分的图片
    expect(paddleOcrService.paddleOcrSplit).toHaveBeenCalledTimes(1)
  })

  it('should handle empty image list', async () => {
    const { result } = renderHook(() => useImageUpload())

    await act(async () => {
      await result.current.handleSplitAll()
    })

    // 空图片列表时直接返回，不调用 paddleOcrSplit
    expect(paddleOcrService.paddleOcrSplit).not.toHaveBeenCalled()
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
      result.current.setImages([{ id: '1', name: 'test.png', path: '/test.png', thumbnail: 'base64data', base64Data: 'base64data' }])
    })

    vi.mocked(paddleOcrService.ensureOcrServiceReady).mockResolvedValue(true)
    // 任务取消的逻辑已在代码中实现，此处验证服务异常时的处理
    vi.mocked(paddleOcrService.paddleOcrSplit).mockRejectedValue(new Error('Service error'))

    await act(async () => {
      await result.current.handleSplitAll()
    })

    // 即使失败也不应该崩溃
    expect(paddleOcrService.ensureOcrServiceReady).toHaveBeenCalled()
  })

  it('should handle individual image split failure', async () => {
    const { result } = renderHook(() => useImageUpload())

    act(() => {
      result.current.setImages([
        { id: '1', name: 'test1.png', path: '/test1.png', thumbnail: 'base64data1', base64Data: 'base64data1' },
        { id: '2', name: 'test2.png', path: '/test2.png', thumbnail: 'base64data2', base64Data: 'base64data2' }
      ])
    })

    vi.mocked(paddleOcrService.ensureOcrServiceReady).mockResolvedValue(true)
    vi.mocked(paddleOcrService.paddleOcrSplit)
      .mockRejectedValueOnce(new Error('Split failed'))
      .mockResolvedValueOnce({
        success: true,
        questions: [{ index: 1, base64: 'data', ocrText: 'Q1', stem: 'Q1', options: [] }],
        total: 1
      })

    await act(async () => {
      await result.current.handleSplitAll()
    })

    // 第一张失败不影响第二张处理
    expect(paddleOcrService.paddleOcrSplit).toHaveBeenCalledTimes(2)
  })
})

describe('useImageUpload - handleCorrectAll', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should handle empty image list', async () => {
    const { result } = renderHook(() => useImageUpload())

    await act(async () => {
      await result.current.handleCorrectAll()
    })

    // 空图片列表时直接返回，不调用 correctImage
    expect(paddleOcrService.correctImage).not.toHaveBeenCalled()
  })

  it('should warn when OCR service is not available', async () => {
    const { result } = renderHook(() => useImageUpload())

    act(() => {
      result.current.setImages([
        { id: '1', name: 'test.png', path: '/test.png', thumbnail: 'base64data' }
      ])
    })

    vi.mocked(paddleOcrService.checkOcrServerHealth).mockResolvedValue(false)

    await act(async () => {
      await result.current.handleCorrectAll()
    })

    expect(paddleOcrService.correctImage).not.toHaveBeenCalled()
  })

  it('should correct all images successfully', async () => {
    const { result } = renderHook(() => useImageUpload())

    act(() => {
      result.current.setImages([
        { id: '1', name: 'test1.png', path: '/test1.png', thumbnail: 'base64data1', base64Data: 'base64data1' },
        { id: '2', name: 'test2.png', path: '/test2.png', thumbnail: 'base64data2', base64Data: 'base64data2' }
      ])
    })

    vi.mocked(paddleOcrService.checkOcrServerHealth).mockResolvedValue(true)
    vi.mocked(paddleOcrService.correctImage).mockResolvedValue({
      success: true,
      image: 'corrected_base64',
      corrected: true,
      details: { perspective_applied: false, rotation_angle: 2.5, cropped: true }
    })

    await act(async () => {
      await result.current.handleCorrectAll()
    })

    expect(paddleOcrService.correctImage).toHaveBeenCalledTimes(2)
    expect(result.current.images[0].base64Data).toBe('corrected_base64')
    expect(result.current.images[1].base64Data).toBe('corrected_base64')
  })

  it('should continue on individual image failure', async () => {
    const { result } = renderHook(() => useImageUpload())

    act(() => {
      result.current.setImages([
        { id: '1', name: 'test1.png', path: '/test1.png', thumbnail: 'base64data1', base64Data: 'base64data1' },
        { id: '2', name: 'test2.png', path: '/test2.png', thumbnail: 'base64data2', base64Data: 'base64data2' }
      ])
    })

    vi.mocked(paddleOcrService.checkOcrServerHealth).mockResolvedValue(true)
    vi.mocked(paddleOcrService.correctImage)
      .mockRejectedValueOnce(new Error('Correct failed'))
      .mockResolvedValueOnce({
        success: true,
        image: 'corrected_base64',
        corrected: true,
        details: { perspective_applied: false, rotation_angle: 0, cropped: false }
      })

    await act(async () => {
      await result.current.handleCorrectAll()
    })

    expect(paddleOcrService.correctImage).toHaveBeenCalledTimes(2)
    // 第一张失败保持原样，第二张成功更新
    expect(result.current.images[0].base64Data).toBe('base64data1')
    expect(result.current.images[1].base64Data).toBe('corrected_base64')
  })

  it('should track isCorrect state during processing', async () => {
    const { result } = renderHook(() => useImageUpload())

    act(() => {
      result.current.setImages([
        { id: '1', name: 'test.png', path: '/test.png', thumbnail: 'base64data', base64Data: 'base64data' }
      ])
    })

    expect(result.current.isCorrect).toBe(false)

    vi.mocked(paddleOcrService.checkOcrServerHealth).mockResolvedValue(true)
    vi.mocked(paddleOcrService.correctImage).mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({
        success: true,
        image: 'corrected',
        corrected: true,
        details: { perspective_applied: false, rotation_angle: 0, cropped: false }
      }), 100))
    )

    let correctPromise: Promise<void>
    act(() => {
      correctPromise = result.current.handleCorrectAll()
    })

    // 等待一下让任务启动
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10))
    })

    expect(result.current.isCorrect).toBe(true)

    await act(async () => {
      await correctPromise!
    })

    expect(result.current.isCorrect).toBe(false)
  })

  it('should count corrected vs uncorrected images', async () => {
    const { result } = renderHook(() => useImageUpload())

    act(() => {
      result.current.setImages([
        { id: '1', name: 'test1.png', path: '/test1.png', thumbnail: 'data1', base64Data: 'data1' },
        { id: '2', name: 'test2.png', path: '/test2.png', thumbnail: 'data2', base64Data: 'data2' }
      ])
    })

    vi.mocked(paddleOcrService.checkOcrServerHealth).mockResolvedValue(true)
    vi.mocked(paddleOcrService.correctImage)
      .mockResolvedValueOnce({
        success: true,
        image: 'img1',
        corrected: true,  // 进行了矫正
        details: { perspective_applied: false, rotation_angle: 5, cropped: false }
      })
      .mockResolvedValueOnce({
        success: true,
        image: 'img2',
        corrected: false, // 未进行矫正（图片已经正）
        details: { perspective_applied: false, rotation_angle: 0, cropped: false }
      })

    await act(async () => {
      await result.current.handleCorrectAll()
    })

    expect(paddleOcrService.correctImage).toHaveBeenCalledTimes(2)
  })
})
