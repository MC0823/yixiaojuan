/**
 * 课件相关 IPC 处理器
 */
import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../../shared/ipc-channels'
import { coursewareRepository, questionRepository, type Courseware } from '../../database'
import { InputValidator } from '../../utils/validator'

/**
 * 注册课件相关处理器
 */
export function registerCoursewareHandlers(): void {
  // 创建课件
  ipcMain.handle(IPC_CHANNELS.COURSEWARE_CREATE, async (_event, data: Partial<Courseware>) => {
    try {
      const courseware = coursewareRepository.create(data)
      console.log('[Courseware] 创建成功:', courseware.id)
      return { success: true, data: courseware }
    } catch (error) {
      console.error('[Courseware] 创建失败:', error)
      return { success: false, error: String(error) }
    }
  })

  // 获取所有课件
  ipcMain.handle(IPC_CHANNELS.COURSEWARE_GET_ALL, async (_event, options?: { status?: string }) => {
    try {
      const list = coursewareRepository.findAll(options)
      return { success: true, data: list }
    } catch (error) {
      console.error('[Courseware] 获取列表失败:', error)
      return { success: false, error: String(error) }
    }
  })

  // 根据ID获取课件
  ipcMain.handle(IPC_CHANNELS.COURSEWARE_GET_BY_ID, async (_event, id: string) => {
    if (!InputValidator.isValidUUID(id)) {
      return { success: false, error: '无效的课件ID' }
    }
    try {
      const courseware = coursewareRepository.findById(id)
      if (!courseware) {
        return { success: false, error: '课件不存在' }
      }
      return { success: true, data: courseware }
    } catch (error) {
      console.error('[Courseware] 获取失败:', error)
      return { success: false, error: String(error) }
    }
  })

  // 更新课件
  ipcMain.handle(IPC_CHANNELS.COURSEWARE_UPDATE, async (_event, id: string, data: Partial<Courseware>) => {
    if (!InputValidator.isValidUUID(id)) {
      return { success: false, error: '无效的课件ID' }
    }
    try {
      const courseware = coursewareRepository.update(id, data)
      if (!courseware) {
        return { success: false, error: '课件不存在' }
      }
      console.log('[Courseware] 更新成功:', id)
      return { success: true, data: courseware }
    } catch (error) {
      console.error('[Courseware] 更新失败:', error)
      return { success: false, error: String(error) }
    }
  })

  // 删除课件
  ipcMain.handle(IPC_CHANNELS.COURSEWARE_DELETE, async (_event, id: string) => {
    if (!InputValidator.isValidUUID(id)) {
      return { success: false, error: '无效的课件ID' }
    }
    try {
      // 先删除关联的题目
      questionRepository.deleteByCoursewareId(id)
      // 再删除课件
      const deleted = coursewareRepository.delete(id)
      console.log('[Courseware] 删除成功:', id)
      return { success: true, data: deleted }
    } catch (error) {
      console.error('[Courseware] 删除失败:', error)
      return { success: false, error: String(error) }
    }
  })
}
