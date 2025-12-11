/**
 * 图片上传 Hook
 * 提供图片选择、预览、切题、擦除等功能
 * 状态存储在全局 Store 中，支持切换页面后保持
 */
import { useCallback, useMemo } from 'react'
import { App } from 'antd'
import { paddleOcrSplit, checkOcrServerHealth, eraseHandwriting, correctImage, ensureOcrServiceReady } from '../../services/paddleOcrService'
import { QuestionSplitter } from '../../utils/questionSplitter'
import { useUploadStore } from '../../stores'
import type { UploadImageItem } from './types'

interface UseImageUploadReturn {
  /** 图片列表 */
  images: UploadImageItem[]
  /** 设置图片列表 */
  setImages: React.Dispatch<React.SetStateAction<UploadImageItem[]>>
  /** 是否正在选择图片 */
  isSelecting: boolean
  /** 是否正在切题 */
  isSplitting: boolean
  /** 切题进度 */
  splitProgress: { percent: number; status: string; taskId: string; isFirstRun: boolean }
  /** 是否正在擦除 */
  isErasing: boolean
  /** 是否正在矫正 */
  isCorrect: boolean
  /** 预览相关状态 */
  previewVisible: boolean
  previewImage: string
  /** 通过系统对话框选择图片 */
  handleSelectImages: () => Promise<void>
  /** 删除图片 */
  handleRemoveImage: (id: string) => void
  /** 预览图片 */
  handlePreviewImage: (image: UploadImageItem) => Promise<void>
  /** 关闭预览 */
  handleClosePreview: () => void
  /** 自动切题 */
  handleAutoSplit: (imageId: string) => Promise<void>
  /** 批量切题 */
  handleSplitAll: () => Promise<void>
  /** 擦除笔迹 */
  handleEraseHandwriting: (imageId: string) => Promise<void>
  /** 批量擦除 */
  handleEraseAll: () => Promise<void>
  /** 批量矫正 */
  handleCorrectAll: () => Promise<void>
  /** 处理拖拽上传 */
  handleDragUpload: (file: File) => void
  /** 取消任务 */
  handleCancelTask: (taskId: string) => void
}

/**
 * 生成唯一ID
 */
function generateId(): string {
  return `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * 获取图片数据
 */
async function getImageSource(image: UploadImageItem): Promise<string | null> {
  try {
    const { getImageData } = await import('../../utils/imageHelper')
    return await getImageData(image)
  } catch (e) {
    console.error('获取图片数据失败:', e)
    return null
  }
}

export function useImageUpload(): UseImageUploadReturn {
  // 使用 App.useApp() 获取 message 实例，支持动态主题
  const { message } = App.useApp()
  
  // 使用全局 Store 管理状态，支持切换页面后保持
  const {
    images,
    setImages,
    isSelecting,
    setIsSelecting,
    tasks,
    isFirstRun,
    previewVisible,
    previewImage,
    startTask,
    updateTaskProgress,
    completeTask,
    failTask,
    cancelTask,
    isTaskCancelled,
    markNotFirstRun,
    showPreview,
    hidePreview,
  } = useUploadStore()

  // 计算派生状态
  const isSplitting = useMemo(() => 
    tasks.some(t => t.type === 'split' && t.status === 'running'),
    [tasks]
  )
  
  const isErasing = useMemo(() => 
    tasks.some(t => t.type === 'erase' && t.status === 'running'),
    [tasks]
  )
  
  const isCorrect = useMemo(() => 
    tasks.some(t => t.type === 'correct' && t.status === 'running'),
    [tasks]
  )
  
  const splitProgress = useMemo(() => {
    const splitTask = tasks.find(t => t.type === 'split' && t.status === 'running')
    return splitTask 
      ? { 
          percent: splitTask.percent, 
          status: splitTask.statusText,
          taskId: splitTask.id,
          isFirstRun
        }
      : { percent: 0, status: '', taskId: '', isFirstRun }
  }, [tasks, isFirstRun])

  /**
   * 通过系统对话框选择图片
   */
  const handleSelectImages = useCallback(async () => {
    if (!window.electronAPI) {
      message.warning('请在 Electron 环境中运行')
      return
    }

    setIsSelecting(true)
    try {
      const result = await window.electronAPI.file.selectImages()
      
      if (!result.canceled && result.filePaths.length > 0) {
        const newImages: UploadImageItem[] = []
        
        for (const filePath of result.filePaths) {
          const id = generateId()
          let thumbnail = ''
          
          try {
            const thumbResult = await window.electronAPI.image.createThumbnail(filePath, 200, 200)
            if (thumbResult.success && thumbResult.data) {
              thumbnail = thumbResult.data
            } else {
              console.warn('缩略图生成失败:', thumbResult.error)
            }
          } catch (e) {
            console.warn('缩略图生成异常:', e)
          }
          
          newImages.push({
            id,
            path: filePath,
            name: filePath.split(/[\\/]/).pop() || 'unknown',
            thumbnail
          })
        }
        
        setImages(prev => [...prev, ...newImages])
        message.success(`已添加 ${result.filePaths.length} 张图片`)
      }
    } catch (error) {
      console.error('选择图片失败:', error)
      message.error('选择图片失败')
    } finally {
      setIsSelecting(false)
    }
  }, [setImages, setIsSelecting])

  /**
   * 删除图片
   */
  const handleRemoveImage = useCallback((id: string) => {
    setImages(prev => prev.filter(img => img.id !== id))
  }, [setImages])

  /**
   * 预览图片
   */
  const handlePreviewImage = useCallback(async (image: UploadImageItem) => {
    if (image.base64Data) {
      showPreview(image.base64Data)
      return
    }
    
    if (image.thumbnail) {
      showPreview(image.thumbnail)
      return
    }
    
    if (!window.electronAPI) return
    
    try {
      const result = await window.electronAPI.image.getInfo(image.path, true)
      if (result.success && result.data?.base64) {
        showPreview(result.data.base64)
      } else {
        message.error('加载图片失败')
      }
    } catch (error) {
      message.error('加载图片失败')
    }
  }, [showPreview])

  /**
   * 关闭预览
   */
  const handleClosePreview = useCallback(() => {
    hidePreview()
  }, [hidePreview])

  /**
   * 自动切题
   */
  const handleAutoSplit = useCallback(async (imageId: string) => {
    const image = images.find(img => img.id === imageId)
    if (!image) return
    
    const taskId = `split_${Date.now()}`
    startTask(taskId, 'split')
    
    // 首次运行显示温馨提示
    if (isFirstRun) {
      updateTaskProgress(taskId, 0, '首次识别需加载OCR模型，请耐心等待...')
    } else {
      updateTaskProgress(taskId, 0, '准备中...')
    }
    
    try {
      // 检查是否已取消
      if (isTaskCancelled(taskId)) {
        message.info('已取消切题')
        return
      }

      const imageSource = await getImageSource(image)
      if (!imageSource) throw new Error('无法获取图片数据')

      // 再次检查是否已取消
      if (isTaskCancelled(taskId)) {
        message.info('已取消切题')
        return
      }
      
      // 检查并确保 OCR 服务可用（如未启动则自动启动）
      const paddleAvailable = await ensureOcrServiceReady((percent, status) => {
        if (isTaskCancelled(taskId)) return
        // 启动服务的进度占 0-30%
        updateTaskProgress(taskId, Math.round(percent * 0.3), status)
      })
      
      let splitQuestions: { 
        index: number
        base64: string
        ocrText: string
        stem?: string
        options?: Array<{ label: string; content: string }>
      }[] = []
      
      if (paddleAvailable) {
        updateTaskProgress(taskId, 5, isFirstRun ? '正在加载 OCR 模型，首次启动约需 30-60 秒...' : '连接 PaddleOCR 服务...')
        const result = await paddleOcrSplit(imageSource, (percent, status) => {
          // 检查是否已取消
          if (isTaskCancelled(taskId)) return
          updateTaskProgress(taskId, percent, status)
        })
        
        // 检查是否已取消
        if (isTaskCancelled(taskId)) {
          message.info('已取消切题')
          return
        }
        
        if (!result.success || result.questions.length === 0) {
          throw new Error(result.message || '未检测到题目')
        }
        splitQuestions = result.questions
        
        // 标记已非首次运行
        if (isFirstRun) {
          markNotFirstRun()
        }
      } else {
        message.info('PaddleOCR 服务未启动，使用本地识别')
        const result = await QuestionSplitter.autoSplit(imageSource, (percent, status) => {
          // 检查是否已取消
          if (isTaskCancelled(taskId)) return
          updateTaskProgress(taskId, percent, status)
        })
        
        // 检查是否已取消
        if (isTaskCancelled(taskId)) {
          message.info('已取消切题')
          return
        }
        
        if (result.questions.length === 0) {
          throw new Error('未检测到题目')
        }
        splitQuestions = result.questions
        
        // 标记已非首次运行
        if (isFirstRun) {
          markNotFirstRun()
        }
      }
      
      // 使用完整路径作为分组标识，确保不同文件夹的同名文件不会被合并
      const sourceKey = image.path || image.name
      const sourceName = image.name.replace(/\.(jpg|jpeg|png|gif|bmp|webp)$/i, '')
      const newImages: UploadImageItem[] = splitQuestions.map((q, idx) => ({
        id: `split_${Date.now()}_${idx}`,
        path: `split_${idx + 1}.png`,
        name: `${sourceName}-第${q.index}题`,
        thumbnail: q.base64,
        base64Data: q.base64,
        ocrText: q.ocrText,
        stem: q.stem,
        options: q.options,
        sourceImage: sourceKey  // 使用完整路径作为分组标识
      }))
      
      setImages(prev => {
        const filtered = prev.filter(img => img.id !== imageId)
        return [...filtered, ...newImages]
      })
      
      completeTask(taskId)
      message.success(`成功切分出 ${splitQuestions.length} 道题目`)
    } catch (error) {
      failTask(taskId, error instanceof Error ? error.message : String(error))
      message.error('自动切题失败: ' + (error instanceof Error ? error.message : String(error)))
    }
  }, [images, isFirstRun, startTask, updateTaskProgress, completeTask, failTask, isTaskCancelled, markNotFirstRun, setImages])

  /**
   * 批量切题
   */
  const handleSplitAll = useCallback(async () => {
    if (images.length === 0) return

    // 过滤出未切分的图片
    const unsplitImages = images.filter(img => !img.id.startsWith('split_'))
    if (unsplitImages.length === 0) {
      message.info('没有需要切分的图片')
      return
    }

    const taskId = `split_batch_${Date.now()}`
    startTask(taskId, 'split')

    if (isFirstRun) {
      updateTaskProgress(taskId, 0, '首次识别需加载OCR模型，请耐心等待...')
    } else {
      updateTaskProgress(taskId, 0, '准备批量切题...')
    }

    try {
      // 确保 OCR 服务可用（自动启动）
      const paddleAvailable = await ensureOcrServiceReady((percent, status) => {
        if (isTaskCancelled(taskId)) return
        updateTaskProgress(taskId, Math.round(percent * 0.1), status)
      })

      if (!paddleAvailable) {
        throw new Error('OCR服务启动失败')
      }

      const allNewImages: UploadImageItem[] = []
      const processedIds: string[] = []

      for (let i = 0; i < unsplitImages.length; i++) {
        if (isTaskCancelled(taskId)) {
          message.info('已取消批量切题')
          return
        }

        const image = unsplitImages[i]
        const percent = 10 + Math.round((i / unsplitImages.length) * 90)
        updateTaskProgress(taskId, percent, `正在切分第 ${i + 1}/${unsplitImages.length} 张图片...`)

        try {
          const imageSource = await getImageSource(image)
          if (!imageSource) continue

          if (isTaskCancelled(taskId)) {
            message.info('已取消批量切题')
            return
          }

          const result = await paddleOcrSplit(imageSource)

          if (result.success && result.questions.length > 0) {
            // 使用完整路径作为分组标识，确保不同文件夹的同名文件不会被合并
            const sourceKey = image.path || image.name
            const sourceName = image.name.replace(/\.(jpg|jpeg|png|gif|bmp|webp)$/i, '')
            const newImages: UploadImageItem[] = result.questions.map((q, idx) => ({
              id: `split_${Date.now()}_${i}_${idx}`,
              path: `split_${i + 1}_${idx + 1}.png`,
              name: `${sourceName}-第${q.index}题`,
              thumbnail: q.base64,
              base64Data: q.base64,
              ocrText: q.ocrText,
              stem: q.stem,
              options: q.options,
              sourceImage: sourceKey  // 使用完整路径作为分组标识
            }))
            allNewImages.push(...newImages)
            processedIds.push(image.id)
          }
        } catch (error) {
          console.error(`切分图片 ${image.name} 失败:`, error)
        }
      }

      if (isFirstRun && allNewImages.length > 0) {
        markNotFirstRun()
      }

      if (allNewImages.length > 0) {
        setImages(prev => {
          const filtered = prev.filter(img => !processedIds.includes(img.id))
          return [...filtered, ...allNewImages]
        })
        completeTask(taskId)
        message.success(`批量切题完成，共切分出 ${allNewImages.length} 道题目`)
      } else {
        failTask(taskId, '未检测到题目')
        message.warning('未检测到题目')
      }
    } catch (error) {
      failTask(taskId, error instanceof Error ? error.message : String(error))
      message.error('批量切题失败: ' + (error instanceof Error ? error.message : String(error)))
    }
  }, [images, isFirstRun, startTask, updateTaskProgress, completeTask, failTask, isTaskCancelled, markNotFirstRun, setImages])

  /**
   * 擦除笔迹
   */
  const handleEraseHandwriting = useCallback(async (imageId: string) => {
    const image = images.find(img => img.id === imageId)
    if (!image) return
    
    const taskId = `erase_${Date.now()}`
    startTask(taskId, 'erase')
    
    try {
      const paddleAvailable = await checkOcrServerHealth()
      if (!paddleAvailable) {
        failTask(taskId, 'OCR服务未启动')
        message.warning('OCR服务未启动，无法使用笔迹擦除功能')
        return
      }
      
      const imageSource = await getImageSource(image)
      if (!imageSource) throw new Error('无法获取图片数据')
      
      updateTaskProgress(taskId, 50, '正在擦除笔迹...')
      message.loading({ content: '正在使用AI擦除笔迹...', key: 'erase' })

      const result = await eraseHandwriting(imageSource, 'ai')
      
      if (result.success && result.image) {
        setImages(prev => prev.map(img => 
          img.id === imageId 
            ? { ...img, thumbnail: result.image, base64Data: result.image } 
            : img
        ))
        completeTask(taskId)
        message.success({ content: '笔迹擦除完成', key: 'erase' })
      } else {
        throw new Error('笔迹擦除失败')
      }
    } catch (error) {
      failTask(taskId, error instanceof Error ? error.message : String(error))
      message.error({ 
        content: '笔迹擦除失败: ' + (error instanceof Error ? error.message : String(error)), 
        key: 'erase' 
      })
    }
  }, [images, startTask, updateTaskProgress, completeTask, failTask, setImages])

  /**
   * 批量擦除
   */
  const handleEraseAll = useCallback(async () => {
    if (images.length === 0) return
    
    const paddleAvailable = await checkOcrServerHealth()
    if (!paddleAvailable) {
      message.warning('OCR服务未启动，无法使用笔迹擦除功能')
      return
    }
    
    const taskId = `erase_batch_${Date.now()}`
    startTask(taskId, 'erase')
    message.loading({ content: `正在批量擦除笔迹 (0/${images.length})...`, key: 'eraseAll', duration: 0 })
    
    let successCount = 0
    for (let i = 0; i < images.length; i++) {
      const image = images[i]
      
      try {
        const imageSource = await getImageSource(image)
        if (!imageSource) continue
        
        updateTaskProgress(taskId, Math.round(((i + 1) / images.length) * 100), `正在擦除 ${i + 1}/${images.length}...`)

        const result = await eraseHandwriting(imageSource, 'ai')
        
        if (result.success && result.image) {
          setImages(prev => prev.map(img => 
            img.id === image.id 
              ? { ...img, thumbnail: result.image, base64Data: result.image } 
              : img
          ))
          successCount++
        }
        
        message.loading({ 
          content: `正在批量擦除笔迹 (${i + 1}/${images.length})...`, 
          key: 'eraseAll', 
          duration: 0 
        })
      } catch (error) {
        console.error(`擦除图片 ${image.name} 失败:`, error)
      }
    }
    
    completeTask(taskId)
    message.success({ content: `批量擦除完成，成功处理 ${successCount} 张图片`, key: 'eraseAll' })
  }, [images, startTask, updateTaskProgress, completeTask, setImages])

  /**
   * 批量矫正
   */
  const handleCorrectAll = useCallback(async () => {
    if (images.length === 0) return
    
    const paddleAvailable = await checkOcrServerHealth()
    if (!paddleAvailable) {
      message.warning('OCR服务未启动，无法使用图片矫正功能')
      return
    }
    
    const taskId = `correct_batch_${Date.now()}`
    startTask(taskId, 'correct')
    message.loading({ content: `正在批量矫正图片 (0/${images.length})...`, key: 'correctAll', duration: 0 })
    
    let successCount = 0
    let correctedCount = 0
    let failCount = 0
    
    try {
      for (let i = 0; i < images.length; i++) {
        // 检查任务是否被取消
        if (isTaskCancelled(taskId)) {
          message.info('已取消批量矫正')
          return
        }
        
        const image = images[i]
        
        try {
          const imageSource = await getImageSource(image)
          if (!imageSource) continue
          
          updateTaskProgress(taskId, Math.round(((i + 1) / images.length) * 100), `正在矫正 ${i + 1}/${images.length}...`)
          
          const result = await correctImage(imageSource)
          if (result.success && result.image) {
            setImages(prev => prev.map(img => 
              img.id === image.id 
                ? { ...img, thumbnail: result.image, base64Data: result.image } 
                : img
            ))
            successCount++
            if (result.corrected) {
              correctedCount++
            }
          }
          
          message.loading({ 
            content: `正在批量矫正图片 (${i + 1}/${images.length})...`,
            key: 'correctAll', 
            duration: 0 
          })
        } catch (error) {
          console.error(`矫正图片 ${image.name} 失败:`, error)
          failCount++
        }
      }
      
      completeTask(taskId)
      if (failCount > 0) {
        message.success({ content: `批量矫正完成，成功 ${successCount} 张，失败 ${failCount} 张，其中 ${correctedCount} 张进行了矫正`, key: 'correctAll' })
      } else {
        message.success({ content: `批量矫正完成，成功处理 ${successCount} 张图片，其中 ${correctedCount} 张进行了矫正`, key: 'correctAll' })
      }
    } catch (error) {
      failTask(taskId, error instanceof Error ? error.message : String(error))
      message.error({ content: '批量矫正失败: ' + (error instanceof Error ? error.message : String(error)), key: 'correctAll' })
    }
  }, [images, startTask, updateTaskProgress, completeTask, failTask, isTaskCancelled, setImages])

  /**
   * 处理拖拽上传
   */
  const handleDragUpload = useCallback((file: File) => {
    const id = generateId()
    const reader = new FileReader()

    reader.onload = (e) => {
      const base64 = e.target?.result as string
      setImages(prev => [...prev, {
        id,
        path: file.name,
        name: file.name,
        thumbnail: base64,
        base64Data: base64
      }])
    }

    reader.onerror = () => {
      message.error('文件读取失败')
    }

    reader.readAsDataURL(file)
  }, [setImages, message])

  /**
   * 取消任务
   */
  const handleCancelTask = useCallback((taskId: string) => {
    cancelTask(taskId)
    message.info('已取消任务')
  }, [cancelTask])

  return {
    images,
    setImages,
    isSelecting,
    isSplitting,
    splitProgress,
    isErasing,
    previewVisible,
    previewImage,
    handleSelectImages,
    handleRemoveImage,
    handlePreviewImage,
    handleClosePreview,
    handleAutoSplit,
    handleSplitAll,
    handleEraseHandwriting,
    handleEraseAll,
    handleCorrectAll,
    isCorrect,
    handleDragUpload,
    handleCancelTask
  }
}
