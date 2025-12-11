/**
 * 设置页面
 * 包含激活码、用户设置、同步设置、系统信息
 */
import { useState, useEffect, useCallback } from 'react'
import { 
  Card, Form, Switch, Select, Button, Divider, Typography, 
  Space, message, Input, Tabs, Descriptions, Tag, Spin,
  Statistic, Row, Col, Alert
} from 'antd'
import { 
  SaveOutlined, KeyOutlined, 
  CheckCircleOutlined, CloseCircleOutlined,
  SyncOutlined, CloudUploadOutlined
} from '@ant-design/icons'
import { useAppStore } from '../../stores'
import { mockAPI } from '../../services/mockApi'
import { ErrorHandler } from '../../utils/errorHandler'
import styles from './Settings.module.less'

const { Title, Text } = Typography

interface SystemInfo {
  platform: string
  arch: string
  hostname: string
  cpus: number
  totalMemory: number
  freeMemory: number
}

interface SyncConfig {
  serverUrl: string
  apiKey?: string
  autoSync: boolean
  syncInterval: number
}

interface SyncStats {
  pending: number
  synced: number
  failed: number
}

function SettingsPage() {
  const [form] = Form.useForm()
  const [syncForm] = Form.useForm()
  const [activationCode, setActivationCode] = useState('')
  const [isActivating, setIsActivating] = useState(false)
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null)
  const [deviceId, setDeviceId] = useState('')
  const [appVersion, setAppVersion] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncStats, setSyncStats] = useState<SyncStats>({ pending: 0, synced: 0, failed: 0 })
  const [syncConfig, setSyncConfig] = useState<SyncConfig | null>(null)
  
  const { activation, settings, setActivation, updateSettings } = useAppStore()

  /**
   * 加载系统信息
   */
  useEffect(() => {
    const loadSystemInfo = async () => {
      if (!window.electronAPI) {
        setIsLoading(false)
        return
      }
      
      try {
        // 获取系统信息
        const info = await window.electronAPI.system.getInfo()
        setSystemInfo(info)
        
        // 获取设备ID
        const id = await window.electronAPI.system.getDeviceId()
        setDeviceId(id)
        
        // 获取应用版本
        const version = await window.electronAPI.app.getVersion()
        setAppVersion(version)
        
        // 检查激活状态
        const activationStatus = await window.electronAPI.activation.check()
        if (activationStatus) {
          setActivation({
            isActivated: activationStatus.isActivated,
            expiresAt: activationStatus.expiresAt,
            deviceId: id
          })
        }

        // 加载同步配置和状态
        const configRes = await window.electronAPI.sync.getConfig()
        if (configRes.success && configRes.data) {
          setSyncConfig(configRes.data)
          syncForm.setFieldsValue(configRes.data)
        }
        
        const statusRes = await window.electronAPI.sync.getStatus()
        if (statusRes.success && statusRes.data) {
          setSyncStats(statusRes.data.stats)
          setIsSyncing(statusRes.data.isSyncing)
        }
      } catch (error) {
        console.error('加载系统信息失败:', error)
      } finally {
        setIsLoading(false)
      }
    }
    
    loadSystemInfo()
  }, [setActivation, syncForm])

  // 同步表单值与 store 设置
  useEffect(() => {
    form.setFieldsValue(settings)
  }, [form, settings])

  /**
   * 激活产品
   */
  const handleActivate = useCallback(async () => {
    if (!activationCode.trim()) {
      message.warning('请输入激活码')
      return
    }

    setIsActivating(true)
    try {
      let result

      // 优先使用Electron API,否则使用Mock API
      if (window.electronAPI) {
        result = await window.electronAPI.activation.verify(activationCode.trim())
      } else {
        const mockResult = await mockAPI.activation.verify(activationCode.trim(), deviceId)
        result = {
          success: mockResult.success,
          expiresAt: mockResult.expiresAt,
          message: '激活成功！'
        }
      }

      if (result.success) {
        setActivation({
          isActivated: true,
          expiresAt: result.expiresAt || null,
          deviceId
        })
        message.success(result.message || '激活成功！')
        setActivationCode('')
      } else {
        message.error(result.message || '激活失败')
      }
    } catch (error) {
      ErrorHandler.handle(error as Error, '激活验证')
    } finally {
      setIsActivating(false)
    }
  }, [activationCode, deviceId, setActivation])

  /**
   * 保存设置
   */
  const handleSave = useCallback(() => {
    const values = form.getFieldsValue()
    updateSettings(values)
    message.success('设置已保存')
  }, [form, updateSettings])

  /**
   * 执行同步
   */
  const handleSync = useCallback(async () => {
    if (!window.electronAPI || !syncConfig?.autoSync) {
      message.warning('请先开启云端同步')
      return
    }
    
    setIsSyncing(true)
    try {
      const res = await window.electronAPI.sync.execute('both')
      if (res.success && res.data) {
        message.success(`同步完成！上传 ${res.data.uploaded} 项，下载 ${res.data.downloaded} 项`)
        
        // 刷新状态
        const statusRes = await window.electronAPI.sync.getStatus()
        if (statusRes.success && statusRes.data) {
          setSyncStats(statusRes.data.stats)
        }
      } else {
        message.error('同步失败')
      }
    } catch (error) {
      console.error('同步失败:', error)
      message.error('同步失败')
    } finally {
      setIsSyncing(false)
    }
  }, [syncConfig])

  /**
   * 重试失败的同步
   */
  const handleRetryFailed = useCallback(async () => {
    if (!window.electronAPI) return
    
    setIsSyncing(true)
    try {
      const res = await window.electronAPI.sync.retryFailed()
      if (res.success) {
        message.success('重试完成')
        
        const statusRes = await window.electronAPI.sync.getStatus()
        if (statusRes.success && statusRes.data) {
          setSyncStats(statusRes.data.stats)
        }
      }
    } catch (error) {
      console.error('重试失败:', error)
      message.error('重试失败')
    } finally {
      setIsSyncing(false)
    }
  }, [])

  /**
   * 格式化内存大小
   */
  const formatMemory = (bytes: number) => {
    const gb = bytes / (1024 * 1024 * 1024)
    return `${gb.toFixed(2)} GB`
  }

  const tabItems = [
    {
      key: 'general',
      label: '基本设置',
      children: (
        <Form
          form={form}
          layout="vertical"
          initialValues={settings}
        >
          <Form.Item 
            name="autoSave" 
            label="自动保存" 
            valuePropName="checked"
            extra="编辑时自动保存课件内容"
          >
            <Switch />
          </Form.Item>
          
          <Form.Item name="theme" label="主题模式">
            <Select
              options={[
                { value: 'light', label: '浅色模式' },
                { value: 'dark', label: '深色模式' },
                { value: 'system', label: '跟随系统' }
              ]}
              style={{ width: 200 }}
            />
          </Form.Item>
          
          <Divider />
          
          <Form.Item>
            <Space>
              <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>
                保存设置
              </Button>
              <Button onClick={() => form.resetFields()}>重置</Button>
            </Space>
          </Form.Item>
        </Form>
      )
    },
    {
      key: 'activation',
      label: '软件激活',
      children: (
        <div className={styles.activationSection}>
          <div className={styles.activationStatus}>
            {activation.isActivated ? (
              <>
                <CheckCircleOutlined className={styles.activatedIcon} />
                <div className={styles.statusInfo}>
                  <Text strong>已激活</Text>
                  {activation.expiresAt && (
                    <Text type="secondary">
                      有效期至: {new Date(activation.expiresAt).toLocaleDateString()}
                    </Text>
                  )}
                </div>
              </>
            ) : (
              <>
                <CloseCircleOutlined className={styles.inactiveIcon} />
                <div className={styles.statusInfo}>
                  <Text strong>未激活</Text>
                  <Text type="secondary">请输入激活码以解锁全部功能</Text>
                </div>
              </>
            )}
          </div>
          
          <Divider />
          
          <div className={styles.activationForm}>
            <Text strong>输入激活码</Text>
            <div className={styles.codeInput}>
              <Input
                placeholder="请输入激活码"
                value={activationCode}
                onChange={(e) => setActivationCode(e.target.value)}
                style={{ width: 300 }}
                prefix={<KeyOutlined />}
              />
              <Button 
                type="primary" 
                onClick={handleActivate}
                loading={isActivating}
              >
                激活
              </Button>
            </div>
            <Text type="secondary" style={{ marginTop: 8, display: 'block' }}>
              设备ID将自动绑定，无需手动操作
            </Text>
          </div>
        </div>
      )
    },
    {
      key: 'sync',
      label: '云端同步',
      children: (
        <div className={styles.syncSection}>
          <Alert
            type="info"
            showIcon
            message="云端同步功能"
            description="开启后可将课件数据同步到云端，实现多设备访问和数据备份。"
            style={{ marginBottom: 16 }}
          />
          
          <Row gutter={16} className={styles.syncStats}>
            <Col span={8}>
              <Statistic 
                title="待同步" 
                value={syncStats.pending} 
                valueStyle={{ color: syncStats.pending > 0 ? '#faad14' : undefined }}
              />
            </Col>
            <Col span={8}>
              <Statistic 
                title="已同步" 
                value={syncStats.synced} 
                valueStyle={{ color: '#52c41a' }}
              />
            </Col>
            <Col span={8}>
              <Statistic 
                title="失败" 
                value={syncStats.failed} 
                valueStyle={{ color: syncStats.failed > 0 ? '#ff4d4f' : undefined }}
              />
            </Col>
          </Row>
          
          <Divider />
          
          <Form
            form={syncForm}
            layout="vertical"
            initialValues={syncConfig || { autoSync: false, syncInterval: 30 }}
          >
            <Form.Item 
              name="autoSync" 
              label="启用云端同步" 
              valuePropName="checked"
              extra="开启后课件数据将自动同步到云端"
            >
              <Switch />
            </Form.Item>
            
            <Divider />
            
            <Form.Item>
              <Space>
                <Button 
                  type="primary" 
                  icon={<SyncOutlined spin={isSyncing} />} 
                  onClick={handleSync}
                  loading={isSyncing}
                  disabled={!syncConfig?.autoSync}
                >
                  立即同步
                </Button>
                {syncStats.failed > 0 && (
                  <Button 
                    icon={<CloudUploadOutlined />} 
                    onClick={handleRetryFailed}
                    loading={isSyncing}
                  >
                    重试失败
                  </Button>
                )}
              </Space>
            </Form.Item>
          </Form>
        </div>
      )
    },
    {
      key: 'about',
      label: '关于',
      children: (
        <div className={styles.aboutSection}>
          <div className={styles.appInfo}>
            <Title level={4}>易小卷</Title>
            <Text type="secondary">教师试卷课件生成工具</Text>
            <Tag color="green" className={styles.versionTag}>v{appVersion || '1.0.0'}</Tag>
          </div>
          
          <Divider />
          
          <Descriptions title="系统信息" column={1} size="small">
            <Descriptions.Item label="操作系统">
              {systemInfo?.platform || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="系统架构">
              {systemInfo?.arch || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="计算机名">
              {systemInfo?.hostname || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="CPU核心数">
              {systemInfo?.cpus || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="总内存">
              {systemInfo ? formatMemory(systemInfo.totalMemory) : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="可用内存">
              {systemInfo ? formatMemory(systemInfo.freeMemory) : '-'}
            </Descriptions.Item>
          </Descriptions>
        </div>
      )
    }
  ]

  if (isLoading) {
    return (
      <div className={styles.loading}>
        <Spin size="large" tip="加载中..." />
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <Card className={styles.settingsCard}>
        <Tabs items={tabItems} />
      </Card>
    </div>
  )
}

export default SettingsPage
