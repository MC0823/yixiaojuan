/**
 * 顶部导航栏组件
 */
import { Layout, Button, Tooltip } from 'antd'
import { SettingOutlined, PlusOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import styles from './Header.module.less'

const { Header: AntHeader } = Layout

function Header() {
  const navigate = useNavigate()
  const location = useLocation()
  
  const isSubPage = location.pathname !== '/'
  const isSettingsPage = location.pathname === '/settings'

  return (
    <AntHeader className={styles.header}>
      <div className={styles.logo}>
        {isSubPage && (
          <Button 
            icon={<ArrowLeftOutlined />}
            className={styles.glassBtn}
            onClick={() => navigate(-1)}
          />
        )}
        <span className={styles.logoIcon}>🍃</span>
        <span className={styles.logoText}>易小卷</span>
        <Tooltip title="设置">
          <Button 
            icon={<SettingOutlined />}
            className={styles.settingsBtn}
            onClick={() => navigate('/settings')}
          />
        </Tooltip>
      </div>
      {!isSettingsPage && (
        <div className={styles.actions}>
          <Button 
            type="primary" 
            icon={<PlusOutlined />}
            className={styles.primaryBtn}
            onClick={() => navigate('/upload')}
          >
            新建课件
          </Button>
        </div>
      )}
    </AntHeader>
  )
}

export default Header
