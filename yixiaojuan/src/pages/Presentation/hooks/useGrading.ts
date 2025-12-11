/**
 * 批改模式 Hook
 * 处理学生答案输入、判分、统计等功能
 */
import { useState, useCallback, useMemo } from 'react'
import { App } from 'antd'

/**
 * 规范化答案对比（忽略大小写、空格、排序）
 */
const normalizeAnswer = (ans: string): string => {
  return ans.toUpperCase().replace(/[\s,，、]/g, '').split('').sort().join('')
}

interface Question {
  id: string
  answer?: string
  ocr_text?: string
}

interface UseGradingOptions {
  questions: Question[]
  currentIndex: number
}

interface UseGradingReturn {
  // 状态
  isGradingMode: boolean
  studentAnswers: Record<number, string>
  gradingResults: Record<number, boolean | null>
  currentStudentAnswer: string
  currentGradingResult: boolean | null | undefined
  
  // 方法
  toggleGradingMode: () => void
  setStudentAnswer: (answer: string) => void
  gradeCurrentQuestion: () => void
  gradeAllQuestions: () => void
}

export function useGrading({ questions, currentIndex }: UseGradingOptions): UseGradingReturn {
  const { message } = App.useApp()
  
  const [isGradingMode, setIsGradingMode] = useState(false)
  const [studentAnswers, setStudentAnswers] = useState<Record<number, string>>({})
  const [gradingResults, setGradingResults] = useState<Record<number, boolean | null>>({})

  const currentQuestion = useMemo(() => questions[currentIndex], [questions, currentIndex])
  const currentStudentAnswer = studentAnswers[currentIndex] || ''
  const currentGradingResult = gradingResults[currentIndex]

  /**
   * 切换批改模式
   */
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

  /**
   * 设置当前题目的学生答案
   */
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

  /**
   * 判分当前题目
   */
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
   * 批量判分所有题目
   */
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

  return {
    isGradingMode,
    studentAnswers,
    gradingResults,
    currentStudentAnswer,
    currentGradingResult,
    toggleGradingMode,
    setStudentAnswer,
    gradeCurrentQuestion,
    gradeAllQuestions
  }
}
