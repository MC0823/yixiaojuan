/**
 * 课件管理 Hook
 * 处理课件的CRUD操作、选择、导入导出等
 */
import { useState, useCallback, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { App, Modal } from 'antd'

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
  options?: string
  answer?: string
  annotations?: string
}

interface UseCoursewareReturn {
  // 状态
  coursewares: Courseware[]
  loadingList: boolean
  selectedId: string | null
  questions: QuestionData[]
  currentIndex: number
  isLoading: boolean
  isExporting: boolean
  isImporting: boolean
  editingCoursewareId: string | null
  editingCoursewareName: string
  
  // 方法
  setSelectedId: (id: string | null) => void
  setQuestions: React.Dispatch<React.SetStateAction<QuestionData[]>>
  setCurrentIndex: React.Dispatch<React.SetStateAction<number>>
  setEditingCoursewareId: (id: string | null) => void
  setEditingCoursewareName: (name: string) => void
  
  // 处理函数
  loadCoursewares: () => Promise<void>
  loadCoursewareDetail: (id: string) => Promise<void>
  handleSelectCourseware: (id: string) => void
  handleDeleteCourseware: (id: string) => void
  handleExportCourseware: (id: string) => Promise<void>
  handleExportCurrentCourseware: () => Promise<void>
  handleImportCourseware: () => Promise<void>
  handleDoubleClickCourseware: (id: string, title: string) => void
  handleSaveCoursewareName: () => Promise<void>
  handleCancelEditCoursewareName: () => void
  handlePresentation: () => Promise<void>
}

export function useCourseware(): UseCoursewareReturn {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  
  // 课件列表状态
  const [coursewares, setCoursewares] = useState<Courseware[]>([])
  const [loadingList, setLoadingList] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  
  // 题目状态
  const [questions, setQuestions] = useState<QuestionData[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  
  // 导入导出状态
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  
  // 编辑课件名称
  const [editingCoursewareId, setEditingCoursewareId] = useState<string | null>(null)
  const [editingCoursewareName, setEditingCoursewareName] = useState('')

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

  // 加载课件详情
  const loadCoursewareDetail = useCallback(async (id: string) => {
    if (!window.electronAPI) return
    
    setIsLoading(true)
    try {
      const questionsResult = await window.electronAPI.question.getByCourseware(id)
      if (questionsResult.success && questionsResult.data) {
        setQuestions(questionsResult.data)
        setCurrentIndex(0)
      }
    } catch (error) {
      console.error('加载课件详情失败:', error)
      message.error('加载课件详情失败')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // 首次加载
  useEffect(() => {
    loadCoursewares()
  }, [loadCoursewares])

  // 从 URL 参数或 localStorage 读取要选中的课件 ID
  useEffect(() => {
    if (coursewares.length === 0) return
    
    // 优先从 URL 参数读取
    const coursewareId = searchParams.get('coursewareId')
    if (coursewareId) {
      const exists = coursewares.some(c => c.id === coursewareId)
      if (exists) {
        setSelectedId(coursewareId)
        return
      }
    }
    
    // 其次从 localStorage 读取
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
  }, [searchParams, coursewares, selectedId])

  // 选中课件变化时加载详情
  useEffect(() => {
    if (selectedId) {
      loadCoursewareDetail(selectedId)
    } else {
      setQuestions([])
    }
  }, [selectedId, loadCoursewareDetail])

  // 选择课件
  const handleSelectCourseware = useCallback((id: string) => {
    setSelectedId(id)
    localStorage.setItem('lastSelectedCoursewareId', id)
  }, [])

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
          
          // 重新加载课件列表
          const result = await window.electronAPI.courseware.getAll()
          const newCoursewares = result.success && result.data ? result.data : []
          setCoursewares(newCoursewares)
          
          // 如果删除的是当前选中的课件，需要更新选中状态
          if (selectedId === id) {
            // 清空题目列表
            setQuestions([])
            setCurrentIndex(0)
            
            // 如果还有其他课件，自动选中第一个
            if (newCoursewares.length > 0) {
              const nextId = newCoursewares[0].id
              setSelectedId(nextId)
              localStorage.setItem('lastSelectedCoursewareId', nextId)
            } else {
              // 没有课件了，清空选中状态
              setSelectedId(null)
              localStorage.removeItem('lastSelectedCoursewareId')
            }
          }
          
          message.success('删除成功')
        } catch (error) {
          message.error('删除失败')
        }
      }
    })
  }, [selectedId])

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

  // 导入课件
  const handleImportCourseware = useCallback(async () => {
    if (!window.electronAPI) return
    
    setIsImporting(true)
    try {
      const result = await window.electronAPI.courseware.import()
      if (result.success && result.data) {
        message.success(`课件"${result.data.title}"导入成功`)
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

  // 开始演示
  const handlePresentation = useCallback(async () => {
    if (!selectedId) return
    navigate(`/presentation/${selectedId}`)
  }, [selectedId, navigate])

  return {
    coursewares,
    loadingList,
    selectedId,
    questions,
    currentIndex,
    isLoading,
    isExporting,
    isImporting,
    editingCoursewareId,
    editingCoursewareName,
    setSelectedId,
    setQuestions,
    setCurrentIndex,
    setEditingCoursewareId,
    setEditingCoursewareName,
    loadCoursewares,
    loadCoursewareDetail,
    handleSelectCourseware,
    handleDeleteCourseware,
    handleExportCourseware,
    handleExportCurrentCourseware,
    handleImportCourseware,
    handleDoubleClickCourseware,
    handleSaveCoursewareName,
    handleCancelEditCoursewareName,
    handlePresentation
  }
}
