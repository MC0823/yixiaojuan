/**
 * 白板工具 Hook
 * 处理画布缩放、平移、工具切换、画笔设置等
 */
import { useState, useRef, useCallback, useEffect } from 'react'
import type { WhiteboardCanvasRef } from '../../../components/canvas'

// 画布配置常量
export const CANVAS_CONFIG = {
  MIN_SCALE: 0.25,
  MAX_SCALE: 4,
  EXTRA_SPACE: 500,
  MIN_WIDTH: 4000,
  MIN_HEIGHT: 3000,
  RENDER_DELAY: 100,
  EXPORT_SWITCH_DELAY: 300,
} as const

export type ToolType = 'pen' | 'eraser'

interface UseWhiteboardOptions {
  canvasRef: React.RefObject<WhiteboardCanvasRef>
  canvasWrapperRef: React.RefObject<HTMLDivElement>
  leftWidth: number
}

interface UseWhiteboardReturn {
  // 状态
  currentTool: ToolType
  penColor: string
  penWidth: number
  eraserSize: number
  canvasSize: { width: number; height: number }
  wrapperSize: { width: number; height: number }
  canvasScale: number
  canvasOffset: { x: number; y: number }
  isPanning: boolean
  isDrawingEnabled: boolean
  
  // 方法
  setCurrentTool: (tool: ToolType) => void
  setPenColor: (color: string) => void
  setPenWidth: (width: number) => void
  setEraserSize: (size: number) => void
  setCanvasScale: React.Dispatch<React.SetStateAction<number>>
  setCanvasOffset: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>
  
  // 处理函数
  handleToolChange: (tool: ToolType) => void
  handleEraserSizeChange: (size: number) => void
  handleColorChange: (color: string) => void
  handleWidthChange: (width: number) => void
  handleUndo: () => void
  handleRedo: () => void
  handleClear: () => void
  handleResetView: () => void
  handleZoomIn: () => void
  handleZoomOut: () => void
  handleCanvasWheel: (e: React.WheelEvent) => void
  handleCanvasMouseDown: (e: React.MouseEvent) => void
  handleCanvasMouseMove: (e: React.MouseEvent) => void
  handleCanvasMouseUp: () => void
  handleTouchStart: (e: React.TouchEvent) => void
  handleTouchMove: (e: React.TouchEvent) => void
  toggleDrawingMode: () => void
  handleCanvasReady: () => void
}

export function useWhiteboard({ 
  canvasRef, 
  canvasWrapperRef, 
  leftWidth 
}: UseWhiteboardOptions): UseWhiteboardReturn {
  // 白板工具状态
  const [currentTool, setCurrentTool] = useState<ToolType>('pen')
  const [penColor, setPenColor] = useState('#FF0000')
  const [penWidth, setPenWidth] = useState(3)
  const [eraserSize, setEraserSize] = useState(20)
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 })
  const [wrapperSize, setWrapperSize] = useState({ width: 800, height: 600 })
  
  // 画布缩放和平移状态
  const [canvasScale, setCanvasScale] = useState(1)
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const lastPanPoint = useRef({ x: 0, y: 0 })
  
  // 画笔开关状态
  const [isDrawingEnabled, setIsDrawingEnabled] = useState(true)
  
  // 触摸手势
  const touchStartDistance = useRef(0)
  const touchStartScale = useRef(1)
  const touchStartOffset = useRef({ x: 0, y: 0 })
  const lastTouchCenter = useRef({ x: 0, y: 0 })
  
  const isInitialized = useRef(false)

  /**
   * 更新画布尺寸并初始化居中
   */
  useEffect(() => {
    const updateCanvasSize = () => {
      if (canvasWrapperRef.current) {
        const rect = canvasWrapperRef.current.getBoundingClientRect()
        const minScale = CANVAS_CONFIG.MIN_SCALE
        const extraSpace = CANVAS_CONFIG.EXTRA_SPACE
        const newWidth = Math.max(rect.width / minScale + extraSpace, CANVAS_CONFIG.MIN_WIDTH)
        const newHeight = Math.max(rect.height / minScale + extraSpace, CANVAS_CONFIG.MIN_HEIGHT)
        
        setCanvasSize({ width: newWidth, height: newHeight })
        setWrapperSize({ width: rect.width, height: rect.height })
        
        if (!isInitialized.current) {
          isInitialized.current = true
          setCanvasOffset({ x: 0, y: 0 })
        }
      }
    }
    
    updateCanvasSize()
    window.addEventListener('resize', updateCanvasSize)
    const timer = setTimeout(updateCanvasSize, CANVAS_CONFIG.RENDER_DELAY)
    
    return () => {
      window.removeEventListener('resize', updateCanvasSize)
      clearTimeout(timer)
    }
  }, [leftWidth, canvasWrapperRef])

  /**
   * 同步缩放和偏移到 Fabric.js
   */
  useEffect(() => {
    if (canvasRef.current) {
      canvasRef.current.setViewportTransform(canvasScale, canvasOffset.x, canvasOffset.y)
    }
  }, [canvasScale, canvasOffset, canvasRef])

  // 工具切换
  const handleToolChange = useCallback((tool: ToolType) => {
    const newTool = (tool === 'eraser' && currentTool === 'eraser') ? 'pen' : tool
    setCurrentTool(newTool)
    if (canvasRef.current) {
      setIsDrawingEnabled(true)
      canvasRef.current.setDrawingMode(true)
      if (newTool === 'pen') {
        canvasRef.current.setBrush({ type: 'pencil', color: penColor, width: penWidth })
      } else {
        canvasRef.current.setBrush({ type: 'eraser', color: '#FFFFFF', width: eraserSize })
      }
    }
  }, [penColor, penWidth, currentTool, eraserSize, canvasRef])

  const handleEraserSizeChange = useCallback((size: number) => {
    setEraserSize(size)
    if (canvasRef.current && currentTool === 'eraser') {
      canvasRef.current.setBrush({ type: 'eraser', color: '#FFFFFF', width: size })
    }
  }, [currentTool, canvasRef])

  const handleColorChange = useCallback((color: string) => {
    setPenColor(color)
    setCurrentTool('pen')
    if (canvasRef.current) {
      canvasRef.current.setBrush({ type: 'pencil', color, width: penWidth })
    }
  }, [penWidth, canvasRef])

  const handleWidthChange = useCallback((width: number) => {
    setPenWidth(width)
    setCurrentTool('pen')
    if (canvasRef.current) {
      canvasRef.current.setBrush({ type: 'pencil', color: penColor, width })
    }
  }, [penColor, canvasRef])

  const handleUndo = useCallback(() => {
    canvasRef.current?.undo()
  }, [canvasRef])
  
  const handleRedo = useCallback(() => {
    canvasRef.current?.redo()
  }, [canvasRef])
  
  const handleClear = useCallback(() => canvasRef.current?.clear(), [canvasRef])

  // 缩放和视图控制
  const handleResetView = useCallback(() => {
    setCanvasScale(1)
    setCanvasOffset({ x: 0, y: 0 })
  }, [])

  const handleZoomIn = useCallback(() => {
    const wrapper = canvasWrapperRef.current
    if (!wrapper) {
      setCanvasScale(prev => Math.min(prev * 1.2, CANVAS_CONFIG.MAX_SCALE))
      return
    }
    
    const rect = wrapper.getBoundingClientRect()
    const centerX = rect.width / 2
    const centerY = rect.height / 2
    
    setCanvasScale(prevScale => {
      const newScale = Math.min(prevScale * 1.2, CANVAS_CONFIG.MAX_SCALE)
      const contentX = (centerX - canvasOffset.x) / prevScale
      const contentY = (centerY - canvasOffset.y) / prevScale
      const newOffsetX = centerX - contentX * newScale
      const newOffsetY = centerY - contentY * newScale
      setCanvasOffset({ x: newOffsetX, y: newOffsetY })
      return newScale
    })
  }, [canvasOffset, canvasWrapperRef])

  const handleZoomOut = useCallback(() => {
    const wrapper = canvasWrapperRef.current
    if (!wrapper) {
      setCanvasScale(prev => Math.max(prev / 1.2, CANVAS_CONFIG.MIN_SCALE))
      return
    }
    
    const rect = wrapper.getBoundingClientRect()
    const centerX = rect.width / 2
    const centerY = rect.height / 2
    
    setCanvasScale(prevScale => {
      const newScale = Math.max(prevScale / 1.2, CANVAS_CONFIG.MIN_SCALE)
      const contentX = (centerX - canvasOffset.x) / prevScale
      const contentY = (centerY - canvasOffset.y) / prevScale
      const newOffsetX = centerX - contentX * newScale
      const newOffsetY = centerY - contentY * newScale
      setCanvasOffset({ x: newOffsetX, y: newOffsetY })
      return newScale
    })
  }, [canvasOffset, canvasWrapperRef])

  // 画布鼠标滚轮缩放
  const handleCanvasWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    const wrapper = canvasWrapperRef.current
    if (!wrapper) return
    
    const rect = wrapper.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    
    setCanvasScale(prevScale => {
      const newScale = Math.min(Math.max(prevScale * delta, CANVAS_CONFIG.MIN_SCALE), CANVAS_CONFIG.MAX_SCALE)
      const contentX = (mouseX - canvasOffset.x) / prevScale
      const contentY = (mouseY - canvasOffset.y) / prevScale
      const newOffsetX = mouseX - contentX * newScale
      const newOffsetY = mouseY - contentY * newScale
      setCanvasOffset({ x: newOffsetX, y: newOffsetY })
      return newScale
    })
  }, [canvasOffset, canvasWrapperRef])

  // 画布鼠标事件
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (!isDrawingEnabled || e.button === 1 || e.altKey) {
      e.preventDefault()
      e.stopPropagation()
      setIsPanning(true)
      lastPanPoint.current = { x: e.clientX, y: e.clientY }
    }
  }, [isDrawingEnabled])

  // 全局拖拽处理
  useEffect(() => {
    if (!isPanning) return
    
    const handleGlobalMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - lastPanPoint.current.x
      const dy = e.clientY - lastPanPoint.current.y
      setCanvasOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }))
      lastPanPoint.current = { x: e.clientX, y: e.clientY }
    }
    
    const handleGlobalMouseUp = () => {
      setIsPanning(false)
    }
    
    window.addEventListener('mousemove', handleGlobalMouseMove)
    window.addEventListener('mouseup', handleGlobalMouseUp)
    
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove)
      window.removeEventListener('mouseup', handleGlobalMouseUp)
    }
  }, [isPanning])

  const handleCanvasMouseMove = useCallback((_e: React.MouseEvent) => {
    // 拖拽已经在全局事件中处理
  }, [])

  const handleCanvasMouseUp = useCallback(() => {
    setIsPanning(false)
  }, [])

  // 触摸手势支持
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const touch1 = e.touches[0]
      const touch2 = e.touches[1]
      const distance = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY)
      touchStartDistance.current = distance
      touchStartScale.current = canvasScale
      touchStartOffset.current = canvasOffset
      lastTouchCenter.current = {
        x: (touch1.clientX + touch2.clientX) / 2,
        y: (touch1.clientY + touch2.clientY) / 2
      }
    }
  }, [canvasScale, canvasOffset])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault()
      const wrapper = canvasWrapperRef.current
      if (!wrapper) return
      
      const rect = wrapper.getBoundingClientRect()
      const touch1 = e.touches[0]
      const touch2 = e.touches[1]
      const distance = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY)
      const newScale = Math.min(Math.max(
        (distance / touchStartDistance.current) * touchStartScale.current,
        CANVAS_CONFIG.MIN_SCALE
      ), CANVAS_CONFIG.MAX_SCALE)
      
      const centerX = (touch1.clientX + touch2.clientX) / 2
      const centerY = (touch1.clientY + touch2.clientY) / 2
      
      const touchCenterInContainer = {
        x: centerX - rect.left,
        y: centerY - rect.top
      }
      
      const contentX = (touchCenterInContainer.x - touchStartOffset.current.x) / touchStartScale.current
      const contentY = (touchCenterInContainer.y - touchStartOffset.current.y) / touchStartScale.current
      
      const newOffsetX = touchCenterInContainer.x - contentX * newScale
      const newOffsetY = touchCenterInContainer.y - contentY * newScale
      
      const dx = centerX - lastTouchCenter.current.x
      const dy = centerY - lastTouchCenter.current.y
      
      setCanvasScale(newScale)
      setCanvasOffset({ x: newOffsetX + dx, y: newOffsetY + dy })
      lastTouchCenter.current = { x: centerX, y: centerY }
    }
  }, [canvasWrapperRef])

  // 切换手掌/画笔模式
  const toggleDrawingMode = useCallback(() => {
    const newEnabled = !isDrawingEnabled
    setIsDrawingEnabled(newEnabled)
    if (canvasRef.current) {
      canvasRef.current.setDrawingMode(newEnabled)
      if (newEnabled) {
        if (currentTool === 'eraser') {
          canvasRef.current.setBrush({ type: 'eraser', color: '#FFFFFF', width: eraserSize })
        } else {
          canvasRef.current.setBrush({ type: 'pencil', color: penColor, width: penWidth })
        }
      }
    }
  }, [isDrawingEnabled, penColor, penWidth, currentTool, eraserSize, canvasRef])

  const handleCanvasReady = useCallback(() => {
    if (canvasRef.current) {
      canvasRef.current.setDrawingMode(true)
      canvasRef.current.setBrush({ type: 'pencil', color: penColor, width: penWidth })
      canvasRef.current.setSelection(false)
    }
  }, [penColor, penWidth, canvasRef])

  return {
    currentTool,
    penColor,
    penWidth,
    eraserSize,
    canvasSize,
    wrapperSize,
    canvasScale,
    canvasOffset,
    isPanning,
    isDrawingEnabled,
    setCurrentTool,
    setPenColor,
    setPenWidth,
    setEraserSize,
    setCanvasScale,
    setCanvasOffset,
    handleToolChange,
    handleEraserSizeChange,
    handleColorChange,
    handleWidthChange,
    handleUndo,
    handleRedo,
    handleClear,
    handleResetView,
    handleZoomIn,
    handleZoomOut,
    handleCanvasWheel,
    handleCanvasMouseDown,
    handleCanvasMouseMove,
    handleCanvasMouseUp,
    handleTouchStart,
    handleTouchMove,
    toggleDrawingMode,
    handleCanvasReady
  }
}
