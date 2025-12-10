/**
 * 课件编辑器 Hook
 * 封装题目编辑、选项管理、撤销重做等核心逻辑
 */
import { useState, useCallback, useRef, useEffect } from 'react'
import { message, Modal } from 'antd'

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

interface UseCoursewareEditorOptions {
  onSaveSuccess?: () => void
}

export function useCoursewareEditor(
  selectedId: string | null,
  options: UseCoursewareEditorOptions = {}
) {
  const { onSaveSuccess } = options

  // 题目列表状态
  const [questions, setQuestions] = useState<QuestionData[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // 编辑状态
  const [ocrText, setOcrText] = useState('')
  const [, setCurrentImageBase64] = useState('')
  const [optionsData, setOptionsData] = useState<{ label: string; content: string }[]>([])
  const [answer, setAnswer] = useState('')

  // 自动保存
  const autoSaveTimer = useRef<NodeJS.Timeout | null>(null)
  const hasChanges = useRef(false)

  // 撤销/重做历史记录
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const isUndoRedo = useRef(false)

  // 保存成功提示
  const [showSaveHint, setShowSaveHint] = useState(false)
  const saveHintTimer = useRef<NodeJS.Timeout | null>(null)

  const currentQuestion = questions[currentIndex]

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
          const parsedOptions = JSON.parse(currentQuestion.options)
          const sortedOptions = [...parsedOptions].sort(
            (a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label)
          )
          setOptionsData(sortedOptions)
        } catch {
          setOptionsData([])
        }
      } else {
        setOptionsData([])
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
      const optionsJson = JSON.stringify(optionsData)
      await window.electronAPI.question.update(currentQuestion.id, {
        ocr_text: ocrText,
        options: optionsJson,
        answer
      })
      hasChanges.current = false
    } catch (error) {
      console.error('自动保存失败:', error)
    }
  }, [currentQuestion, ocrText, optionsData, answer])

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
  }, [ocrText, optionsData, answer, handleAutoSave, currentQuestion])

  // 手动保存
  const handleSave = useCallback(async () => {
    if (!window.electronAPI || !currentQuestion) return

    setIsSaving(true)
    try {
      const optionsJson = JSON.stringify(optionsData)

      await window.electronAPI.question.update(currentQuestion.id, {
        ocr_text: ocrText,
        options: optionsJson,
        answer
      })

      setQuestions(prev =>
        prev.map((q, i) =>
          i === currentIndex
            ? { ...q, ocr_text: ocrText, options: optionsJson, answer }
            : q
        )
      )

      hasChanges.current = false

      // 显示保存成功提示
      if (saveHintTimer.current) {
        clearTimeout(saveHintTimer.current)
      }
      setShowSaveHint(true)
      saveHintTimer.current = setTimeout(() => {
        setShowSaveHint(false)
      }, 1500)

      onSaveSuccess?.()
    } catch (error) {
      console.error('保存失败:', error)
      message.error('保存失败')
    } finally {
      setIsSaving(false)
    }
  }, [currentQuestion, currentIndex, ocrText, optionsData, answer, onSaveSuccess])

  // 切换题目
  const handleSwitchQuestion = useCallback(
    async (index: number) => {
      if (index < 0 || index >= questions.length) return

      if (currentQuestion) {
        await handleSave()
      }

      setCurrentIndex(index)
    },
    [questions.length, currentQuestion, handleSave]
  )

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
        } catch {
          message.error('删除失败')
        }
      }
    })
  }, [currentQuestion, currentIndex, questions])

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
    } catch {
      message.error('添加失败')
    }
  }, [selectedId, questions])

  // 更新题目内容
  const handleOcrTextChange = useCallback(
    (value: string) => {
      setOcrText(value)
      markChanged()

      // 记录历史（非撤销/重做操作时）
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
    },
    [markChanged, historyIndex]
  )

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
  const handleTypeChange = useCallback(
    async (newType: string) => {
      if (!window.electronAPI || !currentQuestion) return

      try {
        await window.electronAPI.question.update(currentQuestion.id, {
          type: newType
        })

        setQuestions(prev =>
          prev.map((q, i) => (i === currentIndex ? { ...q, type: newType } : q))
        )

        // 根据新题型重置状态
        if (newType === 'trueFalse') {
          setOptionsData([
            { label: 'A', content: '正确' },
            { label: 'B', content: '错误' }
          ])
          if (answer && !['A', 'B'].includes(answer)) {
            setAnswer('')
          }
        } else if (newType === 'fillBlank' || newType === 'shortAnswer') {
          setOptionsData([])
          setAnswer('')
        } else if (newType === 'choice' || newType === 'multiChoice') {
          if (
            optionsData.length === 0 ||
            (optionsData.length === 2 && optionsData[0]?.content === '正确')
          ) {
            setOptionsData([
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
    },
    [currentQuestion, currentIndex, answer, optionsData, markChanged]
  )

  // 添加选项
  const handleAddOption = useCallback(() => {
    const labels = 'ABCDEFGHIJ'.split('')
    const nextLabel = labels[optionsData.length] || labels[labels.length - 1]
    setOptionsData(prev => [...prev, { label: nextLabel, content: '' }])
    markChanged()
  }, [optionsData.length, markChanged])

  // 修改选项内容
  const handleOptionChange = useCallback(
    (index: number, content: string) => {
      setOptionsData(prev =>
        prev.map((opt, i) => (i === index ? { ...opt, content } : opt))
      )
      markChanged()
    },
    [markChanged]
  )

  // 删除选项
  const handleDeleteOption = useCallback(
    (index: number) => {
      setOptionsData(prev => {
        const newOptions = prev.filter((_, i) => i !== index)
        return newOptions.map((opt, i) => ({
          ...opt,
          label: 'ABCDEFGHIJ'[i] || opt.label
        }))
      })
      markChanged()
    },
    [markChanged]
  )

  // 切换正确答案
  const handleToggleAnswer = useCallback(
    (label: string) => {
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
        setAnswer(prev => (prev === label ? '' : label))
      }
      markChanged()
    },
    [currentQuestion?.type, markChanged]
  )

  // 修改答案（填空题/解答题）
  const handleAnswerChange = useCallback(
    (value: string) => {
      setAnswer(value)
      markChanged()
    },
    [markChanged]
  )

  return {
    // 状态
    questions,
    currentIndex,
    currentQuestion,
    isLoading,
    isSaving,
    ocrText,
    options: optionsData,
    answer,
    history,
    historyIndex,
    showSaveHint,

    // 操作
    setQuestions,
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
    loadCoursewareDetail,

    // 辅助
    canUndo: historyIndex > 0,
    canRedo: historyIndex < history.length - 1
  }
}
