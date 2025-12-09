/**
 * 首页组件
 */
import { Card, Typography, Space, Row, Col, Statistic } from 'antd'
import { 
  FileImageOutlined, 
  AppstoreOutlined,
  CloudSyncOutlined 
} from '@ant-design/icons'
import { useEffect, useState } from 'react'
import styles from './Home.module.less'

const { Title, Paragraph } = Typography

function HomePage() {
  const [appVersion, setAppVersion] = useState<string>('--')
  const [platform, setPlatform] = useState<string>('--')

  // 获取应用信息
  useEffect(() => {
    const getAppInfo = async () => {
      try {
        if (window.electronAPI) {
          const version = await window.electronAPI.app.getVersion()
          const plat = await window.electronAPI.app.getPlatform()
          setAppVersion(version)
          setPlatform(plat)
        }
      } catch (error) {
        console.error('获取应用信息失败:', error)
      }
    }
    getAppInfo()
  }, [])

  // 功能卡片数据
  const features = [
    {
      icon: <FileImageOutlined style={{ fontSize: 32, color: '#87bd76' }} />,
      title: '试卷识别',
      desc: '智能OCR识别试卷内容'
    },
    {
      icon: <AppstoreOutlined style={{ fontSize: 32, color: '#87bd76' }} />,
      title: '课件生成',
      desc: '自动生成白板讲解课件'
    },
    {
      icon: <CloudSyncOutlined style={{ fontSize: 32, color: '#87bd76' }} />,
      title: '云端同步',
      desc: '多设备数据安全同步'
    }
  ]

  return (
    <div className={styles.container}>
      {/* 欢迎区域 */}
      <Card className={styles.welcomeCard}>
        <Space direction="vertical" size="middle" align="center" style={{ width: '100%' }}>
          <div className={styles.icon}>🍃</div>
          <Title level={2} style={{ margin: 0, color: '#4d7c3e' }}>
            易小卷 - 离线试卷课件一键生成
          </Title>
          <Paragraph type="secondary" style={{ textAlign: 'center', maxWidth: 400 }}>
            专为K12教师设计，上传试卷照片或截图，自动识别生成带讲解白板的课件
          </Paragraph>
          <Paragraph type="secondary" style={{ textAlign: 'center', fontSize: 13 }}>
            点击右上角 <strong>新建课件</strong> 开始使用
          </Paragraph>
        </Space>
      </Card>

      {/* 功能卡片 */}
      <Row gutter={[16, 16]} className={styles.featureRow}>
        {features.map((feature, index) => (
          <Col span={8} key={index}>
            <Card hoverable className={styles.featureCard}>
              <Space direction="vertical" align="center" style={{ width: '100%' }}>
                {feature.icon}
                <Title level={5} style={{ margin: '8px 0 4px' }}>{feature.title}</Title>
                <Paragraph type="secondary" style={{ margin: 0, fontSize: 12 }}>
                  {feature.desc}
                </Paragraph>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>

      {/* 状态栏 */}
      <Card className={styles.statusCard}>
        <Row gutter={16}>
          <Col span={8}>
            <Statistic 
              title="应用版本" 
              value={appVersion} 
              valueStyle={{ color: '#87bd76', fontSize: 16 }}
            />
          </Col>
          <Col span={8}>
            <Statistic 
              title="运行平台" 
              value={platform.toUpperCase()} 
              valueStyle={{ color: '#87bd76', fontSize: 16 }}
            />
          </Col>
          <Col span={8}>
            <Statistic 
              title="数据存储" 
              value="仅本地" 
              valueStyle={{ color: '#87bd76', fontSize: 16 }}
            />
          </Col>
        </Row>
      </Card>
    </div>
  )
}

export default HomePage
