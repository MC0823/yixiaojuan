/**
 * 题目编辑 Hook
 * 处理题目的编辑、保存、撤销重做等
 */
import { useState, useRef, useCallback, useEffect } from 'react'
import { App, Modal } from 'antd'
import { QuestionClassifier } from '../../../utils/questionClassifier'

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

interface UseQuestionEditorOptions {
  questions: QuestionData[]
  setQuestions: React.Dispatch<React.SetStateAction<QuestionData[]>>
  currentIndex: number
  setCurrentIndex: React.Dispatch<React.SetStateAction<number>>
  selectedId: string | null
  setShowUploadMode: (show: boolean) => void
}

interface UseQuestionEditorReturn {
  // 状态
  ocrText: string
  options: { label: string; content: string }[]
  answer: string
  isSaving: boolean
  historyIndex: number
  history: string[]
  showSaveHint: boolean
  
  // 方法
  setOcrText: (text: string) => void
  setOptions: React.Dispatch<React.SetStateAction<{ label: string; content: string }[]>>
  setAnswer: (answer: string) => void
  
  // 处理函数
  handleSave: () => Promise<void>
  handleSwitchQuestion: (index: number) => Promise<void>
  handleDeleteQuestion: () => void
  handleAddQuestion: () => Promise<void>
  handleOcrTextChange: (value: string) => void
  handleUndo: () => void
  handleRedo: () => void
  handleTypeChange: (newType: string) => Promise<void>
  handleAddOption: () => void
  handleOptionChange: (index: number, content: string) => void
  handleDeleteOption: (index: number) => void
  handleToggleAnswer: (label: string) => void
  handleAnswerChange: (value: string) => void
  currentQuestion: QuestionData | undefined
}

export function useQuestionEditor({
  questions,
  setQuestions,
  currentIndex,
  setCurrentIndex,
  selectedId,
  setShowUploadMode
}: UseQuestionEditorOptions): UseQuestionEditorReturn {
  const { message } = App.useApp()
  
  const [ocrText, setOcrText] = useState('')
  const [options, setOptions] = useState<{ label: string; content: string }[]>([])
  const [answer, setAnswer] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  
  // 撤销/重做历史
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const isUndoRedo = useRef(false)
  
  // 自动保存
  const autoSaveTimer = useRef<NodeJS.Timeout | null>(null)
  const hasChanges = useRef(false)
  
  // 保存成功提示
  const [showSaveHint, setShowSaveHint] = useState(false)
  const saveHintTimer = useRef<NodeJS.Timeout | null>(null)

  const currentQuestion = questions[currentIndex]

  // 标记有变更
  const markChanged = useCallback(() => {
    hasChanges.current = true
  }, [])

  // 切换题目时更新内容
  useEffect(() => {
    if (currentQuestion) {
      setOcrText(currentQuestion.ocr_text || '')
      
      // 重置历史记录
      setHistory([currentQuestion.ocr_text || ''])
      setHistoryIndex(0)
      
      // 解析选项
      if (currentQuestion.options) {
        try {
          const parsedOptions = JSON.parse(currentQuestion.options)
          const sortedOptions = [...parsedOptions].sort((a: { label: string }, b: { label: string }) =>
            a.label.localeCompare(b.label)
          )
          setOptions(sortedOptions)
        } catch {
          setOptions([])
        }
      } else {
        setOptions([])
      }
      
      // 设置答案
      setAnswer(currentQuestion.answer || '')
    }
  }, [currentIndex, currentQuestion])

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

  // 自动保存逻辑
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
  }, [currentQuestion, currentIndex, ocrText, options, answer, setQuestions])

  // 切换题目
  const handleSwitchQuestion = useCallback(async (index: number) => {
    if (index < 0 || index >= questions.length) return
    
    if (currentQuestion) {
      await handleSave()
    }
    
    setShowUploadMode(false)
    setCurrentIndex(index)
  }, [questions.length, currentQuestion, handleSave, setShowUploadMode, setCurrentIndex])

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
  }, [currentQuestion, currentIndex, questions, setQuestions, setCurrentIndex])

  // 添加新题目
  const handleAddQuestion = useCallback(async () => {
    if (!window.electronAPI || !selectedId) return

    try {
      const newOrderIndex = questions.length
      const result = await window.electronAPI.question.create({
        courseware_id: selectedId,
        order_index: newOrderIndex,
        type: 'shortAnswer',
        ocr_text: ''
      })

      if (result.success && result.data) {
        setQuestions([...questions, result.data])
        setCurrentIndex(questions.length)
        message.success('添加成功')
      }
    } catch (error) {
      message.error('添加失败')
    }
  }, [selectedId, questions, setQuestions, setCurrentIndex])

  // 更新题目内容
  const handleOcrTextChange = useCallback((value: string) => {
    setOcrText(value)
    markChanged()
    
    // 记录历史
    if (!isUndoRedo.current) {
      setHistory(prev => {
        const newHistory = prev.slice(0, historyIndex + 1)
        newHistory.push(value)
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
      await window.electronAPI.question.update(currentQuestion.id, { type: newType })
      
      setQuestions(prev => prev.map((q, i) =>
        i === currentIndex ? { ...q, type: newType } : q
      ))
      
      // 根据新题型重置状态
      if (newType === 'trueFalse') {
        setOptions([
          { label: 'A', content: '正确' },
          { label: 'B', content: '错误' }
        ])
        if (answer && !['A', 'B'].includes(answer)) {
          setAnswer('')
        }
      } else if (newType === 'fillBlank' || newType === 'shortAnswer') {
        setOptions([])
        setAnswer('')
      } else if (newType === 'choice' || newType === 'multiChoice') {
        if (options.length === 0 || (options.length === 2 && options[0]?.content === '正确')) {
          setOptions([
            { label: 'A', content: '' },
            { label: 'B', content: '' },
            { label: 'C', content: '' },
            { label: 'D', content: '' }
          ])
        }
        const validLabels = 'ABCDEFGHIJ'.split('')
        const answerChars = answer.split('')
        if (!answerChars.every(c => validLabels.includes(c))) {
          setAnswer('')
        }
      }
      
      markChanged()
      message.success('题型已切换')
    } catch (error) {
      console.error('切换题型失败:', error)
      message.error('切换题型失败')
    }
  }, [currentQuestion, currentIndex, answer, options, markChanged, setQuestions])

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
      setAnswer(prev => {
        const labels = prev.split('').filter(l => l.trim())
        if (labels.includes(label)) {
          return labels.filter(l => l !== label).join('')
        } else {
          return [...labels, label].sort().join('')
        }
      })
    } else {
      setAnswer(prev => prev === label ? '' : label)
    }
    markChanged()
  }, [currentQuestion?.type, markChanged])

  // 修改答案
  const handleAnswerChange = useCallback((value: string) => {
    setAnswer(value)
    markChanged()
  }, [markChanged])

  return {
    ocrText,
    options,
    answer,
    isSaving,
    historyIndex,
    history,
    showSaveHint,
    setOcrText,
    setOptions,
    setAnswer,
    handleSave,
    handleSwitchQuestion,
    handleDeleteQuestion,
    handleAddQuestion,
    handleOcrTextChange,
    handleUndo,
    handleRedo,
    handleTypeChange,
    handleAddOption,
    handleOptionChange,
    handleDeleteOption,
    handleToggleAnswer,
    handleAnswerChange,
    currentQuestion
  }
}

// 导出工具函数
export { QuestionClassifier }
