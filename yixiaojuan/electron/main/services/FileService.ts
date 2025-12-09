/**
 * 文件服务
 * 提供图片读取、处理、保存等文件操作功能
 */
import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'

/**
 * 图片信息接口
 */
export interface ImageInfo {
  path: string
  name: string
  size: number
  width: number
  height: number
  format: string
  base64?: string
}

/**
 * 图片处理选项
 */
export interface ImageProcessOptions {
  width?: number
  height?: number
  quality?: number
  format?: 'jpeg' | 'png' | 'webp'
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside'
}

/**
 * 文件保存选项
 */
export interface FileSaveOptions {
  directory?: string
  filename?: string
  overwrite?: boolean
}

/**
 * 文件服务类
 */
class FileService {
  private static instance: FileService
  private dataPath: string = ''
  private initialized: boolean = false

  private constructor() {
    // Data path will be set in initialize
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): FileService {
    if (!FileService.instance) {
      FileService.instance = new FileService()
    }
    return FileService.instance
  }

  /**
   * 初始化文件服务
   */
  public initialize(): void {
    if (this.initialized) {
      return
    }
    this.dataPath = path.join(app.getPath('userData'), 'data')
    this.ensureDirectory(this.dataPath)
    console.log('[FileService] Data path:', this.dataPath)
    this.initialized = true
  }

  /**
   * 确保目录存在
   */
  private ensureDirectory(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true })
    }
  }

  /**
   * 获取数据存储路径
   */
  public getDataPath(): string {
    return this.dataPath
  }

  /**
   * 获取课件目录
   */
  public getCoursewarePath(coursewareId: string): string {
    const dirPath = path.join(this.dataPath, 'coursewares', coursewareId)
    this.ensureDirectory(dirPath)
    return dirPath
  }

  /**
   * 获取图片目录
   */
  public getImagesPath(coursewareId: string): string {
    const dirPath = path.join(this.getCoursewarePath(coursewareId), 'images')
    this.ensureDirectory(dirPath)
    return dirPath
  }

  /**
   * 读取图片信息（从文件名和文件数据推断）
   */
  public async getImageInfo(imagePath: string, includeBase64: boolean = false): Promise<ImageInfo> {
    if (!fs.existsSync(imagePath)) {
      throw new Error(`图片文件不存在: ${imagePath}`)
    }

    const stats = fs.statSync(imagePath)
    const ext = path.extname(imagePath).toLowerCase().slice(1)
    const format = ext || 'unknown'
    const buffer = fs.readFileSync(imagePath)

    // 简单的图片尺寸推断（需要实际解析）
    // 这里返回默认值，前端可以自行获取实际尺寸
    let width = 0
    let height = 0
    
    try {
      // 尝试从PNG/JPEG头部读取尺寸
      const dimensions = this.getImageDimensions(buffer, format)
      width = dimensions.width
      height = dimensions.height
    } catch (e) {
      // 如果解析失败，使用默认值
    }

    const info: ImageInfo = {
      path: imagePath,
      name: path.basename(imagePath),
      size: stats.size,
      width,
      height,
      format
    }

    if (includeBase64) {
      info.base64 = `data:image/${format};base64,${buffer.toString('base64')}`
    }

    return info
  }

  /**
   * 从Buffer中提取图片尺寸（简单实现）
   */
  private getImageDimensions(buffer: Buffer, format: string): { width: number; height: number } {
    try {
      if (format === 'png') {
        // PNG: 尺寸在字节 16-24
        if (buffer.length > 24) {
          const width = buffer.readUInt32BE(16)
          const height = buffer.readUInt32BE(20)
          return { width, height }
        }
      } else if (format === 'jpg' || format === 'jpeg') {
        // JPEG: 查找SOF marker
        for (let i = 2; i < buffer.length - 8; i++) {
          if (buffer[i] === 0xff && (buffer[i + 1] === 0xc0 || buffer[i + 1] === 0xc2)) {
            const height = buffer.readUInt16BE(i + 5)
            const width = buffer.readUInt16BE(i + 7)
            return { width, height }
          }
        }
      }
    } catch (e) {
      // 忽略解析错误
    }
    return { width: 0, height: 0 }
  }

  /**
   * 读取图片为 Buffer
   */
  public async readImage(imagePath: string): Promise<Buffer> {
    if (!fs.existsSync(imagePath)) {
      throw new Error(`图片文件不存在: ${imagePath}`)
    }
    return fs.readFileSync(imagePath)
  }

  /**
   * 读取图片为 Base64
   */
  public async readImageAsBase64(imagePath: string): Promise<string> {
    const buffer = await this.readImage(imagePath)
    const ext = path.extname(imagePath).toLowerCase().slice(1)
    const format = ext || 'png'
    return `data:image/${format};base64,${buffer.toString('base64')}`
  }

  /**
   * 处理图片（缩放、格式转换等）
   */
  public async processImage(
    imagePath: string,
    options: ImageProcessOptions
  ): Promise<Buffer> {
    try {
      const sharp = require('sharp')
      let pipeline = sharp(imagePath)

      if (options.width || options.height) {
        pipeline = pipeline.resize(options.width, options.height, {
          fit: options.fit || 'inside'
        })
      }

      if (options.format) {
        pipeline = pipeline.toFormat(options.format, {
          quality: options.quality || 80
        })
      }

      return await pipeline.toBuffer()
    } catch (error) {
      // Fallback: 返回原图
      return fs.readFileSync(imagePath)
    }
  }

  /**
   * 创建缩略图
   */
  public async createThumbnail(
    imagePath: string,
    width: number = 200,
    height: number = 200
  ): Promise<Buffer> {
    return this.processImage(imagePath, { width, height, fit: 'cover' })
  }

  /**
   * 保存图片
   */
  public async saveImage(
    data: Buffer | string,
    coursewareId: string,
    options?: FileSaveOptions
  ): Promise<string> {
    const imagesPath = this.getImagesPath(coursewareId)
    const filename = options?.filename || `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.png`
    const filePath = path.join(imagesPath, filename)

    // 如果是 Base64 字符串，转换为 Buffer
    let buffer: Buffer
    if (typeof data === 'string') {
      if (data.startsWith('data:')) {
        // 移除 data URL 前缀
        const base64Data = data.replace(/^data:image\/\w+;base64,/, '')
        buffer = Buffer.from(base64Data, 'base64')
      } else {
        buffer = Buffer.from(data, 'base64')
      }
    } else {
      buffer = data
    }

    // 检查是否覆盖
    if (fs.existsSync(filePath) && !options?.overwrite) {
      throw new Error(`文件已存在: ${filePath}`)
    }

    fs.writeFileSync(filePath, buffer)
    console.log('[FileService] Image saved:', filePath)

    return filePath
  }

  /**
   * 复制图片到课件目录
   */
  public async copyImageToCourseware(
    sourcePath: string,
    coursewareId: string,
    newFilename?: string
  ): Promise<string> {
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`源文件不存在: ${sourcePath}`)
    }

    const imagesPath = this.getImagesPath(coursewareId)
    const ext = path.extname(sourcePath)
    const filename = newFilename || `${Date.now()}_${Math.random().toString(36).substr(2, 9)}${ext}`
    const destPath = path.join(imagesPath, filename)

    fs.copyFileSync(sourcePath, destPath)
    console.log('[FileService] Image copied:', destPath)

    return destPath
  }

  /**
   * 批量复制图片
   */
  public async copyImagesToCourseware(
    sourcePaths: string[],
    coursewareId: string
  ): Promise<string[]> {
    const results: string[] = []
    
    for (const sourcePath of sourcePaths) {
      const destPath = await this.copyImageToCourseware(sourcePath, coursewareId)
      results.push(destPath)
    }

    return results
  }

  /**
   * 删除图片
   */
  public deleteImage(imagePath: string): boolean {
    if (!fs.existsSync(imagePath)) {
      return false
    }

    fs.unlinkSync(imagePath)
    console.log('[FileService] Image deleted:', imagePath)
    return true
  }

  /**
   * 删除课件目录
   */
  public deleteCoursewareDirectory(coursewareId: string): boolean {
    const dirPath = this.getCoursewarePath(coursewareId)
    
    if (!fs.existsSync(dirPath)) {
      return false
    }

    fs.rmSync(dirPath, { recursive: true, force: true })
    console.log('[FileService] Courseware dir deleted:', dirPath)
    return true
  }

  /**
   * 获取课件的所有图片
   */
  public async getCoursewareImages(coursewareId: string): Promise<ImageInfo[]> {
    const imagesPath = this.getImagesPath(coursewareId)
    
    if (!fs.existsSync(imagesPath)) {
      return []
    }

    const files = fs.readdirSync(imagesPath)
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp']
    const imageFiles = files.filter(file => 
      imageExtensions.includes(path.extname(file).toLowerCase())
    )

    const results: ImageInfo[] = []
    for (const file of imageFiles) {
      const filePath = path.join(imagesPath, file)
      const info = await this.getImageInfo(filePath)
      results.push(info)
    }

    return results
  }

  /**
   * 检查文件是否存在
   */
  public fileExists(filePath: string): boolean {
    return fs.existsSync(filePath)
  }

  /**
   * 获取文件大小
   */
  public getFileSize(filePath: string): number {
    if (!fs.existsSync(filePath)) {
      return 0
    }
    return fs.statSync(filePath).size
  }

  /**
   * 格式化文件大小
   */
  public formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B'
    
    const units = ['B', 'KB', 'MB', 'GB']
    const k = 1024
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + units[i]
  }
}

// 导出单例
export const fileService = FileService.getInstance()

