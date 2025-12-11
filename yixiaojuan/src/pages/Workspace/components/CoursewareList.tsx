/**
 * 课件列表组件
 * 显示左侧课件列表和题目列表
 */
import React from 'react'
import { Spin, Button, Tooltip, Input, Dropdown } from 'antd'
import {
  FileTextOutlined,
  ReloadOutlined,
  FolderOpenOutlined,
  DeleteOutlined,
  MoreOutlined,
  ImportOutlined,
  ExportOutlined
} from '@ant-design/icons'
import styles from '../Workspace.module.less'

interface Courseware {
  id: string
  title: string
  status: string
  created_at: string
  updated_at: string
}

interface QuestionData {
  id: string
  ocr_text?: string
}

interface CoursewareListProps {
  // 课件数据
  coursewares: Courseware[]
  loadingList: boolean
  selectedId: string | null
  
  // 题目数据
  questions: QuestionData[]
  currentIndex: number
  
  // 编辑状态
  editingCoursewareId: string | null
  editingCoursewareName: string
  
  // 导入导出状态
  isImporting: boolean
  isExporting: boolean
  
  // 事件处理
  onSelectCourseware: (id: string) => void
  onDeleteCourseware: (id: string) => void
  onRefresh: () => void
  onImport: () => void
  onExport: () => void
  onDoubleClickCourseware: (id: string, title: string) => void
  onEditingNameChange: (name: string) => void
  onSaveCoursewareName: () => void
  onCancelEditCoursewareName: () => void
  onSwitchQuestion: (index: number) => void
}

// 格式化日期
const formatDate = (dateStr: string) => {
  const date = new Date(dateStr)
  return `${date.getMonth() + 1}/${date.getDate()}`
}

export const CoursewareList: React.FC<CoursewareListProps> = ({
  coursewares,
  loadingList,
  selectedId,
  questions,
  currentIndex,
  editingCoursewareId,
  editingCoursewareName,
  isImporting,
  isExporting,
  onSelectCourseware,
  onDeleteCourseware,
  onRefresh,
  onImport,
  onExport,
  onDoubleClickCourseware,
  onEditingNameChange,
  onSaveCoursewareName,
  onCancelEditCoursewareName,
  onSwitchQuestion
}) => {
  return (
    <aside className={styles.leftPanel}>
      {/* 课件列表 */}
      <div className={`${styles.glassCard} ${styles.coursewareList}`}>
        <div className={styles.listHeader}>
          <span className={styles.title}>我的课件</span>
          <div className={styles.headerActions}>
            <Tooltip title="导入课件">
              <ImportOutlined
                className={styles.actionIcon}
                onClick={onImport}
                style={{ cursor: isImporting ? 'wait' : 'pointer' }}
              />
            </Tooltip>
            <Tooltip title="导出课件">
              <ExportOutlined
                className={styles.actionIcon}
                onClick={onExport}
                style={{ cursor: isExporting || !selectedId ? 'not-allowed' : 'pointer', opacity: selectedId ? 1 : 0.5 }}
              />
            </Tooltip>
            <Tooltip title="刷新">
              <ReloadOutlined
                className={styles.actionIcon}
                spin={loadingList}
                onClick={onRefresh}
              />
            </Tooltip>
          </div>
        </div>
        
        <div className={styles.listContent}>
          {loadingList ? (
            <div className={styles.loading}>
              <Spin />
            </div>
          ) : coursewares.length === 0 ? (
            <div className={styles.emptyState}>
              <FolderOpenOutlined className={styles.emptyIcon} />
              <span className={styles.emptyText}>暂无课件</span>
            </div>
          ) : (
            coursewares.map(item => (
              <div
                key={item.id}
                className={`${styles.coursewareItem} ${selectedId === item.id ? styles.active : ''}`}
                onClick={() => onSelectCourseware(item.id)}
              >
                <FileTextOutlined className={styles.itemIcon} />
                <div className={styles.itemInfo}>
                  {editingCoursewareId === item.id ? (
                    <Input
                      size="small"
                      value={editingCoursewareName}
                      onChange={(e) => onEditingNameChange(e.target.value)}
                      onPressEnter={onSaveCoursewareName}
                      onBlur={onSaveCoursewareName}
                      onKeyDown={(e) => e.key === 'Escape' && onCancelEditCoursewareName()}
                      autoFocus
                      className={styles.editInput}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <div
                      className={styles.itemTitle}
                      onDoubleClick={(e) => {
                        e.stopPropagation()
                        onDoubleClickCourseware(item.id, item.title)
                      }}
                      title="双击编辑名称"
                    >
                      {item.title}
                    </div>
                  )}
                  <div className={styles.itemMeta}>{formatDate(item.created_at)}</div>
                </div>
                <Dropdown
                  menu={{
                    items: [
                      { key: 'delete', label: '删除', danger: true, icon: <DeleteOutlined /> }
                    ],
                    onClick: ({ key }) => {
                      if (key === 'delete') {
                        onDeleteCourseware(item.id)
                      }
                    }
                  }}
                  trigger={['click']}
                >
                  <Button
                    type="text"
                    size="small"
                    icon={<MoreOutlined />}
                    className={styles.itemActions}
                    onClick={e => e.stopPropagation()}
                    style={{ color: 'white' }}
                  />
                </Dropdown>
              </div>
            ))
          )}
        </div>
      </div>
      
      {/* 题目列表 */}
      {selectedId && questions.length > 0 && (
        <div className={`${styles.glassCard} ${styles.questionList}`}>
          <div className={styles.listHeader}>
            <span className={styles.title}>题目列表</span>
            <span className={styles.questionCount}>{currentIndex + 1}/{questions.length}</span>
          </div>
          <div className={styles.listContent}>
            {questions.map((q, index) => (
              <div
                key={q.id}
                className={`${styles.questionItem} ${index === currentIndex ? styles.active : ''}`}
                onClick={() => onSwitchQuestion(index)}
              >
                <span className={styles.questionNumber}>{index + 1}</span>
                <span className={styles.questionPreview}>
                  {q.ocr_text?.substring(0, 15) || '未识别'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </aside>
  )
}
