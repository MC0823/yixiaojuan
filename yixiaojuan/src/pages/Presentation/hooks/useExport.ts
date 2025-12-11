/**
 * 导出功能 Hook
 * 处理PDF、Word、图片导出
 */
import { useState, useCallback } from 'react'
import { App } from 'antd'
import html2canvas from 'html2canvas'
import type { WhiteboardCanvasRef } from '../../../components/canvas'
import { CANVAS_CONFIG } from './useWhiteboard'
import { parseOptions, type CanvasQuestionItem } from './useCanvasQuestions'

interface Question {
  id: string
  ocr_text?: string
  options?: string
  answer?: string
}

interface Courseware {
  id: string
  title: string
  description?: string
}

interface UseExportOptions {
  courseware: Courseware | null
  questions: Question[]
  currentIndex: number
  setCurrentIndex: React.Dispatch<React.SetStateAction<number>>
  whiteboardData: Record<number, string>
  canvasQuestions: CanvasQuestionItem[]
  canvasSize: { width: number; height: number }
  wrapperSize: { width: number; height: number }
  mainContentRef: React.RefObject<HTMLDivElement>
  transformLayerRef: React.RefObject<HTMLDivElement>
  canvasWrapperRef: React.RefObject<HTMLDivElement>
  canvasRef: React.RefObject<WhiteboardCanvasRef>
  saveCurrentWhiteboard: () => void
}

interface UseExportReturn {
  // 状态
  isExportingPdf: boolean
  isExportingWord: boolean
  pdfExportModalVisible: boolean
  pdfExportMode: 'all' | 'annotated' | 'selected'
  selectedQuestions: number[]
  pdfExportScope: 'fullContent' | 'visibleArea'
  imageExportModalVisible: boolean
  imageExportScope: 'fullContent' | 'visibleArea'
  
  // 方法
  setPdfExportModalVisible: React.Dispatch<React.SetStateAction<boolean>>
  setPdfExportMode: React.Dispatch<React.SetStateAction<'all' | 'annotated' | 'selected'>>
  setSelectedQuestions: React.Dispatch<React.SetStateAction<number[]>>
  setPdfExportScope: React.Dispatch<React.SetStateAction<'fullContent' | 'visibleArea'>>
  setImageExportModalVisible: React.Dispatch<React.SetStateAction<boolean>>
  setImageExportScope: React.Dispatch<React.SetStateAction<'fullContent' | 'visibleArea'>>
  
  // 处理函数
  handleExportPdf: () => void
  executePdfExport: () => Promise<void>
  handleExportWord: () => Promise<void>
  handleExportImage: () => void
  executeImageExport: () => Promise<void>
  getAnnotatedQuestionIndices: () => number[]
}

export function useExport({
  courseware,
  questions,
  currentIndex,
  setCurrentIndex,
  whiteboardData,
  canvasQuestions,
  canvasSize,
  wrapperSize,
  mainContentRef,
  transformLayerRef,
  canvasWrapperRef,
  canvasRef,
  saveCurrentWhiteboard
}: UseExportOptions): UseExportReturn {
  const { message } = App.useApp()
  
  // 导出状态
  const [isExportingPdf, setIsExportingPdf] = useState(false)
  const [isExportingWord, setIsExportingWord] = useState(false)
  
  // PDF导出选择对话框状态
  const [pdfExportModalVisible, setPdfExportModalVisible] = useState(false)
  const [pdfExportMode, setPdfExportMode] = useState<'all' | 'annotated' | 'selected'>('all')
  const [selectedQuestions, setSelectedQuestions] = useState<number[]>([])
  const [pdfExportScope, setPdfExportScope] = useState<'fullContent' | 'visibleArea'>('fullContent')
  
  // 图片导出选择对话框状态
  const [imageExportModalVisible, setImageExportModalVisible] = useState(false)
  const [imageExportScope, setImageExportScope] = useState<'fullContent' | 'visibleArea'>('fullContent')

  /**
   * 获取有批注的题目索引列表
   */
  const getAnnotatedQuestionIndices = useCallback(() => {
    return questions.map((_, index) => index).filter(i => whiteboardData[i] && whiteboardData[i] !== '{}')
  }, [questions, whiteboardData])

  /**
   * 打开PDF导出选择对话框
   */
  const handleExportPdf = useCallback(() => {
    if (!courseware || questions.length === 0) return
    saveCurrentWhiteboard()
    setPdfExportMode('all')
    setSelectedQuestions(questions.map((_, i) => i))
    setPdfExportModalVisible(true)
  }, [courseware, questions, saveCurrentWhiteboard])

  /**
   * 执行PDF导出
   */
  const executePdfExport = useCallback(async () => {
    if (!courseware || !mainContentRef.current) return
    
    let indicesToExport: number[] = []
    if (pdfExportMode === 'all') {
      indicesToExport = questions.map((_, i) => i)
    } else if (pdfExportMode === 'annotated') {
      indicesToExport = getAnnotatedQuestionIndices()
      if (indicesToExport.length === 0) {
        message.warning('没有找到有批注的题目')
        return
      }
    } else {
      indicesToExport = selectedQuestions
      if (indicesToExport.length === 0) {
        message.warning('请至少选择一道题目')
        return
      }
    }
    
    setPdfExportModalVisible(false)
    setIsExportingPdf(true)
    message.loading({ content: `正在生成PDF (0/${indicesToExport.length})...`, key: 'pdf', duration: 0 })
    
    try {
      const screenshots: { index: number; dataUrl: string }[] = []
      const originalIndex = currentIndex
      
      for (let i = 0; i < indicesToExport.length; i++) {
        const qIndex = indicesToExport[i]
        setCurrentIndex(qIndex)
        await new Promise(resolve => setTimeout(resolve, CANVAS_CONFIG.EXPORT_SWITCH_DELAY))
        
        if (canvasRef.current && whiteboardData[qIndex]) {
          await canvasRef.current.loadJSON(whiteboardData[qIndex])
        } else if (canvasRef.current) {
          canvasRef.current.clear()
        }
        await new Promise(resolve => setTimeout(resolve, CANVAS_CONFIG.RENDER_DELAY))
        
        message.loading({ content: `正在生成PDF (${i + 1}/${indicesToExport.length})...`, key: 'pdf', duration: 0 })
        
        let dataUrl: string
        
        if (pdfExportScope === 'fullContent' && transformLayerRef.current && canvasRef.current && canvasWrapperRef.current) {
          const transformLayer = transformLayerRef.current
          
          let contentMinX = Infinity
          let contentMinY = Infinity
          let contentMaxX = -Infinity
          let contentMaxY = -Infinity
          
          canvasQuestions.forEach((item) => {
            const left = item.x
            const top = item.y
            const scaledWidth = item.width * item.scale
            const scaledHeight = item.height * item.scale
            
            contentMinX = Math.min(contentMinX, left)
            contentMinY = Math.min(contentMinY, top)
            contentMaxX = Math.max(contentMaxX, left + scaledWidth)
            contentMaxY = Math.max(contentMaxY, top + scaledHeight)
          })
          
          const strokeBounds = canvasRef.current.getContentBounds()
          if (strokeBounds.hasContent) {
            contentMinX = Math.min(contentMinX, strokeBounds.left)
            contentMinY = Math.min(contentMinY, strokeBounds.top)
            contentMaxX = Math.max(contentMaxX, strokeBounds.left + strokeBounds.width)
            contentMaxY = Math.max(contentMaxY, strokeBounds.top + strokeBounds.height)
          }
          
          if (contentMinX === Infinity) {
            contentMinX = 0
            contentMinY = 0
            contentMaxX = wrapperSize.width
            contentMaxY = wrapperSize.height
          }
          
          const padding = 20
          contentMinX = contentMinX - padding
          contentMinY = contentMinY - padding
          contentMaxX = contentMaxX + padding
          contentMaxY = contentMaxY + padding
          
          const exportWidth = contentMaxX - contentMinX
          const exportHeight = contentMaxY - contentMinY
          const exportScale = 2
          
          const offscreenContainer = document.createElement('div')
          offscreenContainer.style.cssText = `
            position: fixed;
            left: -99999px;
            top: 0;
            width: ${exportWidth}px;
            height: ${exportHeight}px;
            background: #FFFFFF;
            overflow: visible;
          `
          document.body.appendChild(offscreenContainer)
          
          const clonedTransformLayer = transformLayer.cloneNode(true) as HTMLElement
          clonedTransformLayer.style.cssText = `
            position: absolute;
            left: ${-contentMinX}px;
            top: ${-contentMinY}px;
            width: ${canvasSize.width}px;
            height: ${canvasSize.height}px;
            transform: none;
            background: #FFFFFF;
          `
          offscreenContainer.appendChild(clonedTransformLayer)
          
          await new Promise(resolve => setTimeout(resolve, 100))
          
          const questionCanvas = await html2canvas(offscreenContainer, {
            backgroundColor: '#FFFFFF',
            scale: exportScale,
            useCORS: true,
            allowTaint: true,
            logging: false,
            width: exportWidth,
            height: exportHeight
          })
          
          document.body.removeChild(offscreenContainer)
          
          const fabricCanvas = canvasRef.current.getFabricCanvas()
          let strokeCanvas: HTMLCanvasElement | null = null
          
          if (fabricCanvas && strokeBounds.hasContent) {
            const originalVPT = [...fabricCanvas.viewportTransform] as [number, number, number, number, number, number]
            const originalWidth = fabricCanvas.width
            const originalHeight = fabricCanvas.height
            const originalBgColor = fabricCanvas.backgroundColor
            
            fabricCanvas.setViewportTransform([1, 0, 0, 1, -contentMinX, -contentMinY])
            fabricCanvas.setDimensions({ width: exportWidth, height: exportHeight })
            fabricCanvas.backgroundColor = 'transparent'
            fabricCanvas.renderAll()
            
            strokeCanvas = document.createElement('canvas')
            strokeCanvas.width = exportWidth * exportScale
            strokeCanvas.height = exportHeight * exportScale
            const strokeCtx = strokeCanvas.getContext('2d')!
            strokeCtx.scale(exportScale, exportScale)
            strokeCtx.drawImage(fabricCanvas.lowerCanvasEl, 0, 0)
            
            fabricCanvas.backgroundColor = originalBgColor
            fabricCanvas.setViewportTransform(originalVPT as any)
            fabricCanvas.setDimensions({ width: originalWidth, height: originalHeight })
            fabricCanvas.renderAll()
          }
          
          const mergedCanvas = document.createElement('canvas')
          mergedCanvas.width = exportWidth * exportScale
          mergedCanvas.height = exportHeight * exportScale
          const mergedCtx = mergedCanvas.getContext('2d')!
          
          mergedCtx.drawImage(questionCanvas, 0, 0)
          if (strokeCanvas) {
            mergedCtx.drawImage(strokeCanvas, 0, 0)
          }
          
          dataUrl = mergedCanvas.toDataURL('image/png')
        } else {
          const canvas = await html2canvas(mainContentRef.current!, {
            backgroundColor: '#2EC4B6',
            scale: 2,
            useCORS: true,
            allowTaint: true,
            logging: false
          })
          dataUrl = canvas.toDataURL('image/png')
        }
        
        screenshots.push({
          index: qIndex + 1,
          dataUrl
        })
      }
      
      setCurrentIndex(originalIndex)
      
      const pdfData = {
        title: courseware.title,
        questions: screenshots.map(s => ({
          index: s.index,
          text: '',
          options: [],
          answer: '',
          whiteboard: s.dataUrl
        }))
      }
      
      if (window.electronAPI?.courseware?.exportPdf) {
        const result = await window.electronAPI.courseware.exportPdf(pdfData)
        if (result.success) {
          message.success({ content: 'PDF导出成功', key: 'pdf' })
        } else if (result.error !== '用户取消') {
          message.error({ content: result.error || '导出失败', key: 'pdf' })
        } else {
          message.destroy('pdf')
        }
      } else {
        message.error({ content: 'PDF导出功能暂不可用', key: 'pdf' })
      }
    } catch (error) {
      console.error('PDF导出失败:', error)
      message.error({ content: 'PDF导出失败', key: 'pdf' })
    } finally {
      setIsExportingPdf(false)
    }
  }, [courseware, questions, pdfExportMode, pdfExportScope, selectedQuestions, currentIndex, whiteboardData, getAnnotatedQuestionIndices, canvasQuestions, canvasSize, wrapperSize, mainContentRef, transformLayerRef, canvasWrapperRef, canvasRef, setCurrentIndex])

  /**
   * 导出试卷为Word
   */
  const handleExportWord = useCallback(async () => {
    if (!courseware || questions.length === 0) return
    
    setIsExportingWord(true)
    message.loading({ content: '正在生成Word文档...', key: 'word', duration: 0 })
    
    try {
      const wordData = {
        title: courseware.title,
        questions: questions.map((q, index) => ({
          index: index + 1,
          text: q.ocr_text || '',
          options: parseOptions(q.options),
          answer: q.answer || '',
          imageBase64: null
        }))
      }
      
      if (window.electronAPI?.courseware?.exportWord) {
        const result = await window.electronAPI.courseware.exportWord(wordData)
        if (result.success) {
          message.success({ content: 'Word文档导出成功', key: 'word' })
        } else if (result.error !== '用户取消') {
          message.error({ content: result.error || '导出失败', key: 'word' })
        } else {
          message.destroy('word')
        }
      } else {
        message.error({ content: 'Word导出功能暂不可用', key: 'word' })
      }
    } catch (error) {
      console.error('Word导出失败:', error)
      message.error({ content: 'Word导出失败', key: 'word' })
    } finally {
      setIsExportingWord(false)
    }
  }, [courseware, questions])

  /**
   * 打开图片导出选择对话框
   */
  const handleExportImage = useCallback(() => {
    if (!mainContentRef.current) return
    saveCurrentWhiteboard()
    setImageExportModalVisible(true)
  }, [saveCurrentWhiteboard, mainContentRef])

  /**
   * 执行图片导出
   */
  const executeImageExport = useCallback(async () => {
    if (!mainContentRef.current || !canvasWrapperRef.current) return
    
    setImageExportModalVisible(false)
    
    try {
      message.loading({ content: '正在生成图片...', key: 'exportImg', duration: 0 })
      
      let dataUrl: string
      
      if (imageExportScope === 'fullContent' && transformLayerRef.current && canvasRef.current && canvasWrapperRef.current) {
        const transformLayer = transformLayerRef.current
        
        let contentMinX = Infinity
        let contentMinY = Infinity
        let contentMaxX = -Infinity
        let contentMaxY = -Infinity
        
        canvasQuestions.forEach((item) => {
          const left = item.x
          const top = item.y
          const scaledWidth = item.width * item.scale
          const scaledHeight = item.height * item.scale
          
          contentMinX = Math.min(contentMinX, left)
          contentMinY = Math.min(contentMinY, top)
          contentMaxX = Math.max(contentMaxX, left + scaledWidth)
          contentMaxY = Math.max(contentMaxY, top + scaledHeight)
        })
        
        const strokeBounds = canvasRef.current.getContentBounds()
        if (strokeBounds.hasContent) {
          contentMinX = Math.min(contentMinX, strokeBounds.left)
          contentMinY = Math.min(contentMinY, strokeBounds.top)
          contentMaxX = Math.max(contentMaxX, strokeBounds.left + strokeBounds.width)
          contentMaxY = Math.max(contentMaxY, strokeBounds.top + strokeBounds.height)
        }
        
        if (contentMinX === Infinity) {
          contentMinX = 0
          contentMinY = 0
          contentMaxX = wrapperSize.width
          contentMaxY = wrapperSize.height
        }
        
        const padding = 20
        contentMinX = contentMinX - padding
        contentMinY = contentMinY - padding
        contentMaxX = contentMaxX + padding
        contentMaxY = contentMaxY + padding
        
        const exportWidth = contentMaxX - contentMinX
        const exportHeight = contentMaxY - contentMinY
        const scale = 2
        
        const offscreenContainer = document.createElement('div')
        offscreenContainer.style.cssText = `
          position: fixed;
          left: -99999px;
          top: 0;
          width: ${exportWidth}px;
          height: ${exportHeight}px;
          background: #FFFFFF;
          overflow: visible;
        `
        document.body.appendChild(offscreenContainer)
        
        const clonedTransformLayer = transformLayer.cloneNode(true) as HTMLElement
        clonedTransformLayer.style.cssText = `
          position: absolute;
          left: ${-contentMinX}px;
          top: ${-contentMinY}px;
          width: ${canvasSize.width}px;
          height: ${canvasSize.height}px;
          transform: none;
          background: #FFFFFF;
        `
        offscreenContainer.appendChild(clonedTransformLayer)
        
        await new Promise(resolve => setTimeout(resolve, 100))
        
        const questionCanvas = await html2canvas(offscreenContainer, {
          backgroundColor: '#FFFFFF',
          scale: scale,
          useCORS: true,
          allowTaint: true,
          logging: false,
          width: exportWidth,
          height: exportHeight
        })
        
        document.body.removeChild(offscreenContainer)
        
        const fabricCanvas = canvasRef.current.getFabricCanvas()
        let strokeCanvas: HTMLCanvasElement | null = null
        
        if (fabricCanvas && strokeBounds.hasContent) {
          const originalVPT = [...fabricCanvas.viewportTransform] as [number, number, number, number, number, number]
          const originalWidth = fabricCanvas.width
          const originalHeight = fabricCanvas.height
          const originalBgColor = fabricCanvas.backgroundColor
          
          fabricCanvas.setViewportTransform([1, 0, 0, 1, -contentMinX, -contentMinY])
          fabricCanvas.setDimensions({ width: exportWidth, height: exportHeight })
          fabricCanvas.backgroundColor = 'transparent'
          fabricCanvas.renderAll()
          
          strokeCanvas = document.createElement('canvas')
          strokeCanvas.width = exportWidth * scale
          strokeCanvas.height = exportHeight * scale
          const strokeCtx = strokeCanvas.getContext('2d')!
          strokeCtx.scale(scale, scale)
          strokeCtx.drawImage(fabricCanvas.lowerCanvasEl, 0, 0)
          
          fabricCanvas.backgroundColor = originalBgColor
          fabricCanvas.setViewportTransform(originalVPT as any)
          fabricCanvas.setDimensions({ width: originalWidth, height: originalHeight })
          fabricCanvas.renderAll()
        }
        
        const mergedCanvas = document.createElement('canvas')
        mergedCanvas.width = exportWidth * scale
        mergedCanvas.height = exportHeight * scale
        const mergedCtx = mergedCanvas.getContext('2d')!
        
        mergedCtx.drawImage(questionCanvas, 0, 0)
        if (strokeCanvas) {
          mergedCtx.drawImage(strokeCanvas, 0, 0)
        }
        
        dataUrl = mergedCanvas.toDataURL('image/png')
      } else {
        const canvas = await html2canvas(mainContentRef.current, {
          backgroundColor: '#2EC4B6',
          scale: 2,
          useCORS: true,
          allowTaint: true,
          logging: false
        })
        dataUrl = canvas.toDataURL('image/png')
      }
      
      const filename = `${courseware?.title || '课件'}_题目${currentIndex + 1}.png`
      
      const link = document.createElement('a')
      link.download = filename
      link.href = dataUrl
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      message.success({ content: '图片导出成功', key: 'exportImg' })
    } catch (error) {
      console.error('图片导出失败:', error)
      message.error({ content: '图片导出失败', key: 'exportImg' })
    }
  }, [courseware, currentIndex, imageExportScope, canvasQuestions, wrapperSize, canvasSize, mainContentRef, transformLayerRef, canvasWrapperRef, canvasRef])

  return {
    isExportingPdf,
    isExportingWord,
    pdfExportModalVisible,
    pdfExportMode,
    selectedQuestions,
    pdfExportScope,
    imageExportModalVisible,
    imageExportScope,
    setPdfExportModalVisible,
    setPdfExportMode,
    setSelectedQuestions,
    setPdfExportScope,
    setImageExportModalVisible,
    setImageExportScope,
    handleExportPdf,
    executePdfExport,
    handleExportWord,
    handleExportImage,
    executeImageExport,
    getAnnotatedQuestionIndices
  }
}
