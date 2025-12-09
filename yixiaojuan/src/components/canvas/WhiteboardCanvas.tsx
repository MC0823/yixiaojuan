/**
 * 白板画布组件
 * 基于 Fabric.js 实现的可交互画布，支持绘制、标注、擦除等功能
 */
import { useRef, useEffect, useState, useCallback, useImperativeHandle, forwardRef } from 'react'
import { Canvas, PencilBrush, CircleBrush, SprayBrush, FabricImage, FabricText, Rect, Circle, Line } from 'fabric'
import styles from './WhiteboardCanvas.module.less'

/**
 * 画笔工具类型
 */
export type BrushType = 'pencil' | 'circle' | 'spray' | 'eraser'

/**
 * 形状类型
 */
export type ShapeType = 'rect' | 'circle' | 'line' | 'arrow' | 'text'

/**
 * 画布配置
 */
export interface CanvasConfig {
  width: number
  height: number
  backgroundColor?: string
}

/**
 * 画笔配置
 */
export interface BrushConfig {
  type: BrushType
  color: string
  width: number
}

/**
 * 画布导出选项
 */
export interface ExportOptions {
  format?: 'png' | 'jpeg'
  quality?: number
  multiplier?: number
}

/**
 * 组件属性
 */
export interface WhiteboardCanvasProps {
  width?: number
  height?: number
  backgroundImage?: string
  backgroundColor?: string
  readOnly?: boolean
  initialData?: string  // JSON 字符串
  onCanvasReady?: (canvas: Canvas) => void
  onChange?: (json: string) => void
}

/**
 * 内容边界
 */
export interface ContentBounds {
  left: number
  top: number
  width: number
  height: number
  hasContent: boolean
}

/**
 * 组件暴露的方法
 */
export interface WhiteboardCanvasRef {
  getCanvas: () => Canvas | null
  setBackgroundImage: (imageUrl: string) => Promise<void>
  setBrush: (config: BrushConfig) => void
  setDrawingMode: (enabled: boolean) => void
  addShape: (type: ShapeType, options?: object) => void
  addText: (text: string, options?: object) => void
  undo: () => boolean
  redo: () => boolean
  clear: () => void
  exportImage: (options?: ExportOptions) => string
  exportJSON: () => string
  loadJSON: (json: string) => Promise<void>
  /** 获取所有书写内容的边界范围 */
  getContentBounds: () => ContentBounds
  /** 导出包含所有书写内容的图片 */
  exportFullImage: (options?: ExportOptions) => string
}

/**
 * 默认画笔颜色
 */
export const DEFAULT_COLORS = [
  '#FF0000', // 红色
  '#FF6B00', // 橙色
  '#FFEB3B', // 黄色
  '#4CAF50', // 绿色
  '#2196F3', // 蓝色
  '#9C27B0', // 紫色
  '#000000', // 黑色
  '#FFFFFF', // 白色
]

/**
 * 白板画布组件
 */
const WhiteboardCanvas = forwardRef<WhiteboardCanvasRef, WhiteboardCanvasProps>((props, ref) => {
  const {
    width = 800,
    height = 600,
    backgroundImage,
    backgroundColor = '#FFFFFF',
    readOnly = false,
    initialData,
    onCanvasReady,
    onChange
  } = props

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fabricRef = useRef<Canvas | null>(null)
  const [isReady, setIsReady] = useState(false)
  
  // 使用 useRef 存储历史记录，避免闭包问题
  const historyStackRef = useRef<string[]>([])
  const historyIndexRef = useRef(-1)
  const isUndoRedo = useRef(false)

  /**
   * 保存历史记录
   */
  const saveHistory = useCallback(() => {
    if (isUndoRedo.current || !fabricRef.current) return

    const json = JSON.stringify(fabricRef.current.toJSON())
    // 截断当前索引之后的记录
    historyStackRef.current = historyStackRef.current.slice(0, historyIndexRef.current + 1)
    historyStackRef.current.push(json)
    // 限制历史记录数量
    if (historyStackRef.current.length > 50) {
      historyStackRef.current.shift()
    } else {
      historyIndexRef.current++
    }
  }, [])

  /**
   * 保存初始状态到历史记录
   */
  const saveInitialState = useCallback(() => {
    if (!fabricRef.current) return
    
    const json = JSON.stringify(fabricRef.current.toJSON())
    historyStackRef.current = [json]
    historyIndexRef.current = 0
  }, [])

  /**
   * 清除历史记录
   */
  const clearHistory = useCallback(() => {
    historyStackRef.current = []
    historyIndexRef.current = -1
  }, [])

  /**
   * 初始化画布
   */
  useEffect(() => {
    if (!canvasRef.current) return

    const canvas = new Canvas(canvasRef.current, {
      width,
      height,
      backgroundColor,
      selection: !readOnly,
      isDrawingMode: false
    })

    // 设置默认画笔
    canvas.freeDrawingBrush = new PencilBrush(canvas)
    canvas.freeDrawingBrush.color = '#FF0000'
    canvas.freeDrawingBrush.width = 3

    fabricRef.current = canvas
    setIsReady(true)

    // 保存初始状态
    setTimeout(() => {
      saveInitialState()
    }, 0)

    // 监听变化事件
    canvas.on('object:added', () => {
      saveHistory()
      if (onChange) {
        onChange(JSON.stringify(canvas.toJSON()))
      }
    })

    canvas.on('object:modified', () => {
      saveHistory()
      if (onChange) {
        onChange(JSON.stringify(canvas.toJSON()))
      }
    })

    canvas.on('object:removed', () => {
      saveHistory()
      if (onChange) {
        onChange(JSON.stringify(canvas.toJSON()))
      }
    })

    if (onCanvasReady) {
      onCanvasReady(canvas)
    }

    // 加载初始数据
    if (initialData) {
      canvas.loadFromJSON(JSON.parse(initialData)).then(() => {
        canvas.renderAll()
      })
    }

    return () => {
      canvas.dispose()
      fabricRef.current = null
    }
  }, [])

  /**
   * 更新尺寸
   */
  useEffect(() => {
    if (fabricRef.current) {
      fabricRef.current.setDimensions({ width, height })
    }
  }, [width, height])

  /**
   * 加载背景图片
   */
  useEffect(() => {
    if (fabricRef.current && backgroundImage) {
      FabricImage.fromURL(backgroundImage).then(img => {
        if (fabricRef.current) {
          // 缩放图片以适应画布
          const scaleX = width / (img.width || 1)
          const scaleY = height / (img.height || 1)
          const scale = Math.min(scaleX, scaleY)
          
          img.scale(scale)
          fabricRef.current.backgroundImage = img
          fabricRef.current.renderAll()
        }
      })
    }
  }, [backgroundImage, width, height])

  /**
   * 暴露方法给父组件
   */
  useImperativeHandle(ref, () => ({
    getCanvas: () => fabricRef.current,

    setBackgroundImage: async (imageUrl: string) => {
      if (!fabricRef.current) return
      
      const img = await FabricImage.fromURL(imageUrl)
      const scaleX = width / (img.width || 1)
      const scaleY = height / (img.height || 1)
      const scale = Math.min(scaleX, scaleY)
      
      img.scale(scale)
      fabricRef.current.backgroundImage = img
      fabricRef.current.renderAll()
    },

    setBrush: (config: BrushConfig) => {
      if (!fabricRef.current) return

      let brush
      switch (config.type) {
        case 'pencil':
          brush = new PencilBrush(fabricRef.current)
          break
        case 'circle':
          brush = new CircleBrush(fabricRef.current)
          break
        case 'spray':
          brush = new SprayBrush(fabricRef.current)
          break
        case 'eraser':
          brush = new PencilBrush(fabricRef.current)
          // 橡皮擦使用背景色
          config.color = backgroundColor
          break
        default:
          brush = new PencilBrush(fabricRef.current)
      }

      brush.color = config.color
      brush.width = config.width
      fabricRef.current.freeDrawingBrush = brush
    },

    setDrawingMode: (enabled: boolean) => {
      if (fabricRef.current) {
        fabricRef.current.isDrawingMode = enabled
      }
    },

    addShape: (type: ShapeType, options?: object) => {
      if (!fabricRef.current) return

      let shape
      const defaultOptions = {
        left: 100,
        top: 100,
        fill: 'transparent',
        stroke: '#FF0000',
        strokeWidth: 2,
        ...options
      }

      switch (type) {
        case 'rect':
          shape = new Rect({
            ...defaultOptions,
            width: 100,
            height: 80
          })
          break
        case 'circle':
          shape = new Circle({
            ...defaultOptions,
            radius: 50
          })
          break
        case 'line':
          shape = new Line([50, 50, 200, 200], {
            ...defaultOptions,
            fill: undefined
          })
          break
        default:
          return
      }

      fabricRef.current.add(shape)
      fabricRef.current.setActiveObject(shape)
      fabricRef.current.renderAll()
    },

    addText: (text: string, options?: object) => {
      if (!fabricRef.current) return

      const textObj = new FabricText(text, {
        left: 100,
        top: 100,
        fontSize: 20,
        fill: '#000000',
        ...options
      })

      fabricRef.current.add(textObj)
      fabricRef.current.setActiveObject(textObj)
      fabricRef.current.renderAll()
    },

    undo: () => {
      // 至少要有两个历史记录才能撤销（初始状态 + 至少一次操作）
      if (historyIndexRef.current <= 0 || !fabricRef.current) return false

      isUndoRedo.current = true
      const newIndex = historyIndexRef.current - 1
      
      try {
        const jsonData = JSON.parse(historyStackRef.current[newIndex])
        fabricRef.current.loadFromJSON(jsonData, () => {
          fabricRef.current?.renderAll()
          historyIndexRef.current = newIndex
          isUndoRedo.current = false
        })
        return true
      } catch (error) {
        console.error('上一步操作失败:', error)
        isUndoRedo.current = false
        return false
      }
    },

    redo: () => {
      if (historyIndexRef.current >= historyStackRef.current.length - 1 || !fabricRef.current) return false

      isUndoRedo.current = true
      const newIndex = historyIndexRef.current + 1
      
      try {
        const jsonData = JSON.parse(historyStackRef.current[newIndex])
        fabricRef.current.loadFromJSON(jsonData, () => {
          fabricRef.current?.renderAll()
          historyIndexRef.current = newIndex
          isUndoRedo.current = false
        })
        return true
      } catch (error) {
        console.error('下一步操作失败:', error)
        isUndoRedo.current = false
        return false
      }
    },

    clear: () => {
      if (fabricRef.current) {
        fabricRef.current.clear()
        fabricRef.current.backgroundColor = backgroundColor
        fabricRef.current.renderAll()
        // 清空白板时也清除历史记录
        clearHistory()
        // 保存新的初始状态
        setTimeout(() => {
          saveInitialState()
        }, 0)
      }
    },

    exportImage: (options?: ExportOptions) => {
      if (!fabricRef.current) return ''

      const format = options?.format || 'png'
      const quality = options?.quality || 1
      const multiplier = options?.multiplier || 1

      return fabricRef.current.toDataURL({
        format,
        quality,
        multiplier
      })
    },

    exportJSON: () => {
      if (!fabricRef.current) return '{}'
      return JSON.stringify(fabricRef.current.toJSON())
    },

    loadJSON: async (json: string) => {
      if (!fabricRef.current) return
      await fabricRef.current.loadFromJSON(JSON.parse(json))
      fabricRef.current.renderAll()
    },

    getContentBounds: (): ContentBounds => {
      if (!fabricRef.current) {
        return { left: 0, top: 0, width, height, hasContent: false }
      }

      const objects = fabricRef.current.getObjects()
      if (objects.length === 0) {
        return { left: 0, top: 0, width, height, hasContent: false }
      }

      // 计算所有对象的边界
      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity

      objects.forEach(obj => {
        const rect = obj.getBoundingRect()
        minX = Math.min(minX, rect.left)
        minY = Math.min(minY, rect.top)
        maxX = Math.max(maxX, rect.left + rect.width)
        maxY = Math.max(maxY, rect.top + rect.height)
      })

      // 添加一些padding
      const padding = 20
      minX = Math.max(0, minX - padding)
      minY = Math.max(0, minY - padding)
      maxX = maxX + padding
      maxY = maxY + padding

      return {
        left: minX,
        top: minY,
        width: maxX - minX,
        height: maxY - minY,
        hasContent: true
      }
    },

    exportFullImage: (options?: ExportOptions) => {
      if (!fabricRef.current) return ''

      const format = options?.format || 'png'
      const quality = options?.quality || 1
      const multiplier = options?.multiplier || 2

      const objects = fabricRef.current.getObjects()
      if (objects.length === 0) {
        // 没有内容，返回整个画布
        return fabricRef.current.toDataURL({ format, quality, multiplier })
      }

      // 计算所有对象的边界（包含画布内和画布外的内容）
      let minX = 0
      let minY = 0
      let maxX = width
      let maxY = height

      objects.forEach(obj => {
        const rect = obj.getBoundingRect()
        minX = Math.min(minX, rect.left)
        minY = Math.min(minY, rect.top)
        maxX = Math.max(maxX, rect.left + rect.width)
        maxY = Math.max(maxY, rect.top + rect.height)
      })

      // 添加padding
      const padding = 20
      minX = minX - padding
      minY = minY - padding
      maxX = maxX + padding
      maxY = maxY + padding

      // 导出指定区域
      return fabricRef.current.toDataURL({
        format,
        quality,
        multiplier,
        left: minX,
        top: minY,
        width: maxX - minX,
        height: maxY - minY
      })
    }
  }), [width, height, backgroundColor])

  return (
    <div className={styles.canvasContainer} style={{ width, height }}>
      <canvas ref={canvasRef} />
      {!isReady && <div className={styles.loading}>加载中...</div>}
    </div>
  )
})

WhiteboardCanvas.displayName = 'WhiteboardCanvas'

export default WhiteboardCanvas
