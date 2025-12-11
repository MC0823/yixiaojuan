/**
 * 主工作区页面
 * 左侧试卷列表 + 右侧编辑面板/上传界面
 * 
 * 重构版本：使用 hooks 和组件拆分
 */
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Tooltip, Spin, message, Modal, Image, Input } from 'antd'
import {
  PlusOutlined,
  SettingOutlined,
  UndoOutlined,
  RedoOutlined,
  SaveOutlined,
  PlayCircleOutlined,
  FileTextOutlined
} from '@ant-design/icons'
import { useKeyboardShortcuts, type ShortcutConfig } from '../../hooks'
import { useImageUpload, type UploadImageItem } from '../../components/upload'
import { CoursewarePreviewModal } from '../../components/courseware/CoursewarePreviewModal'
import styles from './Workspace.module.less'

// 导入拆分的 hooks 和组件
import { useCourseware, useQuestionEditor } from './hooks'
import { CoursewareList, QuestionEditor, UploadPanel } from './components'

function WorkspacePage() {
  const navigate = useNavigate()
  
  // 上传模式状态
  const [showUploadMode, setShowUploadMode] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [coursewareTitle, setCoursewareTitle] = useState('')
  const [showTitleModal, setShowTitleModal] = useState(false)
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  
  // 使用公共 hook
  const {
    images: uploadImages,
    setImages: setUploadImages,
    isSelecting,
    isSplitting,
    splitProgress,
    isErasing,
    previewVisible,
    previewImage,
    handleSelectImages,
    handleRemoveImage: handleRemoveUploadImage,
    handlePreviewImage: handlePreviewUploadImage,
    handleClosePreview,
    handleAutoSplit,
    handleSplitAll,
    handleEraseHandwriting,
    handleEraseAll,
    handleCorrectAll,
    handleCancelTask
  } = useImageUpload()

  // ========== 使用拆分的 Hooks ==========
  
  const courseware = useCourseware()
  
  const questionEditor = useQuestionEditor({
    questions: courseware.questions,
    setQuestions: courseware.setQuestions,
    currentIndex: courseware.currentIndex,
    setCurrentIndex: courseware.setCurrentIndex,
    selectedId: courseware.selectedId,
    setShowUploadMode
  })

  // 当没有课件时，自动进入上传模式
  useEffect(() => {
    if (courseware.coursewares.length === 0 && !courseware.loadingList) {
      setShowUploadMode(true)
    }
  }, [courseware.coursewares.length, courseware.loadingList])

  // 选中课件时退出上传模式
  const handleSelectCourseware = useCallback((id: string) => {
    courseware.handleSelectCourseware(id)
    setShowUploadMode(false)
  }, [courseware])

  // 新建课件 - 切换到上传模式
  const handleCreate = useCallback(() => {
    setShowUploadMode(true)
    courseware.setSelectedId(null)
    setUploadImages([])
    setCoursewareTitle('')
  }, [courseware, setUploadImages])

  // 取消上传模式
  const handleCancelUpload = useCallback(() => {
    setShowUploadMode(false)
    setUploadImages([])
    setCoursewareTitle('')
  }, [setUploadImages])

  // 打开设置
  const handleSettings = useCallback(() => {
    navigate('/settings')
  }, [navigate])

  /**
   * 从完整路径提取文件名（不含扩展名）用于课件名称
   */
  const getDisplayName = useCallback((path: string): string => {
    const fileName = path.split(/[\\/]/).pop() || path
    return fileName.replace(/\.(jpg|jpeg|png|gif|bmp|webp)$/i, '')
  }, [])

  /**
   * 创建单个课件
   */
  const createSingleCourseware = useCallback(async (title: string, coursewareImages: UploadImageItem[]): Promise<string | null> => {
    if (!window.electronAPI) {
      message.error('请在 Electron 环境中运行')
      return null
    }

    if (coursewareImages.length === 0) {
      message.error('没有可创建的图片')
      return null
    }

    const coursewareResult = await window.electronAPI.courseware.create({
      title: title.trim(),
      status: 'draft'
    })
    if (!coursewareResult.success || !coursewareResult.data) {
      throw new Error(coursewareResult.error || '创建课件失败')
    }
    
    const coursewareId = coursewareResult.data.id
    const savedPaths: string[] = []
    
    for (let i = 0; i < coursewareImages.length; i++) {
      const img = coursewareImages[i]
      const isFullPath = img.path.includes('/') || img.path.includes('\\')
      
      if (isFullPath) {
        const copyResult = await window.electronAPI.image.copyToCourseware([img.path], coursewareId)
        if (copyResult.success && copyResult.data && copyResult.data[0]) {
          savedPaths.push(copyResult.data[0])
        } else {
          throw new Error(`复制图片失败: ${img.name}`)
        }
      } else if (img.base64Data) {
        const ext = img.name.split('.').pop() || 'png'
        const filename = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${ext}`
        const saveResult = await window.electronAPI.image.save(img.base64Data, coursewareId, filename)
        if (saveResult.success && saveResult.data) {
          savedPaths.push(saveResult.data)
        } else {
          throw new Error(`保存图片失败: ${img.name}`)
        }
      }
    }
    
    const questionsData = coursewareImages.map((img, index) => {
      const stem = img.stem || img.ocrText || ''
      const opts = img.options || []
      let type = 'shortAnswer'
      if (opts.length >= 2) type = 'choice'
      return {
        original_image: savedPaths[index],
        ocr_text: stem,
        type: type,
        options: JSON.stringify(opts),
        order_index: index
      }
    })
    
    const questionResult = await window.electronAPI.question.createBatch(coursewareId, questionsData)
    if (!questionResult.success) {
      throw new Error(questionResult.error || '创建题目失败')
    }
    
    return coursewareId
  }, [])

  /**
   * 处理预览确认（分组创建或合并创建）
   */
  const handlePreviewConfirm = useCallback(async (mode: 'merge' | 'separate', selectedGroups?: string[]) => {
    console.log('[Workspace] 预览确认:', { mode, selectedGroups, imagesCount: uploadImages.length })
    setShowPreviewModal(false)
    
    if (mode === 'merge') {
      // 合并模式：显示名称输入弹窗
      setShowTitleModal(true)
    } else if (selectedGroups && selectedGroups.length > 0) {
      // 分别创建模式
      setIsCreating(true)
      try {
        let lastCoursewareId: string | null = null
        
        for (const groupKey of selectedGroups) {
          const groupImages = uploadImages.filter(img => img.sourceImage === groupKey)
          const title = getDisplayName(groupKey)
          console.log(`[Workspace] 创建课件: ${title}, 题目数: ${groupImages.length}`)
          
          const coursewareId = await createSingleCourseware(title, groupImages)
          if (coursewareId) {
            lastCoursewareId = coursewareId
          }
        }
        
        message.success(`成功创建 ${selectedGroups.length} 个课件`)
        setShowUploadMode(false)
        setUploadImages([])
        setCoursewareTitle('')

        try {
          await courseware.loadCoursewares()
          // 选中最后创建的课件
          if (lastCoursewareId) {
            courseware.setSelectedId(lastCoursewareId)
          }
        } catch (loadError) {
          console.error('加载课件列表失败:', loadError)
        }
      } catch (error) {
        message.error('创建课件失败: ' + (error instanceof Error ? error.message : String(error)))
      } finally {
        setIsCreating(false)
      }
    } else {
      // 只有一个分组时，直接显示名称输入弹窗
      setShowTitleModal(true)
    }
  }, [uploadImages, courseware, setUploadImages, createSingleCourseware, getDisplayName])

  // 创建课件（合并模式）
  const handleCreateCourseware = useCallback(async () => {
    if (uploadImages.length === 0) {
      message.warning('请先添加图片')
      return
    }
    if (!coursewareTitle.trim()) {
      message.warning('请输入课件名称')
      return
    }
    
    setIsCreating(true)
    setShowTitleModal(false)
    
    try {
      const coursewareId = await createSingleCourseware(coursewareTitle, uploadImages)
      
      if (coursewareId) {
        message.success('课件创建成功！')
        setShowUploadMode(false)
        setUploadImages([])
        setCoursewareTitle('')
        await courseware.loadCoursewares()
        courseware.setSelectedId(coursewareId)
      }
    } catch (error) {
      message.error('创建课件失败: ' + (error instanceof Error ? error.message : String(error)))
    } finally {
      setIsCreating(false)
    }
  }, [uploadImages, coursewareTitle, courseware, setUploadImages, createSingleCourseware])

  // 拖拽上传处理
  const handleUploadBeforeUpload = useCallback((file: File) => {
    const id = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const reader = new FileReader()
    let isMounted = true

    reader.onload = (e) => {
      if (isMounted) {
        const base64 = e.target?.result as string
        setUploadImages(prev => [...prev, {
          id,
          path: file.name,
          name: file.name,
          thumbnail: base64,
          base64Data: base64
        }])
      }
    }

    reader.onerror = () => {
      if (isMounted) {
        message.error('文件读取失败')
      }
    }

    reader.readAsDataURL(file)

    setTimeout(() => { isMounted = false }, 10000)
    return false
  }, [setUploadImages, message])

  // 开始演示
  const handlePresentation = useCallback(async () => {
    if (!courseware.selectedId) return
    await questionEditor.handleSave()
    navigate(`/presentation/${courseware.selectedId}`)
  }, [courseware.selectedId, questionEditor, navigate])

  // 快捷键
  const shortcuts: ShortcutConfig[] = useMemo(() => [
    { key: 's', ctrl: true, handler: questionEditor.handleSave, description: '保存' },
    { key: 'z', ctrl: true, handler: questionEditor.handleUndo, description: '撤销' },
    { key: 'y', ctrl: true, handler: questionEditor.handleRedo, description: '重做' },
    { key: 'ArrowLeft', handler: () => courseware.currentIndex > 0 && questionEditor.handleSwitchQuestion(courseware.currentIndex - 1), description: '上一题' },
    { key: 'ArrowRight', handler: () => courseware.currentIndex < courseware.questions.length - 1 && questionEditor.handleSwitchQuestion(courseware.currentIndex + 1), description: '下一题' }
  ], [questionEditor, courseware.currentIndex, courseware.questions.length])

  useKeyboardShortcuts(shortcuts, { disableInInput: true })

  return (
    <div className={styles.container}>
      {/* 统一工具栏 */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.logo}>
            <span className={styles.logoIcon}>🍃</span>
            <span className={styles.logoText}>易小卷</span>
          </div>
          <Tooltip title="设置">
            <Button
              icon={<SettingOutlined />}
              className={styles.settingsBtn}
              onClick={handleSettings}
            />
          </Tooltip>
          {questionEditor.showSaveHint && (
            <span className={styles.saveHint}>保存成功</span>
          )}
        </div>
        
        {courseware.selectedId && courseware.questions.length > 0 && (
          <div className={styles.headerCenter}>
            <span className={styles.questionNav}>
              第 {courseware.currentIndex + 1} / {courseware.questions.length} 题
            </span>
          </div>
        )}
        
        <div className={styles.headerRight}>
          {courseware.selectedId && courseware.questions.length > 0 && (
            <>
              <Tooltip title="撤销 (Ctrl+Z)">
                <Button
                  icon={<UndoOutlined />}
                  className={styles.toolBtn}
                  onClick={questionEditor.handleUndo}
                  disabled={questionEditor.historyIndex <= 0}
                >撤销</Button>
              </Tooltip>
              <Tooltip title="重做 (Ctrl+Y)">
                <Button
                  icon={<RedoOutlined />}
                  className={styles.toolBtn}
                  onClick={questionEditor.handleRedo}
                  disabled={questionEditor.historyIndex >= questionEditor.history.length - 1}
                >重做</Button>
              </Tooltip>
              <Button
                icon={<SaveOutlined />}
                className={styles.toolBtn}
                onClick={questionEditor.handleSave}
                loading={questionEditor.isSaving}
              >
                保存
              </Button>
              <Button
                icon={<PlayCircleOutlined />}
                className={styles.toolBtn}
                onClick={handlePresentation}
              >
                演示
              </Button>
            </>
          )}
          <Button
            type="primary"
            icon={<PlusOutlined />}
            className={styles.primaryBtn}
            onClick={handleCreate}
          >
            新建课件
          </Button>
        </div>
      </header>
      
      {/* 主内容区 */}
      <main className={styles.main}>
        {/* 左侧课件列表 */}
        <CoursewareList
          coursewares={courseware.coursewares}
          loadingList={courseware.loadingList}
          selectedId={courseware.selectedId}
          questions={courseware.questions}
          currentIndex={courseware.currentIndex}
          editingCoursewareId={courseware.editingCoursewareId}
          editingCoursewareName={courseware.editingCoursewareName}
          isImporting={courseware.isImporting}
          isExporting={courseware.isExporting}
          onSelectCourseware={handleSelectCourseware}
          onDeleteCourseware={courseware.handleDeleteCourseware}
          onRefresh={courseware.loadCoursewares}
          onImport={courseware.handleImportCourseware}
          onExport={courseware.handleExportCurrentCourseware}
          onDoubleClickCourseware={courseware.handleDoubleClickCourseware}
          onEditingNameChange={courseware.setEditingCoursewareName}
          onSaveCoursewareName={courseware.handleSaveCoursewareName}
          onCancelEditCoursewareName={courseware.handleCancelEditCoursewareName}
          onSwitchQuestion={questionEditor.handleSwitchQuestion}
        />
        
        {/* 右侧编辑面板/上传界面 */}
        <section className={styles.rightPanel}>
          {showUploadMode ? (
            <UploadPanel
              uploadImages={uploadImages}
              isSelecting={isSelecting}
              isSplitting={isSplitting}
              splitProgress={splitProgress}
              isErasing={isErasing}
              isCreating={isCreating}
              onSelectImages={handleSelectImages}
              onRemoveImage={handleRemoveUploadImage}
              onPreviewImage={handlePreviewUploadImage}
              onAutoSplit={handleAutoSplit}
              onSplitAll={handleSplitAll}
              onEraseHandwriting={handleEraseHandwriting}
              onEraseAll={handleEraseAll}
              onCorrectAll={handleCorrectAll}
              onCancelTask={(taskId) => taskId && handleCancelTask(taskId)}
              onCancelUpload={handleCancelUpload}
              onShowTitleModal={() => setShowPreviewModal(true)}
              onUploadPropsBeforeUpload={handleUploadBeforeUpload}
            />
          ) : !courseware.selectedId ? (
            <div className={styles.welcomePlaceholder}>
              <Spin size="large" />
            </div>
          ) : courseware.isLoading ? (
            <div className={styles.welcomePlaceholder}>
              <Spin size="large" />
            </div>
          ) : courseware.questions.length === 0 ? (
            <div className={styles.welcomePlaceholder}>
              <FileTextOutlined className={styles.welcomeIcon} />
              <div className={styles.welcomeTitle}>暂无题目</div>
              <div className={styles.welcomeDesc}>该课件没有识别到题目</div>
            </div>
          ) : (
            <div className={styles.editorContainer}>
              <QuestionEditor
                currentQuestion={questionEditor.currentQuestion}
                currentIndex={courseware.currentIndex}
                ocrText={questionEditor.ocrText}
                options={questionEditor.options}
                answer={questionEditor.answer}
                onOcrTextChange={questionEditor.handleOcrTextChange}
                onTypeChange={questionEditor.handleTypeChange}
                onAddOption={questionEditor.handleAddOption}
                onOptionChange={questionEditor.handleOptionChange}
                onDeleteOption={questionEditor.handleDeleteOption}
                onToggleAnswer={questionEditor.handleToggleAnswer}
                onAnswerChange={questionEditor.handleAnswerChange}
                onAddQuestion={questionEditor.handleAddQuestion}
                onDeleteQuestion={questionEditor.handleDeleteQuestion}
              />
            </div>
          )}
        </section>
      </main>
      
      {/* 图片预览 */}
      <Image
        style={{ display: 'none' }}
        preview={{
          visible: previewVisible,
          src: previewImage,
          onVisibleChange: (visible) => !visible && handleClosePreview()
        }}
      />
      
      {/* 课件预览和分组选择 */}
      <CoursewarePreviewModal
        visible={showPreviewModal}
        images={uploadImages}
        onConfirm={handlePreviewConfirm}
        onCancel={() => setShowPreviewModal(false)}
      />

      {/* 课件名称弹窗（合并模式） */}
      <Modal
        title="创建课件"
        open={showTitleModal}
        onOk={handleCreateCourseware}
        onCancel={() => setShowTitleModal(false)}
        okText="创建"
        cancelText="取消"
        confirmLoading={isCreating}
      >
        <Input
          placeholder="请输入课件名称"
          value={coursewareTitle}
          onChange={(e) => setCoursewareTitle(e.target.value)}
          onPressEnter={handleCreateCourseware}
        />
      </Modal>
    </div>
  )
}

export default WorkspacePage
