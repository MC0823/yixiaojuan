/**
 * 同步服务 - 处理云端同步功能
 * 支持课件上传、下载、增量同步
 */
import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { databaseService } from '../database'

// 同步状态类型
export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error'

// 同步方向
export type SyncDirection = 'upload' | 'download' | 'both'

// 同步记录类型
export interface SyncRecord {
  id: string
  entity_type: 'courseware' | 'question'
  entity_id: string
  action: 'create' | 'update' | 'delete'
  sync_status: 'pending' | 'synced' | 'failed'
  local_updated_at: string
  remote_updated_at?: string
  error_message?: string
  created_at: string
}

// 同步配置
export interface SyncConfig {
  serverUrl: string
  apiKey?: string
  autoSync: boolean
  syncInterval: number // 分钟
}

// 同步结果
export interface SyncResult {
  success: boolean
  uploaded: number
  downloaded: number
  conflicts: number
  errors: string[]
  lastSyncTime: string
}

// 冲突记录
export interface SyncConflict {
  entityType: 'courseware' | 'question'
  entityId: string
  localData: unknown
  remoteData: unknown
  localUpdatedAt: string
  remoteUpdatedAt: string
}

/**
 * 同步服务类
 */
class SyncService {
  private static instance: SyncService
  private config: SyncConfig
  private syncTimer: NodeJS.Timeout | null = null
  private isSyncing: boolean = false
  private configPath: string = ''
  private initialized: boolean = false

  private constructor() {
    // Config path will be set in initialize
    this.config = {
      serverUrl: '',
      apiKey: '',
      autoSync: false,
      syncInterval: 30
    }
  }

  public static getInstance(): SyncService {
    if (!SyncService.instance) {
      SyncService.instance = new SyncService()
    }
    return SyncService.instance
  }

  public initialize(): void {
    if (this.initialized) {
      return
    }
    const userDataPath = app.getPath('userData')
    this.configPath = path.join(userDataPath, 'sync-config.json')
    this.config = this.loadConfig()
    this.initialized = true
  }

  /**
   * 加载同步配置
   */
  private loadConfig(): SyncConfig {
    const defaultConfig: SyncConfig = {
      serverUrl: '',
      apiKey: '',
      autoSync: false,
      syncInterval: 30 // 默认30分钟
    }

    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf-8')
        return { ...defaultConfig, ...JSON.parse(data) }
      }
    } catch (error) {
      console.error('加载同步配置失败:', error)
    }

    return defaultConfig
  }

  /**
   * 保存同步配置
   */
  public saveConfig(config: Partial<SyncConfig>): void {
    this.config = { ...this.config, ...config }
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2))
      
      // 重新配置自动同步
      if (config.autoSync !== undefined || config.syncInterval !== undefined) {
        this.setupAutoSync()
      }
    } catch (error) {
      console.error('保存同步配置失败:', error)
    }
  }

  /**
   * 获取同步配置
   */
  public getConfig(): SyncConfig {
    return { ...this.config }
  }

  /**
   * 初始化同步日志表（延迟初始化）
   */
  private ensureSyncLogTable(): void {
    try {
      databaseService.execute(`
        CREATE TABLE IF NOT EXISTS sync_log (
          id TEXT PRIMARY KEY,
          entity_type TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          action TEXT NOT NULL,
          sync_status TEXT DEFAULT 'pending',
          local_updated_at TEXT NOT NULL,
          remote_updated_at TEXT,
          error_message TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `)

      databaseService.execute(`
        CREATE INDEX IF NOT EXISTS idx_sync_log_status ON sync_log(sync_status)
      `)

      databaseService.execute(`
        CREATE INDEX IF NOT EXISTS idx_sync_log_entity ON sync_log(entity_type, entity_id)
      `)
    } catch (error) {
      console.error('初始化同步日志表失败:', error)
    }
  }

  /**
   * 记录同步操作
   */
  public recordSyncAction(
    entityType: 'courseware' | 'question',
    entityId: string,
    action: 'create' | 'update' | 'delete'
  ): void {
    try {
      // 确保表存在
      this.ensureSyncLogTable()
      
      const id = `sync_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
      const now = new Date().toISOString()

      // 检查是否已存在未同步的记录
      const existing = databaseService.query<SyncRecord>(
        `SELECT * FROM sync_log 
         WHERE entity_type = ? AND entity_id = ? AND sync_status = 'pending'`,
        [entityType, entityId]
      )

      if (existing.length > 0) {
        // 更新现有记录
        databaseService.execute(
          `UPDATE sync_log SET action = ?, local_updated_at = ? 
           WHERE entity_type = ? AND entity_id = ? AND sync_status = 'pending'`,
          [action, now, entityType, entityId]
        )
      } else {
        // 创建新记录
        databaseService.execute(
          `INSERT INTO sync_log (id, entity_type, entity_id, action, local_updated_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [id, entityType, entityId, action, now, now]
        )
      }
    } catch (error) {
      console.error('记录同步操作失败:', error)
    }
  }

  /**
   * 获取待同步记录前先确保表存在
   */
  private ensureSyncLogTableForQuery(): void {
    try {
      this.ensureSyncLogTable()
    } catch (error) {
      // 初始化失败时忽略，返回空列表
    }
  }

  /**
   * 获取待同步记录
   */
  public getPendingSyncRecords(): SyncRecord[] {
    try {
      this.ensureSyncLogTable()
      return databaseService.query<SyncRecord>(
        `SELECT * FROM sync_log WHERE sync_status = 'pending' ORDER BY created_at ASC`
      )
    } catch (error) {
      console.error('获取待同步记录失败:', error)
      return []
    }
  }

  /**
   * 获取同步状态统计
   */
  public getSyncStats(): { pending: number; synced: number; failed: number } {
    try {
      this.ensureSyncLogTable()
      const stats = databaseService.query<{ sync_status: string; count: number }>(
        `SELECT sync_status, COUNT(*) as count FROM sync_log GROUP BY sync_status`
      )

      return {
        pending: stats.find(s => s.sync_status === 'pending')?.count || 0,
        synced: stats.find(s => s.sync_status === 'synced')?.count || 0,
        failed: stats.find(s => s.sync_status === 'failed')?.count || 0
      }
    } catch (error) {
      console.error('获取同步统计失败:', error)
      return { pending: 0, synced: 0, failed: 0 }
    }
  }

  /**
   * 执行同步
   */
  public async sync(direction: SyncDirection = 'both'): Promise<SyncResult> {
    if (this.isSyncing) {
      return {
        success: false,
        uploaded: 0,
        downloaded: 0,
        conflicts: 0,
        errors: ['同步正在进行中'],
        lastSyncTime: new Date().toISOString()
      }
    }

    if (!this.config.serverUrl) {
      return {
        success: false,
        uploaded: 0,
        downloaded: 0,
        conflicts: 0,
        errors: ['未配置同步服务器'],
        lastSyncTime: new Date().toISOString()
      }
    }

    this.isSyncing = true
    const result: SyncResult = {
      success: true,
      uploaded: 0,
      downloaded: 0,
      conflicts: 0,
      errors: [],
      lastSyncTime: new Date().toISOString()
    }

    try {
      // 上传本地更改
      if (direction === 'upload' || direction === 'both') {
        const uploadResult = await this.uploadChanges()
        result.uploaded = uploadResult.count
        result.errors.push(...uploadResult.errors)
      }

      // 下载远程更改
      if (direction === 'download' || direction === 'both') {
        const downloadResult = await this.downloadChanges()
        result.downloaded = downloadResult.count
        result.conflicts = downloadResult.conflicts
        result.errors.push(...downloadResult.errors)
      }

      result.success = result.errors.length === 0
    } catch (error) {
      result.success = false
      result.errors.push(error instanceof Error ? error.message : '同步失败')
    } finally {
      this.isSyncing = false
    }

    return result
  }

  /**
   * 上传本地更改
   */
  private async uploadChanges(): Promise<{ count: number; errors: string[] }> {
    const pendingRecords = this.getPendingSyncRecords()
    let count = 0
    const errors: string[] = []

    for (const record of pendingRecords) {
      try {
        // 获取实体数据
        const entityData = this.getEntityData(record.entity_type, record.entity_id)
        
        if (record.action === 'delete' || entityData) {
          // 调用远程API（模拟）
          const success = await this.callRemoteApi('upload', {
            type: record.entity_type,
            id: record.entity_id,
            action: record.action,
            data: entityData
          })

          if (success) {
            // 更新同步状态
            databaseService.execute(
              `UPDATE sync_log SET sync_status = 'synced', remote_updated_at = ? WHERE id = ?`,
              [new Date().toISOString(), record.id]
            )
            count++
          } else {
            throw new Error('远程API调用失败')
          }
        }
      } catch (error) {
        const errorMsg = `上传 ${record.entity_type}:${record.entity_id} 失败: ${error instanceof Error ? error.message : '未知错误'}`
        errors.push(errorMsg)
        
        databaseService.execute(
          `UPDATE sync_log SET sync_status = 'failed', error_message = ? WHERE id = ?`,
          [errorMsg, record.id]
        )
      }
    }

    return { count, errors }
  }

  /**
   * 下载远程更改
   */
  private async downloadChanges(): Promise<{ count: number; conflicts: number; errors: string[] }> {
    let count = 0
    let conflicts = 0
    const errors: string[] = []

    try {
      // 获取远程更改列表（模拟）
      const remoteChanges = await this.callRemoteApi('getChanges', {
        since: this.getLastSyncTime()
      })

      if (Array.isArray(remoteChanges)) {
        for (const change of remoteChanges) {
          try {
            // 检查冲突
            const hasConflict = await this.checkConflict(change)
            
            if (hasConflict) {
              conflicts++
              // 记录冲突，等待用户解决
              this.recordConflict(change)
            } else {
              // 应用远程更改
              await this.applyRemoteChange(change)
              count++
            }
          } catch (error) {
            errors.push(`下载 ${change.type}:${change.id} 失败: ${error instanceof Error ? error.message : '未知错误'}`)
          }
        }
      }
    } catch (error) {
      errors.push(`获取远程更改失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }

    return { count, conflicts, errors }
  }

  /**
   * 获取实体数据
   */
  private getEntityData(entityType: string, entityId: string): unknown | null {
    try {
      if (entityType === 'courseware') {
        const result = databaseService.query(
          `SELECT * FROM coursewares WHERE id = ?`,
          [entityId]
        )
        return result[0] || null
      } else if (entityType === 'question') {
        const result = databaseService.query(
          `SELECT * FROM questions WHERE id = ?`,
          [entityId]
        )
        return result[0] || null
      }
      return null
    } catch (error) {
      console.error('获取实体数据失败:', error)
      return null
    }
  }

  /**
   * 获取最后同步时间
   */
  private getLastSyncTime(): string {
    try {
      const result = databaseService.query<{ remote_updated_at: string }>(
        `SELECT remote_updated_at FROM sync_log 
         WHERE sync_status = 'synced' AND remote_updated_at IS NOT NULL 
         ORDER BY remote_updated_at DESC LIMIT 1`
      )
      return result[0]?.remote_updated_at || '1970-01-01T00:00:00.000Z'
    } catch (error) {
      return '1970-01-01T00:00:00.000Z'
    }
  }

  /**
   * 检查冲突
   */
  private async checkConflict(remoteChange: { type: string; id: string; updatedAt: string }): Promise<boolean> {
    // 检查本地是否有未同步的更改
    const pendingRecord = databaseService.query<SyncRecord>(
      `SELECT * FROM sync_log 
       WHERE entity_type = ? AND entity_id = ? AND sync_status = 'pending'`,
      [remoteChange.type, remoteChange.id]
    )

    if (pendingRecord.length > 0) {
      // 比较更新时间，如果远程更新时间较新，则有冲突
      const localTime = new Date(pendingRecord[0].local_updated_at).getTime()
      const remoteTime = new Date(remoteChange.updatedAt).getTime()
      return localTime > remoteTime
    }

    return false
  }

  /**
   * 记录冲突
   */
  private recordConflict(remoteChange: unknown): void {
    // 冲突记录逻辑（可扩展为UI展示）
    console.log('检测到同步冲突:', remoteChange)
  }

  /**
   * 应用远程更改
   */
  private async applyRemoteChange(change: { type: string; id: string; action: string; data: unknown }): Promise<void> {
    // 应用远程更改到本地数据库
    // 这里需要根据实际数据结构实现
    console.log('应用远程更改:', change)
  }

  /**
   * 调用远程API（模拟实现）
   * 实际项目中替换为真实的HTTP请求
   */
  private async callRemoteApi(action: string, data: unknown): Promise<unknown> {
    // 模拟网络延迟
    await new Promise(resolve => setTimeout(resolve, 100))

    // 模拟API响应
    if (!this.config.serverUrl) {
      throw new Error('未配置服务器地址')
    }

    // 这里应该是实际的HTTP请求
    // 例如使用 fetch 或 axios
    console.log(`[Sync API] ${action}:`, data)

    // 模拟成功响应
    if (action === 'upload') {
      return true
    } else if (action === 'getChanges') {
      return [] // 返回空数组表示没有远程更改
    }

    return null
  }

  /**
   * 设置自动同步
   */
  public setupAutoSync(): void {
    // 清除现有定时器
    if (this.syncTimer) {
      clearInterval(this.syncTimer)
      this.syncTimer = null
    }

    // 如果启用了自动同步
    if (this.config.autoSync && this.config.syncInterval > 0) {
      const intervalMs = this.config.syncInterval * 60 * 1000 // 转换为毫秒
      this.syncTimer = setInterval(() => {
        this.sync('both').catch(console.error)
      }, intervalMs)
    }
  }

  /**
   * 清除自动同步定时器
   */
  public clearAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer)
      this.syncTimer = null
    }
  }

  /**
   * 获取同步状态
   */
  public getStatus(): { isSyncing: boolean; stats: { pending: number; synced: number; failed: number } } {
    return {
      isSyncing: this.isSyncing,
      stats: this.getSyncStats()
    }
  }

  /**
   * 清理已同步的日志
   */
  public cleanSyncedLogs(beforeDate?: string): number {
    try {
      this.ensureSyncLogTable()
      const where = beforeDate 
        ? `WHERE sync_status = 'synced' AND created_at < ?`
        : `WHERE sync_status = 'synced'`
      
      const params = beforeDate ? [beforeDate] : []
      const result = databaseService.execute(`DELETE FROM sync_log ${where}`, params)
      return result.changes
    } catch (error) {
      console.error('清理同步日志失败:', error)
      return 0
    }
  }

  /**
   * 重试失败的同步
   */
  public async retryFailed(): Promise<SyncResult> {
    try {
      this.ensureSyncLogTable()
      // 将失败的记录重置为待同步
      databaseService.execute(
        `UPDATE sync_log SET sync_status = 'pending', error_message = NULL WHERE sync_status = 'failed'`
      )
      
      // 重新执行同步
      return await this.sync('upload')
    } catch (error) {
      return {
        success: false,
        uploaded: 0,
        downloaded: 0,
        conflicts: 0,
        errors: [error instanceof Error ? error.message : '重试失败'],
        lastSyncTime: new Date().toISOString()
      }
    }
  }
}

export const syncService = SyncService.getInstance()
