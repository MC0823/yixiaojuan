import { Modal, Radio, Checkbox, Space, Tag } from 'antd'
import { useState, useMemo } from 'react'
import type { UploadImageItem } from '../upload/types'

interface CoursewarePreviewModalProps {
  visible: boolean
  images: UploadImageItem[]
  onConfirm: (mode: 'merge' | 'separate', selectedGroups?: string[]) => void
  onCancel: () => void
}

/**
 * 从完整路径提取文件名（不含扩展名）
 */
function getDisplayName(path: string): string {
  // 提取文件名（处理 Windows 和 Unix 路径）
  const fileName = path.split(/[\\/]/).pop() || path
  // 移除扩展名
  return fileName.replace(/\.(jpg|jpeg|png|gif|bmp|webp)$/i, '')
}

export function CoursewarePreviewModal({ visible, images, onConfirm, onCancel }: CoursewarePreviewModalProps) {
  const [mode, setMode] = useState<'merge' | 'separate'>('separate')
  const [selectedGroups, setSelectedGroups] = useState<string[]>([])

  const groups = useMemo(() => {
    console.log('[CoursewarePreviewModal] 开始分组, 图片数量:', images.length)
    console.log('[CoursewarePreviewModal] 图片sourceImage:', images.map(img => ({ name: img.name, sourceImage: img.sourceImage })))

    const groupMap = new Map<string, UploadImageItem[]>()
    images.forEach(img => {
      // 使用完整路径作为分组key，确保不同文件夹的同名文件不会被合并
      const groupKey = img.sourceImage || '未分组'
      if (!groupMap.has(groupKey)) {
        groupMap.set(groupKey, [])
      }
      groupMap.get(groupKey)!.push(img)
    })
    // 保存完整路径作为key，但显示时只用文件名
    const result = Array.from(groupMap.entries()).map(([key, items]) => ({ 
      key,  // 完整路径，用于分组标识
      displayName: getDisplayName(key),  // 显示名称
      items, 
      count: items.length 
    }))
    console.log('[CoursewarePreviewModal] 分组结果:', result.map(g => ({ key: g.key, displayName: g.displayName, count: g.count })))
    console.log('[CoursewarePreviewModal] hasMultipleGroups:', result.length > 1)
    return result
  }, [images])

  const hasMultipleGroups = groups.length > 1

  const handleConfirm = () => {
    if (mode === 'separate' && hasMultipleGroups && selectedGroups.length === 0) {
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
            onChange={(values) => setSelectedGroups(values as string[])}
            style={{ width: '100%' }}
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              {groups.map(group => (
                <Checkbox key={group.key} value={group.key}>
                  <Space>
                    <span>{group.displayName}</span>
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
