/**
 * 主布局组件
 * 包含顶部导航栏、左侧边栏、主内容区
 */
import { Layout } from 'antd'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import styles from './MainLayout.module.less'

const { Content } = Layout

function MainLayout() {
  return (
    <Layout className={styles.layout}>
      <Header />
      <Layout>
        <Sidebar />
        <Content className={styles.content}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}

export default MainLayout
