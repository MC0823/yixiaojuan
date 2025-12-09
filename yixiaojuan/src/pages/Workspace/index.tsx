/**
 * 主工作区页面
 * 左侧试卷列表 + 右侧编辑面板/上传界面
 */
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { 
  Button, Tooltip, Input, Spin, message, Modal, Dropdown, Upload, Typography, Progress, Alert, Image
} from 'antd'
import type { UploadProps } from 'antd'
import {
  PlusOutlined, SettingOutlined,
  FileTextOutlined, ReloadOutlined, FolderOpenOutlined,
  UndoOutlined, RedoOutlined, DeleteOutlined,
  SaveOutlined, PlayCircleOutlined, MoreOutlined, CheckOutlined,
  InboxOutlined, EyeOutlined, ScanOutlined, FileAddOutlined, CloseOutlined,
  ExportOutlined, ImportOutlined, ClearOutlined, RotateRightOutlined, StopOutlined
} from '@ant-design/icons'
// 白板批注功能仅在演示页面使用
import { useKeyboardShortcuts, type ShortcutConfig } from '../../hooks'
import { QuestionClassifier, type QuestionType } from '../../utils/questionClassifier'
import { useImageUpload } from '../../components/upload'
import styles from './Workspace.module.less'

const { TextArea } = Input
const { Dragger } = Upload
const { Title, Paragraph, Text } = Typography

interface Courseware {
  id: string
  title: string
  status: string
  created_at: string
  updated_at: string
}

interface QuestionData {
  id: string
  courseware_id: string
  order_index: number
  type?: string
  original_image?: string
  processed_image?: string
  ocr_text?: string
  options?: string // JSON字符串
  answer?: string
  annotations?: string
}

// 使用公共组件导出的 UploadImageItem 类型

function WorkspacePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  
  // 课件列表状态
  const [coursewares, setCoursewares] = useState<Courseware[]>([])
  const [loadingList, setLoadingList] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  
  // 编辑器状态
  const [questions, setQuestions] = useState<QuestionData[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [ocrText, setOcrText] = useState('')
  const [, setCurrentImageBase64] = useState('')
  const [options, setOptions] = useState<{label: string, content: string}[]>([])
  const [answer, setAnswer] = useState('')
  
  // 自动保存
  const autoSaveTimer = useRef<NodeJS.Timeout | null>(null)
  const hasChanges = useRef(false)
  
  // 撤销/重做历史记录
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const isUndoRedo = useRef(false)
  
  // 上传模式状态 - 使用公共 hook
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
  
  const [showUploadMode, setShowUploadMode] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [coursewareTitle, setCoursewareTitle] = useState('')
  const [showTitleModal, setShowTitleModal] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  
  // 编辑试卷名称
  const [editingCoursewareId, setEditingCoursewareId] = useState<string | null>(null)
  const [editingCoursewareName, setEditingCoursewareName] = useState('')
  
  // 保存成功提示
  const [showSaveHint, setShowSaveHint] = useState(false)
  const saveHintTimer = useRef<NodeJS.Timeout | null>(null)
  
  const currentQuestion = questions[currentIndex]
  // selectedCourseware 暂时保留以备后用
  // const selectedCourseware = coursewares.find(c => c.id === selectedId)
  
  // 加载课件列表
  const loadCoursewares = useCallback(async () => {
    if (!window.electronAPI) return
    
    setLoadingList(true)
    try {
      const result = await window.electronAPI.courseware.getAll()
      if (result.success && result.data) {
        setCoursewares(result.data)
      }
    } catch (error) {
      console.error('加载课件列表失败:', error)
    } finally {
      setLoadingList(false)
    }
  }, [])
  
  // 加载图片base64
  const loadImageBase64 = useCallback(async (imagePath: string | undefined) => {
    if (!imagePath || !window.electronAPI) {
      setCurrentImageBase64('')
      return
    }
    
    try {
      const result = await window.electronAPI.image.getInfo(imagePath, true)
      if (result.success && result.data?.base64) {
        setCurrentImageBase64(result.data.base64)
      } else {
        setCurrentImageBase64('')
      }
    } catch (error) {
      console.error('加载图片失败:', error)
      setCurrentImageBase64('')
    }
  }, [])
  
  // 加载课件详情
  const loadCoursewareDetail = useCallback(async (id: string) => {
    if (!window.electronAPI) return
    
    setIsLoading(true)
    try {
      const questionsResult = await window.electronAPI.question.getByCourseware(id)
      if (questionsResult.success && questionsResult.data) {
        setQuestions(questionsResult.data)
        setCurrentIndex(0)
        if (questionsResult.data.length > 0) {
          setOcrText(questionsResult.data[0].ocr_text || '')
          await loadImageBase64(questionsResult.data[0].original_image)
        }
      }
    } catch (error) {
      console.error('加载课件详情失败:', error)
      message.error('加载课件详情失败')
    } finally {
      setIsLoading(false)
    }
  }, [loadImageBase64])
  
  // 首次加载
  useEffect(() => {
    loadCoursewares()
  }, [loadCoursewares])
  
  // 从 URL 参数或localStorage读取要选中的课件ID
  useEffect(() => {
    // 当没有课件时，自动进入上传模式
    if (coursewares.length === 0 && !loadingList) {
      setShowUploadMode(true)
      return
    }
    
    if (coursewares.length === 0) return
    
    // 优先从URL参数读取
    const coursewareId = searchParams.get('coursewareId')
    if (coursewareId) {
      const exists = coursewares.some(c => c.id === coursewareId)
      if (exists) {
        setSelectedId(coursewareId)
        return
      }
    }
    
    // 其次从localStorage读取
    const lastId = localStorage.getItem('lastSelectedCoursewareId')
    if (lastId) {
      const exists = coursewares.some(c => c.id === lastId)
      if (exists) {
        setSelectedId(lastId)
        return
      }
    }
    
    // 如果都没有，选中第一个课件
    if (coursewares.length > 0 && !selectedId) {
      setSelectedId(coursewares[0].id)
      localStorage.setItem('lastSelectedCoursewareId', coursewares[0].id)
    }
  }, [searchParams, coursewares, selectedId, loadingList])
  
  // 选中课件变化时加载详情
  useEffect(() => {
    if (selectedId) {
      loadCoursewareDetail(selectedId)
    } else {
      setQuestions([])
      setOcrText('')
      setCurrentImageBase64('')
    }
  }, [selectedId, loadCoursewareDetail])
  
  // 切换题目时更新内容
  useEffect(() => {
    if (currentQuestion) {
      setOcrText(currentQuestion.ocr_text || '')
      loadImageBase64(currentQuestion.original_image)
      
      // 重置历史记录
      setHistory([currentQuestion.ocr_text || ''])
      setHistoryIndex(0)
      
      // 解析选项
      if (currentQuestion.options) {
        try {
          const parsedOptions = JSON.parse(currentQuestion.options);
          // 按字母顺序排序选项 (A, B, C, D...)
          const sortedOptions = [...parsedOptions].sort((a: {label: string}, b: {label: string}) => 
            a.label.localeCompare(b.label)
          );
          setOptions(sortedOptions);
        } catch (e) {
          setOptions([]);
        }
      } else {
        setOptions([]);
      }
      
      // 设置答案
      setAnswer(currentQuestion.answer || '')
    }
  }, [currentIndex, currentQuestion, loadImageBase64])
  
  // 标记有变更
  const markChanged = useCallback(() => {
    hasChanges.current = true
  }, [])
  
  // 自动保存
  const handleAutoSave = useCallback(async () => {
    if (!window.electronAPI || !currentQuestion) return
    
    try {
      const optionsJson = JSON.stringify(options)
      await window.electronAPI.question.update(currentQuestion.id, {
        ocr_text: ocrText,
        options: optionsJson,
        answer
      })
      hasChanges.current = false
    } catch (error) {
      console.error('自动保存失败:', error)
    }
  }, [currentQuestion, ocrText, options, answer])

  // 自动保存逻辑 - 放在 handleAutoSave 之后
  useEffect(() => {
    if (hasChanges.current && currentQuestion) {
      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current)
      }
      autoSaveTimer.current = setTimeout(() => {
        handleAutoSave()
      }, 2000)
    }
    
    return () => {
      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current)
      }
    }
  }, [ocrText, options, answer, handleAutoSave, currentQuestion])
  
  // 选择课件
  const handleSelectCourseware = useCallback((id: string) => {
    setSelectedId(id)
    setShowUploadMode(false) // 关闭上传模式，显示编辑面板
    // 保存到localStorage
    localStorage.setItem('lastSelectedCoursewareId', id)
  }, [])
  
  // 新建课件 - 切换到上传模式
  const handleCreate = useCallback(() => {
    setShowUploadMode(true)
    setSelectedId(null)
    setUploadImages([])
    setCoursewareTitle('')
  }, [])
  
  // 取消上传模式
  const handleCancelUpload = useCallback(() => {
    setShowUploadMode(false)
    setUploadImages([])
    setCoursewareTitle('')
  }, [])
  
  // 打开设置
  const handleSettings = useCallback(() => {
    navigate('/settings')
  }, [navigate])
  
  // 全屏（暂时保留以备后用）
  // const handleFullscreen = useCallback(() => {
  //   if (document.fullscreenElement) {
  //     document.exitFullscreen()
  //   } else {
  //     document.documentElement.requestFullscreen()
  //   }
  // }, [])
  
  // 保存当前题目
  const handleSave = useCallback(async () => {
    if (!window.electronAPI || !currentQuestion) return
    
    setIsSaving(true)
    try {
      const optionsJson = JSON.stringify(options)
      
      await window.electronAPI.question.update(currentQuestion.id, {
        ocr_text: ocrText,
        options: optionsJson,
        answer
      })
      
      setQuestions(prev => prev.map((q, i) => 
        i === currentIndex 
          ? { ...q, ocr_text: ocrText, options: optionsJson, answer }
          : q
      ))
      
      hasChanges.current = false
      
      // 显示保存成功提示
      if (saveHintTimer.current) {
        clearTimeout(saveHintTimer.current)
      }
      setShowSaveHint(true)
      saveHintTimer.current = setTimeout(() => {
        setShowSaveHint(false)
      }, 1500)
    } catch (error) {
      console.error('保存失败:', error)
      message.error('保存失败')
    } finally {
      setIsSaving(false)
    }
  }, [currentQuestion, currentIndex, ocrText, options, answer])
  
  // 切换题目
  const handleSwitchQuestion = useCallback(async (index: number) => {
    if (index < 0 || index >= questions.length) return
    
    if (currentQuestion) {
      await handleSave()
    }
    
    // 关闭上传模式，显示编辑面板
    setShowUploadMode(false)
    setCurrentIndex(index)
  }, [questions.length, currentQuestion, handleSave])
  
  // 删除题目
  const handleDeleteQuestion = useCallback(async () => {
    if (!window.electronAPI || !currentQuestion) return
    
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这道题目吗？',
      okType: 'danger',
      onOk: async () => {
        try {
          await window.electronAPI.question.delete(currentQuestion.id)
          
          const newQuestions = questions.filter((_, i) => i !== currentIndex)
          setQuestions(newQuestions)
          
          if (currentIndex >= newQuestions.length) {
            setCurrentIndex(Math.max(0, newQuestions.length - 1))
          }
          
          message.success('删除成功')
        } catch (error) {
          message.error('删除失败')
        }
      }
    })
  }, [currentQuestion, currentIndex, questions])
  
  // 更新题目内容
  const handleOcrTextChange = useCallback((value: string) => {
    setOcrText(value)
    markChanged()
    
    // 记录历史（非撤销/重做操作时）
    if (!isUndoRedo.current) {
      setHistory(prev => {
        const newHistory = prev.slice(0, historyIndex + 1)
        newHistory.push(value)
        // 限制历史记录数量
        if (newHistory.length > 50) newHistory.shift()
        return newHistory
      })
      setHistoryIndex(prev => Math.min(prev + 1, 49))
    }
    isUndoRedo.current = false
  }, [markChanged, historyIndex])
  
  // 撤销
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      isUndoRedo.current = true
      const newIndex = historyIndex - 1
      setHistoryIndex(newIndex)
      setOcrText(history[newIndex])
      markChanged()
    }
  }, [historyIndex, history, markChanged])
  
  // 重做
  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      isUndoRedo.current = true
      const newIndex = historyIndex + 1
      setHistoryIndex(newIndex)
      setOcrText(history[newIndex])
      markChanged()
    }
  }, [historyIndex, history, markChanged])
  
  // 切换题型
  const handleTypeChange = useCallback(async (newType: string) => {
    if (!window.electronAPI || !currentQuestion) return
    
    try {
      // 更新数据库
      await window.electronAPI.question.update(currentQuestion.id, {
        type: newType
      })
      
      // 更新本地状态
      setQuestions(prev => prev.map((q, i) => 
        i === currentIndex ? { ...q, type: newType } : q
      ))
      
      // 如果是判断题，自动设置选项
      if (newType === 'trueFalse') {
        setOptions([
          { label: 'A', content: '正确' },
          { label: 'B', content: '错误' }
        ])
        // 如果原答案不是A或B，清空答案
        if (answer && !['A', 'B'].includes(answer)) {
          setAnswer('')
        }
      }
      
      markChanged()
      message.success('题型已切换')
    } catch (error) {
      console.error('切换题型失败:', error)
      message.error('切换题型失败')
    }
  }, [currentQuestion, currentIndex, answer, markChanged])
  
  // 添加选项
  const handleAddOption = useCallback(() => {
    const labels = 'ABCDEFGHIJ'.split('')
    const nextLabel = labels[options.length] || labels[labels.length - 1]
    setOptions(prev => [...prev, { label: nextLabel, content: '' }])
    markChanged()
  }, [options.length, markChanged])
  
  // 修改选项内容
  const handleOptionChange = useCallback((index: number, content: string) => {
    setOptions(prev => prev.map((opt, i) => 
      i === index ? { ...opt, content } : opt
    ))
    markChanged()
  }, [markChanged])
  
  // 删除选项
  const handleDeleteOption = useCallback((index: number) => {
    setOptions(prev => {
      const newOptions = prev.filter((_, i) => i !== index)
      // 重新分配标签 A, B, C, D...
      return newOptions.map((opt, i) => ({
        ...opt,
        label: 'ABCDEFGHIJ'[i] || opt.label
      }))
    })
    markChanged()
  }, [markChanged])
  
  // 切换正确答案
  const handleToggleAnswer = useCallback((label: string) => {
    if (currentQuestion?.type === 'multiChoice') {
      // 多选题：切换选中状态
      setAnswer(prev => {
        const labels = prev.split('').filter(l => l.trim())
        if (labels.includes(label)) {
          return labels.filter(l => l !== label).join('')
        } else {
          return [...labels, label].sort().join('')
        }
      })
    } else {
      // 单选题：直接设置
      setAnswer(prev => prev === label ? '' : label)
    }
    markChanged()
  }, [currentQuestion?.type, markChanged])
  
  // 修改答案（填空题/解答题）
  const handleAnswerChange = useCallback((value: string) => {
    setAnswer(value)
    markChanged()
  }, [markChanged])
  
  // 导出课件
  const handleExportCourseware = useCallback(async (coursewareId: string) => {
    if (!window.electronAPI) return
    
    setIsExporting(true)
    try {
      const result = await window.electronAPI.courseware.export(coursewareId)
      if (result.success) {
        message.success('课件导出成功')
      } else if (result.error !== '用户取消') {
        message.error(result.error || '导出失败')
      }
    } catch (error) {
      console.error('导出失败:', error)
      message.error('导出失败')
    } finally {
      setIsExporting(false)
    }
  }, [])
  
  // 导出当前选中的课件
  const handleExportCurrentCourseware = useCallback(async () => {
    if (!selectedId) {
      message.warning('请先选择要导出的课件')
      return
    }
    await handleExportCourseware(selectedId)
  }, [selectedId, handleExportCourseware])
  
  // 双击编辑课件名称
  const handleDoubleClickCourseware = useCallback((id: string, currentTitle: string) => {
    setEditingCoursewareId(id)
    setEditingCoursewareName(currentTitle)
  }, [])
  
  // 保存课件名称
  const handleSaveCoursewareName = useCallback(async () => {
    if (!editingCoursewareId || !window.electronAPI) return
    
    const newName = editingCoursewareName.trim()
    if (!newName) {
      message.warning('课件名称不能为空')
      return
    }
    
    try {
      await window.electronAPI.courseware.update(editingCoursewareId, { title: newName })
      setCoursewares(prev => prev.map(c => 
        c.id === editingCoursewareId ? { ...c, title: newName } : c
      ))
      message.success('课件名称已更新')
    } catch (error) {
      console.error('更新课件名称失败:', error)
      message.error('更新失败')
    } finally {
      setEditingCoursewareId(null)
      setEditingCoursewareName('')
    }
  }, [editingCoursewareId, editingCoursewareName])
  
  // 取消编辑课件名称
  const handleCancelEditCoursewareName = useCallback(() => {
    setEditingCoursewareId(null)
    setEditingCoursewareName('')
  }, [])

  // 导入课件
  const handleImportCourseware = useCallback(async () => {
    if (!window.electronAPI) return
    
    setIsImporting(true)
    try {
      const result = await window.electronAPI.courseware.import()
      if (result.success && result.data) {
        message.success(`课件“${result.data.title}”导入成功`)
        await loadCoursewares()
        setSelectedId(result.data.coursewareId)
      } else if (result.error !== '用户取消') {
        message.error(result.error || '导入失败')
      }
    } catch (error) {
      console.error('导入失败:', error)
      message.error('导入失败')
    } finally {
      setIsImporting(false)
    }
  }, [loadCoursewares])
  
  // 开始演示
  const handlePresentation = useCallback(async () => {
    if (!selectedId) return
    await handleSave()
    navigate(`/presentation/${selectedId}`)
  }, [handleSave, selectedId, navigate])
  
  // 删除课件
  const handleDeleteCourseware = useCallback(async (id: string) => {
    if (!window.electronAPI) return
    
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个课件吗？所有题目数据将被删除。',
      okType: 'danger',
      onOk: async () => {
        try {
          await window.electronAPI.courseware.delete(id)
          
          if (selectedId === id) {
            setSelectedId(null)
            // 清空题目列表和相关状态
            setQuestions([])
            setCurrentIndex(0)
            setOcrText('')
            setCurrentImageBase64('')
            setOptions([])
            setAnswer('')
          }
          
          await loadCoursewares()
          message.success('删除成功')
        } catch (error) {
          message.error('删除失败')
        }
      }
    })
  }, [selectedId, loadCoursewares])
  
  // ========== 上传功能（由 useImageUpload hook 提供） ==========
  
  // 创建课件
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
      if (!window.electronAPI) {
        message.error('请在 Electron 环境中运行')
        return
      }
      
      const coursewareResult = await window.electronAPI.courseware.create({
        title: coursewareTitle.trim(),
        status: 'draft'
      })
      if (!coursewareResult.success || !coursewareResult.data) {
        throw new Error(coursewareResult.error || '创建课件失败')
      }
      
      const coursewareId = coursewareResult.data.id
      const savedPaths: string[] = []
      
      for (let i = 0; i < uploadImages.length; i++) {
        const img = uploadImages[i]
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
      
      const questionsData = uploadImages.map((img, index) => {
        const stem = img.stem || img.ocrText || ''
        const opts = img.options || []
        let type: QuestionType = 'shortAnswer'
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
      
      message.success('课件创建成功！')
      setShowUploadMode(false)
      setUploadImages([])
      setCoursewareTitle('')
      await loadCoursewares()
      setSelectedId(coursewareId)
      
    } catch (error) {
      message.error('创建课件失败: ' + (error instanceof Error ? error.message : String(error)))
    } finally {
      setIsCreating(false)
    }
  }, [uploadImages, coursewareTitle, loadCoursewares])
  
  // 拖拽上传配置
  const uploadProps: UploadProps = {
    name: 'file',
    multiple: true,
    accept: 'image/*',
    showUploadList: false,
    beforeUpload: async (file) => {
      const id = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const reader = new FileReader()
      reader.onload = (e) => {
        const base64 = e.target?.result as string
        setUploadImages(prev => [...prev, {
          id,
          path: file.name,
          name: file.name,
          thumbnail: base64,
          base64Data: base64
        }])
      }
      reader.readAsDataURL(file)
      return false
    }
  }
  
  // 快捷键
  const shortcuts: ShortcutConfig[] = useMemo(() => [
    { key: 's', ctrl: true, handler: handleSave, description: '保存' },
    { key: 'z', ctrl: true, handler: handleUndo, description: '撤销' },
    { key: 'y', ctrl: true, handler: handleRedo, description: '重做' },
    { key: 'ArrowLeft', handler: () => currentIndex > 0 && handleSwitchQuestion(currentIndex - 1), description: '上一题' },
    { key: 'ArrowRight', handler: () => currentIndex < questions.length - 1 && handleSwitchQuestion(currentIndex + 1), description: '下一题' }
  ], [handleSave, handleUndo, handleRedo, currentIndex, questions.length, handleSwitchQuestion])
  
  useKeyboardShortcuts(shortcuts, { disableInInput: true })
  
  // 格式化日期
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return `${date.getMonth() + 1}/${date.getDate()}`
  }
  
  return (
    <div className={styles.container}>
      {/* 统一工具栏 - 单行布局 */}
      <header className={styles.header}>
        {/* 左侧：Logo + 设置 */}
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
          {showSaveHint && (
            <span className={styles.saveHint}>保存成功</span>
          )}
        </div>
        
        {/* 中间：题目数 */}
        {selectedId && questions.length > 0 && (
          <div className={styles.headerCenter}>
            <span className={styles.questionNav}>
              第 {currentIndex + 1} / {questions.length} 题
            </span>
          </div>
        )}
        
        {/* 右侧：撤销 重做 保存 演示 新建课件 */}
        <div className={styles.headerRight}>
          {selectedId && questions.length > 0 && (
            <>
              <Tooltip title="撤销 (Ctrl+Z)">
                <Button 
                  icon={<UndoOutlined />} 
                  className={styles.toolBtn}
                  onClick={handleUndo}
                  disabled={historyIndex <= 0}
                >撤销</Button>
              </Tooltip>
              <Tooltip title="重做 (Ctrl+Y)">
                <Button 
                  icon={<RedoOutlined />} 
                  className={styles.toolBtn}
                  onClick={handleRedo}
                  disabled={historyIndex >= history.length - 1}
                >重做</Button>
              </Tooltip>
              <Button 
                icon={<SaveOutlined />}
                className={styles.toolBtn}
                onClick={handleSave}
                loading={isSaving}
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
        {/* 左侧试卷列表 */}
        <aside className={styles.leftPanel}>
          <div className={`${styles.glassCard} ${styles.coursewareList}`}>
            <div className={styles.listHeader}>
              <span className={styles.title}>我的课件</span>
              <div className={styles.headerActions}>
                <Tooltip title="导入课件">
                  <ImportOutlined 
                    className={styles.actionIcon}
                    onClick={handleImportCourseware}
                    style={{ cursor: isImporting ? 'wait' : 'pointer' }}
                  />
                </Tooltip>
                <Tooltip title="导出课件">
                  <ExportOutlined 
                    className={styles.actionIcon}
                    onClick={handleExportCurrentCourseware}
                    style={{ cursor: isExporting || !selectedId ? 'not-allowed' : 'pointer', opacity: selectedId ? 1 : 0.5 }}
                  />
                </Tooltip>
                <Tooltip title="刷新">
                  <ReloadOutlined 
                    className={styles.actionIcon}
                    spin={loadingList}
                    onClick={loadCoursewares}
                  />
                </Tooltip>
              </div>
            </div>
            
            <div className={styles.listContent}>
              {loadingList ? (
                <div className={styles.loading}>
                  <Spin />
                </div>
              ) : coursewares.length === 0 ? (
                <div className={styles.emptyState}>
                  <FolderOpenOutlined className={styles.emptyIcon} />
                  <span className={styles.emptyText}>暂无课件</span>
                </div>
              ) : (
                coursewares.map(item => (
                  <div
                    key={item.id}
                    className={`${styles.coursewareItem} ${selectedId === item.id ? styles.active : ''}`}
                    onClick={() => handleSelectCourseware(item.id)}
                  >
                    <FileTextOutlined className={styles.itemIcon} />
                    <div className={styles.itemInfo}>
                      {editingCoursewareId === item.id ? (
                        <Input
                          size="small"
                          value={editingCoursewareName}
                          onChange={(e) => setEditingCoursewareName(e.target.value)}
                          onPressEnter={handleSaveCoursewareName}
                          onBlur={handleSaveCoursewareName}
                          onKeyDown={(e) => e.key === 'Escape' && handleCancelEditCoursewareName()}
                          autoFocus
                          className={styles.editInput}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <div 
                          className={styles.itemTitle}
                          onDoubleClick={(e) => {
                            e.stopPropagation()
                            handleDoubleClickCourseware(item.id, item.title)
                          }}
                          title="双击编辑名称"
                        >
                          {item.title}
                        </div>
                      )}
                      <div className={styles.itemMeta}>{formatDate(item.created_at)}</div>
                    </div>
                    <Dropdown
                      menu={{
                        items: [
                          { key: 'delete', label: '删除', danger: true, icon: <DeleteOutlined /> }
                        ],
                        onClick: ({ key }) => {
                          if (key === 'delete') {
                            handleDeleteCourseware(item.id)
                          }
                        }
                      }}
                      trigger={['click']}
                    >
                      <Button 
                        type="text" 
                        size="small"
                        icon={<MoreOutlined />}
                        className={styles.itemActions}
                        onClick={e => e.stopPropagation()}
                        style={{ color: 'white' }}
                      />
                    </Dropdown>
                  </div>
                ))
              )}
            </div>
          </div>
          
          {/* 题目列表 */}
          {selectedId && questions.length > 0 && (
            <div className={`${styles.glassCard} ${styles.questionList}`}>
              <div className={styles.listHeader}>
                <span className={styles.title}>题目列表</span>
                <span className={styles.questionCount}>{currentIndex + 1}/{questions.length}</span>
              </div>
              <div className={styles.listContent}>
                {questions.map((q, index) => (
                  <div
                    key={q.id}
                    className={`${styles.questionItem} ${index === currentIndex ? styles.active : ''}`}
                    onClick={() => handleSwitchQuestion(index)}
                  >
                    <span className={styles.questionNumber}>{index + 1}</span>
                    <span className={styles.questionPreview}>
                      {q.ocr_text?.substring(0, 15) || '未识别'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>
        
        {/* 右侧编辑面板/上传界面 */}
        <section className={styles.rightPanel}>
          {showUploadMode ? (
            // 上传模式界面
            <div className={styles.editorContainer}>
              <div className={styles.uploadPanel}>
                <div className={styles.uploadHeader}>
                  <Title level={4} style={{ margin: 0, color: 'white' }}>上传试卷</Title>
                  <Button 
                    type="text" 
                    icon={<CloseOutlined />}
                    onClick={handleCancelUpload}
                    style={{ color: 'white' }}
                  />
                </div>
                <Paragraph style={{ color: 'rgba(255, 255, 255, 0.7)', marginBottom: 16 }}>
                  选择试卷图片，系统将自动识别题目内容并生成课件
                </Paragraph>
                
                {uploadImages.length === 0 ? (
                  <Dragger {...uploadProps} className={styles.uploadDragger}>
                    <p className="ant-upload-drag-icon">
                      <InboxOutlined style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: 48 }} />
                    </p>
                    <p style={{ color: 'white' }}>点击或拖拽文件到此区域上传</p>
                    <p style={{ color: 'rgba(255, 255, 255, 0.6)' }}>支持单个或批量上传试卷图片</p>
                  </Dragger>
                ) : (
                  <div className={styles.uploadImageList}>
                    {uploadImages.map((img, index) => (
                      <div key={img.id} className={styles.uploadImageItem}>
                        <div className={styles.imageIndex}>{index + 1}</div>
                        <div className={styles.imageThumbnail}>
                          {img.thumbnail ? (
                            <img src={img.thumbnail} alt={img.name} />
                          ) : (
                            <Spin size="small" />
                          )}
                        </div>
                        <div className={styles.imageInfo}>
                          <Text ellipsis className={styles.imageName} style={{ color: 'white' }}>{img.name}</Text>
                          {img.isProcessing && (
                            <Progress percent={img.ocrProgress || 0} size="small" />
                          )}
                          {img.ocrText && (
                            <Text type="secondary" ellipsis style={{ color: 'rgba(255,255,255,0.6)' }}>
                              {img.ocrText.substring(0, 50)}...
                            </Text>
                          )}
                        </div>
                        <div className={styles.imageActions}>
                          <Button 
                            type="text" 
                            icon={<EyeOutlined />}
                            onClick={() => handlePreviewUploadImage(img)}
                            style={{ color: 'white' }}
                          />
                          <Button 
                            type="text" 
                            icon={<ScanOutlined />}
                            onClick={() => handleAutoSplit(img.id)}
                            loading={isSplitting}
                            style={{ color: 'white' }}
                            title="自动切题"
                          />
                          <Tooltip title="擦除笔迹">
                            <Button 
                              type="text" 
                              icon={<ClearOutlined />}
                              onClick={() => handleEraseHandwriting(img.id)}
                              loading={isErasing}
                              style={{ color: 'white' }}
                            />
                          </Tooltip>
                          <Button 
                            type="text" 
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => handleRemoveUploadImage(img.id)}
                            title="删除"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {isSplitting && (
                  <Alert
                    type="info"
                    message={
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>正在自动切题</span>
                        <Button 
                          type="link" 
                          danger
                          icon={<StopOutlined />}
                          onClick={() => handleCancelTask(splitProgress.taskId)}
                          style={{ padding: 0 }}
                        >
                          取消
                        </Button>
                      </div>
                    }
                    description={
                      <div>
                        <Progress percent={splitProgress.percent} size="small" />
                        <div style={{ marginTop: 4 }}>{splitProgress.status}</div>
                        {splitProgress.isFirstRun && (
                          <div style={{ marginTop: 8, color: '#faad14', fontSize: 12 }}>
                            💡 温馨提示：首次识别需要加载OCR模型，通常需要30-60秒，请耐心等待。
                          </div>
                        )}
                      </div>
                    }
                    style={{ marginTop: 16 }}
                  />
                )}
                
                <div className={styles.uploadActions}>
                  <Button 
                    icon={<PlusOutlined />}
                    onClick={handleSelectImages}
                    loading={isSelecting}
                    className={styles.toolBtn}
                  >
                    添加图片
                  </Button>
                  <Tooltip title="将所有图片智能切分为单道题目">
                    <Button 
                      icon={<ScanOutlined />}
                      onClick={handleSplitAll}
                      disabled={uploadImages.length === 0}
                      loading={isSplitting}
                      className={styles.toolBtn}
                    >
                      批量切题
                    </Button>
                  </Tooltip>
                  <Tooltip title="自动矫正所有图片的倾斜和白边">
                    <Button 
                      icon={<RotateRightOutlined />}
                      onClick={handleCorrectAll}
                      disabled={uploadImages.length === 0}
                      className={styles.toolBtn}
                    >
                      批量矫正
                    </Button>
                  </Tooltip>
                  <Tooltip title="擦除所有图片的手写笔迹">
                    <Button 
                      icon={<ClearOutlined />}
                      onClick={handleEraseAll}
                      disabled={uploadImages.length === 0}
                      loading={isErasing}
                      className={styles.toolBtn}
                    >
                      批量擦除
                    </Button>
                  </Tooltip>
                  <Button 
                    type="primary"
                    icon={<FileAddOutlined />}
                    onClick={() => setShowTitleModal(true)}
                    disabled={uploadImages.length === 0}
                    loading={isCreating}
                    className={styles.primaryBtn}
                  >
                    创建课件
                  </Button>
                </div>
              </div>
            </div>
          ) : !selectedId ? (
            <div className={styles.welcomePlaceholder}>
              <Spin size="large" />
            </div>
          ) : isLoading ? (
            <div className={styles.welcomePlaceholder}>
              <Spin size="large" />
            </div>
          ) : questions.length === 0 ? (
            <div className={styles.welcomePlaceholder}>
              <FileTextOutlined className={styles.welcomeIcon} />
              <div className={styles.welcomeTitle}>暂无题目</div>
              <div className={styles.welcomeDesc}>该课件没有识别到题目</div>
            </div>
          ) : (
            <div className={styles.editorContainer}>
              {/* 编辑内容 - 单栏布局 */}
              <div className={styles.editorContent}>
                <div className={styles.questionDetailPanel}>
                  <div className={styles.panelHeader}>
                    <div className={styles.panelHeaderLeft}>
                      <span className={styles.panelTitle}>题目详情</span>
                      {currentQuestion?.type && (
                        <span className={styles.questionTypeTag}>
                          {QuestionClassifier.getTypeName(currentQuestion.type as QuestionType)}
                        </span>
                      )}
                    </div>
                    <Button 
                      size="small"
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={handleDeleteQuestion}
                    >
                      删除
                    </Button>
                  </div>
                  
                  <div className={styles.questionContent}>
                    {/* 题型切换 */}
                    <div className={styles.typeSection}>
                      <span className={styles.sectionLabel}>题型：</span>
                      <div className={styles.typeButtons}>
                        {[
                          { key: 'choice', label: '选择题' },
                          { key: 'multiChoice', label: '多选题' },
                          { key: 'fillBlank', label: '填空题' },
                          { key: 'trueFalse', label: '判断题' },
                          { key: 'shortAnswer', label: '解答题' }
                        ].map(t => (
                          <Button
                            key={t.key}
                            size="small"
                            type={currentQuestion?.type === t.key ? 'primary' : 'default'}
                            onClick={() => handleTypeChange(t.key)}
                            className={styles.typeBtn}
                          >
                            {t.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                    
                    {/* 题干编辑 */}
                    <div className={styles.stemSection}>
                      <span className={styles.sectionLabel}>题干：</span>
                      <TextArea
                        value={ocrText}
                        onChange={(e) => handleOcrTextChange(e.target.value)}
                        placeholder="请输入题目内容..."
                        className={styles.questionEditor}
                        autoSize={{ minRows: 3, maxRows: 8 }}
                      />
                    </div>
                    
                    {/* 选项编辑区 - 选择题/多选题/判断题 */}
                    {(currentQuestion?.type === 'choice' || 
                      currentQuestion?.type === 'multiChoice' || 
                      currentQuestion?.type === 'trueFalse' ||
                      options.length > 0) && (
                      <div className={styles.optionsSection}>
                        <div className={styles.sectionHeader}>
                          <span className={styles.sectionLabel}>
                            {currentQuestion?.type === 'trueFalse' ? '判断选项：' : '选项：'}
                          </span>
                          {currentQuestion?.type !== 'trueFalse' && (
                            <Button
                              type="link"
                              size="small"
                              icon={<PlusOutlined />}
                              onClick={handleAddOption}
                            >
                              添加选项
                            </Button>
                          )}
                        </div>
                        <div className={styles.optionsList}>
                          {options.map((option, index) => (
                            <div 
                              key={index} 
                              className={`${styles.optionItem} ${styles.optionEditable} ${answer.includes(option.label) ? styles.optionSelected : ''}`}
                            >
                              {/* 选中正确答案按钮 */}
                              <Tooltip title={answer.includes(option.label) ? '取消正确答案' : '设为正确答案'}>
                                <div 
                                  className={`${styles.optionCheck} ${answer.includes(option.label) ? styles.checked : ''}`}
                                  onClick={() => handleToggleAnswer(option.label)}
                                >
                                  {answer.includes(option.label) && <CheckOutlined />}
                                </div>
                              </Tooltip>
                              {/* 选项标签 */}
                              <span className={styles.optionLabel}>{option.label}.</span>
                              {/* 选项内容编辑 */}
                              <Input
                                value={option.content}
                                onChange={(e) => handleOptionChange(index, e.target.value)}
                                placeholder="请输入选项内容"
                                className={styles.optionInput}
                              />
                              {/* 删除选项按钮 */}
                              {currentQuestion?.type !== 'trueFalse' && options.length > 2 && (
                                <Tooltip title="删除选项">
                                  <Button
                                    type="text"
                                    size="small"
                                    danger
                                    icon={<DeleteOutlined />}
                                    onClick={() => handleDeleteOption(index)}
                                    className={styles.optionDeleteBtn}
                                  />
                                </Tooltip>
                              )}
                            </div>
                          ))}
                        </div>
                        {answer && (
                          <div className={styles.answerDisplay}>
                            <CheckOutlined className={styles.answerIcon} />
                            <span className={styles.answerLabel}>正确答案</span>
                            <span className={styles.answerValue}>{answer}</span>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* 填空题答案编辑 */}
                    {currentQuestion?.type === 'fillBlank' && (
                      <div className={styles.fillBlankSection}>
                        <span className={styles.sectionLabel}>参考答案：</span>
                        <Input
                          value={answer}
                          onChange={(e) => handleAnswerChange(e.target.value)}
                          placeholder="请输入填空题答案，多个空用 | 分隔"
                          className={styles.answerInput}
                        />
                      </div>
                    )}
                    
                    {/* 解答题答案编辑 */}
                    {currentQuestion?.type === 'shortAnswer' && (
                      <div className={styles.shortAnswerSection}>
                        <span className={styles.sectionLabel}>参考答案：</span>
                        <TextArea
                          value={answer}
                          onChange={(e) => handleAnswerChange(e.target.value)}
                          placeholder="请输入解答题参考答案..."
                          className={styles.answerTextarea}
                          autoSize={{ minRows: 2, maxRows: 6 }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
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
      
      {/* 课件名称弹窗 */}
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
