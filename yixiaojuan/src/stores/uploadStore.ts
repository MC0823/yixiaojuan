/**
 * 上传任务全局状态管理
 * 支持后台识别、切换页面后状态保持
 */
import { create } from 'zustand'
import type { UploadImageItem } from '../components/upload/types'

export interface UploadTask {
  /** 任务ID */
  id: string
  /** 任务类型 */
  type: 'split' | 'erase' | 'correct' | 'ocr'
  /** 任务状态 */
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  /** 进度百分比 */
  percent: number
  /** 状态描述 */
  statusText: string
  /** 开始时间 */
  startTime: number
  /** 结束时间 */
  endTime?: number
  /** 错误信息 */
  error?: string
}

interface UploadState {
  /** 上传的图片列表 */
  images: UploadImageItem[]
  /** 当前任务列表 */
  tasks: UploadTask[]
  /** 是否正在选择图片 */
  isSelecting: boolean
  /** 是否有任务正在运行 */
  isProcessing: boolean
  /** 是否首次运行识别（用于显示温馨提示） */
  isFirstRun: boolean
  /** 预览相关 */
  previewVisible: boolean
  previewImage: string

  // Actions
  /** 设置图片列表 */
  setImages: (images: UploadImageItem[] | ((prev: UploadImageItem[]) => UploadImageItem[])) => void
  /** 添加图片 */
  addImages: (images: UploadImageItem[]) => void
  /** 移除图片 */
  removeImage: (id: string) => void
  /** 更新单张图片 */
  updateImage: (id: string, updates: Partial<UploadImageItem>) => void
  /** 清空所有图片 */
  clearImages: () => void
  
  /** 设置选择状态 */
  setIsSelecting: (isSelecting: boolean) => void
  
  /** 开始任务 */
  startTask: (taskId: string, type: UploadTask['type']) => void
  /** 更新任务进度 */
  updateTaskProgress: (taskId: string, percent: number, statusText: string) => void
  /** 完成任务 */
  completeTask: (taskId: string) => void
  /** 任务失败 */
  failTask: (taskId: string, error: string) => void
  /** 清除已完成的任务 */
  clearCompletedTasks: () => void
  /** 取消任务 */
  cancelTask: (taskId: string) => void
  /** 检查任务是否被取消 */
  isTaskCancelled: (taskId: string) => boolean
  /** 标记已非首次运行 */
  markNotFirstRun: () => void
  
  /** 预览图片 */
  showPreview: (image: string) => void
  /** 关闭预览 */
  hidePreview: () => void
  
  /** 重置所有状态 */
  reset: () => void
}

const initialState = {
  images: [] as UploadImageItem[],
  tasks: [] as UploadTask[],
  isSelecting: false,
  isProcessing: false,
  isFirstRun: true,
  previewVisible: false,
  previewImage: '',
}

export const useUploadStore = create<UploadState>((set, get) => ({
  ...initialState,

  setImages: (imagesOrUpdater) => {
    set((state) => {
      const newImages = typeof imagesOrUpdater === 'function' 
        ? imagesOrUpdater(state.images)
        : imagesOrUpdater
      return { images: newImages }
    })
  },

  addImages: (newImages) => {
    set((state) => ({
      images: [...state.images, ...newImages]
    }))
  },

  removeImage: (id) => {
    set((state) => ({
      images: state.images.filter(img => img.id !== id)
    }))
  },

  updateImage: (id, updates) => {
    set((state) => ({
      images: state.images.map(img => 
        img.id === id ? { ...img, ...updates } : img
      )
    }))
  },

  clearImages: () => {
    set({ images: [] })
  },

  setIsSelecting: (isSelecting) => {
    set({ isSelecting })
  },

  startTask: (taskId, type) => {
    const task: UploadTask = {
      id: taskId,
      type,
      status: 'running',
      percent: 0,
      statusText: '准备中...',
      startTime: Date.now(),
    }
    set((state) => ({
      tasks: [...state.tasks, task],
      isProcessing: true,
    }))
  },

  updateTaskProgress: (taskId, percent, statusText) => {
    set((state) => ({
      tasks: state.tasks.map(task =>
        task.id === taskId ? { ...task, percent, statusText } : task
      )
    }))
  },

  completeTask: (taskId) => {
    set((state) => {
      const updatedTasks = state.tasks.map(task =>
        task.id === taskId 
          ? { ...task, status: 'completed' as const, percent: 100, endTime: Date.now() }
          : task
      )
      const hasRunning = updatedTasks.some(t => t.status === 'running')
      return {
        tasks: updatedTasks,
        isProcessing: hasRunning,
      }
    })
  },

  failTask: (taskId, error) => {
    set((state) => {
      const updatedTasks = state.tasks.map(task =>
        task.id === taskId
          ? { ...task, status: 'failed' as const, error, endTime: Date.now() }
          : task
      )
      const hasRunning = updatedTasks.some(t => t.status === 'running')
      return {
        tasks: updatedTasks,
        isProcessing: hasRunning,
      }
    })
  },

  clearCompletedTasks: () => {
    set((state) => ({
      tasks: state.tasks.filter(t => t.status === 'running' || t.status === 'pending')
    }))
  },

  cancelTask: (taskId) => {
    set((state) => {
      const updatedTasks = state.tasks.map(task =>
        task.id === taskId
          ? { ...task, status: 'cancelled' as const, endTime: Date.now() }
          : task
      )
      const hasRunning = updatedTasks.some(t => t.status === 'running')
      return {
        tasks: updatedTasks,
        isProcessing: hasRunning,
      }
    })
  },

  isTaskCancelled: (taskId) => {
    const task = get().tasks.find(t => t.id === taskId)
    return task?.status === 'cancelled'
  },

  markNotFirstRun: () => {
    set({ isFirstRun: false })
  },

  showPreview: (image) => {
    set({ previewVisible: true, previewImage: image })
  },

  hidePreview: () => {
    set({ previewVisible: false })
  },

  reset: () => {
    set(initialState)
  },
}))

/**
 * 获取当前正在运行的任务
 */
export function getRunningTask(): UploadTask | undefined {
  return useUploadStore.getState().tasks.find(t => t.status === 'running')
}

/**
 * 获取最近完成的任务（用于通知）
 */
export function getRecentCompletedTask(): UploadTask | undefined {
  const tasks = useUploadStore.getState().tasks
  const completed = tasks.filter(t => t.status === 'completed' || t.status === 'failed')
  return completed[completed.length - 1]
}
