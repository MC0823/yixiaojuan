/**
 * 数据库服务
 * 使用 sql.js（SQLite WebAssembly 版本）实现本地数据持久化
 */
import initSqlJs, { Database, SqlJsStatic } from 'sql.js'
import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'

/**
 * 数据库服务单例类
 */
class DatabaseService {
  private static instance: DatabaseService
  private db: Database | null = null
  private SQL: SqlJsStatic | null = null
  private dbPath: string = ''
  private initialized: boolean = false
  private inTransaction: boolean = false  // 标记是否在事务中

  private constructor() {
    // 数据库路径将在initialize时设置
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService()
    }
    return DatabaseService.instance
  }

  /**
   * 初始化数据库
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('[Database] Already initialized, skipping')
      return
    }

    try {
      // 设置数据库路径
      const userDataPath = app.getPath('userData')
      this.dbPath = path.join(userDataPath, 'yixiaojuan.db')
      console.log('[Database] DB path:', this.dbPath)

      // 初始化 sql.js
      this.SQL = await initSqlJs()

      // 尝试加载已有数据库文件
      if (fs.existsSync(this.dbPath)) {
        const fileBuffer = fs.readFileSync(this.dbPath)
        this.db = new this.SQL.Database(fileBuffer)
        console.log('[Database] Loaded existing database file')
      } else {
        // 创建新数据库
        this.db = new this.SQL.Database()
        console.log('[Database] Creating new database')
      }

      // 初始化表结构
      await this.initializeTables()

      this.initialized = true
      console.log('[Database] Initialization complete')
    } catch (error) {
      console.error('[Database] Initialization failed:', error)
      // 数据库初始化失败，但不中止应用运行
      this.initialized = false
      throw error
    }
  }

  /**
   * 初始化数据表结构
   */
  private async initializeTables(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    // 课件表
    this.db.run(`
      CREATE TABLE IF NOT EXISTS coursewares (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        thumbnail TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        updated_at TEXT DEFAULT (datetime('now', 'localtime')),
        status TEXT DEFAULT 'draft',
        settings TEXT
      )
    `)

    // 题目表
    this.db.run(`
      CREATE TABLE IF NOT EXISTS questions (
        id TEXT PRIMARY KEY,
        courseware_id TEXT NOT NULL,
        order_index INTEGER NOT NULL,
        type TEXT DEFAULT 'unknown',
        original_image TEXT,
        processed_image TEXT,
        ocr_text TEXT,
        options TEXT,
        answer TEXT,
        annotations TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        updated_at TEXT DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (courseware_id) REFERENCES coursewares(id) ON DELETE CASCADE
      )
    `)

    // 激活记录表
    this.db.run(`
      CREATE TABLE IF NOT EXISTS activations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id TEXT NOT NULL UNIQUE,
        activation_code TEXT,
        activated_at TEXT,
        expires_at TEXT,
        is_active INTEGER DEFAULT 0
      )
    `)

    // 用户设置表
    this.db.run(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TEXT DEFAULT (datetime('now', 'localtime'))
      )
    `)

    // 操作日志表
    this.db.run(`
      CREATE TABLE IF NOT EXISTS operation_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action TEXT NOT NULL,
        target_type TEXT,
        target_id TEXT,
        details TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      )
    `)

    console.log('[Database] Tables initialized')
    
    // 执行数据库迁移，添加缺失的列
    await this.runMigrations()
  }
  
  /**
   * 数据库迁移 - 添加缺失的列
   */
  private async runMigrations(): Promise<void> {
    if (!this.db) return
    
    try {
      // 检查 questions 表是否有 options 列
      const tableInfo = this.db.exec('PRAGMA table_info(questions)')
      const columns = tableInfo[0]?.values?.map(row => row[1] as string) || []
      
      // 添加缺失的列
      if (!columns.includes('options')) {
        console.log('[Database] Migration: adding options column')
        this.db.run('ALTER TABLE questions ADD COLUMN options TEXT')
      }
      
      if (!columns.includes('answer')) {
        console.log('[Database] Migration: adding answer column')
        this.db.run('ALTER TABLE questions ADD COLUMN answer TEXT')
      }
      
      if (!columns.includes('type')) {
        console.log('[Database] Migration: adding type column')
        this.db.run('ALTER TABLE questions ADD COLUMN type TEXT DEFAULT "unknown"')
      }
      
      this.save()
      console.log('[Database] Migration complete')
    } catch (error) {
      console.error('[Database] Migration failed:', error)
    }
  }

  /**
   * 保存数据库到文件
   */
  public save(): void {
    if (!this.db) {
      console.warn('[Database] Database not initialized, cannot save')
      return
    }

    try {
      const data = this.db.export()
      const buffer = Buffer.from(data)
      
      // 确保目录存在
      const dir = path.dirname(this.dbPath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      
      fs.writeFileSync(this.dbPath, buffer)
      console.log('[Database] Database saved')
    } catch (error) {
      console.error('[Database] Save failed:', error)
      throw error
    }
  }

  /**
   * 执行查询（SELECT）
   */
  public query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    try {
      const stmt = this.db.prepare(sql)
      stmt.bind(params)
      
      const results: T[] = []
      while (stmt.step()) {
        results.push(stmt.getAsObject() as T)
      }
      stmt.free()
      
      return results
    } catch (error) {
      console.error('[Database] Query failed:', sql, error)
      throw error
    }
  }

  /**
   * 执行语句（INSERT/UPDATE/DELETE）
   */
  public execute(sql: string, params: unknown[] = []): { changes: number; lastInsertRowid: number } {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    try {
      this.db.run(sql, params)
      
      // 获取影响的行数和最后插入的ID
      const changesResult = this.db.exec('SELECT changes() as changes')
      const lastIdResult = this.db.exec('SELECT last_insert_rowid() as lastId')
      
      const changes = changesResult[0]?.values[0]?.[0] as number || 0
      const lastInsertRowid = lastIdResult[0]?.values[0]?.[0] as number || 0
      
      // 事务外才自动保存到文件
      if (!this.inTransaction) {
        this.save()
      }
      
      return { changes, lastInsertRowid }
    } catch (error) {
      console.error('[Database] Execute failed:', sql, error)
      throw error
    }
  }

  /**
   * 执行事务
   */
  public transaction<T>(callback: () => T): T {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    this.inTransaction = true
    try {
      this.db.run('BEGIN TRANSACTION')
      const result = callback()
      this.db.run('COMMIT')
      this.inTransaction = false
      this.save()
      return result
    } catch (error) {
      try {
        this.db.run('ROLLBACK')
      } catch (rollbackError) {
        console.error('[Database] ROLLBACK failed:', rollbackError)
      }
      this.inTransaction = false
      throw error
    }
  }

  /**
   * 关闭数据库
   */
  public close(): void {
    if (this.db) {
      this.save()
      this.db.close()
      this.db = null
      this.initialized = false
      console.log('[Database] Database closed')
    }
  }

  /**
   * 检查数据库是否已初始化
   */
  public isInitialized(): boolean {
    return this.initialized
  }
}

// 导出单例
export const databaseService = DatabaseService.getInstance()
