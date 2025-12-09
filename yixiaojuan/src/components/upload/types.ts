/**
 * 图片上传组件类型定义
 */
import type { QuestionType } from '../../utils/questionClassifier'

/**
 * 上传图片项接口
 */
export interface UploadImageItem {
  id: string
  path: string          // 文件完整路径（通过系统对话框选择）或文件名（拖拽上传）
  name: string
  thumbnail?: string
  base64Data?: string   // 拖拽上传时保存的 base64 数据
  ocrText?: string
  stem?: string         // 解析后的题干
  options?: Array<{ label: string; content: string }>  // 解析后的选项
  ocrProgress?: number
  isProcessing?: boolean
  questionType?: QuestionType
  questionNumber?: number
  sourceImage?: string  // 来源试卷名称（切分题目时记录）
}

/**
 * 上传组件属性
 */
export interface ImageUploaderProps {
  /** 已上传的图片列表 */
  images: UploadImageItem[]
  /** 图片列表变化回调 */
  onImagesChange: (images: UploadImageItem[]) => void
  /** 是否正在切题 */
  isSplitting?: boolean
  /** 切题进度 */
  splitProgress?: { percent: number; status: string }
  /** 是否正在擦除 */
  isErasing?: boolean
  /** 是否显示批量操作按钮 */
  showBatchActions?: boolean
  /** 自定义类名 */
  className?: string
}

/**
 * 图片列表项属性
 */
export interface ImageListItemProps {
  image: UploadImageItem
  index: number
  onPreview: (image: UploadImageItem) => void
  onSplit: (imageId: string) => void
  onErase: (imageId: string) => void
  onRemove: (imageId: string) => void
  isSplitting?: boolean
  isErasing?: boolean
}
