/**
 * 应用相关 IPC 处理器
 */
import { ipcMain, app } from 'electron'
import * as os from 'os'
import * as crypto from 'crypto'
import { IPC_CHANNELS } from '../../../shared/ipc-channels'

/**
 * 注册应用相关处理器
 */
export function registerAppHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.APP_GET_VERSION, () => {
    return app.getVersion()
  })

  ipcMain.handle(IPC_CHANNELS.APP_GET_PLATFORM, () => {
    return process.platform
  })

  ipcMain.handle(IPC_CHANNELS.APP_QUIT, () => {
    app.quit()
  })

  ipcMain.handle(IPC_CHANNELS.APP_RELAUNCH, () => {
    app.relaunch()
    app.quit()
  })
}

/**
 * 注册系统相关处理器
 */
export function registerSystemHandlers(): void {
  // 获取设备唯一标识
  ipcMain.handle(IPC_CHANNELS.SYSTEM_GET_DEVICE_ID, () => {
    const machineInfo = [
      os.hostname(),
      os.platform(),
      os.arch(),
      os.cpus()[0]?.model || 'unknown'
    ].join('-')
    
    return crypto.createHash('sha256').update(machineInfo).digest('hex').substring(0, 32)
  })

  // 获取系统信息
  ipcMain.handle(IPC_CHANNELS.SYSTEM_GET_INFO, () => {
    return {
      platform: os.platform(),
      arch: os.arch(),
      hostname: os.hostname(),
      cpus: os.cpus().length,
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      homeDir: os.homedir(),
      tempDir: os.tmpdir()
    }
  })
}

/**
 * 注册激活相关处理器（预留接口）
 */
export function registerActivationHandlers(): void {
  // 验证激活码
  ipcMain.handle(IPC_CHANNELS.ACTIVATION_VERIFY, async (_event, code: string) => {
    // TODO: 实现激活码验证逻辑
    console.log('[Activation] 验证激活码:', code)
    
    // 临时返回成功，后续接入真实API
    return {
      success: true,
      message: '激活成功（测试模式）',
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
    }
  })

  // 检查激活状态
  ipcMain.handle(IPC_CHANNELS.ACTIVATION_CHECK, async () => {
    // TODO: 从本地存储读取激活状态
    return {
      isActivated: false,
      expiresAt: null
    }
  })
}
