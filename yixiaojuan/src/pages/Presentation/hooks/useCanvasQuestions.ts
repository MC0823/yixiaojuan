/**
 * 画布题目拖拽 Hook
 * 处理题目插入、拖拽、缩放等功能
 */
import { useState, useCallback, useEffect } from 'react'
import { App } from 'antd'
import type { WhiteboardCanvasRef } from '../../../components/canvas'

/**
 * 选项数据接口
 */
export interface OptionItem {
  label: string
  content: string
}

/**
 * 画布内容类型
 */
export type CanvasContentType = 'full' | 'stem' | 'option'

/**
 * 画布中的题目项
 */
export interface CanvasQuestionItem {
  id: string
  questionIndex: number
  questionText: string
  options: OptionItem[]
  answer?: string
  x: number
  y: number
  width: number
  height: number
  scale: number
  contentType: CanvasContentType
  optionLabel?: string
  optionContent?: string
}

interface Question {
  id: string
  ocr_text?: string
  options?: string
  answer?: string
}

/**
 * 解析选项
 */
export const parseOptions = (optionsStr?: string): OptionItem[] => {
  if (!optionsStr) return []
  try {
    const parsed = JSON.parse(optionsStr)
    if (Array.isArray(parsed)) {
      return parsed.map((item, index) => {
        if (typeof item === 'string') {
          return { label: String.fromCharCode(65 + index), content: item }
        }
        return item as OptionItem
      })
    }
    return []
  } catch {
    return []
  }
}

interface UseCanvasQuestionsOptions {
  questions: Question[]
  currentIndex: number
  canvasWrapperRef: React.RefObject<HTMLDivElement>
  canvasRef: React.RefObject<WhiteboardCanvasRef>
  canvasScale: number
  canvasOffset: { x: number; y: number }
  isDrawingEnabled: boolean
  setIsDrawingEnabled: (enabled: boolean) => void
}

interface UseCanvasQuestionsReturn {
  // 状态
  canvasQuestions: CanvasQuestionItem[]
  selectedCanvasQuestion: string | null
  isDraggingQuestion: boolean
  
  // 方法
  setCanvasQuestions: React.Dispatch<React.SetStateAction<CanvasQuestionItem[]>>
  setSelectedCanvasQuestion: React.Dispatch<React.SetStateAction<string | null>>
  insertQuestionToCanvas: (
    questionIndex: number, 
    x?: number, 
    y?: number,
    contentType?: CanvasContentType,
    optionData?: { label: string; content: string }
  ) => void
  removeQuestionFromCanvas: (id: string) => void
  updateCanvasQuestionPosition: (id: string, x: number, y: number) => void
  updateCanvasQuestionScale: (id: string, scale: number) => void
  
  // 事件处理
  handleDragStartQuestion: (e: React.DragEvent) => void
  handleDragStartStem: (e: React.DragEvent) => void
  handleDragStartOption: (e: React.DragEvent, option: OptionItem) => void
  handleDropOnCanvas: (e: React.DragEvent) => void
  handleDragOver: (e: React.DragEvent) => void
  handleCanvasQuestionDragStart: (e: React.MouseEvent, item: CanvasQuestionItem) => void
  handleCanvasQuestionDrag: (e: React.MouseEvent) => void
  handleCanvasQuestionDragEnd: () => void
  handleCanvasQuestionWheel: (e: React.WheelEvent, id: string, currentScale: number) => void
}

export function useCanvasQuestions({
  questions,
  currentIndex,
  canvasWrapperRef,
  canvasRef,
  canvasScale,
  canvasOffset,
  isDrawingEnabled,
  setIsDrawingEnabled
}: UseCanvasQuestionsOptions): UseCanvasQuestionsReturn {
  const { message } = App.useApp()
  
  const [canvasQuestions, setCanvasQuestions] = useState<CanvasQuestionItem[]>([])
  const [selectedCanvasQuestion, setSelectedCanvasQuestion] = useState<string | null>(null)
  const [isDraggingQuestion, setIsDraggingQuestion] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })

  /**
   * 切换到拖拽模式
   */
  const switchToDragMode = useCallback(() => {
    setIsDrawingEnabled(false)
    if (canvasRef.current) {
      canvasRef.current.setDrawingMode(false)
    }
  }, [canvasRef, setIsDrawingEnabled])

  /**
   * 插入题目到画布
   */
  const insertQuestionToCanvas = useCallback((
    questionIndex: number, 
    x?: number, 
    y?: number,
    contentType: CanvasContentType = 'full',
    optionData?: { label: string; content: string }
  ) => {
    const question = questions[questionIndex]
    if (!question) return
    
    // 对于完整题目，检查是否已在画布中
    if (contentType === 'full') {
      const existingItem = canvasQuestions.find(q => q.questionIndex === questionIndex && q.contentType === 'full')
      if (existingItem) {
        message.warning(`题目 ${questionIndex + 1} 已在画布中`)
        setSelectedCanvasQuestion(existingItem.id)
        switchToDragMode()
        return
      }
    }
    
    const options = parseOptions(question.options)
    
    // 计算默认位置
    const existingCount = canvasQuestions.length
    const defaultX = 50 + (existingCount % 3) * 420
    const defaultY = 50 + Math.floor(existingCount / 3) * 350
    
    const newItem: CanvasQuestionItem = {
      id: `canvas-q-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      questionIndex,
      questionText: question.ocr_text || '暂无题目内容',
      options,
      answer: question.answer,
      x: x ?? defaultX,
      y: y ?? defaultY,
      width: contentType === 'option' ? 300 : 400,
      height: contentType === 'option' ? 80 : 300,
      scale: 1,
      contentType,
      optionLabel: optionData?.label,
      optionContent: optionData?.content
    }
    
    setCanvasQuestions(prev => [...prev, newItem])
    setSelectedCanvasQuestion(newItem.id)
    switchToDragMode()
    
    const typeText = contentType === 'full' ? '题目' : contentType === 'stem' ? '题干' : `选项${optionData?.label}`
    message.success(`${typeText}已插入画布`)
  }, [questions, canvasQuestions, switchToDragMode])

  /**
   * 从画布删除题目
   */
  const removeQuestionFromCanvas = useCallback((id: string) => {
    setCanvasQuestions(prev => prev.filter(q => q.id !== id))
    if (selectedCanvasQuestion === id) {
      setSelectedCanvasQuestion(null)
    }
  }, [selectedCanvasQuestion])

  /**
   * 更新画布题目位置
   */
  const updateCanvasQuestionPosition = useCallback((id: string, x: number, y: number) => {
    setCanvasQuestions(prev => prev.map(q => 
      q.id === id ? { ...q, x, y } : q
    ))
  }, [])

  /**
   * 更新画布题目缩放
   */
  const updateCanvasQuestionScale = useCallback((id: string, scale: number) => {
    setCanvasQuestions(prev => prev.map(q => 
      q.id === id ? { ...q, scale: Math.max(0.5, Math.min(2, scale)) } : q
    ))
  }, [])

  /**
   * 拖拽开始 - 完整题目
   */
  const handleDragStartQuestion = useCallback((e: React.DragEvent) => {
    const dragData = JSON.stringify({
      type: 'full',
      questionIndex: currentIndex
    })
    e.dataTransfer.setData('application/json', dragData)
    e.dataTransfer.effectAllowed = 'copy'
  }, [currentIndex])

  /**
   * 拖拽开始 - 仅题干
   */
  const handleDragStartStem = useCallback((e: React.DragEvent) => {
    e.stopPropagation()
    const dragData = JSON.stringify({
      type: 'stem',
      questionIndex: currentIndex
    })
    e.dataTransfer.setData('application/json', dragData)
    e.dataTransfer.effectAllowed = 'copy'
  }, [currentIndex])

  /**
   * 拖拽开始 - 单个选项
   */
  const handleDragStartOption = useCallback((e: React.DragEvent, option: OptionItem) => {
    e.stopPropagation()
    const dragData = JSON.stringify({
      type: 'option',
      questionIndex: currentIndex,
      optionLabel: option.label,
      optionContent: option.content
    })
    e.dataTransfer.setData('application/json', dragData)
    e.dataTransfer.effectAllowed = 'copy'
  }, [currentIndex])

  /**
   * 拖拽结束 - 画布接收
   */
  const handleDropOnCanvas = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    
    const wrapper = canvasWrapperRef.current
    if (!wrapper) return
    
    const rect = wrapper.getBoundingClientRect()
    const x = (e.clientX - rect.left - canvasOffset.x) / canvasScale
    const y = (e.clientY - rect.top - canvasOffset.y) / canvasScale
    
    const jsonData = e.dataTransfer.getData('application/json')
    if (jsonData) {
      try {
        const data = JSON.parse(jsonData)
        const { type, questionIndex, optionLabel, optionContent } = data
        
        if (type === 'full') {
          insertQuestionToCanvas(questionIndex, x, y, 'full')
        } else if (type === 'stem') {
          insertQuestionToCanvas(questionIndex, x, y, 'stem')
        } else if (type === 'option') {
          insertQuestionToCanvas(questionIndex, x, y, 'option', { label: optionLabel, content: optionContent })
        }
        return
      } catch {
        // 解析失败，尝试旧格式
      }
    }
    
    const plainData = e.dataTransfer.getData('text/plain')
    const questionIndex = parseInt(plainData, 10)
    if (!isNaN(questionIndex)) {
      insertQuestionToCanvas(questionIndex, x, y, 'full')
    }
  }, [canvasOffset, canvasScale, insertQuestionToCanvas, canvasWrapperRef])

  /**
   * 拖拽进入画布区域
   */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  /**
   * 画布中题目拖拽开始
   */
  const handleCanvasQuestionDragStart = useCallback((e: React.MouseEvent, item: CanvasQuestionItem) => {
    if (isDrawingEnabled) return
    
    e.stopPropagation()
    e.preventDefault()
    setSelectedCanvasQuestion(item.id)
    setIsDraggingQuestion(true)
    
    const wrapper = canvasWrapperRef.current
    if (!wrapper) return
    
    const rect = wrapper.getBoundingClientRect()
    const mouseX = (e.clientX - rect.left - canvasOffset.x) / canvasScale
    const mouseY = (e.clientY - rect.top - canvasOffset.y) / canvasScale
    
    setDragOffset({
      x: mouseX - item.x,
      y: mouseY - item.y
    })
  }, [canvasScale, canvasOffset, isDrawingEnabled, canvasWrapperRef])

  /**
   * 画布中题目拖拽移动
   */
  const handleCanvasQuestionDrag = useCallback((e: React.MouseEvent) => {
    if (isDrawingEnabled) return
    if (!isDraggingQuestion || !selectedCanvasQuestion) return
    
    const wrapper = canvasWrapperRef.current
    if (!wrapper) return
    
    const rect = wrapper.getBoundingClientRect()
    const mouseX = (e.clientX - rect.left - canvasOffset.x) / canvasScale
    const mouseY = (e.clientY - rect.top - canvasOffset.y) / canvasScale
    
    const newX = mouseX - dragOffset.x
    const newY = mouseY - dragOffset.y
    
    updateCanvasQuestionPosition(selectedCanvasQuestion, newX, newY)
  }, [isDrawingEnabled, isDraggingQuestion, selectedCanvasQuestion, canvasScale, canvasOffset, dragOffset, updateCanvasQuestionPosition, canvasWrapperRef])

  /**
   * 画布中题目拖拽结束
   */
  const handleCanvasQuestionDragEnd = useCallback(() => {
    setIsDraggingQuestion(false)
  }, [])

  // 全局题目拖拽处理
  useEffect(() => {
    if (!isDraggingQuestion) return
    
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!selectedCanvasQuestion) return
      
      const wrapper = canvasWrapperRef.current
      if (!wrapper) return
      
      const rect = wrapper.getBoundingClientRect()
      const mouseX = (e.clientX - rect.left - canvasOffset.x) / canvasScale
      const mouseY = (e.clientY - rect.top - canvasOffset.y) / canvasScale
      
      const newX = mouseX - dragOffset.x
      const newY = mouseY - dragOffset.y
      
      updateCanvasQuestionPosition(selectedCanvasQuestion, newX, newY)
    }
    
    const handleGlobalMouseUp = () => {
      setIsDraggingQuestion(false)
    }
    
    window.addEventListener('mousemove', handleGlobalMouseMove)
    window.addEventListener('mouseup', handleGlobalMouseUp)
    
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove)
      window.removeEventListener('mouseup', handleGlobalMouseUp)
    }
  }, [isDraggingQuestion, selectedCanvasQuestion, canvasScale, canvasOffset, dragOffset, updateCanvasQuestionPosition, canvasWrapperRef])

  /**
   * 画布题目缩放 - 滚轮
   */
  const handleCanvasQuestionWheel = useCallback((e: React.WheelEvent, id: string, currentScale: number) => {
    e.stopPropagation()
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    updateCanvasQuestionScale(id, currentScale + delta)
  }, [updateCanvasQuestionScale])

  return {
    canvasQuestions,
    selectedCanvasQuestion,
    isDraggingQuestion,
    setCanvasQuestions,
    setSelectedCanvasQuestion,
    insertQuestionToCanvas,
    removeQuestionFromCanvas,
    updateCanvasQuestionPosition,
    updateCanvasQuestionScale,
    handleDragStartQuestion,
    handleDragStartStem,
    handleDragStartOption,
    handleDropOnCanvas,
    handleDragOver,
    handleCanvasQuestionDragStart,
    handleCanvasQuestionDrag,
    handleCanvasQuestionDragEnd,
    handleCanvasQuestionWheel
  }
}
