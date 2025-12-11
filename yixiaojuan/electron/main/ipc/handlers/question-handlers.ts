/**
 * 题目相关 IPC 处理器
 */
import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../../shared/ipc-channels'
import { questionRepository, type Question } from '../../database'
import { InputValidator } from '../../utils/validator'

/**
 * 注册题目相关处理器
 */
export function registerQuestionHandlers(): void {
  // 创建单个题目
  ipcMain.handle(IPC_CHANNELS.QUESTION_CREATE, async (_event, data: Partial<Question>) => {
    try {
      const question = questionRepository.create(data)
      console.log('[Question] Created:', question.id)
      return { success: true, data: question }
    } catch (error) {
      console.error('[Question] Create failed:', error)
      return { success: false, error: String(error) }
    }
  })

  // 批量创建题目
  ipcMain.handle(IPC_CHANNELS.QUESTION_CREATE_BATCH, async (
    _event, 
    coursewareId: string, 
    questions: Partial<Question>[]
  ) => {
    try {
      const created = questionRepository.createBatch(coursewareId, questions)
      console.log('[Question] Batch created:', created.length)
      return { success: true, data: created }
    } catch (error) {
      console.error('[Question] Batch create failed:', error)
      return { success: false, error: String(error) }
    }
  })

  // 获取课件下的所有题目
  ipcMain.handle(IPC_CHANNELS.QUESTION_GET_BY_COURSEWARE, async (_event, coursewareId: string) => {
    if (!InputValidator.isValidUUID(coursewareId)) {
      return { success: false, error: '无效的课件ID' }
    }
    try {
      const list = questionRepository.findByCoursewareId(coursewareId)
      return { success: true, data: list }
    } catch (error) {
      console.error('[Question] Get list failed:', error)
      return { success: false, error: String(error) }
    }
  })

  // 更新题目
  ipcMain.handle(IPC_CHANNELS.QUESTION_UPDATE, async (_event, id: string, data: Partial<Question>) => {
    if (!InputValidator.isValidUUID(id)) {
      return { success: false, error: '无效的题目ID' }
    }
    try {
      const question = questionRepository.update(id, data)
      if (!question) {
        return { success: false, error: '题目不存在' }
      }
      console.log('[Question] Updated:', id)
      return { success: true, data: question }
    } catch (error) {
      console.error('[Question] Update failed:', error)
      return { success: false, error: String(error) }
    }
  })

  // 删除题目
  ipcMain.handle(IPC_CHANNELS.QUESTION_DELETE, async (_event, id: string) => {
    if (!InputValidator.isValidUUID(id)) {
      return { success: false, error: '无效的题目ID' }
    }
    try {
      const deleted = questionRepository.delete(id)
      console.log('[Question] Deleted:', id)
      return { success: true, data: deleted }
    } catch (error) {
      console.error('[Question] Delete failed:', error)
      return { success: false, error: String(error) }
    }
  })

  // 重排序题目
  ipcMain.handle(IPC_CHANNELS.QUESTION_REORDER, async (
    _event, 
    coursewareId: string, 
    questionIds: string[]
  ) => {
    try {
      questionRepository.reorder(coursewareId, questionIds)
      console.log('[Question] Reordered')
      return { success: true }
    } catch (error) {
      console.error('[Question] Reorder failed:', error)
      return { success: false, error: String(error) }
    }
  })
}

