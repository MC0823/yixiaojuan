/**
 * 课件数据访问层
 */
import { databaseService } from './DatabaseService'
import { v4 as uuidv4 } from 'uuid'

/**
 * 课件实体接口
 */
export interface Courseware {
  id: string
  title: string
  description?: string
  thumbnail?: string
  created_at: string
  updated_at: string
  status: 'draft' | 'completed' | 'archived'
  settings?: string // JSON 字符串
}

/**
 * 题目实体接口
 */
export interface Question {
  id: string
  courseware_id: string
  order_index: number
  type?: string
  original_image?: string
  processed_image?: string
  ocr_text?: string
  options?: string // JSON 字符串
  answer?: string
  annotations?: string // JSON 字符串
  created_at: string
  updated_at: string
}

/**
 * 课件仓库类
 */
export class CoursewareRepository {
  /**
   * 创建课件
   */
  public create(data: Partial<Courseware>): Courseware {
    const id = data.id || uuidv4()
    const now = new Date().toISOString()
    
    databaseService.execute(
      `INSERT INTO coursewares (id, title, description, thumbnail, status, settings, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.title || '未命名课件',
        data.description || null,
        data.thumbnail || null,
        data.status || 'draft',
        data.settings || null,
        now,
        now
      ]
    )

    return this.findById(id)!
  }

  /**
   * 根据ID查找课件
   */
  public findById(id: string): Courseware | null {
    const results = databaseService.query<Courseware>(
      'SELECT * FROM coursewares WHERE id = ?',
      [id]
    )
    return results[0] || null
  }

  /**
   * 获取所有课件
   */
  public findAll(options?: { status?: string; orderBy?: string }): Courseware[] {
    let sql = 'SELECT * FROM coursewares'
    const params: unknown[] = []

    if (options?.status) {
      sql += ' WHERE status = ?'
      params.push(options.status)
    }

    sql += ` ORDER BY ${options?.orderBy || 'updated_at DESC'}`

    return databaseService.query<Courseware>(sql, params)
  }

  /**
   * 更新课件
   */
  public update(id: string, data: Partial<Courseware>): Courseware | null {
    const updates: string[] = []
    const params: unknown[] = []

    if (data.title !== undefined) {
      updates.push('title = ?')
      params.push(data.title)
    }
    if (data.description !== undefined) {
      updates.push('description = ?')
      params.push(data.description)
    }
    if (data.thumbnail !== undefined) {
      updates.push('thumbnail = ?')
      params.push(data.thumbnail)
    }
    if (data.status !== undefined) {
      updates.push('status = ?')
      params.push(data.status)
    }
    if (data.settings !== undefined) {
      updates.push('settings = ?')
      params.push(data.settings)
    }

    if (updates.length === 0) {
      return this.findById(id)
    }

    updates.push('updated_at = ?')
    params.push(new Date().toISOString())
    params.push(id)

    databaseService.execute(
      `UPDATE coursewares SET ${updates.join(', ')} WHERE id = ?`,
      params
    )

    return this.findById(id)
  }

  /**
   * 删除课件
   */
  public delete(id: string): boolean {
    const result = databaseService.execute(
      'DELETE FROM coursewares WHERE id = ?',
      [id]
    )
    return result.changes > 0
  }

  /**
   * 获取课件数量
   */
  public count(status?: string): number {
    let sql = 'SELECT COUNT(*) as count FROM coursewares'
    const params: unknown[] = []

    if (status) {
      sql += ' WHERE status = ?'
      params.push(status)
    }

    const result = databaseService.query<{ count: number }>(sql, params)
    return result[0]?.count || 0
  }
}

/**
 * 题目仓库类
 */
export class QuestionRepository {
  /**
   * 创建题目
   */
  public create(data: Partial<Question>): Question {
    const id = data.id || uuidv4()
    const now = new Date().toISOString()

    // 获取当前课件的题目数量作为排序索引
    const orderIndex = data.order_index ?? this.getMaxOrderIndex(data.courseware_id!) + 1

    databaseService.execute(
      `INSERT INTO questions (id, courseware_id, order_index, type, original_image, processed_image, ocr_text, options, answer, annotations, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.courseware_id,
        orderIndex,
        data.type || 'unknown',
        data.original_image || null,
        data.processed_image || null,
        data.ocr_text || null,
        data.options || null,
        data.answer || null,
        data.annotations || null,
        now,
        now
      ]
    )

    return this.findById(id)!
  }

  /**
   * 批量创建题目（替换模式）
   * 先删除该课件下所有旧题目，再创建新题目
   */
  public createBatch(coursewareId: string, questions: Partial<Question>[]): Question[] {
    // 先清理该课件下的所有旧题目
    const deletedCount = this.deleteByCoursewareId(coursewareId)
    if (deletedCount > 0) {
      console.log('[QuestionRepository] 已清理旧题目, 数量:', deletedCount)
    }
    
    const results: Question[] = []

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]
      const question = this.create({
        ...q,
        courseware_id: coursewareId,
        order_index: q.order_index ?? i  // 优先使用传入的order_index，否则使用数组索引
      })
      results.push(question)
    }

    console.log('[QuestionRepository] 批量创建完成, 数量:', results.length)
    return results
  }

  /**
   * 根据ID查找题目
   */
  public findById(id: string): Question | null {
    const results = databaseService.query<Question>(
      'SELECT * FROM questions WHERE id = ?',
      [id]
    )
    return results[0] || null
  }

  /**
   * 根据课件ID获取所有题目
   */
  public findByCoursewareId(coursewareId: string): Question[] {
    return databaseService.query<Question>(
      'SELECT * FROM questions WHERE courseware_id = ? ORDER BY order_index ASC',
      [coursewareId]
    )
  }

  /**
   * 更新题目
   */
  public update(id: string, data: Partial<Question>): Question | null {
    const updates: string[] = []
    const params: unknown[] = []

    if (data.order_index !== undefined) {
      updates.push('order_index = ?')
      params.push(data.order_index)
    }
    if (data.type !== undefined) {
      updates.push('type = ?')
      params.push(data.type)
    }
    if (data.original_image !== undefined) {
      updates.push('original_image = ?')
      params.push(data.original_image)
    }
    if (data.processed_image !== undefined) {
      updates.push('processed_image = ?')
      params.push(data.processed_image)
    }
    if (data.ocr_text !== undefined) {
      updates.push('ocr_text = ?')
      params.push(data.ocr_text)
    }
    if (data.options !== undefined) {
      updates.push('options = ?')
      params.push(data.options)
    }
    if (data.answer !== undefined) {
      updates.push('answer = ?')
      params.push(data.answer)
    }
    if (data.annotations !== undefined) {
      updates.push('annotations = ?')
      params.push(data.annotations)
    }

    if (updates.length === 0) {
      return this.findById(id)
    }

    updates.push('updated_at = ?')
    params.push(new Date().toISOString())
    params.push(id)

    databaseService.execute(
      `UPDATE questions SET ${updates.join(', ')} WHERE id = ?`,
      params
    )

    return this.findById(id)
  }

  /**
   * 删除题目
   */
  public delete(id: string): boolean {
    const result = databaseService.execute(
      'DELETE FROM questions WHERE id = ?',
      [id]
    )
    return result.changes > 0
  }

  /**
   * 删除课件下的所有题目
   */
  public deleteByCoursewareId(coursewareId: string): number {
    const result = databaseService.execute(
      'DELETE FROM questions WHERE courseware_id = ?',
      [coursewareId]
    )
    return result.changes
  }

  /**
   * 重新排序题目
   */
  public reorder(coursewareId: string, questionIds: string[]): void {
    databaseService.transaction(() => {
      questionIds.forEach((id, index) => {
        databaseService.execute(
          'UPDATE questions SET order_index = ?, updated_at = ? WHERE id = ?',
          [index, new Date().toISOString(), id]
        )
      })
    })
  }

  /**
   * 获取最大排序索引
   */
  private getMaxOrderIndex(coursewareId: string): number {
    const result = databaseService.query<{ max_index: number | null }>(
      'SELECT MAX(order_index) as max_index FROM questions WHERE courseware_id = ?',
      [coursewareId]
    )
    return result[0]?.max_index ?? -1
  }
}

// 导出单例
export const coursewareRepository = new CoursewareRepository()
export const questionRepository = new QuestionRepository()
