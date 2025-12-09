/**
 * 左侧边栏组件
 */
import { Layout, Empty, Spin, List } from 'antd'
import { 
  FileTextOutlined,
  ReloadOutlined
} from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import { useEffect, useState, useCallback } from 'react'
import styles from './Sidebar.module.less'

const { Sider } = Layout

interface Courseware {
  id: string
  title: string
  status: string
  created_at: string
  updated_at: string
}

function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const [coursewares, setCoursewares] = useState<Courseware[]>([])
  const [loading, setLoading] = useState(false)
  
  // 设置页面不显示侧边栏
  const isSettingsPage = location.pathname === '/settings'
  
  // 加载课件列表
  const loadCoursewares = useCallback(async () => {
    if (!window.electronAPI) return
    
    setLoading(true)
    try {
      const result = await window.electronAPI.courseware.getAll()
      if (result.success && result.data) {
        setCoursewares(result.data)
      }
    } catch (error) {
      console.error('加载课件列表失败:', error)
    } finally {
      setLoading(false)
    }
  }, [])
  
  // 首次加载和路由变化时刷新
  useEffect(() => {
    loadCoursewares()
  }, [loadCoursewares, location.pathname])
  

  
  const handleCoursewareClick = (id: string) => {
    navigate(`/?coursewareId=${id}`)
  }

  // 设置页面隐藏侧边栏
  if (isSettingsPage) {
    return null
  }
  
  return (
    <Sider 
      width={240} 
      className={styles.sidebar}
      theme="light"
    >
      <div className={styles.courseSection}>
        <div className={styles.sectionTitle}>
          <span>我的课件</span>
          <ReloadOutlined 
            className={styles.refreshIcon}
            onClick={loadCoursewares}
            spin={loading}
          />
        </div>
        <div className={styles.listWrapper}>
          {loading ? (
            <div className={styles.loadingWrapper}>
              <Spin size="small" />
            </div>
          ) : coursewares.length === 0 ? (
            <Empty 
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={<span className={styles.emptyText}>暂无历史课件</span>}
              className={styles.empty}
            />
          ) : (
            <List
              size="small"
              dataSource={coursewares}
              className={styles.courseList}
              renderItem={(item) => {
                // 格式化日期显示
                const date = new Date(item.updated_at || item.created_at)
                const dateStr = `${date.getMonth() + 1}/${date.getDate()}`
                
                return (
                  <List.Item 
                    className={styles.courseItem}
                    onClick={() => handleCoursewareClick(item.id)}
                  >
                    <div className={styles.courseItemContent}>
                      <FileTextOutlined className={styles.courseIcon} />
                      <div className={styles.courseInfo}>
                        <div className={styles.courseTitle} title={item.title}>
                          {item.title}
                        </div>
                        <div className={styles.courseMeta}>{dateStr}</div>
                      </div>
                    </div>
                  </List.Item>
                )
              }}
            />
          )}
        </div>
      </div>
      
    </Sider>
  )
}

export default Sidebar
