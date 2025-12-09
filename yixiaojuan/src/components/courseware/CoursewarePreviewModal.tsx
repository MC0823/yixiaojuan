import { Modal, Radio, Checkbox, Space, Tag } from 'antd'
import { useState, useMemo } from 'react'
import type { UploadImageItem } from '../upload/types'

interface CoursewarePreviewModalProps {
  visible: boolean
  images: UploadImageItem[]
  onConfirm: (mode: 'merge' | 'separate', selectedGroups?: string[]) => void
  onCancel: () => void
}

export function CoursewarePreviewModal({ visible, images, onConfirm, onCancel }: CoursewarePreviewModalProps) {
  const [mode, setMode] = useState<'merge' | 'separate'>('separate')
  const [selectedGroups, setSelectedGroups] = useState<string[]>([])

  const groups = useMemo(() => {
    const groupMap = new Map<string, UploadImageItem[]>()
    images.forEach(img => {
      const group = img.sourceImage || '未分组'
      if (!groupMap.has(group)) {
        groupMap.set(group, [])
      }
      groupMap.get(group)!.push(img)
    })
    return Array.from(groupMap.entries()).map(([name, items]) => ({ name, items, count: items.length }))
  }, [images])

  const hasMultipleGroups = groups.length > 1

  const handleConfirm = () => {
    if (mode === 'separate' && selectedGroups.length === 0) {
      return
    }
    onConfirm(mode, mode === 'separate' ? selectedGroups : undefined)
  }

  return (
    <Modal
      title="创建课件"
      open={visible}
      onCancel={onCancel}
      onOk={handleConfirm}
      okText="确认创建"
      cancelText="取消"
      width={600}
    >
      {hasMultipleGroups && (
        <>
          <div style={{ marginBottom: 16 }}>
            <strong>检测到 {groups.length} 张试卷，共 {images.length} 道题目</strong>
          </div>
          <Radio.Group value={mode} onChange={e => setMode(e.target.value)} style={{ marginBottom: 16 }}>
            <Space direction="vertical">
              <Radio value="merge">合并为一个课件（包含所有题目）</Radio>
              <Radio value="separate">分别创建课件（按试卷分组）</Radio>
            </Space>
          </Radio.Group>
        </>
      )}

      {mode === 'separate' && hasMultipleGroups && (
        <div style={{ marginTop: 16 }}>
          <div style={{ marginBottom: 8 }}><strong>选择要创建的试卷：</strong></div>
          <Checkbox.Group
            value={selectedGroups}
            onChange={setSelectedGroups as any}
            style={{ width: '100%' }}
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              {groups.map(group => (
                <Checkbox key={group.name} value={group.name}>
                  <Space>
                    <span>{group.name}</span>
                    <Tag>{group.count} 道题</Tag>
                  </Space>
                </Checkbox>
              ))}
            </Space>
          </Checkbox.Group>
        </div>
      )}

      {!hasMultipleGroups && (
        <div>共 {images.length} 道题目，将创建一个课件</div>
      )}
    </Modal>
  )
}
