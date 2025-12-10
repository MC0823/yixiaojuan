/**
 * 全屏讲解课件页面
 * 左侧：题目卡片展示
 * 右侧：白板书写区
 */
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button, Spin, message, Tooltip, Slider, Popover, Divider, Input, Tag, Modal, Checkbox } from 'antd'
import {
  FullscreenExitOutlined,
  FullscreenOutlined,
  LeftOutlined,
  RightOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  EditOutlined,
  ClearOutlined,
  UndoOutlined,
  RedoOutlined,
  PictureOutlined,
  BgColorsOutlined,
  ColumnWidthOutlined,
  CheckOutlined,
  FilePdfOutlined,
  FileWordOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  FormOutlined,
  VideoCameraOutlined,
  PauseCircleOutlined,
  PlaySquareOutlined,
  AudioOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
  DragOutlined,
  PlusOutlined,
  DeleteOutlined,
  HolderOutlined
} from '@ant-design/icons'
import Icon from '@ant-design/icons'
import html2canvas from 'html2canvas'

// 自定义橡皮擦图标
const EraserSvg = () => (
  <svg viewBox="0 0 1024 1024" width="1em" height="1em" fill="currentColor">
    <path d="M893.44 344.64L679.36 130.56a64 64 0 0 0-90.56 0L124.16 595.2a64 64 0 0 0 0 90.56l142.72 142.72a64 64 0 0 0 45.28 18.72H608a32 32 0 0 0 0-64H339.2l-169.6-169.6L608 175.2l214.24 214.24-293.76 293.76a32 32 0 0 0 45.28 45.28l319.68-319.68a64 64 0 0 0 0-90.56zM256 847.2h640a32 32 0 0 0 0-64H256a32 32 0 0 0 0 64z" />
  </svg>
)
const EraserIcon = (props: any) => <Icon component={EraserSvg} {...props} />
import { WhiteboardCanvas, type WhiteboardCanvasRef, DEFAULT_COLORS } from '../../components/canvas'
import { useKeyboardShortcuts, type ShortcutConfig } from '../../hooks'
import styles from './Presentation.module.less'

// 画布配置常量
const CANVAS_CONFIG = {
  MIN_SCALE: 0.25,
  MAX_SCALE: 4,
  EXTRA_SPACE: 500,
  MIN_WIDTH: 4000,
  MIN_HEIGHT: 3000,
  RENDER_DELAY: 100,      // 渲染延迟时间(ms)
  EXPORT_SWITCH_DELAY: 300,  // 导出时切换题目延迟(ms)
} as const

/**
 * 选项数据接口
 */
interface OptionItem {
  label: string
  content: string
}

/**
 * 题目数据接口
 */
interface QuestionData {
  id: string
  courseware_id: string
  order_index: number
  original_image?: string
  processed_image?: string
  ocr_text?: string
  answer?: string
  options?: string // JSON字符串
}

/**
 * 课件数据接口
 */
interface CoursewareData {
  id: string
  title: string
  description?: string
}

/**
 * 工具类型
 */
type ToolType = 'pen' | 'eraser'

/**
 * 画布内容类型
 * - 'full': 完整题目（题干+选项）
 * - 'stem': 仅题干
 * - 'option': 单个选项
 */
type CanvasContentType = 'full' | 'stem' | 'option'

/**
 * 画布中的题目项
 */
interface CanvasQuestionItem {
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
  /** 内容类型：完整题目、仅题干、单个选项 */
  contentType: CanvasContentType
  /** 当 contentType 为 'option' 时，存储选项标签 */
  optionLabel?: string
  /** 当 contentType 为 'option' 时，存储选项内容 */
  optionContent?: string
}

/**
 * 解析选项
 */
const parseOptions = (optionsStr?: string): OptionItem[] => {
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

/**
 * 规范化答案对比（忽略大小写、空格、排序）
 */
const normalizeAnswer = (ans: string): string => {
  return ans.toUpperCase().replace(/[\s,，、]/g, '').split('').sort().join('')
}

function PresentationPage() {
  const { id: coursewareId } = useParams<{ id: string }>()
  const navigate = useNavigate()

  // 配置 message 显示在页面底部，避免遮挡工具栏
  useEffect(() => {
    message.config({
      top: window.innerHeight - 100,
      duration: 2,
      maxCount: 3
    })
    return () => {
      message.config({ top: 8 }) // 恢复默认
    }
  }, [])
  
  // 课件和题目数据
  const [courseware, setCourseware] = useState<CoursewareData | null>(null)
  const [questions, setQuestions] = useState<QuestionData[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  
  // 答案显示状态
  const [showAnswer, setShowAnswer] = useState(false)
  
  // 分隔线拖拽
  const [leftWidth, setLeftWidth] = useState(45) // 百分比
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  
  // 白板工具状态
  const canvasRef = useRef<WhiteboardCanvasRef>(null)
  const [currentTool, setCurrentTool] = useState<ToolType>('pen')
  const [penColor, setPenColor] = useState('#FF0000')
  const [penWidth, setPenWidth] = useState(3)
  const [eraserSize, setEraserSize] = useState(20) // 橡皮擦大小
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 })
  const [wrapperSize, setWrapperSize] = useState({ width: 800, height: 600 }) // 容器尺寸，用于画布
  
  // 画布缩放和平移状态
  const [canvasScale, setCanvasScale] = useState(1)
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const lastPanPoint = useRef({ x: 0, y: 0 })
  const canvasWrapperRef = useRef<HTMLDivElement>(null)
    const transformLayerRef = useRef<HTMLDivElement>(null) // 变换层ref，用于导出包含题目+笔迹
  
  // 画笔开关状态（关闭时可拖拽画布）
  const [isDrawingEnabled, setIsDrawingEnabled] = useState(true)
  
  // 白板数据存储（每道题独立）
  const [whiteboardData, setWhiteboardData] = useState<Record<number, string>>({})

  // 主内容区ref（用于截图导出）
  const mainContentRef = useRef<HTMLDivElement>(null)
  
  // 导出PDF状态
  const [isExportingPdf, setIsExportingPdf] = useState(false)
  // 导出Word状态
  const [isExportingWord, setIsExportingWord] = useState(false)
  // PDF导出选择对话框状态
  const [pdfExportModalVisible, setPdfExportModalVisible] = useState(false)
  const [pdfExportMode, setPdfExportMode] = useState<'all' | 'annotated' | 'selected'>('all')
  const [selectedQuestions, setSelectedQuestions] = useState<number[]>([])
  // PDF导出内容范围：'fullContent' = 全部书写内容, 'visibleArea' = 仅可见区域
  const [pdfExportScope, setPdfExportScope] = useState<'fullContent' | 'visibleArea'>('fullContent')
  
  // 图片导出选择对话框状态
  const [imageExportModalVisible, setImageExportModalVisible] = useState(false)
  const [imageExportScope, setImageExportScope] = useState<'fullContent' | 'visibleArea'>('fullContent')
  
  // 批改模式状态
  const [isGradingMode, setIsGradingMode] = useState(false)
  const [studentAnswers, setStudentAnswers] = useState<Record<number, string>>({})
  const [gradingResults, setGradingResults] = useState<Record<number, boolean | null>>({})

  // 录制状态
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [hasRecording, setHasRecording] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordedChunksRef = useRef<Blob[]>([])
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // 画布中的题目状态
  const [canvasQuestions, setCanvasQuestions] = useState<CanvasQuestionItem[]>([])
  const [selectedCanvasQuestion, setSelectedCanvasQuestion] = useState<string | null>(null)
  const [isDraggingQuestion, setIsDraggingQuestion] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })

  // 白板全屏状态
  const [isWhiteboardFullscreen, setIsWhiteboardFullscreen] = useState(false)
  const [isLeftPanelVisible, setIsLeftPanelVisible] = useState(false)

  // 当前题目（使用 useMemo 优化）
  const currentQuestion = useMemo(() => questions[currentIndex], [questions, currentIndex])
  const currentOptions = useMemo(() => parseOptions(currentQuestion?.options), [currentQuestion?.options])

  /**
   * 加载课件数据
   */
  useEffect(() => {
    const loadData = async () => {
      if (!coursewareId || !window.electronAPI) return
      
      setIsLoading(true)
      try {
        const coursewareResult = await window.electronAPI.courseware.getById(coursewareId)
        if (!coursewareResult.success || !coursewareResult.data) {
          throw new Error(coursewareResult.error || '课件不存在')
        }
        setCourseware(coursewareResult.data)
        
        const questionsResult = await window.electronAPI.question.getByCourseware(coursewareId)
        if (questionsResult.success && questionsResult.data) {
          setQuestions(questionsResult.data)
        }
      } catch (error) {
        console.error('加载课件失败:', error)
        message.error('加载课件失败')
        navigate('/')
      } finally {
        setIsLoading(false)
      }
    }
    
    loadData()
  }, [coursewareId, navigate])

  /**
   * 更新画布尺寸并初始化居中 - 根据最小缩放比例计算，确保任何缩放级别下都有足够的书写空间
   */
  const isInitialized = useRef(false)
  
  useEffect(() => {
    const updateCanvasSize = () => {
      if (canvasWrapperRef.current) {
        const rect = canvasWrapperRef.current.getBoundingClientRect()
        const minScale = CANVAS_CONFIG.MIN_SCALE
        const extraSpace = CANVAS_CONFIG.EXTRA_SPACE
        const newWidth = Math.max(rect.width / minScale + extraSpace, CANVAS_CONFIG.MIN_WIDTH)
        const newHeight = Math.max(rect.height / minScale + extraSpace, CANVAS_CONFIG.MIN_HEIGHT)
        
        setCanvasSize({ width: newWidth, height: newHeight })
        // 更新容器尺寸，用于画布
        setWrapperSize({ width: rect.width, height: rect.height })
        
        // 初始化时设置偏移为(0, 0)，确保画布从左上角开始，无书写边界
        if (!isInitialized.current) {
          isInitialized.current = true
          setCanvasOffset({ x: 0, y: 0 })
        }
      }
    }
    
    updateCanvasSize()
    window.addEventListener('resize', updateCanvasSize)
    
    // 延迟更新确保布局完成
    const timer = setTimeout(updateCanvasSize, CANVAS_CONFIG.RENDER_DELAY)
    
    return () => {
      window.removeEventListener('resize', updateCanvasSize)
      clearTimeout(timer)
    }
  }, [leftWidth])

  /**
   * 保存当前白板数据
   */
  const saveCurrentWhiteboard = useCallback(() => {
    if (canvasRef.current) {
      const json = canvasRef.current.exportJSON()
      setWhiteboardData(prev => ({
        ...prev,
        [currentIndex]: json
      }))
    }
  }, [currentIndex])

  /**
   * 切换题目
   */
  const handleQuestionChange = useCallback((newIndex: number) => {
    if (newIndex < 0 || newIndex >= questions.length) return
    
    saveCurrentWhiteboard()
    setCurrentIndex(newIndex)
    setShowAnswer(false)
    
    setTimeout(() => {
      if (canvasRef.current && whiteboardData[newIndex]) {
        canvasRef.current.loadJSON(whiteboardData[newIndex])
      } else if (canvasRef.current) {
        canvasRef.current.clear()
      }
    }, CANVAS_CONFIG.RENDER_DELAY)
  }, [questions.length, saveCurrentWhiteboard, whiteboardData])

  const handlePrev = useCallback(() => {
    handleQuestionChange(currentIndex - 1)
  }, [currentIndex, handleQuestionChange])

  const handleNext = useCallback(() => {
    handleQuestionChange(currentIndex + 1)
  }, [currentIndex, handleQuestionChange])

  const toggleAnswer = useCallback(() => {
    setShowAnswer(prev => !prev)
  }, [])

  // 切换批改模式
  const toggleGradingMode = useCallback(() => {
    setIsGradingMode(prev => {
      if (prev) {
        // 退出批改模式时清空结果
        setStudentAnswers({})
        setGradingResults({})
      }
      return !prev
    })
  }, [])

  // 设置当前题目的学生答案
  const setStudentAnswer = useCallback((answer: string) => {
    setStudentAnswers(prev => ({
      ...prev,
      [currentIndex]: answer.toUpperCase().trim()
    }))
    // 清除之前的判分结果
    setGradingResults(prev => ({
      ...prev,
      [currentIndex]: null
    }))
  }, [currentIndex])

  // 判分当前题目
  const gradeCurrentQuestion = useCallback(() => {
    const studentAnswer = studentAnswers[currentIndex] || ''
    const correctAnswer = currentQuestion?.answer || ''
    
    if (!studentAnswer) {
      message.warning('请先输入学生答案')
      return
    }
    
    if (!correctAnswer) {
      message.warning('该题目没有设置标准答案')
      return
    }
    
    const isCorrect = normalizeAnswer(studentAnswer) === normalizeAnswer(correctAnswer)
    setGradingResults(prev => ({
      ...prev,
      [currentIndex]: isCorrect
    }))
    
    if (isCorrect) {
      message.success('回答正确! ✔')
    } else {
      message.error(`回答错误! 正确答案: ${correctAnswer}`)
    }
  }, [currentIndex, studentAnswers, currentQuestion])

  /**
   * 格式化录制时间
   */
  const formatRecordingTime = useCallback((seconds: number): string => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }, [])

  /**
   * 开始录制（应用窗口+音频）
   */
  const startRecording = useCallback(async () => {
    try {
      // 通过 Electron IPC 获取窗口源
      if (!window.electronAPI?.screen?.getSources) {
        message.info({ content: '录制功能仅在桌面应用中可用', duration: 2 })
        return
      }

      const sourcesResult = await window.electronAPI.screen.getSources()
      if (!sourcesResult.success || !sourcesResult.data || sourcesResult.data.length === 0) {
        message.info({ content: '获取屏幕源失败', duration: 2 })
        return
      }

      // 查找当前应用窗口（易小卷）- 优先匹配窗口类型
      type SourceItem = { id: string; name: string; type: 'window' | 'screen' }
      const sources = sourcesResult.data as SourceItem[]
      
      const appWindow = sources.find(s => 
        s.type === 'window' && (
          s.name.includes('易小卷') || 
          s.name.includes('课件') ||
          s.name.includes('试卷')
        )
      ) || sources.find(s => s.type === 'window') || sources[0]
      
      // 使用 Electron 的屏幕捕获 API
      const displayStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: appWindow.id,
            minWidth: 1280,
            maxWidth: 1920,
            minHeight: 720,
            maxHeight: 1080
          }
        } as MediaTrackConstraints
      })

      // 尝试获取麦克风音频
      let audioStream: MediaStream | null = null
      try {
        audioStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      } catch {
        console.log('无法获取麦克风，将只录制视频')
      }

      // 合并音视频轨道
      const tracks = [...displayStream.getTracks()]
      if (audioStream) {
        audioStream.getAudioTracks().forEach(track => tracks.push(track))
      }

      const combinedStream = new MediaStream(tracks)
      streamRef.current = combinedStream

      // 创建 MediaRecorder
      const options = { mimeType: 'video/webm;codecs=vp9,opus' }
      const mediaRecorder = new MediaRecorder(combinedStream, options)
      mediaRecorderRef.current = mediaRecorder
      recordedChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        setHasRecording(true)
      }

      // 监听流结束
      displayStream.getVideoTracks()[0].onended = () => {
        if (isRecording) {
          stopRecording()
        }
      }

      mediaRecorder.start(1000) // 每秒收集一次数据
      setIsRecording(true)
      setRecordingTime(0)

      // 开始计时
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)
    } catch (error) {
      console.error('录制启动失败:', error)
      message.info({ content: '录制启动失败，请检查权限设置', duration: 2 })
    }
  }, [isRecording])

  /**
   * 停止录制
   */
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }

    // 停止所有轨道
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }

    // 清除计时器
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }

    setIsRecording(false)
  }, [])

  /**
   * 切换录制状态
   */
  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording()
    } else {
      startRecording()
    }
  }, [isRecording, startRecording, stopRecording])

  /**
   * 导出视频 (MP4)
   */
  const handleExportVideo = useCallback(async () => {
    if (recordedChunksRef.current.length === 0) {
      message.info({ content: '没有可导出的录制内容', duration: 2 })
      return
    }

    try {
      const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' })
      const arrayBuffer = await blob.arrayBuffer()
      const filename = `${courseware?.title || '课件'}_录制_${new Date().toLocaleDateString().replace(/\//g, '-')}.mp4`
      
      // 使用 Electron API 保存文件
      if (window.electronAPI?.video?.saveMp4) {
        const result = await window.electronAPI.video.saveMp4(arrayBuffer, filename)
        if (result.success) {
          message.success({ content: '视频导出成功', duration: 2 })
        } else if (result.error !== '用户取消') {
          message.info({ content: result.error || '导出失败', duration: 2 })
        }
      } else {
        // 回退到浏览器下载
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        message.success({ content: '视频导出成功', duration: 2 })
      }
    } catch (error) {
      console.error('视频导出失败:', error)
      message.info({ content: '视频导出失败', duration: 2 })
    }
  }, [courseware])

  /**
   * 导出音频 (MP3)
   */
  const handleExportAudio = useCallback(async () => {
    if (recordedChunksRef.current.length === 0) {
      message.info({ content: '没有可导出的录制内容', duration: 2 })
      return
    }

    try {
      // 从视频中提取音频
      const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' })
      const arrayBuffer = await blob.arrayBuffer()
      const filename = `${courseware?.title || '课件'}_录音_${new Date().toLocaleDateString().replace(/\//g, '-')}.mp3`
      
      // 使用 Electron API 保存文件
      if (window.electronAPI?.audio?.save) {
        const result = await window.electronAPI.audio.save(arrayBuffer, filename)
        if (result.success) {
          message.success({ content: '音频导出成功', duration: 2 })
        } else if (result.error !== '用户取消') {
          message.info({ content: result.error || '导出失败', duration: 2 })
        }
      } else {
        // 回退到浏览器下载
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        message.success({ content: '音频导出成功', duration: 2 })
      }
    } catch (error) {
      console.error('音频导出失败:', error)
      message.info({ content: '音频导出失败', duration: 2 })
    }
  }, [courseware])

  // 组件卸载时清理录制资源
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current)
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  // 批量判分所有题目
  const gradeAllQuestions = useCallback(() => {
    let correct = 0
    let total = 0
    const results: Record<number, boolean | null> = {}
    
    questions.forEach((q, index) => {
      const studentAnswer = studentAnswers[index]
      const correctAnswer = q.answer
      
      if (studentAnswer && correctAnswer) {
        const isCorrect = normalizeAnswer(studentAnswer) === normalizeAnswer(correctAnswer)
        results[index] = isCorrect
        if (isCorrect) correct++
        total++
      }
    })
    
    setGradingResults(results)
    
    if (total === 0) {
      message.warning('请先输入学生答案')
    } else {
      const percentage = Math.round((correct / total) * 100)
      message.info(`批改完成: ${correct}/${total} 题正确，正确率 ${percentage}%`)
    }
  }, [questions, studentAnswers])

  // 获取当前题目的判分结果
  const currentGradingResult = gradingResults[currentIndex]
  const currentStudentAnswer = studentAnswers[currentIndex] || ''

  const handleExit = useCallback(() => {
    saveCurrentWhiteboard()
    navigate(-1)
  }, [navigate, saveCurrentWhiteboard])

  // 分隔线拖拽处理
  const handleDragStart = useCallback(() => setIsDragging(true), [])
  
  const handleDragMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const newWidth = ((e.clientX - rect.left) / rect.width) * 100
    setLeftWidth(Math.max(25, Math.min(70, newWidth)))
  }, [isDragging])

  const handleDragEnd = useCallback(() => setIsDragging(false), [])

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDragMove)
      window.addEventListener('mouseup', handleDragEnd)
      return () => {
        window.removeEventListener('mousemove', handleDragMove)
        window.removeEventListener('mouseup', handleDragEnd)
      }
    }
  }, [isDragging, handleDragMove, handleDragEnd])

  // 画布缩放处理 - 以鼠标位置为中心缩放
  const handleCanvasWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    const wrapper = canvasWrapperRef.current
    if (!wrapper) return
    
    const rect = wrapper.getBoundingClientRect()
    // 鼠标在容器中的位置
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    
    setCanvasScale(prevScale => {
      const newScale = Math.min(Math.max(prevScale * delta, CANVAS_CONFIG.MIN_SCALE), CANVAS_CONFIG.MAX_SCALE)
      
      // 计算鼠标在画布内容上的位置
      const contentX = (mouseX - canvasOffset.x) / prevScale
      const contentY = (mouseY - canvasOffset.y) / prevScale
      
      // 计算新的偏移量，保持鼠标指向的内容位置不变
      const newOffsetX = mouseX - contentX * newScale
      const newOffsetY = mouseY - contentY * newScale
      
      setCanvasOffset({ x: newOffsetX, y: newOffsetY })
      
      return newScale
    })
  }, [canvasOffset])

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    // 如果画笔关闭，或按住空格键/中键，启用平移模式
    if (!isDrawingEnabled || e.button === 1 || e.altKey) {
      e.preventDefault()
      e.stopPropagation()
      setIsPanning(true)
      lastPanPoint.current = { x: e.clientX, y: e.clientY }
    }
  }, [isDrawingEnabled])

  // 全局拖拽处理 - 在 window 上监听，避免鼠标移出容器时停止拖拽
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
    // 拖拽已经在全局事件中处理，这里不再需要处理
  }, [])

  const handleCanvasMouseUp = useCallback(() => {
    setIsPanning(false)
  }, [])

  // 触摸手势支持
  const touchStartDistance = useRef(0)
  const touchStartScale = useRef(1)
  const touchStartOffset = useRef({ x: 0, y: 0 })
  const lastTouchCenter = useRef({ x: 0, y: 0 })

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // 双指缩放
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
      
      // 触摸中心点
      const centerX = (touch1.clientX + touch2.clientX) / 2
      const centerY = (touch1.clientY + touch2.clientY) / 2
      
      // 触摸中心在容器中的位置
      const touchCenterInContainer = {
        x: centerX - rect.left,
        y: centerY - rect.top
      }
      
      // 计算触摸中心在初始画布内容上的位置
      const contentX = (touchCenterInContainer.x - touchStartOffset.current.x) / touchStartScale.current
      const contentY = (touchCenterInContainer.y - touchStartOffset.current.y) / touchStartScale.current
      
      // 计算新的偏移量，保持触摸中心指向的内容位置不变
      const newOffsetX = touchCenterInContainer.x - contentX * newScale
      const newOffsetY = touchCenterInContainer.y - contentY * newScale
      
      // 同时处理平移
      const dx = centerX - lastTouchCenter.current.x
      const dy = centerY - lastTouchCenter.current.y
      
      setCanvasScale(newScale)
      setCanvasOffset({ x: newOffsetX + dx, y: newOffsetY + dy })
      lastTouchCenter.current = { x: centerX, y: centerY }
    }
  }, [])

  // 重置画布视图 - 缩放到100%并回到初始位置
  const handleResetView = useCallback(() => {
    setCanvasScale(1)
    setCanvasOffset({ x: 0, y: 0 })
  }, [])

  // 放大画布 - 以容器中心为基准
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
  }, [canvasOffset])

  // 缩小画布 - 以容器中心为基准
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
  }, [canvasOffset])

  // 同步缩放和偏移到 Fabric.js 画布的 viewportTransform
  useEffect(() => {
    if (canvasRef.current) {
      canvasRef.current.setViewportTransform(canvasScale, canvasOffset.x, canvasOffset.y)
    }
  }, [canvasScale, canvasOffset])

  // 切换手掌/画笔模式
  const toggleDrawingMode = useCallback(() => {
    const newEnabled = !isDrawingEnabled
    setIsDrawingEnabled(newEnabled)
    if (canvasRef.current) {
      canvasRef.current.setDrawingMode(newEnabled)
      // 切换到画笔模式时，恢复之前选择的工具（画笔或橡皮擦）
      if (newEnabled) {
        if (currentTool === 'eraser') {
          canvasRef.current.setBrush({ type: 'eraser', color: '#FFFFFF', width: eraserSize })
        } else {
          canvasRef.current.setBrush({ type: 'pencil', color: penColor, width: penWidth })
        }
      }
    }
  }, [isDrawingEnabled, penColor, penWidth, currentTool, eraserSize])

  // 切换白板全屏
  const toggleWhiteboardFullscreen = useCallback(() => {
    setIsWhiteboardFullscreen(prev => !prev)
    setIsLeftPanelVisible(false)
  }, [])

  // 切换左侧面板显示
  const toggleLeftPanel = useCallback(() => {
    setIsLeftPanelVisible(prev => !prev)
  }, [])

  // 白板工具
  const handleToolChange = useCallback((tool: ToolType) => {
    // 如果当前已经是橡皮擦，再次点击切换回画笔
    const newTool = (tool === 'eraser' && currentTool === 'eraser') ? 'pen' : tool
    setCurrentTool(newTool)
    if (canvasRef.current) {
      // 切换工具时自动开启画笔模式
      setIsDrawingEnabled(true)
      canvasRef.current.setDrawingMode(true)
      if (newTool === 'pen') {
        canvasRef.current.setBrush({ type: 'pencil', color: penColor, width: penWidth })
      } else {
        canvasRef.current.setBrush({ type: 'eraser', color: '#FFFFFF', width: eraserSize })
      }
    }
  }, [penColor, penWidth, currentTool, eraserSize])

  // 橡皮擦大小调整
  const handleEraserSizeChange = useCallback((size: number) => {
    setEraserSize(size)
    if (canvasRef.current && currentTool === 'eraser') {
      canvasRef.current.setBrush({ type: 'eraser', color: '#FFFFFF', width: size })
    }
  }, [currentTool])

  const handleColorChange = useCallback((color: string) => {
    setPenColor(color)
    // 选择颜色时自动切换到画笔工具
    setCurrentTool('pen')
    if (canvasRef.current) {
      canvasRef.current.setBrush({ type: 'pencil', color, width: penWidth })
    }
  }, [penWidth])

  const handleWidthChange = useCallback((width: number) => {
    setPenWidth(width)
    // 调整笔宽时自动切换到画笔工具
    setCurrentTool('pen')
    if (canvasRef.current) {
      canvasRef.current.setBrush({ type: 'pencil', color: penColor, width })
    }
  }, [penColor])

  const handleUndo = useCallback(() => {
    if (canvasRef.current) {
      canvasRef.current.undo()
    }
  }, [])
  
  const handleRedo = useCallback(() => {
    if (canvasRef.current) {
      canvasRef.current.redo()
    }
  }, [])
  const handleClear = useCallback(() => canvasRef.current?.clear(), [])

  /**
   * 打开图片导出选择对话框
   */
  const handleExportImage = useCallback(() => {
    if (!mainContentRef.current) return
    // 先保存当前画布数据
    saveCurrentWhiteboard()
    setImageExportModalVisible(true)
  }, [saveCurrentWhiteboard])

  /**
   * 执行图片导出
   * 采用分层导出+合并的方案：分别截取题目层和笔迹层，然后精确合并
   */
  const executeImageExport = useCallback(async () => {
    if (!mainContentRef.current || !canvasWrapperRef.current) return
    
    setImageExportModalVisible(false)
    
    try {
      message.loading({ content: '正在生成图片...', key: 'exportImg', duration: 0 })
      
      let dataUrl: string
      
      if (imageExportScope === 'fullContent' && transformLayerRef.current && canvasRef.current && canvasWrapperRef.current) {
        // 导出全部内容（包含题目卡片 + 笔迹，包括超出可见区域的部分）
        const transformLayer = transformLayerRef.current
        
        // 1. 计算题目卡片的边界（使用存储的坐标）
        let contentMinX = Infinity
        let contentMinY = Infinity
        let contentMaxX = -Infinity
        let contentMaxY = -Infinity
        
        // 从 DOM 获取题目卡片的实际尺寸
        canvasQuestions.forEach((item) => {
          const left = item.x
          const top = item.y
          // 使用存储的尺寸，考虑缩放
          const scaledWidth = item.width * item.scale
          const scaledHeight = item.height * item.scale
          
          contentMinX = Math.min(contentMinX, left)
          contentMinY = Math.min(contentMinY, top)
          contentMaxX = Math.max(contentMaxX, left + scaledWidth)
          contentMaxY = Math.max(contentMaxY, top + scaledHeight)
        })
        
        // 2. 获取笔迹边界（原始坐标）
        const strokeBounds = canvasRef.current.getContentBounds()
        if (strokeBounds.hasContent) {
          contentMinX = Math.min(contentMinX, strokeBounds.left)
          contentMinY = Math.min(contentMinY, strokeBounds.top)
          contentMaxX = Math.max(contentMaxX, strokeBounds.left + strokeBounds.width)
          contentMaxY = Math.max(contentMaxY, strokeBounds.top + strokeBounds.height)
        }
        
        // 3. 如果没有任何内容，使用默认尺寸
        if (contentMinX === Infinity) {
          contentMinX = 0
          contentMinY = 0
          contentMaxX = wrapperSize.width
          contentMaxY = wrapperSize.height
        }
        
        // 添加 padding
        const padding = 20
        contentMinX = contentMinX - padding
        contentMinY = contentMinY - padding
        contentMaxX = contentMaxX + padding
        contentMaxY = contentMaxY + padding
        
        const exportWidth = contentMaxX - contentMinX
        const exportHeight = contentMaxY - contentMinY
        const scale = 2 // 导出缩放比例，提高清晰度
        
        // === 方案：克隆题目层到离屏容器，避免修改原始 DOM ===
        
        // 创建离屏容器
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
        
        // 克隆题目层
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
        
        // 等待渲染
        await new Promise(resolve => setTimeout(resolve, 100))
        
        // 截取离屏容器
        const questionCanvas = await html2canvas(offscreenContainer, {
          backgroundColor: '#FFFFFF',
          scale: scale,
          useCORS: true,
          allowTaint: true,
          logging: false,
          width: exportWidth,
          height: exportHeight
        })
        
        // 清理离屏容器
        document.body.removeChild(offscreenContainer)
        
        // === 步骤2：导出笔迹层 ===
        const fabricCanvas = canvasRef.current.getFabricCanvas()
        let strokeCanvas: HTMLCanvasElement | null = null
        
        if (fabricCanvas && strokeBounds.hasContent) {
          // 保存原始状态
          const originalVPT = [...fabricCanvas.viewportTransform] as [number, number, number, number, number, number]
          const originalWidth = fabricCanvas.width
          const originalHeight = fabricCanvas.height
          const originalBgColor = fabricCanvas.backgroundColor
          
          // 设置导出用的 viewportTransform
          fabricCanvas.setViewportTransform([1, 0, 0, 1, -contentMinX, -contentMinY])
          fabricCanvas.setDimensions({ width: exportWidth, height: exportHeight })
          fabricCanvas.backgroundColor = 'transparent'
          fabricCanvas.renderAll()
          
          // 创建导出画布
          strokeCanvas = document.createElement('canvas')
          strokeCanvas.width = exportWidth * scale
          strokeCanvas.height = exportHeight * scale
          const strokeCtx = strokeCanvas.getContext('2d')!
          strokeCtx.scale(scale, scale)
          strokeCtx.drawImage(fabricCanvas.lowerCanvasEl, 0, 0)
          
          // 恢复 Fabric.js 状态
          fabricCanvas.backgroundColor = originalBgColor
          fabricCanvas.setViewportTransform(originalVPT as any)
          fabricCanvas.setDimensions({ width: originalWidth, height: originalHeight })
          fabricCanvas.renderAll()
        }
        
        // === 步骤3：合并两层 ===
        const mergedCanvas = document.createElement('canvas')
        mergedCanvas.width = exportWidth * scale
        mergedCanvas.height = exportHeight * scale
        const mergedCtx = mergedCanvas.getContext('2d')!
        
        // 先绘制题目层（底层）
        mergedCtx.drawImage(questionCanvas, 0, 0)
        
        // 再绘制笔迹层（顶层）
        if (strokeCanvas) {
          mergedCtx.drawImage(strokeCanvas, 0, 0)
        }
        
        dataUrl = mergedCanvas.toDataURL('image/png')
      } else {
        // 仅导出可见区域
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
      
      // 使用浏览器下载
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
  }, [courseware, currentIndex, imageExportScope, canvasQuestions, wrapperSize])

  const handleCanvasReady = useCallback(() => {
    if (canvasRef.current) {
      // 同步初始状态：isDrawingEnabled 默认为 true，所以开启绘图模式
      canvasRef.current.setDrawingMode(true)
      canvasRef.current.setBrush({ type: 'pencil', color: penColor, width: penWidth })
      // 禁用对象选择，防止笔迹被单独拖拽
      canvasRef.current.setSelection(false)
    }
  }, [penColor, penWidth])

  /**
   * 切换到拖拽模式（插入后调用）
   */
  const switchToDragMode = useCallback(() => {
    setIsDrawingEnabled(false)
    if (canvasRef.current) {
      canvasRef.current.setDrawingMode(false)
    }
  }, [])

  /**
   * 插入题目到画布
   * 注：题目显示在Canvas上方
   * @param contentType 内容类型：'full' 完整题目、'stem' 仅题干、'option' 单个选项
   * @param optionData 当 contentType 为 'option' 时，传入选项数据
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
        // 切换到拖拽模式
        switchToDragMode()
        return
      }
    }
    
    const options = parseOptions(question.options)
    
    // 计算默认位置，防止多个内容堆叠
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
    
    // 插入后切换到拖拽模式
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
   * 更新画布题目位置（无边界限制）
   */
  const updateCanvasQuestionPosition = useCallback((id: string, x: number, y: number) => {
    // 无边界限制，允许题目移动到任意位置
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
   * 拖拽开始 - 从左侧题目卡片（完整题目）
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
    e.stopPropagation() // 阻止冒泡，避免触发整个卡片的拖拽
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
    e.stopPropagation() // 阻止冒泡，避免触发整个卡片的拖拽
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
    
    // 计算相对于画布的位置
    const wrapper = canvasWrapperRef.current
    if (!wrapper) return
    
    const rect = wrapper.getBoundingClientRect()
    const x = (e.clientX - rect.left - canvasOffset.x) / canvasScale
    const y = (e.clientY - rect.top - canvasOffset.y) / canvasScale
    
    // 尝试解析新格式的拖拽数据
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
    
    // 兼容旧格式（纯数字）
    const plainData = e.dataTransfer.getData('text/plain')
    const questionIndex = parseInt(plainData, 10)
    if (!isNaN(questionIndex)) {
      insertQuestionToCanvas(questionIndex, x, y, 'full')
    }
  }, [canvasOffset, canvasScale, insertQuestionToCanvas])

  /**
   * 拖拽进入画布区域
   */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  /**
   * 画布中题目拖拽开始
   * 注：由于Canvas在最上层，书写模式时Canvas会拦截所有事件，题目收不到鼠标事件
   */
  const handleCanvasQuestionDragStart = useCallback((e: React.MouseEvent, item: CanvasQuestionItem) => {
    // 画笔模式下不允许拖拽题目
    if (isDrawingEnabled) return
    
    e.stopPropagation()
    e.preventDefault()
    setSelectedCanvasQuestion(item.id)
    setIsDraggingQuestion(true)
    
    // 记录鼠标相对于题目卡片左上角的偏移（在画布坐标系中）
    const wrapper = canvasWrapperRef.current
    if (!wrapper) return
    
    const rect = wrapper.getBoundingClientRect()
    // 计算鼠标在画布坐标系中的位置
    const mouseX = (e.clientX - rect.left - canvasOffset.x) / canvasScale
    const mouseY = (e.clientY - rect.top - canvasOffset.y) / canvasScale
    
    // 记录偏移量：鼠标位置 - 题目位置
    setDragOffset({
      x: mouseX - item.x,
      y: mouseY - item.y
    })
  }, [canvasScale, canvasOffset, isDrawingEnabled])

  /**
   * 画布中题目拖拽移动
   */
  const handleCanvasQuestionDrag = useCallback((e: React.MouseEvent) => {
    // 画笔模式下不允许拖拽题目
    if (isDrawingEnabled) return
    if (!isDraggingQuestion || !selectedCanvasQuestion) return
    
    const wrapper = canvasWrapperRef.current
    if (!wrapper) return
    
    const rect = wrapper.getBoundingClientRect()
    // 计算鼠标在画布坐标系中的位置
    const mouseX = (e.clientX - rect.left - canvasOffset.x) / canvasScale
    const mouseY = (e.clientY - rect.top - canvasOffset.y) / canvasScale
    
    // 新位置 = 鼠标位置 - 偏移量
    const newX = mouseX - dragOffset.x
    const newY = mouseY - dragOffset.y
    
    updateCanvasQuestionPosition(selectedCanvasQuestion, newX, newY)
  }, [isDrawingEnabled, isDraggingQuestion, selectedCanvasQuestion, canvasScale, canvasOffset, dragOffset, updateCanvasQuestionPosition])

  /**
   * 画布中题目拖拽结束
   */
  const handleCanvasQuestionDragEnd = useCallback(() => {
    setIsDraggingQuestion(false)
  }, [])

  // 全局题目拖拽处理 - 在 window 上监听，避免鼠标移出容器时停止拖拽
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
  }, [isDraggingQuestion, selectedCanvasQuestion, canvasScale, canvasOffset, dragOffset, updateCanvasQuestionPosition])

  /**
   * 画布题目缩放 - 滚轮
   */
  const handleCanvasQuestionWheel = useCallback((e: React.WheelEvent, id: string, currentScale: number) => {
    e.stopPropagation()
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    updateCanvasQuestionScale(id, currentScale + delta)
  }, [updateCanvasQuestionScale])

  /**
   * 打开PDF导出选择对话框
   */
  const handleExportPdf = useCallback(() => {
    if (!courseware || questions.length === 0) return
    // 先保存当前画布数据，确保批注检测准确
    saveCurrentWhiteboard()
    // 初始化选择状态
    setPdfExportMode('all')
    setSelectedQuestions(questions.map((_, i) => i))
    setPdfExportModalVisible(true)
  }, [courseware, questions, saveCurrentWhiteboard])

  /**
   * 获取有批注的题目索引列表
   */
  const getAnnotatedQuestionIndices = useCallback(() => {
    return questions.map((_, index) => index).filter(i => whiteboardData[i] && whiteboardData[i] !== '{}')
  }, [questions, whiteboardData])

  /**
   * 执行PDF导出
   */
  const executePdfExport = useCallback(async () => {
    if (!courseware || !mainContentRef.current) return
    
    // 根据模式确定要导出的题目索引
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
      // 收集所有题目的截图
      const screenshots: { index: number; dataUrl: string }[] = []
      const originalIndex = currentIndex
      
      for (let i = 0; i < indicesToExport.length; i++) {
        const qIndex = indicesToExport[i]
        // 切换到该题目
        setCurrentIndex(qIndex)
        // 等待渲染完成
        await new Promise(resolve => setTimeout(resolve, CANVAS_CONFIG.EXPORT_SWITCH_DELAY))
        
        // 加载该题目的白板数据
        if (canvasRef.current && whiteboardData[qIndex]) {
          await canvasRef.current.loadJSON(whiteboardData[qIndex])
        } else if (canvasRef.current) {
          canvasRef.current.clear()
        }
        await new Promise(resolve => setTimeout(resolve, CANVAS_CONFIG.RENDER_DELAY))
        
        message.loading({ content: `正在生成PDF (${i + 1}/${indicesToExport.length})...`, key: 'pdf', duration: 0 })
        
        let dataUrl: string
        
        if (pdfExportScope === 'fullContent' && transformLayerRef.current && canvasRef.current && canvasWrapperRef.current) {
          // 导出全部内容（包含题目卡片 + 笔迹）
          const transformLayer = transformLayerRef.current
          
          // 1. 计算题目卡片的边界
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
          
          // 2. 获取笔迹边界
          const strokeBounds = canvasRef.current.getContentBounds()
          if (strokeBounds.hasContent) {
            contentMinX = Math.min(contentMinX, strokeBounds.left)
            contentMinY = Math.min(contentMinY, strokeBounds.top)
            contentMaxX = Math.max(contentMaxX, strokeBounds.left + strokeBounds.width)
            contentMaxY = Math.max(contentMaxY, strokeBounds.top + strokeBounds.height)
          }
          
          // 3. 如果没有内容，使用默认尺寸
          if (contentMinX === Infinity) {
            contentMinX = 0
            contentMinY = 0
            contentMaxX = wrapperSize.width
            contentMaxY = wrapperSize.height
          }
          
          // 添加 padding
          const padding = 20
          contentMinX = contentMinX - padding
          contentMinY = contentMinY - padding
          contentMaxX = contentMaxX + padding
          contentMaxY = contentMaxY + padding
          
          const exportWidth = contentMaxX - contentMinX
          const exportHeight = contentMaxY - contentMinY
          const exportScale = 2
          
          // === 克隆题目层到离屏容器 ===
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
          
          // === 导出笔迹层 ===
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
          
          // === 步骤3：合并两层 ===
          const mergedCanvas = document.createElement('canvas')
          mergedCanvas.width = exportWidth * exportScale
          mergedCanvas.height = exportHeight * exportScale
          const mergedCtx = mergedCanvas.getContext('2d')!
          
          // 先绘制题目层（底层）
          mergedCtx.drawImage(questionCanvas, 0, 0)
          
          // 再绘制笔迹层（顶层）
          if (strokeCanvas) {
            mergedCtx.drawImage(strokeCanvas, 0, 0)
          }
          
          dataUrl = mergedCanvas.toDataURL('image/png')
        } else {
          // 仅导出可见区域（包含左侧题目 + 右侧白板）
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
      
      // 恢复原来的题目
      setCurrentIndex(originalIndex)
      
      // 准备PDF数据（使用截图）
      const pdfData = {
        title: courseware.title,
        questions: screenshots.map(s => ({
          index: s.index,
          text: '',
          options: [],
          answer: '',
          whiteboard: s.dataUrl  // 使用截图作为内容
        }))
      }
      
      // 调用Electron导出PDF
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
  }, [courseware, questions, pdfExportMode, pdfExportScope, selectedQuestions, currentIndex, whiteboardData, getAnnotatedQuestionIndices])

  /**
   * 导出试卷为Word
   */
  const handleExportWord = useCallback(async () => {
    if (!courseware || questions.length === 0) return
    
    setIsExportingWord(true)
    message.loading({ content: '正在生成Word文档...', key: 'word', duration: 0 })
    
    try {
      // 准备Word数据
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
      
      // 调用Electron导出Word
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

  // 快捷键
  const shortcuts: ShortcutConfig[] = useMemo(() => [
    { key: 'ArrowLeft', handler: handlePrev, description: '上一题' },
    { key: 'ArrowRight', handler: handleNext, description: '下一题' },
    { key: ' ', handler: toggleAnswer, description: '显示/隐藏答案' },
    { key: 'Escape', handler: handleExit, description: '退出演示' },
    { key: 'z', ctrl: true, handler: handleUndo, description: '上一步' },
    { key: 'y', ctrl: true, handler: handleRedo, description: '下一步' }
  ], [handlePrev, handleNext, toggleAnswer, handleExit, handleUndo, handleRedo])

  useKeyboardShortcuts(shortcuts)

  // 颜色选择弹窗（使用 useMemo 避免重复创建）
  const colorContent = useMemo(() => (
    <div className={styles.colorPicker}>
      {DEFAULT_COLORS.map(color => (
        <div
          key={color}
          className={`${styles.colorItem} ${penColor === color ? styles.active : ''}`}
          style={{ backgroundColor: color }}
          onClick={() => handleColorChange(color)}
        />
      ))}
      <Divider style={{ margin: '8px 0' }} />
      <div className={styles.widthSlider}>
        <span>笔宽:</span>
        <Slider min={1} max={20} value={penWidth} onChange={handleWidthChange} style={{ width: 100 }} />
      </div>
    </div>
  ), [penColor, penWidth, handleColorChange, handleWidthChange])

  if (isLoading) {
    return (
      <div className={styles.loading}>
        <Spin size="large" tip="加载课件中..." />
      </div>
    )
  }

  if (!courseware || questions.length === 0) {
    return (
      <div className={styles.empty}>
        <p>课件为空或加载失败</p>
        <Button type="primary" onClick={() => navigate('/')}>返回首页</Button>
      </div>
    )
  }

  return (
    <div ref={containerRef} className={`${styles.container} ${isDragging ? styles.dragging : ''}`}>
      {/* 顶部工具栏 */}
      <div className={styles.topBar}>
        <div className={styles.topLeft}>
          <span className={styles.logoIcon}>🍃</span>
          <span className={styles.title}>{courseware.title}</span>
        </div>
        
        <div className={styles.topCenter}>
          <Button
            className={styles.navBtn}
            icon={<LeftOutlined />}
            onClick={handlePrev}
            disabled={currentIndex === 0}
          />
          <span className={styles.progress}>
            {currentIndex + 1} / {questions.length}
          </span>
          <Button
            className={styles.navBtn}
            icon={<RightOutlined />}
            onClick={handleNext}
            disabled={currentIndex === questions.length - 1}
          />
        </div>
        
        {/* 录制区域 */}
        <div className={styles.recordingArea}>
          <Tooltip title={isRecording ? '停止录制' : '开始录制（屏幕+声音）'}>
            <Button
              type={isRecording ? 'primary' : 'default'}
              danger={isRecording}
              icon={isRecording ? <PauseCircleOutlined /> : <VideoCameraOutlined />}
              onClick={toggleRecording}
              className={`${styles.recordBtn} ${isRecording ? styles.recording : ''}`}
            >
              {isRecording ? `停止 ${formatRecordingTime(recordingTime)}` : '录制'}
            </Button>
          </Tooltip>
          {hasRecording && !isRecording && (
            <>
              <Tooltip title="导出录制视频">
                <Button
                  icon={<PlaySquareOutlined />}
                  onClick={handleExportVideo}
                  className={styles.exportMediaBtn}
                >
                  导出视频
                </Button>
              </Tooltip>
              <Tooltip title="导出录制音频">
                <Button
                  icon={<AudioOutlined />}
                  onClick={handleExportAudio}
                  className={styles.exportMediaBtn}
                >
                  导出音频
                </Button>
              </Tooltip>
            </>
          )}
        </div>
        
        <div className={styles.topRight}>
          <Tooltip title="导出试卷PDF">
            <Button 
              icon={<FilePdfOutlined />} 
              onClick={handleExportPdf}
              loading={isExportingPdf}
              className={styles.exportBtn}
            >
              导出PDF
            </Button>
          </Tooltip>
          <Tooltip title="导出Word文档">
            <Button 
              icon={<FileWordOutlined />} 
              onClick={handleExportWord}
              loading={isExportingWord}
              className={styles.exportBtn}
            >
              导出Word
            </Button>
          </Tooltip>
          <Tooltip title="退出演示 (Esc)">
            <Button icon={<FullscreenExitOutlined />} onClick={handleExit}>
              退出
            </Button>
          </Tooltip>
        </div>
      </div>

      {/* 主内容区 */}
      <div ref={mainContentRef} className={styles.mainContent}>
        {/* 左侧题目卡片 */}
        <div
          className={`${styles.leftPanel} ${isWhiteboardFullscreen ? styles.leftPanelFullscreen : ''} ${isWhiteboardFullscreen && isLeftPanelVisible ? styles.leftPanelVisible : ''}`}
          style={{ width: isWhiteboardFullscreen ? '400px' : `${leftWidth}%` }}
        >
          {isWhiteboardFullscreen && (
            <div className={styles.leftPanelHandle} onClick={toggleLeftPanel}>
              <RightOutlined style={{ transform: isLeftPanelVisible ? 'rotate(180deg)' : 'none' }} />
            </div>
          )}
          <div
            className={styles.questionCard}
            draggable
            onDragStart={handleDragStartQuestion}
          >
            <div className={styles.cardHeader}>
              <div className={styles.dragHandle}>
                <HolderOutlined />
              </div>
              <span className={styles.questionLabel}>题目 {currentIndex + 1}</span>
              <Tooltip title="插入到画布">
                <Button
                  type="text"
                  size="small"
                  icon={<PlusOutlined />}
                  className={styles.insertBtn}
                  onClick={() => insertQuestionToCanvas(currentIndex)}
                />
              </Tooltip>
            </div>
            
            <div className={styles.cardContent}>
              <div 
                className={styles.questionText}
                draggable
                onDragStart={handleDragStartStem}
                title="拖拽题干到画布"
                style={{ cursor: 'grab' }}
              >
                <div className={styles.dragHint}>
                  <HolderOutlined />
                </div>
                {currentQuestion?.ocr_text || '暂无题目内容'}
              </div>
            </div>
            
            {/* 选项列表 */}
            <div className={styles.optionsArea}>
              {currentOptions.map((opt) => (
                <div
                  key={opt.label}
                  className={`${styles.optionCard} ${showAnswer && currentQuestion?.answer?.includes(opt.label) ? styles.correct : ''} ${isGradingMode && currentStudentAnswer.includes(opt.label) ? (currentGradingResult === true ? styles.correct : currentGradingResult === false ? styles.wrong : styles.selected) : ''}`}
                  draggable
                  onDragStart={(e) => handleDragStartOption(e, opt)}
                  onClick={() => {
                    if (isGradingMode) {
                      // 在批改模式下点击选项切换选中状态
                      const currentAnswer = currentStudentAnswer
                      if (currentAnswer.includes(opt.label)) {
                        setStudentAnswer(currentAnswer.replace(opt.label, ''))
                      } else {
                        setStudentAnswer(currentAnswer + opt.label)
                      }
                    }
                  }}
                  style={{ cursor: isGradingMode ? 'pointer' : 'grab' }}
                  title="拖拽选项到画布"
                >
                  <div className={styles.optionDragHandle}>
                    <HolderOutlined />
                  </div>
                  <span className={styles.optionLabel}>{opt.label}.</span>
                  <span className={styles.optionText}>{opt.content}</span>
                  {showAnswer && currentQuestion?.answer?.includes(opt.label) && (
                    <CheckOutlined className={styles.optionCheck} />
                  )}
                </div>
              ))}
            </div>
            
            {/* 正确答案显示卡片 */}
            {showAnswer && currentQuestion?.answer && (
              <div className={styles.correctAnswerCard}>
                <div className={styles.answerIconWrapper}>
                  <CheckOutlined className={styles.answerIcon} />
                </div>
                <div className={styles.answerContent}>
                  <span className={styles.answerTitle}>正确答案</span>
                  <span className={styles.answerValue}>{currentQuestion.answer}</span>
                </div>
              </div>
            )}
            
            {/* 答案显示按钮 & 批改模式 */}
            <div className={styles.answerSection}>
              <Button
                type={showAnswer ? 'primary' : 'default'}
                icon={showAnswer ? <EyeOutlined /> : <EyeInvisibleOutlined />}
                onClick={toggleAnswer}
              >
                {showAnswer ? '隐藏答案' : '显示答案'}
              </Button>
              
              <Button
                type={isGradingMode ? 'primary' : 'default'}
                icon={<FormOutlined />}
                onClick={toggleGradingMode}
              >
                {isGradingMode ? '退出批改' : '批改模式'}
              </Button>
            </div>
            
            {/* 批改模式输入区 */}
            {isGradingMode && (
              <div className={styles.gradingSection}>
                <div className={styles.gradingInput}>
                  <span className={styles.gradingLabel}>学生答案：</span>
                  <Input
                    value={currentStudentAnswer}
                    onChange={(e) => setStudentAnswer(e.target.value)}
                    placeholder="点击选项或输入答案"
                    onPressEnter={gradeCurrentQuestion}
                  />
                  <Button
                    type="primary"
                    icon={<CheckOutlined />}
                    onClick={gradeCurrentQuestion}
                  >
                    判分
                  </Button>
                  <Button onClick={gradeAllQuestions}>
                    全部判分
                  </Button>
                </div>
                
                {/* 判分结果显示 */}
                {currentGradingResult !== null && currentGradingResult !== undefined && (
                  <div className={styles.gradingResult}>
                    {currentGradingResult ? (
                      <Tag icon={<CheckCircleOutlined />} color="success">
                        回答正确
                      </Tag>
                    ) : (
                      <Tag icon={<CloseCircleOutlined />} color="error">
                        回答错误，正确答案: {currentQuestion?.answer}
                      </Tag>
                    )}
                  </div>
                )}
                
                {/* 判分统计 */}
                {Object.keys(gradingResults).length > 0 && (
                  <div className={styles.gradingStats}>
                    已判: {Object.values(gradingResults).filter(r => r !== null).length} 题
                    {' | '}
                    正确: {Object.values(gradingResults).filter(r => r === true).length} 题
                    {' | '}
                    错误: {Object.values(gradingResults).filter(r => r === false).length} 题
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 分隔线 */}
        <div className={styles.divider} onMouseDown={handleDragStart}>
          <div className={styles.dividerHandle}>
            <ColumnWidthOutlined />
          </div>
        </div>

        {/* 右侧白板区 */}
        <div
          className={`${styles.rightPanel} ${isWhiteboardFullscreen ? styles.fullscreen : ''}`}
          style={{ width: isWhiteboardFullscreen ? '100%' : `${100 - leftWidth}%` }}
        >
          <div className={styles.toolbar}>
            {/* 手掌/画笔模式切换 */}
            <div className={styles.toolGroup}>
              <Tooltip title={isDrawingEnabled ? '切换到拖拽模式' : '切换到画笔模式'}>
                <Button
                  type={isDrawingEnabled ? 'primary' : 'default'}
                  icon={isDrawingEnabled ? <EditOutlined /> : <DragOutlined />}
                  onClick={toggleDrawingMode}
                />
              </Tooltip>
              
              {/* 橡皮擦 - 仅在画笔模式下可用，纯 CSS 悬浮方案 */}
              <div className={styles.eraserWrapper}>
                <Tooltip title={!isDrawingEnabled ? '橡皮擦（拖拽模式下不可用）' : '橡皮擦'}>
                  <Button
                    type={currentTool === 'eraser' ? 'primary' : 'default'}
                    icon={<EraserIcon />}
                    onClick={() => handleToolChange('eraser')}
                    disabled={!isDrawingEnabled}
                    className={currentTool === 'eraser' ? styles.eraserActive : ''}
                  />
                </Tooltip>
                {/* 悬浮显示的滑竿 */}
                <div className={styles.eraserSliderDropdown}>
                  <Slider 
                    vertical
                    min={5} 
                    max={50} 
                    value={eraserSize} 
                    onChange={handleEraserSizeChange} 
                    tooltip={{ formatter: (val) => `${val}px` }}
                  />
                </div>
              </div>
              
              {/* 颜色/笔宽选择器 */}
              <Popover content={colorContent} trigger="click" placement="bottom">
                <Tooltip title="颜色/笔宽">
                  <Button icon={<BgColorsOutlined />} disabled={!isDrawingEnabled}>
                    <span className={styles.colorIndicator} style={{ backgroundColor: penColor }} />
                  </Button>
                </Tooltip>
              </Popover>
            </div>
            
            {/* 缩放控制 */}
            <div className={styles.toolGroup}>
              <Tooltip title="缩小">
                <Button icon={<ZoomOutOutlined />} onClick={handleZoomOut} />
              </Tooltip>
              <Tooltip title="重置视图">
                <Button onClick={handleResetView} className={styles.scaleBtn}>
                  {Math.round(canvasScale * 100)}%
                </Button>
              </Tooltip>
              <Tooltip title="放大">
                <Button icon={<ZoomInOutlined />} onClick={handleZoomIn} />
              </Tooltip>
            </div>
            
            <div className={styles.toolGroup}>
              <Tooltip title="上一步 (Ctrl+Z)">
                <Button icon={<UndoOutlined />} onClick={handleUndo} />
              </Tooltip>
              <Tooltip title="下一步 (Ctrl+Y)">
                <Button icon={<RedoOutlined />} onClick={handleRedo} />
              </Tooltip>
              <Tooltip title="全部清空">
                <Button icon={<ClearOutlined />} onClick={handleClear} danger />
              </Tooltip>
            </div>
            
            <div className={styles.toolGroup}>
              <Tooltip title={isWhiteboardFullscreen ? '退出全屏' : '全屏白板'}>
                <Button
                  icon={isWhiteboardFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
                  onClick={toggleWhiteboardFullscreen}
                />
              </Tooltip>
              <Button icon={<PictureOutlined />} onClick={handleExportImage} className={styles.saveBtn}>
                导出图片
              </Button>
            </div>
          </div>

          <div 
            className={`${styles.canvasWrapper} ${!isDrawingEnabled ? styles.draggable : ''}`}
            ref={canvasWrapperRef}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={(e) => {
              handleCanvasMouseMove(e)
              handleCanvasQuestionDrag(e)
            }}
            onMouseUp={() => {
              handleCanvasMouseUp()
              handleCanvasQuestionDragEnd()
            }}
            onMouseLeave={() => {
              // 不在这里调用 handleCanvasQuestionDragEnd，题目拖拽由全局事件处理
            }}
            onWheel={handleCanvasWheel}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onDrop={handleDropOnCanvas}
            onDragOver={handleDragOver}
            style={{ cursor: isPanning ? 'grabbing' : (!isDrawingEnabled ? 'grab' : 'default') }}
          >
            {/* 变换层 - 绝对定位实现无限平移 */}
            <div 
              ref={transformLayerRef}
              className={styles.canvasTransformLayer}
              style={{
                width: canvasSize.width,
                height: canvasSize.height,
                position: 'absolute',
                left: 0,
                top: 0,
                transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px) scale(${canvasScale}) translateZ(0)`,
                background: '#FFFFFF'
              }}
            >
              {/* 题目层 - 在底层 */}
              {canvasQuestions.map((item) => (
                <div
                  key={item.id}
                  className={`${styles.canvasQuestion} ${selectedCanvasQuestion === item.id ? styles.selected : ''} ${item.contentType === 'option' ? styles.canvasOptionItem : ''}`}
                  style={{
                    position: 'absolute',
                    left: item.x,
                    top: item.y,
                    transform: `scale(${item.scale}) translateZ(0)`,
                    transformOrigin: 'top left',
                    zIndex: 1,
                    pointerEvents: isDrawingEnabled ? 'none' : 'auto',
                    cursor: 'move'
                  }}
                  onMouseDown={(e) => handleCanvasQuestionDragStart(e, item)}
                  onWheel={(e) => !isDrawingEnabled && handleCanvasQuestionWheel(e, item.id, item.scale)}
                  onClick={(e) => {
                    if (isDrawingEnabled) return
                    e.stopPropagation()
                    setSelectedCanvasQuestion(item.id)
                  }}
                >
                  <div className={styles.canvasQuestionHeader}>
                    <span>
                      {item.contentType === 'full' && `题目 ${item.questionIndex + 1}`}
                      {item.contentType === 'stem' && `题干 ${item.questionIndex + 1}`}
                      {item.contentType === 'option' && `选项 ${item.optionLabel}`}
                    </span>
                    <Button
                      type="text"
                      size="small"
                      icon={<DeleteOutlined />}
                      className={styles.deleteBtn}
                      onClick={(e) => {
                        e.stopPropagation()
                        removeQuestionFromCanvas(item.id)
                      }}
                    />
                  </div>
                  <div className={styles.canvasQuestionContent}>
                    {/* 根据 contentType 渲染不同内容 */}
                    {item.contentType === 'option' ? (
                      // 单个选项
                      <div className={styles.canvasQuestionOption}>
                        <span className={styles.optLabel}>{item.optionLabel}.</span>
                        <span>{item.optionContent}</span>
                      </div>
                    ) : (
                      // 完整题目或仅题干
                      <>
                        <div className={styles.canvasQuestionText}>{item.questionText}</div>
                        {item.contentType === 'full' && item.options.length > 0 && (
                          <div className={styles.canvasQuestionOptions}>
                            {item.options.map((opt) => (
                              <div key={opt.label} className={styles.canvasQuestionOption}>
                                <span className={styles.optLabel}>{opt.label}.</span>
                                <span>{opt.content}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
              {/* Canvas层已移至容器层级 */}
            </div>
            
            {/* Canvas层 - 独立于变换层，始终覆盖整个容器 */}
            <div style={{ 
              position: 'absolute', 
              top: 0, 
              left: 0, 
              width: '100%',
              height: '100%',
              zIndex: 10,
              pointerEvents: isDrawingEnabled ? 'auto' : 'none'
            }}>
              <WhiteboardCanvas
                ref={canvasRef}
                width={wrapperSize.width}
                height={wrapperSize.height}
                backgroundColor="transparent"
                onCanvasReady={handleCanvasReady}
              />
            </div>
            
            <div className={styles.scaleIndicator} onClick={handleResetView}>
              {Math.round(canvasScale * 100)}%
            </div>
          </div>
        </div>
      </div>

      {/* PDF导出选择对话框 */}
      <Modal
        title="导出PDF"
        open={pdfExportModalVisible}
        onOk={executePdfExport}
        onCancel={() => setPdfExportModalVisible(false)}
        okText="开始导出"
        cancelText="取消"
        width={500}
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 12 }}>
            <strong>选择导出题目：</strong>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ cursor: 'pointer' }}>
              <input
                type="radio"
                name="exportMode"
                checked={pdfExportMode === 'all'}
                onChange={() => setPdfExportMode('all')}
                style={{ marginRight: 8 }}
              />
              全部导出 ({questions.length} 题)
            </label>
            <label style={{ cursor: 'pointer' }}>
              <input
                type="radio"
                name="exportMode"
                checked={pdfExportMode === 'annotated'}
                onChange={() => setPdfExportMode('annotated')}
                style={{ marginRight: 8 }}
              />
              只导出有批注的 ({getAnnotatedQuestionIndices().length} 题)
            </label>
            <label style={{ cursor: 'pointer' }}>
              <input
                type="radio"
                name="exportMode"
                checked={pdfExportMode === 'selected'}
                onChange={() => setPdfExportMode('selected')}
                style={{ marginRight: 8 }}
              />
              手动选择题目
            </label>
          </div>
        </div>
        
        {pdfExportMode === 'selected' && (
          <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #d9d9d9', borderRadius: 4, padding: 12, marginBottom: 16 }}>
            <Checkbox
              checked={selectedQuestions.length === questions.length}
              indeterminate={selectedQuestions.length > 0 && selectedQuestions.length < questions.length}
              onChange={(e) => {
                if (e.target.checked) {
                  setSelectedQuestions(questions.map((_, i) => i))
                } else {
                  setSelectedQuestions([])
                }
              }}
              style={{ marginBottom: 8 }}
            >
              全选
            </Checkbox>
            <Divider style={{ margin: '8px 0' }} />
            {questions.map((q, index) => (
              <div key={q.id} style={{ marginBottom: 4 }}>
                <Checkbox
                  checked={selectedQuestions.includes(index)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedQuestions(prev => [...prev, index].sort((a, b) => a - b))
                    } else {
                      setSelectedQuestions(prev => prev.filter(i => i !== index))
                    }
                  }}
                >
                  题目 {index + 1}
                  {whiteboardData[index] && whiteboardData[index] !== '{}' && (
                    <Tag color="green" style={{ marginLeft: 8 }}>有批注</Tag>
                  )}
                </Checkbox>
              </div>
            ))}
          </div>
        )}
        
        <Divider style={{ margin: '16px 0' }} />
        
        <div>
          <div style={{ marginBottom: 12 }}>
            <strong>导出内容范围：</strong>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ cursor: 'pointer' }}>
              <input
                type="radio"
                name="exportScope"
                checked={pdfExportScope === 'fullContent'}
                onChange={() => setPdfExportScope('fullContent')}
                style={{ marginRight: 8 }}
              />
              全部书写内容（包含超出可见区域的部分）
            </label>
            <label style={{ cursor: 'pointer' }}>
              <input
                type="radio"
                name="exportScope"
                checked={pdfExportScope === 'visibleArea'}
                onChange={() => setPdfExportScope('visibleArea')}
                style={{ marginRight: 8 }}
              />
              仅可见区域
            </label>
          </div>
        </div>
      </Modal>

      {/* 图片导出选择对话框 */}
      <Modal
        title="导出图片"
        open={imageExportModalVisible}
        onOk={executeImageExport}
        onCancel={() => setImageExportModalVisible(false)}
        okText="开始导出"
        cancelText="取消"
        width={400}
      >
        <div>
          <div style={{ marginBottom: 12 }}>
            <strong>导出内容范围：</strong>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ cursor: 'pointer' }}>
              <input
                type="radio"
                name="imageExportScope"
                checked={imageExportScope === 'fullContent'}
                onChange={() => setImageExportScope('fullContent')}
                style={{ marginRight: 8 }}
              />
              全部书写内容（包含超出可见区域的部分）
            </label>
            <label style={{ cursor: 'pointer' }}>
              <input
                type="radio"
                name="imageExportScope"
                checked={imageExportScope === 'visibleArea'}
                onChange={() => setImageExportScope('visibleArea')}
                style={{ marginRight: 8 }}
              />
              仅可见区域
            </label>
          </div>
          <div style={{ marginTop: 16, color: '#666', fontSize: 13 }}>
            💡 如果您在白板上拖动后书写了内容，选择"全部书写内容"可以导出所有内容。
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default PresentationPage
