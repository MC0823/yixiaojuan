/**
 * 渲染进程 OCR 服务
 * 在浏览器环境中使用 Tesseract.js 进行文字识别
 */
import Tesseract from 'tesseract.js'

export interface OcrResult {
  text: string
  confidence: number
  blocks?: Array<{
    text: string
    confidence: number
    bbox: { x0: number; y0: number; x1: number; y1: number }
  }>
}

/**
 * 识别图片中的文字
 * @param imageSource 图片源（base64 字符串或文件路径）
 * @param language 识别语言，默认中英文
 * @param onProgress 进度回调
 */
export async function recognizeImage(
  imageSource: string,
  language: string = 'chi_sim+eng',
  onProgress?: (progress: number) => void
): Promise<OcrResult> {
  try {
    console.log('[OCR] 开始识别图片，语言:', language)
    
    const result = await Tesseract.recognize(imageSource, language, {
      logger: (info) => {
        if (info.status === 'recognizing text' && onProgress) {
          onProgress(Math.round(info.progress * 100))
        }
      }
    })
    
    console.log('[OCR] 识别完成，置信度:', result.data.confidence)
    
    // 提取文本块信息
    const blocks = result.data.blocks?.map(block => ({
      text: block.text,
      confidence: block.confidence,
      bbox: block.bbox
    })) || []
    
    return {
      text: result.data.text,
      confidence: result.data.confidence,
      blocks
    }
  } catch (error) {
    console.error('[OCR] 识别失败:', error)
    throw error
  }
}

/**
 * 批量识别图片
 */
export async function recognizeBatch(
  imageSources: string[],
  language: string = 'chi_sim+eng',
  onItemComplete?: (index: number, result: OcrResult) => void
): Promise<OcrResult[]> {
  const results: OcrResult[] = []
  
  for (let i = 0; i < imageSources.length; i++) {
    const result = await recognizeImage(imageSources[i], language)
    results.push(result)
    if (onItemComplete) {
      onItemComplete(i, result)
    }
  }
  
  return results
}
