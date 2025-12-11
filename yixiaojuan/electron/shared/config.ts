/**
 * 环境配置管理
 * 统一管理应用的环境变量和配置
 */

/**
 * 环境类型
 */
export type Environment = 'development' | 'production' | 'test'

/**
 * 获取当前环境
 */
export function getEnvironment(): Environment {
  if (process.env.NODE_ENV === 'production') {
    return 'production'
  }
  if (process.env.NODE_ENV === 'test') {
    return 'test'
  }
  return 'development'
}

/**
 * 是否为开发环境
 */
export function isDevelopment(): boolean {
  return getEnvironment() === 'development'
}

/**
 * 是否为生产环境
 */
export function isProduction(): boolean {
  return getEnvironment() === 'production'
}

/**
 * 是否为测试环境
 */
export function isTest(): boolean {
  return getEnvironment() === 'test'
}

/**
 * 应用配置接口
 */
export interface AppConfig {
  // 应用信息
  appName: string
  appVersion: string
  
  // 数据库配置
  database: {
    name: string
    path?: string
  }
  
  // OCR 配置
  ocr: {
    paddleOcrUrl: string
    paddleOcrTimeout: number
    tesseractLanguage: string
  }
  
  // 同步配置
  sync: {
    defaultServerUrl: string
    defaultInterval: number
  }
  
  // 日志配置
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error'
    enableConsole: boolean
    enableFile: boolean
  }
  
  // 窗口配置
  window: {
    width: number
    height: number
    minWidth: number
    minHeight: number
  }
}

/**
 * 默认配置
 */
const defaultConfig: AppConfig = {
  appName: '易小卷',
  appVersion: '1.0.0',
  
  database: {
    name: 'yixiaojuan.db'
  },
  
  ocr: {
    paddleOcrUrl: 'http://localhost:8089',
    paddleOcrTimeout: 60000,
    tesseractLanguage: 'chi_sim+eng'
  },
  
  sync: {
    defaultServerUrl: 'https://api.yixiaojuan.com',
    defaultInterval: 300000 // 5分钟
  },
  
  logging: {
    level: 'info',
    enableConsole: true,
    enableFile: false
  },
  
  window: {
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600
  }
}

/**
 * 开发环境配置覆盖
 */
const developmentConfig: Partial<AppConfig> = {
  logging: {
    level: 'debug',
    enableConsole: true,
    enableFile: false
  }
}

/**
 * 生产环境配置覆盖
 */
const productionConfig: Partial<AppConfig> = {
  logging: {
    level: 'warn',
    enableConsole: false,
    enableFile: true
  }
}

/**
 * 获取当前环境的配置
 */
export function getConfig(): AppConfig {
  const env = getEnvironment()
  
  let envConfig: Partial<AppConfig> = {}
  
  switch (env) {
    case 'development':
      envConfig = developmentConfig
      break
    case 'production':
      envConfig = productionConfig
      break
    default:
      envConfig = {}
  }
  
  // 深度合并配置
  return deepMerge(defaultConfig, envConfig) as AppConfig
}

/**
 * 深度合并对象
 */
function deepMerge<T extends object>(target: T, source: Partial<T>): T {
  const result = { ...target }
  
  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const sourceValue = source[key]
      const targetValue = result[key]
      
      if (
        sourceValue !== null &&
        typeof sourceValue === 'object' &&
        !Array.isArray(sourceValue) &&
        targetValue !== null &&
        typeof targetValue === 'object' &&
        !Array.isArray(targetValue)
      ) {
        (result as Record<string, unknown>)[key] = deepMerge(
          targetValue as object,
          sourceValue as object
        )
      } else if (sourceValue !== undefined) {
        (result as Record<string, unknown>)[key] = sourceValue
      }
    }
  }
  
  return result
}

// 导出配置单例
export const config = getConfig()

// 导出常用配置项
export const {
  appName,
  appVersion,
  database: databaseConfig,
  ocr: ocrConfig,
  sync: syncConfig,
  logging: loggingConfig,
  window: windowConfig
} = config
