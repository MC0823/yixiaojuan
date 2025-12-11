/**
 * 全屏讲解课件页面
 * 左侧：题目卡片展示
 * 右侧：白板书写区
 * 
 * 重构版本：使用 hooks 和组件拆分，减少主组件代码量
 */
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button, Spin, Tooltip, Slider, Popover, Divider, message as antdMessage } from 'antd'
import {
  FullscreenExitOutlined,
  FullscreenOutlined,
  LeftOutlined,
  RightOutlined,
  EditOutlined,
  ClearOutlined,
  UndoOutlined,
  RedoOutlined,
  PictureOutlined,
  BgColorsOutlined,
  ColumnWidthOutlined,
  FilePdfOutlined,
  FileWordOutlined,
  VideoCameraOutlined,
  PauseCircleOutlined,
  PlaySquareOutlined,
  AudioOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
  DragOutlined,
  DeleteOutlined
} from '@ant-design/icons'
import Icon from '@ant-design/icons'

// 自定义橡皮擦图标
const EraserSvg = () => (
  <svg viewBox="0 0 1024 1024" width="1em" height="1em" fill="currentColor">
    <path d="M893.44 344.64L679.36 130.56a64 64 0 0 0-90.56 0L124.16 595.2a64 64 0 0 0 0 90.56l142.72 142.72a64 64 0 0 0 45.28 18.72H608a32 32 0 0 0 0-64H339.2l-169.6-169.6L608 175.2l214.24 214.24-293.76 293.76a32 32 0 0 0 45.28 45.28l319.68-319.68a64 64 0 0 0 0-90.56zM256 847.2h640a32 32 0 0 0 0-64H256a32 32 0 0 0 0 64z" />
  </svg>
)
interface IconProps {
  className?: string
  style?: React.CSSProperties
  onClick?: () => void
}
const EraserIcon = (props: IconProps) => <Icon component={EraserSvg} {...props} />

import { WhiteboardCanvas, type WhiteboardCanvasRef, DEFAULT_COLORS } from '../../components/canvas'
import { useKeyboardShortcuts, type ShortcutConfig } from '../../hooks'
import styles from './Presentation.module.less'

// 导入拆分的 hooks 和组件
import { 
  useRecording, 
  useGrading, 
  useWhiteboard, 
  useCanvasQuestions, 
  useExport,
  parseOptions,
  CANVAS_CONFIG
} from './hooks'
import { QuestionCard, ExportModals } from './components'

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
  options?: string
}

/**
 * 课件数据接口
 */
interface CoursewareData {
  id: string
  title: string
  description?: string
}

function PresentationPage() {
  const { id: coursewareId } = useParams<{ id: string }>()
  const navigate = useNavigate()

  // 使用独立的 message 实例
  const [messageApi, messageContextHolder] = antdMessage.useMessage({
    top: window.innerHeight - 100,
    duration: 2,
    maxCount: 3
  })
  
  // 课件和题目数据
  const [courseware, setCourseware] = useState<CoursewareData | null>(null)
  const [questions, setQuestions] = useState<QuestionData[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  
  // 答案显示状态
  const [showAnswer, setShowAnswer] = useState(false)
  
  // 分隔线拖拽
  const [leftWidth, setLeftWidth] = useState(45)
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  
  // 白板 refs
  const canvasRef = useRef<WhiteboardCanvasRef>(null)
  const canvasWrapperRef = useRef<HTMLDivElement>(null)
  const transformLayerRef = useRef<HTMLDivElement>(null)
  const mainContentRef = useRef<HTMLDivElement>(null)
  
  // 白板数据存储
  const [whiteboardData, setWhiteboardData] = useState<Record<number, string>>({})
  
  // 白板全屏状态
  const [isWhiteboardFullscreen, setIsWhiteboardFullscreen] = useState(false)
  const [isLeftPanelVisible, setIsLeftPanelVisible] = useState(false)

  // 当前题目
  const currentQuestion = useMemo(() => questions[currentIndex], [questions, currentIndex])
  const currentOptions = useMemo(() => parseOptions(currentQuestion?.options), [currentQuestion?.options])

  // ========== 使用拆分的 Hooks ==========
  
  // 白板工具
  const whiteboard = useWhiteboard({
    canvasRef,
    canvasWrapperRef,
    leftWidth
  })

  // 画布题目
  const canvasQuestionHook = useCanvasQuestions({
    questions,
    currentIndex,
    canvasWrapperRef,
    canvasRef,
    canvasScale: whiteboard.canvasScale,
    canvasOffset: whiteboard.canvasOffset,
    isDrawingEnabled: whiteboard.isDrawingEnabled,
    setIsDrawingEnabled: (enabled: boolean) => {
      if (canvasRef.current) {
        canvasRef.current.setDrawingMode(enabled)
      }
    }
  })

  // 录制功能
  const recording = useRecording({
    coursewareTitle: courseware?.title
  })

  // 批改模式
  const grading = useGrading({
    questions,
    currentIndex
  })

  // 保存当前白板数据
  const saveCurrentWhiteboard = useCallback(() => {
    if (canvasRef.current) {
      const json = canvasRef.current.exportJSON()
      setWhiteboardData(prev => ({
        ...prev,
        [currentIndex]: json
      }))
    }
  }, [currentIndex])

  // 导出功能
  const exportHook = useExport({
    courseware,
    questions,
    currentIndex,
    setCurrentIndex,
    whiteboardData,
    canvasQuestions: canvasQuestionHook.canvasQuestions,
    canvasSize: whiteboard.canvasSize,
    wrapperSize: whiteboard.wrapperSize,
    mainContentRef,
    transformLayerRef,
    canvasWrapperRef,
    canvasRef,
    saveCurrentWhiteboard
  })

  // ========== 数据加载 ==========
  
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
        messageApi.error('加载课件失败')
        navigate('/')
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [coursewareId, navigate, messageApi])

  // ========== 题目切换 ==========

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

  const handlePrev = useCallback(() => handleQuestionChange(currentIndex - 1), [currentIndex, handleQuestionChange])
  const handleNext = useCallback(() => handleQuestionChange(currentIndex + 1), [currentIndex, handleQuestionChange])
  const toggleAnswer = useCallback(() => setShowAnswer(prev => !prev), [])

  const handleExit = useCallback(() => {
    saveCurrentWhiteboard()
    navigate(-1)
  }, [navigate, saveCurrentWhiteboard])

  // ========== 分隔线拖拽 ==========
  
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
    }
    return () => {
      window.removeEventListener('mousemove', handleDragMove)
      window.removeEventListener('mouseup', handleDragEnd)
    }
  }, [isDragging, handleDragMove, handleDragEnd])

  // ========== 白板全屏 ==========

  const toggleWhiteboardFullscreen = useCallback(() => {
    setIsWhiteboardFullscreen(prev => !prev)
    setIsLeftPanelVisible(false)
  }, [])

  const toggleLeftPanel = useCallback(() => {
    setIsLeftPanelVisible(prev => !prev)
  }, [])

  // ========== 快捷键 ==========
  
  const shortcuts: ShortcutConfig[] = useMemo(() => [
    { key: 'ArrowLeft', handler: handlePrev, description: '上一题' },
    { key: 'ArrowRight', handler: handleNext, description: '下一题' },
    { key: ' ', handler: toggleAnswer, description: '显示/隐藏答案' },
    { key: 'Escape', handler: handleExit, description: '退出演示' },
    { key: 'z', ctrl: true, handler: whiteboard.handleUndo, description: '上一步' },
    { key: 'y', ctrl: true, handler: whiteboard.handleRedo, description: '下一步' }
  ], [handlePrev, handleNext, toggleAnswer, handleExit, whiteboard.handleUndo, whiteboard.handleRedo])

  useKeyboardShortcuts(shortcuts)

  // 颜色选择弹窗
  const colorContent = useMemo(() => (
    <div className={styles.colorPicker}>
      {DEFAULT_COLORS.map(color => (
        <div
          key={color}
          className={`${styles.colorItem} ${whiteboard.penColor === color ? styles.active : ''}`}
          style={{ backgroundColor: color }}
          onClick={() => whiteboard.handleColorChange(color)}
        />
      ))}
      <Divider style={{ margin: '8px 0' }} />
      <div className={styles.widthSlider}>
        <span>笔宽:</span>
        <Slider min={1} max={20} value={whiteboard.penWidth} onChange={whiteboard.handleWidthChange} style={{ width: 100 }} />
      </div>
    </div>
  ), [whiteboard.penColor, whiteboard.penWidth, whiteboard.handleColorChange, whiteboard.handleWidthChange])

  // ========== 加载和空状态 ==========

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

  // ========== 渲染 ==========

  return (
    <>
      {messageContextHolder}
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
          <Tooltip title={recording.isRecording ? '停止录制' : '开始录制（屏幕+声音）'}>
            <Button
              type={recording.isRecording ? 'primary' : 'default'}
              danger={recording.isRecording}
              icon={recording.isRecording ? <PauseCircleOutlined /> : <VideoCameraOutlined />}
              onClick={recording.toggleRecording}
              className={`${styles.recordBtn} ${recording.isRecording ? styles.recording : ''}`}
            >
              {recording.isRecording ? `停止 ${recording.formatRecordingTime(recording.recordingTime)}` : '录制'}
            </Button>
          </Tooltip>
          {recording.hasRecording && !recording.isRecording && (
            <>
              <Tooltip title="导出录制视频">
                <Button
                  icon={<PlaySquareOutlined />}
                  onClick={recording.handleExportVideo}
                  className={styles.exportMediaBtn}
                >
                  导出视频
                </Button>
              </Tooltip>
              <Tooltip title="导出录制音频">
                <Button
                  icon={<AudioOutlined />}
                  onClick={recording.handleExportAudio}
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
              onClick={exportHook.handleExportPdf}
              loading={exportHook.isExportingPdf}
              className={styles.exportBtn}
            >
              导出PDF
            </Button>
          </Tooltip>
          <Tooltip title="导出Word文档">
            <Button 
              icon={<FileWordOutlined />} 
              onClick={exportHook.handleExportWord}
              loading={exportHook.isExportingWord}
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
        <QuestionCard
          currentIndex={currentIndex}
          currentQuestion={currentQuestion}
          currentOptions={currentOptions}
          showAnswer={showAnswer}
          isWhiteboardFullscreen={isWhiteboardFullscreen}
          isLeftPanelVisible={isLeftPanelVisible}
          isGradingMode={grading.isGradingMode}
          currentStudentAnswer={grading.currentStudentAnswer}
          currentGradingResult={grading.currentGradingResult}
          gradingResults={grading.gradingResults}
          leftWidth={leftWidth}
          onToggleAnswer={toggleAnswer}
          onToggleGradingMode={grading.toggleGradingMode}
          onToggleLeftPanel={toggleLeftPanel}
          onSetStudentAnswer={grading.setStudentAnswer}
          onGradeCurrentQuestion={grading.gradeCurrentQuestion}
          onGradeAllQuestions={grading.gradeAllQuestions}
          onInsertQuestionToCanvas={canvasQuestionHook.insertQuestionToCanvas}
          onDragStartQuestion={canvasQuestionHook.handleDragStartQuestion}
          onDragStartStem={canvasQuestionHook.handleDragStartStem}
          onDragStartOption={canvasQuestionHook.handleDragStartOption}
        />

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
              <Tooltip title={whiteboard.isDrawingEnabled ? '切换到拖拽模式' : '切换到画笔模式'}>
                <Button
                  type={whiteboard.isDrawingEnabled ? 'primary' : 'default'}
                  icon={whiteboard.isDrawingEnabled ? <EditOutlined /> : <DragOutlined />}
                  onClick={whiteboard.toggleDrawingMode}
                />
              </Tooltip>
              
              {/* 橡皮擦 */}
              <div className={styles.eraserWrapper}>
                <Tooltip title={!whiteboard.isDrawingEnabled ? '橡皮擦（拖拽模式下不可用）' : '橡皮擦'}>
                  <Button
                    type={whiteboard.currentTool === 'eraser' ? 'primary' : 'default'}
                    icon={<EraserIcon />}
                    onClick={() => whiteboard.handleToolChange('eraser')}
                    disabled={!whiteboard.isDrawingEnabled}
                    className={whiteboard.currentTool === 'eraser' ? styles.eraserActive : ''}
                  />
                </Tooltip>
                <div className={styles.eraserSliderDropdown}>
                  <Slider 
                    vertical
                    min={5} 
                    max={50} 
                    value={whiteboard.eraserSize} 
                    onChange={whiteboard.handleEraserSizeChange} 
                    tooltip={{ formatter: (val) => `${val}px` }}
                  />
                </div>
              </div>
              
              {/* 颜色/笔宽选择器 */}
              <Popover content={colorContent} trigger="click" placement="bottom">
                <Tooltip title="颜色/笔宽">
                  <Button icon={<BgColorsOutlined />} disabled={!whiteboard.isDrawingEnabled}>
                    <span className={styles.colorIndicator} style={{ backgroundColor: whiteboard.penColor }} />
                  </Button>
                </Tooltip>
              </Popover>
            </div>
            
            {/* 缩放控制 */}
            <div className={styles.toolGroup}>
              <Tooltip title="缩小">
                <Button icon={<ZoomOutOutlined />} onClick={whiteboard.handleZoomOut} />
              </Tooltip>
              <Tooltip title="重置视图">
                <Button onClick={whiteboard.handleResetView} className={styles.scaleBtn}>
                  {Math.round(whiteboard.canvasScale * 100)}%
                </Button>
              </Tooltip>
              <Tooltip title="放大">
                <Button icon={<ZoomInOutlined />} onClick={whiteboard.handleZoomIn} />
              </Tooltip>
            </div>
            
            <div className={styles.toolGroup}>
              <Tooltip title="上一步 (Ctrl+Z)">
                <Button icon={<UndoOutlined />} onClick={whiteboard.handleUndo} />
              </Tooltip>
              <Tooltip title="下一步 (Ctrl+Y)">
                <Button icon={<RedoOutlined />} onClick={whiteboard.handleRedo} />
              </Tooltip>
              <Tooltip title="全部清空">
                <Button icon={<ClearOutlined />} onClick={whiteboard.handleClear} danger />
              </Tooltip>
            </div>
            
            <div className={styles.toolGroup}>
              <Tooltip title={isWhiteboardFullscreen ? '退出全屏' : '全屏白板'}>
                <Button
                  icon={isWhiteboardFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
                  onClick={toggleWhiteboardFullscreen}
                />
              </Tooltip>
              <Button icon={<PictureOutlined />} onClick={exportHook.handleExportImage} className={styles.saveBtn}>
                导出图片
              </Button>
            </div>
          </div>

          <div 
            className={`${styles.canvasWrapper} ${!whiteboard.isDrawingEnabled ? styles.draggable : ''}`}
            ref={canvasWrapperRef}
            onMouseDown={whiteboard.handleCanvasMouseDown}
            onMouseMove={(e) => {
              whiteboard.handleCanvasMouseMove(e)
              canvasQuestionHook.handleCanvasQuestionDrag(e)
            }}
            onMouseUp={() => {
              whiteboard.handleCanvasMouseUp()
              canvasQuestionHook.handleCanvasQuestionDragEnd()
            }}
            onWheel={whiteboard.handleCanvasWheel}
            onTouchStart={whiteboard.handleTouchStart}
            onTouchMove={whiteboard.handleTouchMove}
            onDrop={canvasQuestionHook.handleDropOnCanvas}
            onDragOver={canvasQuestionHook.handleDragOver}
            style={{ cursor: whiteboard.isPanning ? 'grabbing' : (!whiteboard.isDrawingEnabled ? 'grab' : 'default') }}
          >
            {/* 变换层 */}
            <div 
              ref={transformLayerRef}
              className={styles.canvasTransformLayer}
              style={{
                width: whiteboard.canvasSize.width,
                height: whiteboard.canvasSize.height,
                position: 'absolute',
                left: 0,
                top: 0,
                transform: `translate(${whiteboard.canvasOffset.x}px, ${whiteboard.canvasOffset.y}px) scale(${whiteboard.canvasScale}) translateZ(0)`,
                background: '#FFFFFF'
              }}
            >
              {/* 题目层 */}
              {canvasQuestionHook.canvasQuestions.map((item) => (
                <div
                  key={item.id}
                  className={`${styles.canvasQuestion} ${canvasQuestionHook.selectedCanvasQuestion === item.id ? styles.selected : ''} ${item.contentType === 'option' ? styles.canvasOptionItem : ''}`}
                  style={{
                    position: 'absolute',
                    left: item.x,
                    top: item.y,
                    transform: `scale(${item.scale}) translateZ(0)`,
                    transformOrigin: 'top left',
                    zIndex: 1,
                    pointerEvents: whiteboard.isDrawingEnabled ? 'none' : 'auto',
                    cursor: 'move'
                  }}
                  onMouseDown={(e) => canvasQuestionHook.handleCanvasQuestionDragStart(e, item)}
                  onWheel={(e) => !whiteboard.isDrawingEnabled && canvasQuestionHook.handleCanvasQuestionWheel(e, item.id, item.scale)}
                  onClick={(e) => {
                    if (whiteboard.isDrawingEnabled) return
                    e.stopPropagation()
                    canvasQuestionHook.setSelectedCanvasQuestion(item.id)
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
                        canvasQuestionHook.removeQuestionFromCanvas(item.id)
                      }}
                    />
                  </div>
                  <div className={styles.canvasQuestionContent}>
                    {item.contentType === 'option' ? (
                      <div className={styles.canvasQuestionOption}>
                        <span className={styles.optLabel}>{item.optionLabel}.</span>
                        <span>{item.optionContent}</span>
                      </div>
                    ) : (
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
            </div>
            
            {/* Canvas层 */}
            <div style={{ 
              position: 'absolute', 
              top: 0, 
              left: 0, 
              width: '100%',
              height: '100%',
              zIndex: 10,
              pointerEvents: whiteboard.isDrawingEnabled ? 'auto' : 'none'
            }}>
              <WhiteboardCanvas
                ref={canvasRef}
                width={whiteboard.wrapperSize.width}
                height={whiteboard.wrapperSize.height}
                backgroundColor="transparent"
                onCanvasReady={whiteboard.handleCanvasReady}
              />
            </div>
            
            <div className={styles.scaleIndicator} onClick={whiteboard.handleResetView}>
              {Math.round(whiteboard.canvasScale * 100)}%
            </div>
          </div>
        </div>
      </div>

      {/* 导出弹窗 */}
      <ExportModals
        questions={questions}
        pdfExportModalVisible={exportHook.pdfExportModalVisible}
        pdfExportMode={exportHook.pdfExportMode}
        selectedQuestions={exportHook.selectedQuestions}
        pdfExportScope={exportHook.pdfExportScope}
        whiteboardData={whiteboardData}
        onPdfExportModalClose={() => exportHook.setPdfExportModalVisible(false)}
        onPdfExportModeChange={exportHook.setPdfExportMode}
        onSelectedQuestionsChange={exportHook.setSelectedQuestions}
        onPdfExportScopeChange={exportHook.setPdfExportScope}
        onExecutePdfExport={exportHook.executePdfExport}
        getAnnotatedQuestionIndices={exportHook.getAnnotatedQuestionIndices}
        imageExportModalVisible={exportHook.imageExportModalVisible}
        imageExportScope={exportHook.imageExportScope}
        onImageExportModalClose={() => exportHook.setImageExportModalVisible(false)}
        onImageExportScopeChange={exportHook.setImageExportScope}
        onExecuteImageExport={exportHook.executeImageExport}
      />
    </div>
    </>
  )
}

export default PresentationPage
