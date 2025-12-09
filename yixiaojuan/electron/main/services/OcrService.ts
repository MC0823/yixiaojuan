/**
 * OCR 识别服务
 * 使用 Tesseract.js 实现本地 OCR 文字识别
 */
import Tesseract from 'tesseract.js'
import * as fs from 'fs'
import { app } from 'electron'
import { createLogger } from '../utils/logger'

const logger = createLogger('OcrService')

/**
 * OCR 识别结果接口
 */
export interface OcrResult {
  text: string
  confidence: number
  words: OcrWord[]
  lines: OcrLine[]
}

/**
 * 单词识别结果
 */
export interface OcrWord {
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
 * 行识别结果
 */
export interface OcrLine {
  text: string
  confidence: number
  words: OcrWord[]
  bbox: {
    x0: number
    y0: number
    x1: number
    y1: number
  }
}

/**
 * OCR 服务选项
 */
export interface OcrOptions {
  language?: string
  psm?: number  // Page Segmentation Mode
}

/**
 * OCR 服务单例类
 * 使用 Tesseract.recognize 方法（自动管理 worker）
 */
class OcrService {
  private static instance: OcrService
  private currentLanguage: string = 'chi_sim+eng'  // 默认简体中文+英文
  private cache = new Map<string, OcrResult>()

  private constructor() {}

  /**
   * 获取单例实例
   */
  public static getInstance(): OcrService {
    if (!OcrService.instance) {
      OcrService.instance = new OcrService()
    }
    return OcrService.instance
  }

  /**
   * 获取语言数据路径
   */
  private getLangPath(): string {
    // 开发环境和生产环境都使用 CDN
    return 'https://tessdata.projectnaptha.com/4.0.0'
  }

  /**
   * 识别图片中的文字
   */
  public async recognize(imagePath: string, options?: OcrOptions): Promise<OcrResult> {
    const language = options?.language || this.currentLanguage
    const cacheKey = `${imagePath}:${language}`

    // 检查缓存
    if (this.cache.has(cacheKey)) {
      logger.info('使用缓存结果', { imagePath })
      return this.cache.get(cacheKey)!
    }

    try {
      logger.info('开始识别图片', { imagePath, language })

      // 读取图片
      let imageData: string | Buffer
      if (imagePath.startsWith('data:')) {
        // Base64 数据
        imageData = imagePath
      } else if (fs.existsSync(imagePath)) {
        // 文件路径 - 读取为 Buffer
        imageData = fs.readFileSync(imagePath)
      } else {
        throw new Error(`图片文件不存在: ${imagePath}`)
      }

      // 使用 Tesseract.recognize 方法（自动管理 worker）
      const result = await Tesseract.recognize(imageData, language, {
        langPath: this.getLangPath()
      })

      logger.info('识别完成', { confidence: result.data.confidence })

      // 转换结果格式
      const ocrResult = this.formatResult(result.data)

      // 缓存结果
      this.cache.set(cacheKey, ocrResult)

      return ocrResult
    } catch (error) {
      logger.error('识别失败', error)
      throw error
    }
  }

  /**
   * 批量识别图片（并行处理）
   */
  public async recognizeBatch(
    imagePaths: string[],
    options?: OcrOptions,
    onProgress?: (current: number, total: number, result: OcrResult) => void
  ): Promise<OcrResult[]> {
    const total = imagePaths.length
    let completed = 0

    const promises = imagePaths.map(async (path) => {
      const result = await this.recognize(path, options)
      completed++
      if (onProgress) {
        onProgress(completed, total, result)
      }
      return result
    })

    return Promise.all(promises)
  }

  /**
   * 格式化识别结果
   */
  private formatResult(data: Tesseract.Page): OcrResult {
    const words: OcrWord[] = data.words?.map(word => ({
      text: word.text,
      confidence: word.confidence,
      bbox: {
        x0: word.bbox.x0,
        y0: word.bbox.y0,
        x1: word.bbox.x1,
        y1: word.bbox.y1
      }
    })) || []

    const lines: OcrLine[] = data.lines?.map(line => ({
      text: line.text,
      confidence: line.confidence,
      words: line.words?.map(word => ({
        text: word.text,
        confidence: word.confidence,
        bbox: {
          x0: word.bbox.x0,
          y0: word.bbox.y0,
          x1: word.bbox.x1,
          y1: word.bbox.y1
        }
      })) || [],
      bbox: {
        x0: line.bbox.x0,
        y0: line.bbox.y0,
        x1: line.bbox.x1,
        y1: line.bbox.y1
      }
    })) || []

    return {
      text: data.text,
      confidence: data.confidence,
      words,
      lines
    }
  }

  /**
   * 终止 OCR Worker
   */
  public async terminate(): Promise<void> {
    logger.info('OCR 服务使用自动管理模式')
  }

  /**
   * 检查是否已初始化
   */
  public isInitialized(): boolean {
    return true  // 使用 Tesseract.recognize 方法，无需预先初始化
  }

  /**
   * 获取当前语言
   */
  public getCurrentLanguage(): string {
    return this.currentLanguage
  }

  /**
   * 获取支持的语言列表
   */
  public getSupportedLanguages(): { code: string; name: string }[] {
    return [
      { code: 'chi_sim', name: '简体中文' },
      { code: 'chi_tra', name: '繁体中文' },
      { code: 'eng', name: '英文' },
      { code: 'chi_sim+eng', name: '简体中文+英文' },
      { code: 'chi_tra+eng', name: '繁体中文+英文' }
    ]
  }
}

// 导出单例
export const ocrService = OcrService.getInstance()
