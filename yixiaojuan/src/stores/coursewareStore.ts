/**
 * 课件数据 Store
 * 管理课件列表、当前编辑的课件等状态
 */
import { create } from 'zustand'

export interface Question {
  id: string
  index: number
  imageUrl: string
  ocrText: string
  answer?: string
  analysis?: string
  whiteboardData?: string
}

export interface Courseware {
  id: string
  title: string
  coverImage?: string
  questions: Question[]
  createdAt: string
  updatedAt: string
  status: 'draft' | 'completed'
}

interface CoursewareState {
  // 课件列表
  list: Courseware[]
  
  // 当前编辑的课件
  current: Courseware | null
  
  // 加载状态
  isLoading: boolean
  
  // Actions
  setList: (list: Courseware[]) => void
  addCourseware: (courseware: Courseware) => void
  updateCourseware: (id: string, data: Partial<Courseware>) => void
  deleteCourseware: (id: string) => void
  setCurrent: (courseware: Courseware | null) => void
  setLoading: (loading: boolean) => void
  
  // Question Actions
  addQuestion: (question: Question) => void
  updateQuestion: (questionId: string, data: Partial<Question>) => void
  deleteQuestion: (questionId: string) => void
  reorderQuestions: (questions: Question[]) => void
}

export const useCoursewareStore = create<CoursewareState>((set, get) => ({
  list: [],
  current: null,
  isLoading: false,
  
  setList: (list) => set({ list }),
  
  addCourseware: (courseware) => set((state) => ({
    list: [courseware, ...state.list]
  })),
  
  updateCourseware: (id, data) => set((state) => ({
    list: state.list.map(item => 
      item.id === id ? { ...item, ...data, updatedAt: new Date().toISOString() } : item
    ),
    current: state.current?.id === id 
      ? { ...state.current, ...data, updatedAt: new Date().toISOString() } 
      : state.current
  })),
  
  deleteCourseware: (id) => set((state) => ({
    list: state.list.filter(item => item.id !== id),
    current: state.current?.id === id ? null : state.current
  })),
  
  setCurrent: (courseware) => set({ current: courseware }),
  
  setLoading: (isLoading) => set({ isLoading }),
  
  // Question Actions
  addQuestion: (question) => {
    const { current } = get()
    if (!current) return
    
    set({
      current: {
        ...current,
        questions: [...current.questions, question],
        updatedAt: new Date().toISOString()
      }
    })
  },
  
  updateQuestion: (questionId, data) => {
    const { current } = get()
    if (!current) return
    
    set({
      current: {
        ...current,
        questions: current.questions.map(q => 
          q.id === questionId ? { ...q, ...data } : q
        ),
        updatedAt: new Date().toISOString()
      }
    })
  },
  
  deleteQuestion: (questionId) => {
    const { current } = get()
    if (!current) return
    
    set({
      current: {
        ...current,
        questions: current.questions.filter(q => q.id !== questionId),
        updatedAt: new Date().toISOString()
      }
    })
  },
  
  reorderQuestions: (questions) => {
    const { current } = get()
    if (!current) return
    
    set({
      current: {
        ...current,
        questions,
        updatedAt: new Date().toISOString()
      }
    })
  }
}))
