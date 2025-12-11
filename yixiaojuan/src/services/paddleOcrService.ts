/**
 * PaddleOCR 服务
 * 通过 Electron IPC 调用主进程代理的 PaddleOCR 服务
 */

// 调试模式开关
const DEBUG_OCR = false

/**
 * OCR服务管理类
 */
class OcrServiceManager {
  private isServiceStarting = false
  private serviceStartPromise: Promise<boolean> | null = null

  getStartingState() {
    return {
      isStarting: this.isServiceStarting,
      promise: this.serviceStartPromise
    }
  }

  setStarting(starting: boolean) {
    this.isServiceStarting = starting
  }

  setPromise(promise: Promise<boolean> | null) {
    this.serviceStartPromise = promise
  }
}

const ocrServiceManager = new OcrServiceManager()

/**
 * 检查 OCR 服务是否可用
 */
export async function checkOcrServerHealth(): Promise<boolean> {
  if (!window.electronAPI?.paddleOcr) {
    DEBUG_OCR && console.log('[PaddleOCR] electronAPI.paddleOcr 不可用')
    return false
  }
  try {
    const result = await window.electronAPI.paddleOcr.health()
    DEBUG_OCR && console.log('[PaddleOCR] 健康检查:', result)
    return result.healthy
  } catch (error) {
    DEBUG_OCR && console.log('[PaddleOCR] 健康检查失败:', error)
    return false
  }
}

/**
 * 启动 OCR 服务
 * @param onProgress 进度回调
 * @returns 是否启动成功
 */
export async function startOcrService(
  onProgress?: (percent: number, status: string) => void
): Promise<boolean> {
  if (!window.electronAPI?.paddleOcr?.startService) {
    DEBUG_OCR && console.log('[PaddleOCR] startService API 不可用')
    return false
  }

  const state = ocrServiceManager.getStartingState()

  // 如果已经在启动中，等待现有的启动完成
  if (state.isStarting && state.promise) {
    onProgress?.(50, 'OCR 服务正在启动中...')
    return await state.promise
  }

  // 先检查服务是否已运行
  const isHealthy = await checkOcrServerHealth()
  if (isHealthy) {
    onProgress?.(100, 'OCR 服务已就绪')
    return true
  }

  ocrServiceManager.setStarting(true)
  onProgress?.(5, '正在启动 OCR 服务...')

  const promise = (async () => {
    try {
      onProgress?.(10, '首次启动需要加载 OCR 模型，约需 30-60 秒...')

      const result = await window.electronAPI!.paddleOcr.startService()

      if (result.success) {
        onProgress?.(100, 'OCR 服务启动成功')
        DEBUG_OCR && console.log('[PaddleOCR] 服务启动成功')
        return true
      } else {
        console.error('[PaddleOCR] 服务启动失败:', result.error)
        onProgress?.(0, `启动失败: ${result.error}`)
        return false
      }
    } catch (error) {
      console.error('[PaddleOCR] 启动异常:', error)
      onProgress?.(0, `启动异常: ${error}`)
      return false
    } finally {
      ocrServiceManager.setStarting(false)
      ocrServiceManager.setPromise(null)
    }
  })()

  ocrServiceManager.setPromise(promise)
  return await promise
}

/**
 * 确保 OCR 服务可用（如果未启动则自动启动）
 * @param onProgress 进度回调
 * @returns 服务是否可用
 */
export async function ensureOcrServiceReady(
  onProgress?: (percent: number, status: string) => void
): Promise<boolean> {
  const isHealthy = await checkOcrServerHealth()
  if (isHealthy) {
    return true
  }
  return await startOcrService(onProgress)
}

/**
 * OCR 识别结果行
 */
export interface OcrLine {
  text: string
  confidence: number
  bbox: {
    x0: number
    y0: number
    x1: number
    y1: number
  }
}

/**
 * OCR 识别结果
 */
export interface OcrResult {
  success: boolean
  lines: OcrLine[]
  text: string
}

/**
 * 切分后的题目
 */
export interface SplitQuestion {
  index: number
  base64: string
  ocrText: string
  stem?: string  // 解析后的题干
  options?: Array<{ label: string; content: string }>  // 解析后的选项
  y0?: number
  y1?: number
}

/**
 * 题目切分结果
 */
export interface SplitResult {
  success: boolean
  questions: SplitQuestion[]
  total: number
  message?: string
}

/**
 * 使用 PaddleOCR 进行题目切分
 * @param imageBase64 图片的 base64 数据
 * @param onProgress 进度回调（可选）
 */
export async function paddleOcrSplit(
  imageBase64: string,
  onProgress?: (percent: number, status: string) => void
): Promise<SplitResult> {
  onProgress?.(5, '正在连接 OCR 服务...')
  
  if (!window.electronAPI?.paddleOcr) {
    throw new Error('PaddleOCR 服务不可用')
  }
  
  try {
    onProgress?.(10, '正在进行 OCR 识别...')
    
    const result = await window.electronAPI.paddleOcr.split(imageBase64)
    
    onProgress?.(80, '正在处理识别结果...')
    
    if (!result.success) {
      throw new Error(result.error || 'OCR 服务错误')
    }
    
    const data = result.data
    onProgress?.(100, `识别完成，共 ${data?.questions?.length || 0} 道题目`)
    
    return {
      success: true,
      questions: data?.questions || [],
      total: data?.questions?.length || 0
    }
  } catch (error) {
    console.error('[PaddleOCR] 切题失败:', error)
    throw error
  }
}

/**
 * 图片矫正结果
 */
export interface CorrectResult {
  success: boolean
  image: string  // 矫正后的base64图片
  corrected: boolean  // 是否进行了矫正
  details: {
    perspective_applied: boolean  // 是否进行了透视矫正
    rotation_angle: number  // 旋转角度
    cropped: boolean  // 是否进行了裁剪
    enhanced: boolean  // 是否进行了增强
    enhance_details?: {  // 增强详情
      shadow_removed: boolean
      contrast_enhanced: boolean
      sharpened: boolean
      denoised: boolean
      white_balanced: boolean
    }
  }
}

/**
 * 图片矫正选项
 */
export interface CorrectOptions {
  auto_perspective?: boolean  // 自动透视矫正
  auto_rotate?: boolean  // 自动旋转矫正
  auto_crop?: boolean  // 自动裁剪白边
  enhance?: boolean  // 图像增强（去阴影、对比度、锐化、去噪）
}

/**
 * 图片自动矫正
 * @param imageBase64 图片的 base64 数据
 * @param options 矫正选项
 */
export async function correctImage(
  imageBase64: string,
  options: CorrectOptions = {}
): Promise<CorrectResult> {
  if (!window.electronAPI?.paddleOcr?.correctImage) {
    throw new Error('图片矫正服务不可用')
  }
  
  try {
    const result = await window.electronAPI.paddleOcr.correctImage(imageBase64, options)
    
    if (!result.success) {
      throw new Error(result.error || '图片矫正失败')
    }
    
    return {
      success: true,
      image: result.data?.image || '',
      corrected: result.data?.corrected || false,
      details: {
        perspective_applied: result.data?.details?.perspective_applied || false,
        rotation_angle: result.data?.details?.rotation_angle || 0,
        cropped: result.data?.details?.cropped || false,
        enhanced: result.data?.details?.enhanced || false,
        enhance_details: result.data?.details?.enhance_details
      }
    }
  } catch (error) {
    console.error('[ImageCorrect] 矫正失败:', error)
    throw error
  }
}

/**
 * 笔迹擦除结果
 */
export interface EraseResult {
  success: boolean
  image: string  // 处理后的base64图片
  mode: string   // 使用的擦除模式
}

/**
 * 擦除模式类型
 */
export type EraseMode = 'ai' | 'auto' | 'blue' | 'black' | 'color'

/**
 * 擦除手写笔迹（AI增强版）
 * @param imageBase64 图片的 base64 数据
 * @param mode 擦除模式
 *   - 'ai': 使用AI模型智能擦除（推荐，效果最好，默认）
 *   - 'auto': OpenCV自动检测并擦除所有手写内容
 *   - 'blue': 只擦除蓝色笔迹
 *   - 'black': 只擦除黑色手写
 *   - 'color': 擦除所有彩色笔迹
 */
export async function eraseHandwriting(
  imageBase64: string,
  mode: EraseMode = 'ai'
): Promise<EraseResult> {
  if (!window.electronAPI?.paddleOcr?.eraseHandwriting) {
    throw new Error('笔迹擦除服务不可用')
  }
  
  try {
    DEBUG_OCR && console.log('[PaddleOCR] 开始擦除笔迹, 模式:', mode)
    
    const result = await window.electronAPI.paddleOcr.eraseHandwriting(imageBase64, mode)
    
    if (!result.success) {
      throw new Error(result.error || '笔迹擦除失败')
    }
    
    DEBUG_OCR && console.log('[PaddleOCR] 笔迹擦除完成')
    
    return {
      success: true,
      image: result.data?.image || '',
      mode: result.data?.mode || mode
    }
  } catch (error) {
    console.error('[PaddleOCR] 笔迹擦除失败:', error)
    throw error
  }
}
