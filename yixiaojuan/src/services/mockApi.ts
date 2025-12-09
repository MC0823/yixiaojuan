import { AppError } from '../utils/errorHandler';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Mock API服务
 */
export const mockAPI = {
  /**
   * 激活验证
   */
  activation: {
    /**
     * 验证激活码
     * @param code - 激活码
     * @param deviceId - 设备ID
     * @returns 激活结果
     */
    verify: async (code: string, _deviceId: string) => {
      await delay(1000);

      if (code.startsWith('TEST-')) {
        return {
          success: true,
          userId: 'mock-user-' + Date.now(),
          expiresAt: '2026-12-31T23:59:59Z'
        };
      }

      throw new AppError('激活失败', 'INVALID_CODE', '激活码无效或已过期');
    },

    /**
     * 检查激活状态
     * @param deviceId - 设备ID
     * @returns 激活状态
     */
    check: async (_deviceId: string) => {
      await delay(500);
      return {
        isActivated: true,
        userId: 'mock-user-1',
        expiresAt: '2026-12-31T23:59:59Z'
      };
    }
  },

  /**
   * 用户认证
   */
  auth: {
    /**
     * 发送验证码
     * @param phone - 手机号
     * @returns 发送结果
     */
    sendCode: async (phone: string) => {
      await delay(500);
      console.log(`[Mock] 验证码: 123456 (${phone})`);
      return { success: true };
    },

    /**
     * 用户登录
     * @param phone - 手机号
     * @param code - 验证码
     * @returns 登录结果
     */
    login: async (phone: string, code: string) => {
      await delay(1000);

      if (code === '123456') {
        return {
          token: 'mock-token-' + Date.now(),
          user: {
            id: 'mock-user-1',
            phone,
            nickname: '测试用户',
            avatar: ''
          }
        };
      }

      throw new AppError('登录失败', 'INVALID_CODE', '验证码错误');
    },

    /**
     * 退出登录
     * @returns 退出结果
     */
    logout: async () => {
      await delay(300);
      return { success: true };
    }
  },

  /**
   * 云端同步
   */
  sync: {
    /**
     * 上传课件
     * @param courseware - 课件数据
     * @param userId - 用户ID
     * @returns 上传结果
     */
    upload: async (courseware: any, _userId: string) => {
      await delay(2000);
      return {
        success: true,
        remoteId: 'remote-' + courseware.id,
        syncTime: new Date().toISOString()
      };
    },

    /**
     * 下载课件
     * @param userId - 用户ID
     * @param lastSyncTime - 上次同步时间
     * @returns 课件列表
     */
    download: async (_userId: string, _lastSyncTime?: string) => {
      await delay(2000);
      return {
        coursewares: [],
        syncTime: new Date().toISOString()
      };
    },

    /**
     * 删除课件
     * @param remoteId - 远程ID
     * @param userId - 用户ID
     * @returns 删除结果
     */
    delete: async (_remoteId: string, _userId: string) => {
      await delay(1000);
      return { success: true };
    }
  }
};
